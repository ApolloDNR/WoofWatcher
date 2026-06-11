# Quality Gates

## Gate 1: Dog-First Product Clarity

Passing means WoofWatcher is clearly a dog-care operating system, not a generic pet tracker. Dog profile, routines, logs, household sync, health watch, records, reports, and WoofGuide must all connect.

## Gate 2: Routines And Logs

Passing means routines define expected care and logs record actual care. Matching logs satisfy/update routines. Meal logs must capture expected portion, served amount, eaten amount, skipped/partial completion, notes, and household visibility.

Current evidence, 2026-06-08: `deriveRoutineBoard` now links visible logs to matching routines, exposes complete/partial/skipped meal completion, and leaves private logs out of shared routine status. Mobile meal logging now captures expected portion, served amount, eaten amount, meal completion, sticky note, and household visibility.

Current evidence, 2026-06-08: Home Quick Log now uses a tested entry builder that attaches due/overdue routines, expected portion, served amount, eaten amount, complete meal status, and household visibility for one-tap meal logs without prematurely clearing far-future routines.

Current evidence, 2026-06-10: Medication adherence now derives taken, due, missed, and upcoming status from medication routines and household-visible medication logs. Records shows a Medication Plan with adherence percentage, due/missed counts, dose, assigned owner, logged-by context, and next medication action.

Current evidence, 2026-06-10: Home and the full Log composer now create medication logs with routine identity, dose, taken/skipped outcome, and household visibility so the Medication Plan is fed by richer medication evidence.

Current evidence, 2026-06-11: Medication follow-ups now derive missed-dose, due-now, and refill due-soon/overdue actions from medication routines, household-visible logs, and medication records. Records shows Medication Follow-ups with action copy and notification-rule candidates.

Current evidence, 2026-06-11: Medication history now derives recent household-visible medication logs with dose, outcome, caregiver, routine id, and notes. Records shows Medication History so owners can review what happened without searching the full timeline.

Current evidence, 2026-06-11: Water quick logs now record household-visible fresh-water refills, and shared hydration logic derives daily refill-equivalent progress, last log, caregiver participation, and next-step copy from visible water logs.

Current evidence, 2026-06-11: Walk quick logs now explicitly record household-visible activity evidence, and shared Walk Activity logic derives duration, places/routes, dog interactions, social outcomes, last log, caregiver participation, and next-step copy from visible walk logs.

Current evidence, 2026-06-11: The full Log composer now captures walk route/place, distance, dog interactions, social outcome notes, and household visibility. Shared Saved Routes logic derives repeat route templates from visible route logs, while private walks stay out of shared route status.

Current evidence, 2026-06-11: Potty quick logs now record household-visible potty evidence, the Log composer captures pee/poop kind and condition with sticky notes, and shared Potty Health logic derives pee/poop counts, stool review signals, conditions, last log, caregiver participation, and next-step copy from visible potty logs.

Current evidence, 2026-06-11: Potty logging now captures stool color and routine/accident/urgent/straining context. Potty Health uses those fields as review evidence and carries color/context detail into Records and Care Pass reports.

Current evidence, 2026-06-11: Alone Time logging now captures departure duration, return state, trigger/context, calming support, recovery minutes, sticky notes, and household visibility. Shared Alone Time logic derives 30-day visible departure patterns, status, latest context, triggers, supports, and Care Pass handoff language.

## Gate 3: Household Trust

Passing means owners and caregivers can see who did what, what is pending, what failed to sync, what was skipped, and what needs follow-up.

Current evidence, 2026-06-08: Today Command now reads the routine board used by Calendar, so partial/skipped handled meals do not create duplicate meal prompts and overdue assigned routines surface with caregiver context.

Current evidence, 2026-06-08: One-tap Home Quick Logs for routine-backed care now create entries that the routine board can reconcile, so fast logging still updates household obligations.

Current evidence, 2026-06-10: Private medication logs do not satisfy the shared Medication Plan, preserving household trust for medication obligations.

Current evidence, 2026-06-10: Skipped medication logs keep the entry attached to the routine but do not count as taken, so households can see what happened without false adherence.

Current evidence, 2026-06-11: Medication Follow-ups combine the routine status and record vault so the household can see what needs confirmation, what is due now, and which refill needs owner action.

Current evidence, 2026-06-11: Medication History excludes private medication logs from the shared evidence trail, preserving the same household visibility boundary as the Medication Plan.

