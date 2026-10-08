// Agent Tix — tells Rybbit analytics that a sale happened.
//
// Called by the Stripe webhook AFTER the sale has been banked. It exists so the
// site's analytics can count purchases; it is not part of fulfilment, and
// nothing in here may ever stop, delay or undo a booking. Three rules follow:
//
//   1. It never throws. Every failure is logged with the session id and
//      swallowed, so the webhook still answers Stripe with 200.
//
//   2. It sends at most one event per Checkout Session. The claim is taken in
//      the database BEFORE the call, so two copies of the same event (Stripe
//      retries, or completed followed by async_payment_succeeded) race for one
//      claim and only the winner sends. If Rybbit then fails, the claim is
//      handed back so a deliberate replay from the Stripe dashboard can try
//      again. Nothing here retries on its own.
//
//   3. It sends no personal data. No name, email, phone, address or card
//      detail is read, let alone sent: the only inputs are the session id, the
//      amount, the currency and the ticket, night and date.
//
// This file imports nothing so the tests can run it directly.

export const RYBBIT_TRACK_URL = "https://app.rybbit.io/api/track";
export const PURCHASE_HOSTNAME = "muaytix.com";
export const PURCHASE_PATHNAME = "/stripe-webhook-purchase";

// Stripe's own decimal rules (docs.stripe.com/currencies), not a guess from the
// currency code. Everything not listed here has two decimals, which covers the
// six currencies the booking widget offers. ISK and UGX are listed by Stripe
// as zero-decimal but are sent through the API as two-decimal, so they are
// deliberately absent from the zero list.
const ZERO_DECIMAL = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga",
  "pyg", "rwf", "vnd", "vuv", "xaf", "xof", "xpf",
]);
const THREE_DECIMAL = new Set(["bhd", "jod", "kwd", "omr", "tnd"]);

export function decimalPlaces(currency: string): number {
  const c = String(currency ?? "").trim().toLowerCase();
  if (ZERO_DECIMAL.has(c)) return 0;
  if (THREE_DECIMAL.has(c)) return 3;
  return 2;
}

// The amount in the currency's major unit: 250000 thb satang is 2500.
export function majorUnits(amountMinor: number, currency: string): number {
  const places = decimalPlaces(currency);
  return Number((amountMinor / 10 ** places).toFixed(places));
}

export type PurchaseFacts = {
  sessionId: string;
  amountMinor: number;
  currency: string;
  ticketClass?: string | null;
  eventName?: string | null;
  eventDate?: string | null;
};

// Rybbit wants `properties` as a JSON-encoded STRING, holding only strings and
// numbers. A key with nothing to say is left out rather than sent empty.
export function purchaseProperties(f: PurchaseFacts): string {
  const props: Record<string, string | number> = {
    amount: majorUnits(f.amountMinor, f.currency),
    currency: String(f.currency).trim().toUpperCase(),
    stripe_session_id: f.sessionId,
  };
  const add = (key: string, value: string | null | undefined) => {
    const v = String(value ?? "").trim();
    if (v) props[key] = v;
  };
  add("ticket_class", f.ticketClass);
  add("event_name", f.eventName);
  add("event_date", f.eventDate);
  return JSON.stringify(props);
}

export function purchaseBody(f: PurchaseFacts, siteId: string) {
  return {
    site_id: siteId,
    type: "custom_event",
    event_name: "purchase",
    hostname: PURCHASE_HOSTNAME,
    pathname: PURCHASE_PATHNAME,
    properties: purchaseProperties(f),
  };
}

export type SendResult =
  | { ok: true; siteIdUsed: string; status: number }
  | { ok: false; status: number | null; reason: string };

type FetchFn = (url: string, init: Record<string, unknown>) => Promise<{
  ok: boolean; status: number; text(): Promise<string>;
}>;

const SITE_REJECTED = new Set([400, 404, 422]);

