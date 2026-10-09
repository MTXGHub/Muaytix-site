// Agent Tix — availability
//
// Two jobs, one function, because they are the same read against the same
// tables: list the fight nights in a range so the calendar can be drawn, and
// return the seat classes for one chosen night.
//
// Returns a remaining count only once it is down to the last few, and never the
// real figure above that — see seatsLeft further down for why.
//
// It also keeps a note of what it answered — see recordLook. Ninety per cent of
// visitors never reach the checkout, so this is the only place their experience
// is visible at all. What we served, never who we served it to, and never on
// the guest's time: the answer goes out first and the note is written after.

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

// A guest's own live hold (schema/0043). The widget sends the reservation id it
// was given when the guest pressed Reserve; the id is a bearer token for that
// hold and nothing else. Everything here reads non personal columns only.
//
// Strictly an extra. A request with no holdId is answered exactly as it always
// was, byte for byte, which is what an older copy of the widget cached in a
// browser sends. A hold that cannot be read leaves the public answer untouched.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LiveHold = {
  hold_id: string; event_key: string; event_ticket_class_id: string;
  ticket_class_code: string; ticket_class_name: string; quantity: number;
  currency: string | null; expires_at: string; seconds_left: number;
};

type HolderView = { status: string; quantity_available: number; max_per_order: number };

function holdIdFrom(value: unknown): string | null {
  return typeof value === "string" && UUID.test(value.trim()) ? value.trim().toLowerCase() : null;
}

async function readHold(holdId: string, eventKey: string | null): Promise<LiveHold | null> {
  const { data, error } = await supabase.rpc("live_hold", {
    p_reservation_id: holdId,
    p_event_key: eventKey,
  });
  if (error) throw error;
  return (data as LiveHold[] | null)?.[0] ?? null;
}

// What the widget needs to draw the notice, and nothing else about the hold.
function holdForWidget(h: LiveHold) {
  return {
    classCode: h.ticket_class_code,
    className: h.ticket_class_name,
    eventKey: h.event_key,
    quantity: h.quantity,
    currency: h.currency,
    expiresAt: h.expires_at,
    secondsLeft: h.seconds_left,
  };
}

