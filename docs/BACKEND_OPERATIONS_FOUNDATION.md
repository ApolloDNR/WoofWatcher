# Backend Operations Foundation

Last updated: 2026-06-05

## Current Decision

Keep WoofWatcher local-first while adding backend-ready contracts that a future Replit, Vercel, Supabase, or native implementation can wire to real services.

The current UI remains a functional placeholder. This layer is for the product and data functions that should survive the high-end UI rebuild.

## Implemented In This Slice

- `src/woof-operations.js`
  - Append-only audit event helper with secret/token redaction.
  - Talk-to-log draft builder for caregiver text or voice transcripts.
  - Hosted nudge job planner with backend/provider blockers and daily nudge budget.
  - Monthly report artifact packager with export audit proof.
- `test/woof-operations.test.mjs`
  - Proves token-like audit metadata is redacted.
  - Proves bile incident talk-to-log drafts do not auto-save and keep veterinarian boundaries visible.
  - Proves hosted nudges do not claim closed-app delivery until backend, household, and provider decisions exist.
  - Proves report artifacts package exportable text without raw local state.
- `src/woof-product-view-model.js`
  - Now exposes `operations.reportArtifact`, `operations.hostedNudges`, `operations.talkToLogDraft`, and `operations.auditTrail`.

## Backend Boundaries

This slice does not create real accounts, send notifications, store cloud data, or generate auth tokens.

It creates the contracts needed for those services:

- A durable audit event shape.
- A hosted reminder/nudge job shape.
- A report artifact shape.
- A talk-to-log draft shape that can be reviewed before saving.

## Talk-To-Log

`buildTalkToLogDraft(text, options, now)` turns caregiver text or a future voice transcript into a reviewed log draft.

It can infer common Phoenix care events:

- Yellow bile or vomit.
- Meals, snacks, and appetite notes.
- Walks and durations.
- Training wins.
- Social exposure.
- Alone time.
- Potty, pee, poop.
- Medication, vet notes, weight checks, mood notes.

Drafts are never auto-saved. The UI must show a review step before adding them to Phoenix's care log.

## Hosted Nudges

`buildHostedNudgePlan(state, options, now)` turns today's reminders into backend-ready jobs.

The plan stays `local_only` until:

1. A backend is configured.
2. A household id exists.
3. A push/email/SMS provider is configured.

It also carries:

- Daily nudge budget.
- Quiet hours.
- Local notification status.
- Explicit closed-app push boundary.
- Per-job audit events.

## Report Artifacts

`buildReportArtifact(state, options, now)` packages the monthly report as a shareable artifact.

Current formats:

- `text`: downloadable text content.
- `print_pdf`: PDF contract for browser/server rendering, without raw local state.

## Still Not Implemented

- Real hosted database writes.
- Real account auth.
- Real push/email/SMS delivery.
- Server-side PDF rendering.
- Voice transcription.
- Real audit storage.

Do not claim those are shipped until service wiring and verification exist.
