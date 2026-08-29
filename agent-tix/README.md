# Agent Tix

Bespoke booking platform for MuayTix. Stage 1 replaces the current Tilda-embedded
widgets; Stage 2 (white-label, other agents) is a confirmed direction but not built here.

Working from *Agent Tix — Design Brief & Requirements* and *Agent Tix — Project Plan &
Build Sequence*, both dated 24 August 2026.

Start with [`notes/current-state.md`](notes/current-state.md). It records what is actually
running today, read from the live Supabase project rather than from the documents, and it
corrects a few assumptions in them.

## Status

Phase 1 (data foundation) is drafted and tested locally. **Nothing has been applied to any
Supabase project.** The build environment question is deliberately still open — the point of
drafting first was to have something concrete to review before spending on infrastructure.

```
agent-tix/
├── notes/current-state.md      what is live today, and what it means for the plan
└── schema/
    ├── 0001_foundation.sql     tenants, venues, ticket_classes
    ├── 0002_events.sql         event_series, events
    ├── 0003_inventory.sql      event_ticket_classes, prices, status rule, guest view
    └── tests/
        └── status_and_constraints.sql
```

## Running the schema and its tests

Against any scratch Postgres 16+ (verified on 16.13):

```sh
createdb agenttix
psql -d agenttix -v ON_ERROR_STOP=1 -f schema/0001_foundation.sql
psql -d agenttix -v ON_ERROR_STOP=1 -f schema/0002_events.sql
psql -d agenttix -v ON_ERROR_STOP=1 -f schema/0003_inventory.sql
psql -d agenttix -f schema/tests/status_and_constraints.sql
```

The test file seeds, asserts, and rolls back. Every row it prints should read `PASS`;
24 do at time of writing. It covers the status rule case by case, the constraints, and the
two Section 4 guarantees (all four classes returned, no remaining-count exposed).

## What the schema decides, and why

**Event identity gets its own table.** The one real gap. Today `event_name`,
`event_starts_at`, `event_ends_at`, `venue` and `image_url` are copied onto every
`ticket_inventory` row, there is no description column anywhere, and nothing expresses a
recurring pattern. `events` and `event_series` fix all three.

**The status rule lives in the database, not in a function.** Section 16 confirms Edge
Functions split by job. Availability checking and checkout creation are then separate jobs
that must agree exactly, or a guest sees *Available* and is refused at checkout. Today they
share a helper only because they happen to be in the same file. `ticket_availability_status()`
gives both callers one definition.

**`limited_threshold` defaults to 19, not 20.** Section 5 wants 20-or-more available and
1–19 limited. The rule reads `quantity_available <= limited_threshold`, so 19 produces
exactly that split. There is a test for each side of the boundary.

**A closed class cannot exist without an explanation.** Section 5 asks for this as a defined
requirement rather than a nicety, so it is a CHECK constraint: setting `release_status` to
`not_released` without `closed_explanation` is rejected. No admin screen and no function can
produce a bare "Closed".

**`closed` and `booking_closed` are different statuses.** Not yet opened and may open later
tonight, versus the cutoff for this event has passed. Easy to conflate, and conflating them
is what makes a guest book elsewhere.

**The guest view exposes no counts.** `event_ticket_availability` returns a status and an
order cap, never a remaining quantity (Section 4). A test asserts the columns are absent.

**`tenant_id` is on everything from the start**, per Section 3. `tenants.allowed_origins`
replaces the hardcoded CORS allowlist, which cannot survive Stage 2.

**Existing `event_key` strings carry over unchanged**, so Stripe metadata already written by
`stripe-webhook` stays traceable after a migration.

## What it deliberately does not decide

- **Open Gap 6** (format-of-the-night written per series or per date) is made answerable
  either way rather than answered: `event_series.default_description` holds copy written
  once, `events.description` overrides it for a specific date, null falls back. Whichever
  MuayTix prefers becomes an operating habit, not a migration. Worth knowing that the
  current calendar widget already keys this copy by event title, i.e. per series.
- **RLS policies.** Enabled on every table with no policies, so service-role only, matching
  the pattern `ticket_currency_prices` already documents. Per-tenant policies are a Stage 2
  question and are not guessed at.
- **Open Gaps 1, 2, 3, 9 and 10** — guest detail capture, currency as its own step, mobile
  scroll, refunds, seat selection. All Phase 2/3 design questions. None of them block Phase 1,
  which is why Phase 1 was drafted first.

## Not yet done

- No migration of the 371 existing `ticket_inventory` rows into this shape. That is a
  separate backfill script, and it needs the build environment decision first.
- No Edge Functions. Section 16's split-by-job breakdown starts with availability-for-a-date
  and create-checkout.
- `muaytix-august-scroll-fix` not decoded.
