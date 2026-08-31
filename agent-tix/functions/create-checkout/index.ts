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
// Stripe refuses a Checkout Session that expires less than 30 minutes out, and
// its clock is a network hop later than ours, so exactly 30 is a coin toss.
// 31 clears it. Our own hold outlives the session either way, so a guest who
// pays at the very last second still has stock waiting for them.
const HOLD_MINUTES = 36;
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
    const together = Number(row.maximum_seats_together ?? 0);
    const needsAck = row.assigned_seating === true && together > 0 && quantity > together;
    if (needsAck && !seatingAcknowledged) {
      return json({
        error: `We can seat ${together} of your group together. Please confirm before continuing.`,
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

    // The key is deliberately NOT `reservation_id`. V1 and V2 share one Stripe
    // account, so both webhook endpoints see every event. V1 decides a session
    // is its own purely by the presence of `reservation_id` in metadata, and
    // would then look up a V2 reservation in the V1 database, fail, return 500
    // and be retried by Stripe for hours. Naming it differently means V1 ignores
    // V2 sessions outright, which is what "two separate systems" has to mean.
    const metadata: Record<string, string> = {
      source: "agent_tix_v2",
      v2_reservation_id: String(reservationId),
      event_key: row.event_key,
      event_name: row.event_name,
      ticket_class: row.ticket_class_name,
      quantity: String(quantity),
      currency,
      unit_amount: String(price.unit_amount),
      price_is_override: String(price.is_override === true),
      seating_acknowledged: String(seatingAcknowledged),
    };

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
          unit_amount: price.unit_amount,
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

    await supabase
      .from("checkout_reservations")
      .update({
        stripe_checkout_session_id: session.id,
        currency,
        unit_amount: price.unit_amount,
      })
      .eq("id", reservationId);

    return json({
      checkoutUrl: session.url,
      sessionId: session.id,
      reservationId,
      currency,
      unitAmount: price.unit_amount,
      total: price.unit_amount * quantity,
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
