-- Agent Tix — seed: 1 to 7 September 2026
--
-- APPLIED to the agent-tix-build project (jlwopomkqeawrxlapwpc) on 30 August 2026.
--
-- Names, dates, times, prices and stock counts are copied from the live system,
-- not shared with it. V2 is a separate system; the live database is only a
-- source of values.
--
-- Two deliberate differences from live:
--   * limited_threshold uses the schema default of 19, giving the 20-or-more /
--     1-to-19 split the brief confirms. Live still runs the old 9 and 10.
--   * assigned_seating is true for Ringside and Club Class, per the brief. Live
--     has show_seating_notice false on every row, so the warning never fires.
--
-- Nothing is sold: this is a fresh system, and the stock number is a cap rather
-- than a pool of physical tickets.

insert into public.tenants (slug, name, allowed_origins, default_timezone)
values ('muaytix', 'MuayTix LTD',
        array['https://muaytix.com','https://www.muaytix.com'], 'Asia/Bangkok');

insert into public.venues (tenant_id, slug, name, timezone)
select id, 'rajadamnern', 'Rajadamnern Stadium, Bangkok', 'Asia/Bangkok'
from public.tenants where slug = 'muaytix';

insert into public.ticket_classes (tenant_id, code, name, description, assigned_seating, display_order)
select t.id, c.code, c.name, c.description, c.assigned_seating, c.display_order
from public.tenants t
cross join (values
  ('ringside', 'Ringside', 'Reserved seating just metres from the ring, placing you close to every entrance, exchange and celebration.', true, 1),
  ('club_class', 'Club Class', 'Our most popular ticket, offering panoramic views from elevated seating with reserved seats throughout the evening.', true, 2),
  ('leo_section', 'LEO Section', 'Elevated seating in Section 10, offering panoramic views and one of the stadium''s most energetic atmospheres.', false, 3),
  ('third_class', 'Third Class', 'Guaranteed seating in the upper terraces, with a panoramic 360-degree view across the ring and stadium.', false, 4)
) as c(code, name, description, assigned_seating, display_order)
where t.slug = 'muaytix';

insert into public.event_series
  (tenant_id, venue_id, slug, name, default_description, frequency, weekdays,
   week_of_month, default_start_time_local, default_duration_minutes)
select t.id, v.id, s.slug, s.name, s.descr, s.freq, s.wd::smallint[], s.wom::smallint, s.start_t::time, s.mins
from public.tenants t
join public.venues v on v.tenant_id = t.id and v.slug = 'rajadamnern'
cross join (values
  ('rajadamnern-knockout', 'Rajadamnern Knockout',
   'Fast-paced three-round fights, chasing a knockout from the opening bell.',
   'weekly', '{1,2,5}', null, '19:00', 120),
  ('new-power', 'New Power Traditional Muay Thai',
   'Classic five-round Muay Thai from Thailand''s longest-standing promoter, fuelled by an electric local atmosphere.',
   'weekly', '{3}', null, '18:00', 240),
  ('petchyindee', 'Petchyindee Traditional Muay Thai',
   'Traditional Muay Thai with technical five-round fights, fuelled by a passionate local crowd.',
   'weekly', '{4}', null, '18:00', 240),
  ('rws', 'RWS Rajadamnern World Series',
   'World-class championship Muay Thai meets the energy of a Saturday-night global broadcast.',
   'weekly', '{6}', null, '19:10', 170),
  ('kiatpetch', 'Kiatpetch Traditional Muay Thai',
   'Technical fighters blend fast-paced three-round bouts with classic five-round Muay Thai before a lively Sunday-night local crowd.',
   'weekly', '{7}', null, '18:00', 240),
  ('all-star-buakaw', 'All Star Elite Fighter by Buakaw',
   'Thailand takes on the world across seven three-round bouts, promoted by Muay Thai icon Buakaw.',
   'monthly', '{1}', -1, '19:00', 120)
) as s(slug, name, descr, freq, wd, wom, start_t, mins)
where t.slug = 'muaytix';

insert into public.events
  (tenant_id, series_id, venue_id, event_key, name, starts_at, ends_at, publication_status)
