-- WoofWatcher — initial schema (mirrors lib/db/src/schema/*.ts exactly)
-- Postgres 16/17. Safe to run on a fresh, DEDICATED WoofWatcher database.
-- gen_random_uuid() is built into Postgres 13+; no extension needed.
--
-- NOTE: you can create these tables either by running this file, OR by running
-- `pnpm --filter @workspace/db run push` (drizzle-kit) with DATABASE_URL set.
-- Both produce the same tables. This file exists so you can apply via the
-- Supabase SQL editor and so the schema is reviewable in the repo. Run
-- 0002_woofwatcher_rls.sql AFTER this.

begin;

-- Clerk-backed users. `id` is the Clerk user id (JIT-provisioned on first request).
create table if not exists public.users (
  id            text primary key,
  email         text,
  display_name  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- A household groups caregivers and shares one synced care profile + log.
create table if not exists public.households (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  invite_code  text not null unique,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Links a user to a household (many-to-many) with a role.
create table if not exists public.household_members (
  id                      uuid primary key default gen_random_uuid(),
  household_id            uuid not null references public.households(id) on delete cascade,
  user_id                 text not null references public.users(id) on delete cascade,
  role                    text not null default 'member',
  display_name            text,
  access_pass_expires_at  timestamptz,
  created_at              timestamptz not null default now(),
  unique (household_id, user_id)
);
create index if not exists household_members_user_id_idx on public.household_members (user_id);
create index if not exists household_members_household_id_idx on public.household_members (household_id);

-- Durable invitation lifecycle rows.
create table if not exists public.household_invitations (
  id                   uuid primary key default gen_random_uuid(),
  household_id         uuid not null references public.households(id) on delete cascade,
  invite_code          text not null unique,
  invited_email        text,
  invited_user_id      text,
  role                 text not null default 'adult',
  lifecycle_state      text not null default 'approved',
  created_by_user_id   text not null,
  approved_by_user_id  text,
  accepted_by_user_id  text,
  revoked_by_user_id   text,
  rejected_by_user_id  text,
  note                 text,
  expires_at           timestamptz,
  accepted_at          timestamptz,
  revoked_at           timestamptz,
  rejected_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  metadata             jsonb
);
create index if not exists household_invitations_household_id_idx on public.household_invitations (household_id);

-- Provider-durable audit trail for household/sharing actions.
create table if not exists public.household_audit_events (
  id               text primary key,
  household_id     uuid not null references public.households(id) on delete cascade,
  action           text not null,
  lifecycle_state  text not null,
  actor_user_id    text not null,
  target_member_id uuid,
  target_user_id   text,
  target_role      text,
  next_role        text,
  reason           text,
  note             text,
  expires_at       timestamptz,
  created_at       timestamptz not null default now(),
  metadata         jsonb
);
create index if not exists household_audit_events_household_id_created_at_idx
  on public.household_audit_events (household_id, created_at desc);

-- The synced config document for a household (pet profile, diet, routines,
-- goals, records, calendar). Opaque JSON blob with optimistic versioning.
create table if not exists public.care_state (
  household_id uuid primary key references public.households(id) on delete cascade,
  doc          jsonb not null default '{}'::jsonb,
  version      integer not null default 1,
  updated_by   text,
  updated_at   timestamptz not null default now()
);

-- Append-only care log entries (individual rows so concurrent caregivers
-- never clobber each other).
create table if not exists public.care_entries (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null references public.households(id) on delete cascade,
  pet_id             text,
  type               text not null,
  occurred_at        timestamptz not null default now(),
  caregiver_user_id  text,
  caregiver_name     text,
  mood               text,
  severity           text,
  note               text,
  details            jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists care_entries_household_occurred_idx
  on public.care_entries (household_id, occurred_at desc);
create index if not exists care_entries_household_type_idx
  on public.care_entries (household_id, type);

-- Tombstones so deletes propagate across devices in the sync model.
create table if not exists public.care_entry_tombstones (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null references public.households(id) on delete cascade,
  entry_id           uuid not null,
  pet_id             text,
  deleted_by_user_id text,
  deleted_at         timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists care_entry_tombstones_household_entry_idx
  on public.care_entry_tombstones (household_id, entry_id);

commit;
