-- Remember that a sale has been reported to Rybbit analytics.
--
-- The Stripe webhook sends one "purchase" event to Rybbit per paid Checkout
-- Session. Stripe retries webhooks, and one sale can arrive twice
-- (checkout.session.completed, then async_payment_succeeded), so the webhook
-- takes a claim on the reservation before it sends:
--
--   update checkout_reservations set rybbit_purchase_sent_at = now()
--    where id = ... and rybbit_purchase_sent_at is null
--
-- Only the caller that changes a row sends. If Rybbit then refuses, the webhook
-- sets the column back to null so a replay from the Stripe dashboard can try
-- once more. It is a bookkeeping column: nothing reads it for reports and
-- nothing about a booking depends on it.
--
-- Additive and nullable, so it is safe to apply before or after the webhook is
-- deployed. Until it exists the webhook sends no analytics event and fulfils
-- bookings exactly as before.

alter table public.checkout_reservations
  add column if not exists rybbit_purchase_sent_at timestamptz;

comment on column public.checkout_reservations.rybbit_purchase_sent_at is
  'When the Rybbit purchase event for this booking was claimed. Null: not sent.';
