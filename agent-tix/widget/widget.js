// MuayTix — Rajadamnern booking widget
//
// This file is served from an Edge Function and pointed at by a script tag, so
// changing the widget changes every page at once. Nothing is pasted into a
// page and nothing needs re-pasting when it changes.
//
// A page marks where the widget goes and, if it wants, which night and which
// seats:
//
//   <div class="muaytix-ticket-selector"></div>
//       the full calendar: pick a month, a date, then a seat class
//
//   <div class="muaytix-ticket-selector" data-event-id="rws_2026_09_05"></div>
//       one night only. No calendar, no month buttons, straight to the seats.
//
//   <div class="muaytix-ticket-selector" data-event-id="rws_2026_09_05"
//        data-ticket-class="Third Class"></div>
//       one night, one seat class, opened rather than offered as a choice.
//
//   <div class="muaytix-ticket-selector" data-start="seats"></div>
//       seat first, night second. The guest picks Ringside, Club, LEO or Third
//       Class before any date, then gets a calendar showing which nights that
//       seat is on sale. For a guest who cares more about where they sit than
//       which night they go.
//
//   <div class="muaytix-ticket-selector" data-series="rws"></div>
//       a page built around one promotion. Only that promotion's nights can be
//       booked here: they carry the green available fill, and every other night
//       is scored through and cannot be clicked. Months holding none of this
//       promotion's nights are not offered at all, so an RWS page never opens
//       on a month with no RWS in it.
//
//       Those other nights keep their promotion's name under the scored-out
//       date, so the calendar never claims there is no fight on a night that
//       has one. A page in this mode should carry a link to the all-tickets
//       page beneath the widget, for a guest who wants a different night.
//
// The page loads this file with an ordinary script tag pointing at
// https://jlwopomkqeawrxlapwpc.supabase.co/functions/v1/widget — the exact
// markup is in README.md. Deliberately not written out here: a literal closing
// script tag inside this file would cut the file short if it were ever pasted
// inline rather than linked.
//
// The attribute names match the ones already on the site, so a page moves
// across by changing which script tag it loads and nothing else.
//
// More than one may sit on the same page; each keeps its own state.

