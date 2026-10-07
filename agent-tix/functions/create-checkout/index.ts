// Agent Tix — create checkout
//
// Holds the stock, then hands the guest to Stripe.
//
// No pre-made Stripe product. The line item is built here from the price in
// the database, with the name and description supplied at the same moment. A
// new fight night therefore needs nothing doing in Stripe, ever.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@^22";

const TENANT = "muaytix";
// We sell tickets, we do not keep them. A guest deciding at ten past five on a
// six o'clock show does not need half an hour, and every minute their basket
// sits there is a minute those seats are invisible to everybody else. On a
// night with four seats left and paid advertising running, one abandoned
// checkout takes the whole event off sale.
//
// So the hold is five minutes. Anyone genuinely paying is done well inside it.
//
// Stripe will not issue a payment page that dies sooner than 30 minutes (and
// its clock is a network hop later than ours, so exactly 30 is a coin toss --
// 31 clears it). The page therefore outlives our hold, and a guest can abandon
// checkout and still pay twenty minutes later. complete_reservation handles
// that: it takes the seats then if any are spare, and records the booking as
// needing a refund if they are not. See schema/0015.
const HOLD_MINUTES = 5;
const SESSION_MINUTES = 31;

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
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

if (!stripeSecretKey || !supabaseUrl || !serviceKey) {
  throw new Error("Stripe or Supabase settings are missing");
}