Current evidence, 2026-06-11: Hydration status ignores private water logs and shows caregiver participation in Records, keeping daily water care visible as household evidence.

Current evidence, 2026-06-11: Walk Activity ignores private walk logs and shows caregiver participation, places, and social outcome notes in Records, keeping dog park and walker context visible to the household.

Current evidence, 2026-06-11: Saved Routes ignores private walk logs and stale route evidence, grouping only visible route/place logs into shared route templates for household and report context.

Current evidence, 2026-06-11: Potty Health ignores private potty logs and shows caregiver participation, latest detail, and stool review count in Records, keeping bathroom and stool context visible to the household without exposing private notes.

Current evidence, 2026-06-11: Records Potty Health now shows stool colors and context labels from visible logs, making accident, urgency, and straining details visible to the household without requiring timeline search.

Current evidence, 2026-06-11: Durable sync outbox derives local, pending, and failed care entries into visible retryable create/update counts, exposes that state through CareContext, and shows a Log screen Offline Outbox banner with a Retry sync action so owners can recover care changes instead of trusting hidden sync internals.

Current evidence, 2026-06-11: Household Sync Health derives loading, syncing, attention, and healthy dashboard states from the durable outbox, household member count, and care history, then shows More screen status, metrics, and retry/refresh guidance so owners can understand household sync health without opening the Log.

Current evidence, 2026-06-11: Care document refresh now reconciles local and server timestamps, keeps newer local/offline profile, routine, record, and report changes when a stale server refresh arrives, and pushes the newer care document back to the household.

Current evidence, 2026-06-11: Weekly Care Trends derives a household-visible 7-day care picture, including current-versus-previous comparison, top caregivers, meal completion, walk minutes, water refill equivalents, and review signals while excluding private logs.

Current evidence, 2026-06-11: Training logs now capture skill/cue, win/practice/struggle outcome, duration, next-practice notes, sticky notes, and household visibility, and Training Progress derives visible 30-day sessions, minutes, wins, struggles, skills, caregivers, and latest context.

Current evidence, 2026-06-11: Household Responsibility now derives care-team ownership, open/overdue/unassigned routine counts, visible today log activity, and the next household action from routine-board truth, then shows that shared status in Calendar and More.

Current evidence, 2026-06-11: Care Log Audit Trail now records create, edit, sticky-note, and delete evidence with shared care-domain sanitization. Log details show audit history, handoff text includes audit summaries, and successful deletes create a separate non-health audit note instead of silently disappearing.

Current evidence, 2026-06-11: Alone Time ignores private departure logs and shows visible caregiver participation, trigger/context, support, recovery, anxious/distress counts, and next-step copy in Records, keeping separation context shared only when the household marks it visible.

## Gate 4: Premium Mobile UX

Passing means the mobile app feels warm, polished, clear, fast, and useful every day. No dead buttons, fake screens, or decorative-only workflows.

Current evidence, 2026-06-08: The home Today Command routes users to Log, Calendar, Records, More, or WoofGuide based on the primary care need and explains the selected action with routine name, owner, time, urgency, and sync/health context.

Current evidence, 2026-06-08: WoofGuide suggested actions now open an owner-review sheet before adding a meal log, creating a record reminder, inserting a vet-note draft, or opening Care Pass review.

Current evidence, 2026-06-08: Home now uses a deterministic avatar motion model so Phoenix's visible state responds to Health Watch, recent meals/treats/water/walks/play/training, upcoming or overdue routines, quiet hours, and low energy. The row routes to the matching care workflow instead of acting as decoration.

## Gate 5: Health Safety

Passing means health features organize patterns without diagnosis. Urgent red flags direct users to veterinary care. WoofGuide stays bounded.

Current evidence, 2026-06-08: Health Watch now derives reusable pattern cards for vomit, appetite, stool, anxiety, and steady-state review. Cards include evidence, owner next steps, and non-diagnostic vet-boundary language, and Records renders those cards for review.

Current evidence, 2026-06-08: WoofGuide vet-note drafts include Health Pattern Review context, source entry ids, and explicit non-diagnostic safety language before any owner uses the draft.

Current evidence, 2026-06-10: Medication status is presented as adherence and follow-up state, not medical advice. Missed/due state helps owners coordinate care while diagnosis remains outside the product boundary.

Current evidence, 2026-06-11: Medication refill follow-ups are framed as owner action/reminder candidates, not pharmacy, veterinary, or automatic push-notification claims.

