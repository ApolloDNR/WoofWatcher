# Cloud And Caregiver Foundation

Last updated: 2026-06-05

## Current Decision

Keep building backend/functions/codebase first. Treat the current UI as a test harness and placeholder until the product contract, privacy model, and cloud-readiness are strong enough for a high-end Replit or design-led UI rebuild.

## Implemented In This Slice

- `src/woof-privacy-cloud.js`
  - Scoped Care Pass builder.
  - Caregiver invite draft builder.
  - Role/scope access model.
  - Cloud sync readiness plan.
- `test/woof-privacy-cloud.test.mjs`
  - Proves scoped Care Passes do not export raw local state by default.
  - Proves invite drafts do not generate fake auth tokens.
  - Proves owner/caregiver/sitter/vet/trainer roles stay explicit.
  - Proves sync readiness reports missing backend pieces honestly.
- `src/woof-product-view-model.js`
  - Now exposes `access`, `cloud`, `scopedCarePasses`, and `carePassVariants` for future UI builders.

## Care Pass Model

Care Room Transfer and Care Pass are intentionally different.

- Care Room Transfer: same-household/device handoff. It includes full local state and is importable.
- Care Pass: scoped external share package. It does not include raw local state and is not importable as a backup.

Current scoped variants:

- `vet`: health watch, Bile Watch, records, monthly summary/report, recent health timeline.
- `sitter`: routines, today plan, reminders, diet profile, handoff, recent care.
- `trainer`: training progress, training/social/anxiety goals, recent behavior timeline.
- `emergency`: profile, diet, routines, key records, health watch, latest timeline.
- `weekend`: sitter-style package with a longer recent-care window.

## Access Model

Current roles:

- `owner`: full access.
- `caregiver`: daily care and health-pattern context.
- `sitter`: routine/diet/care proof.
- `vet`: scoped health and records read-only.
- `trainer`: behavior/training/social context.

Invite drafts are local plans only. They do not create tokens, magic links, accounts, or actual access yet.

## Cloud Sync Model

`buildCloudSyncPlan` defines the future backend resources:

- `households`
- `members`
- `pets`
- `care_entries`
- `routines`
- `records`
- `goals`
- `care_passes`
- `audit_events`

The app stays `local_only` until:

1. A backend is chosen/configured.
2. A household id exists.
3. Access/privacy decisions are made.

Default conflict policy:

- Newest edit wins for profile/routines/settings.
- Append-only for logs, records, care passes, and audit events.

## Next Backend Slices

1. Add append-only audit event helpers for local create/update/remove actions.
2. Add durable reminder jobs model for hosted push readiness.
3. Add real PDF/report artifact generation contract.
4. Add provider-neutral database schema draft.
5. Add OpenAI WoofGuide live-mode smoke once the key is approved server-side.

## Still Not Implemented

- Real caregiver accounts.
- Real invitations.
- Real authentication.
- Realtime cloud sync.
- Closed-app push notifications.
- Hosted database.
- Public demo/private Phoenix split.

Do not claim those are shipped until they are implemented and verified.
