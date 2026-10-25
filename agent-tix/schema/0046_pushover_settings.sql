-- Where the Pushover keys live: private settings row, same table as the tracker link.
-- The keys themselves are set by hand in the database and are never in git.
alter table public.stadium_sync_settings add column if not exists pushover_user_key text;
alter table public.stadium_sync_settings add column if not exists pushover_app_token text;
alter table public.stadium_sync_settings add column if not exists pushover_enabled boolean not null default false;
