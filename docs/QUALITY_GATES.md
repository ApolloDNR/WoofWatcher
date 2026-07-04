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

Current evidence, 2026-06-11: Medication History now supports medicine, dose, caregiver, note, and routine-id search plus taken/skipped/missed/needs-review outcome filters, with owner-readable summary and empty-state copy in Records.

Current evidence, 2026-06-11: Water quick logs now record household-visible fresh-water refills, and shared hydration logic derives daily refill-equivalent progress, last log, caregiver participation, and next-step copy from visible water logs.

Current evidence, 2026-06-11: Walk quick logs now explicitly record household-visible activity evidence, and shared Walk Activity logic derives duration, places/routes, dog interactions, social outcomes, last log, caregiver participation, and next-step copy from visible walk logs.

Current evidence, 2026-06-19: Walk quick logs can now become active sessions instead of only past logs. Home and Log start the same household-visible walk session, Home shows Walk active in the room/presence/Next Up surfaces, and the Log finish panel records route/place, distance, dog interactions, social outcome, note, duration, and audit history before feeding Walk Activity and Saved Routes.

Current evidence, 2026-06-11: The full Log composer now captures walk route/place, distance, dog interactions, social outcome notes, and household visibility. Shared Saved Routes logic derives repeat route templates from visible route logs, while private walks stay out of shared route status.

Current evidence, 2026-06-11: Potty quick logs now record household-visible potty evidence, the Log composer captures pee/poop kind and condition with sticky notes, and shared Potty Health logic derives pee/poop counts, stool review signals, conditions, last log, caregiver participation, and next-step copy from visible potty logs.

Current evidence, 2026-06-11: Potty logging now captures stool color and routine/accident/urgent/straining context. Potty Health uses those fields as review evidence and carries color/context detail into Records and Care Pass reports.

Current evidence, 2026-06-11: Alone Time logging now captures departure duration, return state, trigger/context, calming support, recovery minutes, sticky notes, and household visibility. Shared Alone Time logic derives 30-day visible departure patterns, status, latest context, triggers, supports, and Care Pass handoff language.

Current evidence, 2026-06-11: Grooming logging now captures grooming type, duration, coat/skin notes, products/groomer context, next due date, sticky notes, and household visibility. Shared Grooming Care derives visible 45-day grooming status, products, caregivers, next due date, Records UI, and Care Pass report language.

## Gate 3: Household Trust

Passing means owners and caregivers can see who did what, what is pending, what failed to sync, what was skipped, and what needs follow-up.

Current evidence, 2026-06-08: Today Command now reads the routine board used by Calendar, so partial/skipped handled meals do not create duplicate meal prompts and overdue assigned routines surface with caregiver context.

Current evidence, 2026-06-08: One-tap Home Quick Logs for routine-backed care now create entries that the routine board can reconcile, so fast logging still updates household obligations.

Current evidence, 2026-06-10: Private medication logs do not satisfy the shared Medication Plan, preserving household trust for medication obligations.

Current evidence, 2026-06-10: Skipped medication logs keep the entry attached to the routine but do not count as taken, so households can see what happened without false adherence.

Current evidence, 2026-06-11: Medication Follow-ups combine the routine status and record vault so the household can see what needs confirmation, what is due now, and which refill needs owner action.

Current evidence, 2026-06-11: Medication History excludes private medication logs from the shared evidence trail, preserving the same household visibility boundary as the Medication Plan.

Current evidence, 2026-06-11: Medication History search and outcome filters make skipped and missed medication evidence easier to find without exposing private medication logs.

Current evidence, 2026-06-19: Medication proof attachment now records local photo proof URI/name/source, local-only storage status, attached-by/at metadata, audit history, and proof-attached timeline state while keeping medication logs pending adult confirmation until owner review.

Current evidence, 2026-06-11: Hydration status ignores private water logs and shows caregiver participation in Records, keeping daily water care visible as household evidence.

Current evidence, 2026-06-11: Walk Activity ignores private walk logs and shows caregiver participation, places, and social outcome notes in Records, keeping dog park and walker context visible to the household.

Current evidence, 2026-06-19: Active walk sessions preserve one shared log from start to finish. Re-tapping Walk while a session is open routes to the Log finish flow, and completing the session appends a finish audit event instead of creating a disconnected duplicate.

Current evidence, 2026-06-11: Saved Routes ignores private walk logs and stale route evidence, grouping only visible route/place logs into shared route templates for household and report context.

Current evidence, 2026-06-11: Potty Health ignores private potty logs and shows caregiver participation, latest detail, and stool review count in Records, keeping bathroom and stool context visible to the household without exposing private notes.

Current evidence, 2026-06-11: Records Potty Health now shows stool colors and context labels from visible logs, making accident, urgency, and straining details visible to the household without requiring timeline search.

Current evidence, 2026-06-19: Potty detail correction now has a tested Log detail sheet flow for outcome, location, pee detail, stool consistency/color, and context. Updating a parent potty attempt rewrites stale pee/stool fields, preserves routine/household context, records audit history, and feeds Records Potty Health without turning quick tap logs into fake precision.

Current evidence, 2026-06-11: Durable sync outbox derives local, pending, and failed care entries into visible retryable create/update counts, exposes that state through CareContext, and shows a Log screen Offline Outbox banner with a Retry sync action so owners can recover care changes instead of trusting hidden sync internals.

Current evidence, 2026-06-11: Household Sync Health derives loading, syncing, attention, and healthy dashboard states from the durable outbox, household member count, and care history, then shows More screen status, metrics, and retry/refresh guidance so owners can understand household sync health without opening the Log.

Current evidence, 2026-06-11: Care document refresh now reconciles local and server timestamps, keeps newer local/offline profile, routine, record, and report changes when a stale server refresh arrives, and pushes the newer care document back to the household.

Current evidence, 2026-06-11: Weekly Care Trends derives a household-visible 7-day care picture, including current-versus-previous comparison, top caregivers, meal completion, walk minutes, water refill equivalents, and review signals while excluding private logs.

Current evidence, 2026-06-26: Weekly Care Trends now keeps pending meal outcomes separate from complete, partial, and skipped meals. Served, outcome-pending, and grazing meals appear as pending in trend summaries, highlights, watch signals, Care Pass trend lines, and the Records Care Trends `Meal open` metric instead of silently reading as resolved weekly progress.

Current evidence, 2026-06-11: Training logs now capture skill/cue, win/practice/struggle outcome, duration, next-practice notes, sticky notes, and household visibility, and Training Progress derives visible 30-day sessions, minutes, wins, struggles, skills, caregivers, and latest context.

Current evidence, 2026-06-11: Household Responsibility now derives care-team ownership, open/overdue/unassigned routine counts, visible today log activity, and the next household action from routine-board truth, then shows that shared status in Calendar and More.

Current evidence, 2026-06-11: Household Access now derives synced account members, local-only caregivers, routine-only owners, invite readiness, permission labels, and next-step guidance from shared care-domain logic, then shows that access plan in More.

Current evidence, 2026-06-19: Access Pass now derives local sitter/trainer/vet/emergency helper drafts, allowed/blocked permissions, active/upcoming/draft status, provider-gated sharing boundaries, and My Care Today assigned-care workload from shared care-domain logic, then shows both surfaces in More.

Current evidence, 2026-06-24: Provider-durable household audit events now have an owner/admin review API. `GET /household/audit-events` is authenticated, active-household scoped, owner/admin-only, newest-first, filterable by action/lifecycle state, generated-client typed, and locally verified without claiming provider migration, RLS, retention, export/deletion, or scheduled expiry cleanup is approved.

Current evidence, 2026-06-11: Care Log Audit Trail now records create, edit, sticky-note, and delete evidence with shared care-domain sanitization. Log details show audit history, handoff text includes audit summaries, and successful deletes create a separate non-health audit note instead of silently disappearing.

Current evidence, 2026-06-19: Log details now show a Correction history card above the raw Audit trail. It summarizes the latest update, correction count, and changed-field chips so owners can understand corrections before reading the full audit rows.

Current evidence, 2026-06-20: Incident Watch now derives owner follow-up tasks and trainer goal suggestions from household-visible incident evidence. Records routes those follow-up rows to the Incident composer or trainer Care Pass preview, so incident review becomes a connected household workflow rather than a static warning card.

Current evidence, 2026-06-11: Alone Time ignores private departure logs and shows visible caregiver participation, trigger/context, support, recovery, anxious/distress counts, and next-step copy in Records, keeping separation context shared only when the household marks it visible.

Current evidence, 2026-06-11: Reminder Center now combines routine-board status, medication follow-ups, record reminders, and grooming due dates into one Calendar action list with urgent/watch/total counts, private-log exclusion through the underlying domain helpers, and explicit notification-readiness copy before real push delivery exists.

## Gate 4: Premium Mobile UX

Passing means the mobile app feels warm, polished, clear, fast, and useful every day. No dead buttons, fake screens, or decorative-only workflows.

Current evidence, 2026-06-08: The home Today Command routes users to Log, Calendar, Records, More, or WoofGuide based on the primary care need and explains the selected action with routine name, owner, time, urgency, and sync/health context.

Current evidence, 2026-06-08: WoofGuide suggested actions now open an owner-review sheet before adding a meal log, creating a record reminder, inserting a vet-note draft, or opening Care Pass review.

Current evidence, 2026-06-08: Home now uses a deterministic avatar motion model so Phoenix's visible state responds to Health Watch, recent meals/treats/water/walks/play/training, upcoming or overdue routines, quiet hours, and low energy. The row routes to the matching care workflow instead of acting as decoration.

Current evidence, 2026-06-11: Reminder Center rows route to concrete care workflows instead of acting as static status rows: routines open the routine editor, medication routine reminders open the Medication log composer, record reminders open Records, and grooming reminders open the Grooming log composer.

Current evidence, 2026-06-11: Full Log now has text search backed by shared care-domain logic. The search combines query terms with type chips across titles, notes, caregivers, nested care details, route/place fields, medication fields, and sticky notes, then shows active-filter summary and empty-state copy.

Current evidence, 2026-06-11: Records Medication History now has a scoped search field and outcome chips, so owners can review medication-specific evidence without leaving Records or scanning the full timeline.

Current evidence, 2026-06-14: Quick Log, Plans, and Records now use shared `BoardCard` anatomy for primary workflow surfaces, and static mobile readiness protects the Log composer, Plans upcoming events, and Records Dog ID card from drifting back to one-off card shells.

Current evidence, 2026-06-14: Records Care Pass, Report History, and Progress Report now use shared `BoardCard` and `BoardSectionHeader` anatomy while preserving real preview, resend, print-source, period-filter, and share actions.

Current evidence, 2026-06-14: Records Record Vault, Diet on File, and Records Cabinet now use shared board sections with working add/edit/delete entry points and internal vault tiles instead of separate floating card islands.

