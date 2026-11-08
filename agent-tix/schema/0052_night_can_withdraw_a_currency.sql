-- A night can now withdraw a currency (Jason, 8 November 2026).
-- For RWS 81 Anniversary (Sat 26 Dec 2026) Jason does not want THB or CNY offered. Prices are read through
-- the view event_ticket_prices, and the widget and create-checkout both build the currency list from it, so a
-- currency missing from the view is missing from the widget for that night (the widget picks a currency again
-- whenever the guest changes night or class) and checkout answers "That currency is not available".
--
-- APPLIED to agent-tix-build on 8 November 2026 as migration "night_can_withdraw_a_currency".
-- New column event_ticket_price_overrides.withdrawn (default false); the view leaves out any currency whose
-- active override is marked withdrawn. Nothing changes for a night with no withdrawn row: checked before and
-- after, the 5,064 price rows of every other night are identical and none of them has an override.
--
-- 26 Dec data (applied the same day, not part of the migration): THB and CNY withdrawn on all four classes.
-- Prices, per ticket: Ringside USD 115, EUR 105, GBP 85, AUD 170 (Jason's figures); Club Class USD 75,
-- EUR 66, GBP 55, AUD 108; LEO USD 54, EUR 48, GBP 40, AUD 78; Third Class USD 45, EUR 40, GBP 33, AUD 65
-- (the ordinary Ringside, Club Class and LEO prices, which equal the stadium's 2,500, 1,800 and 1,500 baht;
-- Jason gave only the Ringside figures and did not object to these). The THB figures are kept on the
-- withdrawn rows for the record (3,800 / 2,500 / 1,800 / 1,500).
-- The night is still a hidden draft with zero stock: counts and start time are still to come.

alter table public.event_ticket_price_overrides add column if not exists withdrawn boolean not null default false;

create or replace view public.event_ticket_prices as
 SELECT etc.id AS event_ticket_class_id,
    d.currency,
    COALESCE(o.unit_amount, d.unit_amount) AS unit_amount,
    d.display_order,
    o.event_ticket_class_id IS NOT NULL AS is_override
   FROM event_ticket_classes etc
     JOIN ticket_class_prices d ON d.ticket_class_id = etc.ticket_class_id AND d.active
     LEFT JOIN event_ticket_price_overrides o ON o.event_ticket_class_id = etc.id AND o.currency = d.currency AND o.active
  WHERE NOT COALESCE(o.withdrawn, false);