// Photos and selling lines are free-form JSON in the database, so what leaves
// here is checked rather than trusted: a photo must be an https address, a line
// must have words. Anything else is dropped, not repaired, and the widget never
// sees it.
function cleanPhotos(raw: unknown): { url: string; alt: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { url: string; alt: string }[] = [];
  for (const p of raw) {
    const url = typeof p?.url === "string" ? p.url.trim() : "";
    if (!/^https:\/\//i.test(url)) continue;
    out.push({ url, alt: typeof p?.alt === "string" ? p.alt : "" });
  }
  return out;
}

function cleanBenefits(raw: unknown): { text: string; note: string | null }[] {
  if (!Array.isArray(raw)) return [];
  const out: { text: string; note: string | null }[] = [];
  for (const b of raw) {
    const text = typeof b?.text === "string" ? b.text.trim() : "";
    if (!text) continue;
    const note = typeof b?.note === "string" && b.note.trim() ? b.note.trim() : null;
    out.push({ text, note });
  }
  return out;
}

// Club Class offered to a guest whose LEO choice is fully booked (schema/0040).
//
// Returns, for each fully booked class that has one, what it leads to and the
// price in every currency. Three rules, in order of importance:
//
//   It is only ever an extra. Any failure here, a missing table included, gives
//   an empty answer and the night is described exactly as it was before. It must
//   never be the reason a guest cannot see a night.
//
//   It is per night and off by default (events.fallback_offer_enabled), so RWS
//   never carries it unless someone deliberately switches it on.
//
//   It is only sent while the class it leads to can actually be bought, and only
//   with prices that sit between 90 and 100 per cent of what that class costs on
//   this night, the stadium's 10 per cent limit. create-checkout checks all of
//   it again; this decides only what is drawn.
type NightOffer = { toCode: string; prices: { currency: string; unitAmount: number }[] };

async function offersForNight(
  eventKey: string,
  rows: Record<string, unknown>[],
  nightPrices: Map<string, { currency: string; unitAmount: number }[]>,
): Promise<Map<string, NightOffer>> {
  const found = new Map<string, NightOffer>();
  try {
    const { data: ev } = await supabase
      .from("events").select("fallback_offer_enabled").eq("event_key", eventKey).maybeSingle();
    if (!ev?.fallback_offer_enabled) return found;

    const { data: offers } = await supabase
      .from("class_fallback_offers").select("id,from_class_id,to_class_id").eq("active", true);
    if (!offers || offers.length === 0) return found;

    const { data: classes } = await supabase.from("ticket_classes").select("id,code");
    const codeOf = new Map((classes ?? []).map((c) => [c.id as string, c.code as string]));
    const { data: offerPrices } = await supabase
      .from("class_fallback_offer_prices").select("offer_id,currency,unit_amount")
      .in("offer_id", offers.map((o) => o.id));

    for (const o of offers) {
      const fromCode = codeOf.get(o.from_class_id);
      const toCode = codeOf.get(o.to_class_id);
      const from = rows.find((r) => r.ticket_class_code === fromCode);
      const to = rows.find((r) => r.ticket_class_code === toCode);
      if (!fromCode || !toCode || !from || !to) continue;
      if (from.status !== "fully_booked") continue;
      if (to.status !== "available" && to.status !== "limited") continue;

      // One price for every currency the target class is sold in, or no offer:
      // a currency with no offer price would leave a guest with a dead button.
      const standing = nightPrices.get(String(to.event_ticket_class_id)) ?? [];
      const prices: { currency: string; unitAmount: number }[] = [];
      for (const std of standing) {
        const p = (offerPrices ?? []).find((x) => x.offer_id === o.id && x.currency === std.currency);
        if (!p || p.unit_amount > std.unitAmount || p.unit_amount * 10 < std.unitAmount * 9) break;
        prices.push({ currency: std.currency, unitAmount: p.unit_amount });
      }
      if (standing.length === 0 || prices.length !== standing.length) continue;
      found.set(fromCode, { toCode, prices });
    }
  } catch (err) {
    console.error("offers could not be read", { eventKey, message: String(err) });
    return new Map();
  }
  return found;
}

// What we told them, kept after the fact.
//
// Three rules, and all three are the reason this is safe to run on every
// request. It never blocks: the response has already gone by the time the row
// is written. It never throws: a failure here is logged and the guest is none
// the wiser. And it records nothing about the person — no IP, no user agent, no
// identifier — only which night was asked about, from which page, and what
// state the seats were in.
type Look = {
  action: string;
  page_path?: string | null;
  from_date?: string | null;
  to_date?: string | null;
  class_code?: string | null;
  nights_offered?: number | null;
  event_key?: string | null;
  event_date?: string | null;
  classes_offered?: number | null;
  available?: number | null;
  limited?: number | null;
  sold_out?: number | null;
  booking_closed?: number | null;
  dead_end?: boolean;
  not_found?: boolean;
  statuses?: Record<string, string> | null;
};

// Path only, query string cut off, same rule as the booking page in 0018: a
// shared link is where an email address or a name ends up.
function pagePathFromReferer(req: Request): string | null {
  const raw = req.headers.get("referer");
  if (!raw) return null;
  try {
    return new URL(raw).pathname.slice(0, 255) || null;
  } catch {
    return null;
  }
}

function recordLook(look: Look) {
  const written = supabase
    .from("widget_looks")
    .insert(look)
    .then(
      ({ error }) => {
        if (error) console.error("could not record the look", { message: error.message });
      },
      (err) => console.error("could not record the look", { message: String(err) }),
    );

  // Supabase's runtime keeps a background promise alive past the response. If it
  // is not there the insert is simply best effort, which is the correct
  // trade: a missing row costs a statistic, a slow widget costs a sale.
  try {
    (globalThis as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } })
      .EdgeRuntime?.waitUntil?.(written);
  } catch {
    // Nothing to do. The promise is already running.
  }
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
  const pagePath = pagePathFromReferer(req);

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

      recordLook({
        action: "events",
        page_path: pagePath,
        from_date: from,
        to_date: to,
        class_code: classCode || null,
        nights_offered: (data ?? []).length,
      });

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
        .select("code,name,description,tagline,accent_colour,accent_ink,display_order")
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

      recordLook({
        action: "classes",
        page_path: pagePath,
        from_date: from,
        to_date: to,
        nights_offered: (nights ?? []).length,
      });

      return json({
        classes: (cat ?? []).map((c) => ({
          code: c.code,
          name: c.name,
          description: c.description,
          tagline: c.tagline ?? null,
          colour: c.accent_colour,
          ink: c.accent_ink,
          nightsOnSale: onSale.get(c.code) ?? 0,
        })),
      }, 200, origin);
    }

    // ---- is this hold still alive? ----------------------------------------
    // Asked when a page loads, and when the browser hands back a page it kept
    // (the back button). The widget will not show a hold it has not just had
    // confirmed here: held, not past its time. An answer of null means it is
    // gone and the widget forgets it; an error means "could not tell", and the
    // widget keeps what it had and shows nothing.
    //
    // Not recorded as a look: it is not a guest looking at a night.
    if (action === "hold") {
      const holdId = holdIdFrom(body.holdId);
      if (!holdId) return json({ hold: null }, 200, origin);
      const found = await readHold(holdId, null);
      return json({ hold: found ? holdForWidget(found) : null }, 200, origin);
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
      if (!header) {
        recordLook({
          action: "availability", page_path: pagePath,
          event_key: eventKey, not_found: true,
        });
        return json({ error: "That fight night could not be found." }, 404, origin);
      }

      const { data: rows, error } = await supabase
        .from("event_ticket_availability")
        .select("*")
        .eq("event_key", eventKey)
        .order("display_order");
      if (error) throw error;
      if (!rows || rows.length === 0) {
        recordLook({
          action: "availability", page_path: pagePath,
          event_key: eventKey, not_found: true,
        });
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

      // How many seats are left, and whether to say it at all.
      //
      // 25 September 2026 (05e049f): Ringside hit exactly 5 and the widget
      // switched from AVAILABLE to "Only 5 left". Jason asked for it to keep
      // saying Available AT that level, so the threshold was set to 0 and
      // every class on sale read Available regardless of count.
      //
      // Jason, 28 September 2026: once a class goes BELOW 5, show the number,
      // and it must still read Available, not Limited (the widget's own
      // statusMeta already renders the count in the same green pill as
      // Available, never the amber Limited one -- nothing to change there).
      // "Below 5" means 5 itself still reads plain Available, exactly as
      // fixed on the 25th; only 4 and under gets a number. So the threshold
      // is 4, not 5.
      //
      // Whatever the threshold, the real figure never leaves here above it.
      // "23 left" would hand a competitor our trading position: watch the
      // page at nine and again at five and they know exactly what we sold
      // that day. Anything above the threshold is sent as null rather than
      // as a number the widget is trusted to hide.
      const SAY_REMAINING_AT = 4;
      const { data: stock, error: stockError } = await supabase
        .from("event_ticket_classes")
        .select("id,quantity_available")
        .in("id", ids);
      if (stockError) throw stockError;

      const fewLeft = new Map<string, number | null>();
      for (const row of stock ?? []) {
        const left = Number(row.quantity_available);
        fewLeft.set(row.id, left > 0 && left <= SAY_REMAINING_AT ? left : null);
      }

      // The holder's own seats are added back for the class they hold, so a guest
      // holding 3 of the last 4 is not told "Only 1 left". Everyone else, and any
      // request without a holdId, gets the public figures above untouched.
      const holdId = holdIdFrom(body.holdId);
      let myHold: LiveHold | null = null;
      let holdKnown = false;
      let mine: HolderView | null = null;
      if (holdId) {
        try {
          myHold = await readHold(holdId, eventKey);
          holdKnown = true;
          if (myHold) {
            const { data: view, error: viewError } = await supabase.rpc("class_view_for_holder", {
              p_event_ticket_class_id: myHold.event_ticket_class_id,
              p_extra: myHold.quantity,
            });
            if (viewError) throw viewError;
            mine = (view as HolderView[] | null)?.[0] ?? null;
            if (!mine) myHold = null;
          }
        } catch (err) {
          // Could not read it: answer with the public figures, say nothing about
          // the hold, and let the widget keep whatever it already had.
          console.error("hold could not be read", { eventKey, message: String(err) });
          myHold = null; mine = null; holdKnown = false;
        }
      }

      // The tagline, photos and selling lines are the class's own, not the
      // night's, so they come off ticket_classes rather than the per-night row.
      const { data: taglines, error: taglineError } = await supabase
        .from("ticket_classes")
        .select("code,tagline,photos,benefits");
      if (taglineError) throw taglineError;
      const taglineFor = new Map<string, string | null>();
      const photosFor = new Map<string, { url: string; alt: string }[]>();
      const benefitsFor = new Map<string, { text: string; note: string | null }[]>();
      for (const t of taglines ?? []) {
        taglineFor.set(t.code, t.tagline ?? null);
        photosFor.set(t.code, cleanPhotos(t.photos));
        benefitsFor.set(t.code, cleanBenefits(t.benefits));
      }

      const offers = await offersForNight(eventKey, rows, byClass);

      // Counted off the same rows the guest is about to be shown, so the note
      // and the answer can never disagree.
      const shown = rows.filter((r) => r.status !== "hidden");
      const countOf = (want: string) => shown.filter((r) => r.status === want).length;
      const statuses: Record<string, string> = {};
      for (const r of shown) statuses[String(r.ticket_class_code)] = String(r.status);
      const buyable = countOf("available") + countOf("limited");

      recordLook({
        action: "availability",
        page_path: pagePath,
        event_key: header.event_key,
        event_date: header.local_date,
        classes_offered: shown.length,
        available: countOf("available"),
        limited: countOf("limited"),
        sold_out: countOf("fully_booked"),
        booking_closed: countOf("booking_closed"),
        // Nothing on the night could be bought. The column this table exists for.
        dead_end: shown.length > 0 && buyable === 0,
        statuses,
      });

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
            // Where to send a guest we are not selling this night to. The widget
            // decides whether to show it, and only ever does when nothing on the
            // night is buyable.
            divertUrl: header.divert_url ?? null,
            divertNote: header.divert_note ?? null,
          },
          // Every class is returned, sold out and closed included, each with its
          // own status. Hiding them is what sends a guest to a competitor.
          classes: rows
            .filter((r) => r.status !== "hidden")
            .map((r0) => {
              // The class the guest holds is described with their seats added back.
              const isMine = !!mine && r0.event_ticket_class_id === myHold!.event_ticket_class_id;
              const r = isMine ? { ...r0, status: mine!.status, max_per_order: mine!.max_per_order } : r0;
              const fewMine = isMine && mine!.quantity_available > 0 && mine!.quantity_available <= SAY_REMAINING_AT
                ? mine!.quantity_available : null;
              return {
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
              tagline: taglineFor.get(r.ticket_class_code) ?? null,
              // Empty lists for a class that has none: the widget then draws the
              // compact tile exactly as before.
              photos: photosFor.get(r.ticket_class_code) ?? [],
              benefits: benefitsFor.get(r.ticket_class_code) ?? [],
              // Null unless it is genuinely down to the last few. See above.
              seatsLeft: (r.status === "available" || r.status === "limited")
                ? (isMine ? fewMine : (fewLeft.get(r.event_ticket_class_id) ?? null))
                : null,
              prices: byClass.get(r.event_ticket_class_id) ?? [],
              // Only on a fully booked class that has an offer, and only for a
              // night that has been switched on. See offersForNight.
              ...(offers.has(String(r.ticket_class_code)) ? { offer: offers.get(String(r.ticket_class_code)) } : {}),
              };
            }),
          // Present only when the widget sent a holdId and the answer is known:
          // the hold if it is live on THIS night, null if it is gone. Absent
          // otherwise, so an older widget sees exactly the response it always did.
          ...(holdKnown ? { hold: myHold ? holdForWidget(myHold) : null } : {}),
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
