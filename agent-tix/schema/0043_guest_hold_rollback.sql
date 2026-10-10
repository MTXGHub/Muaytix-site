-- Agent Tix — rollback for 0043_guest_hold.sql
--
-- NOT APPLIED. Written 10 October 2026 so it is ready before 0043 goes live.
--
-- What 0043 did to the database: it created three functions and nothing else. No
-- table, column, index, trigger, view or existing function was touched, and its
-- grants and revokes name only those three functions. So rolling back is
-- dropping exactly those three. Their access settings go with them.
--
-- What it does NOT undo, because there is nothing to undo: any reservation that
-- a seat change marked 'released' stays as it is. 'released' was already an
-- allowed status, and the existing code already treats it as a hold that is over.
--
-- Safe order when going back (each step is safe on its own):
--   1. paste the previous header back into Tilda (publish one test page first)
--   2. redeploy the three previous functions (availability, create-checkout,
--      stripe-webhook-v2), from agent-tix/functions/live-before-guest-hold/
--   3. run this file
-- Running this first is also safe. The new functions treat a missing hold function
-- as "no hold" and carry on exactly as before, but there is no reason to rely on it.
--
-- The Supabase migration tool cancels any migration containing "drop" (see
-- CLAUDE.md section 9). If it does, run these three lines through the plain SQL
-- tool once Jason has said go: that is the one case the plain tool is for.

drop function if exists public.replace_reservation(uuid, uuid, integer, timestamptz);
drop function if exists public.class_view_for_holder(uuid, integer);
drop function if exists public.live_hold(uuid, text);