Current evidence, 2026-06-11: Potty Health is framed as stool review and care context, not diagnosis. Its next-step language asks owners to log stool detail and contact a vet for repeat diarrhea, blood, pain, weakness, or dehydration.

Current evidence, 2026-06-11: Stool color and accident/urgent/straining fields are treated as review evidence and report context, not medical interpretation.

Current evidence, 2026-06-11: Alone Time is framed as owner-reported separation context and household care evidence. It summarizes calm/anxious/distressed return states, triggers, supports, and recovery notes without diagnosing separation anxiety.

## Gate 6: Reports And Records

Passing means sitter, vet, trainer, and household reports are useful, previewable, shareable, and eventually exportable as durable artifacts. Records must cover vaccines, vet visits, diet, insurance, microchip, documents, receipts, and credential data.

Current evidence, 2026-06-08: Care Pass exports now include audience-specific handoff checklists and Health Pattern Review next steps, so sitter, caregiver, trainer, and vet shares carry actionable context instead of generic summaries.

Current evidence, 2026-06-09: Care Pass artifacts now include escaped print-ready HTML and stable file names, giving vet/sitter/trainer reports a tested source payload for future PDF generation and server-backed storage.

Current evidence, 2026-06-09: Records Report History now shows whether a Care Pass is print-ready or restored from an older snapshot, exposes separate accessible resend and printable-source share actions, and uses a shared domain helper to recover escaped printable HTML for legacy artifacts.

Current evidence, 2026-06-09: Dog ID credentials now render escaped print-ready HTML with stable file names, and mobile Records exposes separate accessible actions for sharing the normal ID card text and printable source.

Current evidence, 2026-06-08: Records now derives expired, due-soon, and missing-critical reminders from the shared record vault and shows the top reminders in mobile Records without treating microchip or policy numbers as dates.

Current evidence, 2026-06-08: WoofGuide record-review actions can create owner-reviewed calendar reminders from record-vault due status, while Care Pass actions route to preview before sharing.

Current evidence, 2026-06-11: Care Pass reports now include a Medication section with adherence summary, taken/upcoming dose language, and medication refill follow-up language for vet/sitter review.

Current evidence, 2026-06-11: Care Pass reports now include a Hydration section with daily water-log summary, latest visible log context, and non-diagnostic next-step language for sitter/vet review.

Current evidence, 2026-06-11: Care Pass reports now include a Walk Activity section with today's walk minutes, places/routes, dog interaction counts, latest walk context, and social outcome notes for sitter/trainer review.

Current evidence, 2026-06-11: Care Pass Walk Activity now includes Saved Routes, giving sitters and trainers repeat-route context with visits, average duration, dog interactions, and suggested use before PDF generation is added.

Current evidence, 2026-06-11: Care Pass reports now include a Potty Health section with today's pee/poop counts, stool review count, conditions, latest potty detail, and safe next-step language for sitter/vet review.

Current evidence, 2026-06-11: Care Pass Potty Health now includes stool colors and potty context, so sitters and vets can see accident, urgency, straining, and color context in the same printable report flow.

Current evidence, 2026-06-11: Care Pass reports now include a Care Trends section with 7-day household log volume, meal completion, walk minutes, water refills, and safe review signals, giving sitters and vets weekly context before longer-range trend reports exist.

Current evidence, 2026-06-11: Care Pass reports now include a Training Progress section with sessions, skills, outcomes, latest trainer-relevant context, and next-practice notes, giving trainers and sitters useful behavior practice context before formal training plans exist.

Current evidence, 2026-06-11: Care Pass reports now include an Alone Time section with 30-day departure summary, return-state counts, triggers, calming supports, average recovery, latest context, and next-step language for sitters and trainers.

## Gate 7: Revenue Readiness

Passing means free/paid packaging is clear, premium value is visible, reports and household workflows support subscription value, and payments are not enabled before privacy/support obligations are ready.

Current evidence, 2026-06-08: Subscription packaging exists in a tested care-domain premium model and an in-app WoofWatcher Plus preview surface. Payments are still disabled until privacy/support/refund/subscription-launch obligations are approved.

Current evidence, 2026-06-08: WoofGuide bounded action drafting is now a visible premium-value pillar: it turns care state into reviewed meal logs, reminders, vet notes, and Care Pass next steps without enabling unsafe automation.

