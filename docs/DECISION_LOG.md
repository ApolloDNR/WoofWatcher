# WoofWatcher Decision Log

## Decision Format

Each decision should include:

- Date
- Decision
- Reason
- Owner
- Revisit trigger

## Decisions

### 2026-06-23: Invite Codes Are Owner/Admin Visible

Decision: API `/me` should return the shared household invite code only when the authenticated member's active-household role is `owner` or `admin`. Ordinary members still receive household context and member lists, but their household invite code is blank so mobile Household Access treats invite sharing as unavailable.

Reason: Joining a pack and contributing care is different from spreading access to the pack. Until provider-backed caregiver administration, invite approval, role changes, and account audit policy exist, invite-code visibility should follow the same owner/admin trust boundary as household rename.

Owner: Codex.

Revisit trigger: Provider-backed invite approval, caregiver editing, active household switching, role changes, or a formal share-invite endpoint becomes active release work.

### 2026-06-23: Invite Join Does Not Create A Default Pack First

Decision: API `POST /household/join` should provision the authenticated user directly, find the invited household by normalized invite code, ensure that household has care state, avoid duplicate membership inserts, and add a new invitee as a normal `member` without first creating a personal default household.

Reason: A first-time caregiver who accepts an invite intends to join the shared pack, not create a separate empty household that can become the earliest active household for later care-state and care-entry routes. This keeps household sync truth closer to the invite workflow while full active-household switching, invite approval, and provider-backed role administration remain future work.

Owner: Codex.

Revisit trigger: Active-household selection, invite approval, caregiver editing, role changes, or provider-backed household administration becomes active release work.

### 2026-06-23: Household Rename Requires Owner Or Admin Membership

Decision: API `PATCH /household` should allow shared pack renames only when the authenticated user's active-household membership role is `owner` or `admin`. Non-owner/admin members receive a 403 response and can continue using the household for normal care workflows.

Reason: The household name is shared pack identity, not a personal profile field. Invited caregivers should be able to contribute logs and care context without being able to rename the household before provider-backed role enforcement, invite approval, caregiver editing, and account audit policy are complete.

Owner: Codex.

Revisit trigger: Provider-backed role enforcement, household admin tools, caregiver editing, role changes, invite approval, or broader account/household audit policy becomes active release work.

### 2026-06-23: Member Profile Updates Stay In The Active Household

Decision: API `PATCH /me` should update the authenticated user's global display name, but the household membership display-name row must be constrained by both user id and active household id.

Reason: A caregiver can belong to more than one household. Updating membership rows by user id alone can rename that caregiver across unrelated packs, which weakens household trust before provider-backed role enforcement, active household switching, and richer caregiver management are complete.

Owner: Codex.

Revisit trigger: Provider-backed role enforcement, explicit active-household selection, caregiver editing, invite approval, or account audit policy becomes active release work.

### 2026-06-23: Care-State Optimistic Writes Are Atomic

Decision: API `PUT /care-state` writes should update the shared household care document only when both the household id and the current version still match. If another device updates the document after the initial read, the API should refetch the latest household state and return the existing recoverable 409 response shape instead of overwriting it.

Reason: Dog Profile, routines, records, reports, and setup data live in the shared care document. A pre-check alone can still lose a race between two household devices, so the version predicate belongs in the update itself before live database integration tests and deeper multi-device conflict policy are available.

Owner: Codex.

Revisit trigger: Live API integration tests are available, care-state rows gain a stronger compare-and-swap helper, or deeper multi-device merge/restore policy becomes active release work.

### 2026-06-22: Server Deletes Retain Household Audit Notes

Decision: Care-entry deletes through the API should create a retained non-health household audit note after a household-scoped delete succeeds. The audit note stores the deleted entry snapshot, audit subject id, caregiver, and audit trail using the shared care-domain deletion audit shape. Mobile Log should avoid adding a duplicate local deletion audit when the server already retained one, while local/offline deletes still create the local audit note.

Reason: Deleted care logs should stop satisfying routines and health summaries, but the household still needs an evidence trail of what changed. Keeping the server-backed delete audit in the API reduces trust and retention risk before the final live database retention/restore policy is approved, without pretending provider-backed deletion policy or live integration tests are complete.

Owner: Codex.

Revisit trigger: A live test database/provider-auth harness is available, final delete/restore retention policy is approved, or role-aware audit events for records/documents/accounts become active release work.

### 2026-06-22: API Route Contract Readiness Runs In Focused Tests

Decision: The focused test suite should include CI-safe API route contract readiness while live Express/Drizzle integration tests remain blocked by local dependency, database, and provider-auth setup. The first API readiness slice protects authenticated household scoping, care-state optimistic conflict responses, household-isolated care-entry create/update/delete behavior, and the `/care-entries?limit=` query contract across OpenAPI, zod, and generated React client types.

Reason: Backend route regressions can break household trust and sync safety even before production providers are approved. The current Codex checkout has no `node_modules` or `DATABASE_URL`, so static contract readiness is the strongest local coverage that can run in the same zero-dependency gate as the mobile/domain tests without pretending live provider integration has been verified.

Owner: Codex.

Revisit trigger: A local or CI test database/auth harness is available, API dependencies are installed in the checkout, or provider-backed auth/roles/storage become active release work.

### 2026-06-22: Avatar Studio Owner Inputs Use The Shared Touch Target

Decision: Avatar Studio scan actions, template tiles, accessory tiles, and mood preview chips should use the shared `MIN_MOBILE_TOUCH_TARGET` floor before native accessibility traversal, while preserving larger visual tile heights where the character-creator layout already needs them. Face-marking options should also expose explicit screen-reader labels.

Reason: Avatar Studio is a high-touch care-twin creation workflow where owners repeatedly scan, choose templates, customize markings, select accessories, and preview moods. Native accessibility traversal is still blocked, so the in-code contract should keep those owner-input controls aligned with the rest of the mobile release-safe target baseline without changing the truthful PixelLab/template readiness model.

Owner: Codex.

Revisit trigger: Native screen-reader or device QA shows Avatar Studio needs different sizing, final Figma/native character-creator components replace the current controls, or platform-specific guidance requires separate iOS/Android values.

### 2026-06-22: Onboarding And Avatar Creation Actions Expose Screen-Reader State

Decision: Release-critical onboarding and Avatar Studio creation actions should expose explicit screen-reader roles, labels, and state before native accessibility traversal. This covers shared auth primary/Google buttons, Setup starter-routine type selection, Setup save/finish-later actions, and Avatar Studio reset/save controls.

Reason: Account setup, care foundation setup, and care-twin creation are first-run release paths. Native screen-reader traversal is still blocked, so static readiness should prevent these controls from regressing to text-only tappables or unlabeled icon/text combinations while preserving the existing auth, setup, and avatar behavior.

Owner: Codex.

Revisit trigger: Native screen-reader traversal shows different labeling/state requirements, final Figma/native components replace these controls, or provider-backed onboarding changes the first-run flow.

### 2026-06-22: Remaining Route Actions Use The Shared 48px Touch Target

Decision: Remaining high-frequency route actions should use `MIN_MOBILE_TOUCH_TARGET` from the shared mobile layout helper before native accessibility traversal. This covers Quick Log launcher tabs and outbox retry, Records empty-add and delete controls, More Care Intelligence, tool, premium, and profile-edit actions, and Privacy export/delete actions.

Reason: Native screen-reader and device QA are still blocked, and these actions sit in core care logging, sync recovery, records, household tools, monetization preview, profile editing, and privacy/export workflows. Reusing the shared 48px contract reduces missed-tap risk without changing care data behavior, provider truth, or claiming native QA has run.

Owner: Codex.

Revisit trigger: Native accessibility traversal shows a route needs a different target, final Figma/native components replace these route-local controls, or platform-specific guidance requires separate iOS/Android values.

### 2026-06-22: Living Phoenix Room Uses Shared Tap Contracts

Decision: The living Phoenix room should use the shared mobile tap contracts before native accessibility traversal. The full-room pressable uses `MOBILE_INLINE_HIT_SLOP`, and the visible status and next-action cue chips use `MIN_MOBILE_TOUCH_TARGET`.

Reason: The animated care-twin room is the premium first-screen care surface for Home and Avatar Studio. Simulator/device QA is still blocked, so keeping its tap target and visible action cues on the same shared mobile contract reduces missed-tap and drift risk without changing care-state behavior, avatar motion, or claiming native QA has run.

Owner: Codex.

Revisit trigger: Native screen-reader or device QA shows the room needs different touch behavior, the final Figma/native care-twin component changes the room interaction model, or platform-specific accessibility guidance requires separate iOS/Android values.

### 2026-06-22: Auth Actions Use The Shared 48px Touch Target

Decision: The shared mobile auth primary button and Google SSO button should use `MIN_MOBILE_TOUCH_TARGET` from the shared mobile layout helper instead of relying only on padding-driven height.

Reason: Native accessibility traversal is still waiting on simulator/device access, and sign-in/sign-up are release-critical onboarding actions. Reusing the 48px contract reduces missed-tap risk without changing auth behavior, provider truth, or claiming native QA has run.

Owner: Codex.

Revisit trigger: Native screen-reader or device QA shows auth controls need different sizing, final Figma/native auth components replace the current shared auth UI, or platform-specific accessibility guidance requires separate iOS/Android values.

### 2026-06-22: Plans Modal Controls Use The Shared 48px Touch Target

Decision: Plans routine and event modal controls should use `MIN_MOBILE_TOUCH_TARGET` from the shared mobile layout helper instead of relying on padding-only local sizing.

Reason: Native accessibility traversal is still waiting on simulator/device access, and Plans modals are where owners create and edit the routines that define what should happen. Reusing the 48px contract reduces missed-tap risk for type chips, owner quick chips, save actions, and delete routine without changing routine/log behavior or claiming native QA has run.

Owner: Codex.

Revisit trigger: Native screen-reader or device QA shows Plans modal controls need different sizing, final Figma/native planning components replace the current modal controls, or platform-specific accessibility guidance requires separate iOS/Android values.

### 2026-06-21: Home Header Navigation Uses The Shared 48px Touch Target

Decision: The Home header More menu and Health Watch notification controls should use `MIN_MOBILE_TOUCH_TARGET` from the shared mobile layout helper instead of route-local 42px sizing.

Reason: Native accessibility traversal is still waiting on simulator/device access, and Home is the first-screen command surface owners use to reach More, household tools, and Health Watch. Reusing the 48px contract reduces tap-risk without changing the existing header navigation or claiming native QA has run.

Owner: Codex.

Revisit trigger: Native screen-reader or device QA shows the Home header needs different sizing, final Figma/native header components replace the current controls, or platform-specific accessibility guidance requires separate iOS/Android values.

### 2026-06-21: Error Recovery Controls Use The Shared 48px Touch Target

Decision: The development error-details button and error-details modal close control should use `MIN_MOBILE_TOUCH_TARGET` from the shared mobile layout helper instead of route-local 44px sizing.

