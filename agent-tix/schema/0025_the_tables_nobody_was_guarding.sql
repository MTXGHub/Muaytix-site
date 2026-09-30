-- Four tables with no Row Level Security at all: ad_spend_daily, pay_structure,
-- pay_bands, widget_looks. Supabase's own weekly scan flagged it and emailed
-- Jason directly, 29 September 2026: anyone with the project's anon key could
-- read, write or delete every row in these, no login required.
--
-- Checked before applying, not assumed: nothing in this codebase touches any
-- of the four with a client-side key. widget_looks is written once, by the
-- availability edge function, using the service role key, which ignores RLS
-- entirely regardless of policies. The other three have no code path at all --
-- they are only ever edited by hand, through Supabase's own dashboard, which
-- also authenticates at a level RLS does not apply to. So enabling RLS with
-- zero policies on all four locks out the anon and authenticated roles (the
-- only roles that were ever exposed to the internet) and changes nothing for
-- anything this project actually runs.
--
-- Applied directly against production via the Supabase MCP tool, 30 September
-- 2026, 11:14 UTC, then confirmed by re-reading the security advisor output:
-- the rls_disabled_in_public finding for all four tables is gone. This file
-- exists so that fact is in git too, not just in Supabase's own migration
-- history -- which is the gap that prompted checking for this file at all:
-- the live database and this repository had already drifted apart before
-- tonight, and this migration would have been one more silent instance of it.

alter table "public"."ad_spend_daily" enable row level security;
alter table "public"."pay_structure"  enable row level security;
alter table "public"."pay_bands"      enable row level security;
alter table "public"."widget_looks"   enable row level security;
