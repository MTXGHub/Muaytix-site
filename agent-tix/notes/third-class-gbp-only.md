# Third Class in GBP only, every date (Jason, 18 November 2026)

Decision: Third Class tickets on all nights are priced and charged in GBP only. Sentence shown under the price (Jason chose
"version 1"): **"Third Class tickets are charged in GBP only. No booking fee."**

## Two parts, in this order

1. **Widget** (built 18 Nov, `widget.js`, test `widget/tests/one-currency.test.mjs`, 7 checks pass): when the class on screen has exactly one
   currency, the widget shows "<Class> tickets are charged in <CUR> only. No booking fee." under the quantity and currency boxes.
   Nothing shows for a class with several currencies. New header `widget/paste-into-tilda-header.html` is 61,865 bytes (limit 63,000);
   `header-block.test.mjs` 20 pass; seat-tiles, divert and seats-apart tests pass. **Pasted into the Tilda site head and all pages published by Jason on 18 Nov 2026** (he skipped the hidden test page; I have not seen the live page).
   Rollback header (the one before this change): `widget/rollback/paste-into-tilda-header-04cd91d.html`.
   Stage it the usual way: paste the new header, publish ONE hidden test page, check it, then the rest.
2. **Prices: SWITCHED ON 18 Nov 2026**, right after Jason said the header was pasted and published. Read back: all 212 Third Class rows offer GBP only (GBP 25; 26 Dec GBP 35). The statement used:

```sql
-- switch on: Third Class offered in GBP only (every night; per-night overrides in the other currencies are then ignored)
update public.ticket_class_prices p set active = false
  from public.ticket_classes tc
 where tc.id = p.ticket_class_id and tc.code = 'third_class' and p.currency in ('usd', 'eur', 'aud');
-- switch off (put the three currencies back):
update public.ticket_class_prices p set active = true
  from public.ticket_classes tc
 where tc.id = p.ticket_class_id and tc.code = 'third_class' and p.currency in ('usd', 'eur', 'aud');
```

Standing Third Class GBP price: 25 (26 Dec, the R81 night, keeps its own 35). Baht and yuan are already off.
A guest who already had USD, EUR or AUD chosen on Third Class when the switch is made gets "That currency is not available for this ticket"
and picks GBP.
