# Quality Gates

## Gate 1: Dog-First Product Clarity

Passing means WoofWatcher is clearly a dog-care operating system, not a generic pet tracker. Dog profile, routines, logs, household sync, health watch, records, reports, and WoofGuide must all connect.

## Gate 2: Routines And Logs

Passing means routines define expected care and logs record actual care. Matching logs satisfy/update routines. Meal logs must capture expected portion, served amount, eaten amount, skipped/partial completion, notes, and household visibility.

Current evidence, 2026-06-08: `deriveRoutineBoard` now links visible logs to matching routines, exposes complete/partial/skipped meal completion, and leaves private logs out of shared routine status. Mobile meal logging now captures expected portion, served amount, eaten amount, meal completion, sticky note, and household visibility.

Current evidence, 2026-06-08: Home Quick Log now uses a tested entry builder that attaches due/overdue routines, expected portion, served amount, eaten amount, complete meal status, and household visibility for one-tap meal logs without prematurely clearing far-future routines.

## Gate 3: Household Trust

Passing means owners and caregivers can see who did what, what is pending, what failed to sync, what was skipped, and what needs follow-up.

Current evidence, 2026-06-08: Today Command now reads the routine board used by Calendar, so partial/skipped handled meals do not create duplicate meal prompts and overdue assigned routines surface with caregiver context.

Current evidence, 2026-06-08: One-tap Home Quick Logs for routine-backed care now create entries that the routine board can reconcile, so fast logging still updates household obligations.

## Gate 4: Premium Mobile UX

Passing means the mobile app feels warm, polished, clear, fast, and useful every day. No dead buttons, fake screens, or decorative-only workflows.

Current evidence, 2026-06-08: The home Today Command routes users to Log, Calendar, Records, More, or WoofGuide based on the primary care need and explains the selected action with routine name, owner, time, urgency, and sync/health context.

Current evidence, 2026-06-08: WoofGuide suggested actions now open an owner-review sheet before adding a meal log, creating a record reminder, inserting a vet-note draft, or opening Care Pass review.

## Gate 5: Health Safety

Passing means health features organize patterns without diagnosis. Urgent red flags direct users to veterinary care. WoofGuide stays bounded.

Current evidence, 2026-06-08: Health Watch now derives reusable pattern cards for vomit, appetite, stool, anxiety, and steady-state review. Cards include evidence, owner next steps, and non-diagnostic vet-boundary language, and Records renders those cards for review.

Current evidence, 2026-06-08: WoofGuide vet-note drafts include Health Pattern Review context, source entry ids, and explicit non-diagnostic safety language before any owner uses the draft.

## Gate 6: Reports And Records

Passing means sitter, vet, trainer, and household reports are useful, previewable, shareable, and eventually exportable as durable artifacts. Records must cover vaccines, vet visits, diet, insurance, microchip, documents, receipts, and credential data.

Current evidence, 2026-06-08: Care Pass exports now include audience-specific handoff checklists and Health Pattern Review next steps, so sitter, caregiver, trainer, and vet shares carry actionable context instead of generic summaries.

Current evidence, 2026-06-08: Records now derives expired, due-soon, and missing-critical reminders from the shared record vault and shows the top reminders in mobile Records without treating microchip or policy numbers as dates.

Current evidence, 2026-06-08: WoofGuide record-review actions can create owner-reviewed calendar reminders from record-vault due status, while Care Pass actions route to preview before sharing.

## Gate 7: Revenue Readiness

Passing means free/paid packaging is clear, premium value is visible, reports and household workflows support subscription value, and payments are not enabled before privacy/support obligations are ready.

Current evidence, 2026-06-08: Subscription packaging exists in a tested care-domain premium model and an in-app WoofWatcher Plus preview surface. Payments are still disabled until privacy/support/refund/subscription-launch obligations are approved.

Current evidence, 2026-06-08: WoofGuide bounded action drafting is now a visible premium-value pillar: it turns care state into reviewed meal logs, reminders, vet notes, and Care Pass next steps without enabling unsafe automation.

## Gate 8: Production Safety

Passing means CI is green, API auth is household-scoped, secrets are absent, privacy/export/delete are planned, sync failures are visible, and release docs are accurate.

Current evidence, 2026-06-08: The owner-reviewed WoofGuide action model is covered by focused tests and release docs now point the next automation slice to privacy/account safety rather than additional assistant writes.