(function () {
"use strict";

var MOUNT = ".muaytix-ticket-selector";
var STYLE_ID = "mtx-widget-styles";


/* ---------------------------------------------------------------------------
   Settings
   -------------------------------------------------------------------------*/
var API = "https://jlwopomkqeawrxlapwpc.supabase.co/functions/v1";

// How far ahead to look. Whatever nights exist in that window become the month
// buttons, so loading 2027 into the database is all it takes to sell 2027.
var MONTHS_AHEAD = 18;

// A guest on a bad hotel connection should be told, not left watching a
// spinner. Both are generous compared with a normal response.
var READ_TIMEOUT = 12000;
var CHECKOUT_TIMEOUT = 20000;

// The availability message is a promise that we checked. Leaving it up for a
// beat means it is read rather than glimpsed.
var MIN_CHECK_MS = 1200;

// The green button under a fully booked LEO when Club Class is offered instead.
// Wording is Jason's to change; the price itself comes from the server.
var OFFER_BTN = "Save on Club Class tickets";

var MONTHS  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
var MONTHS_S= ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
var DAYS    = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];


/* ---------------------------------------------------------------------------
   The stylesheet, injected once however many widgets are on the page
   -------------------------------------------------------------------------*/
var CSS = "\n\n#mtx-booking{\n  --ground:#F5F5F6; --surface:#FFFFFF; --surface-2:#FAFAFB;\n  --ink:#111114; --ink-2:#2E2E34; --muted:#5C5C66; --line:#DEDEE3; --line-2:#EDEDF0;\n  --ok-fg:#136B3B; --ok-bg:#E6F2EA;\n  --lim-fg:#1540C9; --lim-bg:#E8EEFF;\n  /* Availability, loud. Green is a fill, not a tint -- it has to be the\n     brightest thing on the seat step. */\n  --go:#00A550; --go-ink:#FFFFFF;\n  --few:#D4351C; --few-ink:#FFFFFF;\n  /* Sold out. Jason's red, not the burgundy --full-fg carries for text on a pale\n     ground -- that one stays where it is, because pure red as type would read\n     worse rather than louder. */\n  --gone:#FF0000;\n  --full-fg:#9C1F1F; --full-bg:#F8E8E8;\n  --shut-fg:#5C5C66; --shut-bg:#EDEDF0;\n  --ring:#C4122F;\n  --shadow:0 1px 2px rgba(20,17,14,.05), 0 8px 24px rgba(20,17,14,.07);\n  --shadow-lg:0 2px 4px rgba(20,17,14,.06), 0 18px 44px rgba(20,17,14,.12);\n  /* Seat class colours are no longer listed here. They arrive with the\n     availability response, from ticket_classes.accent_colour / accent_ink, so\n     a fifth class needs no change to this file. */\n  --blue:#1f5bff; --blue-on:#1540C9; --blue-ink:#FFFFFF;\n  color-scheme:light;\n}\n/* Locked to light. The widget is embedded in a light Tilda page, so following\n   the guest's phone theme would make it look foreign inside its own page. */\n\n#mtx-booking *{box-sizing:border-box}\n#mtx-booking{background:var(--ground);color:var(--ink);\n  font:400 15px/1.55 Barlow,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;\n  -webkit-font-smoothing:antialiased;\n  /* Tilda centres the text in its blocks, and that inherits straight into the\n     widget: every description and label came out centred on the live page.\n     Stated here so the widget reads the same wherever it is embedded. */\n  text-align:left}\n#mtx-booking h1, #mtx-booking h2, #mtx-booking h3, #mtx-booking h4{margin:0;font-family:\"Barlow Condensed\",Barlow,sans-serif;text-wrap:balance;letter-spacing:.005em}\n#mtx-booking p{margin:0}\n#mtx-booking button, #mtx-booking select{font:inherit;color:inherit}\n#mtx-booking :focus-visible{outline:2px solid var(--ring);outline-offset:2px;border-radius:4px}\n@media (prefers-reduced-motion:reduce){#mtx-booking *{animation-duration:.01ms!important;transition-duration:.01ms!important}}\n\n/* numbered step badge */\n#mtx-booking .mtx-num{display:inline-grid;place-items:center;width:20px;height:20px;flex:0 0 auto;border-radius:50%;\n  background:var(--blue);color:var(--blue-ink);font-family:Barlow;font-size:11px;font-weight:700;\n  line-height:1;font-variant-numeric:tabular-nums}\n\n/* ---------- widget shell ---------- */\n#mtx-booking .mtx-stage{padding:0}\n#mtx-booking .mtx-card{max-width:1120px;margin:0 auto;background:var(--surface);border:1px solid var(--line);\n  border-radius:16px;box-shadow:var(--shadow);overflow:hidden;transition:max-width .28s ease}\n\n/* masthead */\n#mtx-booking .mtx-mast{padding:20px 26px;border-bottom:1px solid var(--line-2);background:var(--surface-2)}\n#mtx-booking .mtx-mast-lead{display:block;font-size:12px;font-weight:700;letter-spacing:.14em;\n  text-transform:uppercase;color:var(--blue);margin-bottom:4px}\n#mtx-booking .mtx-mast-venue{display:block;font-family:\"Barlow Condensed\";font-weight:800;\n  font-size:clamp(26px,3.2vw,36px);line-height:1.02;letter-spacing:.005em}\n#mtx-booking .mtx-mast-city{display:block;font-family:\"Barlow Condensed\";font-weight:600;\n  font-size:clamp(18px,2.2vw,24px);line-height:1.15;color:var(--ink);letter-spacing:.03em}\n\n/* section label */\n#mtx-booking .mtx-sec-label{display:flex;align-items:center;gap:9px;margin:0 0 11px;\n  font-size:15px;font-weight:700;letter-spacing:.01em}\n#mtx-booking .mtx-sec-label.mtx-gap{margin-top:36px}\n\n/* month buttons */\n#mtx-booking .mtx-months{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:4px}\n/* border-width stays 3px on every state so selecting a month shifts nothing */\n#mtx-booking .mtx-mbtn{padding:12px 10px;border:3px solid var(--blue);border-radius:11px;background:var(--blue);\n  font-family:\"Barlow Condensed\";font-size:19px;font-weight:700;letter-spacing:.02em;\n  cursor:pointer;transition:.15s;color:var(--blue-ink)}\n#mtx-booking .mtx-mbtn:hover:not(.mtx-on){background:var(--blue-on);border-color:var(--blue-on)}\n/* chosen month reverses out: white fill, blue border, blue type */\n#mtx-booking .mtx-mbtn.mtx-on{background:var(--surface);border-color:var(--blue);color:var(--blue)}\n\n/* which month am I looking at \u2014 guards against picking a date in the wrong month */\n#mtx-booking .mtx-month-note{display:flex;align-items:center;gap:11px;margin:0 0 14px;padding:12px 15px;\n  border:2px solid var(--blue);border-radius:10px;\n  background:color-mix(in srgb, var(--blue) 10%, var(--surface));\n  color:var(--ink-2);font-size:14.5px;font-weight:600;line-height:1.25}\n#mtx-booking .mtx-month-note svg{flex:0 0 auto;color:var(--blue)}\n#mtx-booking .mtx-month-note b{font-family:\"Barlow Condensed\";font-size:20px;font-weight:800;\n  letter-spacing:.035em;color:var(--blue);white-space:nowrap}\n\n/* which seat am I booking \u2014 sits above the calendar in seat-first mode */\n#mtx-booking .mtx-seat-note{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:0 0 14px;\n  padding:12px 15px;border:2px solid var(--blue);border-radius:10px;\n  background:color-mix(in srgb, var(--blue) 10%, var(--surface));\n  color:var(--ink-2);font-size:14.5px;font-weight:600;line-height:1.3}\n#mtx-booking .mtx-seat-note-k{font-size:11px;font-weight:800;letter-spacing:.14em;\n  text-transform:uppercase;color:var(--muted)}\n#mtx-booking .mtx-seat-note b{font-family:\"Barlow Condensed\";font-size:20px;font-weight:800;\n  letter-spacing:.035em;color:var(--blue);white-space:nowrap}\n#mtx-booking .mtx-seat-note-d{flex:1 1 100%;font-size:13px;font-weight:500;color:var(--muted)}\n#mtx-booking .mtx-seat-note-sold{margin-top:-4px;font-style:italic}\n#mtx-booking .mtx-seat-change{margin-left:auto;border:1.5px solid var(--blue);background:var(--surface);\n  color:var(--blue);padding:6px 11px;border-radius:7px;font-size:10.5px;font-weight:700;\n  letter-spacing:.07em;text-transform:uppercase;cursor:pointer;transition:.15s}\n#mtx-booking .mtx-seat-change:hover{background:var(--blue);color:var(--blue-ink)}\n@media (max-width:520px){ #mtx-booking .mtx-seat-change{margin-left:0} }\n\n/* calendar */\n#mtx-booking .mtx-cal{padding:24px 26px 26px}\n#mtx-booking .mtx-dow, #mtx-booking .mtx-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}\n#mtx-booking .mtx-dow{margin-bottom:6px}\n#mtx-booking .mtx-dow span{text-align:center;font-size:13px;font-weight:700;letter-spacing:.09em;\n  text-transform:uppercase;color:var(--muted);padding:2px 0}\n#mtx-booking .mtx-day{position:relative;min-height:62px;padding:7px 5px 6px;border:1.5px solid transparent;\n  border-radius:11px;background:var(--surface-2);cursor:pointer;text-align:center;\n  display:flex;flex-direction:column;align-items:center;gap:5px;transition:.15s}\n#mtx-booking .mtx-day:hover:not(:disabled){border-color:var(--line);transform:translateY(-1px)}\n#mtx-booking .mtx-day:disabled{background:transparent;cursor:default}\n#mtx-booking .mtx-day .mtx-n{font-family:\"Barlow Condensed\";font-weight:700;font-size:20px;line-height:1;\n  font-variant-numeric:tabular-nums}\n#mtx-booking .mtx-day .mtx-tag{font-size:9px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;\n  color:var(--muted);line-height:1.15;max-width:100%;overflow:hidden}\n#mtx-booking .mtx-day .mtx-dot{width:5px;height:5px;border-radius:50%;background:var(--evt,var(--muted))}\n/* The promotion this page is about. On a promotion page these are the only\n   nights that can be booked, so they carry the green that means available\n   everywhere else in the widget rather than the promotion's own accent. */\n#mtx-booking .mtx-day.mtx-hi{border-color:var(--evt,var(--blue));\n  background:color-mix(in srgb, var(--evt,var(--blue)) 9%, var(--surface))}\n#mtx-booking .mtx-day.mtx-hi .mtx-n{font-weight:800}\n#mtx-booking .mtx-day.mtx-open{border-color:var(--go);background:var(--ok-bg)}\n#mtx-booking .mtx-day.mtx-open .mtx-n{color:var(--ok-fg);font-weight:800}\n#mtx-booking .mtx-day.mtx-open .mtx-tag{color:var(--ok-fg)}\n#mtx-booking .mtx-day.mtx-open .mtx-dot{background:var(--go)}\n#mtx-booking .mtx-day.mtx-open:hover:not(:disabled){border-color:var(--go);\n  background:color-mix(in srgb, var(--go) 18%, var(--surface))}\n/* Another promotion's night on a promotion page: scored through, not\n   clickable, but its name stays so the cell never reads as \"no fight\". */\n#mtx-booking .mtx-day.mtx-elsewhere .mtx-tag{opacity:.5;text-decoration:line-through}\n/* Seat-first: the chosen seat is gone this night. Dimmed, never removed \u2014 the night is still open and the other seats are still for sale. */\n#mtx-booking .mtx-day.mtx-off{opacity:.42}\n#mtx-booking .mtx-day.mtx-off:hover:not(:disabled){opacity:1}\n#mtx-booking .mtx-day.mtx-sel{border-color:var(--ink);background:var(--ink)}\n#mtx-booking .mtx-day.mtx-sel .mtx-n{color:var(--ground)} #mtx-booking .mtx-day.mtx-sel .mtx-tag{color:rgba(255,255,255,.72)}\n#mtx-booking .mtx-day.mtx-none .mtx-n{color:var(--muted);opacity:.4}\n#mtx-booking .mtx-day.mtx-shut .mtx-n{color:var(--muted);opacity:.55;text-decoration:line-through}\n\n/* selected event box \u2014 white, framed in blue, blue accents */\n#mtx-booking .mtx-band{margin:0 26px;padding:22px 24px;background:var(--surface);color:var(--ink);\n  border:2px solid var(--blue);border-radius:14px}\n#mtx-booking .mtx-band-k{font-size:11px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;\n  color:var(--blue);margin-bottom:9px}\n#mtx-booking .mtx-band-h{font-size:clamp(24px,3vw,34px);font-weight:800;line-height:1.06;letter-spacing:.01em}\n#mtx-booking .mtx-band-when{display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:12px;font-size:15px;\n  font-weight:600;color:var(--ink-2)}\n#mtx-booking .mtx-band-when span{display:inline-flex;align-items:center;gap:7px}\n#mtx-booking .mtx-band-when svg{color:var(--blue);flex:0 0 auto}\n#mtx-booking .mtx-band-d{margin-top:13px;font-size:14.5px;line-height:1.55;color:var(--muted);max-width:66ch}\n/* a way back, not a call to action \u2014 sized down so it sits under the event detail */\n#mtx-booking .mtx-band-change{margin-top:15px;border:1.5px solid var(--blue);background:var(--surface);color:var(--blue);\n  padding:6px 11px;border-radius:7px;font-size:10.5px;font-weight:700;letter-spacing:.07em;\n  text-transform:uppercase;cursor:pointer;transition:.15s}\n#mtx-booking .mtx-band-change:hover{background:var(--blue);color:var(--blue-ink)}\n\n/* loading */\n#mtx-booking .mtx-load{padding:56px 26px;text-align:center;color:var(--ink-2);font-size:16px;font-weight:600}\n/* The tall wait. When a guest taps a date the page scrolls this panel flush\n   against the top of the screen, and a short panel leaves the host page's own\n   seat-class copy filling the eye line underneath -- so the guest looks at\n   that rather than at the spinner, and hesitates. Filling the screen puts the\n   spinner in the middle of it with the Stripe line still at the foot.\n   Only the panels we scroll to get this: a widget loading where it stands\n   must not punch a screen-high hole into the page it sits in. */\n#mtx-booking .mtx-load--tall{min-height:calc(100vh - 92px);min-height:calc(100svh - 92px);\n  display:flex;flex-direction:column;align-items:center;justify-content:center;\n  padding-top:26px;padding-bottom:26px}\n#mtx-booking .mtx-spin{width:26px;height:26px;margin:0 auto 14px;border:3px solid var(--line);\n  border-top-color:var(--blue);border-radius:50%;animation:sp .7s linear infinite}\n@keyframes sp{to{transform:rotate(360deg)}}\n\n/* ticket area */\n#mtx-booking .mtx-tix{padding:24px 26px 30px}\n#mtx-booking .mtx-tix-h{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 14px;margin-bottom:16px}\n#mtx-booking .mtx-tix-h h3{display:flex;align-items:center;gap:9px;font-size:20px;font-weight:700}\n#mtx-booking .mtx-tix-h em{font-style:normal;font-size:12.5px;color:var(--muted)}\n\n/* status pill */\n#mtx-booking .mtx-pill{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;\n  font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;white-space:nowrap}\n#mtx-booking .mtx-pill i{width:6px;height:6px;border-radius:50%;background:currentColor;flex:0 0 auto}\n#mtx-booking .mtx-pill.mtx-ok{color:var(--ok-fg);background:var(--ok-bg)}\n#mtx-booking .mtx-pill.mtx-full{color:var(--full-fg);background:var(--full-bg)}\n#mtx-booking .mtx-pill.mtx-shut{color:var(--shut-fg);background:var(--shut-bg)}\n\n/* step 3a \u2014 the four choices, no detail */\n#mtx-booking .mtx-picker{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}\n/* The tile is one button. The strip, the border and the arrow all take a single\n   colour -- green while it can be booked, red once it cannot -- because that is\n   the only thing a guest needs at this step. The seat class colour returns on\n   the next screen, where the guest has chosen and the colour finally means\n   something to them. */\n#mtx-booking .mtx-pick{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:0;\n  padding:15px 34px 14px 21px;border:2px solid var(--st);border-radius:13px;\n  background:var(--surface);cursor:pointer;text-align:left;overflow:hidden;\n  transition:transform .15s ease,box-shadow .15s ease}\n#mtx-booking .mtx-pick{height:100%}\n#mtx-booking .mtx-pick--on{--st:var(--go)}\n/* A handful left needs to be spotted before the guest even reads the\n   pill text. Same green as any other live class -- just a heavier border\n   on that one tile, so it stands out from Available without a new colour. */\n#mtx-booking .mtx-pick--low{box-shadow:0 0 0 2px var(--st)}\n/* Not dimmed. The old wash made the name and price hard to read, which reads as\n   \"broken\" rather than \"gone\" -- and a guest who cannot read it goes looking\n   elsewhere. It is stated plainly and simply cannot be pressed. */\n#mtx-booking .mtx-pick--off{--st:var(--gone);cursor:not-allowed;background:var(--full-bg)}\n#mtx-booking .mtx-pick--offer .mtx-seatcard-go{margin-top:10px;animation:mtx-flash 1.8s ease-out infinite}\n@keyframes mtx-flash{0%,100%{box-shadow:0 0 0 0 rgba(0,165,80,.6)}70%{box-shadow:0 0 0 10px rgba(0,165,80,0)}}\n@media (prefers-reduced-motion:reduce){#mtx-booking .mtx-pick--offer .mtx-seatcard-go{animation:none}}\n#mtx-booking .mtx-ob{margin-bottom:16px;padding:16px 18px;border-radius:12px;background:var(--go);color:var(--go-ink);font-size:16px}\n#mtx-booking .mtx-ob-k{font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}\n#mtx-booking .mtx-ob-p{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;margin-top:10px}\n#mtx-booking .mtx-ob-now{font:800 44px/1 \"Barlow Condensed\"}\n#mtx-booking .mtx-ob-save{padding:5px 14px;border-radius:99px;background:#fff;color:var(--ok-fg);font-size:14px;font-weight:800;text-transform:uppercase}\n#mtx-booking .mtx-ob-n{margin-top:10px;font-size:14px}\n#mtx-booking .mtx-pick--on:hover{transform:translateY(-2px);box-shadow:var(--shadow-lg)}\n#mtx-booking .mtx-pick-bar{position:absolute;left:0;top:0;bottom:0;width:8px;background:var(--st)}\n#mtx-booking .mtx-pick-why{font-size:10.5px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;\n  color:var(--muted);margin-bottom:3px}\n#mtx-booking .mtx-pick-name{font-family:\"Barlow Condensed\";font-size:25px;font-weight:800;line-height:1.0}\n#mtx-booking .mtx-pick-price{margin-top:7px;font-size:15px;font-weight:600;color:var(--ink-2);\n  font-variant-numeric:tabular-nums}\n#mtx-booking .mtx-pick-go{position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--st);opacity:.9}\n/* margin-top:auto pins this to the bottom of the tile, so a two-line tagline\n   on one class and a one-line tagline on the next still leave the four badges\n   on the same baseline and the row with one flat edge. */\n#mtx-booking .mtx-avail{display:inline-flex;align-items:center;justify-content:center;margin-top:auto;\n  padding:8px 14px;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:.08em;\n  text-transform:uppercase;white-space:nowrap;align-self:stretch}\n#mtx-booking .mtx-avail--go{background:var(--go);color:var(--go-ink)}\n/* The number is the whole point of this pill -- it should not read like\n   part of the same uppercase label as everything else. */\n#mtx-booking .mtx-avail-n{font-size:20px;font-weight:900;letter-spacing:0;margin:0 2px}\n/* Sold out is stated, not whispered. A guest set on this class has to be left\n   in no doubt, or they go and look for it somewhere else. */\n#mtx-booking .mtx-avail--full{background:var(--gone);color:#FFFFFF}\n#mtx-booking .mtx-avail--shut{background:var(--shut-fg);color:#FFFFFF}\n\n/* step 3a with photos. A seat class that has photos is drawn as a card, but only\n   while it can be bought. Sold out or closed, it falls back to the compact tile\n   above, so a guest is never shown a seat they cannot have. */\n#mtx-booking .mtx-seatcard{position:relative;display:flex;flex-direction:column;background:var(--surface);\n  border:2px solid var(--go);border-radius:13px;overflow:hidden;text-align:left}\n#mtx-booking .mtx-seatcard--low{box-shadow:0 0 0 2px var(--go)}\n#mtx-booking .mtx-slider{position:relative;background:#0B0B10}\n#mtx-booking .mtx-track{display:flex;margin:0;padding:0;list-style:none;overflow-x:auto;\n  scroll-snap-type:x mandatory;scrollbar-width:none;overscroll-behavior-x:contain}\n#mtx-booking .mtx-track::-webkit-scrollbar{display:none}\n#mtx-booking .mtx-slide{flex:0 0 100%;margin:0;padding:0;list-style:none;scroll-snap-align:start;\n  aspect-ratio:3/2;background:#0B0B10}\n#mtx-booking .mtx-slide img{display:block;width:100%;height:100%;max-width:none;margin:0;object-fit:cover}\n#mtx-booking .mtx-slide-btn{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:44px;padding:0;\n  border:0;border-radius:50%;background:rgba(255,255,255,.94);color:var(--ink);display:flex;\n  align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.4)}\n#mtx-booking .mtx-slide-btn:hover{background:#FFFFFF}\n#mtx-booking .mtx-slide-btn:disabled{opacity:0;pointer-events:none}\n#mtx-booking .mtx-slide-prev{left:8px}\n#mtx-booking .mtx-slide-next{right:8px}\n#mtx-booking .mtx-dots{position:absolute;left:0;right:0;bottom:4px;display:flex;justify-content:center}\n#mtx-booking .mtx-dotb{display:flex;align-items:center;justify-content:center;width:24px;height:24px;\n  padding:0;border:0;background:none;cursor:pointer}\n#mtx-booking .mtx-dotb i{display:block;width:8px;height:8px;border-radius:50%;\n  background:rgba(255,255,255,.6);box-shadow:0 0 0 1px rgba(0,0,0,.45)}\n#mtx-booking .mtx-dotb[aria-current=\"true\"] i{width:10px;height:10px;background:#FFFFFF}\n#mtx-booking .mtx-seatcard-body{display:flex;flex-direction:column;align-items:flex-start;padding:15px 18px 17px}\n#mtx-booking .mtx-why-list{align-self:stretch;list-style:none;margin:13px 0 15px;padding:0;\n  display:flex;flex-direction:column;gap:10px}\n#mtx-booking .mtx-why-list li{position:relative;margin:0;padding:0 0 0 27px;list-style:none;\n  font-size:14.5px;font-weight:600;line-height:1.35;color:var(--ink-2)}\n#mtx-booking .mtx-why-tick{position:absolute;left:0;top:1px;color:var(--ok-fg)}\n#mtx-booking .mtx-why-note{display:block;margin-top:3px;font-size:13.5px;font-weight:500;color:var(--muted)}\n#mtx-booking .mtx-seatcard-go{position:relative;display:flex;align-items:center;justify-content:center;\n  align-self:stretch;min-height:48px;padding:10px 42px 10px 16px;border:0;border-radius:999px;\n  background:var(--go);color:var(--go-ink);font-size:13px;font-weight:800;letter-spacing:.08em;\n  text-transform:uppercase;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease}\n#mtx-booking .mtx-seatcard-go:hover{transform:translateY(-1px);box-shadow:var(--shadow)}\n#mtx-booking .mtx-seatcard-go .mtx-pick-go{color:var(--go-ink);opacity:1}\n\n/* step 3b \u2014 the one chosen class, framed in its own colour */\n/* Framed the way the tile it came from was: green while it can be booked, red once it\n   cannot. The seat class colour no longer frames anything. */\n#mtx-booking .mtx-detail{--st:var(--go);border:2px solid var(--st);border-radius:14px;padding:20px 22px;background:var(--surface)}\n#mtx-booking .mtx-detail--off{--st:var(--gone);background:var(--full-bg)}\n#mtx-booking .mtx-detail--shut{--st:var(--shut-fg);background:var(--shut-bg)}\n#mtx-booking .mtx-detail-k{font-size:11px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;\n  color:var(--muted);margin-bottom:8px}\n#mtx-booking .mtx-detail-top{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin-bottom:10px}\n#mtx-booking .mtx-detail-h{font-size:clamp(24px,2.6vw,30px);font-weight:800;line-height:1.05}\n#mtx-booking .mtx-detail-d{font-size:14.5px;line-height:1.55;color:var(--muted);max-width:66ch;margin-bottom:16px}\n#mtx-booking .mtx-detail-change{margin-top:15px;border:1.5px solid var(--blue);background:var(--surface);color:var(--blue);\n  padding:6px 11px;border-radius:7px;font-size:10.5px;font-weight:700;letter-spacing:.07em;\n  text-transform:uppercase;cursor:pointer;transition:.15s}\n#mtx-booking .mtx-detail-change:hover{background:var(--blue);color:var(--blue-ink)}\n\n/* The status badge on the chosen class is the tile's own badge: solid, white type. */\n#mtx-booking .mtx-detail .mtx-pill{padding:7px 14px;font-size:12px;font-weight:800;letter-spacing:.08em}\n#mtx-booking .mtx-detail .mtx-pill.mtx-ok{background:var(--go);color:var(--go-ink)}\n#mtx-booking .mtx-detail .mtx-pill.mtx-full{background:var(--gone);color:#FFFFFF}\n#mtx-booking .mtx-detail .mtx-pill.mtx-shut{background:var(--shut-fg);color:#FFFFFF}\n\n/* Sold out has to be the loudest thing on the panel, not a small tag beside the name.\n   Full width, on its own line, the size of the tile's own badge. */\n#mtx-booking .mtx-detail--off .mtx-pill, #mtx-booking .mtx-detail--shut .mtx-pill{flex:1 0 100%;order:5;\n  justify-content:center;min-height:56px;font-size:20px;letter-spacing:.1em;border-radius:999px}\n#mtx-booking .mtx-detail--off .mtx-pill i, #mtx-booking .mtx-detail--shut .mtx-pill i{width:9px;height:9px}\n\n@media (max-width:520px){ #mtx-booking .mtx-detail--off .mtx-pill, #mtx-booking .mtx-detail--shut .mtx-pill{font-size:15px;letter-spacing:.05em;min-height:50px;padding:7px 10px} }\n\n/* No grey bar inside a red or grey panel: the sentence sits on the panel itself. */\n#mtx-booking .mtx-detail--off .mtx-note, #mtx-booking .mtx-detail--shut .mtx-note{background:transparent;padding:0;\n  color:var(--ink);font-size:16px;font-weight:600}\n\n/* the way out to the stadium, when we are not selling the night ourselves */\n#mtx-booking .mtx-divert{border:2px solid var(--blue);border-radius:14px;padding:20px 22px;\n  background:color-mix(in srgb, var(--blue) 7%, var(--surface))}\n#mtx-booking .mtx-divert-d{font-size:15px;line-height:1.55;color:var(--ink-2);max-width:66ch;\n  margin-bottom:16px;font-weight:600}\n#mtx-booking .mtx-divert-go{display:inline-flex;align-items:center;gap:9px;min-height:44px;\n  padding:11px 24px;border-radius:9px;background:var(--blue);color:var(--blue-ink);\n  font-family:\"Barlow Condensed\";font-size:16px;font-weight:700;letter-spacing:.045em;\n  text-transform:uppercase;text-decoration:none;cursor:pointer;transition:.15s}\n#mtx-booking .mtx-divert-go:hover{background:var(--blue-on);transform:translateY(-1px);\n  box-shadow:var(--shadow-lg)}\n#mtx-booking .mtx-divert-n{margin-top:11px;font-size:12.5px;color:var(--muted);font-weight:600}\n@media (max-width:520px){ #mtx-booking .mtx-divert-go{width:100%;justify-content:center} }\n\n#mtx-booking .mtx-note{padding:12px 13px;border-radius:9px;font-size:13.5px;line-height:1.5;\n  background:var(--shut-bg);color:var(--ink-2)}\n#mtx-booking .mtx-note.mtx-warn{background:var(--lim-bg);color:var(--lim-fg)}\n#mtx-booking .mtx-note b{font-weight:700}\n#mtx-booking .mtx-ack{display:flex;gap:8px;align-items:flex-start;margin-top:9px;cursor:pointer;font-weight:600}\n#mtx-booking .mtx-ack input{width:16px;height:16px;margin:2px 0 0;flex:0 0 auto;accent-color:var(--ink)}\n\n#mtx-booking .mtx-fields{display:flex;flex-direction:column;gap:12px}\n#mtx-booking .mtx-pair{display:grid;grid-template-columns:1fr 1fr;gap:17px}\n#mtx-booking .mtx-f label{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:700;letter-spacing:.08em;\n  text-transform:uppercase;color:var(--muted);margin-bottom:5px}\n#mtx-booking .mtx-f label .mtx-num{width:17px;height:17px;font-size:10px}\n#mtx-booking .mtx-sel{position:relative}\n#mtx-booking .mtx-sel:after{content:\"\";position:absolute;right:13px;top:50%;width:7px;height:7px;\n  border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);\n  transform:translateY(-70%) rotate(45deg);pointer-events:none}\n/* one border rule for every state, so no select ever looks different from its neighbour */\n#mtx-booking .mtx-sel select{width:100%;min-height:46px;padding:9px 34px 9px 12px;border:1.5px solid var(--line);\n  border-radius:10px;background:var(--surface);color:var(--ink);font-size:15px;font-weight:600;\n  appearance:none;-webkit-appearance:none;cursor:pointer;transition:.15s;outline:none}\n#mtx-booking .mtx-sel select:hover:not(:disabled){border-color:var(--ink-2)}\n#mtx-booking .mtx-sel select:focus-visible{border-color:var(--c,var(--blue));box-shadow:0 0 0 3px color-mix(in srgb, var(--c,var(--blue)) 22%, transparent)}\n#mtx-booking .mtx-sel select:disabled{opacity:.55;cursor:not-allowed;background:var(--surface-2)}\n\n#mtx-booking .mtx-sums{border:1px solid var(--line-2);border-radius:10px;background:var(--surface-2);overflow:hidden}\n#mtx-booking .mtx-sum{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 14px}\n#mtx-booking .mtx-sum span{font-size:12px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}\n#mtx-booking .mtx-sum b{font-family:\"Barlow Condensed\";font-size:20px;font-weight:700;\n  font-variant-numeric:tabular-nums;line-height:1}\n#mtx-booking .mtx-sum--total{border-top:1px solid var(--line-2);background:var(--surface)}\n#mtx-booking .mtx-sum--total b{font-size:26px;font-weight:800}\n\n/* sized to the words, not the panel \u2014 full width only where the panel is narrow */\n#mtx-booking .mtx-go{min-height:44px;padding:11px 26px;border:0;border-radius:9px;background:var(--ink);\n  color:#FFFFFF;font-family:\"Barlow Condensed\";font-size:15px;font-weight:700;\n  letter-spacing:.05em;text-transform:uppercase;cursor:pointer;transition:.15s;\n  align-self:flex-start;text-align:center}\n#mtx-booking .mtx-go:hover:not(:disabled){transform:translateY(-1px);box-shadow:var(--shadow-lg)}\n/* waiting, not broken: an outline that reads as \"one more thing to do\" */\n#mtx-booking .mtx-go:disabled{background:transparent;color:var(--muted);border:1.5px dashed var(--line);\n  cursor:not-allowed;transform:none;box-shadow:none}\n\n/* ---------- alignment, stated rather than inherited ----------\n   Setting text-align on the widget root is not enough. A host rule such as\n   `#allrecords *{text-align:center}` matches each element directly, and a\n   direct match beats an inherited value however specific the ancestor rule is.\n   The live page centred every description that way.\n\n   So every element inside the card is told explicitly, at a specificity an id\n   plus a class cannot lose to, and the handful that genuinely centre are told\n   back again one level higher. */\n#mtx-booking,\n#mtx-booking .mtx-card,\n#mtx-booking .mtx-card *{text-align:left}\n\n#mtx-booking .mtx-card .mtx-dow span,\n#mtx-booking .mtx-card .mtx-day,\n#mtx-booking .mtx-card .mtx-load,\n#mtx-booking .mtx-card .mtx-state,\n#mtx-booking .mtx-card button{text-align:center}\n@media (max-width:640px){ #mtx-booking .mtx-go{width:100%;align-self:stretch} }\n\n@media (max-width:560px){ #mtx-booking .mtx-picker{grid-template-columns:1fr} }\n@media (max-width:520px){ #mtx-booking .mtx-pair{grid-template-columns:1fr} }\n\n/* footer strip */\n#mtx-booking .mtx-foot{padding:16px 26px 22px;border-top:1px solid var(--line-2);background:var(--surface-2);\n  display:flex;flex-wrap:wrap;gap:8px 22px;font-size:12px;color:var(--muted);font-weight:600}\n#mtx-booking .mtx-foot span{display:inline-flex;align-items:center;gap:6px}\n\n@media (max-width:720px){\n  #mtx-booking .mtx-mast, #mtx-booking .mtx-cal, #mtx-booking .mtx-tix, #mtx-booking .mtx-foot{padding-left:16px;padding-right:16px}\n  #mtx-booking .mtx-band{margin-left:16px;margin-right:16px;padding:18px 16px}\n  #mtx-booking .mtx-detail{padding:18px 16px}\n  #mtx-booking .mtx-day .mtx-tag{display:none}\n  #mtx-booking .mtx-day{min-height:54px}\n  #mtx-booking .mtx-months{grid-template-columns:repeat(2,1fr)}\n}\n\n/* ---------- states the prototype never had ---------- */\n/* The prototype always had its data. A live widget has to say so when it does\n   not, and give the guest a way to try again rather than a blank rectangle. */\n#mtx-booking .mtx-state{padding:56px 26px;text-align:center;color:var(--ink-2)}\n#mtx-booking .mtx-state h3{font-size:22px;font-weight:700;margin-bottom:8px}\n#mtx-booking .mtx-state p{font-size:15px;color:var(--muted);max-width:46ch;margin:0 auto}\n#mtx-booking .mtx-retry{margin-top:18px;min-height:44px;padding:11px 26px;border:0;border-radius:9px;\n  background:var(--blue);color:var(--blue-ink);font-family:\"Barlow Condensed\";font-size:15px;\n  font-weight:700;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;transition:.15s}\n#mtx-booking .mtx-retry:hover{background:var(--blue-on)}\n/* Errors raised at the point of paying belong beside the button, not in an\n   alert box the guest has to dismiss before they can see what went wrong. */\n#mtx-booking .mtx-fail{margin-top:12px;padding:12px 13px;border-radius:9px;font-size:13.5px;line-height:1.5;\n  background:var(--full-bg);color:var(--full-fg);font-weight:600}\n\n/* Cards in a row are the same height and their buttons line up: the button is pinned to the\n   foot of the card, so a card with a longer list leaves its space above the button. A closed\n   card stays its own height and is not stretched. */\n#mtx-booking .mtx-picker--photos{align-items:stretch}\n#mtx-booking .mtx-picker--photos .mtx-pick{height:100%}\n#mtx-booking .mtx-seatcard-body{flex:1 1 auto}\n#mtx-booking .mtx-seatcard-go{margin-top:auto}\n#mtx-booking .mtx-why-list{margin-bottom:18px}\n#mtx-booking .mtx-seatcard--closed{align-self:start;border-color:var(--gone);background:var(--full-bg)}\n#mtx-booking .mtx-closed-btn{display:flex;align-items:center;justify-content:center;align-self:stretch;min-height:48px;\n  padding:10px 16px;border:0;border-radius:999px;background:var(--shut-fg);color:#FFFFFF;font-size:13px;font-weight:800;\n  letter-spacing:.08em;text-transform:uppercase;cursor:not-allowed}\n#mtx-booking .mtx-seatcard--closed .mtx-seatcard-go--up{margin-top:10px}\n\n/* 5 October 2026, Jason: hold the guest by the hand. The card's button says what it does, the way\n   back is easy to hit, and the button that takes the money is green while it can be pressed. */\n#mtx-booking .mtx-seatcard-go{gap:6px 14px;flex-wrap:wrap}\n#mtx-booking .mtx-pick-note{display:block;margin:9px 0 12px;font-size:13.5px;font-weight:500;line-height:1.45;color:var(--ink-2)}\n#mtx-booking .mtx-go-sep{display:block;width:1px;height:18px;background:currentColor;opacity:.6}\n@media (max-width:440px){ #mtx-booking .mtx-go-sep{display:none} }\n#mtx-booking .mtx-detail-change{min-height:50px;padding:13px 26px;border-width:2px;border-radius:10px;\n  font-size:15px;letter-spacing:.06em}\n@media (max-width:640px){ #mtx-booking .mtx-detail-change{width:100%} }\n#mtx-booking .mtx-go{background:var(--go);color:var(--go-ink);font-size:19px;min-height:54px;padding:12px 32px;\n  border-radius:10px}\n#mtx-booking .mtx-go:hover:not(:disabled){background:#00914A}\n\n/* The hidden attribute loses to any display rule of the same weight, and several\n   blocks above set one. That left the empty seat note drawn as a blue bar. Last,\n   so nothing above can outrank it. */\n#mtx-booking [hidden]{display:none}\n";

/* ---------------------------------------------------------------------------
   Which advert paid for this booking
   -------------------------------------------------------------------------*/
// Google Ads can tell us a campaign produced seven conversions. It cannot tell
// us that two of them were Club Class at £41 and the rest were Third Class, and
// that is the only version of the number worth acting on. So the click is
// caught here, carried to checkout, and stored beside the ticket.
//
// This runs on every page of the site, not only pages with a widget on them: a
// guest lands on the home page from an advert, reads for a while, and books
// three pages later. The header block is site-wide, so the capture is too.
//
// Two different things are collected and both matter:
//
//   the click id  gclid, or gbraid / wbraid on iOS app traffic. Opaque to us.
//                 It is what lets Google reconcile the conversion.
//
//   the utm_*     Filled by Google's ValueTrack macros in the final URL suffix.
//                 This is what puts the campaign, ad group and keyword in OUR
//                 database, joinable to ticket class and margin in plain SQL.
//                 The click id alone cannot do that.
var ATTR_KEY = "mtx_attr";
var ATTR_DAYS = 90;              // Google's own click window
var CLICK_KINDS = ["gclid", "gbraid", "wbraid"];

// A hook, not a decision. Storing a click id for a guest in the EU or the UK
// needs their consent, and the site has no banner today. Rather than guess, the
// capture asks this one function, which anything can later be wired to. It is
// deliberately permissive for now so behaviour does not change under anyone's
// feet -- flipping it to a real check is a one-line edit here.
function mayStoreAttribution() {
  try {
    if (typeof window.mtxAttributionConsent === "function") {
      return window.mtxAttributionConsent() === true;
    }
    if (window.mtxAttributionConsent === false) return false;
  } catch (e) {}
  return true;
}

// What the guest is booking on, from the browser's own description of itself.
// An iPad asks for the desktop site and says Macintosh, so touch points are what
// give it away. Anything that does not say phone or tablet is a computer.
function deviceNow() {
  try {
    var ua = String(navigator.userAgent || "");
    if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) return "t";
    if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return "t";
    if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return "t";
    if (/Mobi|iPhone|iPod|Android/i.test(ua)) return "m";
  } catch (e) {}
  return "d";
}

