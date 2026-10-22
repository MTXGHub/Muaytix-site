// Agent Tix — stadium-sync
//
// Reads the stadium's availability tracker every few minutes (called by the
// database's own clock, see schema/0045_stadium_sync.sql and the notes in
// agent-tix/notes/stadium-availability-tracker.md), compares it with the read
// before, and hands every CHANGE to stadium_apply_change() in the database,
// which holds the rules. This function only fetches, parses, compares and
// records; it decides nothing about stock.
//
// Safe by construction:
//   - does nothing unless stadium_sync_settings.enabled is on
//   - dry_run on means the database logs what it would do and changes nothing
//   - the first read only sets the baseline
//   - a page that does not parse the way we expect changes nothing
//   - a run with an unusually large number of changes applies none and says so
//   - the call must carry the shared token held in stadium_sync_settings

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { diffTrackers, parseTracker } from "./parse.ts";

const MAX_CHANGES_PER_RUN = 25;

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  (() => {
    const keys = Deno.env.get("SUPABASE_SECRET_KEYS");
    if (!keys) return undefined;
    try {
      const parsed = JSON.parse(keys);
      return parsed.default ?? Object.values(parsed)[0];
    } catch {
      return undefined;
    }
  })();
if (!supabaseUrl || !serviceKey) throw new Error("Supabase settings are missing");

const sb = createClient(supabaseUrl, serviceKey as string, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function note(built: string | null, action: string, detail: string, night: string | null = null) {
  await sb.from("stadium_changes").insert({ built, night, zone: "SYNC", action, detail });
}

Deno.serve(async (req: Request) => {
  const { data: s, error: se } = await sb.from("stadium_sync_settings").select("*").eq("id", 1).single();
  if (se || !s) return json({ error: "settings missing" }, 500);
  if (req.headers.get("x-sync-token") !== s.sync_token) return json({ error: "no" }, 401);
  if (!s.enabled) return json({ skipped: "disabled" });
  if (!s.tracker_url) return json({ error: "no tracker address set" }, 500);

  let built: string | null = null;
  try {
    const res = await fetch(s.tracker_url, { redirect: "follow", signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error("tracker answered " + res.status);
    const tracker = parseTracker(await res.text());
    built = tracker.generated;

    const { data: snap, error: ge } = await sb.from("stadium_snapshot").select("d,z,o").limit(5000);
    if (ge) throw new Error("cannot read snapshot: " + ge.message);
    const prev = new Map<string, { z: string; o: number }>(
      (snap ?? []).map((r: { d: string; z: string; o: number }) => [r.d, { z: r.z, o: r.o }]),
    );

    let applied = 0;
    let summary = "";
    if (prev.size === 0) {
      await note(built, "baseline", `first read: ${tracker.events.length} days stored, nothing changed`);
      summary = "baseline";
    } else {
      const changes = diffTrackers(prev, tracker);
      const newDays = changes.filter((c) => c.zone === "NEW");
      const real = changes.filter((c) => c.zone !== "NEW");
      if (newDays.length) {
        await note(built, "noted", `${newDays.length} new dates from the stadium, ${newDays[0].night} to ${newDays[newDays.length - 1].night}`);
      }
      if (real.length > MAX_CHANGES_PER_RUN) {
        await note(built, "NOT APPLIED", `${real.length} changes in one read is more than the safe limit of ${MAX_CHANGES_PER_RUN}; nothing was changed, Jason to check`);
      } else {
        for (const c of real) {
          const { error } = await sb.rpc("stadium_apply_change", {
            p_night: c.night, p_zone: c.zone, p_from: c.from, p_to: c.to,
            p_built: built, p_dry: s.dry_run,
          });
          if (error) await note(built, "ERROR", `${c.night} ${c.zone} ${c.from}->${c.to}: ${error.message}`, c.night);
          else applied++;
        }
      }
      summary = `${real.length} changes, ${newDays.length} new days`;
    }

    // Move the snapshot on to what we just read (changed and new days only).
    const rows = tracker.events
      .filter((e) => {
        const was = prev.get(e.d);
        return !was || was.z !== e.z || was.o !== e.o;
      })
      .map((e) => ({ d: e.d, z: e.z, o: e.o, seen_at: new Date().toISOString() }));
    for (let i = 0; i < rows.length; i += 400) {
      const { error } = await sb.from("stadium_snapshot").upsert(rows.slice(i, i + 400));
      if (error) throw new Error("cannot save snapshot: " + error.message);
    }

    await sb.from("stadium_sync_settings").update({
      last_run_at: new Date().toISOString(), last_built: built, last_error: null,
    }).eq("id", 1);
    return json({ ok: true, built, summary, applied, dry_run: s.dry_run });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb.from("stadium_sync_settings").update({
      last_run_at: new Date().toISOString(), last_error: msg,
    }).eq("id", 1);
    await note(built, "ERROR", msg);
    return json({ error: msg }, 500);
  }
});