Reason: Native accessibility traversal is still waiting on simulator/device access, and the app-wide recovery surface must remain usable when an owner or tester needs to inspect or close error details. Reusing the 48px contract reduces tap-risk without changing the error recovery workflow or claiming native QA has run.

Owner: Codex.

Revisit trigger: Native screen-reader or device QA shows recovery controls need different sizing, the app gains a global recovery overlay component, or platform-specific accessibility guidance requires separate iOS/Android values.

### 2026-06-21: Calendar Event Controls Use The Shared 48px Touch Target

Decision: Calendar event discovery and upcoming-event controls should use `MIN_MOBILE_TOUCH_TARGET` from the shared mobile layout helper instead of route-local 28/38/40px sizing.

Reason: Native accessibility traversal is still waiting on simulator/device access, and these controls sit in the Plans event-management workflow where owners discover outings, review suggestions, and remove one-off events. Reusing the 48px contract reduces tap-risk without changing calendar data behavior or claiming native QA has run.

Owner: Codex.

Revisit trigger: Native screen-reader or device QA shows Calendar event controls need different sizing, final Figma/native event components replace the current controls, or platform-specific accessibility guidance requires separate iOS/Android values.

### 2026-06-21: Compact Search Report And Household Controls Use The Shared 48px Touch Target

Decision: Quick Log type chips, timeline filters, search clear, Records medication search/filter controls, report artifact actions, report period tabs, More invite, and dog-profile unit pills should use `MIN_MOBILE_TOUCH_TARGET` from the shared mobile layout helper instead of route-local sub-48px sizing.

Reason: Native accessibility traversal is still waiting on simulator/device access, and these controls sit in high-frequency care review workflows: filtering logs, searching medication evidence, resending/printing reports, switching report periods, inviting household caregivers, and editing profile units. Reusing the 48px contract reduces tap-risk without changing care data behavior or claiming native QA has run.

Owner: Codex.

Revisit trigger: Native screen-reader or device QA shows these controls need different sizing, final Figma/native components replace the current route-local controls, or platform-specific accessibility guidance requires separate iOS/Android values.

### 2026-06-21: Plans Schedule And Routine Controls Use The Shared 48px Touch Target

Decision: Plans schedule tabs, the schedule mark-done status control, the Daily Routine add button, and routine done buttons should use `MIN_MOBILE_TOUCH_TARGET` from the shared mobile layout helper instead of route-local 21/30/32/36px sizing.

Reason: Native accessibility traversal is still waiting on simulator/device access, and Plans is the core household routine surface where owners switch schedule views, add routines, and mark care as handled. Keeping these high-frequency controls on the same 48px contract reduces tap-risk without changing routine/log behavior or claiming native QA has run.

Owner: Codex.

Revisit trigger: Native screen-reader or device QA shows Plans needs different sizing, final Figma/native routine components replace the current controls, or platform-specific accessibility guidance requires separate iOS/Android values.

### 2026-06-21: Health/Bile Route Controls Use The Shared 48px Touch Target

Decision: The Health/Bile segmented tabs plus Log health note and Records hero actions should use `MIN_MOBILE_TOUCH_TARGET` from the shared mobile layout helper instead of route-local 36/42px sizing.

Reason: Native accessibility traversal is still waiting on simulator/device access, and Health/Bile Watch is a core non-diagnostic care workflow where owners switch between health context, bile review, logging, and records. Keeping these controls on the same 48px contract reduces tap-risk without changing the medical boundary or claiming native QA has run.

Owner: Codex.

Revisit trigger: Native screen-reader or device QA shows Health/Bile needs different sizing, a final Figma/native health component replaces the current segmented control and hero actions, or platform-specific accessibility guidance requires separate iOS/Android values.

### 2026-06-21: Avatar Studio Compact Controls Use The Shared 48px Touch Target

Decision: Avatar Studio tabs, coat swatches, and face-marking option pills should use `MIN_MOBILE_TOUCH_TARGET` from the shared mobile layout helper instead of route-local 40/42/36px sizing.

Reason: Native accessibility traversal is still waiting on simulator/device access, and Avatar Studio is a high-touch production-art workflow where owners repeatedly select templates, colors, traits, accessories, and moods. Keeping compact owner-input controls on the same 48px contract reduces tap-risk without changing the truthful PixelLab/template readiness model.

Owner: Codex.

Revisit trigger: Native screen-reader or device QA shows Avatar Studio needs different sizing, a final Figma/native character-creator component replaces the current controls, or platform-specific accessibility guidance requires separate iOS/Android values.

### 2026-06-21: Route-Local Actions Use The Shared 48px Touch Target

Decision: Plans add/discover controls, Log sync/detail controls, the Premium hero mark, and Setup finish-later action should use `MIN_MOBILE_TOUCH_TARGET` from the shared mobile layout helper instead of local 40-42px boxes.

Reason: Native accessibility traversal is still waiting on simulator/device access, and these route-local controls sit outside the shared board primitive layer. Reusing the existing 48px contract keeps compact route actions aligned with the mobile tap-target baseline without adding a new visual system.

Owner: Codex.

Revisit trigger: Native screen-reader or device QA shows a route needs different sizing, final Figma/native components replace these route-local controls, or platform-specific accessibility guidance requires separate iOS/Android values.

### 2026-06-21: Inline Route Actions Use Shared Mobile Hit Slop

Decision: Home, Plans, More, Records, Privacy, and WoofGuide inline icon/text actions should use `MOBILE_INLINE_HIT_SLOP` from the shared mobile layout helper instead of route-local `hitSlop={8}` or `hitSlop={10}` literals.

Reason: Native accessibility traversal is still waiting on simulator/device access, and inline controls are the remaining compact actions around headers, report sharing, record deletion, household/profile actions, and owner-review close controls. A named hit-slop contract keeps those tap targets consistent without changing the visual board layout.

Owner: Codex.

Revisit trigger: Native screen-reader or device QA shows different hit slop is needed, final Figma/native components replace the inline controls, or platform-specific guidance requires separate iOS/Android values.

### 2026-06-20: Keyboard Avoidance Uses The Shared Safe-Area Contract

Decision: Setup, WoofGuide, the Log sticky-note prompt, and Records Care Pass/record sheets should use `getKeyboardAvoidingVerticalOffset` from the shared mobile layout helper instead of relying on React Native's default zero keyboard offset.

Reason: Native runtime QA is still waiting on simulator/device screenshots, and these surfaces are the remaining high-risk keyboard flows where text inputs can appear under route chrome, notches, or docked controls. A named helper keeps keyboard movement aligned with the same tabbed, setup, and standalone top-safe-area contracts already used by the route headers.

Owner: Codex.

Revisit trigger: Native device QA shows a screen needs a different keyboard offset, the app shell changes its header/chrome model, or a final native form/sheet component replaces the current route-local `KeyboardAvoidingView` usage.

### 2026-06-20: WoofGuide Owner Review Uses The Shared Modal Safe-Area Contract

Decision: WoofGuide's owner-reviewed draft sheet should use `getModalSheetBottomPadding` from the shared mobile layout helper instead of fixed-only sheet padding.

Reason: WoofGuide draft review is an AI safety boundary where owners approve meal logs, reminders, vet-note drafts, and Care Pass actions before anything changes. Keeping that docked sheet on the same modal clearance contract as Plans, Log, Records, More, and error recovery reduces native home-indicator clipping risk before simulator/device screenshots are available.

Owner: Codex.

Revisit trigger: Native device QA shows WoofGuide review sheets need different clearance, a shared design-system sheet component replaces route-local sheets, or WoofGuide review moves to a full-screen workflow.

### 2026-06-20: Error Recovery Debug Controls Use The Shared Safe-Area Top Contract

Decision: The app error fallback's development-only error-details button should use `getFloatingDebugButtonTopOffset` from the shared mobile layout helper instead of route-local `insets.top + 16` positioning.

Reason: Native runtime QA is still blocked on simulator/device access, and the error recovery surface is one of the last app-wide overlays with direct notch math. A named helper keeps recovery controls below notches and web preview chrome without changing the recovery workflow or the already-shared error-details sheet bottom padding.

Owner: Codex.

Revisit trigger: Native device QA shows floating recovery/debug controls need different clearance, the app shell gains a global overlay container, or the final design system replaces the current error fallback.

### 2026-06-20: Route Headers Use The Shared Safe-Area Top Contract

Decision: Home, Log, Plans, Health, More, Records, Avatar Studio, Setup, Premium, Privacy, and the shared auth shell should use `getRouteTopPadding` from the shared mobile layout helper instead of route-local `topInset + 8/12/14/48` formulas.

Reason: The native runtime-QA baseline already covered bottom scroll clearance, composers, sheets, toasts, and centered modals, but route headers still owned their own top safe-area offsets. A named top-padding helper gives simulator/device QA one contract to inspect for notches, web preview chrome, and auth/onboarding spacing without changing the care workflows.

Owner: Codex.

Revisit trigger: Native device QA shows route headers need different per-surface top clearance, the app shell changes, or a final design-system route container replaces the current screen-level scroll containers.

### 2026-06-20: Centered Text Modals Use The Shared Safe-Area Contract

Decision: The Log post-care sticky-note prompt and More household/name prompt modals should use `getCenteredModalBackdropPadding` from the shared mobile layout helper instead of fixed horizontal-only centered modal padding.

Reason: Native runtime QA is still waiting on simulator/device access, but centered keyboard modals can appear on small or notched devices before a real screenshot pass is available. A named helper gives these prompts top, bottom, and horizontal clearance from one contract without changing their care workflow behavior.

Owner: Codex.

Revisit trigger: Native device QA shows centered text prompts need different edge clearance, the prompt pattern moves to docked sheets, or a final design-system modal replaces these route-local prompt components.

### 2026-06-20: Floating Feedback Uses The Shared Safe-Area Contract

Decision: Home quick-log feedback and Avatar Studio save feedback should use `getFloatingFeedbackBottomOffset` from the shared mobile layout helper instead of route-local `insets.bottom + 96/22` toast positioning.

Reason: The native runtime-QA baseline already covered scroll clearance, standalone composers, and docked sheets, but transient feedback could still sit too close to the floating tab shell or home indicator. A named helper gives the simulator/device screenshot pass one feedback-position contract to inspect without claiming device QA has run.

Owner: Codex.

Revisit trigger: Native device QA shows feedback needs a different clearance value, the floating tab shell changes, or a final toast/snackbar component replaces the current route-local feedback views.

### 2026-06-19: Docked Mobile Sheets Use The Shared Safe-Area Contract

Decision: Plans routine/event sheets, Log detail/edit sheets, Records Care Pass/record sheets, More diet/profile sheets, and the app error recovery sheet should use `getModalSheetBottomPadding` from the shared mobile layout helper instead of local `insets.bottom + 16/18/20` padding.

Reason: The broader native runtime-QA baseline already covered the floating tab shell, tabbed scroll routes, standalone routes, and WoofGuide composer, but docked sheets still had route-local bottom-clearance math. Centralizing sheet padding gives the simulator/device screenshot pass one modal contract to inspect and reduces the risk that critical edit, report, profile, or recovery controls sit too close to the home indicator.

Owner: Codex.