function readStoredAttribution() {
  try {
    var raw = window.localStorage.getItem(ATTR_KEY);
    if (!raw) return null;
    var held = JSON.parse(raw);
    if (!held || !held.at) return null;
    var age = Date.now() - Date.parse(held.at);
    if (!(age >= 0) || age > ATTR_DAYS * 86400000) return null;   // let it lapse
    return held;
  } catch (e) {
    return null;                 // private window, blocked storage, bad JSON
  }
}

function captureAttribution() {
  var params;
  try { params = new URLSearchParams(window.location.search); }
  catch (e) { return; }

  var kind = null, id = null;
  for (var i = 0; i < CLICK_KINDS.length; i++) {
    var v = (params.get(CLICK_KINDS[i]) || "").trim();
    if (v) { kind = CLICK_KINDS[i]; id = v.slice(0, 512); break; }
  }

  function p(name) { return (params.get(name) || "").trim().slice(0, 255) || null; }
  var utm = {
    source:   p("utm_source"),
    medium:   p("utm_medium"),
    campaign: p("utm_campaign"),
    term:     p("utm_term"),
    content:  p("utm_content"),
    adGroupId: p("mt_adgroup"),
    matchType: p("mt_match"),
    device:    p("mt_device")
  };

  var anythingNew = id || utm.source || utm.medium || utm.campaign;
  if (!anythingNew) return;      // an ordinary page view tells us nothing

  // First click wins. A guest who arrives on an advert, wanders the site and
  // comes back through a Google search two days later was won by the advert;
  // overwriting would quietly hand the credit to the cheaper channel. Only a
  // lapsed record is replaced.
  if (readStoredAttribution()) return;
  if (!mayStoreAttribution()) return;

  try {
    window.localStorage.setItem(ATTR_KEY, JSON.stringify({
      clickId: id, clickIdKind: kind,
      source: utm.source, medium: utm.medium, campaign: utm.campaign,
      term: utm.term, content: utm.content,
      adGroupId: utm.adGroupId, matchType: utm.matchType, device: utm.device,
      at: new Date().toISOString()
    }));
  } catch (e) {}               // storage full or refused: sell the ticket anyway
}

