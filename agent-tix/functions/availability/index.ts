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
    // current system can do: today the dates are typed into the widget.
    if (action === "events") {
      const from = String(body.from ?? "");
      const to = String(body.to ?? "");
      if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
        return json({ error: "Dates must be YYYY-MM-DD." }, 400, origin);
      }

      const { data, error } = await supabase
        .from("event_ticket_availability")
        .select("event_key,event_name,event_description,starts_at,ends_at,venue_name,venue_timezone")
        .gte("starts_at", `${from}T00:00:00+07:00`)
        .lte("starts_at", `${to}T23:59:59+07:00`)
        .order("starts_at");
      if (error) throw error;

      // The view is one row per class, so collapse to one row per night.
      const seen = new Map<string, unknown>();
      for (const row of data ?? []) {
        if (!seen.has(row.event_key)) {
          seen.set(row.event_key, {
            eventKey: row.event_key,
            name: row.event_name,
            description: row.event_description,
            startsAt: row.starts_at,
            endsAt: row.ends_at,
            venue: row.venue_name,
            timezone: row.venue_timezone,
          });
        }
      }
      return json({ events: [...seen.values()] }, 200, origin);
    }

    // ---- one night ---------------------------------------------------------
    if (action === "availability") {
      const eventKey = String(body.eventKey ?? "").trim();
      if (!eventKey) return json({ error: "Event reference is missing." }, 400, origin);

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

      const first = rows[0];
      return json(
        {
          event: {
            eventKey: first.event_key,
            name: first.event_name,
            description: first.event_description,
            startsAt: first.starts_at,
            endsAt: first.ends_at,
            venue: first.venue_name,
            timezone: first.venue_timezone,
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
