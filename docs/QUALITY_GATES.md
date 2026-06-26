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

Current evidence, 2026-06-11: Household Access now derives synced account members, local-only caregivers, routine-only owners, invite readiness, permission labels, and next-step guidance from shared care-domain logic, then shows that access plan in More.

Current evidence, 2026-06-11: Care Log Audit Trail now records create, edit, sticky-note, and delete evidence with shared care-domain sanitization. Log details show audit history, handoff text includes audit summaries, and successful deletes create a separate non-health audit note instead of silently disappearing.

Current evidence, 2026-06-22: Server-backed care-entry deletes now retain the same non-health audit shape in the API. A household-scoped delete creates an audit note with the deleted-entry snapshot, audit subject id, caregiver, and audit trail, while mobile Log suppresses duplicate local audit notes for server-backed deletes and keeps local/offline deletion audits intact.

Current evidence, 2026-06-23: API care-state writes now make optimistic concurrency atomic by updating only when the household id and current version still match. If another device updates the shared care document after the initial read, the API refetches the latest household state and returns the same recoverable 409 response shape instead of overwriting newer Dog Profile, routine, record, or report data.

Current evidence, 2026-06-23: API household member profile updates now constrain the member display-name write by both authenticated user id and active household id. This keeps a caregiver's name change for one pack from mutating membership rows in other households before provider-backed role enforcement and multi-household management are complete.

Current evidence, 2026-06-23: API household rename now requires the authenticated user's active-household membership role to be owner or admin. Invited members can still belong to the pack and contribute care, but they cannot rename the shared household before fuller provider-backed role enforcement, invite approval, and caregiver administration exist.

Current evidence, 2026-06-23: API household invite joins now provision the authenticated user directly instead of creating a default personal pack before accepting the invite. The join route ensures the invited household has care state, avoids duplicate membership inserts, and adds new caregivers as ordinary members so a first-time invite accept lands on the real shared pack first.

Current evidence, 2026-06-23: API household invite accepts now persist the joined pack as `users.activeHouseholdId`, and the active-household helper prefers that valid membership for later care-state, care-entry, profile, and rename routes. This prevents a caregiver from seeing the joined pack once and then accidentally syncing care back into an older default household before explicit household switching exists.

Current evidence, 2026-06-23: API active-household switching now requires existing membership before changing `users.activeHouseholdId`. `PATCH /me/active-household` ensures the selected household has care state and returns that household's `/me` context, so later care-state and care-entry routes can be pointed at the intended shared pack without allowing arbitrary household id selection.

Current evidence, 2026-06-24: Mobile More now exposes the active-household switcher for memberships returned by `/me.households`. Caregivers can choose an existing pack, the UI shows selected/disabled and pending/error state, and successful switches refresh both `/me` and care state so later routines and logs sync into the selected household.

Current evidence, 2026-06-24: API household audit review now has an owner/admin-scoped contract. `household_audit_events` stores durable household audit rows, and `GET /household/audit-events` returns newest-first events with bounded `limit`, `action`, and `lifecycleState` filters before final provider-backed audit retention policy exists.

Current evidence, 2026-06-24: Sensitive household actions now produce durable audit rows for owner/admin review. Default household creation, household rename, active-household switching, and invite acceptance insert `household.created`, `household.renamed`, `household.active_changed`, and `household.member_joined` events into `household_audit_events` before final provider-backed account audit policy exists.

Current evidence, 2026-06-25: API household member role updates now require owner/admin membership, stay scoped to existing active-household members, refuse owner demotion, return the refreshed `/me` household context, and write durable `household.member_role_changed` audit events before full provider-backed caregiver administration exists.

Current evidence, 2026-06-25: Mobile More now exposes bounded Care Team role management for existing synced non-owner members. The surface calls the generated member-role update hook, shows accessible admin/member/sitter/trainer/vet viewer chips with selected/disabled state, refreshes `/me`, refetches Pack Audit on success, and keeps owner transfer, member removal, invite approval, and final role policy provider-gated.

Current evidence, 2026-06-26: Mobile Pack Audit now renders role-change audit details with owner-readable role labels and previous-to-new context, so rows and screen-reader labels say transitions such as Sitter to Vet viewer instead of exposing internal role ids before final audit retention/export policy exists.

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

