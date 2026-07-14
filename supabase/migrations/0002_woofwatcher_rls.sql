-- WoofWatcher — Row-Level Security (run AFTER 0001_woofwatcher_init.sql)
--
-- AUTH MODEL (important — read before changing):
-- WoofWatcher authenticates with CLERK and all data access goes through the
-- api-server (artifacts/api-server), which connects to Postgres directly via
-- DATABASE_URL and does authorization in the app layer
-- (household-authorization.ts, care-entry-authorization.ts). Clients NEVER talk
-- to Supabase/PostgREST directly.
--
-- Therefore the correct posture is DENY-BY-DEFAULT: enable RLS with NO
-- permissive policies for the anon/authenticated roles, and revoke their
-- privileges. The server's Postgres role (service role / `postgres`) has
-- BYPASSRLS, so the app keeps working; but if the anon/publishable key ever
-- leaks, no row is readable or writable through the public API. RLS here is a
-- breach backstop, not the primary authz.
--
-- If you later switch to direct client access with Clerk-as-Supabase
-- third-party auth, uncomment the membership policy template at the bottom.

begin;

-- 1) Lock the public API surface: no PostgREST access for client roles.
revoke all on all tables in schema public from anon, authenticated;

-- 2) Enable RLS on every table (default-deny once enabled with no policies).
alter table public.users                   enable row level security;
alter table public.households              enable row level security;
alter table public.household_members       enable row level security;
alter table public.household_invitations   enable row level security;
alter table public.household_audit_events  enable row level security;
alter table public.care_state              enable row level security;
alter table public.care_entries            enable row level security;
alter table public.care_entry_tombstones   enable row level security;

commit;

-- =====================================================================
-- OPTIONAL — direct-client access via Clerk JWT (ADVANCED, off by default)
-- =====================================================================
-- Only use this if you deliberately switch to letting the mobile client read
-- Supabase directly with a Clerk session JWT configured as a Supabase
-- third-party auth provider (so auth.jwt()->>'sub' is the Clerk user id).
-- Until then, leave these commented — the api-server is the only data path.
--
-- create policy "members read their household care_entries"
--   on public.care_entries for select to authenticated
--   using (
--     household_id in (
--       select hm.household_id from public.household_members hm
--       where hm.user_id = auth.jwt()->>'sub'
--     )
--   );
--
-- create policy "members write their household care_entries"
--   on public.care_entries for insert to authenticated
--   with check (
--     household_id in (
--       select hm.household_id from public.household_members hm
--       where hm.user_id = auth.jwt()->>'sub'
--     )
--   );
--
-- Repeat the same household-membership pattern for care_state,
-- care_entry_tombstones, household_members, and household_invitations, scoping
-- each to the caller's households. Keep users/household_audit_events
-- server-only.