Current evidence, 2026-06-14: Records Weight Trend, Mood Trend, and Hydration now use shared board sections while preserving the weight chart, mood distribution bars, hydration progress meter, latest-log context, and safe care-summary copy.

Current evidence, 2026-06-14: Records Walk Activity, Training Progress, and Potty Health now use shared board sections while preserving saved routes, training focus/latest practice context, stool color/context, and care-safe next steps.

Current evidence, 2026-06-14: Records has been cleared of the older one-off `padCard` and local section-header pattern. Care Trends, Dog ID heading, Alone Time, Grooming Care, Incident Watch, and Medication Plan now use shared board primitives while preserving share/print actions, medication routine routing, follow-ups, search/filter history, and non-diagnostic care copy.

Current evidence, 2026-06-14: Mobile More now uses shared board sections for Care Team, Household Access, Responsibility Center, Sync Health, Tools & Sharing, and Diet Profile while preserving invite sharing, household rename, routine-board routing, sync refresh, tool links, and diet edit/detail actions.

Current evidence, 2026-06-14: Mobile Plans now uses shared board sections for Reminder Center and Daily Routine while preserving reminder action routing, routine add/edit/delete, one-tap routine completion, owner load chips, household responsibility metrics, and empty routine setup.

Current evidence, 2026-06-14: Mobile Quick Log now uses shared board sections for Today at a Glance, Find Care Logs, empty timeline state, and grouped timeline days while preserving search, filters, sticky notes, edit/detail/delete actions, sync status, and the composer boundary.

Current evidence, 2026-06-14: Mobile WoofGuide now uses shared board sections for the owner-reviewed intro, Quick Questions, and Suggested Actions while preserving generated action routing, owner-review drafts, and bounded health guidance language.

Current evidence, 2026-06-14: Mobile Premium now uses shared board anatomy for Why Upgrade, gated plan cards, and Launch Entitlements while preserving the launch checklist and truthful disabled-payment boundary.

Current evidence, 2026-06-14: Mobile Avatar Studio now uses shared board anatomy for the animated scan canvas, live/generated avatar preview, mood-state set, and photo guidance while preserving library/camera generation, saved avatar state, and revert-to-default behavior.

Current evidence, 2026-06-18: Mobile Avatar Studio now separates template thumbnails from production-scale template base stills, then uses the cleaned live `LivingPhoenixRoom` Studio presentation as the primary hero so `/portrait` keeps one living care twin without Home HUD overlap. All 12 launch template base PNGs remain registered for the ID card, picker, and fallback/reference previews.

Current evidence, 2026-06-14: Mobile Setup now uses shared board anatomy for the care-foundation route header, setup-progress meter, and profile/diet/routine/caregiver setup sections while preserving draft save and finish-later behavior.

## Gate 5: Health Safety

Passing means health features organize patterns without diagnosis. Urgent red flags direct users to veterinary care. WoofGuide stays bounded.

Current evidence, 2026-06-08: Health Watch now derives reusable pattern cards for vomit, appetite, stool, anxiety, and steady-state review. Cards include evidence, owner next steps, and non-diagnostic vet-boundary language, and Records renders those cards for review.

Current evidence, 2026-06-08: WoofGuide vet-note drafts include Health Pattern Review context, source entry ids, and explicit non-diagnostic safety language before any owner uses the draft.

Current evidence, 2026-06-10: Medication status is presented as adherence and follow-up state, not medical advice. Missed/due state helps owners coordinate care while diagnosis remains outside the product boundary.

Current evidence, 2026-06-11: Medication refill follow-ups are framed as owner action/reminder candidates, not pharmacy, veterinary, or automatic push-notification claims.

Current evidence, 2026-06-11: Potty Health is framed as stool review and care context, not diagnosis. Its next-step language asks owners to log stool detail and contact a vet for repeat diarrhea, blood, pain, weakness, or dehydration.

Current evidence, 2026-06-11: Stool color and accident/urgent/straining fields are treated as review evidence and report context, not medical interpretation.

Current evidence, 2026-06-11: Alone Time is framed as owner-reported separation context and household care evidence. It summarizes calm/anxious/distressed return states, triggers, supports, and recovery notes without diagnosing separation anxiety.

Current evidence, 2026-06-11: Weight Trend is framed as owner-reported weigh-in context for caregiver and veterinarian review. It summarizes current weight, goal distance, and change from previous without diagnosing weight or recommending medical changes.

Current evidence, 2026-06-11: Grooming Care is framed as owner-reported coat and grooming context for handoff and veterinarian review. It summarizes coat/skin notes, products, and due dates without diagnosing skin or coat conditions.

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

Current evidence, 2026-06-11: Care Pass reports now include a Weight Trend section with recent weigh-in count, current weight, goal, change from previous, latest caregiver context, and owner-reported/vet-review boundary language.

Current evidence, 2026-06-11: Care Pass reports now include a Grooming Care section with recent grooming count, type counts, latest grooming context, products, next due date, and owner-reported/non-diagnostic boundary language.

Current evidence, 2026-06-14: Mobile Records now presents Care Pass audience previews, saved report artifacts, and Progress Report controls as shared board sections with accessible resend, printable-source, and share actions preserved for sitter/vet/trainer handoff workflows.

Current evidence, 2026-06-14: Mobile Records now keeps credential vault sections, diet context, and the records cabinet in the same board anatomy as report handoffs, making vaccines, visits, receipts, insurance, microchip, diet, and documents easier to scan as one care vault.

Current evidence, 2026-06-14: Mobile Records trend sections now present weight, mood, and hydration evidence inside the same board system as printable handoffs, strengthening report scanability without changing the non-diagnostic owner-reported boundaries.

Current evidence, 2026-06-14: Mobile Records activity and potty sections now present walk, training, and bathroom evidence inside the same board system as Care Pass report content, improving scanability for sitters, trainers, and vets.

Current evidence, 2026-06-20: Incident Watch reports now include trend label/detail, owner follow-up task labels, and trainer goal ideas in Care Pass output while preserving factual owner-reported and non-diagnostic boundary language.

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

Current evidence, 2026-06-11: Weight Trend strengthens the Health Watch and vet-report wedge by turning weigh-ins and goals into shared Records and Care Pass context without requiring document storage or clinical interpretation.

Current evidence, 2026-06-11: Grooming Care strengthens the sitter/vet/report wedge by turning brushing, bathing, nails, teeth, coat notes, product context, and next due dates into shared Records and Care Pass context before groomer contacts or reminders exist.

Current evidence, 2026-06-11: Household Access strengthens the Family-tier wedge by making synced members, pending invites, routine-only owners, and practical permission labels visible before real provider-backed role enforcement is enabled.

Current evidence, 2026-06-19: Access Pass strengthens the Family/helper revenue wedge by showing temporary permission drafts and personal care ownership while truthfully keeping remote enforcement provider-gated.

Current evidence, 2026-06-19: Adventure Mode strengthens the emotional retention and Family memory wedge by deriving private real-care quests, XP, levels, completed proof, and local memory drafts from household-visible walks, training, play, and alone-time evidence while keeping media, maps, public sharing, and community discovery provider-gated.

Current evidence, 2026-06-11: Reminder Center strengthens the Plus/Family reminders wedge by making existing routine, medication, record, and grooming follow-up candidates visible in Calendar without enabling checkout, push notifications, or automatic care writes.

Current evidence, 2026-07-03: The Push notifications proof manifest strengthens the reminder-delivery launch gate by making Expo push project config, APNs credentials, Firebase/FCM credentials, permission copy, quiet-hours/opt-out behavior, and delivery QA visible on `/care-twin-qa?qaSurface=push-notifications-proof` while keeping `Reminder delivery allowed: No` until real provider proof and native delivery evidence are attached.

Current evidence, 2026-07-04: Push notification native delivery proof now requires two concrete platform/provider-specific proofs instead of generic APNs/FCM/delivery QA strings: iOS APNs delivery and Android FCM delivery. Each proof needs platform/provider naming, image MIME, positive byte size, token registration, delivered reminder, permission preference, quiet-hours or opt-out, and fallback capture. Local verification passed `pushNotificationsProof.test.ts` `4/4`, focused push handoff/QA/readiness tests `148/148`, and direct JSON doctor source-backed checks. Branch CI proved this stricter guard in `WoofWatcher Verify` run `28695138006`, job `85103354696`, on commit `1772aed`. Real Expo/APNs/FCM configuration, native delivery evidence, prompt/legal approval, store privacy review, public launch, and Apollo sign-off remain required.

Current evidence, 2026-07-03: The focused Auth/Setup proof manifest strengthens the first native-auth launch gate by making Clerk production app, redirect/deep-link, native Auth screenshot, Setup local-preview, household sync, and launch-gate blockers visible on `/care-twin-qa?qaSurface=auth-setup-onboarding-proof` while keeping `Native proof allowed: No` until structured Clerk, redirect/deep-link, household membership, Apollo auth launch, and iOS/Android screenshot proof is attached. Branch CI proved the focused manifest guard in `WoofWatcher Verify` run `28690620657`, job `85091134806`, on commit `e8a1ea9`.

Current evidence, 2026-07-04: Auth/Setup native proof now requires four concrete platform-and-surface-specific screenshot proofs instead of generic approval flags: iOS Auth gateway, Android Auth gateway, iOS Setup local-preview, and Android Setup local-preview. Each proof needs platform/surface naming, image MIME, positive byte size, and provider-boundary copy; Setup proof also needs reachable controls. Local verification passed `authProviderProof.test.ts` `4/4`, focused Auth/Setup/doctor tests `118/118`, and direct JSON doctor source-backed checks. Branch CI proved this stricter guard in `WoofWatcher Verify` run `28694530592`, job `85101746726`, on commit `581b8b1`. Real native screenshots, provider-backed auth, household sync, store approval, public launch, and Apollo sign-off remain required.

Current evidence, 2026-07-04: Auth/Setup provider proof now also requires four structured provider proof files instead of approval booleans: Clerk production, redirect/deep-link URLs, household membership policy, and Apollo auth launch approval. Each proof needs a locator, acceptable MIME, positive byte size, required row fields, and row-specific approval booleans. Fresh red/green verification first showed staged provider approval booleans plus complete native screenshot evidence incorrectly making the manifest ready, then passed `authProviderProof.test.ts` `5/5`, focused Auth/Setup/release-QA/Share Beta Handoff/smoke/readiness tests `149/149`, the full zero-dependency API/mobile/PWA/care-domain suite `577/577`, root TypeScript, mobile TypeScript, direct JSON doctor source-backed checks, and `git diff --check`. Branch CI proved commit `6da692b` in `WoofWatcher Verify` run `28701069572`, job `85119051428`. Real Clerk configuration, OAuth, provider-backed household creation, native screenshots, store approval, public launch, and Apollo sign-off remain required.