Current evidence, 2026-06-14: Records has been cleared of the older one-off `padCard` and local section-header pattern. Care Trends, Dog ID heading, Alone Time, Grooming Care, Incident Lookback, and Medication Plan now use shared board primitives while preserving share/print actions, medication routine routing, follow-ups, search/filter history, and non-diagnostic care copy.

Current evidence, 2026-06-14: Mobile More now uses shared board sections for Care Team, Household Access, Responsibility Center, Sync Health, Tools & Sharing, and Diet Profile while preserving invite sharing, household rename, routine-board routing, sync refresh, tool links, and diet edit/detail actions.

Current evidence, 2026-06-14: Mobile Plans now uses shared board sections for Reminder Center and Daily Routine while preserving reminder action routing, routine add/edit/delete, one-tap routine completion, owner load chips, household responsibility metrics, and empty routine setup.

Current evidence, 2026-06-14: Mobile Quick Log now uses shared board sections for Today at a Glance, Find Care Logs, empty timeline state, and grouped timeline days while preserving search, filters, sticky notes, edit/detail/delete actions, sync status, and the composer boundary.

Current evidence, 2026-06-14: Mobile WoofGuide now uses shared board sections for the owner-reviewed intro, Quick Questions, and Suggested Actions while preserving generated action routing, owner-review drafts, and bounded health guidance language.

Current evidence, 2026-06-14: Mobile Premium now uses shared board anatomy for Why Upgrade, gated plan cards, and Launch Entitlements while preserving the launch checklist and truthful disabled-payment boundary.

Current evidence, 2026-06-14: Mobile Avatar Studio now uses shared board anatomy for the animated scan canvas, live/generated avatar preview, mood-state set, and photo guidance while preserving library/camera generation, saved avatar state, and revert-to-default behavior.

Current evidence, 2026-06-18: Mobile Avatar Studio now separates template thumbnails from production-scale template base stills. The first Shepherd, Retriever, Husky, and Doodle base PNGs render in the hero preview with subtle breathing motion, while unfinished templates fall back safely to the live Phoenix room or thumbnail registry.

Current evidence, 2026-06-18: Mobile Avatar Studio now surfaces template pack truth per choice, not only in aggregate. Template cards show pack-stage labels, accessory tiles mark `Live art ready` versus `Art pending`, and mood chips mark `Live mood` versus `Still preview`, so owners can see exactly which breeds have real production art before they save a care twin.

Current evidence, 2026-06-18: Avatar Studio pack truth, next-pack priority, and PixelLab asset verification now derive from one shared template-pack manifest, so Retriever, Husky, and Doodle can move into live art without the UI, readiness logic, and verifier drifting out of sync.

Current evidence, 2026-06-19: Every non-shepherd launch template now has a full animated launch pack with file-backed overlays, the full mood still set, and seven registered preview strips. Avatar Studio promotes Retriever, Husky, Bully, Doodle, Terrier, Hound, Dachshund, Spaniel, Toy, Slender, and Mixed Breed to `Animated pack ready`, while Shepherd/Phoenix remains the benchmark live pack.

Current evidence, 2026-06-19: Native safe-area QA now has a shared code baseline before device screenshots exist. The floating tab shell plus Home, Log, Plans, Health, More, Records, Avatar Studio, Setup, Premium, Privacy, and the shared auth shell derive bottom clearance from one helper with focused tests, reducing the risk that the floating nav or home indicator clips core actions on runtime devices.

Current evidence, 2026-06-19: WoofGuide's owner-reviewed assistant composer now derives bottom clearance from shared mobile layout logic instead of local inset math. Focused tests cover flat native, notched native, and web composer clearance while the remaining native simulator/device screenshot pass stays open.

Current evidence, 2026-06-19: Docked care workflow sheets now derive bottom clearance from `getModalSheetBottomPadding` instead of local `insets.bottom + 16/18/20` formulas. Focused tests cover flat and notched native modal clearance, and static readiness protects Plans routine/event sheets, Log detail/edit sheets, Records Care Pass/record sheets, More diet/profile sheets, and the app error recovery sheet before native screenshot QA is available.

