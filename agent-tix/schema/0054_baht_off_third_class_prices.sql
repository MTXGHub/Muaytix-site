-- 8 November 2026 (Jason): baht is no longer offered on any night, and Third Class has new prices.
-- APPLIED to agent-tix-build the same day, data only, AFTER create-checkout v21 was deployed.
--
-- ORDER MATTERED. create-checkout (resolveOffer) used to read the baht price through event_ticket_prices to
-- work out the Club Class offer's discount. With baht gone from that view, every offer would have failed. v21
-- reads the baht figure from ticket_class_prices (any active state) and the night's override instead. Deployed
-- first, read back from the live project and diffed against git (identical), then the data below.
-- tests/club-offer-guards.test.mjs updated for it (54 pass); the other function tests that do not need a scratch
-- Postgres pass; guest-hold-guards and availability-hold-guards need one and could not be run here (they could
-- not before either).
--
-- Guests are now offered USD, EUR, GBP and AUD only. Yuan was switched off earlier the same day (0053).
-- Baht stays in ticket_class_prices (inactive) because the margin on the Club Class offer is measured in baht,
-- and class_fallback_offer_prices keeps its THB and CNY rows for the same reason.
-- GOTCHA: the offer-floor trigger (enforce_fallback_offer_floor) only runs when an offer price is written and
-- looks for an ACTIVE standing price in that currency, so editing the THB or CNY offer price now raises
-- "No standing thb price exists". Switch the standing price on for the edit if that is ever needed.
--
-- Third Class standing prices (every night without its own override): GBP 25, EUR 30, USD 30, AUD 45
-- (were 23, 27, 30, 44). RWS 81 Anniversary (26 Dec) keeps its own Third Class prices (45, 40, 33, 65).
update public.ticket_class_prices set active = false where currency = 'thb' and active;
update public.ticket_class_prices p set unit_amount = v.amt
  from public.ticket_classes tc, (values ('gbp', 2500), ('eur', 3000), ('usd', 3000), ('aud', 4500)) v(cur, amt)
 where tc.id = p.ticket_class_id and tc.code = 'third_class' and p.currency = v.cur;