// Immediately, not on DOMContentLoaded. A guest who taps through before the
// document finishes would otherwise be lost.
captureAttribution();

// ---------------------------------------------------------------------------
// Which page they came in on, and which page they book from.
//
// GA4 cannot answer either. Its conversion fires on the thank-you page, so every
// booking looks as though it happened there; and a guest returning from Stripe
// starts a fresh GA4 session, which throws away the entry page for roughly one
// booking in six. Neither is a problem if we simply write it down ourselves --
// and unlike a conversion tag, this also records the page an ABANDONED checkout
// came from, which is the half worth reading.
var PAGE_KEY = "mtx_landing";

// Path only. The query string is dropped before anything is stored or sent: it
// is where an email address or a name ends up when a link gets shared, and none
// of that belongs in a funnel report.
function pathNow() {
  try {
    return (window.location.pathname || "/").slice(0, 255);
  } catch (e) {
    return null;
  }
}

// sessionStorage, not localStorage: "where this visit started" should end when
// the visit does. A guest who comes back next week has landed somewhere new.
function rememberLanding() {
  try {
    if (!window.sessionStorage.getItem(PAGE_KEY)) {
      window.sessionStorage.setItem(PAGE_KEY, pathNow() || "/");
    }
  } catch (e) {}              // private window or blocked storage: sell the ticket anyway
}

function readLanding() {
  try {
    return window.sessionStorage.getItem(PAGE_KEY) || null;
  } catch (e) {
    return null;
  }
}

// Same reasoning as the capture above, and on every page of the site, not only
// the ones with a widget: the entry page is usually not the booking page.
rememberLanding();

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  var link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=Barlow:wght@400;500;600;700&display=swap";
  document.head.appendChild(link);
  var style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

// Every icon is the same line drawing on a 16 by 16 grid. Only the size, the
// line weight, the shapes and sometimes a class differ, so they are written once.
function svg(size, weight, shapes, cls){
  return '<svg' + (cls ? ' class="' + cls + '"' : '') + ' width="' + size + '" height="' + size +
    '" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="' + weight +
    '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + shapes + '</svg>';
}

// The masthead is dropped on a single-night page: the fight night is named in
// the panel immediately below it, and saying the venue twice wastes the screen.
function shell(opts) {
  return '<div class="mtx-stage"><div class="mtx-card">' +
    (opts.eventKey ? "" :
      '<div class="mtx-mast">' +
        '<span class="mtx-mast-lead">Book Tickets for</span>' +
        '<span class="mtx-mast-venue">Rajadamnern Stadium</span>' +
        '<span class="mtx-mast-city">Bangkok</span>' +
      '</div>') +
    '<section class="mtx-cal" data-cal hidden>' +
      '<div class="mtx-sec-label"><span class="mtx-num" data-step-month>1</span>Select your month</div>' +
      '<div class="mtx-months" data-months></div>' +
      '<div class="mtx-sec-label mtx-gap"><span class="mtx-num" data-step-date>2</span>Choose your date</div>' +
      '<p class="mtx-seat-note" data-seatnote hidden></p>' +
      '<p class="mtx-month-note">' +
        svg(20, 1.5, '<rect x="2" y="3" width="12" height="11" rx="2"/><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3"/>') +
        '<span>You are choosing dates for <b data-monthnote></b></span>' +
      '</p>' +
      '<div class="mtx-dow"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>' +
      '<div class="mtx-grid" data-grid></div>' +
    '</section>' +
    '<div data-out></div>' +
    '<div class="mtx-foot"><span>' +
      svg(15, 1.5, '<rect x="3" y="7" width="10" height="7" rx="1.8"/><path d="M5.4 7V5a2.6 2.6 0 0 1 5.2 0v2"/>') +
      'Your payment details are encrypted and protected by Stripe\u2019s enterprise-level security' +
    '</span></div>' +
    '</div></div>';
}

// Warming the checkout is a page-wide job, not a per-widget one.
var warmed = false;
var historyIds = 0;

/* ---------------------------------------------------------------------------
   One widget
   -------------------------------------------------------------------------*/