Current evidence, 2026-06-20: Floating feedback toasts now derive bottom position from `getFloatingFeedbackBottomOffset` instead of local `insets.bottom + 96/22` formulas. Focused tests cover tabbed Home feedback, standalone Avatar Studio feedback, notched devices, and web fallback before native screenshot QA is available.

Current evidence, 2026-06-20: Centered text-entry modals now derive backdrop top, bottom, and horizontal clearance from `getCenteredModalBackdropPadding` instead of fixed horizontal-only modal padding. Focused tests cover flat and notched devices, and static readiness protects the Log sticky-note prompt plus More household/name prompt modals before native screenshot QA is available.

Current evidence, 2026-06-20: Route header top clearance now derives from `getRouteTopPadding` instead of per-screen `topInset + 8/12/14/48` formulas. Focused tests cover flat native, notched native, and web chrome clearance, and static readiness protects Home, Log, Plans, Health, More, Records, Avatar Studio, Setup, Premium, Privacy, and the shared auth shell before native screenshot QA is available.

Current evidence, 2026-06-20: WoofGuide owner-review draft sheets now derive docked bottom clearance from `getModalSheetBottomPadding` instead of fixed-only sheet padding. Static mobile readiness protects the assistant review surface alongside the composer before native screenshot QA is available.

Current evidence, 2026-06-20: Keyboard-heavy Setup, WoofGuide, Log sticky-note prompt, and Records Care Pass/record sheets now derive keyboard avoidance from `getKeyboardAvoidingVerticalOffset` instead of the React Native default zero offset. Focused tests cover tabbed, setup, standalone, notched-device, and web behavior while native screenshot QA remains blocked.

Current evidence, 2026-06-21: Inline mobile route actions now derive extra tappable area from `MOBILE_INLINE_HIT_SLOP` instead of route-local `hitSlop={8}` or `hitSlop={10}` literals. Focused tests cover the shared value and static readiness protects Home, Plans, More, Records, Privacy, and WoofGuide before native accessibility traversal is available.

Current evidence, 2026-06-21: Route-local mobile action controls now derive compact control size from `MIN_MOBILE_TOUCH_TARGET` instead of local 40-42px boxes. Focused readiness protects Plans add/discover controls, Log sync/detail controls, Premium hero mark, and Setup finish-later action before native accessibility traversal is available.

Current evidence, 2026-06-21: Avatar Studio compact owner-input controls now derive their tap area from `MIN_MOBILE_TOUCH_TARGET` instead of local 40/42/36px sizing. Focused readiness protects Studio tabs, coat swatches, and face-marking option pills before native accessibility traversal is available.

Current evidence, 2026-06-21: Health/Bile Watch route controls now derive their tap area from `MIN_MOBILE_TOUCH_TARGET` instead of local 36/42px sizing. Focused readiness protects the segmented Health/Bile tabs plus Log health note and Records hero actions before native accessibility traversal is available.

Current evidence, 2026-06-21: Plans schedule and routine controls now derive their tap area from `MIN_MOBILE_TOUCH_TARGET` instead of local 21/30/32/36px sizing. Focused readiness protects the schedule tabs, schedule mark-done status control, Daily Routine add button, and routine done button before native accessibility traversal is available.

Current evidence, 2026-06-21: Log, Records, and More compact owner-action controls now derive their tap area from `MIN_MOBILE_TOUCH_TARGET` instead of route-local sub-48px sizing. Focused readiness protects Quick Log type chips, timeline filters, search clear, Records medication search/filter controls, report artifact actions, report period tabs, More invite, and dog-profile unit pills before native accessibility traversal is available.

Current evidence, 2026-06-21: Calendar event discovery and upcoming-event controls now derive their tap area from `MIN_MOBILE_TOUCH_TARGET` instead of route-local 28/38/40px sizing. Focused readiness protects the discover icon, suggested-event icon, upcoming-event icon, and remove-event control before native accessibility traversal is available.

Current evidence, 2026-06-21: Error recovery debug and close controls now derive their tap area from `MIN_MOBILE_TOUCH_TARGET` instead of route-local 44px sizing. Focused readiness protects the development error-details button and error-details modal close control before native accessibility traversal is available.