Current evidence, 2026-07-04: WoofGuide AI provider proof now requires six structured proof files instead of generic provider/model/source/write-gate/veterinary/fallback approval strings: OpenAI secret storage, approved model policy, source/citation rules, owner-review write gate, veterinary safety boundary, and fallback/incident handling. Each proof needs proof naming, acceptable MIME, positive byte size, required policy fields, and row-specific safety booleans. Fresh red/green verification first showed generic strings incorrectly making the manifest `ready-for-review`, then passed `aiProviderProof.test.ts` `3/3`, targeted AI proof plus mobile readiness/release-QA tests `143/143`, the full zero-dependency API/mobile/PWA/care-domain suite `572/572`, root TypeScript, PixelLab asset verification `ok=149 missing=0 invalid=0`, `git diff --check`, and direct JSON doctor source-backed checks. Branch CI proved this stricter guard in `WoofWatcher Verify` run `28697142992`, job `85108676301`, on commit `c40ac84`. Real OpenAI configuration, model approval, live AI, source/citation review, automatic-write approval, veterinary safety approval, public launch, and Apollo sign-off remain required.

Current evidence, 2026-07-04: The focused Records local-file handoff proof manifest strengthens the native Records file-proof gate by making Care Pass Report History local HTML, Dog ID local HTML credential, Dog ID SVG image source, native share-sheet behavior, Android content URI or saved-file proof, fallback copy, and generated PDF/PNG/provider boundary rows visible on `/care-twin-qa?qaSurface=records-local-file-handoff` while keeping `Native file proof allowed: No` until real iOS/Android share evidence and notes are attached. Branch CI proved the focused manifest guard in `WoofWatcher Verify` run `28691115501`, job `85092467507`, on commit `8268809`.

Current evidence, 2026-07-04: Records local-file proof now requires six concrete native local-file proofs instead of generic native share-sheet notes: iOS and Android Care Pass local HTML, iOS and Android Dog ID local HTML, and iOS and Android Dog ID SVG image source. Android content URI or saved-file proof requires Android `content://` or `file://` URI evidence for the three Android file slots. Local verification passed `reportArtifactExportFile.test.ts` `8/8`, focused Records local-file/doctor tests `122/122`, direct JSON doctor source-backed checks, the full zero-dependency suite `563/563`, root TypeScript, and mobile TypeScript. Branch CI proved commit `97fa65a` in `WoofWatcher Verify` run `28693966672`, job `85100292756`. Real native device capture remains required.

Current evidence, 2026-07-04: The focused Report Binary Export Proof manifest strengthens the generated artifact gate by making Care Pass PDF, Dog ID PNG, provider storage, and native artifact proof rows visible on `/care-twin-qa?qaSurface=report-binary-export-proof` while keeping `Generated artifacts allowed: No` until real file name, file size, MIME, native share/reopen, renderer, structured provider storage proof, iOS/Android artifact proof, and Apollo approval are attached. Local verification passed focused care-twin/doctor readiness `114/114`, the full zero-dependency suite `559/559`, root TypeScript, mobile TypeScript, and direct JSON doctor source-backed checks. Branch CI proved the focused manifest guard in `WoofWatcher Verify` run `28691498890`, job `85093511875`, on commit `822ff54`.

Current evidence, 2026-07-04: Generated Report Binary Export proof now requires four concrete native artifact proofs before readiness can open: iOS Care Pass PDF, Android Care Pass PDF, iOS Dog ID PNG, and Android Dog ID PNG. Generic native approval no longer marks the manifest ready; each artifact proof needs platform/artifact naming in the file name or URI, MIME, positive byte size, share proof, and reopen proof. Local verification passed focused report-binary/doctor tests `119/119`, direct JSON doctor source-backed checks, the full zero-dependency suite `562/562`, root TypeScript, and mobile TypeScript. Branch CI proved commit `41de898` in `WoofWatcher Verify` run `28693395380`, job `85098728807`. Real native iOS/Android capture and structured provider storage proof remain required.

Current evidence, 2026-07-04: Report Binary Export provider-storage proof now requires structured storage evidence before generated artifact readiness can open. A staged `storageProviderConfigured` boolean now leaves the provider row at `Provider storage pending structured proof`; readiness requires a proof locator, acceptable MIME, positive byte size, bucket names, signed upload/download, household scope, retention/export/deletion, QA evidence storage, and approval booleans. Local verification passed focused report-binary/release-QA/Share Beta Handoff/smoke/readiness tests `149/149`, direct JSON doctor source-backed checks, the full zero-dependency suite `576/576`, root TypeScript, mobile TypeScript, and `git diff --check`. Branch CI proved commit `eaa3b2e` in `WoofWatcher Verify` run `28700214241`, job `85116859609`. Real storage-provider proof files, native iOS/Android capture, store review, public launch, and Apollo sign-off remain required.

Current evidence, 2026-07-04: Shared attachment storage proof now requires structured storage evidence before local attachment queues can become upload-ready. A staged `storageProviderConfigured` boolean now keeps medication proof photos, record documents, Adventure memories, Care Pass reports, and QA screenshots `local-only`; readiness requires proof file naming, acceptable MIME, positive byte size, bucket names, signed upload/download policies, household scope, retention/export/deletion rules, QA evidence storage policy, approval owner, and approval booleans. Fresh red/green verification first showed the checkbox incorrectly making all local attachments upload-ready, then passed `attachmentManifest.test.ts` `6/6`, focused attachment/privacy/launch/release/store/mobile readiness tests `142/142`, the full zero-dependency API/mobile/PWA/care-domain suite `581/581`, root TypeScript, mobile TypeScript, direct JSON doctor source-backed checks, and `git diff --check`. Branch CI proved implementation commit `84c6fac` in `WoofWatcher Verify` run `28701902248`, job `85121219768`, with mobile beta doctor, focused behavior tests, and Typecheck plus CI-safe builds all passing. Real storage-provider proof files, native iOS/Android capture, store review, public launch, and Apollo sign-off remain required.

Current evidence, 2026-07-04: Launch Readiness now requires aggregate structured proof flags before provider/store/approval booleans can make the app store-ready. Complete native QA, complete local gates, and raw provider-approved booleans still stay `provider-gated` until auth provider proof, care-entry provider sync proof, AI provider proof, payments proof, account-deletion proof, push delivery proof, store-account proof, privacy/legal proof, support/refund proof, and storage proof flags are present. Fresh red/green verification first showed those booleans incorrectly producing `storeLaunchReady: true`, then passed focused launch/release/store/mobile readiness tests `131/131`, the full zero-dependency API/mobile/PWA/care-domain suite `582/582`, root TypeScript, mobile TypeScript, direct JSON doctor source-backed checks including `aggregate launch readiness proof guard is source-backed`, and `git diff --check`. Branch CI proved implementation commit `e257e4f` in `WoofWatcher Verify` run `28702584181`, job `85122931741`, with mobile beta doctor, focused behavior tests, and Typecheck plus CI-safe builds all passing. Real provider proof files, native evidence, store review, public launch, and Apollo sign-off remain required.

Current evidence, 2026-07-04: Route Visual proof now requires route-named evidence instead of accepting screenshot counts by platform. The manifest still displays total attached iOS and Android screenshots, but a row is only ready when that platform's evidence file name or URI names Home, Log, Plans, Health, Records, or More. Fresh red/green verification first showed generic six-iOS/six-Android attachments incorrectly marking the manifest ready, then passed focused Route Visual tests `26/26`, route/doctor readiness `114/114`, the full zero-dependency suite `560/560`, root TypeScript, mobile TypeScript, direct JSON doctor source-backed checks, and `git diff --check` with expected Windows CRLF warnings only. Branch CI proved commit `f273d3e` in `WoofWatcher Verify` run `28691984899`, job `85094842263`. Actual native screenshots and human visual approval remain required.

Current evidence, 2026-07-04: Route Visual capture handoff now tells testers how to satisfy the route-named proof gate. Share Beta Handoff, the Release Smoke Checklist, the Route Visual QA mission model, the mobile beta doctor, the native QA tooling doctor, the two-day beta plan, and the native QA matrix all require route label plus platform evidence names such as `Home-iOS`, `Home-Android`, and `More-Android`. Focused handoff/smoke/readiness tests passed `144/144`, focused doctor readiness passed `114/114`, and the full zero-dependency suite passed `560/560`. Branch CI proved commit `fd3a98f` in `WoofWatcher Verify` run `28692423522`, job `85096033279`; this is instruction/proof routing only, not native screenshot evidence.

Current evidence, 2026-07-03: The Payments provider proof manifest strengthens the paid-checkout launch gate by making product catalog, billing path decision, sandbox receipts, entitlements and restore, refund/support policy, and checkout gate evidence visible on `/care-twin-qa?qaSurface=payments-provider-proof` while keeping `Checkout allowed: No` until real billing, receipt, restore, refund/support, store, and Apollo checkout proof are attached. Branch CI proved the focused manifest guard in `WoofWatcher Verify` run `28690249414`, job `85090172228`, on commit `12c63eb`.

Current evidence, 2026-07-04: The Payments provider proof manifest now rejects generic receipt approvals. Sandbox receipts, restore proof, and checkout remain blocked until separate iOS App Store and Android Google Play JSON receipt evidence is attached with platform/store naming, positive byte size, product id, transaction id, purchase, renewal, cancellation, refund, expiration, and `restorePurchaseConfirmed`. Focused payments/handoff/smoke/checklist/readiness tests passed `148/148`, the full zero-dependency suite passed `569/569`, root TypeScript passed, mobile TypeScript passed, and direct JSON mobile beta doctor source-backed checks pass while still blocking on the local pnpm `11.7.0` vs pinned `10.24.0` mismatch. Branch CI proved commit `b579885` in `WoofWatcher Verify` run `28695703283`, job `85104771524`.

Current evidence, 2026-07-03: The Store accounts proof manifest strengthens the app-submission launch gate by making Apple Developer/App Store Connect access, Google Play package record, bundle/signing ownership, reviewer access, screenshots/metadata ownership, privacy-label readiness, and release role approval visible on `/care-twin-qa?qaSurface=store-accounts-proof` while keeping `App submission allowed: No` until real Apple/Google account and approval proof are attached.

Current evidence, 2026-07-04: The Store accounts proof manifest now rejects generic account approval notes. App submission stays blocked until structured platform/store-named proof files cover iOS App Store Connect developer access, Android Google Play package record, shared bundle/signing ownership, reviewer access, metadata/privacy labels, and Apollo release approval/no-submit boundary, including MIME, byte size, ids, roles, ownership fields, and approval booleans. Focused store/handoff/smoke/readiness tests passed `148/148`, the full zero-dependency suite passed `571/571`, root TypeScript passed, mobile TypeScript passed, and direct JSON doctor source-backed checks pass while still blocking on local pnpm/native-tooling environment gaps. Branch CI proved commit `0c495a1` in `WoofWatcher Verify` run `28696518769`, job `85106928992`, with JSON mobile beta doctor, focused behavior tests, and Typecheck plus CI-safe builds all passing.