function mount(root, opts) {
  /* ---------------------------------------------------------------------------
     State
     -------------------------------------------------------------------------*/
  var state = {
    events: {},      // "2026-09-05" -> event summary from the calendar call
    months: [],      // ["2026-09", ...] in order, built from the events themselves
    month: null,
    night: null,     // the availability response for the chosen date
    date: null,
    cls: null,
    offer: null,     // the fully booked class whose Club Class offer was taken up
    qty: 0,
    cur: null,
    busy: false,
    // Seat-first mode only: the class chosen before any date was picked, and
    // the catalogue it was chosen from.
    picked: null,
    catalogue: null
  };

  // The browser's back button. Each forward step the guest takes (a seat class
  // in seat-first mode, a night, a seat class) adds one entry to the browser's
  // history and one way of undoing it, and back undoes the last one. Without
  // this, back leaves the page altogether and the guest loses their place; the
  // on-page "Change ..." buttons go through the same history so the two can
  // never disagree about where the guest is.
  var hist = { id: ++historyIds, stack: [] };
  function pushStep(kind, undo){
    try { history.pushState({ mtx: hist.id, d: hist.stack.length + 1 }, ""); }
    catch(e){ return; }                     // no history to use: the on-page buttons still work
    hist.stack.push({ kind: kind, undo: undo });
  }
  function goBack(kind, undo){
    var top = hist.stack[hist.stack.length - 1];
    if(top && top.kind === kind){
      var depth = hist.stack.length;
      try { history.back(); } catch(e){ undo(); hist.stack.pop(); return; }
      // If the browser never answers, do it by hand rather than leave a dead button.
      setTimeout(function(){
        if(hist.stack.length === depth){ hist.stack.pop(); undo(); }
      }, 500);
      return;
    }
    undo();
  }
  window.addEventListener("popstate", function(e){
    var target = (e.state && e.state.mtx === hist.id) ? e.state.d : 0;
    // The browser has moved us to an entry that claims we are deeper than we are:
    // a leftover from before a reload, or the forward button. Step back off it.
    if(target > hist.stack.length){ try { history.back(); } catch(err){} return; }
    while(hist.stack.length > target) hist.stack.pop().undo();
  });

  var cal    = root.querySelector("[data-cal]");
  var months = root.querySelector("[data-months]");
  var grid   = root.querySelector("[data-grid]");
  var note   = root.querySelector("[data-monthnote]");
  var out    = root.querySelector("[data-out]");
  var seatNote  = root.querySelector("[data-seatnote]");
  var stepMonth = root.querySelector("[data-step-month]");
  var stepDate  = root.querySelector("[data-step-date]");

  /* ---------------------------------------------------------------------------
     Helpers
     -------------------------------------------------------------------------*/
  // Every scroll in the widget is the same smooth move, to the top or the nearest edge.
  function glide(el, block){ el.scrollIntoView({behavior:"smooth", block:block}); }

  function esc(s){
    return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }

  // Today in Bangkok, not on the guest's phone. Someone booking from Los Angeles
  // at 9pm is already on tomorrow's date at the stadium.
  function todayAtVenue(){
    var p = new Intl.DateTimeFormat("en-CA", {
      timeZone:"Asia/Bangkok", year:"numeric", month:"2-digit", day:"2-digit"
    }).format(new Date());
    return p;   // en-CA formats as YYYY-MM-DD
  }

  function addMonths(iso, n){
    var y = +iso.slice(0,4), m = +iso.slice(5,7) - 1 + n;
    var d = new Date(Date.UTC(y + Math.floor(m/12), ((m%12)+12)%12 + 1, 0));
    return d.toISOString().slice(0,10);
  }

  function parts(iso){ return {y:+iso.slice(0,4), m:+iso.slice(5,7)-1, d:+iso.slice(8,10)}; }
  function monthKey(iso){ return iso.slice(0,7); }

  function longDate(iso){
    var p = parts(iso);
    var dow = DAYS[new Date(Date.UTC(p.y, p.m, p.d)).getUTCDay()];
    return dow + " " + p.d + " " + MONTHS[p.m] + " " + p.y;
  }

  // "19:00" -> "7pm", "19:10" -> "7:10pm"
  function fmt12(t){
    if(!t) return "";
    var h = +t.slice(0,2), mm = t.slice(3,5);
    return (h % 12 || 12) + (mm === "00" ? "" : ":" + mm) + (h >= 12 ? "pm" : "am");
  }

  // Currencies are data, so nothing here lists them. Intl knows the symbols, and
  // the trailing .00 is dropped only when the amount is genuinely round.
  function money(cur, minor){
    var value = minor / 100;
    try {
      return new Intl.NumberFormat("en-GB", {
        style:"currency", currency:cur.toUpperCase(), currencyDisplay:"narrowSymbol",
        minimumFractionDigits: (minor % 100 === 0) ? 0 : 2, maximumFractionDigits: 2
      }).format(value);
    } catch(e) {
      return cur.toUpperCase() + " " + value.toFixed(2);
    }
  }

  function icon(k){
    var d = k === "cal"   ? '<rect x="2" y="3" width="12" height="11" rx="2"/><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3"/>'
          : k === "clock" ? '<circle cx="8" cy="8" r="6.2"/><path d="M8 4.6V8l2.4 1.4"/>'
          : '<path d="M8 14.5s5-4.2 5-8a5 5 0 0 0-10 0c0 3.8 5 8 5 8Z"/><circle cx="8" cy="6.4" r="1.8"/>';
    return svg(14, 1.5, d);
  }

  // Five statuses come back from the database. `closed` and `booking_closed` look
  // alike and mean opposite things: one may open later tonight, the other never
  // will. They are kept apart here for exactly that reason.
  // What the guest is told about a class, in one place.
  //
  // "Limited" is gone. It fired on anything with 19 seats or fewer, which was
  // very nearly every class on every night, so it stopped carrying information
  // -- and it is a word a lot of our guests do not read as "you can buy this".
  // Anything on sale now says AVAILABLE in green. Only when the server tells us
  // it is down to the last few does a number replace it, and the server only
  // ever sends that number when it is small enough to say out loud.
  // Which currency to show a guest before they have chosen one.
  //
  // A price in Thai baht on the page is the single strongest push towards
  // paying in Thai baht, and every baht payment costs us FX on a margin that is
  // already thin. Only about three in a hundred of our guests are Thai. So baht
  // is shown to a device actually set to Thailand and to nobody else; anywhere
  // we do not price in falls back to US dollars, never to baht.
  var CURRENCY_BY_REGION = {
    TH:"thb",
    GB:"gbp", IE:"gbp",
    US:"usd", CA:"usd",
    AU:"aud", NZ:"aud",
    CN:"cny", HK:"cny", TW:"cny", SG:"cny", MO:"cny",
    DE:"eur", FR:"eur", ES:"eur", IT:"eur", NL:"eur", BE:"eur", AT:"eur",
    PT:"eur", IE_EU:"eur", FI:"eur", GR:"eur", SK:"eur", SI:"eur", LT:"eur",
    LV:"eur", EE:"eur", LU:"eur", MT:"eur", CY:"eur", HR:"eur"
  };

  function regionOfGuest(){
    try {
      var loc = Intl.Locale && navigator.language ? new Intl.Locale(navigator.language) : null;
      var r = loc && (loc.region || (loc.maximize && loc.maximize().region));
      if(r) return String(r).toUpperCase();
    } catch(e) {}
    var tag = String(navigator.language || "");
    var m = tag.match(/[-_]([A-Za-z]{2})\b/);
    return m ? m[1].toUpperCase() : "";
  }

  function guessCurrency(prices){
    var have = {};
    (prices || []).forEach(function(p){ have[p.currency] = true; });
    var want = CURRENCY_BY_REGION[regionOfGuest()];
    if(want && have[want]) return want;
    if(have.usd) return "usd";               // the fallback is dollars, not baht
    for(var i = 0; i < (prices || []).length; i++){
      if(prices[i].currency !== "thb") return prices[i].currency;
    }
    return prices && prices[0] ? prices[0].currency : null;
  }

  // Two class names, because the tile and the panel behind it are different
  // shapes: `tile` styles the block on the seat grid, `pill` the small badge on
  // the chosen-class panel. Both are prefixed mtx-avail-- so they cannot collide
  // with mtx-state (the "no fight nights" panel) or mtx-go (the reserve button),
  // which is exactly what happened the first time round.
  //
  // Nothing a guest can still buy is red. "Only 3 left" is green like anything
  // else on sale -- the words do the hurrying, and red on a class with seats in
  // it reads as "gone" and costs us the click. Red belongs to fully booked alone. Never say "sold out" to a guest: it sends them to other sites (Jason, 5 Oct 2026).
  function statusMeta(st, seatsLeft){
    if(st === "available" || st === "limited"){
      return (seatsLeft > 0)
        ? {tile:"mtx-avail--go", pill:"mtx-ok", label:"Only " + seatsLeft + " left", low:true, seatsLeft:seatsLeft, live:true}
        : {tile:"mtx-avail--go", pill:"mtx-ok", label:"Available",                   low:false,                    live:true};
    }
    if(st === "fully_booked")   return {tile:"mtx-avail--full", pill:"mtx-full", label:"Fully booked",   live:false};
    if(st === "booking_closed") return {tile:"mtx-avail--shut", pill:"mtx-shut", label:"Booking closed", live:false};
    return {tile:"mtx-avail--shut", pill:"mtx-shut", label:"Closed", live:false};
  }

  /* ---------------------------------------------------------------------------
     Talking to the server
     -------------------------------------------------------------------------*/
  // Every call is bounded. A request left hanging is the one failure a guest
  // cannot recover from on their own, because nothing on screen ever changes.
  function call(fn, payload, timeout){
    var ctrl = new AbortController();
    var timer = setTimeout(function(){ ctrl.abort(); }, timeout);

    return fetch(API + "/" + fn, {
      method: "POST",
      // Deliberately text/plain, not application/json. application/json is not a
      // CORS-safelisted content type, so the browser sends a separate OPTIONS
      // request first and waits for the answer before sending anything real. On a
      // cold function that preflight was measured at 3.6 seconds — the guest paid
      // the whole boot twice over, once to ask permission and once to be served.
      // text/plain skips the preflight entirely. The body is still JSON, and the
      // server reads it with req.json(), which does not care what the header says.
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    }).then(function(res){
      clearTimeout(timer);
      return res.json().catch(function(){ return {}; }).then(function(body){
        if(!res.ok){
          var err = new Error(body.error || "Something went wrong. Please try again.");
          err.status = res.status;
          err.body = body;
          throw err;
        }
        return body;
      });
    }, function(err){
      clearTimeout(timer);
      var e = new Error(err && err.name === "AbortError"
        ? "That took longer than expected. Please check your connection and try again."
        : "We could not reach the booking system. Please try again.");
      e.status = 0;
      throw e;
    });
  }

  /* ---------------------------------------------------------------------------
     Panels
     -------------------------------------------------------------------------*/
  function panel(html){ out.innerHTML = html; }

  // `tall` is for the panels the page scrolls to, and only those. See
  // .mtx-load--tall.
  function showLoading(message, tall){
    panel('<div class="mtx-load' + (tall ? " mtx-load--tall" : "") + '">' +
      '<div class="mtx-spin"></div>' + esc(message) + '&hellip;</div>');
  }

  function showProblem(title, message, retryLabel){
    panel(
      '<div class="mtx-state">' +
        '<h3>' + esc(title) + '</h3>' +
        '<p>' + esc(message) + '</p>' +
        '<button class="mtx-retry" data-retry>' + esc(retryLabel || "Try again") + '</button>' +
      '</div>'
    );
  }

  /* ---------------------------------------------------------------------------
     1 and 2 — months and the calendar
     -------------------------------------------------------------------------*/
  function boot(){
    // Pointed at one night, the calendar is skipped entirely: no month buttons,
    // no grid, straight to that night's seats. This is what a page built around
    // a single fight uses.
    if(opts.eventKey){
      cal.hidden = true;
      state.events[""] = { eventKey: opts.eventKey };
      // Never move the page on the way in. A day-dated widget opens its night
      // the moment it loads, and openNight scrolls to itself — which is right
      // when a guest picks a date and wrong when nobody asked. A page carrying
      // three of these scrolled the guest to the last one before they had read
      // a word of it.
      openNight("", false);
      return;
    }
    // Seat first. Nothing about a date is asked, or loaded, until the guest has
    // said where they want to sit.
    if(opts.seatsFirst && !state.picked){ loadSeatClasses(); return; }
    loadNights();
  }

  /* ---- seat-first, step 1: which seat ---- */
  function loadSeatClasses(){
    cal.hidden = true;
    showLoading("Loading seat classes");

    var from = todayAtVenue();
    call("availability", { action:"classes", from:from, to:addMonths(from, MONTHS_AHEAD) }, READ_TIMEOUT)
      .then(function(data){
        var list = (data.classes || []);
        if(list.length === 0){
          showProblem("No seats on sale",
            "There are no seat classes open for booking at the moment. Please check back shortly, or message us and we will help.",
            "Check again");
          return;
        }
        state.catalogue = list;
        renderSeatClasses();
      })
      .catch(function(err){
        showProblem("We could not load the seat classes", err.message, "Try again");
      });
  }

  function renderSeatClasses(){
    panel(
      '<section class="mtx-tix">' +
        '<div class="mtx-tix-h"><h3><span class="mtx-num">1</span>Select your seat class</h3></div>' +
        '<div class="mtx-picker">' + state.catalogue.map(function(c){
          // A class open on no night at all is still shown, and still says so.
          // Removing it would leave a guest wondering where Third Class went.
          var off = c.nightsOnSale === 0;
          // It used to count the nights: "Ringside, 97 nights". A guest
          // choosing a seat class has not picked a date yet and does not care
          // how many of the next eighteen months carry it -- the number told
          // them nothing and read like stock control. Either it can be booked
          // or it cannot.
          return '<button class="mtx-pick' + (off ? " mtx-pick--off" : "") + '" data-seat="' + esc(c.code) + '" ' +
                 'style="--c:' + esc(c.colour || "#5C5C66") + ';--ci:' + esc(c.ink || "#2E2E34") + '">' +
                 '<span class="mtx-pick-bar"></span>' +
                 (c.tagline ? '<span class="mtx-pick-why">' + esc(c.tagline) + '</span>' : "") +
                 '<span class="mtx-pick-name">' + esc(c.name) + '</span>' +
                 '<span class="mtx-pill ' + (off ? "mtx-shut" : "mtx-ok") + '"><i></i>' +
                   (off ? "Not currently on sale" : "Available") +
                 '</span></button>';
        }).join("") + '</div>' +
      '</section>'
    );
  }

  /* ---- seat-first, step 2 onwards: the calendar for that seat ---- */
  function chooseSeat(code){
    state.picked = code;
    // The calendar is now steps 2 and 3, because the seat took step 1.
    if(stepMonth) stepMonth.textContent = "2";
    if(stepDate)  stepDate.textContent  = "3";
    warmCheckout();
    loadNights();
  }

  function backToClassList(){
    state.cls = null; state.qty = 0; state.offer = null;
    out.querySelector(".mtx-tix").innerHTML = seatStep();
    glide(out.querySelector(".mtx-tix"), "nearest");
  }

  function backToSeats(){
    state.picked = null; state.offer = null;
    state.date = null; state.night = null; state.cls = null; state.qty = 0; state.cur = null;
    state.events = {}; state.months = []; state.month = null;
    if(stepMonth) stepMonth.textContent = "1";
    if(stepDate)  stepDate.textContent  = "2";
    if(seatNote) seatNote.hidden = true;
    cal.hidden = true;
    renderSeatClasses();
    glide(out, "start");
  }

  function pickedClass(){
    var list = state.catalogue || [];
    for(var i = 0; i < list.length; i++) if(list[i].code === state.picked) return list[i];
    return null;
  }

  function loadNights(){
    cal.hidden = true;
    showLoading("Loading fight nights");

    var from = todayAtVenue();
    var ask = { action:"events", from:from, to:addMonths(from, MONTHS_AHEAD) };
    // Asking by class means the calendar knows, before the guest clicks, which
    // nights their seat is actually on sale for.
    if(state.picked) ask.classCode = state.picked;

    call("availability", ask, READ_TIMEOUT)
      .then(function(data){
        state.events = {};
        state.months = [];
        var firstHighlighted = null;
        (data.events || []).forEach(function(ev){
          // On a promotion page only that promotion can be booked. A month of
          // 31 dates with five of them ours is 26 chances to buy the wrong
          // ticket, and wrong tickets were going up. The other nights stay on
          // the calendar, scored through and unclickable, still carrying the
          // name of whatever is on that night: the calendar must never claim
          // there is no fight on a night that has one. A link under the widget
          // takes a guest who wants a different night to the all-tickets page.
          ev.highlighted = !opts.series
            || opts.series.indexOf(String(ev.series || "").toLowerCase()) !== -1;
          ev.bookable = ev.highlighted;
          // Seat-first only. `classStatus` is null on every night when no seat
          // was asked for, which leaves every night live — the ordinary case.
          ev.seatLive = !state.picked
            || ev.classStatus === "available" || ev.classStatus === "limited";
          if(ev.highlighted && ev.seatLive && !firstHighlighted) firstHighlighted = ev.date;
          state.events[ev.date] = ev;
          // A month is only offered when something on it can actually be
          // booked here, so a promotion page never opens on a month whose
          // every date is scored out.
          var k = monthKey(ev.date);
          if(ev.bookable && state.months.indexOf(k) === -1) state.months.push(k);
        });
        state.months.sort();

        // Nothing this page can sell. On a promotion page that means this
        // promotion has no nights left on sale, which is a different sentence
        // from the whole calendar being empty, and the page's own link to the
        // all-tickets page is what a guest needs next.
        if(state.months.length === 0){
          showProblem(opts.series ? "No dates on sale for this event" : "No fight nights on sale",
            opts.series
              ? "There are no dates open for booking on this page at the moment. Every Rajadamnern Stadium ticket we sell is on the all-tickets page, or message us and we will help."
              : "There are no dates open for booking at the moment. Please check back shortly, or message us and we will help.",
            "Check again");
          return;
        }

        // Open on the month holding this promotion's next night, so an RWS page
        // lands on the month with the next RWS Saturday in it.
        state.month = (firstHighlighted && state.months.indexOf(monthKey(firstHighlighted)) !== -1)
          ? monthKey(firstHighlighted)
          : state.months[0];
        panel("");
        cal.hidden = false;
        renderSeatNote();
        renderMonths();
        renderCal();
      })
      .catch(function(err){
        // The first load failing used to leave the widget blank for good. It now
        // says what happened and offers the guest a second attempt.
        showProblem("We could not load the fight nights", err.message, "Try again");
      });
  }

  function seatName(){
    var c = pickedClass();
    return c ? c.name : "That seat class";
  }

  // Sits above the calendar once a seat class is chosen: what the guest is
  // booking, what it is, and how to change it.
  //
  // The description is the class's own selling copy, from ticket_classes, so
  // it is the same wording as everywhere else on the site and changing it is
  // a database edit rather than a release.
  //
  // It used to read "Dimmed nights are sold out for this seat - you can still
  // open them and choose another", which described the widget's own rendering
  // to a guest who has no idea what "dimmed" means, called a seat class a
  // "seat", and never said what "another" was. It names the class and says
  // what happens if you open one now.
  function renderSeatNote(){
    if(!seatNote) return;
    if(!state.picked){ seatNote.hidden = true; return; }
    var gone = 0, total = 0;
    for(var k in state.events){
      if(!Object.prototype.hasOwnProperty.call(state.events, k)) continue;
      total++;
      if(!state.events[k].seatLive) gone++;
    }
    var cls = pickedClass();
    var name = seatName();
    seatNote.hidden = false;
    seatNote.innerHTML =
      '<span class="mtx-seat-note-k">Booking</span>' +
      '<b>' + esc(name) + '</b>' +
      (cls && cls.description
        ? '<span class="mtx-seat-note-d">' + esc(cls.description) + '</span>'
        : "") +
      (gone > 0 && gone < total
        ? '<span class="mtx-seat-note-d mtx-seat-note-sold">Faded dates are nights when ' +
          esc(name) + ' is fully booked. Open one and you can choose a different seat class for that night.</span>'
        : "") +
      '<button class="mtx-seat-change" data-back-seat>Change seat class</button>';
  }

  function renderMonths(){
    months.innerHTML = state.months.map(function(k){
      var m = +k.slice(5,7) - 1, y = k.slice(0,4);
      var on = (k === state.month);
      return '<button class="mtx-mbtn' + (on ? " mtx-on" : "") + '" data-month="' + k + '"' +
             (on ? ' aria-current="true"' : '') + '>' + MONTHS_S[m] + ' ' + y + '</button>';
    }).join("");
  }

  function renderCal(){
    // There is no calendar in single-night mode, so there is nothing to draw.
    if(!state.month) return;
    var y = +state.month.slice(0,4), m = +state.month.slice(5,7) - 1;
    note.textContent = MONTHS[m].toUpperCase() + " " + y;

    var lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;   // week starts Monday
    var days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    var html = "";
    for(var i = 0; i < lead; i++) html += '<button class="mtx-day mtx-none" disabled></button>';

    for(var d = 1; d <= days; d++){
      var key = state.month + "-" + String(d).padStart(2, "0");
      var ev = state.events[key];
      if(!ev){
        html += '<button class="mtx-day mtx-shut" disabled title="No fight this night">' +
                '<span class="mtx-n">' + d + '</span><span class="mtx-tag">No fight</span></button>';
        continue;
      }
      // A night that belongs to another promotion. It is scored through and
      // cannot be clicked, but it keeps that promotion's name: a struck-out
      // date with no label reads as "no fight", and there is one.
      if(ev.bookable === false){
        html += '<button class="mtx-day mtx-shut mtx-elsewhere" disabled ' +
                'aria-label="' + esc(ev.name + ", " + longDate(key) +
                  " \u2014 not on sale on this page") + '">' +
                '<span class="mtx-n">' + d + '</span>' +
                '<span class="mtx-tag">' + esc(ev.shortName || "") + '</span></button>';
        continue;
      }
      // A night where the chosen seat is gone is dimmed, never removed and never
      // disabled: the guest can still open it and take a different seat, which
      // is a sale we would otherwise throw away.
      var seatGone = state.picked && !ev.seatLive;
      var seatWord = ev.classStatus === "fully_booked" ? "fully booked"
                   : ev.classStatus === "booking_closed" ? "booking closed" : "not on sale";
      html += '<button class="mtx-day' + (state.date === key ? " mtx-sel" : "") +
              (ev.highlighted ? " mtx-hi" : "") + (opts.series ? " mtx-open" : "") +
              (seatGone ? " mtx-off" : "") + '" data-date="' + key + '" ' +
              'style="--evt:' + esc(ev.colour || "#5C5C66") + '" ' +
              'aria-label="' + esc(ev.name + ", " + longDate(key) +
                (seatGone ? " \u2014 " + seatName() + " " + seatWord + ", other seats available" : "")) + '">' +
              '<span class="mtx-n">' + d + '</span>' +
              '<span class="mtx-dot"></span>' +
              '<span class="mtx-tag">' + esc(ev.shortName || "") + '</span></button>';
    }
    grid.innerHTML = html;
  }

  // On a narrow screen the dates sit below the fold, so switching month looks
  // like nothing happened. Scroll only when the grid is not already in view.
  function revealCalendar(){
    if(!state.month) return;
    var g = grid.getBoundingClientRect();
    if(g.top >= 0 && g.bottom <= window.innerHeight) return;
    glide((cal.querySelector(".mtx-gap") || grid), "start");
  }

  /* ---------------------------------------------------------------------------
     Choosing a date hands the screen to the night
     -------------------------------------------------------------------------*/
  // `move` is the guest's permission to take the page with us. True when they
  // chose something and expect the screen to follow; false when the widget is
  // simply loading and they have not asked for anything yet.
  function openNight(date, move){
    state.date = date;
    state.cls = null; state.qty = 0; state.cur = null; state.offer = null;
    renderCal();

    cal.hidden = true;
    showLoading("Checking live availability", move !== false);
    if(move !== false) glide(out, "start");

    var started = Date.now();
    var eventKey = state.events[date].eventKey;

    call("availability", { action:"availability", eventKey:eventKey }, READ_TIMEOUT)
      .then(function(data){
        // Hold the message on screen long enough to be read.
        var wait = Math.max(0, MIN_CHECK_MS - (Date.now() - started));
        setTimeout(function(){
          if(state.date !== date) return;    // the guest moved on while we waited
          state.night = filterClasses(data);
          // Seat first: open straight onto the seat they already chose. Not
          // filtered to it — if it is sold out that night they need the others
          // in front of them, not a dead end.
          if(state.picked && state.night.classes.some(function(c){ return c.code === state.picked; })){
            state.cls = state.picked;
          }
          renderNight();
        }, wait);
      })
      .catch(function(err){
        if(state.date !== date) return;
        showProblem("We could not check availability", err.message, "Try this date again");
      });
  }

  // A page may ask for only certain seat classes, by name or by code.
  function filterClasses(data){
    if(opts.seatsFirst) return data;
    if(!opts.classes) return data;
    var want = opts.classes;
    var kept = data.classes.filter(function(c){
      return want.indexOf(c.code.toLowerCase()) !== -1
          || want.indexOf(c.name.toLowerCase()) !== -1;
    });
    if(kept.length > 0) data.classes = kept;
    return data;
  }

  function backToDates(){
    state.date = null; state.night = null; state.cls = null; state.qty = 0; state.cur = null; state.offer = null;
    panel("");
    cal.hidden = false;
    renderSeatNote();
    renderCal();
    glide(cal, "start");
  }

  function renderNight(){
    var ev = state.night.event;
    panel(
      '<section class="mtx-band">' +
        '<div class="mtx-band-k">Your fight night</div>' +
        '<h2 class="mtx-band-h">' + esc(ev.name) + '</h2>' +
        '<div class="mtx-band-when">' +
          '<span>' + icon("cal") + esc(longDate(ev.date)) + '</span>' +
          (ev.startTime ? '<span>' + icon("clock") + esc(fmt12(ev.startTime) + (ev.endTime ? " – " + fmt12(ev.endTime) : "")) + '</span>' : "") +
          '<span>' + icon("pin") + esc(ev.venue) + '</span>' +
        '</div>' +
        (ev.description ? '<p class="mtx-band-d">' + esc(ev.description) + '</p>' : "") +
        (opts.eventKey ? "" : '<button class="mtx-band-change" data-back-date>Change date</button>') +
      '</section>' +
      '<section class="mtx-tix">' + seatStep() + '</section>'
    );
    if(state.cls) update();
  }

  // Is there anything at all on this night a guest could actually buy?
  function anythingBuyable(){
    return state.night.classes.some(function(c){ return statusMeta(c.status).live; });
  }

  /* ---- the way out, when we are not the ones selling ----
     Shown only when no class on the night is buyable. A night with even one
     class still on sale is a night we are selling, and pointing that guest at
     another site would be handing away our own booking. */
  function divertStep(){
    var ev = state.night.event;
    return '<div class="mtx-tix-h"><h3>Booking closed with us</h3></div>' +
      '<div class="mtx-divert">' +
        '<p class="mtx-divert-d">' +
          esc(ev.divertNote || "We are not selling tickets for this fight night. The stadium is still selling them directly.") +
        '</p>' +
        // rel is not optional here: opening a page with target=_blank hands it a
        // handle back to ours unless noopener says otherwise.
        '<a class="mtx-divert-go" href="' + esc(ev.divertUrl) + '" ' +
           'target="_blank" rel="noopener noreferrer">' +
          'Book this night at the stadium' +
          svg(15, 1.8, '<path d="M6 3h7v7M13 3 4 12"/>') +
        '</a>' +
        '<p class="mtx-divert-n">This opens the stadium\u2019s own website in a new tab.</p>' +
      '</div>';
  }

  /* ---- 3a: the four choices, name and status only ---- */
  function seatStep(){
    // Nothing to sell and somewhere to send them: offer that instead of four
    // buttons that all end in "closed".
    if(state.night.event.divertUrl && !anythingBuyable()) return divertStep();
    // Nothing to choose between, so open it.
    if(!state.cls && state.night.classes.length === 1){
      state.cls = state.night.classes[0].code;
    }
    if(!state.cls){
      return '<div class="mtx-tix-h"><h3><span class="mtx-num">3</span>Select your seat class</h3></div>' +
             '<div class="mtx-picker' + (state.night.classes.some(function(c){ return statusMeta(c.status, c.seatsLeft).live && goodPhotos(c).length > 0; }) ? " mtx-picker--photos" : "") + '">' +
               state.night.classes.map(pickButton).join("") + '</div>';
    }
    return '<div class="mtx-tix-h"><h3><span class="mtx-num">3</span>Your seats</h3></div>' + classDetail(chosen());
  }

  function byCode(code){
    for(var i = 0; i < state.night.classes.length; i++){
      if(state.night.classes[i].code === code) return state.night.classes[i];
    }
    return null;
  }
  function chosen(){ return byCode(state.cls); }

  // A fully booked class may carry an offer of another class at a lower price.
  // The server only sends it for a night that has been switched on, and the
  // checkout checks it again, so this only decides what to draw. It needs the
  // class it leads to to be on sale right now.
  function offerFor(t){
    if(t.status !== "fully_booked" || !t.offer) return null;
    var to = byCode(t.offer.toCode);
    return to && statusMeta(to.status, to.seatsLeft).live ? t.offer : null;
  }
  // The offer in force for class t, if the guest took it up and it still stands.
  function activeOffer(t){
    var from = state.offer && byCode(state.offer);
    var o = from && offerFor(from);
    return o && o.toCode === t.code ? o : null;
  }

  var CHEVRON = svg(17, 2.2, '<path d="M6 3l5 5-5 5"/>', "mtx-pick-go");

  // Photos and selling lines for a class that can be bought right now. A class
  // that is sold out or closed never gets here, so its photos go with it and the
  // tile shrinks back to the compact one.
  var TICK = svg(18, 2.2, '<path d="M3 8.5l3.2 3.2L13 4.8"/>', "mtx-why-tick");
  var ARROW_L = svg(18, 2.4, '<path d="M10 3L5 8l5 5"/>');
  var ARROW_R = svg(18, 2.4, '<path d="M6 3l5 5-5 5"/>');

  function goodPhotos(t){
    var out2 = [];
    var list = t.photos || [];
    for(var i = 0; i < list.length; i++){
      // Plain string test, not a pattern: the pattern needed a double slash, which
      // some tools that tidy a page's scripts read as the start of a comment.
      if(list[i] && typeof list[i].url === "string" && list[i].url.slice(0, 8).toLowerCase() === "https://") out2.push(list[i]);
    }
    return out2;
  }

  // The photo slider on its own, so a card that can be bought and a card that is
  // closed show exactly the same pictures.
  function sliderHtml(t, photos){
    var n = photos.length;
    var slides = photos.map(function(p, i){
      return '<li class="mtx-slide" role="group" aria-roledescription="slide" aria-label="Photo ' + (i + 1) + ' of ' + n + '">' +
        '<img src="' + esc(p.url) + '" alt="' + esc(p.alt || "") + '" decoding="async"' +
        (i === 0 ? "" : ' loading="lazy"') + '></li>';
    }).join("");
    var controls = n > 1
      ? '<button type="button" class="mtx-slide-btn mtx-slide-prev" data-slide="-1" aria-label="Previous photo" disabled>' + ARROW_L + '</button>' +
        '<button type="button" class="mtx-slide-btn mtx-slide-next" data-slide="1" aria-label="Next photo">' + ARROW_R + '</button>' +
        '<div class="mtx-dots">' + photos.map(function(p, i){
          return '<button type="button" class="mtx-dotb" data-slide-to="' + i + '" aria-label="Photo ' + (i + 1) + ' of ' + n + '"' +
            (i === 0 ? ' aria-current="true"' : "") + '><i></i></button>';
        }).join("") + '</div>'
      : "";
    return '<div class="mtx-slider" role="group" aria-roledescription="carousel" aria-label="Photos of ' + esc(t.name) + '">' +
        '<ul class="mtx-track" tabindex="0" aria-label="' + esc(t.name) + ' photos">' + slides + '</ul>' +
        controls +
      '</div>';
  }

  // "LEO Section" reads as "LEO" on a button; every other class is already short.
  function shortNameOf(t){ return String(t.name).replace(/\s+Section$/i, ""); }

  // The green button that chooses a class: "Available | Book LEO Tickets".
  function chooseButton(t, meta){
    var shortName = shortNameOf(t);
    return '<button type="button" class="mtx-seatcard-go" data-pick="' + esc(t.code) + '" aria-label="Book ' +
        esc(shortName) + ' tickets, ' + esc(meta.label) + '">' +
        '<span>' + (meta.low ? 'Only <b class="mtx-avail-n">' + meta.seatsLeft + '</b> left' : esc(meta.label)) + '</span>' +
        '<span class="mtx-go-sep" aria-hidden="true"></span>' +
        '<span>Book ' + esc(shortName) + ' Tickets</span>' +
        CHEVRON +
      '</button>';
  }

  // The strapline, name and price that open every seat class tile and card.
  function tileHead(t, cur, unit){
    return (t.tagline ? '<span class="mtx-pick-why">' + esc(t.tagline) + '</span>' : "") +
      '<span class="mtx-pick-name">' + esc(t.name) + '</span>' +
      (unit != null ? '<span class="mtx-pick-price">' + esc(money(cur, unit)) + ' per ticket</span>' : "");
  }

  // The way through from a fully booked class to the Club Class offer.
  function offerButton(t){
    return '<button type="button" class="mtx-seatcard-go" data-offer="' + esc(t.code) + '"><span>' +
      esc(OFFER_BTN) + '</span>' + CHEVRON + '</button>';
  }

  function seatCard(t, meta, cur, unit, photos){
    var lines = (t.benefits || []).map(function(b){
      return '<li>' + TICK + esc(b.text) +
        (b.note ? '<span class="mtx-why-note">' + esc(b.note) + '</span>' : "") + '</li>';
    }).join("");

    return '<div class="mtx-seatcard' + (meta.low ? " mtx-seatcard--low" : "") + '">' +
      sliderHtml(t, photos) +
      '<div class="mtx-seatcard-body">' +
        tileHead(t, cur, unit) +
        (lines ? '<ul class="mtx-why-list">' + lines + '</ul>' : '<div style="height:14px"></div>') +
        chooseButton(t, meta) +
      '</div>' +
    '</div>';
  }

  // A class that is closed keeps its photos, so a guest can see what it is and
  // does not simply see a red box. It says why it is closed, and offers the
  // nearest class above it that can be bought, so the guest is led somewhere
  // instead of off to look for it on another site.
  function nextClassUp(t){
    var list = state.night.classes, i = list.indexOf(t);
    for(var k = i - 1; k >= 0; k--){
      if(statusMeta(list[k].status, list[k].seatsLeft).live) return list[k];
    }
    return null;
  }

  function closedCard(t, meta, cur, unit, photos){
    var up = nextClassUp(t);
    return '<div class="mtx-seatcard mtx-seatcard--closed">' +
      sliderHtml(t, photos) +
      '<div class="mtx-seatcard-body">' +
        tileHead(t, cur, unit) +
        (t.closedExplanation ? '<span class="mtx-pick-note">' + esc(t.closedExplanation) + '</span>' : "") +
        '<button type="button" class="mtx-closed-btn" data-pick="' + esc(t.code) + '" disabled>' + esc(meta.label) + '</button>' +
        (up ? chooseButton(up, statusMeta(up.status, up.seatsLeft)).replace('class="mtx-seatcard-go"', 'class="mtx-seatcard-go mtx-seatcard-go--up"') : "") +
      '</div>' +
    '</div>';
  }

  function pickButton(t){
    var meta = statusMeta(t.status, t.seatsLeft);
    // The strip and the border carry availability, not the seat class. The old
    // green, blue, yellow and orange bars told a first-time guest nothing -- at
    // this step nobody yet knows what yellow means. Green while it can still be
    // booked, "only 3 left" included because it still can be; red only once it
    // cannot, so the two are never confused.
    var cur  = state.cur || guessCurrency(t.prices);
    var unit = cur ? priceFor(t, cur) : null;
    // Photos go with a class that is sold out or past its booking time, and stay
    // with one that is merely not open yet (Third Class), so it can be seen.
    var photos = (meta.live || t.status === "closed") ? goodPhotos(t) : [];
    if(photos.length > 0) return meta.live ? seatCard(t, meta, cur, unit, photos) : closedCard(t, meta, cur, unit, photos);
    // A handful left reads exactly like Available at a glance -- same pill,
    // same green, same weight. mtx-pick--low thickens the whole tile's own
    // border (still the same green, nothing new to learn) and mtx-avail-n
    // sets the number itself apart from "left", so the one tile that is
    // actually running low is the one the eye catches first, not last.
    var offered = !meta.live && offerFor(t);
    var tag = offered ? "div" : "button";
    return '<' + tag + ' class="mtx-pick mtx-pick--' + (meta.live ? "on" : "off") + (offered ? " mtx-pick--offer" : "") + (meta.low ? " mtx-pick--low" : "") + '"' +
      (offered ? '' : ' data-pick="' + esc(t.code) + '"' + (meta.live ? "" : " disabled")) + '>' +
      '<span class="mtx-pick-bar"></span>' +
      tileHead(t, cur, unit) +
      // A class that is closed says why, on the tile itself. The stadium's own
      // site shows nothing for a class that is not open, and a guest who is left
      // wondering goes to look for it elsewhere and does not come back. The
      // explanation was always in the database but only on the next screen, which
      // a closed tile could never reach. Sold out needs none: it says so plainly.
      (!meta.live && t.status === "closed" && t.closedExplanation
        ? '<span class="mtx-pick-note">' + esc(t.closedExplanation) + '</span>'
        : "") +
      '<span class="mtx-avail ' + meta.tile + '">' +
        (meta.low ? 'Only <b class="mtx-avail-n">' + meta.seatsLeft + '</b> left' : esc(meta.label)) +
      '</span>' +
      (offered ? offerButton(t) : "") +
      (meta.live ? CHEVRON : "") +
    '</' + tag + '>';
  }

  /* ---- 3b: the one chosen class ---- */
  function classDetail(t){
    var meta = statusMeta(t.status, t.seatsLeft);
    var body;

    if(t.status === "closed"){
      // The explanation is required by the database, so there is always one.
      body = '<div class="mtx-note">' + esc(t.closedExplanation || "This seat class is not on sale for this date.") + '</div>';
    } else if(t.status === "booking_closed"){
      body = '<div class="mtx-note">Online booking has now closed for this fight night. ' +
             'Please choose another date, or message us and we will do what we can.</div>';
    } else if(!meta.live){
      // One sentence for every widget, in Jason's words. It used to point at a
      // Change seat class button that a one-class widget never draws.
      body = '<div class="mtx-note">' + esc(t.name) + ' is now fully booked. ' +
             'Please choose another seat class or another date.</div>' +
             (offerFor(t) ? offerButton(t) : "");
    } else {
      var cur = state.cur || guessCurrency(t.prices);
      var max = Math.max(1, Math.min(10, t.maxPerOrder || 10));
      // Open on two tickets, so the button is live the moment the class is
      // chosen and a guest never has to work out why it is grey. One ticket
      // when there is only one to sell, or when two would trigger the seating
      // warning and put the button behind a tick box straight away.
      if(!state.qty){
        var left = t.seatsLeft > 0 ? Math.min(max, t.seatsLeft) : max;
        var tog = (t.assignedSeating && t.maximumSeatsTogether != null) ? Number(t.maximumSeatsTogether) : null;
        state.qty = (left >= 2 && !(tog != null && 2 > Math.max(tog, 1))) ? 2 : 1;
      }
      body =
        (activeOffer(t) ? '<div class="mtx-ob"><div class="mtx-ob-k">' + esc(OFFER_BTN) + '</div>' +
           '<div class="mtx-ob-p"><b class="mtx-ob-now" data-now></b>' +
           '<span class="mtx-ob-was">Usual price <s data-was></s></span>' +
           '<span class="mtx-ob-save" data-save></span></div>' +
           '<div class="mtx-ob-n">' + esc(byCode(state.offer).name) + ' is fully booked</div></div>' : "") +
        '<div class="mtx-fields">' +
          '<div class="mtx-pair">' +
            '<div class="mtx-f"><label for="mtxQty"><span class="mtx-num">4</span>Number of tickets</label>' +
              '<div class="mtx-sel"><select id="mtxQty" data-qty>' +
                qtyOpts(max, state.qty) +
              '</select></div></div>' +
            '<div class="mtx-f"><label for="mtxCur"><span class="mtx-num">5</span>Choose your currency</label>' +
              '<div class="mtx-sel"><select id="mtxCur" data-cur>' +
                t.prices.map(function(p){
                  return '<option value="' + esc(p.currency) + '"' + (p.currency === cur ? " selected" : "") + '>' +
                         esc(p.currency.toUpperCase()) + '</option>';
                }).join("") +
              '</select></div></div>' +
          '</div>' +
          '<div data-seatack></div>' +
          '<div class="mtx-sums">' +
            '<div class="mtx-sum"><span>Price per ticket</span><b data-unit>&mdash;</b></div>' +
            '<div class="mtx-sum mtx-sum--total"><span>Total</span><b data-total>&mdash;</b></div>' +
          '</div>' +
          '<button class="mtx-go" data-go disabled>Select number of tickets</button>' +
          '<div data-fail></div>' +
        '</div>';
    }

    return '<section class="mtx-detail' + (meta.live ? "" : t.status === "fully_booked" ? " mtx-detail--off" : " mtx-detail--shut") +
      '" style="--c:' + esc(t.colour || "#5C5C66") + '">' +
      '<div class="mtx-detail-k">You have chosen</div>' +
      '<div class="mtx-detail-top">' +
        '<h3 class="mtx-detail-h">' + esc(t.name) + '</h3>' +
        '<span class="mtx-pill ' + meta.pill + '"><i></i>' + (t.status === "fully_booked" ? "Fully booked" : meta.label) + '</span>' +
      '</div>' +
      (t.description ? '<p class="mtx-detail-d">' + esc(t.description) + '</p>' : "") +
      body +
      (state.night.classes.length > 1
         ? '<button class="mtx-detail-change" data-back-class>Change seat class</button>' : "") +
    '</section>';
  }

  // The cap is whatever the database says is left, never more than ten. A guest
  // is not offered eight seats when six remain.
  function qtyOpts(max, picked){
    var o = "";
    for(var i = 1; i <= max; i++) o += '<option value="' + i + '"' + (i === picked ? " selected" : "") + '>' + i + (i === 1 ? " ticket" : " tickets") + '</option>';
    return o;
  }

  function unitIn(list, cur){
    for(var i = 0; i < list.length; i++) if(list[i].currency === cur) return list[i].unitAmount;
    return null;
  }
  function priceFor(t, cur){
    var o = activeOffer(t);
    return unitIn(o ? o.prices : t.prices, cur);
  }

  /* ---------------------------------------------------------------------------
     Totals, the seating warning, and the state of the button
     -------------------------------------------------------------------------*/
  function update(){
    var t = chosen();
    if(!t) return;
    var totalEl = out.querySelector("[data-total]");
    if(!totalEl) return;

    var unitEl  = out.querySelector("[data-unit]");
    var go      = out.querySelector("[data-go]");
    var seatWrap= out.querySelector("[data-seatack]");

    var cur = state.cur || guessCurrency(t.prices);
    state.cur = cur;
    var unit = priceFor(t, cur);

    var was = out.querySelector("[data-was]");
    if(was){
      var usual = unitIn(t.prices, cur);
      was.textContent = money(cur, usual);
      out.querySelector("[data-now]").textContent = unit == null ? "" : money(cur, unit) + " per ticket";
      out.querySelector("[data-save]").textContent = unit == null ? "" : "Save " + money(cur, usual - unit) + " per ticket";
    }
    if(unitEl) unitEl.textContent = unit == null ? "—" : money(cur, unit);
    totalEl.textContent = (state.qty && unit != null) ? money(cur, unit * state.qty) : "—";

    // How many of a group we can seat side by side. null means we have not been
    // told, so we say nothing. A real number, zero included, is a promise we have
    // to keep: zero means the seats we hold are scattered and nobody in the group
    // sits together. A guest booking one seat is not a group, so they never see it.
    var together = (t.assignedSeating && t.maximumSeatsTogether != null)
                 ? Number(t.maximumSeatsTogether) : null;
    var needsAck = together != null && state.qty > Math.max(together, 1);

    if(seatWrap){
      if(needsAck && !seatWrap.dataset.built){
        seatWrap.innerHTML =
          '<div class="mtx-note mtx-warn">' +
          (together === 0
            ? '<b>We cannot seat your group together on this night.</b> ' +
              'Everyone is in the same class, but the seats are apart.'
            : '<b>We can seat ' + together + ' of your group together.</b> ' +
              'The rest will be in the same class, but not side by side.') +
          '<label class="mtx-ack"><input type="checkbox" data-ack>' +
          '<span>That&rsquo;s fine &mdash; book anyway</span></label></div>';
        seatWrap.dataset.built = "1";
      } else if(!needsAck){
        seatWrap.innerHTML = "";
        seatWrap.dataset.built = "";
      }
    }

    var ack = out.querySelector("[data-ack]");
    if(go && !state.busy){
      var blocked = !state.qty || unit == null || (needsAck && !(ack && ack.checked));
      go.disabled = blocked;
      go.textContent = !state.qty ? "Select number of tickets"
                     : blocked ? "Confirm seating above"
                     : "Reserve your tickets";
    }
  }

  /* ---------------------------------------------------------------------------
     Waking the checkout up early
     -------------------------------------------------------------------------*/
  // create-checkout is a bigger function than the others and is often stone cold,
  // because nothing touches it until the moment a guest commits. Booting it then
  // costs several seconds at the exact point they are deciding whether to trust
  // us. So the moment a seat class is chosen we send a ping that does nothing but
  // wake it, and by the time they have picked a quantity it is ready.
  //
  // Fire and forget on purpose: if it fails, the real call simply pays the boot
  // cost as it did before. Nothing about the booking depends on it.
  function warmCheckout(){
    if(warmed) return;
    warmed = true;
    try {
      fetch(API + "/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({ action: "warm" }),
        keepalive: true
      }).catch(function(){});
    } catch(e) {}
  }

  /* ---------------------------------------------------------------------------
     Handing over to Stripe
     -------------------------------------------------------------------------*/
  function reserve(){
    var t = chosen();
    if(!t || state.busy) return;

    var go = out.querySelector("[data-go]");
    var fail = out.querySelector("[data-fail]");
    var ack = out.querySelector("[data-ack]");

    state.busy = true;
    go.disabled = true;
    go.textContent = "Reserving your tickets…";
    if(fail) fail.innerHTML = "";

    // The click that won this booking, if there was one. Attached here rather
    // than on the success page: the reservation row is created by this call,
    // and the success page is on the far side of a redirect that loses the URL.
    var won = readStoredAttribution();
    // The advert tells us the device when the guest came from one; everyone else
    // arrived with nothing, so say what they are on. Same one-letter codes the
    // adverts already use: m phone, t tablet, d computer. Nothing else is read.
    var attr = {};
    if(won) for(var k in won) if(Object.prototype.hasOwnProperty.call(won, k)) attr[k] = won[k];
    if(!attr.device && mayStoreAttribution()) attr.device = deviceNow();

    call("create-checkout", {
      eventKey: state.night.event.eventKey,
      classCode: t.code,
      quantity: state.qty,
      currency: state.cur,
      seatingAcknowledged: !!(ack && ack.checked),
      offerFrom: activeOffer(t) ? state.offer : undefined,
      attribution: attr,
      // Read live rather than from storage: this is the page they are standing
      // on right now, which is the whole point of recording it.
      pagePath: pathNow() || undefined,
      landingPage: readLanding() || undefined
    }, CHECKOUT_TIMEOUT)
      .then(function(data){
        if(!data.checkoutUrl) throw new Error("The secure checkout could not be opened. Please try again.");
        // Deliberately no reset of state.busy. The page is leaving, and a button
        // that comes back to life for a moment invites a second click and a
        // second held seat.
        window.location.assign(data.checkoutUrl);
      })
      .catch(function(err){
        state.busy = false;
        if(fail) fail.innerHTML = '<div class="mtx-fail">' + esc(err.message) + '</div>';

        // A 409 means the answer changed underneath the guest: the last seat went,
        // or booking closed while they were deciding. Re-reading the night is the
        // only honest response — leaving the old status on screen would let them
        // try again against stock that is not there.
        if(err.status === 409 && !(err.body && err.body.code === "seating_ack_required")){
          setTimeout(function(){ openNight(state.date); }, 2200);
          return;
        }
        update();
      });
  }

  /* ---------------------------------------------------------------------------
     Events
     -------------------------------------------------------------------------*/
  months.addEventListener("click", function(e){
    var b = e.target.closest("[data-month]");
    if(!b) return;
    state.month = b.getAttribute("data-month");
    renderMonths();
    renderCal();
    revealCalendar();
  });

  cal.addEventListener("click", function(e){
    if(e.target.closest("[data-back-seat]")) goBack("seat", backToSeats);
  });

  grid.addEventListener("click", function(e){
    var b = e.target.closest("[data-date]");
    if(b){
      pushStep("night", backToDates);
      openNight(b.getAttribute("data-date"));
    }
  });

  // The photo slider. Swiping is the browser's own scroll-snap; these only
  // answer the arrows and dots, and keep the dots in step with the photo shown.
  function slideTo(track, i){
    var slides = track.children;
    if(!slides.length) return;
    i = Math.max(0, Math.min(slides.length - 1, i));
    var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({ left: slides[i].offsetLeft - track.offsetLeft, behavior: calm ? "auto" : "smooth" });
  }
  function slideNow(track){
    var w = track.clientWidth || 1;
    return Math.max(0, Math.min(track.children.length - 1, Math.round(track.scrollLeft / w)));
  }
  function syncSlider(track){
    var box = track.closest(".mtx-slider");
    if(!box) return;
    var i = slideNow(track);
    var dots = box.querySelectorAll("[data-slide-to]");
    for(var d = 0; d < dots.length; d++){
      if(d === i) dots[d].setAttribute("aria-current", "true"); else dots[d].removeAttribute("aria-current");
    }
    var prev = box.querySelector(".mtx-slide-prev"), next = box.querySelector(".mtx-slide-next");
    if(prev) prev.disabled = i === 0;
    if(next) next.disabled = i === track.children.length - 1;
  }
  out.addEventListener("scroll", function(e){
    if(e.target && e.target.classList && e.target.classList.contains("mtx-track")){
      var tr = e.target;
      if(tr._mtxRaf) return;
      tr._mtxRaf = requestAnimationFrame(function(){ tr._mtxRaf = 0; syncSlider(tr); });
    }
  }, true);
  out.addEventListener("keydown", function(e){
    var tr = e.target && e.target.classList && e.target.classList.contains("mtx-track") ? e.target : null;
    if(!tr) return;
    if(e.key === "ArrowRight"){ e.preventDefault(); slideTo(tr, slideNow(tr) + 1); }
    if(e.key === "ArrowLeft"){ e.preventDefault(); slideTo(tr, slideNow(tr) - 1); }
  });

  out.addEventListener("click", function(e){
    var step = e.target.closest("[data-slide]");
    var dot  = e.target.closest("[data-slide-to]");
    if(step || dot){
      var tr = (step || dot).closest(".mtx-slider").querySelector(".mtx-track");
      slideTo(tr, step ? slideNow(tr) + (+step.getAttribute("data-slide")) : +dot.getAttribute("data-slide-to"));
      return;
    }
    if(e.target.closest("[data-retry]")){
      if(state.date) openNight(state.date);
      else if(opts.seatsFirst && state.picked) loadNights();
      else boot();
      return;
    }
    if(e.target.closest("[data-back-date]")){ goBack("night", backToDates); return; }

    var seat = e.target.closest("[data-seat]");
    if(seat && seat.getAttribute("data-seat")){
      pushStep("seat", backToSeats);
      chooseSeat(seat.getAttribute("data-seat"));
      return;
    }

    var pick = e.target.closest("[data-pick]");
    if(pick && pick.disabled) return;
    var offer = e.target.closest("[data-offer]");
    var from = offer && byCode(offer.getAttribute("data-offer"));
    var made = from && offerFor(from);
    if(pick || made){
      warmCheckout();
      pushStep("class", backToClassList);
      state.cls = made ? made.toCode : pick.getAttribute("data-pick");
      state.offer = made ? from.code : null;
      state.qty = 0;
      out.querySelector(".mtx-tix").innerHTML = seatStep();
      update();
      glide(out.querySelector(".mtx-tix"), "nearest");
      return;
    }

    if(e.target.closest("[data-back-class]")){ goBack("class", backToClassList); return; }

    if(e.target.closest("[data-go]") && !e.target.closest("[data-go]").disabled) reserve();
  });

  out.addEventListener("change", function(e){
    if(e.target.hasAttribute("data-qty")){ state.qty = e.target.value ? +e.target.value : 0; update(); return; }
    if(e.target.hasAttribute("data-cur")){ state.cur = e.target.value; update(); return; }
    if(e.target.hasAttribute("data-ack")) update();
  });

  // A guest who reaches Stripe and comes straight back — the X on the payment
  // tab, or the back button — gets this page handed back to them by the browser
  // exactly as they left it, out of its cache. Nothing re-runs. So the reserve
  // button came back still disabled and still reading "Reserving your tickets…",
  // because the code that set it that way assumed the page was about to be
  // destroyed and never reset it.
  //
  // That left the guest looking at a dead button on the page they had just been
  // sent away from. Tapping it did nothing. The only way out was "Change seat
  // class", which nobody thinks to press. They were stuck, and they left.
  //
  // Coming back is not an error. It is a guest who wanted to change something,
  // or did not like what they saw at the payment page, and is still here. So put
  // the button back to work: update() already knows the right label and whether
  // it should be enabled, and it only skips that while busy is set.
  //
  // The hold they abandoned expires on its own within minutes, and reserve()
  // re-checks stock server-side before it does anything, so letting them try
  // again cannot oversell.
  window.addEventListener("pageshow", function(){
    if(!state.busy) return;
    state.busy = false;
    var go = out.querySelector("[data-go]");
    if(go) go.disabled = false;
    update();
  });

  boot();
}

