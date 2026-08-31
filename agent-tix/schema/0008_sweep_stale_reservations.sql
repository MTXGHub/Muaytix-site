-- Agent Tix — the safety net under the holds
--
-- APPLIED to agent-tix-build on 31 August 2026.
--
-- Seats normally come back on their own: Stripe fires checkout.session.expired
-- for an abandoned checkout and the webhook releases them. The first live test
-- showed what happens when that does not arrive — three reservations sat held
-- indefinitely, holding stock that was never going to be paid for, because the
-- webhook endpoint did not yet exist when those sessions expired.
--
-- A missed webhook must never be able to lock stock permanently. This runs
-- every five minutes and releases anything whose hold has run out, whatever the
-- reason. It is idempotent, and it can only ever free stock, never sell it.

-- pg_cron ships with Supabase but not with a stock Postgres install, so a
-- replay of these files against a plain database will stop here. That is the
-- environment, not the schema: skip this one file and 0009 applies on top of
-- 0007 exactly as it does on Supabase.
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'agent-tix-expire-stale-reservations',
  '*/5 * * * *',
  $$select public.expire_stale_reservations()$$
);
