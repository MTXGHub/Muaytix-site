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
//   <div class="muaytix-ticket-selector" data-series="rws"></div>
//       a page built around one promotion. The calendar opens on the month
//       holding that promotion's next night and marks its nights out, but
//       every other fight night stays fully bookable. Nothing is ever hidden,
//       greyed out or crossed through for being a different promotion: those
//       nights have fights on them and telling a guest otherwise loses a sale.
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

var MONTHS  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
var MONTHS_S= ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
var DAYS    = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];


/* ---------------------------------------------------------------------------
   The stylesheet, injected once however many widgets are on the page
   -------------------------------------------------------------------------*/
var CSS = "\n\n#mtx-booking{\n  --ground:#F6F4F1; --surface:#FFFFFF; --surface-2:#FBFAF8;\n  --ink:#14110E; --ink-2:#3A342D; --muted:#6E655C; --line:#E2DDD6; --line-2:#EFEBE5;\n  --ok-fg:#136B3B; --ok-bg:#E6F2EA;\n  --lim-fg:#8A5200; --lim-bg:#FBF0DE;\n  --full-fg:#9C1F1F; --full-bg:#F8E8E8;\n  --shut-fg:#645B52; --shut-bg:#EDEAE5;\n  --ring:#C4122F;\n  --shadow:0 1px 2px rgba(20,17,14,.05), 0 8px 24px rgba(20,17,14,.07);\n  --shadow-lg:0 2px 4px rgba(20,17,14,.06), 0 18px 44px rgba(20,17,14,.12);\n  /* Seat class colours are no longer listed here. They arrive with the\n     availability response, from ticket_classes.accent_colour / accent_ink, so\n     a fifth class needs no change to this file. */\n  --blue:#1f5bff; --blue-on:#1540C9; --blue-ink:#FFFFFF;\n  color-scheme:light;\n}\n/* Locked to light. The widget is embedded in a light Tilda page, so following\n   the guest's phone theme would make it look foreign inside its own page. */\n\n#mtx-booking *{box-sizing:border-box}\n#mtx-booking{background:var(--ground);color:var(--ink);\n  font:400 15px/1.55 Barlow,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;\n  -webkit-font-smoothing:antialiased;\n  /* Tilda centres the text in its blocks, and that inherits straight into the\n     widget: every description and label came out centred on the live page.\n     Stated here so the widget reads the same wherever it is embedded. */\n  text-align:left}\n#mtx-booking h1, #mtx-booking h2, #mtx-booking h3, #mtx-booking h4{margin:0;font-family:\"Barlow Condensed\",Barlow,sans-serif;text-wrap:balance;letter-spacing:.005em}\n#mtx-booking p{margin:0}\n#mtx-booking button, #mtx-booking select{font:inherit;color:inherit}\n#mtx-booking :focus-visible{outline:2px solid var(--ring);outline-offset:2px;border-radius:4px}\n@media (prefers-reduced-motion:reduce){#mtx-booking *{animation-duration:.01ms!important;transition-duration:.01ms!important}}\n\n/* numbered step badge */\n#mtx-booking .mtx-num{display:inline-grid;place-items:center;width:20px;height:20px;flex:0 0 auto;border-radius:50%;\n  background:var(--blue);color:var(--blue-ink);font-family:Barlow;font-size:11px;font-weight:700;\n  line-height:1;font-variant-numeric:tabular-nums}\n\n/* ---------- widget shell ---------- */\n#mtx-booking .mtx-stage{padding:0}\n#mtx-booking .mtx-card{max-width:1120px;margin:0 auto;background:var(--surface);border:1px solid var(--line);\n  border-radius:16px;box-shadow:var(--shadow);overflow:hidden;transition:max-width .28s ease}\n\n/* masthead */\n#mtx-booking .mtx-mast{padding:20px 26px;border-bottom:1px solid var(--line-2);background:var(--surface-2)}\n#mtx-booking .mtx-mast-lead{display:block;font-size:12px;font-weight:700;letter-spacing:.14em;\n  text-transform:uppercase;color:var(--muted);margin-bottom:4px}\n#mtx-booking .mtx-mast-venue{display:block;font-family:\"Barlow Condensed\";font-weight:800;\n  font-size:clamp(26px,3.2vw,36px);line-height:1.02;letter-spacing:.005em}\n#mtx-booking .mtx-mast-city{display:block;font-family:\"Barlow Condensed\";font-weight:600;\n  font-size:clamp(18px,2.2vw,24px);line-height:1.15;color:var(--muted);letter-spacing:.03em}\n\n/* section label */\n#mtx-booking .mtx-sec-label{display:flex;align-items:center;gap:9px;margin:0 0 11px;\n  font-size:15px;font-weight:700;letter-spacing:.01em}\n#mtx-booking .mtx-sec-label.mtx-gap{margin-top:36px}\n\n/* month buttons */\n#mtx-booking .mtx-months{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:4px}\n/* border-width stays 3px on every state so selecting a month shifts nothing */\n#mtx-booking .mtx-mbtn{padding:12px 10px;border:3px solid var(--blue);border-radius:11px;background:var(--blue);\n  font-family:\"Barlow Condensed\";font-size:19px;font-weight:700;letter-spacing:.02em;\n  cursor:pointer;transition:.15s;color:var(--blue-ink)}\n#mtx-booking .mtx-mbtn:hover:not(.mtx-on){background:var(--blue-on);border-color:var(--blue-on)}\n/* chosen month reverses out: white fill, blue border, blue type */\n#mtx-booking .mtx-mbtn.mtx-on{background:var(--surface);border-color:var(--blue);color:var(--blue)}\n\n/* which month am I looking at \u2014 guards against picking a date in the wrong month */\n#mtx-booking .mtx-month-note{display:flex;align-items:center;gap:11px;margin:0 0 14px;padding:12px 15px;\n  border:2px solid var(--blue);border-radius:10px;\n  background:color-mix(in srgb, var(--blue) 10%, var(--surface));\n  color:var(--ink-2);font-size:14.5px;font-weight:600;line-height:1.25}\n#mtx-booking .mtx-month-note svg{flex:0 0 auto;color:var(--blue)}\n#mtx-booking .mtx-month-note b{font-family:\"Barlow Condensed\";font-size:20px;font-weight:800;\n  letter-spacing:.035em;color:var(--blue);white-space:nowrap}\n\n/* calendar */\n#mtx-booking .mtx-cal{padding:24px 26px 26px}\n#mtx-booking .mtx-dow, #mtx-booking .mtx-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}\n#mtx-booking .mtx-dow{margin-bottom:6px}\n#mtx-booking .mtx-dow span{text-align:center;font-size:13px;font-weight:700;letter-spacing:.09em;\n  text-transform:uppercase;color:var(--muted);padding:2px 0}\n#mtx-booking .mtx-day{position:relative;min-height:62px;padding:7px 5px 6px;border:1.5px solid transparent;\n  border-radius:11px;background:var(--surface-2);cursor:pointer;text-align:center;\n  display:flex;flex-direction:column;align-items:center;gap:5px;transition:.15s}\n#mtx-booking .mtx-day:hover:not(:disabled){border-color:var(--line);transform:translateY(-1px)}\n#mtx-booking .mtx-day:disabled{background:transparent;cursor:default}\n#mtx-booking .mtx-day .mtx-n{font-family:\"Barlow Condensed\";font-weight:700;font-size:20px;line-height:1;\n  font-variant-numeric:tabular-nums}\n#mtx-booking .mtx-day .mtx-tag{font-size:9px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;\n  color:var(--muted);line-height:1.15;max-width:100%;overflow:hidden}\n#mtx-booking .mtx-day .mtx-dot{width:5px;height:5px;border-radius:50%;background:var(--evt,var(--muted))}\n/* The promotion this page is about. Every other night is still bookable and\n   still shows what is on; this only says which ones the page is for. */\n#mtx-booking .mtx-day.mtx-hi{border-color:var(--evt,var(--blue));\n  background:color-mix(in srgb, var(--evt,var(--blue)) 9%, var(--surface))}\n#mtx-booking .mtx-day.mtx-hi .mtx-n{font-weight:800}\n#mtx-booking .mtx-day.mtx-sel{border-color:var(--ink);background:var(--ink)}\n#mtx-booking .mtx-day.mtx-sel .mtx-n{color:var(--ground)} #mtx-booking .mtx-day.mtx-sel .mtx-tag{color:rgba(255,255,255,.72)}\n#mtx-booking .mtx-day.mtx-none .mtx-n{color:var(--muted);opacity:.4}\n#mtx-booking .mtx-day.mtx-shut .mtx-n{color:var(--muted);opacity:.55;text-decoration:line-through}\n\n/* selected event box \u2014 white, framed in blue, blue accents */\n#mtx-booking .mtx-band{margin:0 26px;padding:22px 24px;background:var(--surface);color:var(--ink);\n  border:2px solid var(--blue);border-radius:14px}\n#mtx-booking .mtx-band-k{font-size:11px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;\n  color:var(--blue);margin-bottom:9px}\n#mtx-booking .mtx-band-h{font-size:clamp(24px,3vw,34px);font-weight:800;line-height:1.06;letter-spacing:.01em}\n#mtx-booking .mtx-band-when{display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:12px;font-size:15px;\n  font-weight:600;color:var(--ink-2)}\n#mtx-booking .mtx-band-when span{display:inline-flex;align-items:center;gap:7px}\n#mtx-booking .mtx-band-when svg{color:var(--blue);flex:0 0 auto}\n#mtx-booking .mtx-band-d{margin-top:13px;font-size:14.5px;line-height:1.55;color:var(--muted);max-width:66ch}\n/* a way back, not a call to action \u2014 sized down so it sits under the event detail */\n#mtx-booking .mtx-band-change{margin-top:15px;border:1.5px solid var(--blue);background:var(--surface);color:var(--blue);\n  padding:6px 11px;border-radius:7px;font-size:10.5px;font-weight:700;letter-spacing:.07em;\n  text-transform:uppercase;cursor:pointer;transition:.15s}\n#mtx-booking .mtx-band-change:hover{background:var(--blue);color:var(--blue-ink)}\n\n/* loading */\n#mtx-booking .mtx-load{padding:56px 26px;text-align:center;color:var(--ink-2);font-size:16px;font-weight:600}\n#mtx-booking .mtx-spin{width:26px;height:26px;margin:0 auto 14px;border:3px solid var(--line);\n  border-top-color:var(--blue);border-radius:50%;animation:sp .7s linear infinite}\n@keyframes sp{to{transform:rotate(360deg)}}\n\n/* ticket area */\n#mtx-booking .mtx-tix{padding:24px 26px 30px}\n#mtx-booking .mtx-tix-h{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 14px;margin-bottom:16px}\n#mtx-booking .mtx-tix-h h3{display:flex;align-items:center;gap:9px;font-size:20px;font-weight:700}\n#mtx-booking .mtx-tix-h em{font-style:normal;font-size:12.5px;color:var(--muted)}\n\n/* status pill */\n#mtx-booking .mtx-pill{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;\n  font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;white-space:nowrap}\n#mtx-booking .mtx-pill i{width:6px;height:6px;border-radius:50%;background:currentColor;flex:0 0 auto}\n#mtx-booking .mtx-pill.mtx-ok{color:var(--ok-fg);background:var(--ok-bg)}\n#mtx-booking .mtx-pill.mtx-lim{color:var(--lim-fg);background:var(--lim-bg)}\n#mtx-booking .mtx-pill.mtx-full{color:var(--full-fg);background:var(--full-bg)}\n#mtx-booking .mtx-pill.mtx-shut{color:var(--shut-fg);background:var(--shut-bg)}\n\n/* step 3a \u2014 the four choices, no detail */\n#mtx-booking .mtx-picker{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}\n#mtx-booking .mtx-pick{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:9px;\n  padding:16px 15px 15px 20px;border:1.5px solid var(--line);border-radius:12px;\n  background:var(--surface);cursor:pointer;text-align:left;transition:.15s;overflow:hidden}\n#mtx-booking .mtx-pick:hover{border-color:var(--ci);transform:translateY(-2px);box-shadow:var(--shadow)}\n#mtx-booking .mtx-pick-bar{position:absolute;left:0;top:0;bottom:0;width:5px;background:var(--c)}\n#mtx-booking .mtx-pick-name{font-family:\"Barlow Condensed\";font-size:22px;font-weight:700;line-height:1.02}\n#mtx-booking .mtx-pick--off{opacity:.72}\n#mtx-booking .mtx-pick--off:hover{transform:none;box-shadow:none;border-color:var(--line)}\n\n/* step 3b \u2014 the one chosen class, framed in its own colour */\n#mtx-booking .mtx-detail{border:2px solid var(--ci);border-radius:14px;padding:20px 22px;background:var(--surface)}\n#mtx-booking .mtx-detail-k{font-size:11px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;\n  color:var(--ci);margin-bottom:8px}\n#mtx-booking .mtx-detail-top{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin-bottom:10px}\n#mtx-booking .mtx-detail-h{font-size:clamp(24px,2.6vw,30px);font-weight:800;line-height:1.05}\n#mtx-booking .mtx-detail-d{font-size:14.5px;line-height:1.55;color:var(--muted);max-width:66ch;margin-bottom:16px}\n#mtx-booking .mtx-detail-change{margin-top:15px;border:1.5px solid var(--ci);background:var(--surface);color:var(--ci);\n  padding:6px 11px;border-radius:7px;font-size:10.5px;font-weight:700;letter-spacing:.07em;\n  text-transform:uppercase;cursor:pointer;transition:.15s}\n#mtx-booking .mtx-detail-change:hover{background:var(--ci);color:#fff}\n\n#mtx-booking .mtx-note{padding:12px 13px;border-radius:9px;font-size:13.5px;line-height:1.5;\n  background:var(--shut-bg);color:var(--ink-2)}\n#mtx-booking .mtx-note.mtx-warn{background:var(--lim-bg);color:var(--lim-fg)}\n#mtx-booking .mtx-note b{font-weight:700}\n#mtx-booking .mtx-ack{display:flex;gap:8px;align-items:flex-start;margin-top:9px;cursor:pointer;font-weight:600}\n#mtx-booking .mtx-ack input{width:16px;height:16px;margin:2px 0 0;flex:0 0 auto;accent-color:var(--ink)}\n\n#mtx-booking .mtx-fields{display:flex;flex-direction:column;gap:12px}\n#mtx-booking .mtx-pair{display:grid;grid-template-columns:1fr 1fr;gap:17px}\n#mtx-booking .mtx-f label{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:700;letter-spacing:.08em;\n  text-transform:uppercase;color:var(--muted);margin-bottom:5px}\n#mtx-booking .mtx-f label .mtx-num{width:17px;height:17px;font-size:10px}\n#mtx-booking .mtx-sel{position:relative}\n#mtx-booking .mtx-sel:after{content:\"\";position:absolute;right:13px;top:50%;width:7px;height:7px;\n  border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);\n  transform:translateY(-70%) rotate(45deg);pointer-events:none}\n/* one border rule for every state, so no select ever looks different from its neighbour */\n#mtx-booking .mtx-sel select{width:100%;min-height:46px;padding:9px 34px 9px 12px;border:1.5px solid var(--line);\n  border-radius:10px;background:var(--surface);color:var(--ink);font-size:15px;font-weight:600;\n  appearance:none;-webkit-appearance:none;cursor:pointer;transition:.15s;outline:none}\n#mtx-booking .mtx-sel select:hover:not(:disabled){border-color:var(--ink-2)}\n#mtx-booking .mtx-sel select:focus-visible{border-color:var(--c,var(--blue));box-shadow:0 0 0 3px color-mix(in srgb, var(--c,var(--blue)) 22%, transparent)}\n#mtx-booking .mtx-sel select:disabled{opacity:.55;cursor:not-allowed;background:var(--surface-2)}\n\n#mtx-booking .mtx-sums{border:1px solid var(--line-2);border-radius:10px;background:var(--surface-2);overflow:hidden}\n#mtx-booking .mtx-sum{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 14px}\n#mtx-booking .mtx-sum span{font-size:12px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}\n#mtx-booking .mtx-sum b{font-family:\"Barlow Condensed\";font-size:20px;font-weight:700;\n  font-variant-numeric:tabular-nums;line-height:1}\n#mtx-booking .mtx-sum--total{border-top:1px solid var(--line-2);background:var(--surface)}\n#mtx-booking .mtx-sum--total b{font-size:26px;font-weight:800}\n\n/* sized to the words, not the panel \u2014 full width only where the panel is narrow */\n#mtx-booking .mtx-go{min-height:44px;padding:11px 26px;border:0;border-radius:9px;background:var(--ink);\n  color:#FFFFFF;font-family:\"Barlow Condensed\";font-size:15px;font-weight:700;\n  letter-spacing:.05em;text-transform:uppercase;cursor:pointer;transition:.15s;\n  align-self:flex-start;text-align:center}\n#mtx-booking .mtx-go:hover:not(:disabled){transform:translateY(-1px);box-shadow:var(--shadow-lg)}\n/* waiting, not broken: an outline that reads as \"one more thing to do\" */\n#mtx-booking .mtx-go:disabled{background:transparent;color:var(--muted);border:1.5px dashed var(--line);\n  cursor:not-allowed;transform:none;box-shadow:none}\n\n/* ---------- alignment, stated rather than inherited ----------\n   Setting text-align on the widget root is not enough. A host rule such as\n   `#allrecords *{text-align:center}` matches each element directly, and a\n   direct match beats an inherited value however specific the ancestor rule is.\n   The live page centred every description that way.\n\n   So every element inside the card is told explicitly, at a specificity an id\n   plus a class cannot lose to, and the handful that genuinely centre are told\n   back again one level higher. */\n#mtx-booking,\n#mtx-booking .mtx-card,\n#mtx-booking .mtx-card *{text-align:left}\n\n#mtx-booking .mtx-card .mtx-dow span,\n#mtx-booking .mtx-card .mtx-day,\n#mtx-booking .mtx-card .mtx-load,\n#mtx-booking .mtx-card .mtx-state,\n#mtx-booking .mtx-card button{text-align:center}\n@media (max-width:640px){ #mtx-booking .mtx-go{width:100%;align-self:stretch} }\n\n@media (max-width:860px){ #mtx-booking .mtx-picker{grid-template-columns:repeat(2,1fr)} }\n@media (max-width:520px){ #mtx-booking .mtx-pair{grid-template-columns:1fr} }\n\n/* footer strip */\n#mtx-booking .mtx-foot{padding:16px 26px 22px;border-top:1px solid var(--line-2);background:var(--surface-2);\n  display:flex;flex-wrap:wrap;gap:8px 22px;font-size:12px;color:var(--muted);font-weight:600}\n#mtx-booking .mtx-foot span{display:inline-flex;align-items:center;gap:6px}\n\n@media (max-width:720px){\n  #mtx-booking .mtx-mast, #mtx-booking .mtx-cal, #mtx-booking .mtx-tix, #mtx-booking .mtx-foot{padding-left:16px;padding-right:16px}\n  #mtx-booking .mtx-band{margin-left:16px;margin-right:16px;padding:18px 16px}\n  #mtx-booking .mtx-detail{padding:18px 16px}\n  #mtx-booking .mtx-day .mtx-tag{display:none}\n  #mtx-booking .mtx-day{min-height:54px}\n  #mtx-booking .mtx-months{grid-template-columns:repeat(2,1fr)}\n}\n\n/* ---------- states the prototype never had ---------- */\n/* The prototype always had its data. A live widget has to say so when it does\n   not, and give the guest a way to try again rather than a blank rectangle. */\n#mtx-booking .mtx-state{padding:56px 26px;text-align:center;color:var(--ink-2)}\n#mtx-booking .mtx-state h3{font-size:22px;font-weight:700;margin-bottom:8px}\n#mtx-booking .mtx-state p{font-size:15px;color:var(--muted);max-width:46ch;margin:0 auto}\n#mtx-booking .mtx-retry{margin-top:18px;min-height:44px;padding:11px 26px;border:0;border-radius:9px;\n  background:var(--blue);color:var(--blue-ink);font-family:\"Barlow Condensed\";font-size:15px;\n  font-weight:700;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;transition:.15s}\n#mtx-booking .mtx-retry:hover{background:var(--blue-on)}\n/* Errors raised at the point of paying belong beside the button, not in an\n   alert box the guest has to dismiss before they can see what went wrong. */\n#mtx-booking .mtx-fail{margin-top:12px;padding:12px 13px;border-radius:9px;font-size:13.5px;line-height:1.5;\n  background:var(--full-bg);color:var(--full-fg);font-weight:600}\n";

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
      '<div class="mtx-sec-label"><span class="mtx-num">1</span>Select your month</div>' +
      '<div class="mtx-months" data-months></div>' +
      '<div class="mtx-sec-label mtx-gap"><span class="mtx-num">2</span>Choose your date</div>' +
      '<p class="mtx-month-note">' +
        '<svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="2"/><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3"/></svg>' +
        '<span>You are choosing dates for <b data-monthnote></b></span>' +
      '</p>' +
      '<div class="mtx-dow"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>' +
      '<div class="mtx-grid" data-grid></div>' +
    '</section>' +
    '<div data-out></div>' +
    '<div class="mtx-foot"><span>' +
      '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.8"/><path d="M5.4 7V5a2.6 2.6 0 0 1 5.2 0v2"/></svg>' +
      'Your payment details are encrypted and protected by Stripe\u2019s enterprise-level security' +
    '</span></div>' +
    '</div></div>';
}