Current evidence, 2026-06-21: Home header navigation controls now derive their tap area from `MIN_MOBILE_TOUCH_TARGET` instead of route-local 42px sizing. Focused readiness protects the More menu and Health Watch notification buttons on the first screen before native accessibility traversal is available.

Current evidence, 2026-06-22: Plans routine/event modal controls now derive their tap area from `MIN_MOBILE_TOUCH_TARGET` instead of padding-only local sizing. Focused readiness protects routine type chips, owner quick chips, save buttons, delete routine, and add-event save controls before native accessibility traversal is available.

Current evidence, 2026-06-22: Auth onboarding action controls now derive their tap area from `MIN_MOBILE_TOUCH_TARGET` instead of relying only on visual padding. Focused readiness protects the shared primary auth button and Google SSO button before native accessibility traversal is available.

Current evidence, 2026-06-22: The living Phoenix room now shares the mobile tap contract. The animated care-twin room pressable uses `MOBILE_INLINE_HIT_SLOP`, and the visible status/next-action cue chips use `MIN_MOBILE_TOUCH_TARGET` before native accessibility traversal is available.

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

Current evidence, 2026-06-11: Reminder Center strengthens the Plus/Family reminders wedge by making existing routine, medication, record, and grooming follow-up candidates visible in Calendar without enabling checkout, push notifications, or automatic care writes.

Current evidence, 2026-06-11: Full Log search strengthens the paid history/trust wedge by making rich care evidence findable across notes, caregivers, routes, medication details, and sticky notes before server search indexes or long-history retention policy exist.

Current evidence, 2026-06-11: Medication History search/filter strengthens the paid health-history wedge by making dose and adherence evidence findable inside Records before provider-backed medication reports or server search exist.

## Gate 8: Production Safety

Passing means CI is green, API auth is household-scoped, secrets are absent, privacy/export/delete are planned, sync failures are visible, and release docs are accurate.

Current evidence, 2026-06-08: The owner-reviewed WoofGuide action model is covered by focused tests and release docs now point the next automation slice to privacy/account safety rather than additional assistant writes.

Current evidence, 2026-06-08: Mobile now has a Privacy & Safety surface for owner care-data export, non-destructive account deletion request preparation, WoofGuide AI disclosure, document storage gates, and payment launch blockers. The model is covered by focused tests and keeps live deletion/storage disabled until provider rules are approved.

Current evidence, 2026-06-14: Mobile Privacy & Safety now uses shared board anatomy for Export Summary, Launch Safety Gates, and Before Public Launch blockers while preserving owner data export, deletion-request sharing, AI/document/payment gating, and provider-backed truth boundaries.

Current evidence, 2026-06-08: Focused tests now include static mobile readiness smoke for critical route registration, tab coverage, string router links, and safety copy on premium/privacy/WoofGuide surfaces. Expo runtime, visual, and accessibility QA remain open.

Current evidence, 2026-06-08: `build:ci` now runs `@workspace/woofwatcher-mobile`'s Expo web export smoke and verifies the export emits HTML and JavaScript assets. Native simulator/device rendering, screenshots, and accessibility QA remain open.

Current evidence, 2026-06-08: Focused tests now verify screen-reader labels on critical Privacy, Premium, WoofGuide, and More actions, including owner data export, deletion request preparation, WoofGuide review/send actions, Plus entry, and sign out. Full native accessibility traversal and visual QA remain open.

Current evidence, 2026-06-08: Expo app identity no longer uses Replit placeholders. Static readiness checks protect the WoofWatcher slug/scheme plus Pegasus Dreamscapes iOS bundle id and Android package id. Store submission still requires Expo/EAS/App Store accounts and approval.

Current evidence, 2026-06-13: Expo/EAS build and submit profiles now exist for iOS and Android, and static mobile readiness checks protect the EAS profile shape plus the mobile release runbook. Store submission still requires Apollo's Expo, Apple Developer, Google Play, privacy/legal, and launch approval.

Current evidence, 2026-06-08: Focused tests now cover the Home avatar motion state model and static wiring check. Native animation runtime verification, Rive/Lottie/Reanimated asset QA, and screenshot review remain open.

