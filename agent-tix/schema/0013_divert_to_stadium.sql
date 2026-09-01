-- Send a guest somewhere else when we are not selling a night ourselves.
--
-- A night can be closed for reasons that have nothing to do with the fight
-- being sold out — we stop selling, the stadium carries on. Telling that guest
-- only "booking closed" ends their evening on our page. This lets a night carry
-- a link, so the widget can offer them the stadium's own box office instead.
--
-- Deliberately per night rather than a single site-wide setting: the link is a
-- decision about one night, and it should disappear the moment that night is
-- back on sale rather than lingering as a global switch someone forgets.
--
-- The widget only ever shows it when nothing at all on that night is buyable.
-- A night where even one seat class is still on sale is a night we are selling,
-- and pointing that guest at another site would be giving away our own booking.

alter table public.events
  add column if not exists divert_url  text,
  add column if not exists divert_note text;

alter table public.events
  drop constraint if exists events_divert_url_https;

-- A link we hand a paying guest is one we take responsibility for. Anything
-- that is not a plain https address is a mistake, not a destination.
alter table public.events
  add constraint events_divert_url_https
  check (divert_url is null or divert_url ~ '^https://[^\s]+$');

comment on column public.events.divert_url is
  'Where to send a guest when this night is closed to booking with us. Shown only when no class on the night is buyable.';
comment on column public.events.divert_note is
  'The line shown above that link, explaining why we are not selling this night.';