Current evidence, 2026-06-11: Full Log search strengthens the paid history/trust wedge by making rich care evidence findable across notes, caregivers, routes, medication details, and sticky notes before server search indexes or long-history retention policy exist.

Current evidence, 2026-06-11: Medication History search/filter strengthens the paid health-history wedge by making dose and adherence evidence findable inside Records before provider-backed medication reports or server search exist.

Current evidence, 2026-06-19: CareTwin Roster readiness gives WoofWatcher a local multi-dog platform seam without fake switching. The care document persists `activePetId` and planned `pets`, More exposes a provider-gated roster card and Add future dog sheet, focused tests protect the roster model and mobile wiring, and owner export/deletion scope includes staged pet roster data.

## Gate 8: Production Safety

Passing means CI is green, API auth is household-scoped, secrets are absent, privacy/export/delete are planned, sync failures are visible, and release docs are accurate.

Current evidence, 2026-06-08: The owner-reviewed WoofGuide action model is covered by focused tests and release docs now point the next automation slice to privacy/account safety rather than additional assistant writes.

Current evidence, 2026-06-08: Mobile now has a Privacy & Safety surface for owner care-data export, non-destructive account deletion request preparation, WoofGuide AI disclosure, document storage gates, and payment launch blockers. The model is covered by focused tests and keeps live deletion/storage disabled until provider rules are approved.

Current evidence, 2026-07-03: The Account deletion proof manifest strengthens the destructive-deletion compliance gate by making deletion route/auth, export-before-delete handoff, data/object deletion receipt, audit/support receipt, recovery/cancellation policy, and legal/store approval visible on `/care-twin-qa?qaSurface=account-deletion-proof` while keeping `Destructive deletion allowed: No` until real provider, legal, store, and Apollo approval proof are attached.

Current evidence, 2026-07-04: Account deletion proof now requires six structured proof files instead of generic deletion-route/export/receipt/audit/recovery/legal approval strings: deletion-route/auth, export-before-delete, data/object deletion receipt, audit/support receipt, recovery/cancellation policy, and legal/store/Apollo approval. Each proof needs matching locator text, acceptable MIME, positive byte size, required row fields, and row-specific approval booleans. Fresh red/green verification first showed generic strings incorrectly making the manifest `ready-for-review`, then passed focused Account Deletion proof plus release-QA/handoff/smoke/readiness tests `148/148`, the full zero-dependency API/mobile/PWA/care-domain suite `574/574`, root TypeScript, mobile TypeScript, and direct JSON doctor source-backed checks. Branch CI proved this stricter guard in `WoofWatcher Verify` run `28697969135`, job `85110888132`, on commit `49b0f47`. Real provider deletion, storage/object deletion receipts, legal/privacy approval, App Store/Play Store deletion compliance, public launch, and Apollo sign-off remain required.

Current evidence, 2026-07-03: The Support legal readiness proof manifest strengthens the public-launch approval gate by making support inbox, privacy policy and terms links, refund/subscription policy, veterinary and emergency boundary, deletion escalation, incident response owner, and Apollo approval visible on `/care-twin-qa?qaSurface=support-legal-readiness-proof` while keeping `Public launch allowed: No` until real support/legal, store-review, and Apollo approval proof are attached.

Current evidence, 2026-07-04: Support legal readiness proof now requires seven structured proof files instead of generic support inbox/privacy-terms/refund/veterinary/deletion/incident/Apollo approval strings: support inbox, privacy policy and terms, refund/subscription, veterinary/emergency boundary, deletion escalation, incident response owner, and Apollo launch approval/no-launch boundary. Each proof needs matching locator text, acceptable MIME, positive byte size, required row fields, and row-specific approval booleans. Fresh red/green verification first showed generic strings incorrectly making the manifest `ready-for-review`, then passed focused Support Runbook proof tests `6/6`, focused Support Legal plus release-QA/handoff/smoke/readiness tests `150/150`, the full zero-dependency API/mobile/PWA/care-domain suite `576/576`, root TypeScript, mobile TypeScript, and direct JSON doctor source-backed checks. Branch CI proved this stricter guard in `WoofWatcher Verify` run `28698684465`, job `85112820340`, on commit `4082e30`. Real legal/privacy approval, refund/subscription approval, support operations, veterinary-boundary sign-off, App Store/Play Store support review, public launch, and Apollo sign-off remain required.

Current evidence, 2026-07-04: Care-entry provider sync proof now requires six structured proof files instead of generic Supabase ids, migration notes, RLS notes, policy notes, CI URLs, or mobile sign-off strings: Supabase project id, migration/backfill, active-household cursor/tombstone RLS, retention/export/deletion, dependency-complete build, and mobile incremental sign-off. Each proof needs matching file name or URI tokens, acceptable MIME, positive byte size, required row fields, and row-specific booleans or approvals. Fresh red/green verification first showed legacy provider strings incorrectly making the packet reviewable, then passed focused care-entry/provider-setup/handoff/release-QA/smoke/readiness tests `153/153`, the full zero-dependency API/mobile/PWA/care-domain suite `576/576`, root TypeScript, mobile TypeScript, `git diff --check`, and direct JSON doctor source-backed checks. Branch CI proved this stricter guard in `WoofWatcher Verify` run `28699549834`, job `85115170898`, on commit `2721de1`. Real Supabase migration execution, production RLS/privacy approval, retention/export/deletion policy, native incremental QA, rollback approval, public launch, and Apollo sign-off remain required.

Current evidence, 2026-06-14: Mobile Privacy & Safety now uses shared board anatomy for Export Summary, Launch Safety Gates, and Before Public Launch blockers while preserving owner data export, deletion-request sharing, AI/document/payment gating, and provider-backed truth boundaries.

Current evidence, 2026-06-19: Owner export and deletion scope now include local Adventure memories. The Adventure route labels memories as private household care evidence and creates `local-draft` memory records without claiming provider-backed photo storage, map data, or public sharing.

Current evidence, 2026-06-08: Focused tests now include static mobile readiness smoke for critical route registration, tab coverage, string router links, and safety copy on premium/privacy/WoofGuide surfaces. Expo runtime, visual, and accessibility QA remain open.

Current evidence, 2026-06-08: `build:ci` now runs `@workspace/woofwatcher-mobile`'s Expo web export smoke and verifies the export emits HTML and JavaScript assets. Native simulator/device rendering, screenshots, and accessibility QA remain open.

Current evidence, 2026-06-08: Focused tests now verify screen-reader labels on critical Privacy, Premium, WoofGuide, and More actions, including owner data export, deletion request preparation, WoofGuide review/send actions, Plus entry, and sign out. Full native accessibility traversal and visual QA remain open.

Current evidence, 2026-06-08: Expo app identity no longer uses Replit placeholders. Static readiness checks protect the WoofWatcher slug/scheme plus Pegasus Dreamscapes iOS bundle id and Android package id. Store submission still requires Expo/EAS/App Store accounts and approval.

Current evidence, 2026-06-13: Expo/EAS build and submit profiles now exist for iOS and Android, and static mobile readiness checks protect the EAS profile shape plus the mobile release runbook. Store submission still requires Apollo's Expo, Apple Developer, Google Play, privacy/legal, and launch approval.

Current evidence, 2026-06-08: Focused tests now cover the Home avatar motion state model and static wiring check. Native animation runtime verification, Rive/Lottie/Reanimated asset QA, and screenshot review remain open.

Current evidence, 2026-06-19: PixelLab asset verification now checks 148 assets across the full Phoenix sprite manifest, dogless room variants, 12 template previews, 12 template base stills, the 10-state Phoenix/Shepherd emote pack, the 10-state Retriever emote pack, the 10-state Husky/Spitz emote pack, the 10-state Bully compact-body emote pack, the 10-item accessory inventory pack, two subscription seed animation strips, the full current Option B hard-pixel Phoenix runtime candidate family including the dedicated bark/tap reaction, and live idle/walk sprite strips for every non-Phoenix launch template. Mobile readiness tests also verify Avatar Studio uses selected-template emote routing, applies crisp pixel image rendering, uses the Studio presentation of `LivingPhoenixRoom` instead of the old static hero path, and protects the Option B Phoenix runtime asset filenames/dimensions.

Current evidence, 2026-06-19: The care-twin runtime now has a tested native QA
matrix covering all 12 avatar motion states. Each scenario verifies expected
sprite action, room variant, zone, scene phase, priority need, and layered
readiness, and `docs/release/CARE_TWIN_NATIVE_QA_MATRIX.md` gives the matching
manual phone-size checks for iOS/Android QA.

Current evidence, 2026-06-19: The mobile app now exposes that care-twin matrix
through a development/internal `/care-twin-qa` route. The route renders every
scenario with production `LivingPhoenixRoom` assets and native QA prompts, and
static readiness tests protect the route, More-screen dev link, and matrix
wiring before the device pass.

Current evidence, 2026-06-19: The `/care-twin-qa` route now captures
session-level device review evidence with Pass/Needs tune controls, per-state
notes, summary counts, and a native shareable QA report. The report explicitly
keeps iOS/Android screenshot evidence as still required before launch approval.

Current evidence, 2026-06-20: The same internal QA route now captures broader
mobile release workflow evidence for Phoenix Home, Care Twin State Lab, Avatar
Studio, Incident Composer, Records Incident Watch, and Trainer Care Pass. The
tested `mobileReleaseQa.ts` model tracks required screenshot slots, Pass/Needs
tune status, per-surface notes, launch risks, route targets, and a combined
share report while preserving the boundary that real iOS/Android screenshots
are still required before launch approval.

Current evidence, 2026-06-20: The internal QA route now persists session evidence
locally through tested `mobileQaSession.ts` snapshot parsing plus AsyncStorage
wiring. Device testers can leave `/care-twin-qa`, inspect the target workflow,
return, and keep the same Pass/Needs tune state and notes before sharing the
combined report. The persistence is local-only QA convenience, not provider
storage or launch approval.

Current evidence, 2026-06-20: The care-twin room now has a tested choreography
model for game-like behavior. `careTwinChoreography.ts` derives the primary
sprite loop, ambient micro-loops, state-aware tap reaction, reaction duration,
and QA summary from the `AvatarLifePlan`; Home room taps use that model instead
of forcing every state into `bark-loop`, so rest and Health Watch states stay
calm while happy states can still bark. `/care-twin-qa` exposes the motion
recipe for device review.

Current evidence, 2026-06-20: The internal Mobile Release QA cockpit now accepts
local screenshot evidence from the device photo library for each release surface
and each care-twin state. Tested helpers sanitize attachment metadata, local QA
session persistence restores attached evidence, summary models count attached
and missing screenshots, and the native share reports include attached file
names. This improves the handoff packet for native QA, but final launch
confidence still requires real iOS/Android screenshot review and human visual
approval.