const stripe = new Stripe(stripeSecretKey);
const supabase = createClient(supabaseUrl, serviceKey as string, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let allowedOrigins: Set<string> | null = null;
let originsFetchedAt = 0;

async function originsForTenant(): Promise<Set<string>> {
  if (allowedOrigins && Date.now() - originsFetchedAt < 60_000) return allowedOrigins;
  const { data } = await supabase
    .from("tenants").select("allowed_origins").eq("slug", TENANT).single();
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

// Only ever send a guest back to our own site.
function safeReturnUrl(value: unknown, fallback: string, origins: Set<string>) {
  if (typeof value !== "string") return fallback;
  try {
    const url = new URL(value);
    return origins.has(url.origin) ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

// Which advert click won this booking, as the widget saw it.
//
// Everything here arrives from a browser and so is treated as hostile: each
// field is capped, anything that is not a string is dropped, and a click_id_kind
// the database will not accept is discarded rather than allowed to fail the
// insert. Attribution is bookkeeping -- it must never cost us a sale, so a bad
// payload becomes no attribution and the booking carries on.
const CLICK_KINDS = new Set(["gclid", "gbraid", "wbraid"]);

type Attribution = Record<string, string | null>;

function attributionFrom(value: unknown): Attribution {
  const empty: Attribution = {
    click_id: null, click_id_kind: null,
    utm_source: null, utm_medium: null, utm_campaign: null,
    utm_term: null, utm_content: null,
    ad_group_id: null, match_type: null, device: null, clicked_at: null,
  };
  if (!value || typeof value !== "object") return empty;
  const a = value as Record<string, unknown>;

  const text = (v: unknown, max: number) =>
    typeof v === "string" && v.trim() !== ""
      // Control characters would survive a round trip through JSON and land in
      // a report nobody can read.
      ? v.trim().replace(/[\u0000-\u001F\u007F]/g, "").slice(0, max) || null
      : null;

  const kind = text(a.clickIdKind, 16);
  const id = text(a.clickId, 512);
  const clickedAt = text(a.at, 40);
  const when = clickedAt && !Number.isNaN(Date.parse(clickedAt)) ? clickedAt : null;

  return {
    // A click id without a usable kind is not stored: the kind is what stops it
    // being guessed at from the shape of the string later on.
    click_id: kind && CLICK_KINDS.has(kind) ? id : null,
    click_id_kind: kind && CLICK_KINDS.has(kind) && id ? kind : null,
    utm_source: text(a.source, 255),
    utm_medium: text(a.medium, 255),
    utm_campaign: text(a.campaign, 255),
    utm_term: text(a.term, 255),
    utm_content: text(a.content, 255),
    ad_group_id: text(a.adGroupId, 255),
    match_type: text(a.matchType, 32),
    device: text(a.device, 32),
    clicked_at: when,
  };
}

// Which page the booking was made from, and which page the visit began on.
//
// Same posture as the attribution above: it arrives from a browser, so it is
// capped and cleaned, and a bad value becomes null rather than failing a sale.
//
// A query string is stripped even though the widget already strips it. The
// widget on the live site is a block of pasted header code, so an older copy can
// still be cached in someone's browser for days after a change -- and a shared
// link's query string is exactly where a stray email address turns up.
function pagePathFrom(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .trim()
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .split(/[?#]/)[0]
    .slice(0, 255);
  // A path, not a full URL: anything with a scheme or host is not ours to store.
  if (!cleaned.startsWith("/") || cleaned.startsWith("//")) return null;
  return cleaned || null;
}

// Club Class for a guest whose LEO choice is fully booked (schema/0040).
//
// The widget only ASKS for this. Nothing here trusts it: whether the offer
// exists, whether this night is switched on, whether LEO really is fully booked
// right now, and the price itself all come from the database. A guest cannot
// obtain the price on a night where LEO is still on sale, or on RWS, or at a
// price they typed.
//
// The cap is checked again in code even though the database refuses to store
// an offer more than 10 per cent under the standing price: this night's price
// may be an override, and the cap is against what is actually being charged.
//
// Any doubt means no offer. Failing safe here costs a discount that was never
// given; failing the other way costs margin on a ticket we hold.
type TakenOffer = { code: string; unitAmount: number; discountMinor: number };

async function resolveOffer(
  eventKey: string, fromCode: string, toRow: Record<string, unknown>,
  currency: string, nightUnitAmount: number,
): Promise<TakenOffer | null> {
  try {
    const { data: ev } = await supabase
      .from("events").select("fallback_offer_enabled").eq("event_key", eventKey).maybeSingle();
    if (!ev?.fallback_offer_enabled) return null;

    const { data: classes } = await supabase.from("ticket_classes").select("id,code");
    const idOf = new Map((classes ?? []).map((c) => [c.code as string, c.id as string]));
    const fromId = idOf.get(fromCode);
    const toId = idOf.get(String(toRow.ticket_class_code));
    if (!fromId || !toId) return null;

    const { data: offer } = await supabase
      .from("class_fallback_offers").select("id,code")
      .eq("from_class_id", fromId).eq("to_class_id", toId).eq("active", true).maybeSingle();
    if (!offer) return null;

    // LEO has to be fully booked at this moment, not merely when the page loaded.
    const { data: fromRows } = await supabase
      .from("event_ticket_availability").select("status")
      .eq("event_key", eventKey).eq("ticket_class_code", fromCode).limit(1);
    if (fromRows?.[0]?.status !== "fully_booked") return null;

    const { data: prices } = await supabase
      .from("class_fallback_offer_prices").select("currency,unit_amount")
      .eq("offer_id", offer.id).in("currency", [currency, "thb"]);
    const offerIn = (c: string) => prices?.find((p) => p.currency === c)?.unit_amount as number | undefined;
    const unitAmount = offerIn(currency);
    const offerThb = offerIn("thb");
    if (!unitAmount || !offerThb) return null;

    // Never above the price it replaces, never more than 10 per cent under it.
    if (unitAmount > nightUnitAmount || unitAmount * 10 < nightUnitAmount * 9) return null;

    // What the discount is worth to us, in baht, so the reports can take it off
    // the margin. Measured on baht prices whatever currency the guest pays in.
    const { data: thbRow } = await supabase
      .from("event_ticket_prices").select("unit_amount")
      .eq("event_ticket_class_id", toRow.event_ticket_class_id as string)
      .eq("currency", "thb").maybeSingle();
    const discountMinor = thbRow ? Number(thbRow.unit_amount) - offerThb : NaN;
    if (!Number.isFinite(discountMinor) || discountMinor < 0) return null;

    return { code: String(offer.code), unitAmount, discountMinor };
  } catch (err) {
    console.error("offer could not be checked", { eventKey, fromCode, message: String(err) });
    return null;
  }
}

function longDate(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone, weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(new Date(iso));
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
  try { body = await req.json(); }
  catch { return json({ error: "Could not read the request." }, 400, origin); }

  // A cold Edge Function takes several seconds to boot, and the guest pays that
  // wait at the worst possible moment — the click that hands them to Stripe.
  // The widget pings this the moment a seat class is chosen, which boots the
  // isolate while they are still picking a quantity. It must do nothing else:
  // this must never reserve, charge, or touch a row.
  if (body.action === "warm") return json({ warm: true }, 200, origin);

  const eventKey = String(body.eventKey ?? "").trim();
  const classCode = String(body.classCode ?? "").trim();
  const quantity = Number(body.quantity);
  const currency = String(body.currency ?? "").trim().toLowerCase();
  const seatingAcknowledged = body.seatingAcknowledged === true;
  const offerFrom = String(body.offerFrom ?? "").trim().slice(0, 64);
  const attribution = attributionFrom(body.attribution);
  const pagePath = pagePathFrom(body.pagePath);
  const landingPage = pagePathFrom(body.landingPage);

  if (!eventKey || !classCode) return json({ error: "Ticket details are missing." }, 400, origin);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    return json({ error: "Quantity must be between 1 and 10." }, 400, origin);
  }
  if (!/^[a-z]{3}$/.test(currency)) return json({ error: "That currency is not valid." }, 400, origin);

  let reservationId: string | null = null;

  try {
    // The status is re-checked here, server side. What the widget last saw may
    // be a minute old, and a minute is long enough to sell the last seat.
    const { data: rows, error } = await supabase
      .from("event_ticket_availability")
      .select("*")
      .eq("event_key", eventKey)
      .eq("ticket_class_code", classCode)
      .limit(1);
    if (error) throw error;

    const row = rows?.[0];
    if (!row) return json({ error: "That ticket class could not be found." }, 404, origin);

    if (row.status === "closed") {
      return json({ error: row.closed_explanation ?? "This class is not on sale yet." }, 409, origin);
    }
    if (row.status === "booking_closed") {
      return json({ error: "Bookings have closed for this fight night." }, 409, origin);
    }
    if (row.status !== "available" && row.status !== "limited") {
      return json({ error: "This class is fully booked." }, 409, origin);
    }

    // The seating warning has to be enforced here too, not just shown in the
    // widget, or it can simply be skipped.
    // Null means we were never told, so there is nothing to warn about. A real
    // number, zero included, is a promise: zero means nobody in the group sits
    // together. One seat is not a group, so a single ticket never trips this.
    const together = row.maximum_seats_together == null
      ? null
      : Number(row.maximum_seats_together);
    const needsAck = row.assigned_seating === true && together !== null &&
      quantity > Math.max(together, 1);
    if (needsAck && !seatingAcknowledged) {
      return json({
        error: together === 0
          ? "We cannot seat your group together on this night. Please confirm before continuing."
          : `We can seat ${together} of your group together. Please confirm before continuing.`,
        code: "seating_ack_required",
        maximumSeatsTogether: together,
      }, 409, origin);
    }

    // Price comes from the database — the standing rate, or an override if this
    // particular night is priced differently.
    const { data: price, error: priceError } = await supabase
      .from("event_ticket_prices")
      .select("unit_amount,is_override")
      .eq("event_ticket_class_id", row.event_ticket_class_id)
      .eq("currency", currency)
      .maybeSingle();
    if (priceError) throw priceError;
    if (!price) return json({ error: "That currency is not available for this ticket." }, 400, origin);

    // What is actually charged. The standing price, unless the guest asked for
    // the Club Class offer and the database agrees they are entitled to it.
    let unitAmount: number = price.unit_amount;
    let offer: TakenOffer | null = null;
    if (offerFrom) {
      offer = await resolveOffer(eventKey, offerFrom, row, currency, price.unit_amount);
      if (!offer) {
        return json({
          error: "That offer is no longer available. Please choose your seats again.",
          code: "offer_unavailable",
        }, 409, origin);
      }
      unitAmount = offer.unitAmount;
    }

    // Hold the stock before going anywhere near Stripe.
    const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60_000);
    const { data: reservation, error: reserveError } = await supabase.rpc("reserve_tickets", {
      p_event_ticket_class_id: row.event_ticket_class_id,
      p_quantity: quantity,
      p_expires_at: expiresAt.toISOString(),
    });
    if (reserveError || !reservation?.[0]) {
      return json({ error: reserveError?.message ?? "Those tickets have just gone." }, 409, origin);
    }
    reservationId = reservation[0].reservation_id;

    const when = longDate(row.starts_at, row.venue_timezone);
    const successUrl = safeReturnUrl(
      body.successUrl, "https://muaytix.com/payment-successful?session_id={CHECKOUT_SESSION_ID}", origins);
    const cancelUrl = safeReturnUrl(body.cancelUrl, "https://muaytix.com/payment-failed", origins);

    // The key is deliberately NOT `reservation_id`. Another system on this same
    // Stripe account decides a session is its own purely by the presence of
    // `reservation_id` in metadata, and would then look up one of our
    // reservations in its own database, fail, return 500 and be retried by
    // Stripe for hours. Naming it differently means it ignores our sessions
    // outright, which is what "two separate systems" has to mean.
    const metadata: Record<string, string> = {
      source: "agent_tix_v2",
      v2_reservation_id: String(reservationId),
      event_key: row.event_key,
      event_name: row.event_name,
      ticket_class: row.ticket_class_name,
      quantity: String(quantity),
      currency,
      unit_amount: String(unitAmount),
      price_is_override: String(price.is_override === true),
      seating_acknowledged: String(seatingAcknowledged),
    };
    if (offer) metadata.offer = offer.code;

    // The click id goes to Stripe too, so a booking can be traced back to its
    // advert from the payment record alone -- without opening our database, and
    // without Stripe ever seeing the campaign detail, which is ours.
    if (attribution.click_id && attribution.click_id_kind) {
      metadata.click_id = attribution.click_id;
      metadata.click_id_kind = attribution.click_id_kind;
    }

    // DO NOT set payment_method_types here. Leaving it out is what lets the
    // account's payment method configuration decide, and that configuration is
    // the product of a deliberate commercial decision: Alipay and WeChat Pay
    // were added for Chinese visitors with marketing behind them, and that
    // market is up 400%. Setting this field overrides the configuration
    // wholesale and silently switches those methods off.
    //
    // Stripe already filters the configuration by currency and country, which
    // is why a THB session offers card and Link while a EUR session offers
    // bancontact, iDEAL, Bizum, Satispay and the rest. A short list on one
    // session is Stripe matching the currency, not a restriction to copy.
    const params = {
      mode: "payment",
      // Without this Stripe returns an email and no name, and the person
      // sending the ticket by hand has nobody to address it to.
      name_collection: { individual: { enabled: true, optional: false } },
      line_items: [{
        quantity,
        price_data: {
          currency,
          unit_amount: unitAmount,
          // Built here rather than pointing at a stored product, so the payment
          // page names the night and no Stripe object needs creating per date.
          product_data: {
            name: `${row.ticket_class_name} — ${row.event_name}`,
            description: `${when}, ${row.venue_name}`,
          },
        },
      }],
      customer_creation: "always",
      phone_number_collection: { enabled: true },
      success_url: successUrl,
      cancel_url: cancelUrl,
      expires_at: Math.floor((Date.now() + SESSION_MINUTES * 60_000) / 1000),
      adaptive_pricing: { enabled: false },
      metadata,
      payment_intent_data: { metadata },
    } as Stripe.Checkout.SessionCreateParams;

    // name_collection is a newer parameter than the rest of this call. If the
    // pinned API version does not know it, Stripe rejects the whole request —
    // which would take the checkout down rather than merely lose a name. So an
    // unknown-parameter error retries once without it. Every other error is
    // left to the catch below, where the hold is released.
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create(params);
    } catch (err) {
      const unknownParam = (err as { code?: string; param?: string }).code === "parameter_unknown"
        && String((err as { param?: string }).param ?? "").startsWith("name_collection");
      if (!unknownParam) throw err;
      console.warn("name_collection not supported on this API version; continuing without it");
      delete (params as unknown as Record<string, unknown>).name_collection;
      session = await stripe.checkout.sessions.create(params);
    }

    if (!session.url) throw new Error("Stripe returned no checkout URL");

    // Written with the session id rather than at reservation time, so one write
    // carries both and a failure between the two cannot leave a row half filled.
    const { error: attrError } = await supabase
      .from("checkout_reservations")
      .update({
        stripe_checkout_session_id: session.id,
        currency,
        unit_amount: unitAmount,
        ...attribution,
        page_path: pagePath,
        landing_page: landingPage,
        // Last, and only named when an offer was taken, so an ordinary booking
        // never touches the new columns at all.
        ...(offer ? { offer_code: offer.code, offer_discount_minor: offer.discountMinor } : {}),
      })
      .eq("id", reservationId);

    // The guest is already on their way to Stripe. Losing the attribution is a
    // reporting problem; refusing the booking over it would be a real one.
    if (attrError) {
      console.error("attribution not stored", {
        reservationId, message: attrError.message,
      });
    }

    return json({
      checkoutUrl: session.url,
      sessionId: session.id,
      reservationId,
      currency,
      unitAmount,
      total: unitAmount * quantity,
    }, 200, origin);

  } catch (err) {
    // If anything failed after the hold, give the seats straight back rather
    // than leaving them stuck until the sweeper runs.
    if (reservationId) {
      await supabase.rpc("release_reservation", {
        p_reservation_id: reservationId,
        p_new_status: "failed",
      });
    }
    console.error("create-checkout failed", { eventKey, classCode, message: String(err) });
    return json({ error: "The secure checkout could not be started. Please try again." }, 500, origin);
  }
});