Current evidence, 2026-06-13: Focused tests now cover durable sync outbox derivation, household Sync Health derivation, Household Responsibility derivation/mobile wiring, Household Access derivation/mobile wiring, Care Log Audit Trail derivation/mobile wiring, Full Log search derivation/mobile wiring, Medication History search/filter derivation/mobile wiring, conflict-safe care document refresh reconciliation, Saved Routes derivation/report/mobile wiring, Weekly Care Trends derivation/report/mobile wiring, Training Progress derivation/report/mobile wiring, Alone Time derivation/report/mobile wiring, Weight Trend derivation/report/mobile wiring, Grooming Care derivation/mobile wiring, Reminder Center derivation/mobile wiring/action routing, static mobile wiring, EAS profile readiness, and mobile release runbook coverage. Local focused tests pass at 195 tests. Local `pnpm run build:ci` remains blocked only because `pnpm` is unavailable in this Windows shell.

Current evidence, 2026-06-14: `WoofWatcher Verify` uses Node 24-compatible action majors for checkout, setup-node, and pnpm setup, and keeps the project test/build runtime pinned to Node 24.

Current evidence, 2026-06-22: Focused API readiness now protects care-entry delete retention in addition to household scoping, optimistic care-state conflicts, append-safe care-entry writes, and list query contracts. Synced deletes retain a server-side household audit note instead of relying only on a local mobile audit artifact.

Current evidence, 2026-06-23: Focused API readiness now also protects the care-state update predicate itself, requiring household-and-version matching plus a refreshed 409 path when concurrent writes race before live database/provider-auth integration tests are available.

Current evidence, 2026-06-24: Focused API readiness protects household invite joins from creating a throwaway default household before accepting an invite. `POST /household/join` now provisions the user directly, ensures invited-household care state, and keeps new invitees at the `member` role unless provider-backed administration later changes the policy. Focused readiness also protects membership-scoped active-household switching, the OpenAPI/zod/generated React client contract for `PATCH /me/active-household`, and the `/me.households` list used by the mobile switcher.

Current evidence, 2026-06-24: Focused API readiness protects owner/admin household audit review, including the durable audit-row schema, sensitive household action producers, route-level role gate, safe list-query normalization, newest-first ordering, and OpenAPI/zod/generated React client contract for `GET /household/audit-events`.

Current evidence, 2026-06-25: Mobile More now surfaces household audit review for owner/admin trust inspection. The Pack Audit board reads the generated household audit-events hook, lists recent pack creation, rename, active-household switching, invite-join, and role-change events, supports event-type and lifecycle filters through the existing `action` and `lifecycleState` query contract, summarizes stored audit details in owner-readable rows and screen-reader labels, and shows truthful loading/empty/offline states without exposing lifecycle actions before provider-backed retention policy exists.

Current evidence, 2026-06-25: Household Access now maps the launch caregiver role set to truthful owner-readable labels and permission summaries. Owner, admin, sitter, trainer, and vet viewer roles no longer collapse into generic owner/caregiver copy or leak internal role ids, and Mobile More shows the scoped permission summary under each Care Team person before provider-backed role enforcement exists.

Current evidence, 2026-06-26: Pack Audit role-change details now reuse the launch role labels in mobile review rows and accessibility labels, preserving owner-readable household trust evidence after role updates without adding lifecycle actions or provider-backed audit export/delete controls.

Current evidence, 2026-06-25: API shared care writes now honor the launch role boundary for vet viewers before final provider-backed permission policy. Vet viewers can review household care context but cannot change care plans or logs.

Current evidence, 2026-06-26: API care-plan writes now use a stricter role boundary than care-log writes before final provider-backed permission policy. `PUT /care-state` is limited to owner/admin/member roles so sitters and trainers cannot change the shared Dog Profile, routines, records, or reports document, while `POST/PATCH/DELETE /care-entries` still allows owner/admin/member/sitter/trainer roles to log and correct care evidence.

Current evidence, 2026-06-26: API sitter and trainer care-log corrections are now scoped to their own entries before final provider-backed permission policy. `PATCH /care-entries/:id` and `DELETE /care-entries/:id` add `caregiverUserId` matching for sitter/trainer roles, while owner/admin/member roles retain household-wide correction authority and vet viewers remain read-only.