Current evidence, 2026-06-20: QA screenshot evidence is now platform-aware.
The cockpit automatically tags local attachments with the runtime platform, the
release summary tracks required iOS, Android, and general screenshot slots
separately, and share reports list file names with platform labels. This prevents
iOS-only or Android-only screenshots from falsely satisfying the full native QA
gate.

Current evidence, 2026-06-20: Mobile Release QA platform proof now uses tested
helper functions for complete evidence, flexible screenshot-slot satisfaction,
platform evidence labels, and missing-evidence copy. `/care-twin-qa` shows Native
proof open/ready, iOS/Android/flexible counts, and the exact evidence gap in the
summary and Launch Workflow header instead of relying on one aggregate screenshot
badge.

Current evidence, 2026-06-21: Store submission screenshot prep now flows through
the same internal QA cockpit. `mobileReleaseQa.ts` converts
`storeSubmissionPacket.ts` screenshot checklist rows into iOS/Android evidence
surfaces with route targets, store-safe prompts, and launch-risk copy.
`/care-twin-qa` renders Store Screenshot QA, includes those screens in platform
evidence counts, and can share the Store Submission packet from the QA route
without claiming App Store or Play Store approval.

Current evidence, 2026-06-21: saved Mobile Release QA proof now feeds the main
Launch Readiness model. `mobileLaunchQaEvidence.ts` derives a native QA summary
from the saved `/care-twin-qa` session, requires actual review data before
returning a summary, and More reloads that local session on focus before calling
`deriveLaunchReadiness`. The launch cockpit can now truthfully move from
"Device proof required" to the exact missing iOS/Android/flexible evidence state
after local device QA evidence is attached.

Current evidence, 2026-06-21: Launch Readiness now also exposes a tested Native
QA next-captures panel. The capture-plan model computes open surfaces, complete
surfaces, and missing evidence labels from the saved QA session, then More shows
the next capture targets as direct route jumps. This reduces manual checklist
drift during device QA without claiming that screenshots are complete.

Current evidence, 2026-06-21: Native QA next-captures now has a shareable guide.
`buildMobileLaunchQaCaptureShareText` formats the same capture plan into an
owner/tester script with progress, routes, missing proof, attached counts, and
the final device-review boundary. More exposes this through `Share QA Plan`
inside the launch cockpit.

Current evidence, 2026-06-23: Mobile Release QA surfaces now carry explicit
numbered device verification steps in the shared `mobileReleaseQa.ts` model.
The `/care-twin-qa` cockpit renders those Device steps and generated Store
steps before evidence capture, Mobile Release QA share reports include the
same route-check instructions, and More's Native QA Next Captures panel shows
the first concrete step for each next target. This makes the phone QA handoff
more executable without claiming iOS/Android screenshots are complete.

Current evidence, 2026-06-23: The same Mobile Release QA surfaces now carry
setup/precondition steps before the numbered verification steps. The handoff
can tell testers how to prepare demo-safe state for pending meal, active walk,
Alone Time, Incident Watch, Avatar Studio, and blocked store-screenshot review
before attaching native screenshots. `/care-twin-qa` renders Setup first/Store
prep ahead of evidence capture, More shows the first prep step in Native QA
Next Captures, and share text includes both setup and verification instructions.

Current evidence, 2026-06-23: Mobile Release QA and generated Store Screenshot
surfaces now include explicit pass criteria plus Needs tune failure escalation.
`/care-twin-qa` renders pass criteria before capture, More's Native QA Next
Captures rows surface the first criterion, and Mobile Release QA / Native QA
share scripts carry the pass/failure language. This prevents fake visual passes
and tells testers exactly when to mark a route Needs tune.

Current evidence, 2026-06-21: Provider launch readiness is now a durable,
truthful owner workflow. `launchProviderSetup.ts` derives an eight-gate
production setup plan for auth, database sync, storage, AI, payments, push,
store accounts, and self-serve deletion; More renders it inside Launch
Readiness with an edit sheet and share action; `CareContext` persists
`launchProviderProfile`; Privacy export includes the profile; and the shared
launch-readiness model consumes the saved gates. The model intentionally clamps
partial "provider approved" state back to owner-reviewed until every gate is
ready, and the share packet states that it is not App Store or Play Store
approval.

Current evidence, 2026-06-19: The Option B living-room polish pass keeps Phoenix as one layered main sprite instead of a second-avatar illusion. Home quick-log actions now request action-specific sprite reactions, the room renderer adds ambient micro-behaviors and rest-state safeguards, Avatar Studio suppresses oversized still/accessory overlays when a live sprite pack is active, and PixelIcon paths use crisp pixel rendering on web.

Current evidence, 2026-06-19: PixelLab subscription review did not promote weaker replacement candidates. The clean single still candidate is archived for reference, while the duplicate/cropped and gray identity-drift candidates are explicitly rejected in the PixelLab generation log. The current hard-pixel Option B runtime family remains the approved live source until native QA or a stronger reference-guided generation beats it.

Current evidence, 2026-06-13: Focused tests now cover durable sync outbox derivation, household Sync Health derivation, Household Responsibility derivation/mobile wiring, Household Access derivation/mobile wiring, Care Log Audit Trail derivation/mobile wiring, Full Log search derivation/mobile wiring, Medication History search/filter derivation/mobile wiring, conflict-safe care document refresh reconciliation, Saved Routes derivation/report/mobile wiring, Weekly Care Trends derivation/report/mobile wiring, Training Progress derivation/report/mobile wiring, Alone Time derivation/report/mobile wiring, Weight Trend derivation/report/mobile wiring, Grooming Care derivation/mobile wiring, Reminder Center derivation/mobile wiring/action routing, static mobile wiring, EAS profile readiness, and mobile release runbook coverage. Local focused tests pass at 195 tests. Local `pnpm run build:ci` remains blocked only because `pnpm` is unavailable in this Windows shell.

Current evidence, 2026-06-14: `WoofWatcher Verify` uses Node 24-compatible action majors for checkout, setup-node, and pnpm setup, and keeps the project test/build runtime pinned to Node 24.

Current evidence, 2026-06-20: The local behavior/readiness suite passes at 300 tests after the Mobile Release QA platform-proof refinement and shared safe-area passes, covering mobile readiness, QA reporting, platform-aware screenshot evidence, privacy export, PWA contracts, shared care-domain behavior, tabbed-route bottom clearance, standalone-route bottom clearance, auth shell spacing, and docked WoofGuide composer spacing. Mobile TypeScript, PixelLab asset verification at 149 files, Expo web export, and `git diff --check` also pass locally.

Current evidence, 2026-06-20: Mobile tab clearance is now centralized in `mobileLayout.ts`. The tab shell derives tab bar and center-paw metrics from one helper, and Home, Log, Plans, Health, More, and Records all call `getTabbedRouteBottomPadding` so iOS, Android, and web route content stays clear of the floating paw navigation without route-local magic numbers.

Current evidence, 2026-06-20: Standalone route and docked-composer spacing are now centralized in `mobileLayout.ts`. Adventure, Avatar Studio, Care Twin QA, Premium, Privacy, Setup, and the auth shell call `getStandaloneRouteBottomPadding`, while WoofGuide calls `getDockedComposerBottomPadding`, so non-tab screens and bottom input controls share the same iOS/Android/web safe-area contract before real device QA.

Current evidence, 2026-06-20: First-run setup now has an auth-aware household path without fake cloud claims. The setup wizard persists `householdSetup` with create, join-by-invite, or local-preview intent; join codes are normalized and required before saving; confirmation copy distinguishes local-only state from Clerk/account-ready state; Privacy export includes household setup metadata; and static mobile readiness protects the new setup copy. Local verification passed 302 behavior/readiness tests, mobile TypeScript, PixelLab asset verification at 149 files, Expo web export to `tmp/woofwatcher-household-setup-export`, and `git diff --check`.

Current evidence, 2026-06-21: Mobile interaction spacing is now a shared release
contract, not route-local arithmetic. `mobileLayout.ts` owns top safe-area
padding for tabbed, standalone, setup, and auth surfaces; modal sheet bottom
padding; centered modal backdrop padding; keyboard avoiding offsets; feedback
and debug offsets; minimum 48px touch targets; and shared inline hit slop. Home,
Log, Plans, Health, More, Records, Adventure, Avatar Studio, Care Twin QA,
Premium, Privacy, Setup, AuthShell, WoofGuide, ErrorFallback, and board
primitives call the shared helpers. Static readiness tests reject hard-coded
top safe-area formulas, unsafe modal bottom padding, and literal 8/10 hit slop.
Local verification passed 306 behavior/readiness tests, focused mobile
layout/readiness tests at 76 tests, mobile TypeScript, PixelLab asset
verification at 149 files, and Expo web export to
`tmp/woofwatcher-mobile-interaction-contract-export`.

Current evidence, 2026-06-24: Access Pass expiry is now enforced at request
time for helper roles before public-launch cleanup jobs exist. Activated helper
memberships persist `accessPassExpiresAt`; expired sitter/trainer/walker/vet
viewer helper passes resolve to `expired access pass` inside authorization;
care-entry writes treat that state as read-only; and `/me`, OpenAPI, Zod, and
React generated member schemas expose `accessPassExpiresAt` plus
`accessPassExpired` so the UI can tell the truth. Local verification passed the
RED/GREEN Access Pass/API readiness tests, 378 focused behavior/readiness tests,
mobile TypeScript, syntax checks, PixelLab asset verification at 149 files,
`git diff --check`, and package-local Expo export. Provider migration, RLS,
retention/export/deletion policy, provider invite UI/delivery, expired-invite
cleanup, and expired-helper cleanup remain launch gates.

Current evidence, 2026-06-24: Household invitation lifecycle readiness is now a
durable provider-facing contract instead of a legacy static invite code only.
`household_invitations` stores unique invite codes, invited email/user metadata,
canonical roles, pending/approved/accepted/revoked/expired/rejected lifecycle
states, actor timestamps, notes, expiry windows, and provider metadata.
Owner/admin invite list/create/revoke APIs are authenticated and active-household
scoped; `/household/join` prefers durable invitation rows, blocks unsafe states,
marks accepted invites, applies invitation roles, and keeps the legacy code path
only as a fallback. Local verification passed RED/GREEN invitation/API readiness
tests, 381 focused behavior/readiness tests, mobile TypeScript, syntax checks,
PixelLab asset verification at 149 files, `git diff --check`, and package-local
Expo export. Provider migration, RLS, invite notification delivery, provider UI
wiring, scheduled expired-invite cleanup, retention/export/deletion policy, and
legal/privacy approval remain launch gates.

