-- 8 November 2026 (Jason): new LEO prices, and the Club Class offer ("Save on Club Class tickets", shown when LEO
-- is fully booked) is removed. APPLIED to agent-tix-build the same day, data only.
--
-- LEO standing prices: GBP 35, USD 45, EUR 40, AUD 65 (only GBP changed, from 33). Every night without its own
-- override. RWS 81 Anniversary (26 Dec) keeps its own LEO prices (54, 48, 40, 78).
--
-- Offer: class_fallback_offers.active = false for 'leo_to_club'. That is the single switch both functions read:
-- availability stops sending the offer, create-checkout refuses it (409 offer_unavailable, and the widget reads the
-- night again). Nothing deleted: the offer, its prices, the per-night switches and the fallback_offer_by_day report
-- are all still there, so turning it back on is one line:
--   update public.class_fallback_offers set active = true where code = 'leo_to_club';
-- The widget code (OFFER_BTN in widget.js) is unchanged and nothing needs re-pasting into Tilda.
update public.ticket_class_prices p set unit_amount = v.amt
  from public.ticket_classes tc, (values ('gbp', 3500), ('usd', 4500), ('eur', 4000), ('aud', 6500)) v(cur, amt)
 where tc.id = p.ticket_class_id and tc.code = 'leo_section' and p.currency = v.cur;
update public.class_fallback_offers set active = false where code = 'leo_to_club';
