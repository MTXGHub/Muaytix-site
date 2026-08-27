# MuayTix Tonight — React → Webflow rebuild

Source design: `MTXGHub/muaytix-tonight` (Manus-built Vite + React app).
Target: Webflow site **MTX Tonight** (`mtx-tonight`, id `6a852790915d21261647d825`),
Home page id `6a852795915d21261647d85b`.

The React app was **not** ported or embedded. Webflow cannot run React — no bundler, no
JSX compilation, no build step. Instead the design was rebuilt as native Webflow elements
and classes, so it stays editable in the Designer.

This worked cleanly because the original CSS is hand-written and semantic
(`.hero-feature__card`, `.story-rail`, `.blue-blade`) rather than Tailwind utility soup.
Tailwind is imported in `index.css` but the visual design does not use it, so it dropped away.

## What was built

Page structure, all as native Webflow elements with semantic tags:

```
page-shell
├── header            sticky; 3-column desktop grid + separate mobile bar
├── main
│   ├── hero          feature image, live badge, overlapping white card, fight-card rail
│   ├── event-band    textured near-black band, 2 fighter cards, matchup, countdown
│   └── featured      section heading, lead card, support grid, story stack, sidebar
├── footer
├── cookie-tray       fixed
└── mobile-menu       fixed overlay, hidden by default
```

Six article cards carry hardcoded badge numbers 01–06. The original used CSS
`counter-increment`, which does not survive the conversion, and the numbers are static
anyway.

## Webflow's WHTML builder constraints

The builder validates CSS hard. Every rule below forced a rewrite of the original stylesheet:

| Constraint | Consequence |
|---|---|
| **Single class selectors only** | No descendants (`.a .b`), no child combinators (`.a > .b`), no element selectors (`body`, `img`), no ids. Every variant became its own class — `.brand__mark--compact`, `.article-card__title--horizontal`, etc. |
| **No pseudo-elements** | All `::before` / `::after` became real child divs: `.brand__underline`, `.fighter__blade`, `.article-card__notch`, `.lead-card__badge`, `.editorial-stream__line`, `.dispatch-visual__halo`, `.hero-feature__scrim`. |
| **Fixed breakpoints only** | Webflow allows `991px` / `767px` / `479px` (and min-width 1280/1440/1920). The design's `1120px` / `920px` / `680px` were remapped — see below. |
| **Images must be asset-library uploads** | External URLs are silently skipped. All five images still need uploading. |

### Breakpoint remapping

| Original | Webflow | Note |
|---|---|---|
| `≤1120px` | `≤991px` | merged |
| `≤920px` | `≤991px` | merged — mobile header now appears at 991px instead of 920px |
| `≤680px` | `≤767px` | |

The 1120 and 920 tiers collapsed into one because Webflow has no breakpoint between them.
Practical effect: the desktop nav switches to the mobile bar slightly earlier than the
original. If that matters, the alternative is pushing the 920 rules down to 767, which
keeps the desktop nav to narrower widths but makes the 2-column hero cramped around 800px.

## Outstanding

**1. Images — five needed, none present.**

`Home.tsx` references two files that do not exist in the repo. `vite.config.ts` proxies
`/manus-storage/*` at runtime to Manus's Forge storage using `BUILT_IN_FORGE_API_KEY`,
so they are not committed anywhere:

- `muaytix-hero_0340ddfa.jpg` — hero photo
- `muaytix-ticket-mark_575eef5d.png` — logo mark (used 4×: header, mobile menu, dispatch card, footer)

Three more are Unsplash URLs, which Webflow skipped because they are not in the asset library:

- `photo-1549719386-74dfcbf7dbed` — lead card
- `photo-1517438476312-10d79c077509` — support card 02
- `photo-1549060279-7e168fcee0c2` — story stack 06

Until uploaded, the logo and hero render as geometric placeholders built from the design's
own language (notched blue mark, dark diagonal panel), and the three photo slots are empty
image elements.

**2. Fonts.** Barlow and Barlow Condensed are Google Fonts. Webflow's API only manages
uploaded custom font files, so they must be added under **Site settings → Fonts → Google
Fonts**. Every insert returned `missing_font` warnings; type currently falls back to Arial
Narrow. `behaviour.js` injects the stylesheet as a stopgap, but the native route is what
makes the faces appear in the Designer font picker.

**3. Custom code is plan-gated.** `behaviour.js` is registered with Webflow as inline script
`muaytix_behaviour` v1.0.0 and hosted on their CDN, but attaching it returns
`404 Custom code block not found` — the site is on a free plan with no custom domains.
Until the site is on a paid plan, the countdown is static text, the mobile menu will not
open, and the cookie tray cannot be dismissed. Everything visual works regardless.

**4. Toast placeholders dropped.** The React version fired `sonner` toasts saying things
like "is part of the next prototype stage" for Search, Watch, Shop, Follow, Set reminder,
and both ticket buttons. Those are mockup scaffolding, not functionality, so the elements
became ordinary anchors pointing at section anchors. They need real destinations.

**5. Newsletter form.** Built as a plain `<form>`. Converting it to a native Webflow form
element would capture submissions in Webflow's form dashboard, which the React version
could not do.

## Not published

Everything above is in the Webflow staging/Designer state. The site has not been published,
so the live URL still shows the previous content.
