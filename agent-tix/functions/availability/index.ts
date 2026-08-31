// Agent Tix — availability
//
// Two jobs, one function, because they are the same read against the same
// tables: list the fight nights in a range so the calendar can be drawn, and
// return the seat classes for one chosen night.
//
// Never returns a remaining count. Status labels only, per the brief.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const TENANT = "muaytix";

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

const supabase = createClient(supabaseUrl, serviceKey as string, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Origins come from the tenant row rather than a hardcoded list, so a second
// agent needs no code change. Cached because this runs on every request.
let allowedOrigins: Set<string> | null = null;
let originsFetchedAt = 0;

async function originsForTenant(): Promise<Set<string>> {
  if (allowedOrigins && Date.now() - originsFetchedAt < 60_000) return allowedOrigins;
  const { data } = await supabase
    .from("tenants")
    .select("allowed_origins")
    .eq("slug", TENANT)
    .single();
  allowedOrigins = new Set<string>(data?.allowed_origins ?? []);
  originsFetchedAt = Date.now();
  return allowedOrigins;
}

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
}

function json(body: unknown, status: number, origin: string) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Postgres hands back "19:00:00"; the widget only ever prints hours and minutes.
function hhmm(t: string | null): string | null {
  return t ? t.slice(0, 5) : null;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  const origins = await originsForTenant();

  if (req.method === "OPTIONS") {
    return origins.has(origin)
      ? new Response(null, { status: 204, headers: corsHeaders(origin) })
      : new Response(null, { status: 403 });
  }
  if (!origins.has(origin)) return json({ error: "This website is not authorised." }, 403, origin);
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Could not read the request." }, 400, origin);
  }

  const action = String(body.action ?? "");

  try {
    // ---- the calendar ------------------------------------------------------
    // Answers "which nights are on between these dates", which nothing in the
    // current system can do: today the dates are typed into the widget by hand.
    //
    // Reads event_calendar, one row per night. The old availability view is one
    // row per class, so drawing a month meant loading every class for every
    // night to show none of them.
    if (action === "events") {
      const from = String(body.from ?? "");
      const to = String(body.to ?? "");
      if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
        return json({ error: "Dates must be YYYY-MM-DD." }, 400, origin);
      }

      const { data, error } = await supabase
        .from("event_calendar")
        .select("event_key,event_name,event_description,short_name,series_slug,accent_colour,local_date,local_start_time,local_end_time,venue_name,venue_timezone")
        .gte("local_date", from)
        .lte("local_date", to)
        .order("local_date");
      if (error) throw error;

      // A page that asks for a seat class first needs the calendar to know, for
      // every night at once, whether that class is on sale — otherwise the guest
      // picks Ringside, picks a night, and only then finds out. Asked for by
      // class code so the answer stays one row per night rather than four.
      const classCode = String(body.classCode ?? "").trim();
      const seatStatus = new Map<string, { status: string; closedExplanation: string | null }>();
      if (classCode && (data ?? []).length > 0) {
        const { data: seats, error: seatError } = await supabase
          .from("event_ticket_availability")
          .select("event_key,status,closed_explanation")
          .eq("ticket_class_code", classCode)
          .in("event_key", (data ?? []).map((r) => r.event_key));
        if (seatError) throw seatError;
        for (const s of seats ?? []) {
          seatStatus.set(s.event_key, {
            status: s.status,
            closedExplanation: s.closed_explanation ?? null,
          });
        }
      }

      return json({
        events: (data ?? []).map((row) => {
          const seat = seatStatus.get(row.event_key);
          return {
            eventKey: row.event_key,
            date: row.local_date,          // already the Bangkok calendar day
            name: row.event_name,
            shortName: row.short_name,
            // Which promotion this night belongs to, so a page can show only its
            // own nights without a second request or a separate endpoint.
            series: row.series_slug,
            colour: row.accent_colour,
            description: row.event_description,
            startTime: hhmm(row.local_start_time),
            endTime: hhmm(row.local_end_time),
            venue: row.venue_name,
            timezone: row.venue_timezone,
            // Only present when a class was asked for. A night with no row for
            // that class is left undefined rather than guessed at.
            classStatus: seat ? seat.status : null,
            classClosedExplanation: seat ? seat.closedExplanation : null,
          };
        }),
      }, 200, origin);
    }

    // ---- the seat classes on their own -------------------------------------
    // For a page that asks which seat you want before which night. Nothing here
    // is per-night: it is the catalogue, plus a count of how many nights in the
    // window each class is actually on sale for, so a class that is open
    // nowhere can be shown as such instead of leading to an empty calendar.
    if (action === "classes") {
      const from = String(body.from ?? "");
      const to = String(body.to ?? "");
      if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
        return json({ error: "Dates must be YYYY-MM-DD." }, 400, origin);
      }

      const { data: cat, error: catError } = await supabase
        .from("ticket_classes")
        .select("code,name,description,accent_colour,accent_ink,display_order")
        .eq("active", true)
        .order("display_order");
      if (catError) throw catError;

      const { data: nights, error: nightError } = await supabase
        .from("event_calendar")
        .select("event_key")
        .gte("local_date", from)
        .lte("local_date", to);
      if (nightError) throw nightError;

      const keys = (nights ?? []).map((n) => n.event_key);
      const onSale = new Map<string, number>();
      if (keys.length > 0) {
        const { data: seats, error: seatError } = await supabase
          .from("event_ticket_availability")
          .select("ticket_class_code,status")
          .in("event_key", keys);
        if (seatError) throw seatError;
        for (const s of seats ?? []) {
          // "On sale" means a guest could buy it right now. Sold out and closed
          // both count as not on sale, for opposite reasons.
          if (s.status === "available" || s.status === "limited") {
            onSale.set(s.ticket_class_code, (onSale.get(s.ticket_class_code) ?? 0) + 1);
          }
        }
      }

      return json({
        classes: (cat ?? []).map((c) => ({
          code: c.code,
          name: c.name,
          description: c.description,
          colour: c.accent_colour,
          ink: c.accent_ink,
          nightsOnSale: onSale.get(c.code) ?? 0,
        })),
      }, 200, origin);
    }

    // ---- one night ---------------------------------------------------------
    if (action === "availability") {
      const eventKey = String(body.eventKey ?? "").trim();
      if (!eventKey) return json({ error: "Event reference is missing." }, 400, origin);

      const { data: header, error: headerError } = await supabase
        .from("event_calendar")
        .select("*")
        .eq("event_key", eventKey)
        .maybeSingle();
      if (headerError) throw headerError;
      if (!header) return json({ error: "That fight night could not be found." }, 404, origin);

      const { data: rows, error } = await supabase
        .from("event_ticket_availability")
        .select("*")
        .eq("event_key", eventKey)
        .order("display_order");
      if (error) throw error;
      if (!rows || rows.length === 0) {
        return json({ error: "That fight night could not be found." }, 404, origin);
      }

      const ids = rows.map((r) => r.event_ticket_class_id);
      const { data: prices, error: priceError } = await supabase
        .from("event_ticket_prices")
        .select("event_ticket_class_id,currency,unit_amount,display_order")
        .in("event_ticket_class_id", ids)
        .order("display_order");
      if (priceError) throw priceError;

      const byClass = new Map<string, { currency: string; unitAmount: number }[]>();
      for (const p of prices ?? []) {
        const list = byClass.get(p.event_ticket_class_id) ?? [];
        list.push({ currency: p.currency, unitAmount: p.unit_amount });
        byClass.set(p.event_ticket_class_id, list);
      }

      return json(
        {
          event: {
            eventKey: header.event_key,
            date: header.local_date,
            name: header.event_name,
            shortName: header.short_name,
            colour: header.accent_colour,
            description: header.event_description,
            startTime: hhmm(header.local_start_time),
            endTime: hhmm(header.local_end_time),
            venue: header.venue_name,
            timezone: header.venue_timezone,
          },
          // Every class is returned, sold out and closed included, each with its
          // own status. Hiding them is what sends a guest to a competitor.
          classes: rows
            .filter((r) => r.status !== "hidden")
            .map((r) => ({
              code: r.ticket_class_code,
              name: r.ticket_class_name,
              description: r.ticket_class_description,
              status: r.status,
              colour: r.ticket_class_colour,
              ink: r.ticket_class_ink,
              closedExplanation: r.closed_explanation,
              assignedSeating: r.assigned_seating,
              maximumSeatsTogether: r.maximum_seats_together,
              maxPerOrder: r.max_per_order,
              prices: byClass.get(r.event_ticket_class_id) ?? [],
            })),
        },
        200,
        origin,
      );
    }

    return json({ error: "Unknown request." }, 400, origin);
  } catch (err) {
    console.error("availability failed", { action, message: String(err) });
    return json({ error: "Availability could not be checked." }, 500, origin);
  }
});