select t.id, es.id, v.id, e.event_key, es.name, e.starts_at::timestamptz, e.ends_at::timestamptz, 'published'
from public.tenants t
join public.venues v on v.tenant_id = t.id and v.slug = 'rajadamnern'
cross join (values
  ('rajadamnern_knockout_2026_09_01', 'rajadamnern-knockout', '2026-09-01 19:00+07', '2026-09-01 21:00+07'),
  ('new_power_2026_09_02',            'new-power',            '2026-09-02 18:00+07', '2026-09-02 22:00+07'),
  ('petchyindee_2026_09_03',          'petchyindee',          '2026-09-03 18:00+07', '2026-09-03 22:00+07'),
  ('rajadamnern_knockout_2026_09_04', 'rajadamnern-knockout', '2026-09-04 19:00+07', '2026-09-04 21:00+07'),
  ('rws_2026_09_05',                  'rws',                  '2026-09-05 19:10+07', '2026-09-05 22:00+07'),
  ('kiatpetch_2026_09_06',            'kiatpetch',            '2026-09-06 18:00+07', '2026-09-06 22:00+07'),
  ('rajadamnern_knockout_2026_09_07', 'rajadamnern-knockout', '2026-09-07 19:00+07', '2026-09-07 21:00+07')
) as e(event_key, series_slug, starts_at, ends_at)
join public.event_series es on es.slug = e.series_slug and es.tenant_id = t.id
where t.slug = 'muaytix';

insert into public.event_ticket_classes
  (tenant_id, event_id, ticket_class_id, total_quantity, release_status, display_order, max_per_order)
select ev.tenant_id, ev.id, tc.id, q.total, 'released', tc.display_order, 10
from public.events ev
join public.ticket_classes tc on tc.tenant_id = ev.tenant_id
join (values
  ('rajadamnern_knockout_2026_09_01', 'ringside', 25), ('rajadamnern_knockout_2026_09_01', 'club_class', 25), ('rajadamnern_knockout_2026_09_01', 'leo_section', 25),
  ('new_power_2026_09_02',            'ringside', 25), ('new_power_2026_09_02',            'club_class', 25), ('new_power_2026_09_02',            'leo_section', 25),
  ('petchyindee_2026_09_03',          'ringside', 25), ('petchyindee_2026_09_03',          'club_class', 25), ('petchyindee_2026_09_03',          'leo_section', 25),
  ('rajadamnern_knockout_2026_09_04', 'ringside', 25), ('rajadamnern_knockout_2026_09_04', 'club_class', 25), ('rajadamnern_knockout_2026_09_04', 'leo_section', 25),
  ('rws_2026_09_05',                  'ringside', 21), ('rws_2026_09_05',                  'club_class', 40), ('rws_2026_09_05',                  'leo_section', 30), ('rws_2026_09_05', 'third_class', 50),
  ('kiatpetch_2026_09_06',            'ringside', 25), ('kiatpetch_2026_09_06',            'club_class', 25), ('kiatpetch_2026_09_06',            'leo_section', 25),
  ('rajadamnern_knockout_2026_09_07', 'ringside', 25), ('rajadamnern_knockout_2026_09_07', 'club_class', 25), ('rajadamnern_knockout_2026_09_07', 'leo_section', 25)
) as q(event_key, class_code, total)
  on q.event_key = ev.event_key and q.class_code = tc.code;

insert into public.ticket_currency_prices (event_ticket_class_id, currency, unit_amount, display_order)
select etc.id, p.currency, p.amount, p.display_order
from public.event_ticket_classes etc
join public.ticket_classes tc on tc.id = etc.ticket_class_id
join (values
  ('ringside','usd',7700,1), ('ringside','eur',6700,2), ('ringside','gbp',5700,3), ('ringside','aud',10900,4), ('ringside','cny',52000,5), ('ringside','thb',250000,6),
  ('club_class','usd',5500,1), ('club_class','eur',4800,2), ('club_class','gbp',4100,3), ('club_class','aud',7900,4), ('club_class','cny',38000,5), ('club_class','thb',180000,6),
  ('leo_section','usd',4600,1), ('leo_section','eur',4000,2), ('leo_section','gbp',3400,3), ('leo_section','aud',6600,4), ('leo_section','cny',31000,5), ('leo_section','thb',150000,6),
  ('third_class','usd',3100,1), ('third_class','eur',2700,2), ('third_class','gbp',2300,3), ('third_class','aud',4400,4), ('third_class','cny',21000,5), ('third_class','thb',100000,6)
) as p(class_code, currency, amount, display_order)
  on p.class_code = tc.code;