// Warming the checkout is a page-wide job, not a per-widget one.
var warmed = false;

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
    qty: 0,
    cur: null,
    busy: false
  };

  var cal    = root.querySelector("[data-cal]");
  var months = root.querySelector("[data-months]");
  var grid   = root.querySelector("[data-grid]");
  var note   = root.querySelector("[data-monthnote]");
  var out    = root.querySelector("[data-out]");

  /* ---------------------------------------------------------------------------
     Helpers
     -------------------------------------------------------------------------*/
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
    var a = 'width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
    if(k === "cal")   return '<svg '+a+'><rect x="2" y="3" width="12" height="11" rx="2"/><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3"/></svg>';
    if(k === "clock") return '<svg '+a+'><circle cx="8" cy="8" r="6.2"/><path d="M8 4.6V8l2.4 1.4"/></svg>';
    return '<svg '+a+'><path d="M8 14.5s5-4.2 5-8a5 5 0 0 0-10 0c0 3.8 5 8 5 8Z"/><circle cx="8" cy="6.4" r="1.8"/></svg>';
  }

  // Five statuses come back from the database. `closed` and `booking_closed` look
  // alike and mean opposite things: one may open later tonight, the other never
  // will. They are kept apart here for exactly that reason.
  function statusMeta(st){
    if(st === "available")      return {cls:"mtx-ok",   label:"Available", live:true};
    if(st === "limited")        return {cls:"mtx-lim",  label:"Limited",   live:true};
    if(st === "fully_booked")   return {cls:"mtx-full", label:"Fully booked", live:false};
    if(st === "booking_closed") return {cls:"mtx-shut", label:"Booking closed", live:false};
    return {cls:"mtx-shut", label:"Closed", live:false};
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

  function showLoading(message){
    panel('<div class="mtx-load"><div class="mtx-spin"></div>' + esc(message) + '&hellip;</div>');
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
      openNight("");
      return;
    }
    cal.hidden = true;
    showLoading("Loading fight nights");

    var from = todayAtVenue();
    call("availability", { action:"events", from:from, to:addMonths(from, MONTHS_AHEAD) }, READ_TIMEOUT)
      .then(function(data){
        state.events = {};
        state.months = [];
        var firstHighlighted = null;
        (data.events || []).forEach(function(ev){
          // Every night stays bookable, always. A page built around one
          // promotion highlights its own nights, but a guest who fancies the
          // Wednesday instead can still book the Wednesday. Greying out a night
          // that has a fight on it, or worse marking it "No fight", tells a
          // paying customer there is nothing to buy when there is.
          ev.highlighted = !opts.series
            || opts.series.indexOf(String(ev.series || "").toLowerCase()) !== -1;
          if(ev.highlighted && !firstHighlighted) firstHighlighted = ev.date;
          state.events[ev.date] = ev;
          var k = monthKey(ev.date);
          if(state.months.indexOf(k) === -1) state.months.push(k);
        });
        state.months.sort();

        // Only when the whole calendar is empty. A promotion page whose own
        // nights have all been and gone still shows every other night rather
        // than this, because those nights are on sale and this says they are not.
        if(state.months.length === 0){
          showProblem("No fight nights on sale",
            "There are no dates open for booking at the moment. Please check back shortly, or message us and we will help.",
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
        renderMonths();
        renderCal();
      })
      .catch(function(err){
        // The first load failing used to leave the widget blank for good. It now
        // says what happened and offers the guest a second attempt.
        showProblem("We could not load the fight nights", err.message, "Try again");
      });
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
      html += '<button class="mtx-day' + (state.date === key ? " mtx-sel" : "") +
              (ev.highlighted ? " mtx-hi" : "") + '" data-date="' + key + '" ' +
              'style="--evt:' + esc(ev.colour || "#6E655C") + '" ' +
              'aria-label="' + esc(ev.name + ", " + longDate(key)) + '">' +
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
    (cal.querySelector(".mtx-gap") || grid).scrollIntoView({behavior:"smooth", block:"start"});
  }

  /* ---------------------------------------------------------------------------
     Choosing a date hands the screen to the night
     -------------------------------------------------------------------------*/
  function openNight(date){
    state.date = date;
    state.cls = null; state.qty = 0; state.cur = null;
    renderCal();

    cal.hidden = true;
    showLoading("Checking live availability");
    out.scrollIntoView({behavior:"smooth", block:"start"});

    var started = Date.now();
    var eventKey = state.events[date].eventKey;

    call("availability", { action:"availability", eventKey:eventKey }, READ_TIMEOUT)
      .then(function(data){
        // Hold the message on screen long enough to be read.
        var wait = Math.max(0, MIN_CHECK_MS - (Date.now() - started));
        setTimeout(function(){
          if(state.date !== date) return;    // the guest moved on while we waited
          state.night = filterClasses(data);
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
    state.date = null; state.night = null; state.cls = null; state.qty = 0; state.cur = null;
    panel("");
    cal.hidden = false;
    renderCal();
    cal.scrollIntoView({behavior:"smooth", block:"start"});
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

  /* ---- 3a: the four choices, name and status only ---- */
  function seatStep(){
    // Nothing to choose between, so open it.
    if(!state.cls && state.night.classes.length === 1){
      state.cls = state.night.classes[0].code;
    }
    if(!state.cls){
      return '<div class="mtx-tix-h"><h3><span class="mtx-num">3</span>Select your seat class</h3></div>' +
             '<div class="mtx-picker">' + state.night.classes.map(pickButton).join("") + '</div>';
    }
    return '<div class="mtx-tix-h"><h3><span class="mtx-num">3</span>Your seats</h3></div>' + classDetail(chosen());
  }

  function chosen(){
    for(var i = 0; i < state.night.classes.length; i++){
      if(state.night.classes[i].code === state.cls) return state.night.classes[i];
    }
    return null;
  }

  function pickButton(t){
    var meta = statusMeta(t.status);
    return '<button class="mtx-pick' + (meta.live ? "" : " mtx-pick--off") + '" data-pick="' + esc(t.code) + '" ' +
      'style="--c:' + esc(t.colour || "#6E655C") + ';--ci:' + esc(t.ink || "#3A342D") + '">' +
      '<span class="mtx-pick-bar"></span>' +
      '<span class="mtx-pick-name">' + esc(t.name) + '</span>' +
      '<span class="mtx-pill ' + meta.cls + '"><i></i>' + meta.label + '</span>' +
    '</button>';
  }

  /* ---- 3b: the one chosen class ---- */
  function classDetail(t){
    var meta = statusMeta(t.status);
    var body;

    if(t.status === "closed"){
      // The explanation is required by the database, so there is always one.
      body = '<div class="mtx-note">' + esc(t.closedExplanation || "This seat class is not on sale for this date.") + '</div>';
    } else if(t.status === "booking_closed"){
      body = '<div class="mtx-note">Online booking has now closed for this fight night. ' +
             'Please choose another date, or message us and we will do what we can.</div>';
    } else if(!meta.live){
      body = '<div class="mtx-note">' + esc(t.name) + ' is now officially Fully Booked. ' +
             'Click the Change seat class button below to check alternative section availability.</div>';
    } else {
      var cur = state.cur || (t.prices[0] && t.prices[0].currency);
      var max = Math.max(1, Math.min(10, t.maxPerOrder || 10));
      body =
        '<div class="mtx-fields">' +
          '<div class="mtx-pair">' +
            '<div class="mtx-f"><label for="mtxQty"><span class="mtx-num">4</span>Number of tickets</label>' +
              '<div class="mtx-sel"><select id="mtxQty" data-qty>' +
                '<option value="">Select</option>' + qtyOpts(max) +
              '</select></div></div>' +
            '<div class="mtx-f"><label for="mtxCur"><span class="mtx-num">5</span>Choose your currency</label>' +
              '<div class="mtx-sel"><select id="mtxCur" data-cur>' +
                t.prices.map(function(p){
                  return '<option value="' + esc(p.currency) + '"' + (p.currency === cur ? " selected" : "") + '>' +
                         esc(p.currency.toUpperCase()) + '</option>';
                }).join("") +
              '</select></div></div>' +
          '</div>' +
          '<div data-seat></div>' +
          '<div class="mtx-sums">' +
            '<div class="mtx-sum"><span>Price per ticket</span><b data-unit>&mdash;</b></div>' +
            '<div class="mtx-sum mtx-sum--total"><span>Total</span><b data-total>&mdash;</b></div>' +
          '</div>' +
          '<button class="mtx-go" data-go disabled>Select number of tickets</button>' +
          '<div data-fail></div>' +
        '</div>';
    }

    return '<section class="mtx-detail" style="--c:' + esc(t.colour || "#6E655C") + ';--ci:' + esc(t.ink || "#3A342D") + '">' +
      '<div class="mtx-detail-k">You have chosen</div>' +
      '<div class="mtx-detail-top">' +
        '<h3 class="mtx-detail-h">' + esc(t.name) + '</h3>' +
        '<span class="mtx-pill ' + meta.cls + '"><i></i>' + meta.label + '</span>' +
      '</div>' +
      (t.description ? '<p class="mtx-detail-d">' + esc(t.description) + '</p>' : "") +
      body +
      (state.night.classes.length > 1
         ? '<button class="mtx-detail-change" data-back-class>Change seat class</button>' : "") +
    '</section>';
  }

  // The cap is whatever the database says is left, never more than ten. A guest
  // is not offered eight seats when six remain.
  function qtyOpts(max){
    var o = "";
    for(var i = 1; i <= max; i++) o += '<option value="' + i + '">' + i + (i === 1 ? " ticket" : " tickets") + '</option>';
    return o;
  }

  function priceFor(t, cur){
    for(var i = 0; i < t.prices.length; i++) if(t.prices[i].currency === cur) return t.prices[i].unitAmount;
    return null;
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
    var seatWrap= out.querySelector("[data-seat]");

    var cur = state.cur || (t.prices[0] && t.prices[0].currency);
    state.cur = cur;
    var unit = priceFor(t, cur);

    if(unitEl) unitEl.textContent = unit == null ? "—" : money(cur, unit);
    totalEl.textContent = (state.qty && unit != null) ? money(cur, unit * state.qty) : "—";

    var together = t.assignedSeating ? Number(t.maximumSeatsTogether || 0) : 0;
    var needsAck = together > 0 && state.qty > together;

    if(seatWrap){
      if(needsAck && !seatWrap.dataset.built){
        seatWrap.innerHTML =
          '<div class="mtx-note mtx-warn"><b>We can seat ' + together + ' of your group together.</b> ' +
          'The rest will be in the same class, but not side by side.' +
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

    call("create-checkout", {
      eventKey: state.night.event.eventKey,
      classCode: t.code,
      quantity: state.qty,
      currency: state.cur,
      seatingAcknowledged: !!(ack && ack.checked)
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

  grid.addEventListener("click", function(e){
    var b = e.target.closest("[data-date]");
    if(b) openNight(b.getAttribute("data-date"));
  });

  out.addEventListener("click", function(e){
    if(e.target.closest("[data-retry]")){
      if(state.date) openNight(state.date); else boot();
      return;
    }
    if(e.target.closest("[data-back-date]")){ backToDates(); return; }

    var pick = e.target.closest("[data-pick]");
    if(pick){
      warmCheckout();
      state.cls = pick.getAttribute("data-pick");
      state.qty = 0;
      out.querySelector(".mtx-tix").innerHTML = seatStep();
      update();
      out.querySelector(".mtx-tix").scrollIntoView({behavior:"smooth", block:"nearest"});
      return;
    }

    if(e.target.closest("[data-back-class]")){
      state.cls = null; state.qty = 0;
      out.querySelector(".mtx-tix").innerHTML = seatStep();
      out.querySelector(".mtx-tix").scrollIntoView({behavior:"smooth", block:"nearest"});
      return;
    }

    if(e.target.closest("[data-go]") && !e.target.closest("[data-go]").disabled) reserve();
  });

  out.addEventListener("change", function(e){
    if(e.target.hasAttribute("data-qty")){ state.qty = e.target.value ? +e.target.value : 0; update(); return; }
    if(e.target.hasAttribute("data-cur")){ state.cur = e.target.value; update(); return; }
    if(e.target.hasAttribute("data-ack")) update();
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
  return {
    eventKey: event || null,
    classes: classes.length ? classes : null,
    series: series.length ? series : null,
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