Current evidence, 2026-06-24: Household sharing cleanup review is now a
non-destructive owner/admin provider-readiness API. `GET
/household/sharing-cleanup` is authenticated, active-household scoped,
owner/admin-only, validates `limit` and `kind` filters, derives `review-only`
stale candidates from runtime-expired invitation rows and expired Access Pass
helper memberships, and exposes OpenAPI, Zod, and React generated contracts.
Local verification passed RED/GREEN cleanup/API readiness tests, 384 focused
behavior/readiness tests, mobile TypeScript, syntax checks, PixelLab asset
verification at 149 files, and package-local Expo export. Applying cleanup,
Supabase migration/RLS, retention/export/deletion policy, invite delivery/UI,
legal/privacy approval, and native iOS/Android screenshots remain launch gates.

Current evidence, 2026-06-25: The release packet now separates two-day internal
beta readiness from public App Store / Play Store readiness. More's Launch
Readiness board shows a 48-hour beta card backed by `betaShipStatus`,
`betaVerdictLabel`, `betaSummary`, and `betaNextActions`; share text includes a
48-hour beta target while preserving "not ready for public launch" when provider,
payment, legal, native QA, or store gates are open. Targeted release/readiness
verification passed 81 tests, the broader focused behavior/readiness suite passed
at 386 tests, mobile TypeScript passed, PixelLab verified 149 assets, and
package-local Expo web export emitted HTML/JavaScript output. Native iOS/Android
screenshots and human visual approval remain required before the beta goes
outside the owner/builder loop.

Current evidence, 2026-06-25: More's Launch Readiness board now makes the
two-day beta path actionable in-app. The 48-hour beta card renders the release
packet's first three `betaNextActions` and provides an accessible CTA that opens
`/care-twin-qa` when device proof is still needed or shares the beta packet when
internal circulation is ready. Local verification passed 81 targeted
release/readiness tests, 386 focused behavior/readiness tests, mobile
TypeScript, PixelLab verification at 149 files, `git diff --check`, and
package-local Expo web export with HTML/JavaScript output verified and cleaned.
Real iOS/Android screenshot proof remains the next quality gate.

Current evidence, 2026-06-25: `/care-twin-qa` now begins with a 48-hour beta
run card that derives the next native capture target from saved QA evidence,
shows the missing proof, complete/open count, and direct `Open Next Surface`
plus `Share QA` actions. Local verification passed 85 targeted QA/readiness
tests, 386 focused behavior/readiness tests, mobile TypeScript, PixelLab
verification at 149 files, `git diff --check`, and package-local Expo web export
with HTML/JavaScript output verified and cleaned. The card reduces device-test
friction but does not replace real iOS/Android screenshot capture.

Current evidence, 2026-06-25: `/care-twin-qa` now includes explicit screenshot
platform tagging for the two-day beta run. Testers choose iOS, Android, or Web
before attaching from Photos; new evidence persists the selected `targetPlatform`;
and attached screenshot rows display the counted platform label. Local
verification passed 85 targeted QA/readiness tests, 386 focused
behavior/readiness tests, mobile TypeScript, PixelLab verification at 149 files,
`git diff --check`, and package-local Expo web export with HTML/JavaScript output
verified and cleaned. Real device capture and human visual approval remain
required before broader beta circulation.

Current evidence, 2026-06-25: The native QA capture loop now has a route-level
return path. `/care-twin-qa` opens target routes with `qaReturn=care-twin-qa`,
`qaSurface`, and `qaTitle`; shared board-header routes render a temporary
`Return to QA Cockpit` banner during those sessions; and the banner returns to
`/care-twin-qa` so testers can attach proof and mark Pass or Needs tune. Local
verification passed 85 targeted QA/readiness tests, 386 focused
behavior/readiness tests, mobile TypeScript, PixelLab verification at 149 files,
`git diff --check`, and package-local Expo web export with HTML/JavaScript output
verified and cleaned. This improves capture flow but still requires real iOS and
Android screenshots plus human review.

Current evidence, 2026-06-25: The `/care-twin-qa` 48-hour beta run now includes
a `Next device mission` briefing before testers leave the cockpit. The briefing
shows the next route, priority, current status, attached evidence count, setup
steps, pass criteria, and the exact `Needs tune if` escalation copy for that
surface. Static mobile readiness verification passed 85 targeted QA/readiness
tests and now protects that mission briefing. Broader local verification also
passed 386 focused behavior/readiness tests, mobile TypeScript, PixelLab
verification at 149 files, `git diff --check`, and package-local Expo web export
with HTML/JavaScript output verified and cleaned. This reduces two-day beta
capture friction, but it is still preparation only; native iOS/Android
screenshots and human approval remain required before wider beta circulation.

Current evidence, 2026-06-25: The `/care-twin-qa` 48-hour beta run now keeps the
active mission's evidence and review actions in the top card. The card resolves
the active QA surface from `nextBetaTarget`, lets testers attach proof using the
selected iOS/Android/Web evidence tag, and lets them mark the current mission
Pass or Needs tune without scrolling to the long checklist. Static mobile
readiness protects those accessible mission controls and shared 48px touch
targets. Local verification passed 85 targeted QA/readiness tests, 386 focused
behavior/readiness tests, mobile TypeScript, PixelLab verification at 149 files,
`git diff --check`, and package-local Expo web export with HTML/JavaScript
output verified and cleaned. This improves the internal beta capture loop but
does not replace real device screenshots or human approval.

Current evidence, 2026-06-25: Mobile Release QA now includes a launch-critical
`Owner Preview Core Loop` surface so the two-day beta does not pass on isolated
screen polish alone. The surface requires Home, Log, Plans, Health, More,
Records, Avatar Studio, and Care Pass to be reachable without dead ends; asks
testers to quick-log one safe care event or open the detail sheet; checks Plans
reachability, Health Watch/Bile Watch non-diagnostic language, and More's Launch
Readiness truth boundaries; and requires iOS Quick Log/Log evidence plus Android
Launch Readiness evidence. Local verification passed 86 targeted QA/readiness
tests, 387 focused behavior/readiness tests, mobile TypeScript, PixelLab
verification at 149 files, `git diff --check`, and package-local Expo web export
with HTML/JavaScript output verified and cleaned. Real iOS/Android screenshots,
human visual approval, provider setup, legal/privacy review, and store approval
remain launch gates.

Current evidence, 2026-06-25: The owner-preview path is now guided inside the
QA cockpit instead of living only in docs. `/care-twin-qa` renders an `Owner
route loop` panel for the Owner Preview Core Loop, and the launch capture model
exports the same Home, Log, Plans, Health, More, Records, Avatar Studio, and Care
Pass checklist into the share script. Local verification passed 87 targeted
QA/readiness tests, 388 focused behavior/readiness tests, mobile TypeScript,
PixelLab verification at 149 files, `git diff --check`, and package-local Expo
web export with HTML/JavaScript output verified and cleaned. Real iOS/Android
screenshots and human visual approval remain the next beta gate.

Current evidence, 2026-06-25: Required owner-preview QA notes are now enforced by
the capture plan. Required `Note ...` evidence keeps a surface open until a
surface note exists, and `/care-twin-qa` exposes a top-card `Mission note` input
that is labeled Required when the active beta target needs note proof. Targeted
QA/readiness verification passed 88 tests, focused behavior/readiness
verification passed 389 tests, mobile TypeScript passed, PixelLab verification
passed at 149 files, `git diff --check` passed, and package-local Expo web
export emitted HTML/JavaScript output that was verified and cleaned. Real
iOS/Android screenshots and human visual approval remain the next beta gate.

Current evidence, 2026-06-25: `/care-twin-qa` now includes the live native
capture plan inside its own `Share QA` packet. The shared text starts with
`buildMobileLaunchQaCaptureShareText(betaCapturePlan, reviewedAtIso)` before the
full mobile release QA, store submission packet, and care-twin state report, so
the actual cockpit handoff carries the same next target, missing evidence,
Owner route loop, Mission note requirement, and done condition shown in the
48-hour beta run card. Targeted QA/readiness verification passed 88 tests,
focused behavior/readiness verification passed 389 tests, mobile TypeScript
passed, PixelLab verification passed at 149 files, `git diff --check` passed,
and package-local Expo web export emitted HTML/JavaScript output that was
verified and cleaned.

Current evidence, 2026-06-25: `/care-twin-qa` now guards against a false Pass
state in the 48-hour beta run card. When the next mission is marked Pass but
required screenshots or Mission note proof are still missing, the cockpit shows
`Pass pending proof`, explains that the mission stays open until proof is
attached and the Mission note is saved, and lists the first missing evidence
items in the same mission card. Targeted QA/readiness verification passed 88
tests, focused behavior/readiness verification passed 389 tests, mobile
TypeScript passed, PixelLab verification passed at 149 files, `git diff --check`
passed, and package-local Expo web export emitted HTML/JavaScript output that
was verified and cleaned.

Current evidence, 2026-06-25: More's Launch Readiness board now preserves that
same proof truth. The Native QA Next Captures panel renders a `Proof status`
row for each target, labels proof-incomplete Pass rows as `Pass pending proof`,
uses that label in the accessibility description, and the shareable QA capture
script now exports the same owner-readable status. Targeted QA/readiness
verification passed 88 tests, focused behavior/readiness verification passed
389 tests, mobile TypeScript passed, PixelLab verification passed at 149 files,
`git diff --check` passed, and package-local Expo web export emitted
HTML/JavaScript output that was verified and cleaned.

Current evidence, 2026-06-25: More's Native QA Next Captures panel now gives
testers a direct proof-completion route. The action rail includes `Share QA
Plan` and a second 48px mobile action that says `Finish Proof` when any target
is `Pass pending proof`, otherwise `Open QA Cockpit`, and routes directly to
`/care-twin-qa` with accessible copy. Red/green mobile readiness passed after
the guard caught the missing action, targeted QA/readiness verification passed
88 tests, focused behavior/readiness verification passed 389 tests, mobile
TypeScript passed, PixelLab verification passed at 149 files, `git diff
--check` passed, and package-local Expo web export emitted HTML/JavaScript
output that was verified and cleaned.

Current evidence, 2026-06-25: `/care-twin-qa` now uses the shared mobile touch
target contract for the cockpit controls a tester must hit during the two-day
beta run: screenshot platform tags, Open Next Surface, Share QA, Share QA
Summary, evidence attach/clear, per-surface Open Surface, and Pass/Needs tune
review buttons. The readiness test now parses named style blocks and fails when
those controls drift back to route-local undersized heights. Red/green mobile
readiness passed after first failing on the 44px platform picker, targeted
QA/readiness verification passed 88 tests, focused behavior/readiness
verification passed 389 tests, mobile TypeScript passed, PixelLab verification
passed at 149 files, `git diff --check` passed, and package-local Expo web
export emitted HTML/JavaScript output that was verified and cleaned.

