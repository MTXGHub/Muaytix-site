// Agent Tix — Stripe webhook
//
// Turns a Stripe payment into a sale, and an abandoned checkout back into
// available stock. It does nothing else: no email, no ticket allocation, no
// notifications. Ticket fulfilment stays manual until instructed otherwise.
//
// Two rules matter more than the rest.
//
// 1. It only ever touches sessions this system created. V1 and V2 share one
//    Stripe account, so both endpoints receive every event for the account.
//    A session is ours only if metadata says `source = agent_tix_v2` AND
//    carries `v2_reservation_id`. Everything else is acknowledged and dropped.
//
// 2. Completion is idempotent, in the database rather than here. Stripe retries
//    a webhook that does not answer quickly, and retrying a sale is exactly how
//    a guest ends up charged once and holding two seats' worth of stock. The
//    `complete_reservation` function refuses a second completion outright.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@^22";

const OUR_SOURCE = "agent_tix_v2";

const HANDLED = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
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

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const supabase = (supabaseUrl && serviceKey)
  ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

// Deno has no synchronous crypto, so Stripe's async verifier is required.
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function reply(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

// Where the card was issued, and what the sale settled for.
//
// Nationality is worked out by hand today from the card ISSUER country, which is
// the closest proxy available -- the other country figure we hold comes from
// GA4, which reads the visitor's IP and so reports where somebody was sitting,
// not who they are. Stripe knows the issuer on every card payment.
//
// The settlement figures come from the same object and solve a separate problem:
// bookings arrive in six currencies, so no report has been able to total them
// without inventing an exchange rate. Stripe has already converted at the real
// rate; this records the answer.
//
// It reaches Stripe again, AFTER the sale is recorded, which is the whole reason
// it is written defensively: the guest has paid. Any failure here returns nulls
// and is logged. It must never throw.
type PaymentFacts = {
  card_country: string | null;
  payment_method_type: string | null;
  settled_amount: number | null;
  settled_currency: string | null;
  stripe_fee: number | null;
};

const NO_FACTS: PaymentFacts = {
  card_country: null, payment_method_type: null,
  settled_amount: null, settled_currency: null, stripe_fee: null,
};

async function paymentFacts(
  client: Stripe, paymentIntentId: string | null,
): Promise<PaymentFacts> {
  if (!paymentIntentId) return NO_FACTS;
  try {
    // Both come off the charge, so one expanded read gets everything. The
    // balance transaction is a separate object and has to be asked for by name.
    const intent = await client.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge", "latest_charge.balance_transaction"],
    });
    const charge = intent.latest_charge as Stripe.Charge | null;
    if (!charge || typeof charge === "string") return NO_FACTS;

    const details = charge.payment_method_details;
    // Only a card carries an issuer country. Alipay and WeChat Pay carry none at
    // all, which is why the method type is stored beside it -- otherwise a null
    // country cannot be told from a method that never had one. Apple Pay and
    // Google Pay arrive as type "card" and do carry a country.
    const card = details?.card ?? null;
    const raw = typeof card?.country === "string" ? card.country.trim().toUpperCase() : "";
    // The column refuses anything but two letters, and a malformed value would
    // split one country into two rows in every report.
    const country = /^[A-Z]{2}$/.test(raw) ? raw : null;

    const txn = charge.balance_transaction as Stripe.BalanceTransaction | null;
    const settled = txn && typeof txn !== "string" ? txn : null;

    return {
      card_country: country,
      payment_method_type: details?.type ?? null,
      settled_amount: settled ? settled.amount : null,
      settled_currency: settled ? settled.currency : null,
      stripe_fee: settled ? settled.fee : null,
    };
  } catch (err) {
    // A reporting column is never worth a retry of a webhook that has already
    // banked the sale.
    console.error("could not read payment facts", { paymentIntentId, message: message(err) });
    return NO_FACTS;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
  }

  const signature = req.headers.get("Stripe-Signature");
  if (!signature) return reply({ error: "Missing Stripe signature." }, 400);
  if (!stripe || !supabase || !webhookSecret) {
    console.error("stripe-webhook-v2 is not fully configured");
    return reply({ error: "Webhook configuration is incomplete." }, 503);
  }

  // The signature is checked against the exact bytes Stripe sent, so the body
  // must be read raw. Parsing it first would invalidate the check.
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      raw, signature, webhookSecret, undefined, cryptoProvider,
    );
  } catch (err) {
    console.warn("signature verification failed", { message: message(err) });
    return reply({ error: "Invalid Stripe signature." }, 400);
  }

  if (!HANDLED.has(event.type)) {
    return reply({ received: true, eventId: event.id, action: "ignored_event_type" });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.object !== "checkout.session") {
    return reply({ received: true, eventId: event.id, action: "ignored_object" });
  }

  // Not ours. Almost certainly a V1 booking on the shared Stripe account.
  const meta = session.metadata ?? {};
  const reservationId = String(meta.v2_reservation_id ?? "").trim();
  if (meta.source !== OUR_SOURCE || !reservationId) {
    return reply({ received: true, eventId: event.id, action: "ignored_other_system" });
  }
  if (!UUID.test(reservationId)) {
    // Ours by source but malformed: log it rather than let Stripe retry forever.
    console.error("agent_tix_v2 session with an unusable reservation id", {
      eventId: event.id, sessionId: session.id,
    });
    return reply({ received: true, eventId: event.id, action: "ignored_bad_reservation_id" });
  }

  try {
    const paid = event.type === "checkout.session.completed"
      || event.type === "checkout.session.async_payment_succeeded";

    if (paid) {
      // A completed session is not necessarily a paid one. Bank transfers and
      // similar arrive unpaid and settle later, so this waits for the
      // async_payment_succeeded event rather than releasing the ticket early.
      if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
        return reply({ received: true, eventId: event.id, action: "awaiting_payment" });
      }

      const paymentIntentId = typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;

      const { data, error } = await supabase.rpc("complete_reservation", {
        p_reservation_id: reservationId,
        p_stripe_checkout_session_id: session.id,
        p_stripe_payment_intent_id: paymentIntentId,
      });
      if (error) throw error;

      // Recorded separately from the sale itself. Whoever sends the ticket by
      // hand needs a name and an address against the booking, and a failure to
      // save them must never undo a payment that has already gone through.
      // Trimmed: what a guest types into Stripe arrives verbatim, and the live
      // test produced "Jason Mclellan " with a trailing space. Left as-is it
      // ends up on a ticket.
      const tidy = (v: string | null | undefined) => {
        const t = (v ?? "").trim();
        return t.length > 0 ? t : null;
      };
      const guestEmail = tidy(session.customer_details?.email ?? session.customer_email);
      const guestName = tidy(session.customer_details?.name);
      // Only ever write what we actually have. Stripe can send this event twice
      // — completed, then async_payment_succeeded — and the second copy does not
      // always carry the same detail. Writing a null over a name we already
      // stored would lose it.
      const guestPatch: Record<string, string | number> = {};
      if (guestEmail) guestPatch.guest_email = guestEmail;
      if (guestName) guestPatch.guest_name = guestName;

      // Where the card was issued and what the sale settled for. Carried on the
      // same write as the guest details because it obeys the same two rules: a
      // failure must not undo a payment, and a second copy of the event must not
      // write a null over something already stored.
      const facts = await paymentFacts(stripe, paymentIntentId);
      if (facts.card_country) guestPatch.card_country = facts.card_country;
      if (facts.payment_method_type) guestPatch.payment_method_type = facts.payment_method_type;
      if (facts.settled_currency) guestPatch.settled_currency = facts.settled_currency;
      // Zero is a real settled amount on a fully discounted booking, so these are
      // checked for null rather than for truthiness.
      if (facts.settled_amount !== null) guestPatch.settled_amount = facts.settled_amount;
      if (facts.stripe_fee !== null) guestPatch.stripe_fee = facts.stripe_fee;

      if (Object.keys(guestPatch).length > 0) {
        const { error: guestError } = await supabase
          .from("checkout_reservations")
          .update(guestPatch)
          .eq("id", reservationId);
        if (guestError) {
          console.error("could not save guest details", {
            eventId: event.id, reservationId, message: guestError.message,
          });
        }
      }

      console.info("agent tix booking completed", {
        eventId: event.id, sessionId: session.id, reservationId, result: data,
      });
      return reply({ received: true, eventId: event.id, action: String(data ?? "completed") });
    }

    // Abandoned or failed. Put the seats back.
    const newStatus = event.type === "checkout.session.expired" ? "expired" : "failed";
    const { data, error } = await supabase.rpc("release_reservation", {
      p_reservation_id: reservationId,
      p_new_status: newStatus,
    });
    if (error) throw error;

    console.info("agent tix reservation released", {
      eventId: event.id, reservationId, result: data,
    });
    return reply({ received: true, eventId: event.id, action: String(data ?? newStatus) });

  } catch (err) {
    // A 500 tells Stripe to retry, which is what we want: the completion is
    // idempotent, so a retry can only ever finish the job, never repeat it.
    console.error("stripe-webhook-v2 failed", {
      eventId: event.id, eventType: event.type, sessionId: session.id,
      reservationId, message: message(err),
    });
    return reply({ error: "Booking update failed." }, 500);
  }
});
