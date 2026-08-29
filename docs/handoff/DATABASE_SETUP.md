# WoofWatcher — Database Setup Runbook (for Claude Code)

This turns the repo's real Drizzle schema (`lib/db/src/schema/*`) into a live
database. It was prepared in Cowork; **Claude Code applies it** (it needs the
DATABASE_URL secret + push access this sandbox doesn't have). Designed against
the actual schema and verified against the live Supabase org.

## 0. Critical: use a DEDICATED WoofWatcher project

The Supabase project currently connected to this account
(`Pegasus Command Center`, id `knfmdyufodbnqsgkzhqw`) belongs to a **different
app** — its tables are `accounts`, `organizations`, `memberships`,
`product_subscriptions`, `war_room_invitations`, `legal_documents`, etc. **Do
NOT apply WoofWatcher tables there.** Create a new Supabase project (e.g.
`woofwatcher-prod`) in the same org, or a separate database, and use its
connection string. This keeps the two products isolated.

## 1. The schema (8 tables, household-scoped)

- `users` — Clerk-backed (`id` = Clerk user id), JIT-provisioned.
- `households` — one shared, synced care profile + log per household.
- `household_members` — user↔household with `role` + optional access-pass expiry.
- `household_invitations` — durable invite lifecycle (approved/accepted/revoked…).
- `household_audit_events` — provider-durable sharing/audit trail.
- `care_state` — the synced care document (jsonb) with optimistic `version`.
- `care_entries` — append-only care log rows (concurrency-safe).
- `care_entry_tombstones` — deletions that must propagate across devices.

Everything is scoped by `household_id` with `on delete cascade`. Helpful indexes
are in the migration (care_entries by household+time, members by user, etc.).

## 2. Auth + RLS model (do not skip)

WoofWatcher authenticates with **Clerk**, and **all data access goes through the
api-server** (`artifacts/api-server`), which connects to Postgres directly via
`DATABASE_URL` and authorizes in the app layer
(`household-authorization.ts`, `care-entry-authorization.ts`). Clients never
talk to Supabase directly.

So RLS is **deny-by-default as a breach backstop**, not the primary authz:
`0002_woofwatcher_rls.sql` enables RLS with no client policies and revokes
anon/authenticated privileges. The server's Postgres role bypasses RLS and keeps
working; a leaked anon key exposes nothing. (An optional Clerk-JWT policy
template is included, commented, only for a future direct-client model.)

## 3. Apply the canonical migrations

Prereq: create the dedicated project (§0), grab its connection string, and set
`DATABASE_URL` in the environment.

Apply every numbered migration exactly once, in order, to the dedicated
WoofWatcher database. Stop on the first error; do not skip ahead.

```bash
export DATABASE_URL="postgres://…dedicated-woofwatcher-db…"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0001_woofwatcher_init.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0002_woofwatcher_rls.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0003_care_entries_client_key.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0004_users_active_household.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0005_private_care_entry_isolation.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0006_household_role_canonicalization.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0007_care_entry_create_revocation.sql
```

You may instead paste those same files into the Supabase SQL editor in the same
order. Record which migrations were applied before running any later migration
against an existing database.

`pnpm --filter @workspace/db run push` remains useful for disposable local
development. Drizzle push mirrors the declared final columns, checks, and
indexes, but it does not run the required data backfills, legacy-role
normalization, RLS/revocation statements, or other ordered migration work. It
is not an equivalent release-provisioning path.

## 4. Verify

```sql
-- 8 WoofWatcher tables exist:
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('users','households','household_members',
    'household_invitations','household_audit_events','care_state',
    'care_entries','care_entry_tombstones')
order by table_name;

-- RLS is on for all of them:
select relname, relrowsecurity from pg_class
where relname in ('users','households','household_members',
  'household_invitations','household_audit_events','care_state',
  'care_entries','care_entry_tombstones');
```
Then from the repo: `pnpm --filter @workspace/api-server run typecheck` and start
the server with `DATABASE_URL` set to confirm it connects and the care-state /
care-entries routes read/write.

## 5. How this connects to the roadmap

This is backend task #1 in `BUILD_STATE_AND_ROADMAP_2026-07-13.md`. After the DB
is live: wire Clerk (task #2) → deploy the api-server (#3) → then satisfy the
care-entry **sync proof** (Supabase project id, this migration/backfill, RLS,
retention/export/deletion policy) and flip the sync gate (#4). The proof-gate
system stays honest: sync only turns on once this is genuinely in place.

## 6. Env vars this needs

`DATABASE_URL` (the dedicated WoofWatcher Postgres/Supabase connection string).
Later, for the running server: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`,
`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `EXPO_PUBLIC_DOMAIN`, and the
Gemini/OpenAI keys for WoofGuide (see `.env.example`).