Current evidence, 2026-06-25: Quick Log's owner-preview actions now share the
same mobile touch-target contract. The Log route uses `MIN_MOBILE_TOUCH_TARGET`
for retry/sync recovery, care-type tabs, quick-feedback Undo/Add details,
alone-time return outcomes, active-walk finish, trust proof attachment,
trust-review actions, meal outcome updates, potty outcome options, and potty
detail save. Static readiness now protects those named style blocks. Red/green
mobile readiness passed after first failing on the 36px `outboxButton`,
targeted QA/readiness verification passed 88 tests, focused behavior/readiness
verification passed 389 tests, mobile TypeScript passed, PixelLab verification
passed at 149 files, `git diff --check` passed, and package-local Expo web
export emitted HTML/JavaScript output that was verified and cleaned.

Current evidence, 2026-06-25: Health Watch's owner-preview controls now share
the same mobile touch-target contract. The Health route uses
`MIN_MOBILE_TOUCH_TARGET` for the Health/Bile segmented tabs plus the `Log
health note` and `Records` hero actions, while decorative pixel health meters
remain visual-only. Static readiness now protects those named style blocks so
Health Watch and Bile Watch stay tappable during the two-day beta route loop.
Red/green mobile readiness passed after first failing on the 36px `tabPill`,
targeted QA/readiness verification passed 88 tests, focused behavior/readiness
verification passed 389 tests, mobile TypeScript passed, PixelLab verification
passed at 149 files, `git diff --check` passed with expected Windows
line-ending warnings only, and package-local Expo web export emitted
HTML/JavaScript output that was verified and cleaned.

Current evidence, 2026-06-25: Plans' owner-preview controls now share the same
mobile touch-target contract. The Plans route uses `MIN_MOBILE_TOUCH_TARGET` for
Add plan, Find event, suggestion add, schedule tabs, schedule completion,
routine add, event remove, routine done, modal type chips, owner chips, save,
and delete controls. Static readiness now protects those named Plans style
blocks so schedule and routine work cannot regress to cramped route-local
28-42px controls during beta review. Red/green mobile readiness passed after
first failing on the 40px `addBtn`, targeted QA/readiness verification passed
89 tests, focused behavior/readiness verification passed 390 tests, mobile
TypeScript passed, PixelLab verification passed at 149 files, `git diff
--check` passed with expected Windows line-ending warnings only, and
package-local Expo web export emitted HTML/JavaScript output that was verified
and cleaned.

Current evidence, 2026-06-25: More's launch and household gateway actions now
share the same mobile touch-target contract. The More route uses
`MIN_MOBILE_TOUCH_TARGET` for profile edit, Care Intelligence action, provider
setup actions, native QA share/cockpit actions, beta next action, Launch/Store
packet share actions, Access Pass share and role chips, household invite,
prompt modal actions, provider status chips, weight-unit chips, and
profile/diet/provider save buttons. Static readiness now protects those named
More style blocks so Launch Readiness, household handoff, provider setup, and
Care Pass gateway actions stay tappable during the two-day beta route loop.
Red/green mobile readiness passed after first failing on the 32px
`profileEditBtn`, targeted QA/readiness verification passed 90 tests, focused
behavior/readiness verification passed 391 tests, mobile TypeScript passed,
PixelLab verification passed at 149 files, `git diff --check` passed with
expected Windows line-ending warnings only, and package-local Expo web export
emitted HTML/JavaScript output that was verified and cleaned.

Current evidence, 2026-06-25: Records and Care Pass actions now share the same
mobile touch-target contract. The Records route uses `MIN_MOBILE_TOUCH_TARGET`
for Dog ID share/print actions, medication search clear and filter chips, Care
Pass preview rows, saved report artifact resend/print actions, progress report
period tabs, record delete, empty add, record type chips, attachment, and sheet
cancel/save controls. Static readiness now protects those named Records style
blocks so report, credential, medication, and vault handoff actions stay
tappable during the two-day beta route loop. Red/green mobile readiness passed
after first failing on `shareInline`, targeted QA/readiness verification passed
91 tests, focused behavior/readiness verification passed 392 tests, mobile
TypeScript passed, PixelLab verification passed at 149 files, `git diff
--check` passed with expected Windows line-ending warnings only, and
package-local Expo web export emitted HTML/JavaScript output that was verified
and cleaned.

Current evidence, 2026-06-25: Avatar Studio creator actions now share the same
mobile touch-target contract. The Avatar Studio route uses
`MIN_MOBILE_TOUCH_TARGET` for creator tabs, gallery/take-photo/reset/save
buttons, coat swatches, face-marking options, mood preview chips, and
shared-constant-backed large template/accessory tiles. Static readiness protects
those named style blocks so the scan-assisted creator stays tappable during the
two-day beta route loop without shrinking the larger pixel-art template tiles.
Red/green mobile readiness passed after first failing on the 40px `tab`,
targeted QA/readiness verification passed 92 tests, focused behavior/readiness
verification passed 393 tests, mobile TypeScript passed, PixelLab verification
passed at 149 files, `git diff --check` passed with expected Windows
line-ending warnings only, and package-local Expo web export emitted
HTML/JavaScript output that was verified and cleaned.

Current evidence, 2026-06-25: Adventure Mode's owner-preview memory actions now
share the same mobile touch-target contract. The Adventure route uses
`MIN_MOBILE_TOUCH_TARGET` for the `Save Memory` primary action and the `Share
Adventure` secondary action, while leaving the illustrated quest cards and
private real-care adventure copy unchanged. Static readiness protects
`primaryBtn` and `secondaryBtn` so the beta's care-RPG layer cannot quietly
return to route-local 47px controls. Red/green mobile readiness passed after
first failing on `primaryBtn`, targeted QA/readiness verification passed 93
tests, focused behavior/readiness verification passed 394 tests, PixelLab
verification passed at 149 files, and `git diff --check` passed with expected
Windows line-ending warnings only. Mobile TypeScript is currently
dependency-blocked in this cleaned Windows shell because the Expo/mobile
dependency layer is absent (`expo/tsconfig.base` not found). Package-local Expo
web export was not completed for this slice in the current Windows shell: the
first attempt lacked `pnpm`, and the network-enabled bundled-pnpm attempt
reached the registry but failed before export because the root preinstall script
calls `sh`, which is unavailable in this shell. Re-run export from a
shell-compatible environment or preinstalled dependency layer before treating
this slice as export-proven.

Current evidence, 2026-06-25: Phoenix Home's owner-preview first screen now
shares the same mobile touch-target contract. Home imports
`MIN_MOBILE_TOUCH_TARGET` and uses it for `headerButton`, `heroStudioButton`,
`presencePanel`, and `adventureInline`, covering the menu/header action, Avatar
Studio hero entry, household presence card, and Adventure inline entry. Static
readiness protects those named style blocks so the beta's opening route cannot
quietly return to cramped 39-42px controls. Red/green mobile readiness passed
after first failing on the 42px `headerButton`, targeted QA/readiness
verification passed 94 tests, focused behavior/readiness verification passed
395 tests, PixelLab verification passed at 149 files, and `git diff --check`
passed with expected Windows line-ending warnings only. Mobile TypeScript is
currently dependency-blocked in this cleaned Windows shell because the
Expo/mobile dependency layer is absent (`expo/tsconfig.base` not found). Package
export should be re-run from Git Bash, WSL, CI, or a preinstalled dependency
layer before treating this slice as export-proven.

Current evidence, 2026-06-25: WoofGuide's prompt, send, and owner-review
actions now share the same mobile touch-target contract. WoofGuide imports
`MIN_MOBILE_TOUCH_TARGET` and uses it for `quickChip`, `actionRow`, `sendBtn`,
`reviewCancel`, and `reviewApply`, covering quick questions, suggested
owner-reviewed actions, the chat composer send control, and the draft review
modal's Cancel/Apply controls. Static readiness protects those named style
blocks so the beta's assistant route cannot quietly return to cramped prompt or
review controls. Red/green mobile readiness passed after first failing on
`quickChip`, targeted QA/readiness verification passed 95 tests, focused
behavior/readiness verification passed 396 tests, PixelLab verification passed
at 149 files, and `git diff --check` passed with expected Windows line-ending
warnings only. Mobile TypeScript is currently dependency-blocked in this cleaned
Windows shell because the Expo/mobile dependency layer is absent
(`expo/tsconfig.base` not found). Package export should be re-run from Git Bash,
WSL, CI, or a preinstalled dependency layer before treating this slice as
export-proven.

Current evidence, 2026-06-25: More's Launch Readiness beta card now has a
one-tap 48-hour beta handoff packet for Apollo, testers, or design-polish tools.
`betaHandoffPacket.ts` combines the release packet with the live native QA
capture plan, including the beta verdict, public-launch verdict, QA progress,
next device mission, missing proof, setup/device steps, pass criteria, Needs
tune copy, Owner route loop run order, Pass pending proof instruction, and
truth boundaries for public launch, provider-backed services, and WoofGuide.
More imports `buildBetaHandoffPacketShareText`, adds a `Share Beta Handoff`
action on the beta card, and keeps the new action on `MIN_MOBILE_TOUCH_TARGET`
through `betaHandoffShareButton`. Red/green verification passed after the new
helper and More wiring were absent, targeted beta QA/readiness verification
passed 97 tests, focused behavior/readiness verification passed 398 tests,
PixelLab verification passed at 149 files, and `git diff --check` passed with
expected Windows line-ending warnings only. Mobile TypeScript and Expo export
remain dependency/shell-gated in this cleaned Windows shell and should be rerun
from Git Bash, WSL, CI, or a preinstalled dependency layer.

Current evidence, 2026-06-25: Native QA now has a focused Needs Tune repair
packet for the two-day beta run. `mobileLaunchQaEvidence.ts` stores
`firstNeedsTuneTarget` on the capture plan even when the first Needs tune route
is outside the visible next-four capture rows, and
`buildMobileLaunchQaFixBriefShareText` produces an owner-readable fix brief with
route, priority, QA note, proof gaps, setup/repro steps, optional Owner route
loop, done condition, Needs tune rule, and return-to-`/care-twin-qa`
instructions. More's Native QA Next Captures panel shows `Share Fix Brief` only
when a Needs tune target exists, and the button uses the shared
`MIN_MOBILE_TOUCH_TARGET` contract through `nativeQaCaptureFixBrief`.
Red/green verification passed after the helper export and More wiring were
absent: `mobileLaunchQaEvidence.test.ts` passed 12 tests and
`mobileReadiness.test.ts` passed 78 tests. Follow-up local verification passed
the 100-test targeted beta QA/readiness suite, the 401-test focused
behavior/readiness suite, PixelLab verification at 149 files, and `git diff
--check` with expected Windows line-ending warnings only. Real iOS/Android
capture remains the external gate; mobile TypeScript and Expo export remain
dependency/shell-gated in this cleaned Windows shell and should be rerun from
Git Bash, WSL, CI, or a preinstalled dependency layer with Expo/mobile deps.