/* ---------------------------------------------------------------------------
   Finding the widgets on the page
   -------------------------------------------------------------------------*/
function options(el) {
  var event = (el.getAttribute("data-event-id") || "").trim();
  var classes = (el.getAttribute("data-ticket-class") || "")
    .split(",").map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
  var series = (el.getAttribute("data-series") || "")
    .split(",").map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
  // Seat before date. Ignored when the page already names one night, because
  // there is then no calendar for the seat to lead to.
  var seatsFirst = (el.getAttribute("data-start") || "").trim().toLowerCase() === "seats";
  return {
    eventKey: event || null,
    classes: classes.length ? classes : null,
    series: series.length ? series : null,
    seatsFirst: seatsFirst && !event,
  };
}

function start() {
  injectStyles();
  var found = document.querySelectorAll(MOUNT);
  for (var i = 0; i < found.length; i++) {
    var el = found[i];
    if (el.getAttribute("data-mtx-ready") === "1") continue;   // never twice
    el.setAttribute("data-mtx-ready", "1");

    // Every mount point carries the same id, and that is deliberate.
    //
    // The stylesheet has to outrank the page it is dropped into. On the live
    // Tilda page a rule like `#allrecords button { color:#000 }` beat our own
    // and turned the reserve button into a black rectangle with invisible
    // text. Only an id selector reliably wins that, and no number of class
    // names gets there.
    //
    // A repeated id is not valid HTML, but it is exactly what CSS needs: an id
    // selector matches every element carrying it. Nothing here looks an element
    // up by id — each widget is handed its own root and searches within it —
    // so the id is a styling hook and nothing more.
    el.id = "mtx-booking";
    var opts = options(el);
    el.innerHTML = shell(opts);
    try { mount(el, opts); }
    catch (err) { console.error("MuayTix widget failed to start", err); }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
})();