Revisit trigger: Native device QA shows docked sheets need a different clearance value, the modal presentation pattern changes, or a final native design system introduces a richer sheet component.

### 2026-06-19: WoofGuide Composer Clearance Belongs In Shared Mobile Layout

Decision: WoofGuide's bottom composer should use `getStandaloneComposerBottomPadding` from the shared mobile layout helper instead of route-local `bottomInset + 12` math.

Reason: WoofGuide is a standalone owner-reviewed assistant surface with a persistent input control. The broader safe-area baseline already covered tabbed scroll routes and standalone scroll content, but the assistant composer still had its own inset calculation that could leave flat native devices with too little clearance. A named helper gives native runtime QA one contract to inspect for standalone composer controls without claiming simulator screenshots have run.

Owner: Codex.

Revisit trigger: Native device QA shows the WoofGuide composer needs a different clearance than the shared standalone composer contract, or another standalone composer surface is added and needs a richer helper.

### 2026-06-19: Standalone Mobile Routes Should Share The Same Bottom Clearance Contract

Decision: Setup, Premium, Privacy, and the shared auth shell should use `getStandaloneRouteBottomPadding` instead of per-screen `insets.bottom + 32/40/44` padding.

Reason: The tabbed safe-area helper fixed the primary shell, but the detached secondary routes still had route-specific bottom spacing that could leave primary form or CTA content too close to the home indicator on native devices. Moving every standalone scroll surface onto one helper gives the upcoming simulator/device QA pass a single clearance contract to validate.

Owner: Codex.

Revisit trigger: Device QA shows a specific standalone route needs stronger per-screen spacing, or the final native design system introduces a different standalone route footer pattern.

### 2026-06-19: Safe-Area Clearance Should Come From One Mobile Layout Contract

Decision: The floating bottom-tab shell, the main tabbed routes, and Avatar Studio should all derive bottom clearance from shared mobile layout helpers instead of route-by-route magic numbers such as `128`, `130`, `142`, or `72`.

Reason: The current queue is blocked on real simulator/device QA, but code inspection already showed inconsistent bottom spacing across Home, Log, Plans, Health, More, Records, and Avatar Studio. Centralizing the spacing contract reduces the chance of the floating shell or home indicator covering primary actions on notched devices and gives the upcoming runtime screenshot pass a stable baseline to validate.

Owner: Codex.

Revisit trigger: The navigation shell changes height or shape, a final native design system replaces the current floating tab chrome, or device QA shows a specific route needs stronger per-screen clearance than the shared contract provides.

### 2026-06-19: Launch Template Packs Should All Share One Animated Preview Contract

Decision: Bully, Terrier, Hound, Dachshund, Spaniel, Toy, Slender, and Mixed Breed should now promote from base-only to the same full overlay, mood-still, and generated preview-strip contract already used by Retriever, Husky, and Doodle, instead of leaving most launch breeds in a long-lived still-only state.

Reason: The repo already had a safe local generation seam built around registered `base.png` art, file-backed overlays, mood stills, and seven non-walk preview strips. Finishing the remaining launch breeds with that same contract makes Avatar Studio feel consistently premium, keeps the manifest/verifier/readiness model truthful, and moves the next queue step to native QA plus final room illustration instead of more breed-pack catch-up.

Owner: Codex.

Revisit trigger: Artist-provided breed strip sets replace the current generated preview-strip seam, or WoofWatcher adds template-specific walk cycles beyond the current non-walk preview contract.

### 2026-06-19: Family-Dog Templates Should Promote Straight From Partial Packs To Full Animated Packs

Decision: Once Retriever, Husky, and Doodle had credible partial overlays and mood stills, WoofWatcher should finish their full family packs in one pass by adding the remaining overlay slots, the remaining mood stills, and generated preview strips together instead of introducing another long-lived half-ready state.

Reason: Apollo has been explicit that WoofWatcher should not imply more production progress than actually exists. Finishing the family-dog trio in one coherent slice keeps the UI truthful, lets the verifier enforce one complete contract, and shifts the next queue step to the remaining launch breeds instead of keeping Retriever/Husky/Doodle stuck in `Art pack in progress`.

Owner: Codex.

Revisit trigger: Artist-provided breed strips replace the current generated preview-strip seam, or the remaining launch breeds need a different promotion path than the family-dog trio used.

### 2026-06-18: Family-Dog Templates Can Ship Truthful Partial Packs Before Animation

Decision: Retriever, Husky, and Doodle may ship file-backed accessory overlays and mood stills before their animated sprite strips are ready, as long as Avatar Studio labels them `Art pack in progress` and keeps animated preview explicitly false.

Reason: The family-dog wave was blocked in the uncomfortable middle state between base-only truth and full animation. Adding real overlay and mood files gives owners richer breed-specific review choices now, while the manifest/readiness contract still prevents those breeds from looking fully animated before their strip work is finished.

Owner: Codex.

Revisit trigger: Retriever, Husky, and Doodle receive live sprite strips, or a stronger artist-provided partial-pack contract replaces the current generated overlay/still seam.

### 2026-06-18: Avatar Studio Pack Truth Uses One Manifest

Decision: Avatar Studio's live-art status, next-pack priority, and PixelLab asset verification should all derive from one shared template-pack manifest instead of separate hardcoded lists in the UI, readiness model, and verifier.

Reason: The next production wave targets Retriever, Husky, and Doodle. Keeping pack truth in multiple files makes it too easy for a breed to look "next" in one surface, "queued" in another, or silently skip verification when art lands. One manifest keeps the studio truthful while making future pack registration smaller and safer.

Owner: Codex.

Revisit trigger: A fuller asset-management system replaces the current template-pack registry, or the art pipeline moves to generated metadata from PixelLab/Figma tooling.

### 2026-06-18: Avatar Studio Must Show Pack Stage On Each Choice

Decision: Avatar Studio should expose production-pack truth at the choice level, not only as a summary. Template cards, accessory slots, and mood chips should label whether a breed pack is base-only, art-partial, or animated, and whether each accessory or mood has live file-backed art today.

Reason: As more breed packs come online, aggregate counters alone make it too easy to overread readiness. Owners need to know which exact customization choices are backed by real art before saving a care twin, and Apollo has been explicit that WoofWatcher must not imply production progress that has not actually shipped.

Owner: Codex.

Revisit trigger: Most launch templates ship full overlay/emote/sprite packs, or a richer in-studio art browser replaces the current readiness labels.

### 2026-06-18: Avatar Studio Must Not Fake Production Overlay Readiness

Decision: Avatar Studio should render live accessory/emote art only when a template has real file-backed pack assets, and unfinished templates should say that production overlays or moods are still pending instead of drawing generic stand-in costume shapes.

Reason: The dog-care twin needs to feel premium and trustworthy. Generic fallback costume art makes Retriever, Husky, Doodle, and the remaining breeds look more finished than they are, which creates the same fake-progress problem Apollo keeps rejecting elsewhere in the product.

Owner: Codex.

Revisit trigger: Additional breed packs ship with real overlay/emote files, or the team approves a separate clearly-labeled wireframe preview mode for unfinished templates.

### 2026-06-18: Avatar Studio Uses Live Phoenix Motion Only Where Production Sprite Packs Exist

Decision: Avatar Studio should animate the shepherd/Phoenix template with the real Phoenix sprite rig, while templates that only have base stills remain on explicit still-preview labeling until their own sprite packs are produced.

Reason: The repo already contains a complete registered Phoenix sprite manifest, but only the shepherd/Phoenix template has matching production art coverage today. Reusing that live rig makes the canonical care twin feel more alive now without falsely implying that Retriever, Husky, Doodle, and the rest already have production animation packs.

Owner: Codex.

Revisit trigger: Additional breed-specific sprite packs ship, or a unified template animation renderer replaces the current Phoenix-only preview contract.

### 2026-06-19: Avatar Studio Should Separate Production Now From Next Pack

Decision: Avatar Studio should present partial-pack breeds with an explicit `Production now` versus `Next pack` breakdown so owners can see the exact live overlays and moods before selecting them, instead of inferring readiness from counts alone.

Reason: Retriever, Husky, and Doodle now have meaningful but incomplete art coverage. Counts such as `8/10 live overlays` are truthful, but they still force the owner to guess which two accessories or which three moods are pending. Listing the live set and the pending-next set makes the studio more trustworthy and keeps the family-dog wave understandable while animation strips are still unfinished.

Revisit trigger: The remaining launch breeds receive partial or animated packs, or the pack contract expands beyond overlays, moods, and animated strips.

### 2026-06-17: PixelLab Is The Production Asset Pipeline For Phoenix

Decision: WoofWatcher will use PixelLab for the production Phoenix identity, transparent sprite strips, dogless rooms, template previews, and accessory packs. PixelLab secrets stay local or backend-only and must never be placed in the Expo app, PWA, GitHub, screenshots, or docs.

Reason: The app already has a tested care-twin state engine, sprite manifest, and layered runtime gate, but the missing piece is high-quality consistent pixel art. PixelLab's character and animation workflow matches the production need better than ad hoc generated portraits or hand-cropped placeholders.

Owner: Apollo and Codex.

Revisit trigger: PixelLab cannot produce a consistent approved Phoenix identity, generation cost becomes impractical, or Apollo selects a dedicated pixel artist/toolchain instead.

### 2026-06-18: First Layered Phoenix Sprite Runtime Is Live

Decision: Phoenix Home may render the first true layered care-twin scene using the dogless day room plus the registered `idle-breathe`, `tail-wag`, and `sleep-loop` Phoenix sprite strips.

Reason: The duplicate-avatar risk is solved for these states because `assets/avatar/rooms/phoenix-room-day.png` does not contain Phoenix and the v2 sprite strips are transparent, normalized, and registered in `careTwinAssets.ts`. This moves WoofWatcher from a baked animated room toward a real game-like care twin without showing a second dog.

Owner: Codex.

Revisit trigger: Apollo rejects the dogless day room art, a stronger board-accurate room layer replaces it, or remaining sprite actions are generated and need registration.

### 2026-06-16: Care Twin Animation Uses A Sprite Manifest Before Layered Runtime Swap

Decision: Mobile Phoenix Home should keep the current single-stage room animation until dogless room backgrounds and transparent Phoenix sprite strips exist, while `avatarLifeEngine.ts` owns the Care Twin scene state, sprite actions, and `CARE_TWIN_SPRITE_MANIFEST`.

Reason: Apollo rejected the pasted-on duplicate-avatar look and wants the main Phoenix to feel like a video-game character. A tested manifest gives Fable/Replit or a sprite artist a precise asset contract without shipping an ugly temporary second dog layer.

Owner: Codex.

Revisit trigger: Final dogless room layers and transparent Phoenix sprite strips are available for in-engine inspection.

### 2026-06-16: Layered Sprite Rendering Requires Both Room And Phoenix Assets

Decision: `LivingPhoenixRoom` may render `SpriteSheetPlayer` only when `careTwinAssets.ts` has both a dogless room layer and the selected transparent Phoenix sprite strip registered.

