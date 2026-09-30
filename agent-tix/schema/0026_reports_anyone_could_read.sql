-- Eighteen views, flagged ERROR by Supabase's own security scanner as
-- SECURITY DEFINER: booking_attribution, bookings_by_nationality,
-- bookings_by_payment_method, bookings_needing_a_refund, weekly_pay,
-- checkout_funnel_by_page, checkout_funnel_by_landing_page,
-- widget_looks_by_day, widget_looks_by_page, widget_looks_by_event,
-- look_to_sale_by_day, contribution_by_day, contribution_lost_by_page,
-- abandoned_checkouts, abandoned_capture_by_day, event_calendar,
-- event_ticket_availability, event_ticket_prices. A SECURITY DEFINER view
-- runs with the permissions of whoever created it, not the permissions of
-- whoever is querying it, so it can hand back rows RLS would otherwise have
-- blocked.
--
-- Checking this one turned up a second, more urgent fault than the one
-- flagged: anon and authenticated both already held full grants (SELECT,
-- INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER) on every one of
-- these eighteen. That is not theoretical. It means anyone with the
-- project's public anon key could, right now, read real guest names,
-- emails, revenue, margins and the pay_structure/pay_bands numbers behind
-- weekly_pay -- Jason's own wage arrangement -- with no login at all.
--
-- Jason asked about one of these reports directly, 1 October 2026 (why does
-- booking_attribution show 9 completed chatgpt.com bookings, all RWS), which
-- is what surfaced this. He then asked for the security issue on the same
-- views to be fixed, having connected it, correctly, to the RLS fix earlier
-- the same day on ad_spend_daily/pay_structure/pay_bands/widget_looks
-- (0025) -- though that was a different set of objects (four tables, not
-- these eighteen views) and this is a separate fix, not a continuation of
-- it.
--
-- Checked before applying, not assumed: grepped every browser-facing file in
-- the repository (agent-tix/widget/widget.js, its Tilda build output, the
-- stale booking-widget.html prototype, every page's paste-ready HTML) for a
-- direct Supabase call to any of these eighteen names. None exists. The
-- widget calls exactly two endpoints, /functions/v1/availability and
-- /functions/v1/create-checkout, both Edge Functions authenticating with
-- SUPABASE_SERVICE_ROLE_KEY, which bypasses grants and row level security
-- entirely regardless of anything set here. Three of the eighteen
-- (event_calendar, event_ticket_availability, event_ticket_prices) are
-- queried by those service-role functions; the other fifteen are not
-- referenced by any application code in this repository at all, so if they
-- are used it is only by hand, through Supabase's own dashboard, which
-- authenticates at a level none of this applies to.
--
-- Applied directly against production via the Supabase MCP tool, 1 October
-- 2026, then confirmed two ways: querying information_schema.role_table_grants
-- for anon/authenticated on all eighteen now returns zero rows, and
-- pg_class.reloptions for all eighteen now shows security_invoker=true.
-- booking_attribution and event_ticket_availability were re-queried
-- afterwards through this same privileged connection and still returned
-- their normal row counts, confirming nothing that legitimately needs these
-- views was broken by removing access nothing legitimate was using anyway.

do $$
declare
  v text;
begin
  foreach v in array array[
    'event_calendar', 'bookings_needing_a_refund', 'weekly_pay',
    'abandoned_checkouts', 'abandoned_capture_by_day', 'checkout_funnel_by_page',
    'checkout_funnel_by_landing_page', 'widget_looks_by_day', 'widget_looks_by_page',
    'bookings_by_payment_method', 'widget_looks_by_event', 'event_ticket_prices',
    'look_to_sale_by_day', 'event_ticket_availability', 'contribution_by_day',
    'contribution_lost_by_page', 'bookings_by_nationality', 'booking_attribution'
  ]
  loop
    execute format('alter view public.%I set (security_invoker = true)', v);
    execute format('revoke all on public.%I from anon, authenticated, public', v);
  end loop;
end $$;