Current evidence, 2026-06-25: The root install guard no longer depends on a
Unix shell before package install/export can start. `package.json` now calls
`node scripts/enforce-pnpm-install.mjs` for `preinstall`; the Node guard still
removes forbidden `package-lock.json` and `yarn.lock` files and still rejects
npm/yarn user agents, but it runs in Windows-friendly Node instead of `sh -c`.
Static mobile readiness protects the root command and guard behavior because
this directly affects the two-day mobile beta export path. Red/green readiness
passed after first failing on the missing guard script. Direct guard checks
passed with `npm_config_user_agent=pnpm/9.0.0` and failed as expected with
`npm_config_user_agent=npm/10.0.0`. Follow-up verification passed the 101-test
targeted beta QA/readiness suite, the 402-test focused behavior/readiness
suite, PixelLab verification at 149 files, and `git diff --check` with expected
Windows line-ending warnings only. Real Expo export still requires pnpm and the
Expo/mobile dependency layer in the execution environment; real iOS/Android
capture remains the external beta gate.

Current evidence, 2026-06-25: The mobile Expo app config now exposes the
intended export surfaces instead of relying on implicit defaults.
`artifacts/woofwatcher-mobile/app.json` declares `ios`, `android`, and `web`
platforms and sets `expo.web.bundler` to `metro`. Static mobile readiness now
protects those values inside the Expo web export smoke wiring test. Red/green
readiness first failed on the missing app-config assertions, then passed after
the config was wired. A direct package-local Expo CLI export attempt advanced
past the earlier `No platforms are configured to use the Metro bundler` error
and now stops at the dependency-layer blocker: `Cannot determine the project's
Expo SDK version because the module 'expo' is not installed`. Do not mark Expo
export proven until a dependency-complete mobile environment runs the smoke
export and verifies emitted HTML/JavaScript output.

Current evidence, 2026-06-25: The two-day beta now has a root environment
doctor before export. `pnpm run doctor:mobile-beta` runs
`scripts/mobile-beta-doctor.mjs`, which checks pnpm availability, the
Windows-friendly install guard, mobile `smoke:web`, Expo iOS/Android/web +
Metro config, mobile Expo dependency resolution, PixelLab verifier presence,
and the required `/care-twin-qa` owner-preview proof steps. Static mobile
readiness protects the command and its QA proof language. The doctor currently
exits blocked in this cleaned Windows shell because `pnpm` is unavailable and
the mobile package cannot resolve `expo`; those must clear before package-local
Expo export can count as proven.

Current evidence, 2026-06-25: The root package manager is now pinned to the
same pnpm version used by the verify workflow. `package.json` declares
`packageManager: pnpm@10.24.0`, `.github/workflows/verify.yml` configures pnpm
`10.24.0`, and `scripts/mobile-beta-doctor.mjs` checks those two values before
handoff. Static mobile readiness protects the root package-manager pin, the CI
workflow version, and the doctor check. The doctor now passes this gate while
still reporting the truthful local blockers: no `pnpm` on PATH and no mobile
`expo` dependency resolution in this cleaned Windows shell.

Current evidence, 2026-06-25: The beta doctor now gives a deterministic
bootstrap path for the missing-pnpm gate. `scripts/mobile-beta-doctor.mjs`
checks Corepack as a warning-level helper and prints
`corepack prepare pnpm@10.24.0 --activate` when pnpm is missing. Static mobile
readiness protects the Corepack copy and exact activation command. In this
cleaned Windows shell Corepack is not on PATH, so the warning correctly tells a
helper to install pnpm 10.24.0 directly or use Replit/WSL; the true export
blockers remain missing pnpm and missing mobile Expo dependency resolution.

Current evidence, 2026-06-25: The beta doctor now verifies native environment
readiness before handoff. `scripts/mobile-beta-doctor.mjs` blocks below Node 24
and checks `artifacts/woofwatcher-mobile/eas.json` for preview and production
iOS/Android build profile coverage. Static mobile readiness protects both
doctor contracts. In this cleaned Windows shell those new checks pass, while
the doctor still correctly blocks on missing pnpm and missing mobile Expo
dependency resolution until a dependency-complete environment runs install and
export proof. Follow-up verification passed 102 targeted beta QA/readiness
tests, 403 focused behavior/readiness tests, PixelLab verification at 149 files,
and `git diff --check` with expected Windows line-ending warnings only.

Current evidence, 2026-06-25: The beta doctor now enforces exact pnpm CLI
alignment. `scripts/mobile-beta-doctor.mjs` derives `expectedPackageManager`
from `expectedPnpmVersion` and blocks any available pnpm command whose
`pnpm --version` output is not `10.24.0`. Static readiness protects the exact
version comparison. The default doctor run still blocks this shell on missing
pnpm and missing mobile Expo dependency resolution; a bundled pnpm 11.x library
does not count as export-ready.

Current evidence, 2026-06-26: The beta doctor now has a machine-readable mode
for helper environments. `pnpm run doctor:mobile-beta:json` calls
`scripts/mobile-beta-doctor.mjs --json` and emits a parseable payload with the
doctor result, all pass/warn/blocked checks, issues, warnings, and next actions.
Static mobile readiness executes that command, parses the JSON, and protects the
current truthful `BLOCKED` result along with the Node 24 and EAS pass checks.
The JSON gate is ready for Replit/native helpers, but it still correctly blocks
this shell until pnpm 10.24.0 and the mobile Expo dependency layer are present.

Current evidence, 2026-06-26: Weekly Care Trends, Records, and Care Pass now
keep open meal outcomes visible instead of treating served-only meals as
resolved care. `deriveCareTrends` separates pending outcomes from complete,
partial, and skipped meal counts; report highlights and Meal Watch signals tell
the household to update served meal outcomes before treating the week as
resolved; Records exposes a `Meal open` metric; and Care Pass trend copy
includes pending outcome counts. Local verification passed focused Care
Trends/Care Pass tests, mobile readiness, the 418-test zero-dependency
behavior/readiness suite, PixelLab asset verification at 149 files, and
`git diff --check` with expected Windows line-ending warnings only. Remote
verify run `28234625027` failed before job execution with zero steps and no
logs, matching the standing GitHub billing/spending-limit blocker rather than a
local code regression.

Current evidence, 2026-06-26: Care Pass report history now carries explicit
local/provider storage truth. New Care Pass artifacts are marked `local-only`
by default, `describeCarePassArtifactStorage` exposes owner-readable local,
upload-ready, uploaded, and failed labels, and Records shows the storage label
plus `Cloud storage pending` detail beside saved report resend and print-source
actions. This keeps internal beta users from mistaking local print-ready HTML
for cloud-backed PDF storage. Local verification passed focused Care Pass tests,
mobile readiness, the 419-test zero-dependency behavior/readiness suite,
PixelLab asset verification at 149 files, and `git diff --check` with expected
Windows line-ending warnings only. Remote verify run `28235628241` failed
before job execution with zero steps and no logs, matching the standing GitHub
billing/spending-limit blocker rather than a local code regression.

Current evidence, 2026-06-26: Care Pass report storage truth is now
provider-aware while still blocking fake provider-backed claims. Local report
artifacts remain `Saved on this device` until Provider Launch Setup marks
storage rules configured. Once `launchProviderProfile.storageProviderConfigured`
is true, the shared care-domain helper and Records Report History show
`Ready to upload`, but `providerBacked` stays false and the detail still says
signed access, retention, export, and deletion rules must be approved before
cloud storage can be treated as real. Local verification passed focused Care
Pass tests, mobile readiness, the 420-test zero-dependency behavior/readiness
suite, PixelLab asset verification at 149 files, and `git diff --check` with
expected Windows line-ending warnings only. Remote verify run `28236929754` for
commit `2636b04` failed before job execution with job `83653949111`,
`steps: []`, and `log not found: 83653949111`, matching the standing GitHub
billing/spending-limit blocker rather than a local code regression.

Current evidence, 2026-06-26: The mobile beta doctor now source-validates the
provider-aware Care Pass report storage chain. Its JSON payload includes
`provider-aware Care Pass storage is source-backed` only when `care-pass.ts`
still exposes the storage-provider option and local false-provider-backed
boundary, and `records.tsx` still feeds `launchProviderProfile` storage setup
into the report-history status helper. This keeps dependency-complete export
helpers from missing a regression in Records/Care Pass provider truth while
native beta proof remains the external gate. Local verification passed mobile
readiness, the 420-test zero-dependency behavior/readiness suite, PixelLab asset
verification at 149 files, and `git diff --check` with expected Windows
line-ending warnings only. Remote verify run `28237677413` for commit `64c4968`
failed before job execution with job `83656402075`, `steps: []`, and
`log not found: 83656402075`, matching the standing GitHub
billing/spending-limit blocker rather than a local code regression.

Current evidence, 2026-06-26: The Owner Preview Core Loop native QA surface now
requires a real tester note for Care Pass Report History storage truth. The
route loop asks testers to confirm Records/Care Pass shows `Saved on this
device` or `Ready to upload` without implying provider-backed upload, includes
that as pass criteria, and keeps the proof as a QA note so it does not add a
third screenshot requirement to the owner loop. Local verification passed
release QA tests, native capture-plan tests, the 420-test zero-dependency
behavior/readiness suite, PixelLab asset verification at 149 files, and
`git diff --check` with expected Windows line-ending warnings only. Remote
verify run `28238656796` for commit `35b4735` failed before job execution with
job `83659654553`, `steps: []`, and `log not found: 83659654553`, matching the
standing GitHub billing/spending-limit blocker rather than a local code
regression.

Current evidence, 2026-06-26: The mobile beta doctor now source-validates the
Owner Preview Care Pass storage proof chain. Its JSON payload includes
`owner-preview Care Pass storage proof is source-backed` only when
`mobileReleaseQa.ts` still requires the Care Pass Report History storage-status
proof, `mobileLaunchQaEvidence.ts` still carries route-check `Proof:` lines into
the shareable Native QA script, and `/care-twin-qa` still renders the Owner
route-loop proof text. Local verification passed mobile readiness, release
QA/native capture readiness, the 420-test zero-dependency behavior/readiness
suite, PixelLab asset verification at 149 files, and `git diff --check` with
expected Windows line-ending warnings only. Direct JSON doctor output remains
truthfully blocked on missing pnpm and missing mobile Expo dependency
resolution.

Current evidence, 2026-06-26: The mobile beta doctor now source-validates the
Beta Handoff packet's truth-boundary section. Its JSON payload includes
`beta handoff truth boundaries are source-backed` only when the owner-readable
handoff packet still separates local beta evidence from App Store/Play Store
approval, provider-backed auth/database/storage/AI/push/payments, and
non-diagnostic WoofGuide boundaries. Local verification passed mobile
readiness, direct JSON doctor output, the 382-test zero-dependency
behavior/readiness suite, PixelLab asset verification at 149 files, and
`git diff --check` with expected Windows line-ending warnings only. Direct JSON
doctor output remains truthfully blocked on missing pnpm and missing mobile
Expo dependency resolution.