// One POST, and a second ONLY if Rybbit refused the first as a bad request
// (400, 404 or 422), which means nothing was recorded. The second uses the other form of
// the site id, because Rybbit shows the site as a number and as a short string
// and the script tag on the page decides which one /api/track accepts. A
// network error or a 5xx is never retried: the outcome is unknown and a second
// send could double count.
export async function sendPurchase(opts: {
  apiKey: string;
  siteIds: string[];
  facts: PurchaseFacts;
  fetchFn: FetchFn;
  timeoutMs?: number;
}): Promise<SendResult> {
  const ids = opts.siteIds.map((s) => String(s ?? "").trim()).filter(Boolean).slice(0, 2);
  if (ids.length === 0) return { ok: false, status: null, reason: "no site id configured" };

  let last: SendResult = { ok: false, status: null, reason: "not sent" };
  for (const siteId of ids) {
    try {
      const res = await opts.fetchFn(RYBBIT_TRACK_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(purchaseBody(opts.facts, siteId)),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 4000),
      });
      if (res.ok) return { ok: true, siteIdUsed: siteId, status: res.status };

      // Only the status and the length of the reply are kept. The body of an
      // error could echo the request, and the key rides in the header.
      const text = await res.text().catch(() => "");
      last = { ok: false, status: res.status, reason: `rybbit answered ${res.status} (${text.length} bytes)` };
      // Only "that site id is not recognised" gets the other form. A bad key
      // (401, 403) or a rate limit (429) would fail the same way again.
      if (!SITE_REJECTED.has(res.status)) return last;
    } catch (err) {
      return {
        ok: false, status: null,
        reason: err instanceof Error ? err.name : "network error",
      };
    }
  }
  return last;
}

// What the webhook hands in. Everything that touches the database or the
// network is passed in, so this runs against fakes in the tests.
export type PurchaseDeps = {
  apiKey: string | undefined;
  siteIds: string[];
  fetchFn: FetchFn;
  claim: () => Promise<boolean>;     // true only for the one caller that wins
  release: () => Promise<void>;      // hands the claim back after a failure
  eventDate: () => Promise<string | null>;
  log: (level: "info" | "warn" | "error", msg: string, detail: Record<string, unknown>) => void;
};

// Results that mean the guest has a seat. A late payment with no stock left
// (paid_without_stock) is a refund waiting to happen, not a sale to count.
const COUNTABLE = new Set(["completed", "completed_late", "already_completed"]);

export async function reportPurchase(
  session: {
    id: string;
    payment_status: string | null;
    amount_total: number | null;
    currency: string | null;
    metadata: Record<string, string> | null;
  },
  fulfilment: string,
  deps: PurchaseDeps,
): Promise<string> {
  const sessionId = session.id;
  try {
    // Quietly off until the key is set, so deploying this before the key exists
    // changes nothing.
    if (!deps.apiKey) return "skipped_no_key";
    if (session.payment_status !== "paid") return "skipped_not_paid";
    if (!COUNTABLE.has(fulfilment)) return "skipped_not_a_sale";
    if (typeof session.amount_total !== "number" || !session.currency) {
      deps.log("warn", "rybbit purchase skipped: session has no amount", { sessionId });
      return "skipped_no_amount";
    }

    if (!(await deps.claim())) return "skipped_already_sent";

    const meta = session.metadata ?? {};
    let eventDate: string | null = null;
    try { eventDate = await deps.eventDate(); } catch { eventDate = null; }

    const result = await sendPurchase({
      apiKey: deps.apiKey,
      siteIds: deps.siteIds,
      fetchFn: deps.fetchFn,
      facts: {
        sessionId,
        amountMinor: session.amount_total,
        currency: session.currency,
        ticketClass: meta.ticket_class,
        eventName: meta.event_name,
        eventDate,
      },
    });

    if (result.ok) {
      deps.log("info", "rybbit purchase sent", { sessionId, siteIdUsed: result.siteIdUsed });
      return "sent";
    }
    deps.log("error", "rybbit purchase failed", { sessionId, status: result.status, reason: result.reason });
    try { await deps.release(); } catch { /* the claim stays; one missed event beats a loop */ }
    return "failed";
  } catch (err) {
    deps.log("error", "rybbit purchase failed", {
      sessionId, reason: err instanceof Error ? err.name : "unknown",
    });
    return "failed";
  }
}