Current evidence, 2026-06-08: Free, Plus, and Family entitlement gates now exist in shared domain logic and the mobile Plus screen shows the launch policy before checkout. Payments remain disabled pending provider, support, refund, and launch approvals.

Current evidence, 2026-06-11: Medication Follow-ups and Care Pass medication language strengthen the paid reports/reminders wedge without enabling checkout or real notification delivery before provider policy is ready.

Current evidence, 2026-06-11: Hydration summaries strengthen Plus-value daily care reports by turning simple water logs into owner-readable Records and Care Pass context without claiming medical hydration analysis.

Current evidence, 2026-06-11: Walk Activity strengthens the household and trainer/sitter report wedge by turning walk and dog-interaction logs into Records and Care Pass context before saved route maps or walker integrations exist.

Current evidence, 2026-06-11: Saved Routes strengthen the Family and report-export wedge by turning repeated walk places into reusable, report-ready templates without requiring GPS or location-provider approval.

Current evidence, 2026-06-11: Potty Health strengthens the Health Watch and vet/sitter report wedge by turning simple potty logs into shared stool-review context before longer-range medical pattern reports or explicit stool-color workflows exist.

Current evidence, 2026-06-11: Potty detail fields strengthen the paid report wedge by turning color and accident/urgency context into report-ready evidence before long-range vet pattern products exist.

Current evidence, 2026-06-11: Weekly Care Trends strengthens the Plus report/insights wedge by turning routine care logs into readable week-over-week context across meals, walks, water, potty, medication, and health watch without enabling diagnosis or predictive AI.

Current evidence, 2026-06-11: Training Progress strengthens the trainer/sitter report wedge by turning structured practice logs into shared progress context and next-practice guidance without pretending to be a behavior diagnosis.

Current evidence, 2026-06-11: Alone Time strengthens the Family and trainer/sitter report wedge by turning departure, return, trigger, support, and recovery logs into shared care context without claiming medical or behavioral diagnosis.

## Gate 8: Production Safety

Passing means CI is green, API auth is household-scoped, secrets are absent, privacy/export/delete are planned, sync failures are visible, and release docs are accurate.

Current evidence, 2026-06-08: The owner-reviewed WoofGuide action model is covered by focused tests and release docs now point the next automation slice to privacy/account safety rather than additional assistant writes.

Current evidence, 2026-06-08: Mobile now has a Privacy & Safety surface for owner care-data export, non-destructive account deletion request preparation, WoofGuide AI disclosure, document storage gates, and payment launch blockers. The model is covered by focused tests and keeps live deletion/storage disabled until provider rules are approved.

Current evidence, 2026-06-08: Focused tests now include static mobile readiness smoke for critical route registration, tab coverage, string router links, and safety copy on premium/privacy/WoofGuide surfaces. Expo runtime, visual, and accessibility QA remain open.

Current evidence, 2026-06-08: `build:ci` now runs `@workspace/woofwatcher-mobile`'s Expo web export smoke and verifies the export emits HTML and JavaScript assets. Native simulator/device rendering, screenshots, and accessibility QA remain open.

Current evidence, 2026-06-08: Focused tests now verify screen-reader labels on critical Privacy, Premium, WoofGuide, and More actions, including owner data export, deletion request preparation, WoofGuide review/send actions, Plus entry, and sign out. Full native accessibility traversal and visual QA remain open.

Current evidence, 2026-06-08: Expo app identity no longer uses Replit placeholders. Static readiness checks protect the WoofWatcher slug/scheme plus Pegasus Dreamscapes iOS bundle id and Android package id. Store submission still requires Expo/EAS/App Store accounts and approval.

Current evidence, 2026-06-08: Focused tests now cover the Home avatar motion state model and static wiring check. Native animation runtime verification, Rive/Lottie/Reanimated asset QA, and screenshot review remain open.

Current evidence, 2026-06-11: Focused tests now cover durable sync outbox derivation, household Sync Health derivation, Household Responsibility derivation/mobile wiring, Care Log Audit Trail derivation/mobile wiring, conflict-safe care document refresh reconciliation, Saved Routes derivation/report/mobile wiring, Weekly Care Trends derivation/report/mobile wiring, Training Progress derivation/report/mobile wiring, Alone Time derivation/report/mobile wiring, and static mobile wiring. Local focused tests pass at 150 tests. GitHub Actions `WoofWatcher Verify` run `27364253713` passed for the Alone Time slice. Local `pnpm run build:ci` remains blocked only because `pnpm` is unavailable in this Windows shell.
