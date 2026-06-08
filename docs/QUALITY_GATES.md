# Quality Gates

## Gate 1: Dog-First Product Clarity

Passing means WoofWatcher is clearly a dog-care operating system, not a generic pet tracker. Dog profile, routines, logs, household sync, health watch, records, reports, and WoofGuide must all connect.

## Gate 2: Routines And Logs

Passing means routines define expected care and logs record actual care. Matching logs satisfy/update routines. Meal logs must capture expected portion, served amount, eaten amount, skipped/partial completion, notes, and household visibility.

Current evidence, 2026-06-08: `deriveRoutineBoard` now links visible logs to matching routines, exposes complete/partial/skipped meal completion, and leaves private logs out of shared routine status. Mobile meal logging now captures expected portion, served amount, eaten amount, meal completion, sticky note, and household visibility.

## Gate 3: Household Trust

Passing means owners and caregivers can see who did what, what is pending, what failed to sync, what was skipped, and what needs follow-up.

Current evidence, 2026-06-08: Today Command now reads the routine board used by Calendar, so partial/skipped handled meals do not create duplicate meal prompts and overdue assigned routines surface with caregiver context.

## Gate 4: Premium Mobile UX

Passing means the mobile app feels warm, polished, clear, fast, and useful every day. No dead buttons, fake screens, or decorative-only workflows.

Current evidence, 2026-06-08: The home Today Command routes users to Log, Calendar, Records, More, or WoofGuide based on the primary care need and explains the selected action with routine name, owner, time, urgency, and sync/health context.

## Gate 5: Health Safety

Passing means health features organize patterns without diagnosis. Urgent red flags direct users to veterinary care. WoofGuide stays bounded.

## Gate 6: Reports And Records

Passing means sitter, vet, trainer, and household reports are useful, previewable, shareable, and eventually exportable as durable artifacts. Records must cover vaccines, vet visits, diet, insurance, microchip, documents, receipts, and credential data.

## Gate 7: Revenue Readiness

Passing means free/paid packaging is clear, premium value is visible, reports and household workflows support subscription value, and payments are not enabled before privacy/support obligations are ready.

Current evidence, 2026-06-08: Subscription packaging exists in a tested care-domain premium model and an in-app WoofWatcher Plus preview surface. Payments are still disabled until privacy/support/refund/subscription-launch obligations are approved.

## Gate 8: Production Safety

Passing means CI is green, API auth is household-scoped, secrets are absent, privacy/export/delete are planned, sync failures are visible, and release docs are accurate.