Reason: This protects the premium presentation. Rendering a transparent Phoenix strip over the current board hero would duplicate Phoenix because the hero art already contains the dog. The runtime can be ready now, but the visual switch should happen only when the asset set is complete enough to look intentional.

Owner: Codex.

Revisit trigger: Apollo approves a final layered room/character asset pack and in-engine preview confirms there is no duplicate Phoenix.

### 2026-06-14: Quick Log Search And Timeline Use Board Sections

Decision: Mobile Quick Log should keep the composer, daily summary, search/filter controls, empty state, and timeline groups as separate shared board surfaces instead of local floating cards.

Reason: Quick Log is the highest-frequency care workflow. Separating the composer from search/timeline board sections keeps logging fast while making review, correction, sticky notes, and sync status easier for Fable/Replit to polish consistently.

Owner: Codex.

Revisit trigger: A dedicated Log design system replaces the shared mobile board primitives with reusable equivalents.

### 2026-06-14: Plans Keeps Reminder And Routine Workflows Inside Board Sections

Decision: The mobile Plans tab's Reminder Center and Daily Routine surfaces should use shared board sections, with reminder actions, routine editor entry points, routine completion, owner load, and responsibility summaries kept inside those surfaces.

Reason: Plans is where households coordinate what should happen next. Keeping reminders and routines in board sections makes the workflow easier to scan and gives final visual polish one coherent structure without weakening the existing routine/log relationship.

Owner: Codex.

Revisit trigger: A dedicated planning/calendar design system replaces the shared mobile board primitives with reusable equivalents.

### 2026-06-14: More Uses Shared Board Sections For Primary Household Tools

Decision: The mobile More tab's Care Team, Household Access, Responsibility Center, Sync Health, Tools & Sharing, and Diet Profile surfaces should use shared board primitives instead of local section headers and one-off card shells.

Reason: More is a primary mobile tab and carries the household/account/system workflows that make WoofWatcher feel real. Keeping those surfaces on the same board vocabulary as Home, Records, Health, Log, and Plans helps final design polish stay coherent while preserving working actions.

Owner: Codex.

Revisit trigger: A future mobile settings/household design system intentionally replaces the current board primitives with reusable equivalents.

### 2026-06-14: Records Uses One Shared Mobile Board Vocabulary

Decision: Mobile Records should not keep a parallel `padCard`/local section-header vocabulary. Care Trends, Dog ID, health/care evidence, reports, records, and medication sections should all use the shared board primitives unless a future Records-specific design system intentionally replaces them.

Reason: Records is the densest trust surface in WoofWatcher. A single board vocabulary gives Fable/Replit one coherent structure to visually polish and reduces the risk of fragmented mobile spacing, nested-card drift, or dead decorative sections.

Owner: Codex.

Revisit trigger: Apollo approves a dedicated Records design system or a final Figma/Fable board replaces the shared mobile primitives with an equivalent reusable component set.

### 2026-06-14: Records Reports Use Board Sections

Decision: Mobile Records report workflows should use shared board sections for Care Pass, Report History, and Progress Report instead of loose section headers plus one-off card shells.

Reason: Records and reports are premium trust surfaces for vets, sitters, trainers, and household owners. Keeping their share, print, and period controls inside the same board anatomy as Home, Health, Log, and Plans makes the app easier to polish visually without breaking the working handoff/report flows.

Owner: Codex.

Revisit trigger: A dedicated Records/Care Pass design system replaces the current shared mobile board primitives or Fable/Replit supplies a stronger final report composition.

### 2026-06-12: Avatar Studio Starts As A Template-State Prototype

Decision: Avatar Studio is a first-class PWA route with local reference photo memory and required template states before generated pixel sprites or animation assets exist.

Reason: Apollo wants Phoenix to feel like a living care twin, but final Rive/Lottie/Reanimated assets and AI generation are a design/asset pipeline task. A tested template-state route gives Fable/Replit the correct product structure and state inventory to polish.

Owner: Codex.

Revisit trigger: Final sprite assets, Rive/Lottie/Reanimated state machines, or AI avatar generation become active implementation work.

### 2026-06-12: Records And Reports Need Direct PWA Routes

Decision: Timeline, Records, Reports, and Care Pass are direct PWA routes instead of aliases into the More page.

Reason: Apollo wants a navigable product with no dead ends. Records, reports, and handoffs are core premium workflows and should be reachable from the desktop sidebar as distinct work surfaces before a visual redesign starts.

Owner: Codex.

Revisit trigger: A router framework replaces the vanilla PWA tab model or mobile/web information architecture is consolidated.

### 2026-06-12: WoofGuide Actions Stay Owner-Reviewed In The PWA

Decision: WoofGuide is a first-class PWA route, but its action cards route owners into existing review flows instead of performing automatic writes.

Reason: Apollo wants useful AI-style workflows with no dead ends, but live AI, permissions, citations, and audit policy are not complete. Routing to Meal Log, Care Pass review, Records review, and a bounded vet-note draft makes WoofGuide useful now while keeping household and health actions human-confirmed.

Owner: Codex.

Revisit trigger: Provider-backed WoofGuide actions, citations, role-aware writes, or durable assistant draft storage become active production work.

### 2026-06-12: Diet & Treats Is A First-Class PWA Care Route

Decision: Diet & Treats is promoted from a More subpanel into a first-class PWA route that reads local meal, treat, water, routine, and diet-profile state.

Reason: Phoenix's food intake, treats, bedtime snack context, and avoid list are central to Apollo's original bile/vomit concern and daily household workflow. The route should help owners answer what was served, what was eaten, what treats happened, and what food boundaries matter without waiting for a visual redesign.

Owner: Codex.

Revisit trigger: Shared care-domain diet review helpers or server-backed diet profile/storage become the canonical implementation.

### 2026-06-12: Care Pass Uses Scoped Audience Source Before Binary PDFs

Decision: PWA Care Pass exports generate separate Vet, Sitter, Trainer, and Emergency source payloads through `buildScopedCarePass` before WoofWatcher adds binary PDF generation or server-backed report storage.

Reason: Apollo wants handoffs and reports that can be sent to vets, sitters, trainers, or emergency contacts. Scoped source exports make the workflow useful now, keep the audience boundary explicit, and give Fable/Replit a concrete data contract to polish visually later.

Owner: Codex.

Revisit trigger: Native PDF generation, stored report artifacts, server-side rendering, or provider-backed document storage becomes active production work.

### 2026-06-12: Household Presence Is Manual For v1.5

Decision: Household Pulse uses manual Leaving Home and I'm Home state for v1.5. An open household-visible `alone` log means Phoenix is home alone. Closing that log records the return outcome, duration, caregiver, recovery, and notes.

Reason: Apollo asked for household coordination without forcing geolocation in this version. Manual state is enough to make the workflow useful now and avoids privacy/provider complexity before auth, roles, and device permissions are implemented.

Owner: Codex.

Revisit trigger: Auth-connected household presence, geofencing, device permission policy, or provider-backed role enforcement becomes active production work.

### 2026-06-12: Quick Log Uses Structured Flows For Meal And Potty

Decision: Meal and Potty quick actions open dedicated Quick Log v2 flows in the PWA instead of saving generic one-tap rows. Meal uses a served-to-outcome lifecycle. Potty remains the parent action and stores the specific outcome as structured detail.

Reason: Apollo specifically wants logging to be more sophisticated while still fast. Meals need portion, served/eaten state, notes, and household visibility. Potty should not split pee/poop into confusing top-level actions; it should ask what happened inside one clear flow.

Owner: Codex.

Revisit trigger: Native mobile Log composer becomes the only canonical write surface, or a server-side event command model replaces local PWA form handlers.

### 2026-06-12: v1.5 Locks Premium Neo-Retro Pixel Care

Decision: WoofWatcher v1.5 uses the Premium Neo-Retro Pixel Care direction with the line "Real care. Pixel heart.", the tagline "Your dog's day, brought to life.", and the promise "Care for your real dog. Watch their care twin come alive."

Reason: Apollo provided this as the current locked product direction and asked Codex/Fable/Replit to build toward a strong working version today/tomorrow.

Owner: Apollo.

Revisit trigger: Apollo replaces the v1.5 kickoff with a newer canonical product/design brief.

### 2026-06-12: PWA Becomes A v1.5 Dashboard Surface While Mobile Remains Canonical

Decision: `artifacts/woofwatcher-mobile` remains the canonical mobile product, and `artifacts/woofwatcher` is intentionally upgraded as the local-first PWA/dashboard surface that preserves localStorage, backup/import, reports, Health Watch/Bile Watch, records, and assistant routing.

Reason: Existing docs correctly identify mobile as canonical, but Apollo's v1.5 kickoff explicitly says to preserve and upgrade the existing local-first PWA architecture rather than rebuilding from scratch.

Owner: Codex, pending Apollo confirmation.

Revisit trigger: Apollo chooses a single-surface launch strategy or declares the web/PWA no longer part of v1.5.

### 2026-06-08: Apollo Shared Thread Is Product Vision Source

Decision: Apollo's ChatGPT shared thread `https://chatgpt.com/share/6a2650b3-82f8-83e8-be54-55d68cea34a4` is treated as the current WoofWatcher product vision source.

Reason: Apollo explicitly directed Codex to extract the shared thread into durable docs and use it to guide autonomous development.

Owner: Apollo.

Revisit trigger: Apollo provides a newer canonical vision source or contradicts this thread in writing.

### 2026-06-08: Routines And Logs Are The First Product Spine

Decision: Routines define expected care, logs record actual care, and matching logs should satisfy or update routines when they correspond.

Reason: This is the clearest operational backbone for household trust and premium daily usefulness. Meal logs are the first detailed implementation target because they connect diet baseline, routine completion, caregiver visibility, and health patterns.

Owner: Apollo.

Revisit trigger: A future event-sourcing or scheduling model changes how expected care and actual care are reconciled.

### 2026-06-06: Mobile Is The Canonical Product Surface

Decision: `artifacts/woofwatcher-mobile` is the primary product experience.

Reason: WoofWatcher is a daily care app used by owners and caregivers in real time. Mobile is the correct default surface for logging, routines, handoffs, and urgent care context.

Owner: Codex, pending Apollo confirmation.

Revisit trigger: Apollo chooses a web-first launch or dashboard-first business model.

### 2026-06-06: Web App Remains A Prototype/Dashboard Surface

Decision: `artifacts/woofwatcher` should not be treated as the canonical UX until intentionally redesigned.

Reason: The current web app wraps a vanilla prototype. The mobile app contains the active product architecture and should drive shared product decisions.

Owner: Codex, pending Apollo confirmation.

Revisit trigger: Web dashboard becomes a paid product surface or primary demo surface.

### 2026-06-06: Care Domain Logic Lives In `lib/care-domain`

Decision: Shared care event types, status, health watch, diet progress, routine board, care pass, record vault, and sticky note rules belong in `lib/care-domain`.

Reason: Mobile, API, reports, and WoofGuide need one care vocabulary and one interpretation of logs.

Owner: Codex.

Revisit trigger: Domain package becomes too UI-specific or needs a larger package split.

### 2026-06-06: `care_entries` Is Append-Style Care Log Data

