-- 8 November 2026 (Jason): final RWS 81 Anniversary (Sat 26 Dec 2026) prices. APPLIED to agent-tix-build the
-- same day, data only. These replace the figures set in 0051 and 0052, via event_ticket_price_overrides.
--   Ringside     GBP 85, USD 115, AUD 165, EUR 105   (AUD was 170)
--   Club Class   the ordinary Ringside prices:    GBP 56, USD 75, EUR 68, AUD 110   (0057)
--   LEO Section  the ordinary Club Class prices:  GBP 40, USD 55, EUR 50, AUD 80    (0056)
--   Third Class  the ordinary LEO prices:         GBP 35, USD 45, EUR 40, AUD 65    (0055)
-- Only the figures that were there are changed; baht and yuan stay withdrawn for the night (0052).
-- Stock is still 20 a class "for now" (Jason), not a count of tickets bought.
update public.event_ticket_price_overrides o set unit_amount = v.amt
  from public.event_ticket_classes etc, public.events e, public.ticket_classes tc,
       (values ('ringside','gbp',8500),('ringside','usd',11500),('ringside','aud',16500),('ringside','eur',10500),
               ('club_class','gbp',5600),('club_class','usd',7500),('club_class','eur',6800),('club_class','aud',11000),
               ('leo_section','gbp',4000),('leo_section','usd',5500),('leo_section','eur',5000),('leo_section','aud',8000),
               ('third_class','gbp',3500),('third_class','usd',4500),('third_class','eur',4000),('third_class','aud',6500)) v(code,cur,amt)
 where o.event_ticket_class_id = etc.id and etc.event_id = e.id and e.event_key = 'rws_2026_12_26'
   and tc.id = etc.ticket_class_id and tc.code = v.code and o.currency = v.cur and not o.withdrawn;
