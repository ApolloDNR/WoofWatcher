# Backend Schema Plan

Last updated: 2026-06-05

## Current Decision

WoofWatcher now has a provider-neutral backend schema contract, but no live database writes are enabled.

This is the bridge between the local-first PWA and a future hosted Replit, Vercel, Supabase, Neon, or other backend.

## Implemented In This Slice

- `src/woof-backend-schema.js`
  - Backend schema plan for households, members, pets, care entries, routines, records, goals, Care Passes, audit events, nudge jobs, and report artifacts.
  - Index, access-policy, migration-step, sync-policy, secret-policy, and deployment-gate descriptions.
  - Backend seed draft builder that maps local Phoenix state into reviewable rows without applying writes.
- `test/woof-backend-schema.test.mjs`
  - Proves the schema includes private caregiver sync resources.
  - Proves the plan avoids leaked model keys or privileged database credentials.
  - Proves seed drafts require a household id and never apply writes automatically.
- `src/woof-product-view-model.js`
  - Now exposes `backend.schema` and `backend.seedDraft` for future UI/backend builders.

## Tables

- `households`
- `members`
- `pets`
- `care_entries`
- `routines`
- `records`
- `goals`
- `care_passes`
- `audit_events`
- `nudge_jobs`
- `report_artifacts`

## Seed Draft Boundary

`buildBackendSeedDraft(state, options, now)` creates a review package only.

It does not:

- Create accounts.
- Apply migrations.
- Insert rows.
- Enable sync.
- Send invites.
- Send notifications.

It stays blocked until a household id exists.

## Deployment Gates

Before live backend work:

1. Choose backend provider.
2. Choose auth provider.
3. Enable and verify access policies before inserting Phoenix data.
4. Review the local backup seed with Apollo.
5. Smoke-test household privacy with read-only checks.
6. Add push/email/SMS consent flow before closed-app nudges.

## Recommended Next Slice

Wire the browser app's local create/update/remove actions through an audit-aware operation wrapper so local state, future cloud sync, and report exports share the same event proof model.