Decision: Care logs should be individual entries rather than overwriting shared state.

Reason: Multiple caregivers can log independently without clobbering each other. Sync failures and conflict resolution are easier to reason about with append-style logs.

Owner: Codex.

Revisit trigger: A future sync architecture requires event sourcing or a different write model.

### 2026-06-07: CI Must Verify Focused Tests, Typecheck, And CI-Safe Builds

Decision: `WoofWatcher Verify` runs on `main` pushes and pull requests.

Reason: The app is now large enough that silent typecheck/build drift blocks production readiness. CI is the baseline proof gate.

Owner: Codex.

Revisit trigger: Add mobile runtime smoke, API integration tests, or deployment checks.

### 2026-06-08: Vite Builds Use Safe Defaults When CI Env Is Missing

Decision: Web and mockup Vite configs default missing `PORT` and `BASE_PATH` for build contexts while still validating provided ports.

Reason: CI production builds do not need a runtime dev server port. Requiring `PORT` during build created false failures.

Owner: Codex.

Revisit trigger: Deployment platform requires a stricter build-time base path.

### 2026-06-08: Expo App Typecheck Excludes Node Test Files

Decision: `artifacts/woofwatcher-mobile/tsconfig.json` excludes `*.test.ts` and `*.test.tsx`.

Reason: Expo app typecheck should validate app code, not Node test files that import `node:test`. Root `pnpm run test:focused` remains responsible for behavior tests.

Owner: Codex.

Revisit trigger: Add a separate test tsconfig with Node types.

### 2026-06-08: Avatar Motion Uses A Care-State Model Before Final Animation Assets

Decision: Phoenix's animated avatar state is derived through a deterministic mobile motion model before adding final Rive, Lottie, or Reanimated asset pipelines.

Reason: The app needs an avatar that reacts to real care context instead of decorative animation. Health Watch, recent meals/treats/water/walks/play/training, due or overdue routines, quiet hours, and low energy should map to consistent avatar states that screens and future animation assets can share.

Owner: Codex.

Revisit trigger: Final Rive/Lottie/Reanimated assets introduce a stricter animation state machine or require new states.

### 2026-06-08: Onboarding Readiness Belongs In Care Domain

Decision: Setup readiness for dog profile, diet baseline, starter routines, and household caregivers is derived in `lib/care-domain`.

Reason: Today, onboarding, reports, and WoofGuide all need the same definition of whether a household care foundation is ready.

Owner: Codex.

Revisit trigger: First-run onboarding adds account-provider-specific requirements that do not belong in shared care logic.

### 2026-06-08: Pet Credential Uses Profile Fallback Fields

Decision: Microchip number, insurance provider/policy, primary vet, and emergency contact can live on the dog profile and feed the Records ID card before formal uploaded records exist.

Reason: Owners need a useful dog credential immediately. Uploaded records should improve proof, but the ID card should not stay empty until every document is captured.

Owner: Codex.

Revisit trigger: Record storage becomes authoritative enough to require verified document-backed credential fields.

### 2026-06-09: Dog ID Credentials Produce Printable Source Before Image/PDF Export

Decision: The Records Dog ID can produce escaped print-ready HTML with a stable file name and separate share action before WoofWatcher adds image or PDF credential export.

Reason: Apollo wanted a useful credential/certificate for Phoenix. Printable HTML gives the household a safe portable credential source now, while real image/PDF generation and document storage remain larger production tasks.

Owner: Codex.

Revisit trigger: Credential image export, native PDF generation, or storage-backed official record verification becomes active release work.

### 2026-06-10: Medication Adherence Derives From Routines And Logs First

Decision: Medication adherence is derived in `lib/care-domain` from medication routines plus household-visible medication logs before adding notification, refill, pharmacy, or AI medication workflows.

Reason: Medication is safety-sensitive household care. Owners need one trusted shared view of what was expected, what was logged, what is due, what was missed, and who handled it before the app adds proactive nudges or assistant suggestions.

Owner: Codex.

Revisit trigger: Medication reminders, refill tracking, role-based permissions, or vet/pharmacy integrations require stricter schedule and dosage schemas.

### 2026-06-11: Medication Follow-Ups Are Domain Rules Before Push Delivery

Decision: Medication follow-ups are derived in `lib/care-domain` from medication adherence plus medication records before implementing device push notifications or provider-backed reminder delivery.

Reason: The app needs useful missed-dose, due-now, and refill due-soon/overdue actions in Records and Care Pass reports now, but it should not claim real notifications until account, device permission, reminder preferences, and provider policy are implemented.

Owner: Codex.

Revisit trigger: Notification delivery, calendar recurrence, pharmacy/vet integrations, or stricter medication schedule schemas become active release work.

### 2026-06-11: Medication History Shows Shared Evidence Only

Decision: Medication history is derived from household-visible medication logs and shown in Records as recent evidence for owners, not as a separate private timeline.

Reason: Owners need to review dose, outcome, caregiver, routine, and notes without searching the full log, but private medication entries should preserve the same household boundary as routine satisfaction and adherence.

Owner: Codex.

Revisit trigger: The app adds role-based permissions, medication search/filtering, audit history, or provider-backed medication reports.

### 2026-06-11: Medication History Search Uses Owner-Visible Evidence First

Decision: Medication History search and outcome filters are derived in `lib/care-domain` from household-visible medication evidence before adding provider-backed medication reports, server search indexes, or clinical scheduling schemas.

Reason: Owners need to quickly find dose, caregiver, skipped, missed, and note context inside Records without leaving the medication workflow or exposing private logs. Scoped medication search strengthens household trust while keeping medication interpretation bounded to owner-entered evidence.

Owner: Codex.

Revisit trigger: Provider-backed medication reports, role-scoped medication search, server indexing, pharmacy/vet integrations, or stricter dosage/schedule schemas become active release work.

### 2026-06-11: Hydration Is Daily Care Evidence, Not Medical Diagnosis

Decision: Daily hydration is derived in `lib/care-domain` from household-visible water logs and surfaced in Records and Care Passes as care coordination evidence.

Reason: Owners and sitters need to know whether fresh water was offered and who logged it. The app can summarize water refills and visible caregiver participation without implying medical certainty about hydration status or unusual drinking causes.

Owner: Codex.

Revisit trigger: Configurable water goals, vet-reviewed hydration language, unusual-drinking Health Watch rules, or provider-backed reminder delivery become active release work.

### 2026-06-11: Walk Activity Is Shared Household Evidence

Decision: Walk Activity is derived in `lib/care-domain` from household-visible walk logs and surfaced in Records and Care Passes as daily activity, route/place, dog interaction, and social outcome context.

Reason: Apollo specifically wants walks, dog park visits, and other-dog interactions to be easy to track and share. The first durable layer should make those logs useful to owners, sitters, walkers, and trainers before adding maps, GPS routes, or partner workflows.

Owner: Codex.

Revisit trigger: Saved route maps, location permissions, dog park templates, walker partnerships, or richer behavior/training programs become active release work.

### 2026-06-11: Potty Health Is Shared Care Evidence, Not Diagnosis

Decision: Potty Health is derived in `lib/care-domain` from household-visible potty logs and surfaced in Records and Care Passes as daily pee/poop, stool condition, review, caregiver, and latest-detail context.

Reason: Apollo wants vomit, stool, and health changes to be trackable and shareable with the household, sitters, and vets. The app can organize potty evidence and safe next steps without diagnosing stool changes or pretending to replace veterinary care.

Owner: Codex.

Revisit trigger: Accident follow-up workflows, longer-range vet reports, clinician-reviewed wording, or provider-backed health summaries become active release work.

### 2026-06-11: Potty Detail Fields Feed Shared Review Context

Decision: Potty logs capture stool color and routine/accident/urgent/straining context in the mobile Log composer, and shared Potty Health carries those fields into Records and Care Pass reports.

Reason: Stool color and potty context are high-signal owner observations. They should be structured enough for household and vet/sitter review while still framed as owner-reported evidence, not diagnosis.

Owner: Codex.

Revisit trigger: Longer-range stool pattern reports, clinician-reviewed red-flag wording, accident follow-up workflows, or provider-backed health summaries become active release work.

### 2026-06-08: Log Details Stay In The Log Workflow

Decision: Entry details, sticky notes, sync state, edit/delete actions, and entry-level handoff sharing are implemented as a Log screen bottom sheet rather than a separate route.

Reason: The user needs fast review and action from the timeline. A separate route would add navigation cost before the app has search, long-history, or audit requirements that justify it.

Owner: Codex.

Revisit trigger: Log search/history, audit trails, or deep links require a routed entry-detail screen.

### 2026-06-11: Care Log Audit Trails Preserve Household Trust

Decision: Care log create, edit, sticky-note, and successful delete actions use a shared care-domain audit trail. Existing entries carry their own audit history, and successful deletes create a separate non-health note entry so deleted care does not silently satisfy routines or distort health patterns.

Reason: Household care logs are trusted evidence. Owners need to see when a log changed or disappeared without letting deleted meals, walks, medications, or health events keep affecting routine status and reports.

Owner: Codex.

Revisit trigger: Server-backed retention, role-based permissions, legal deletion policy, or routed long-history/audit views require a stricter audit architecture.

### 2026-06-11: Full Log Search Uses Shared Care Evidence

Decision: Full Log search belongs in shared care-domain logic before adding routed history views, server search indexes, or retention policy.

Reason: The same search rules should work for mobile Log, future history screens, reports, WoofGuide context, and API-backed search. Search must cover rich owner-entered evidence such as notes, caregivers, route/place fields, medication details, nested details, and sticky notes instead of only filtering by event type.

Owner: Codex.

Revisit trigger: Server-backed search, multi-dog search, long-retention history views, or role-scoped audit/search permissions become active release work.

### 2026-06-08: Care Pass Reports Preview Before Sharing

Decision: Sitter, vet, trainer, and caregiver Care Passes are previewed inside Records before invoking the native share sheet.

Reason: Owners need to verify what they are sending to a sitter, vet, trainer, or household member. Preview-first sharing is useful now, while generated PDF artifacts and storage history require a separate document/export architecture.

Owner: Codex.

Revisit trigger: Server-side report artifacts, print/PDF layout, or stored report history are implemented.

### 2026-06-08: Record Due Status Belongs In Care Domain

Decision: Expired, due-soon, current, and reference record status is derived by `lib/care-domain` and surfaced in the mobile Records cabinet.

Reason: Vaccines, insurance renewals, medication refills, receipts, and microchip references need consistent interpretation across Records, reminders, reports, and WoofGuide.

Owner: Codex.

Revisit trigger: Server-side reminders or storage-backed document records require stricter date schemas.

### 2026-06-08: WoofGuide Action Cards Are Deterministic First

Decision: WoofGuide suggested actions are derived as deterministic view-model cards before they perform structured writes.

Reason: Owners should see useful next steps immediately, but writes to logs, reminders, vet notes, and reports need auditable handlers, permission checks, and safety boundaries before automation is enabled.

Owner: Codex.

Revisit trigger: Structured WoofGuide action handlers are implemented and tested for log drafts, reminders, notes, and reports.

