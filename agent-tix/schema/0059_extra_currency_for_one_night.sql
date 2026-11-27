-- 0059: let ONE night offer a currency the standing list has switched off (Jason, 27 November 2026).
--
-- Why: since 23 November every class is GBP only. Jason wants one night, Third Class on RWS Sat 28 Nov, to also
-- take USD, EUR and AUD at his own prices, for a Third-Class-only widget. Switching the standing prices back on
-- would put those currencies on every night, so the exception lives on the night's own override row instead.
--
-- How: a new flag on the override row, off by default. The price view surfaces an override whose standing price is
-- inactive ONLY when that flag is on. Every existing override has the flag off, so nothing else changes: the 26 Dec
-- anniversary night's old USD, EUR and AUD overrides stay hidden, which is what Jason wants.
--
-- Undo: set extra_currency = false on those rows (or delete them), or re-run 0052's view definition.
alter table public.event_ticket_price_overrides
  add column if not exists extra_currency boolean not null default false;

comment on column public.event_ticket_price_overrides.extra_currency is
  'true: offer this currency on this night even though the standing price for it is switched off.';

create or replace view public.event_ticket_prices as
select
  etc.id                                      as event_ticket_class_id,
  d.currency,
  coalesce(o.unit_amount, d.unit_amount)      as unit_amount,
  d.display_order,
  (o.event_ticket_class_id is not null)       as is_override
from public.event_ticket_classes etc
join public.ticket_class_prices d
  on d.ticket_class_id = etc.ticket_class_id
left join public.event_ticket_price_overrides o
  on o.event_ticket_class_id = etc.id and o.currency = d.currency and o.active
where not coalesce(o.withdrawn, false)
  and (d.active or coalesce(o.extra_currency, false));
