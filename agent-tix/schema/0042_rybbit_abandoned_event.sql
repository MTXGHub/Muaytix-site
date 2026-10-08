-- Remember that an abandoned checkout has been reported to Rybbit analytics.
--
-- Same approach as 0041 (the purchase event): the Stripe webhook takes a claim
-- on the reservation before it sends, so a repeated checkout.session.expired
-- sends nothing the second time.
--
--   update checkout_reservations set rybbit_abandoned_sent_at = now()
--    where id = ... and rybbit_abandoned_sent_at is null
--
-- A separate column from rybbit_purchase_sent_at on purpose. One booking can be
-- abandoned (the hold lapses) and then paid late from the Stripe page that
-- outlived it (see 0015), and both are real events worth counting.
--
-- Additive and nullable with no default, so existing rows are not rewritten.
-- Until the column exists the webhook sends no abandoned event and releases
-- seats exactly as before.

alter table public.checkout_reservations
  add column if not exists rybbit_abandoned_sent_at timestamptz;

comment on column public.checkout_reservations.rybbit_abandoned_sent_at is
  'When the Rybbit abandoned_checkout event for this booking was claimed. Null: not sent.';