### 2026-06-08: WoofGuide Actions Are Owner-Reviewed Drafts First

Decision: WoofGuide action cards can create structured drafts for meal logs, record reminders, vet notes, and Care Pass review, but the owner must review before the app writes or routes the action.

Reason: This preserves trust and safety while making WoofGuide useful now. Assistant actions can speed up care work, but health notes, household logs, reminders, and shared reports should remain owner-confirmed until provider-backed source citations, permissions, and audit history are implemented.

Owner: Codex.

Revisit trigger: AI provider policy, privacy rules, role-aware permissions, and durable audit history are ready for permission-aware assistant writes.

### 2026-06-08: Care Foundation Setup Uses A Dedicated Route

Decision: First-run dog profile, diet baseline, starter routine, and caregiver basics are saved through a dedicated mobile Setup route.

Reason: The setup checklist should create usable care context in one pass. Scattering these fields across Today, More, and Calendar creates dead ends and makes onboarding feel incomplete.

Owner: Codex.

Revisit trigger: Auth-connected household onboarding, invite/join flow, multiple dogs, or a native onboarding stack requires splitting setup into staged screens.

### 2026-06-08: Care Pass Report History Stores Snapshots First

Decision: Shared Care Passes are stored as care-document report artifacts containing the generated message and section titles.

Reason: Owners need quick resend history now, while true PDFs, print layout, and server-backed artifact storage require a larger document pipeline.

Owner: Codex.

Revisit trigger: PDF generation, report storage backend, or audit/export requirements become active release work.

### 2026-06-09: Care Pass Artifacts Store Print-Ready HTML Before Binary PDFs

Decision: Care Pass artifacts include escaped print-ready HTML and a stable file name before WoofWatcher adds binary PDF generation.

Reason: Owners need reports that can become printable or downloadable artifacts, but native PDF generation and server-backed storage require a larger export pipeline. HTML gives the app a tested, safe, portable source payload now.

Owner: Codex.

Revisit trigger: Native PDF generation, Vercel/server rendering, or storage-backed report artifacts become active release work.

### 2026-06-09: Records Exposes Printable Care Pass Source Before PDF Storage

Decision: Records Report History shows print-ready or restored Care Pass metadata and gives owners separate actions for resending the human-readable handoff and sharing the printable HTML source.

Reason: A saved report is not premium enough if the owner cannot find or reuse the print artifact. Exposing the print source now improves sitter/vet/trainer workflow while keeping binary PDF generation and server-backed storage explicitly gated.

Owner: Codex.

Revisit trigger: Native PDF generation, document storage, or server-backed report artifacts become active release work.

### 2026-06-08: Household-Visible Logs Drive Routine Status

Decision: Routine status is satisfied by matching household-visible logs. Meal logs can record complete, partial, or skipped outcomes, and private logs stay out of shared household routine status.

Reason: The household needs one trusted board for what still needs care. A partial or skipped meal should update the board without pretending the full meal was eaten, while private notes should not silently clear a shared responsibility.

Owner: Codex.

Revisit trigger: Role-based household permissions or caregiver privacy controls move from local metadata into server-side authorization.

### 2026-06-08: Premium Preview Ships Before Checkout

Decision: WoofWatcher can show Free, Plus, and Family packaging in-app, but checkout remains disabled until privacy, support, refund, subscription, and launch obligations are approved.

Reason: Apollo needs a revenue story and paid-value surface now. Real payments create operational and legal obligations that should not be activated before the product and company support model are ready.

Owner: Codex.

Revisit trigger: Entitlement rules, production pricing, app-store subscription setup, and customer support/refund policies are approved.

### 2026-06-08: Entitlement Policy Lives In Care Domain Before Checkout

Decision: Free, Plus, and Family feature gates are defined in `lib/care-domain` and surfaced on the mobile Plus screen before payment integration begins.

Reason: Checkout should enforce a product policy that already exists, not invent revenue rules inside payment code. Free covers dog profile, basic logs, starter routines, and local history. Plus covers advanced meals, Health Watch, records, reports, WoofGuide drafts, and report history. Family covers household roles, shared routines, caregiver handoffs, and family calendar.

Owner: Codex.

Revisit trigger: Apollo approves final pricing, grandfathering, trial rules, support/refund terms, or App Store subscription packaging.

### 2026-06-08: Privacy Safety Ships As Export And Request First

Decision: WoofWatcher can provide owner care-data export, AI disclosure, document storage gates, and account deletion request preparation before implementing destructive self-serve deletion.

Reason: Owners need transparency and portability now, but deleting account, household, medical record, document, and generated artifact data requires provider-backed deletion rules, retention policy, audit behavior, and legal approval. The app should not pretend a destructive backend flow exists.

Owner: Codex.

Revisit trigger: Clerk/database/storage providers, retention rules, support workflow, and legal privacy policy are approved for self-serve deletion.

### 2026-06-08: Static Mobile Readiness Smoke Runs In Focused Tests

Decision: Until local Expo runtime/simulator tooling is available, the focused test suite should include static mobile readiness checks for critical route registration, tab coverage, string router links, and launch-blocking safety copy.

Reason: This does not prove runtime rendering, but it catches dead route links and missing release-critical surfaces in the zero-dependency test path that runs locally and in CI.

Owner: Codex.

Revisit trigger: Expo runtime smoke, simulator screenshot checks, accessibility automation, or visual regression tests are available in CI.

### 2026-06-08: CI Runs Mobile Expo Web Export Smoke

Decision: `build:ci` runs the mobile app's `smoke:web` script, which performs an Expo web export and verifies HTML and JavaScript assets are emitted.

Reason: This is stronger than static route checks and proves the Expo mobile project can bundle in CI. It still does not replace native simulator/device rendering, but it catches bundling and asset failures before release.

Owner: Codex.

Revisit trigger: Native simulator/device smoke or screenshot automation becomes available in CI.

### 2026-06-08: Mobile App Identity Uses Pegasus Dreamscapes Package IDs

Decision: Expo app identity uses `woofwatcher` for slug and URL scheme, `com.pegasusdreamscapes.woofwatcher` for iOS bundle identifier, and `com.pegasusdreamscapes.woofwatcher` for Android package.

Reason: Replit-generated placeholders are not release-grade for App Store or Play Store preparation. The app identity should be stable, brand-owned, and protected by static readiness tests before EAS or store submission work begins.

Owner: Codex, pending Apollo confirmation before actual store submission.

Revisit trigger: Apollo chooses a different legal publisher, domain, app-store account, or bundle/package naming convention before submission.

### 2026-06-08: Critical Mobile Actions Need Screen Reader Labels

Decision: Critical mobile actions on Privacy, Premium, WoofGuide, and More must expose explicit screen-reader labels and stay covered by focused static smoke.

Reason: These surfaces include privacy export, deletion request preparation, premium launch gating, owner-reviewed WoofGuide actions, assistant sending, profile editing, Plus entry, sharing tools, and sign out. They are release-critical actions, so they should not depend only on visible icon or card text.

Owner: Codex.

Revisit trigger: Native accessibility automation, simulator screen-reader traversal, or a formal design-system accessibility audit becomes available.

### 2026-06-08: Today Command Uses Routine Board Truth

Decision: Today Command uses `deriveRoutineBoard` for open routine selection instead of independently guessing from raw day counts.

Reason: Home and Calendar must agree about what is due, overdue, completed, partial, skipped, assigned, and private. One routine-board source prevents duplicate prompts after partial meals and lets overdue assigned routines become the primary next action.

Owner: Codex.

Revisit trigger: Reminder notifications or recurring-rule scheduling introduce a stricter due-state source.

### 2026-06-08: Home Quick Log Enriches Entries Before Saving

Decision: Home Quick Log uses a tested entry builder that reads the routine board and diet profile before creating care entries.

Reason: One-tap logging should stay fast, but it must not create thin history rows that lose routine identity, meal completion, portion, eaten amount, or household visibility. Routine-aware quick entries keep Home, Log, Calendar, diet progress, and household status connected, while far-future routines stay open until they are actually due.

Owner: Codex.

Revisit trigger: The Log composer gains deep-linked presets or a server-side write pipeline becomes the canonical entry builder.

### 2026-06-08: Health Watch Uses Non-Diagnostic Pattern Cards

Decision: Health Watch exposes reusable pattern cards with kind, status, evidence, review window, owner next step, and entry ids.

Reason: Owners, sitters, trainers, vets, reports, and WoofGuide need the same safe interpretation layer. Health Watch should organize vomit, appetite, stool, anxiety, and steady-state context without diagnosing or implying certainty.

Owner: Codex.

Revisit trigger: Vet-note drafting, notification rules, or clinician-reviewed language requires a stricter medical-safety template.

### 2026-06-08: Care Pass Exports Include Audience Checklists

Decision: Care Pass generation includes audience-specific Handoff Checklist sections and Health Pattern Review lines.

Reason: Reports are a premium revenue pillar only if they are immediately useful to sitters, caregivers, trainers, and vets. A shareable report should say what to do, what to watch, what evidence exists, and where medical certainty stops.

Owner: Codex.

Revisit trigger: PDF generation, clinician-reviewed wording, or paid report templates require stricter template versioning.

### 2026-06-08: Records Reminders Stay Date-Aware And Reference-Safe

Decision: Record reminders are derived from date-backed records and missing credential-critical sections, while reference-only values such as microchip numbers and policy numbers remain non-date references.

Reason: Owners need proactive vaccine, insurance, and document follow-up without false alarms on credential identifiers. This keeps the dog ID card and Care Pass exports more trustworthy while storage provider work remains separate.

Owner: Codex.

Revisit trigger: Server-side reminders, push notifications, or document storage make backend reminder scheduling authoritative.

### 2026-06-11: Sync Recovery Must Be Owner-Visible

Decision: Local, pending, and failed care-entry changes are summarized as a durable sync outbox and exposed in the Log workflow through CareContext instead of remaining only inside refresh/retry internals.

Reason: Household trust depends on knowing whether care was saved, syncing, failed, or ready to retry. A visible outbox makes offline and failed-sync recovery understandable without requiring owners to inspect individual timeline rows.

Owner: Codex.

Revisit trigger: Conflict-safe state mutation, background sync workers, native offline runtime QA, or conflict-resolution UI becomes active release work.

### 2026-06-11: Household Sync Health Belongs In More

Decision: Household-level sync health is summarized on the More screen, while the Log screen remains the tactical place to inspect and retry specific outbox changes.

Reason: Main owners need a calm trust signal that says whether the shared household record is current, syncing, loading, or needs attention. That belongs next to household/team controls, not hidden inside the event timeline.

Owner: Codex.

Revisit trigger: Role permissions, background sync workers, native offline runtime QA, or conflict-resolution UI requires a dedicated sync center.

### 2026-06-11: Household Responsibility Uses Routine Board Truth

Decision: Household Responsibility is derived from the same routine-board truth that reconciles routines and visible logs, then surfaced in Calendar and More as owner loads, open/overdue/unassigned counts, visible today log activity, and one next household action.

Reason: Family-tier value depends on the household knowing who owns what, what still needs care, and what should happen next. A shared derivation prevents Calendar, More, Today, and future role permissions from inventing conflicting responsibility states.

Owner: Codex.

Revisit trigger: Auth-connected role permissions, caregiver editing, invite approval, reminder delivery, or formal shift handoffs require stricter permission-aware ownership rules.

### 2026-06-11: Care Document Refresh Preserves Newer Local State

Decision: Mobile care-state refreshes reconcile server data against the local care document timestamp. If local profile, routine, record, or report state is newer than the server document, the app keeps the local document and pushes it back using the server's current version.

Reason: Household sync cannot silently overwrite newer offline or fast local edits with stale server state. This protects the dog profile and shared care plan while deeper per-field conflict resolution and audit policy remain future production work.

Owner: Codex.

Revisit trigger: Multi-device field-level conflict UI, delete/edit audit trails, background sync workers, or native offline runtime QA require a stricter conflict model.

### 2026-06-11: Walk Routes Are Derived Templates Before GPS Maps

Decision: Saved walk routes are currently derived from household-visible walk logs that include route/place names, duration, distance, dog interactions, and social outcomes. Private walk logs and stale route evidence stay out of shared route templates.

Reason: Apollo wants walks, dog parks, social encounters, sitters, trainers, and reports to connect. Deriving templates from owner-entered logs gives the app useful repeat-route intelligence now without requiring GPS, map providers, location permissions, or privacy policy decisions that are not ready.

Owner: Codex.

Revisit trigger: GPS recording, map previews, walker partnerships, location retention policy, or route-sharing permissions become active release work.

### 2026-06-11: Care Trends Are Derived From Visible Logs Before Predictive AI

Decision: Weekly Care Trends derive from household-visible care logs and compare the current 7-day window with the previous 7-day window before adding predictive AI, clinical interpretation, or long-range charting.

Reason: Owners need useful week-over-week context now across meals, walks, water, potty, medication, health watch, and caregiver participation. The app should turn logged care into premium insight while preserving the same household visibility and medical-safety boundaries used by Records and Care Pass.

Owner: Codex.

Revisit trigger: Long-range trend charts, predictive assistant nudges, clinician-reviewed language, paid report templates, or provider-backed analytics become active release work.

### 2026-06-11: Training Progress Uses Owner-Logged Practice Evidence First

Decision: Training Progress derives from household-visible training logs with skill/cue, outcome, duration, next-practice notes, caregiver, and latest context before adding formal training plans or trainer-assigned homework.

Reason: Apollo wants training, dog interactions, sitters, trainers, and reports to connect. Owner-entered practice evidence can make Records and Care Pass useful now while keeping behavior interpretation bounded and avoiding fake trainer authority.

Owner: Codex.

Revisit trigger: Formal skill plans, trainer collaboration, behavior trigger taxonomy, paid trainer packs, or behavior/AI interpretation become active release work.

### 2026-06-11: Alone Time Tracks Separation Context As Care Evidence

Decision: Alone Time derives from household-visible departure logs with duration, return state, trigger/context, calming support, recovery minutes, caregiver, and latest context before adding formal separation-training plans or trainer/vet-reviewed language.

Reason: Phoenix's anxiety and household schedule changes are part of the original product need. Owners need to know what happened when she was left alone, what helped, and what should be shared with a sitter or trainer, but WoofWatcher should not diagnose separation anxiety or pretend to be a behavior professional.

Owner: Codex.

Revisit trigger: Formal Alone Time plans, behavior trigger taxonomy, trainer collaboration, vet-reviewed language, or AI behavior interpretation become active release work.

### 2026-06-11: Weight Trend Uses Owner-Reported Weigh-Ins First

Decision: Weight Trend derives from household-visible weight logs, profile fallback weight, and owner-entered weight goals before adding vet-reviewed weight plans, long-range charts, or reminder automation.

Reason: Apollo wants Phoenix's weight, milestones, and reports to be useful to the household and vet. The app can organize dated owner-reported weigh-ins and goal distance now, while avoiding medical claims or automatic diet changes.

Owner: Codex.

Revisit trigger: Vet-reviewed weight-plan language, long-range charting, weight-goal reminders, diet automation, or clinical interpretation becomes active release work.

### 2026-06-11: Grooming Care Uses Owner-Reported Grooming Evidence First

Decision: Grooming Care derives from household-visible grooming logs with type, duration, coat/skin notes, products/groomer context, next due date, caregiver, and latest context before adding groomer contacts, recurring reminders, or clinical coat/skin interpretation.

Reason: Apollo wants every daily-care category to become useful household evidence and report context. Grooming matters for sitter handoffs, vet review, and future groomer partnerships, but the app should summarize owner-entered context without diagnosing skin or coat issues.

Owner: Codex.

Revisit trigger: Grooming reminders, groomer collaboration, coat/skin follow-up workflows, document-backed grooming receipts, or clinician-reviewed language become active release work.

### 2026-06-11: Household Access Is Readiness Before Enforcement

Decision: Household Access derives synced account members, local-only caregivers, routine-only owners, invite readiness, and practical permission labels before adding provider-backed role enforcement.

Reason: Apollo wants the household to know who is actually connected, who only exists locally in the care plan, and who owns routines without account access. Showing that readiness now creates Family-tier value without pretending invite approval, auth roles, or enforcement are complete.

Owner: Codex.

Revisit trigger: Provider-backed role enforcement, invite approval, caregiver editing, household admin tools, or account audit policy becomes active release work.

### 2026-06-11: Reminder Center Is A Candidate Layer Before Push Delivery

Decision: Reminder Center derives owner action candidates from routine-board status, medication follow-ups, record reminders, and grooming due dates before adding real push notifications, runtime permissions, reminder preferences, or automatic care writes.

Reason: Apollo wants reminders to feel useful and household-aware now, but the app should not imply provider-backed notification delivery until account/device permissions, scheduling rules, user preferences, and safety policy exist. Calendar can show the actionable truth today while push delivery remains a separate production slice.

Owner: Codex.

Revisit trigger: Provider-backed notification delivery, reminder preferences, recurring-rule scheduling, medication-specific delivery policy, or automatic assistant writes become active release work.

### 2026-06-13: Achievements Are Evidence-Based Care Milestones

Decision: Achievements derive from household-visible care evidence, including routine streaks, training consistency, food/vomit stability, bedtime snack proof, calm alone-time outcomes, and records completeness. The app should not use fake currencies, empty badges, or reward loops detached from Phoenix's real care.

Reason: Apollo wants WoofWatcher to feel fun and emotionally alive without becoming a shallow gamified tracker. Evidence-based milestones make care progress visible to the household, reports, and future premium polish while keeping the product trustworthy for health, records, sitters, trainers, and vets.

Owner: Codex.

Revisit trigger: Paid achievement packs, kid-mode rewards, trainer goals, or long-range progress challenges become active release work.

### 2026-06-13: Settings Is The Local-First Truth Surface

Decision: Settings consolidates backup, import, same-household transfer, reset, provider readiness, AI mode, health boundary, reminder delivery truth, and sync blockers before adding provider-backed account controls.

Reason: Apollo wants no dead ends and no fake integrations. A trustworthy Settings route lets owners understand what is local, what can be exported, what is safe to share, and what still needs auth/storage/sync providers before Fable or Replit polish the visuals.

Owner: Codex.

Revisit trigger: Auth-connected account settings, provider-backed deletion, household invites, cloud sync enablement, payment settings, or production privacy policy become active release work.

### 2026-06-13: Phoenix Home Must Answer Presence And Health Context First

Decision: Phoenix Home keeps the first-screen priority on where Phoenix is, whether she is alone, what care is next, and whether Health Watch or Bile Watch needs review. Pixel-room copy should reflect real state: open meal outcome, home-alone timer, health/bile review, next routine, or steady care.

Reason: Apollo's original product need is shared household care, not a decorative dashboard. The Home screen should let either owner understand Phoenix's status in seconds and move to the correct workflow without hunting through More.

Owner: Codex.

Revisit trigger: Final Fable/Figma visual redesign, animated room assets, or multi-dog home state rules become active release work.

### 2026-06-13: Expo/EAS Is The v1 Mobile Release Path

Decision: WoofWatcher v1 uses Expo/EAS as the iOS and Android build path, with committed development, preview, production, and submit profiles under `artifacts/woofwatcher-mobile/eas.json`.

Reason: Apollo clarified that WoofWatcher is mainly an iOS and Android product, with web as a supporting surface. Committing EAS profiles and a release runbook gives Fable and Replit a concrete mobile target while keeping store submission, accounts, privacy/legal, and production secrets properly gated.

Owner: Codex.

Revisit trigger: Apollo chooses a native rebuild, bare React Native path, custom CI signing pipeline, or a different mobile release provider.

### 2026-06-14: Pixel UI Reference Boards Are The Visual Source Of Truth

Decision: The four Apollo-provided WoofWatcher pixel UI boards are mirrored into `docs/design/reference/` and locked as the current visual source of truth. Board 04 is the primary shell/layout target, while boards 02 and 03 define the cleanest component vocabulary and board 01 provides supporting palette, icon, and mobile route evidence.

Reason: Apollo asked Codex to stop drifting and match the provided premium neo-retro pixel direction as closely as possible before handing final polish to Fable/Replit/Figma-style tooling. Locking the images and spec in Git gives future builders a concrete target that will not expire with chat uploads.

Owner: Codex.

Revisit trigger: Apollo replaces these boards with a newer canonical Figma file, production art direction, or final commissioned Phoenix asset set.

### 2026-06-14: Board Primitives Are The Mobile Visual System Foundation

Decision: The Expo mobile app now uses a shared board primitive layer for the locked pixel UI direction, starting with Phoenix Home and the bottom tab shell. The primitives include compact board cards, section headers, segmented status meters, quick action tiles, pixel speech bubbles, and care rows.

Reason: Apollo wants Codex to implement the UI direction in real app code before Fable/Replit/Figma polish. A primitive layer prevents every screen from recreating the reference-board style differently, while keeping the existing care workflows, local-first behavior, and safety boundaries intact.

Owner: Codex.

Revisit trigger: A canonical Figma component library replaces the in-code primitives, or final native animation/asset tooling requires a more formal design-token package.

### 2026-06-14: Core Mobile Routes Must Inherit The Board System

Decision: Core v1.5 mobile routes should use shared board primitives instead of one-off route chrome. The primitive layer now includes `BoardRouteHeader`, `BoardPill`, and `BoardMetricTile`, and the readiness suite protects adoption across Log, Plans, Health/Bile, More, Records, WoofGuide, and Avatar Studio.

Reason: Apollo wants the app to feel like one premium neo-retro pixel product, not a Home screen mockup attached to mismatched utility pages. Shared route chrome gives Fable/Replit/Figma a stable system to polish while preserving the existing care workflows, local-first data, safety language, reports, records, and assistant routing.

Owner: Codex.

Revisit trigger: A final Figma component library, native animation package, or full visual QA pass replaces this in-code board route layer.

### 2026-06-14: CI Actions Use Node 24 Runtime Majors

Decision: `WoofWatcher Verify` uses `actions/checkout@v6`, `actions/setup-node@v6`, and `pnpm/action-setup@v6`, with the project runtime pinned to Node 24.

Reason: GitHub Actions is moving JavaScript action execution away from Node 20. Keeping the workflow on Node 24-compatible action majors protects the production safety gate before the runner default changes.

Owner: Codex.

Revisit trigger: Upstream action major versions introduce a breaking workflow change, or GitHub changes the hosted runner JavaScript action runtime again.

### 2026-06-14: Core Workflow Cards Should Use BoardCard

Decision: Quick Log, Plans, and Records should use the shared `BoardCard` shell for primary workflow cards, starting with the Log composer, Plans upcoming-events section, and the Records Dog ID credential.

Reason: Apollo's reference boards depend on compact, consistent card anatomy. Moving these high-frequency surfaces away from one-off card shells makes the app easier for Fable/Replit/Figma-style polish to improve without breaking care workflows.

Owner: Codex.

Revisit trigger: A final native component library or Figma-derived design system replaces the current in-code board primitives.

### 2026-06-14: WoofGuide Uses Board Sections, Not A Separate Chat UI

Decision: WoofGuide's owner-reviewed intro, Quick Questions, and Suggested Actions should use the shared `BoardCard` and `BoardSectionHeader` anatomy while keeping chat bubbles and the review sheet as interaction-specific surfaces.

Reason: WoofGuide is a core care assistant, not a separate chatbot product. It should feel integrated with Phoenix's care board while preserving bounded health language, owner-reviewed drafts, and real route/action behavior.

Owner: Codex.

Revisit trigger: A full assistant redesign, native AI chat package, or final Figma component library introduces a better shared assistant pattern.

### 2026-06-14: Premium Polish Must Preserve Payment Truth

Decision: The Premium screen can use shared board anatomy and stronger plan presentation, but checkout remains visibly gated until Apollo approves privacy terms, support/refund workflow, subscription packaging, app-store target, and payment provider setup.

Reason: Premium polish is valuable for the July product path, but a beautiful monetization screen cannot imply live billing before the operational and legal pieces are ready.

Owner: Codex.

Revisit trigger: Payment provider setup, app-store subscription configuration, legal/privacy approval, or real checkout implementation becomes active release work.

### 2026-06-16: Living Phoenix Uses One Animated Stage Until Sprite Assets Exist

Decision: Phoenix Home should animate the board-accurate room as one living care-twin stage for now, instead of compositing the current non-transparent Phoenix portrait files over another background. The care-state logic lives in `avatarLifeEngine.ts`, and `LivingPhoenixRoom.tsx` owns the Reanimated stage, HUD, speech, haptics, and reaction feedback.

Reason: Apollo rejected the pasted-on second avatar look. The available "cutout" files are not production transparent sprites, so using them as layers makes the app look cheaper than the reference boards. A single animated stage preserves the premium pixel-room composition today while leaving a clean slot for true dogless-room plus Phoenix sprite-sheet assets later.

Owner: Codex.

Revisit trigger: Final transparent Phoenix sprite sheets, Rive/Lottie animations, or a Figma/Fable asset pack with separated room and character layers becomes available.

### 2026-06-17: Avatar Studio Starts With Templates Plus Scan-Assisted Suggestions

Decision: WoofWatcher Avatar Studio should ship first as a template-based pixel care-twin creator with scan-assisted suggestions and owner approval, not as a promise that one uploaded photo can perfectly generate a full animated custom dog.

Reason: The product needs the magic of "bring your real dog into the app" without sacrificing consistency, animation quality, or launch speed. Premade body templates, editable traits, accessory slots, and emote packs create a reliable game-like system that future AI scan and custom sprite generation can plug into.

Consequences:

- `PetAvatarConfig` is now the durable avatar identity model.
- The visible Avatar Studio flow uses Scan, Template, Customize, and Emotes steps.
- Current scan behavior is mock/local and uses truthful copy: photos help suggest a care twin, and the owner approves the match.
- Accessory customization uses slots such as neck, head, face, body, room, and fx instead of loose stickers.
- Home and More read the saved avatar template identity.
- Final AI scan, final template art, and custom sprite generation remain later production slices.

Owner: Codex.

Revisit trigger: Apollo supplies final template art, a production image-analysis provider is approved, or a pixel artist/Fable/Replit produces consistent template and sprite packs.

### 2026-06-18: Register Full Phoenix Sprite Manifest With First-Pass Room Variants

Decision: WoofWatcher should now render layered Phoenix for every current care-twin sprite action using registered transparent strips, while first-pass dogless room variants cover night, bedtime, health-watch, and home-alone states until final illustrated rooms replace them.

Reason: The app needed to move past proof-of-life animation into a complete video-game-style runtime contract. Registering all ten sprite actions lets Home respond to care state with the real Phoenix layer instead of falling back to the old baked room composition, while first-pass room variants keep state routing functional without waiting for final art.

Consequences:

- `careTwinAssets.ts` now registers all current `CARE_TWIN_SPRITE_MANIFEST` actions.
- `LivingPhoenixRoom` passes the active sprite action into room selection.
- `build-pixellab-sprite-strip.js` is the reproducible PixelLab frame-to-strip path.
- `derive-pixellab-room-variants.js` creates runtime-ready but replaceable room variants from the day room.
- Native device QA and final illustrated room variants remain required before store-quality launch.

Owner: Codex.

Revisit trigger: Final Rive/Lottie assets, a hand-authored PixelLab/Figma room pack, or a more advanced in-game room renderer replaces these PNG layer assets.

### 2026-06-18: Avatar Templates Use A Registered Preview Asset Pack

Decision: Avatar Studio launch templates should resolve through a stable preview asset registry at `avatarTemplateAssets.ts`, with one transparent PixelLab thumbnail per template under `assets/avatar/templates/{templateId}/preview.png`.

Reason: The template picker is a core part of the "bring your real dog into the app" promise. Generic icons make it feel like a settings screen; registered dog thumbnails make it feel like a character creator while preserving a clean path for future base art, emotes, sprites, and accessories.

Consequences:

- `/portrait` renders template art through `getAvatarTemplatePreviewSource`.
- The first 12 launch templates have PixelLab-generated 85x85 preview thumbnails.
- Readiness tests verify every preview exists and remains wired to Avatar Studio.
- Full production template packs still need base, emote, sprite, and accessory layers.

Owner: Codex.

Revisit trigger: Figma/Fable/PixelLab produces production-scale template packs or the Avatar Studio renderer moves from thumbnail previews to fully composited template bodies.

### 2026-06-18: Avatar Templates Use Separate Preview And Base Asset Tiers

Decision: Avatar Studio template art now has two registered tiers: `preview.png` thumbnails for compact pickers and `base.png` character stills for the larger creator preview stage. The first base tier covers Shepherd, Retriever, Husky, and Doodle.

Reason: Enlarging 85x85 thumbnails makes Avatar Studio feel cheap and undermines the "real-life digital pet" promise. A separate 170x170 base tier gives the app a production-shaped character creator path while leaving room for emote stills, sprite strips, and accessory overlays under the same template folders.

Consequences:

- `avatarTemplateAssets.ts` registers `AVATAR_TEMPLATE_BASE_ASSETS` separately from `AVATAR_TEMPLATE_PREVIEW_ASSETS`.
- `/portrait` shows selected template base art when it exists and falls back safely for unfinished templates.
- `verify-pixellab-assets.js` now checks the first four template base PNGs.
- Remaining launch templates still need base art, emotes, sprites, and accessory overlays.

Owner: Codex.

Revisit trigger: A final Figma/Fable/PixelLab component renderer replaces static base stills with fully composited template bodies or live sprite previews.

### 2026-06-18: Avatar Studio Can Treat All 12 Launch Templates As Base-Art Ready

Decision: Avatar Studio now registers `base.png` for every launch template instead of mixing four production stills with thumbnail fallbacks, and the creator preview may show layered mood/accessory overlays on top of those base stills while accessory PNG packs are still in production.

Reason: The remaining thumbnail fallbacks made the template picker feel premium while the hero preview still looked unfinished for most breeds. A complete 12-template base pack gives the character creator a consistent production-scale review surface now, and code-layered overlays let customization choices feel alive without pretending the final accessory art packs already exist.

Consequences:

- `avatarTemplateAssets.ts` now registers base stills for all 12 launch templates.
- `verify-pixellab-assets.js` and the mobile readiness suite now treat all 12 `base.png` files as required assets.
- Avatar Studio's hero preview can show selected mood and accessory state as a truthful layered preview while final overlay PNGs and sprite packs remain separate asset work.

Owner: Codex.

Revisit trigger: Final accessory overlays, emote stills, or live template sprite packs replace the temporary code-layered preview contract.

### 2026-06-18: Avatar Studio Prefers Registered Overlay And Emote PNG Assets

Decision: Avatar Studio should prefer file-backed template accessory overlays and emote stills whenever a template pack provides them, while preserving the existing shape-based fallback for templates that are still waiting on production art.

Reason: The first Shepherd/Phoenix overlay and emote pack needs to be a real runtime contract, not only a note in the queue. Registering those PNGs in `avatarTemplateAssets.ts` and enforcing them in the verifier lets the mobile preview show truthful PixelLab-backed art today while keeping the remaining breeds shippable through the existing fallback path.

Consequences:

- `avatarTemplateAssets.ts` now registers shepherd accessory overlays plus a 10-state shepherd emote still pack.
- `app/portrait.tsx` prefers those real PNG layers for the hero preview and mood chips before it falls back to the older code-drawn shapes.
- `verify-pixellab-assets.js` and the mobile readiness suite now treat the first accessory and emote pack as required production assets.

Owner: Codex.

Revisit trigger: Retriever, Husky, Doodle, and the remaining template packs ship matching overlay/emote assets or move to full sprite-driven previews.

### 2026-06-20: Shared Board Controls Use A 48px Mobile Touch Target

Decision: Shared mobile board controls should use the exported `MIN_MOBILE_TOUCH_TARGET` contract from `mobileLayout.ts`, starting with board route icon buttons, compact pills, and care rows.

Reason: Native accessibility QA is still pending, so the in-code board system should not depend on route-local visual tweaks for tap safety. A shared 48px target keeps premium board controls usable on mobile while preserving the compact neo-retro pixel style.

Consequences:

- `BoardPrimitives.tsx` imports the shared touch target instead of using smaller local 40px/42px controls.
- Mobile layout tests lock the touch target value.
- Mobile readiness tests protect shared board controls from drifting below release-safe tap sizes before simulator/device accessibility traversal is available.

Owner: Codex.

Revisit trigger: Native accessibility QA, final Figma components, or platform-specific design guidance requires a different minimum target.

## Open Decisions For Apollo

- Final launch target: Expo preview, TestFlight, app store, web dashboard, or staged combination.
- Monetization model and paid tier boundaries.
- Production providers for auth, database, storage, AI, deployment, and mobile release.
- Whether Figma is the canonical visual design source.
- Privacy/legal requirements for storing dog medical records and AI-assisted health summaries.
