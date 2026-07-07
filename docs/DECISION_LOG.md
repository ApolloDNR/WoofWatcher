# WoofWatcher Decision Log

## Decision Format

Each decision should include:

- Date
- Decision
- Reason
- Owner
- Revisit trigger

## Decisions

### 2026-06-20: Incident Watch Follow-Ups Are Owner-Reviewed Guidance

Decision: Incident Watch may derive trend signals, owner follow-up tasks, and trainer goal suggestions from household-visible incident logs, but those outputs must route humans into review workflows instead of automatically creating behavior plans, medical claims, or trainer instructions.

Reason: Apollo wants WoofWatcher to feel sophisticated and operational, but incident/altercation context is sensitive. The app should help households organize facts, prepare trainer or vet handoffs, and keep follow-up visible without diagnosing behavior or pretending provider-backed trainer plans exist.

Owner: Codex.

Revisit trigger: Provider-backed trainer plans, role-aware behavior goals, professional review, or legal/safety policy introduces a stronger behavior workflow.

### 2026-06-19: Care Twin QA Captures Evidence But Does Not Certify Release

Decision: The development/internal `/care-twin-qa` route should collect session-level device evidence with Pass/Needs tune controls, per-state notes, summary counts, and a native shareable QA report, but it must not imply that iOS/Android QA is complete without screenshots and human review.

Reason: Apollo wants the living Phoenix room to feel like a polished video-game care twin. Static tests and web export prove the route and assets are wired, but only phone-size review can catch crop, scale, loop timing, touch-response, and gait issues. A shareable report makes the QA pass easier without overstating readiness.

Owner: Codex.

Revisit trigger: Native iOS/Android QA automation, visual regression, or a final game-scene renderer replaces the manual evidence workflow.

### 2026-06-18: Avatar Studio Uses Live Phoenix Motion Only Where Production Sprite Packs Exist

Decision: Avatar Studio should animate the shepherd/Phoenix template with the real Phoenix sprite rig, while templates that only have base stills remain on explicit still-preview labeling until their own sprite packs are produced.

Reason: The repo already contains a complete registered Phoenix sprite manifest, but only the shepherd/Phoenix template has matching production art coverage today. Reusing that live rig makes the canonical care twin feel more alive now without falsely implying that Retriever, Husky, Doodle, and the rest already have production animation packs.

Owner: Codex.

Revisit trigger: Additional breed-specific sprite packs ship, or a unified template animation renderer replaces the current Phoenix-only preview contract.

### 2026-06-17: PixelLab Is The Production Asset Pipeline For Phoenix

Decision: WoofWatcher will use PixelLab for the production Phoenix identity, transparent sprite strips, dogless rooms, template previews, and accessory packs. PixelLab secrets stay local or backend-only and must never be placed in the Expo app, PWA, GitHub, screenshots, or docs.

Reason: The app already has a tested care-twin state engine, sprite manifest, and layered runtime gate, but the missing piece is high-quality consistent pixel art. PixelLab's character and animation workflow matches the production need better than ad hoc generated portraits or hand-cropped placeholders.

Owner: Apollo and Codex.

Revisit trigger: PixelLab cannot produce a consistent approved Phoenix identity, generation cost becomes impractical, or Apollo selects a dedicated pixel artist/toolchain instead.

### 2026-06-18: Avatar Studio Uses The Living Room In Studio Presentation

Decision: Mobile Avatar Studio should use `LivingPhoenixRoom` with `presentation="studio"` as its primary hero instead of a static template portrait, old board hero image, or Home HUD clone.

Reason: Apollo wants the dog to feel alive like a video-game care twin, but the Studio screen cannot carry Home-specific status docks that clip or compete with the creator workflow. A dedicated Studio presentation keeps one animated Phoenix, preserves the premium neo-retro room feel, and avoids duplicate-avatar or pasted-on art.

Owner: Codex.

Revisit trigger: A final native game scene renderer, Figma design system, or PixelLab sprite-family pack replaces the current React Native room renderer.

### 2026-06-18: Subscription Seed Strips Stay In Review Until Phone-Size Approval

Decision: The PixelLab subscription-generated `pixellab-idle-south-strip.png` and `pixellab-walk-south-strip.png` are verified local seed strips, but they should not replace the current approved seated Home sprite family until Apollo approves their phone-size proportions, bottom-center anchor, and mockup fit.

Reason: Candidate D is useful as movement exploration, but Apollo's target boards favor a larger expressive Phoenix. Promoting a smaller directional strip too early could make the app feel less premium even if the file is technically valid.

Owner: Apollo and Codex.

Revisit trigger: Device preview confirms the seed strips look closer to boards 05/06 than the current seated v2 sprite family, or PixelLab produces a stronger large-body movement set.

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

Decision: Avatar Studio template art now has two registered tiers: `preview.png` thumbnails for compact pickers and `base.png` character stills for the larger creator preview stage. The first base tier now covers all 12 launch templates: Shepherd, Retriever, Husky, Bully, Doodle, Terrier, Hound, Dachshund, Spaniel, Toy, Slender, and Mixed Breed.

Reason: Enlarging 85x85 thumbnails makes Avatar Studio feel cheap and undermines the "real-life digital pet" promise. A separate 170x170 base tier gives the app a production-shaped character creator path while leaving room for emote stills, sprite strips, and accessory overlays under the same template folders.

Consequences:

- `avatarTemplateAssets.ts` registers `AVATAR_TEMPLATE_BASE_ASSETS` separately from `AVATAR_TEMPLATE_PREVIEW_ASSETS`.
- `/portrait` shows selected template base art and falls back safely for future unfinished templates.
- `verify-pixellab-assets.js` now checks all 12 template base PNGs.
- Launch templates still need emotes, sprites, and accessory overlays.

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

Decision: Avatar Studio should prefer file-backed template accessory overlays and emote stills whenever a template pack provides them, while preserving the existing shape-based fallback for templates that are still waiting on production art. Shepherd/Phoenix now has registered overlay and emote PNGs; Retriever, Husky/Spitz, and Bully now have registered 10-state template emote packs.

Reason: Apollo called out the wrong-dog problem directly: non-Phoenix avatars cannot feel like a real care twin if the Mood set quietly displays Phoenix. Registering those PNGs in `avatarTemplateAssets.ts` and enforcing them in the verifier lets the mobile preview show truthful PixelLab-backed art today while keeping the remaining breeds shippable through the existing fallback path.

Consequences:

- `avatarTemplateAssets.ts` now registers Shepherd accessory overlays plus Shepherd, Retriever, Husky/Spitz, and Bully emote still packs.
- `AvatarEmotePackId` now includes `retriever-starter`, `husky-starter`, and `bully-starter`; those templates recommend their matching packs.
- `app/portrait.tsx` prefers real PNG layers for the hero preview and mood chips before it falls back to the older code-drawn shapes or base stills.
- `verify-pixellab-assets.js` and the mobile readiness suite now treat the first overlay pack and all four live emote packs as required production assets.

Owner: Codex.

Revisit trigger: Doodle and the remaining template packs ship matching overlay/emote assets or move to full sprite-driven previews.

### 2026-06-19: Option B Is The Active Phoenix Runtime Family

Decision: Phoenix Home and the care-twin runtime should prefer the hard-pixel Option B candidate family for live motion states: idle/tail-wag, walk, ear-perk, eat, drink, corrected curled sleep, comfort/home-alone, health-watch, celebrate, and bark/tap reaction.

Reason: Apollo repeatedly rejected softer/non-pixel avatar reads and selected the Neo Retro Digital Pet Option B boards as the target. A single coherent hard-pixel family makes the app feel more like a video-game care twin and prevents the main dog from slipping between unrelated art directions.

Consequences:

- `careTwinAssets.ts` and `CARE_TWIN_SPRITE_MANIFEST` register Option B candidate strips for all current Phoenix live actions.
- The older v2 Phoenix still pack remains useful for profile/still surfaces and fallback/reference, but it is not the preferred live Home motion direction.
- The older south-facing subscription bark strip is archived as a fallback, while `option-b-bark-reaction-strip.png` is the active tap reaction.
- Native iOS/Android phone-size QA must review the full Option B family before promotion from `candidates/` to final approved production paths.

Owner: Codex.

Revisit trigger: Apollo rejects an Option B loop in phone-size QA, or a stronger artist/Figma/PixelLab production pack replaces the candidate family.

### 2026-06-19: Room Variants Must Stay Dogless Even When PixelLab Adds More Detail

Decision: The live care-twin stage may graduate PixelLab room variants only when the room is dogless, text-free, watermark-free, and keeps an open center area for the animated Phoenix layer. The 2026-06-19 pass accepted night, bedtime, health-watch, and home-alone final candidates.

Reason: WoofWatcher's game feel depends on one living care twin, not a baked background dog plus an animated dog. Apollo explicitly rejected duplicate/ugly secondary avatar behavior, so richer room art cannot break the layered runtime contract.

Consequences:

- `phoenix-room-night.png`, `phoenix-room-bedtime.png`, `phoenix-room-health-watch.png`, and `phoenix-room-home-alone.png` are now PixelLab final-candidate runtime layers.
- Future room generations should be rejected if they contain dogs, readable text, watermark-like marks, or a perspective that makes the sprite stage feel disconnected.

Owner: Codex.

Revisit trigger: Native phone-size QA shows room/sprite scale or stage cropping issues, or a stronger Figma/PixelLab final room set replaces these candidates.

### 2026-06-19: Logging Is Instant By Default, Detailed When Needed, And Correctable Afterward

Decision: WoofWatcher mobile logging uses tap for safe quick logs, long press for the detailed composer, and detail-required routing for medication and health/vomit-style logs. Meal logs use a served to outcome lifecycle. Potty remains the parent action, with pee/poop/accident/condition as outcomes or detail fields. Quick logs carry trust and confirmation metadata from creation.

Reason: Apollo locked the product rule that care logging must be effortless without becoming careless. A tap should handle the common safe action in under five seconds, but serious care moments need enough structure to support household trust, reports, vets, sitters, and later AI summaries.

Consequences:

- `quickLogEntry.ts` now owns the tested quick-log policy and default care-event shape.
- Home and Log quick actions both use the same builder so progress outputs, pending meal loops, Care IQ, reports, and records receive consistent data.
- Medication and health/vomit logs open the detailed composer instead of creating misleading one-tap proof.
- The Log detail sheet can update a pending meal outcome while preserving audit history.
- Future UI polish must not reintroduce Pee/Poo as top-level launcher actions; they are Potty outcomes.

Owner: Codex.

Revisit trigger: The full structured edit sheet, photo proof, voice/talk-to-log, or cloud role permissions introduce a stronger event contract that still preserves this doctrine.

### 2026-06-19: Alone Time Is A Start/Return Lifecycle, Not A Static Duration Log

Decision: Alone Time in WoofWatcher is modeled as an open household status session. Leaving Home starts an active `home-alone` log. I'm Home closes that same log with duration, return outcome, recovery/note details, returned-by metadata, and an audit trail.

Reason: Apollo's vision depends on WoofWatcher answering "Where is Phoenix and is she alone?" in seconds. A static duration log cannot support live presence, household trust, care-twin home-alone behavior, sitter handoffs, or anxiety pattern review. The app needs a real open loop.

Consequences:

- `aloneTimeSession.ts` owns the start/find/return lifecycle contract.
- Log's Alone Time quick action starts the active session when none exists and shows a return check-in when one is open.
- Home reads the same open session and displays Phoenix as home alone instead of assuming a caregiver is present.
- Completed sessions continue to feed the existing Alone Time analytics in Records and Care Passes.
- Future Household Pulse and notification work should reuse this lifecycle instead of creating separate presence state.

Owner: Codex.

Revisit trigger: Cloud sync/presence permissions introduce server-backed household presence, but the user-facing session still needs start/return auditability.

### 2026-06-19: Care Log Trust Review Is Owner-Confirmed, Not Hidden Mutation

Decision: Care log trust state must be reviewed through explicit owner-facing actions: Confirm, Reject, Request photo, and Mark corrected. These actions update the existing log with trust/proof metadata and append audit history instead of deleting, overwriting, or silently hiding the original record.

Reason: Apollo wants logging to stay effortless, but household members still need to trust medication, kid, sitter, trainer, health, and report-driving records. A serious care app needs visible confirmation and correction loops without turning every quick log into paperwork.

Consequences:

- `careLogTrust.ts` owns the tested role-aware trust review contract.
- Adult Admin, Adult, Owner, and Primary caregiver roles can review care-log trust state.
- Kid, Sitter, Trainer, and Vet Viewer roles can create or view allowed care logs but cannot confirm/reject/correct trust state in this slice.
- Request photo records a proof-request status only; it does not claim that camera/upload proof exists yet.
- Rejected logs stay in history with watch severity so later reports can explain the correction instead of losing context.
- The Log detail sheet presents trust state as a panel and omits raw trust/proof fields from generic detail rows.

Owner: Codex.

Revisit trigger: Server-backed household roles, real photo uploads, medication proof policies, or caregiver Access Pass permissions require stricter role enforcement.

### 2026-06-19: Detailed Logs Share The Same Trust Contract As Quick Logs

Decision: Long-press/detail-sheet logs must use the same trust default engine as quick logs before they enter the timeline. Medication detail logs start pending confirmation with proof-needed metadata, safety-critical health logs start pending review, and kid/helper detail logs stay owner-reviewable even for care types that are normally casual.

Reason: The user can create the same real care event through a quick tap, a long press, Home, or the Log composer. Those paths should not create different levels of household trust, proof expectation, or report evidence just because one path asked for more detail.

Consequences:

- `careLogTrust.ts` owns shared trust defaults and timeline attention chip derivation.
- The detailed Log composer now adds trust metadata before append/audit work, matching the quick-log doctrine.
- Medication proof remains a truthful placeholder state until camera/upload storage is implemented.
- Timeline rows show unresolved care loops before opening the detail sheet: needs review, proof needed, photo requested, outcome pending, rejected, corrected, and estimated.
- Future visual polish should preserve attention chips as an owner-facing operational surface, not hide them inside metadata.

Owner: Codex.

Revisit trigger: Server-backed roles, real attachments, medication proof policy, or talk-to-log command parsing introduce a stronger event creation pipeline that still preserves consistent trust defaults.

### 2026-06-19: Medication Proof Can Be Attached Locally, But Does Not Confirm Care

Decision: Medication proof attachment is a local evidence seam, not an approval action. A caregiver can attach a proof photo URI to a medication log, but the log remains pending adult confirmation until an owner explicitly reviews it. The UI must label this as local-only until provider-backed storage is approved and implemented.

Reason: Medication is a high-trust household workflow. Photo evidence helps owners verify what happened, but a local image URI is not durable cloud proof, not cross-device storage, and not a substitute for owner review.

Consequences:

- `careLogTrust.ts` owns the proof attachment patch and audit event.
- Attached proof records URI/name/source, attached-by/at, local-only storage status, and a proof-attached timeline chip.
- The Log detail sheet can attach proof through Expo ImagePicker and shows the storage boundary in the Trust review panel.
- Proof attachment does not clear `confirmationRequired`; Confirm/Reject/Mark corrected remain explicit owner actions.
- Future Supabase/storage work should replace the local URI with durable storage metadata without changing the owner-facing trust contract.

Owner: Codex.

Revisit trigger: Provider-backed file storage, medication proof policy, Access Pass permissions, or Care Pass report attachments become production scope.

### 2026-06-19: Potty Quick Logs Stay Fast, Detail Corrections Stay Traceable

Decision: Potty remains a parent event. A quick tap can log a fast potty attempt, and the Log detail sheet can later clarify outcome, location, pee detail, stool consistency/color, and context. Corrections must rewrite stale pee/stool fields and append audit history instead of layering conflicting metadata onto the same log.

Reason: Real care is messy. Someone may only know that Phoenix went outside now, then later clarify pee, poop, both, an accident, or tried-nothing. The app should support that reality without forcing a full form every time or polluting Records with stale stool/pee detail.

Consequences:

- `pottyLogDetail.ts` owns the tested parent-outcome correction helper and option vocabulary.
- The mobile Log detail sheet has a Clarify potty log panel for outcome/location/pee/stool/context updates.
- Records Potty Health can trust updated fields because stale pee/stool metadata is removed when the outcome changes.
- Audit history explains who corrected the potty detail and when.
- The copy remains observational and non-diagnostic.

Owner: Codex.

Revisit trigger: Walk-session editing, voice-to-log parsing, or provider-backed audit/sync rules introduce a more general structured log detail engine.

### 2026-06-19: Walks Can Be Live Sessions, Not Only Past Logs

Decision: Walk quick actions can start an active household-visible walk session. Home and Log should show that open session until a caregiver finishes it, and finishing should update the same log with duration, route/place, distance, dog interactions, social outcome, note, and audit history.

Reason: Real walks are often started before the household knows duration, distance, route, or dog exposure. Treating every tap as a completed past event makes the care record feel fake and makes later Records/Care Pass outputs less trustworthy.

Consequences:

- `walkSession.ts` owns the tested start/find/finish lifecycle helper.
- Home uses the helper for the Walk quick action and shows Walk active in the room, presence strip, and Next Up.
- Log renders a WALK ACTIVE finish panel with validated distance/dog-interaction fields.
- Completing the walk records one shared source event for Walk Activity, Saved Routes, Care Passes, and audit history.
- GPS/location tracking remains out of scope for this version; route/place is owner-entered.

Owner: Codex.

Revisit trigger: GPS session tracking, background timers, Apple/Google Health integrations, or walker/sitter proof policies become production scope.

### 2026-06-19: Correction History Is Traceability, Not Blame

Decision: Log details should show a Correction history summary before the raw Audit trail. The summary should surface latest update, correction count, and changed-field chips while keeping the complete audit rows available below.

Reason: Household care logs are edited because real care is messy, not because someone did something wrong. Owners need enough trust to understand what changed without making normal corrections feel punitive.

Consequences:

- Log details show a Correction history card when audit events exist.
- Logs with no later audit events say they are original instead of implying missing data.
- The full audit trail remains available for handoffs, sitter/trainer review, and safety-critical logs.
- Future design polish should keep correction language calm and operational.

Owner: Codex.

Revisit trigger: Server-backed audit policies, Access Pass review, legal export requirements, or provider-backed attachment history require a stricter audit presentation.

### 2026-06-19: CareTwin Roster Can Stage Future Dogs, But Switching Is Provider-Gated

Decision: The mobile app may persist planned future dogs in a local CareTwin roster, but only the primary dog is treated as the live care twin until provider-backed multi-dog care documents exist. Future dogs must be shown as provider-gated planned slots, not as selectable pets with shared Phoenix logs.

Reason: WoofWatcher's long-term platform needs multiple dogs, but pretending to switch pets without separate logs, routines, records, reports, avatar state, permissions, and privacy export would corrupt trust. Staging the roster is useful; fake switching is not.

Consequences:

- `CareContext` now carries `activePetId` and `pets`.
- `careTwinRoster.ts` owns the tested live-versus-provider-gated roster model.
- More shows CareTwin Roster with Add future dog and locked planned slots.
- Owner data export and deletion request scope include staged pet roster data.
- True switching remains blocked until provider-backed multi-dog care document scoping is approved and implemented.

Owner: Codex.

Revisit trigger: Apollo approves production account/storage/database rules for multi-dog care documents, or the API schema grows first-class per-dog scoping.

### 2026-06-19: Access Pass Drafts Are Local Until Provider Enforcement Exists

Decision: WoofWatcher can stage Access Pass drafts for sitters, trainers, vet viewers, emergency helpers, and temporary helpers, but remote access, revocation, and role enforcement remain provider-gated.

Reason: Access Pass is permission to help, while Care Pass is a shareable report. Treating a local draft as real remote authorization would create a privacy and safety risk for household records, medication logs, and dog health data.

Consequences:

- `access-pass.ts` owns tested Access Pass permission defaults, blocked actions, active/upcoming/draft status, and My Care Today assigned-care derivation.
- Mobile More can create and share a local Access Pass draft summary while explicitly saying provider-backed sharing is not live.
- `CareContext` persists `accessPasses` locally/shared in the care document for future provider enforcement.
- Privacy export and deletion request scope include Access Pass drafts.
- Provider-backed Access Pass enforcement still requires account roles, API authorization, revocation, helper audit trails, and storage/provider rules.

Owner: Codex.

Revisit trigger: Apollo approves provider-backed household roles, helper invites, storage rules, or role-specific API authorization.

### 2026-06-19: Adventure Mode Is Private Real-Care Memory, Not Public AR

Decision: Adventure Mode can derive private quests, XP, levels, proof, and local memory drafts from household-visible care logs, but it must not claim public AR, GPS tracking, map storage, cloud photo storage, community discovery, or live sharing until those provider and safety rules exist.

Reason: The product vision needs the dog-care RPG magic, but the real pet comes first. A private care-memory loop is useful now; pretending to have location safety, cloud media, public sharing, or community moderation would create privacy and trust risk.

Consequences:

- `adventure.ts` owns the tested local quest, XP, proof, and memory-draft derivation model.
- Mobile More links to `/adventure` as a real screen, not a placeholder.
- `CareContext` persists `adventureMemories` as local/private care evidence.
- Owner export and deletion-request scope include Adventure memories.
- Provider-backed media, maps/location retention, share links, and community discovery remain blocked until Apollo approves storage, privacy, and safety scope.

Owner: Codex.

Revisit trigger: Apollo approves provider-backed media storage, location/map retention policy, share-link permissions, or a moderated community-adventure product.

### 2026-06-20: In-App Mobile QA Evidence Does Not Equal Launch Approval

Decision: WoofWatcher may use the internal `/care-twin-qa` route as a Mobile Release QA cockpit for Phoenix Home, Care Twin State Lab, Avatar Studio, Incident Composer, Records Incident Watch, Trainer Care Pass, and the 12-state care-twin animation matrix. The route can collect Pass/Needs tune status, device notes, and a native share report, but it must keep attached iOS/Android screenshots and human review as required before release approval.

Reason: The Windows automation worktree can prove wiring, tests, static route coverage, and share-report contracts, but it cannot prove native phone-size crop, safe areas, touch response, keyboard overlap, animation taste, or App Store-quality visual polish. Treating in-app checkboxes as launch proof would create false confidence.

Consequences:

- `mobileReleaseQa.ts` owns the tested launch workflow checklist and share-report contract.
- `/care-twin-qa` combines the Mobile Release QA checklist with the existing care-twin state matrix.
- `mobileQaSession.ts` may persist the internal QA session locally so testers can leave the route, inspect target screens, return, and keep Pass/Needs tune status plus notes without claiming provider-backed QA storage.
- The next native QA pass should complete both sections, attach screenshots, and fix the first visible issue before claiming release confidence.
- Future release docs must distinguish local/static verification from simulator/device evidence.

Owner: Codex.

Revisit trigger: The project gains reliable automated native screenshot capture, simulator access, or App Store/Play release automation that can produce equivalent visual proof.

### 2026-06-20: Care Twin Taps Must Be State-Aware

Decision: Phoenix room taps should use a choreography model derived from the current care-twin state instead of always triggering a bark. Happy/steady states can use the playful bark reaction, rest states should use a soft check-in, and Health Watch should use a calm comfort response.

Reason: The care twin needs to feel like a living game character, not a generic button. A dog that is sleeping, low-energy, or on Health Watch should not be forced into the same high-energy tap reaction as a happy idle state.

Consequences:

- `careTwinChoreography.ts` owns the tested primary loop, ambient micro-loop, tap reaction, reaction timing, and QA summary model.
- Home derives room tap reactions from the choreography model.
- `LivingPhoenixRoom` uses the same choreography model for ambient and reaction timing.
- `/care-twin-qa` exposes a Motion recipe for each state so native reviewers can judge the intended behavior alongside crop, scale, and loop quality.
- Native iOS/Android QA remains required before claiming the animation taste is launch-approved.

Owner: Codex.

Revisit trigger: Rive, Lottie, Reanimated, or a future game-runtime layer replaces sprite-strip playback with a richer animation graph.

### 2026-06-20: Native QA Screenshots Stay Local Until Provider Storage Is Approved

Decision: `/care-twin-qa` may attach local screenshot evidence from the device photo library to release surfaces and care-twin states, persist that evidence in the local QA session, and include screenshot file names in the share report. It must not imply provider-backed screenshot storage, remote QA review, or launch approval.

Reason: Native screenshots are necessary for judging App Store-quality crop, safe areas, touch response, keyboard fit, and animation taste. Local evidence capture makes device review more organized, but storing screenshots as production QA records requires approved storage/provider rules and privacy handling.

Consequences:

- `qaScreenshotEvidence.ts` owns sanitized local screenshot metadata.
- `mobileQaSession.ts` persists release-surface and care-twin state evidence locally with the rest of the QA session.
- `mobileReleaseQa.ts` and `careTwinQaReport.ts` count attached screenshots and list file names in share text.
- `/care-twin-qa` exposes Attach screenshot and Clear controls for each release surface and each care-twin scenario.
- Real iOS/Android human screenshot review remains required before release confidence.
- Provider-backed QA media storage remains blocked until Apollo approves storage rules.

Owner: Codex.

Revisit trigger: Apollo approves provider-backed media/document storage for QA evidence, or the project gains reliable automated native screenshot capture.

### 2026-06-20: Native QA Evidence Must Distinguish iOS From Android

Decision: local QA screenshot evidence must track the runtime platform. iOS screenshots can satisfy iOS evidence slots, Android screenshots can satisfy Android evidence slots, and web/unknown screenshots can remain visible without satisfying native release proof.

Reason: A mobile-first app can pass on one platform and still have safe-area, keyboard, crop, or animation issues on the other. Counting generic screenshots would let one-platform evidence create false release confidence.

Consequences:

- `qaScreenshotEvidence.ts` stores `targetPlatform` and labels screenshot file names with iOS, Android, Web, or Unknown platform.
- `mobileReleaseQa.ts` tracks required and attached iOS, Android, and general screenshot slots separately.
- `/care-twin-qa` tags new attachments from the current runtime platform and shows iOS/Android evidence counts in the cockpit header.
- Share reports list platform labels beside screenshot filenames.
- Native release confidence still requires both iOS and Android evidence plus human review.

Owner: Codex.

Revisit trigger: automated native screenshot capture or provider-backed QA evidence storage introduces a stronger platform/source-of-truth model.

### 2026-06-20: Native QA Proof Requires All Evidence Classes

Decision: Mobile Release QA proof is complete only when required iOS slots, required Android slots, and flexible/general screenshot slots are all satisfied. The cockpit may display total attached files, but completion color/copy must come from the tested platform-proof helper instead of a generic screenshot count.

Reason: Some launch evidence is platform-specific and some is flexible, such as a shared report screenshot. A total file count can look impressive while still missing every Android capture, so the app must show the exact gap before release review.

Consequences:

- `mobileReleaseQa.ts` owns helper functions for complete platform proof, flexible slot satisfaction, platform evidence labels, and missing evidence copy.
- `/care-twin-qa` shows Native proof open/ready plus exact iOS/Android/flexible evidence status.
- Static readiness tests reject the older aggregate screenshot-badge completion pattern.
- Real native QA still requires device/simulator screenshots and human visual review.

Owner: Codex.

Revisit trigger: release QA moves to an external provider-backed evidence system or automated native screenshot capture creates a stronger per-platform proof source.

### 2026-06-20: Floating Paw Tab Clearance Is A Shared Layout Contract

Decision: mobile tab bar geometry, center paw positioning, and tabbed route bottom padding should be derived from a shared layout helper instead of hard-coded separately in each route.

Reason: WoofWatcher is mobile-first, and fixed per-screen bottom padding can quietly drift as the floating paw navigation, safe-area insets, or web/native tab sizes change. A shared helper makes iOS, Android, and web clearance predictable before native QA.

Consequences:

- `mobileLayout.ts` owns floating tab chrome metrics plus tabbed and standalone bottom-padding helpers.
- The tab shell uses shared metrics for tab bar height/bottom/radius/insets and center paw bottom position.
- Home, Log, Plans, Health, More, and Records use `getTabbedRouteBottomPadding`.
- Mobile readiness tests reject fixed `128`, `130`, or `142` tab clearance values on tabbed routes.
- Native iOS/Android QA still has to judge real visual fit, but the route-level spacing contract is now test-protected.

Owner: Codex.

Revisit trigger: the mobile navigation design changes, the center paw is removed, or Expo/native safe-area handling changes enough to require new tab geometry.

### 2026-06-20: Standalone Mobile Screens Share The Same Safe-Area Contract

Decision: standalone routes, auth/setup screens, and docked bottom composers should use `mobileLayout.ts` helpers instead of route-local bottom-padding constants.

Reason: WoofWatcher is primarily an iOS/Android app, and the non-tab screens are part of the launch-critical path: Avatar Studio, Adventure, Care Twin QA, Premium, Privacy, Setup, auth, and WoofGuide. If those screens hand-roll bottom insets, the app can look polished on Home while still clipping buttons, input bars, or proof controls elsewhere.

Consequences:

- `mobileLayout.ts` now exports `getDockedComposerBottomPadding` alongside the existing tabbed and standalone helpers.
- Adventure, Avatar Studio, Care Twin QA, Premium, Privacy, Setup, and `AuthShell` use `getStandaloneRouteBottomPadding`.
- WoofGuide uses `getDockedComposerBottomPadding` for the bottom input composer.
- Mobile readiness tests reject the older standalone magic numbers and local composer inset.
- Real iOS/Android QA still has to judge keyboard behavior, bottom reach, scroll length, and visual fit.

Owner: Codex.

Revisit trigger: a native keyboard avoidance layer, new modal sheet system, or app-shell redesign changes how standalone routes and bottom composers reserve safe-area space.

### 2026-06-20: First-Run Household Setup Can Stage Intent Before Provider Invites

Decision: the setup wizard may capture and persist Create household, Join by invite, or Local preview intent before provider-backed household creation and invite acceptance are live, as long as the UI truthfully labels the state and blocks incomplete join drafts.

Reason: WoofWatcher's launch flow needs a real household decision early, but fake cloud invites would damage trust. A local household setup object lets the app collect the right owner intent, include it in privacy export, and guide the next account step without claiming remote sync or membership enforcement.

Consequences:

- `setupWizard.ts` persists `householdSetup` with mode, household name, optional invite code, provider status, and update time.
- Setup UI shows Create household, Join by invite, and Local preview options.
- Join-by-invite setup requires an invite code before save.
- Confirmation copy distinguishes local-only, account-needed, and provider-ready states.
- Privacy export includes household setup metadata.
- Provider-backed household creation, invite acceptance, role enforcement, and revocation remain separate production work.

Owner: Codex.

Revisit trigger: Clerk/Supabase household provisioning and invite acceptance become live, or Apollo changes the launch account model.

### 2026-06-21: Mobile Interaction Geometry Is A Shared Contract

Decision: route top padding, modal sheet bottom padding, centered modal padding,
keyboard avoiding offsets, and mobile touch target constants belong in
`mobileLayout.ts`, not in individual route files.

Reason: WoofWatcher is primarily an iOS/Android app. The premium product can
look good in a browser but still feel unfinished on a phone if each screen
hand-rolls notch clearance, keyboard offsets, modal reach, and small inline tap
areas. A shared contract makes Home, Log, Plans, Health, More, Records,
standalone tools, auth/setup, WoofGuide, and fallback recovery behave like one
app before native QA.

Consequences:

- `mobileLayout.ts` owns top safe-area padding for tabbed, standalone, setup,
  and auth surfaces.
- `mobileLayout.ts` owns modal sheet bottom padding, centered modal backdrop
  padding, keyboard avoiding offsets, floating feedback/debug offsets, minimum
  touch target size, and inline hit slop.
- Launch-critical route files call the shared helpers instead of route-local
  formulas.
- Mobile readiness tests reject hard-coded top safe-area formulas, unsafe modal
  bottom padding, and literal 8/10 hit slop.
- Real iOS/Android QA still has to judge the visual result on device and feed
  the next tuning pass.

Owner: Codex.

Revisit trigger: the app adopts a native sheet/navigation library, changes the
floating paw navigation, or real device QA proves the shared constants need
surface-specific tuning.

### 2026-06-23: Access Pass Mutations Return Audit Metadata Before Durable Audit Storage

Decision: provider-backed household helper work can expose owner/admin Access Pass activation and revocation routes now, but those routes return response-level `HouseholdAuditEvent` metadata instead of pretending durable provider audit storage exists.

Reason: WoofWatcher needs a trustworthy household-sharing contract before launch. Owners should be able to assign sitter, trainer, walker, and vet-viewer helper roles through typed API operations, and clients need audit metadata to show what happened. Durable account-action audit storage still needs database/provider approval and retention rules.

Consequences:

- Join-by-invite returns an invitation-accepted audit event and stores the canonical adult caregiver role.
- Access Pass activation/revocation are owner/admin-only, active-household scoped, and limited to helper-compatible roles.
- Generated OpenAPI, Zod, and React client contracts expose the audit-aware responses.
- Durable audit storage, expiry enforcement, invite approval lifecycle states, and account-action retention remain separate provider-launch work.

Owner: Codex.

Revisit trigger: Supabase/Postgres provider rules, invite lifecycle storage, Access Pass expiry, or account-action audit retention become approved implementation work.

### 2026-06-24: Household Audit Rows Can Be Provider-Durable Before Full Invite Workflow

Decision: household invite acceptance, member role changes, member revocation, and Access Pass activation/revocation may now write provider-durable audit rows through the `household_audit_events` schema, while full invite approval workflow, audit review APIs, scheduled expiry cleanup, provider RLS, retention, export, and deletion policy remain launch gates.

Reason: WoofWatcher's household trust layer should not rely on response-only metadata once helper role mutations exist. Persisting account-action evidence makes Access Passes, sitter/trainer/vet-viewer changes, and future owner review flows safer, but it would be dishonest to claim production audit compliance before provider migration and policy approvals are complete.

Consequences:

- `household_audit_events` stores action, lifecycle state, actor, target member/user, role transition, note/reason, expiry metadata, created time, and provider/export metadata.
- Household join/update/revoke and Access Pass activation/revocation routes insert durable audit rows before returning typed audit responses.
- Access Pass activation rejects invalid or past expiration values before helper access changes.
- OpenAPI, Zod, and React generated schemas expose provider-durable audit storage plus lifecycle states.
- Production still needs migrations, RLS/provider access rules, audit review APIs, scheduled expiry cleanup, retention/export/deletion policy, and legal/privacy review.

Owner: Codex.

Revisit trigger: provider migrations/RLS are approved, audit review APIs are built, or Access Pass expiry cleanup moves from readiness into production enforcement.

### 2026-06-24: Household Audit Review Is Owner/Admin Only Before Fine-Grained Admin Roles

Decision: durable household audit rows can now be listed through `GET /household/audit-events`, but the review API stays authenticated, active-household scoped, and owner/admin-only until provider RLS, retention, export/deletion policy, and finer-grained admin roles are approved.

Reason: WoofWatcher needs an owner trust surface for invite acceptance, role changes, revocations, and Access Pass helper activity before launch. Exposing those rows too broadly would weaken household privacy and could leak caregiver or helper access history to roles that should not see account-action evidence.

Consequences:

- The API returns newest-first durable audit rows with safe `limit`, `action`, and `lifecycleState` filters.
- OpenAPI, Zod validators, React schemas/hooks, and generated type files expose the audit review response and filters.
- Non-owner roles receive a typed `403` error until a finer provider-backed admin permission model exists.
- Provider migration, RLS, scheduled expiry cleanup, retention/export/deletion policy, and legal/privacy approval remain separate launch gates.

Owner: Codex.

Revisit trigger: provider RLS is approved, household admin roles become distinct from owner, or audit review needs role-specific views for sitters, trainers, or vet viewers.

### 2026-06-24: Access Pass Expiry Is Enforced At Request Time Before Cleanup Jobs

Decision: expired Access Pass helper memberships must lose write authority during request-time authorization even before scheduled cleanup jobs, provider migrations, RLS, or owner-facing cleanup UI exist.

Reason: temporary helper access is a trust boundary. A sitter, trainer, walker, or vet-viewer pass that has passed its expiry should not continue satisfying write authorization just because a cleanup task has not run yet. Request-time enforcement gives the API a safer default while still letting `/me` show the original helper role plus expiry metadata so the UI can explain what happened.

Consequences:

- Household member rows carry `accessPassExpiresAt`.
- Access Pass activation persists the valid future expiry window on the helper membership.
- Helper roles with expired pass windows resolve to `expired access pass` inside authorization.
- Care-entry writes treat `expired access pass` as read-only.
- `/me` exposes `accessPassExpiresAt` and `accessPassExpired` without hiding the member's display role.
- Scheduled cleanup, provider migration/RLS, retention/export/deletion policy, and legal/privacy approval remain separate launch gates.

Owner: Codex.

Revisit trigger: provider migrations/RLS are approved, scheduled cleanup is added, or the UI needs owner/admin controls for expired helper memberships.

### 2026-06-24: Household Invitations Are Durable Lifecycle Rows Before Provider Delivery

Decision: household invitations now live as durable lifecycle rows with owner/admin list/create/revoke APIs, and `/household/join` must prefer those rows over the legacy household invite code whenever a durable invitation exists.

Reason: shared household care and temporary helper access cannot rely on one static invite code once WoofWatcher supports roles, approval windows, Access Passes, audit review, and future provider-backed delivery. A durable invitation record lets the product distinguish pending approval, approved, accepted, revoked, expired, and rejected invitations while keeping legacy local-preview joins available until provider setup is complete.

Consequences:

- `household_invitations` stores invite code, household, invited email/user, canonical role, lifecycle state, actor ids, lifecycle timestamps, expiry, notes, and provider metadata.
- Owner/admin invite list/create/revoke APIs are authenticated and active-household scoped.
- `/household/join` blocks pending, revoked, expired, rejected, and already accepted durable invitations, applies the invitation role on acceptance, and marks accepted invites.
- Invite creation and revocation emit durable audit events through the existing household audit trail.
- Production still needs Supabase migration/RLS, notification/email delivery, invite UI polish, scheduled expiry cleanup, retention/export/deletion policy, and legal/privacy approval.

Owner: Codex.

Revisit trigger: provider migrations/RLS are approved, invite delivery is implemented, or invite approval/rejection needs fine-grained UI.

### 2026-06-24: Household Sharing Cleanup Review Is Read-Only Before Apply Cleanup

Decision: expired household invitations and expired Access Pass helper memberships can be reviewed through owner/admin-only `GET /household/sharing-cleanup`, but cleanup remains read-only until owner approval, provider RLS/migrations, retention/export/deletion policy, and legal/privacy rules are approved.

Reason: expired sharing objects are trust risks, but automatically deleting rows or revoking helper access without an owner-visible review/apply model would be destructive. A read-only packet lets the mobile app show what needs attention while preserving request-time authorization safety.

Consequences:

- `household-sharing-cleanup.ts` derives review-only stale candidates from runtime-expired invitation rows and expired Access Pass helper memberships.
- The route is authenticated, active-household scoped, owner/admin-only, query-validated, and generated-client typed.
- Cleanup candidates expose `review-only` storage and recommended actions instead of mutating data.
- Future cleanup apply, scheduled jobs, Supabase migration/RLS, retention/export/deletion, notification delivery, and legal/privacy approval remain launch gates.

Owner: Codex.

Revisit trigger: owner-approved cleanup apply is designed, provider migrations/RLS are approved, or expired invite/helper cleanup needs a scheduled job.

### 2026-06-28: Port Main-Line Mood/Energy Logic Instead Of Broad-Merging The Premium Branch

Decision: after fetching the latest `origin/main`, the automation branch should not broad-merge main for this slice. The full merge was attempted, produced conflicts across API, mobile routes, generated clients, binary avatar assets, and docs, then was aborted. The accepted approach is to port the highest-impact mood/energy care logic surgically into the premium branch.

Reason: this automation branch contains richer premium UI, care-twin QA, provider-readiness, and release-handoff work. A mechanical merge would risk losing or flattening those product lines. Mood/energy logging is still valuable for launch because it connects Quick Log, Records, Phoenix's care twin, and future WoofGuide summaries, so it should be brought in deliberately through shared care-domain logic.

Consequences:

- `deriveMoodTrend` lives in `lib/care-domain` and becomes the source formula for shared mood/energy trends.
- Quick Log Mood captures mood, energy level, household visibility, care context, and optional sticky notes.
- Records Mood Trend uses the shared formula for average score, steady/watch status, energy mix, latest context, and next-step copy.
- Main-line reconciliation should continue as explicit, test-backed ports until the branch can be safely merged or replaced.

Owner: Codex.

Revisit trigger: the premium branch is ready for a dedicated conflict-resolution merge window, or main contains another high-impact care logic change that should be ported intentionally.

### 2026-07-04: Care Pass Report Storage Requires Structured Proof

Decision: Care Pass report artifact storage cannot treat configured/provider-approved storage setup as upload readiness. Saved printable HTML reports must stay `Saved locally` until `CarePassStorageProviderEvidence` proves buckets, signed upload/download, household scope, retention/export/deletion, QA evidence storage, approval owner, and approval booleans.

Reason: Report History is an owner handoff surface. If a saved report says `Ready to upload` from setup booleans alone, it contradicts the shared attachment storage guard and can imply cloud durability before any real storage proof exists.

Consequences:

- `describeCarePassArtifactStorage` accepts `storageProviderEvidence` and calls `isCarePassStorageProviderProofReady`.
- Provider storage setup without structured proof stays local and explains the missing proof requirements.
- Real storage buckets, signed policies, native share/reopen evidence, store review, public launch, and Apollo sign-off remain separate blockers.

Owner: Codex.

Revisit trigger: Apollo attaches real provider storage proof files or the app gains a provider-backed proof evidence service that can feed Report History.

### 2026-07-03: Payments Checkout Requires Focused Provider Proof Before Money Movement

Decision: WoofWatcher Plus payments get a focused `/care-twin-qa?qaSurface=payments-provider-proof` mission and a Provider Launch Setup shortcut before any checkout, entitlement enforcement, or money movement can be enabled.

Reason: paid checkout is a launch-critical trust boundary. Local preview state, static plan copy, or owner-staged provider rows must not be treated as a real paid subscription. Helpers need one concrete mission for product ids, billing path, sandbox receipts, restore purchases, entitlements, refund/support policy, and Apollo approval before the payments gate can close.

Consequences:

- More's Plus payments provider row opens the focused payments proof mission.
- Mobile Release QA, Share Beta Handoff, Release Smoke Checklist, live-preview proof, JSON mobile beta doctor, and native QA tooling doctor all name the same route.
- The proof target requires Plus and Family product ids, billing path decision, sandbox purchase, renewal, cancel, refund, expired receipt, restore purchases, entitlement mapping, household role access, refund/support policy, and checkout-gate evidence.
- Paid checkout, Stripe or store purchase flows, active paid entitlements, subscription enforcement, and public launch remain blocked until real provider proof and Apollo approval exist.

Owner: Codex.

Revisit trigger: Apollo approves the billing path, App Store/Google Play/Stripe provider credentials are available, or sandbox receipt evidence is ready to attach.

### 2026-07-04: Payments Receipt Proof Must Be Store-Specific

Decision: WoofWatcher Plus checkout cannot move from blocked to reviewable from generic payment approval flags. The payments proof manifest must require separate iOS App Store and Android Google Play sandbox receipt evidence, with platform/store naming, JSON MIME, byte size, product id, transaction id, purchase, renewal, cancellation, refund, expiration, and restore proof.

Reason: billing is a money and trust boundary. A helper note that says receipts are approved is not enough to prove App Store or Google Play purchase and restore behavior, and it would let local preview state look too close to a real paid subscription.

Consequences:

- The Sandbox receipts, Entitlements and restore, and Checkout gate rows stay blocked until both platform/store receipt proofs are attached.
- Share Beta Handoff, Release Smoke Checklist, native QA tooling doctor, JSON mobile beta doctor, and Payments Provider Proof QA copy all name the store-specific evidence shape.
- Paid checkout, active paid entitlements, App Store/Google Play purchase flows, refund/tax obligations, store approval, public launch, and Apollo checkout sign-off remain blocked.

Owner: Codex.

Revisit trigger: Apollo approves the billing path and real App Store/Google Play sandbox receipt evidence is available for attachment.

### 2026-07-04: Records Native File Proof Requires Device Evidence Before Approval

Decision: the focused Records local-file mission gets a source-backed proof manifest, but `Native file proof allowed` remains `No` until Care Pass local HTML, Dog ID local HTML, Dog ID SVG, native share-sheet behavior, Android content URI or saved-file proof, fallback copy, and generated PDF/PNG/provider boundary evidence are attached from real device QA.

Reason: Records can already create local HTML/SVG sources, and generated PDF/PNG bytes exist as separate local artifacts, but helpers need one explicit checklist that prevents local source availability from being mistaken for native file proof, provider-backed storage, cloud sync, or export readiness.

Consequences:

- `/care-twin-qa?qaSurface=records-local-file-handoff` renders the Records local file handoff proof manifest before Evidence Capture.
- The JSON mobile beta doctor guards that the manifest remains source-backed.
- Real iOS/Android share-sheet evidence, Android content URI or saved-file proof, fallback-copy proof, native share/reopen evidence for generated binaries, structured provider storage proof, and Apollo sign-off remain launch gates.

Owner: Codex.

Revisit trigger: native Records file proof is attached, provider-backed records storage is configured, or generated PDF/PNG export readiness is ready for approval.

### 2026-07-04: Records Native File Proof Must Be Platform And File Specific

Decision: the Records local-file handoff proof manifest cannot treat generic native share-sheet notes as native file proof. Native Records file proof requires six concrete local-file slots: iOS Care Pass local HTML, Android Care Pass local HTML, iOS Dog ID local HTML, Android Dog ID local HTML, iOS Dog ID SVG image source, and Android Dog ID SVG image source.

Reason: Care Pass HTML, Dog ID HTML, and Dog ID SVG can each fail differently across iOS and Android share/open paths. A broad "iOS and Android share sheets opened" note could hide missing file names, MIME, byte size, platform path, or Android URI evidence.

Consequences:

- Each native Records file proof slot must include platform/file naming in the file name or URI, MIME, positive byte size, share proof, and reopen proof.
- Android content URI or saved-file proof remains blocked until the Android Care Pass HTML, Dog ID HTML, and Dog ID SVG slots include `content://` or `file://` URI evidence.
- Fallback copy, generated PDF/PNG proof, provider storage, cloud sync, public launch, and Apollo sign-off remain separate gates.

Owner: Codex.

Revisit trigger: real iOS/Android Records file evidence is attached from configured native tooling or physical devices.

### 2026-07-04: Auth Setup Native Proof Must Be Platform And Surface Specific

Decision: the Auth/Setup proof manifest cannot treat generic native screen approval flags as native Auth/Setup proof. Native Auth/Setup proof requires four concrete screenshot slots: iOS Auth gateway, Android Auth gateway, iOS Setup local-preview, and Android Setup local-preview.

Reason: account entry and first-run setup can fail differently across platforms and screens. A broad "native screens approved" flag could hide missing file names, MIME, byte size, provider-boundary copy, or reachable setup controls.

Consequences:

- Each native Auth/Setup proof slot must include platform/surface naming in the file name or URI, image MIME, positive byte size, and provider-boundary copy.
- Setup local-preview proof also requires reachable setup controls before the row can open.
- Provider-backed auth, household sync, store review, public launch, and Apollo sign-off remain separate gates.

Owner: Codex.

Revisit trigger: real iOS/Android Auth gateway and Setup local-preview evidence is attached from configured native tooling or physical devices.

### 2026-07-04: Push Delivery Proof Must Be Platform And Provider Specific

Decision: the Push notifications proof manifest cannot treat generic APNs, FCM, or delivery QA strings as reminder delivery proof. Reminder delivery proof requires concrete iOS APNs and Android FCM native delivery evidence.

Reason: reminder delivery is a user-trust and store-review boundary. A copied note that says notifications worked is not enough to claim delivery across APNs and FCM, permission preferences, quiet-hours or opt-out behavior, and missed-notification fallback.

Consequences:

- The APNs, FCM, and delivery QA manifest rows remain blocked until native delivery evidence includes platform/provider naming in the file name or URI, image MIME, positive byte size, token registration, delivered reminder, permission preference, quiet-hours or opt-out, and fallback capture.
- Share Beta Handoff, the Release Smoke Checklist, the mobile beta doctor, and the native QA tooling doctor now tell helpers to attach `ios-apns` and `android-fcm` delivery evidence instead of generic notification notes.
- Provider setup, prompt/legal approval, store privacy review, public launch, and Apollo sign-off remain separate blockers.

Owner: Codex.

Revisit trigger: push delivery proof becomes signed provider telemetry instead of screenshot/file metadata, or Apollo chooses a different notification provider stack.

### 2026-07-04: Generated Binary Export Readiness Requires Native And Provider Proof

Decision: the focused Report Binary Export Proof mission renders a source-backed proof manifest, but `Generated artifacts allowed` remains `No` until Care Pass PDF, Dog ID PNG, provider storage, and native artifact proof evidence are attached from real device/provider QA.

Reason: local PDF/PNG bytes and artifact-specific Records manifests are useful launch handoff evidence, but helpers need one focused route that prevents local generation from being mistaken for native share/reopen approval, provider-backed storage, store approval, public launch, or Apollo sign-off.

Consequences:

- `/care-twin-qa?qaSurface=report-binary-export-proof` renders the Report binary export proof manifest before Evidence Capture.
- The JSON mobile beta doctor guards that the focused manifest remains source-backed.
- Native iOS/Android share/reopen evidence, renderer approval, structured provider storage proof, retention/export/deletion proof, store review, and Apollo sign-off remain launch gates.

### 2026-07-04: Native Binary Artifact Proof Must Be Platform And Artifact Specific

Decision: generated PDF/PNG readiness cannot rely on a generic native artifact approval flag. The Report Binary Export manifest requires four concrete native proofs before readiness can open: iOS Care Pass PDF, Android Care Pass PDF, iOS Dog ID PNG, and Android Dog ID PNG.

Reason: local generated bytes are useful, but launch helpers need evidence that each artifact type was shared and reopened on each native platform. A single approval boolean could make a partially tested or ambiguously named artifact look ready.

Consequences:

- Each native artifact proof must carry matching platform/artifact text in the file name or URI, expected MIME type, positive byte size, share proof, and reopen proof.
- The native artifact proof row reports `0/4 native proofs attached` until real evidence is supplied, then `4/4 native proofs ready` only when all four platform/artifact slots are satisfied.
- Provider storage, renderer approval, retention/export/deletion policy, native device QA, store review, public launch, and Apollo sign-off remain separate gates.

Owner: Codex.

Revisit trigger: native PDF/PNG share/reopen proof is attached, provider-backed artifact storage is configured, or generated binary export readiness is ready for Apollo approval.

### 2026-07-04: Route Visual Proof Requires Route-Named Evidence

Decision: the Route Visual proof manifest must keep each Home, Log, Plans, Health, Records, and More iOS/Android row blocked until the saved evidence file name or URI names that route; generic platform screenshot counts alone are not proof.

Reason: six iOS files plus six Android files can show that screenshots were attached without proving the actual launch routes were captured. Route-named evidence keeps the helper handoff honest while native device capture and human visual approval remain pending.

Consequences:

- `buildRouteVisualProofManifest` reports platform counts separately from per-route readiness.
- Generic `native-ios-*` and `native-android-*` attachments keep the manifest blocked until route-named files or URIs are attached.
- The JSON mobile beta doctor guards the route-named source path, but actual native screenshots, visual approval, store review, and Apollo sign-off remain launch gates.

Owner: Codex.

Revisit trigger: automated native screenshot capture can attach route identity metadata, or Apollo approves a different route-proof naming convention.

### 2026-07-04: Store Account Readiness Requires Structured Apple And Google Proof

Decision: the Store accounts proof manifest cannot treat generic Apple/Google approval notes as App Review or Play review readiness. App submission remains blocked until structured proof files satisfy each Apple, Google, reviewer, metadata, and Apollo approval row.

Reason: store-account readiness is a high-trust launch boundary. Text that says an account or metadata is approved can hide missing team ids, package records, signing custody, reviewer access, privacy labels, Apollo sign-off, or the no-submit boundary.

Consequences:

- `buildStoreAccountsProofManifest` keeps all six rows blocked when only legacy text fields are present.
- iOS App Store Connect, Android Google Play, shared bundle/signing, reviewer access, metadata/privacy, and release approval proof must include platform/store naming, MIME, positive byte size, and the row-specific ids, roles, ownership fields, and approval booleans.
- Store accounts, metadata/screenshots/privacy approval, App Review or Play review submission, legal/privacy approval, public launch, and Apollo sign-off remain separate blockers.

Owner: Codex.

Revisit trigger: Apollo attaches real App Store Connect and Google Play proof, or the app gains a provider-backed store-submission evidence service.

### 2026-07-04: Live AI Requires Structured Provider And Safety Proof

Decision: the WoofGuide AI provider proof manifest cannot treat generic OpenAI/model/source/write-gate/veterinary/fallback approval strings as live-AI readiness. `Live AI allowed` remains blocked until six structured proof files satisfy OpenAI secret storage, approved model policy, source/citation rules, owner-review write gate, veterinary safety boundary, and fallback/incident handling.

Reason: live AI is a care-trust and veterinary-safety boundary. Text that says a model, citation policy, or safety boundary is approved can hide missing key custody, retention stance, source freshness, automatic-write prevention, diagnosis/treatment refusal examples, fallback behavior, rollback plan, or support handoff.

Consequences:

- `buildAiProviderProofManifest` keeps all six rows blocked when only legacy approval strings are present.
- Each proof file must include proof naming, acceptable MIME, positive byte size, required policy fields, and row-specific safety booleans.
- Live OpenAI configuration, model approval, provider-backed answers, automatic care-log writes, source/citation review, veterinary safety approval, public launch, and Apollo sign-off remain separate blockers.

Owner: Codex.

Revisit trigger: Apollo attaches real OpenAI/provider proof files, or WoofGuide gains a provider-backed AI evidence service with signed policy metadata.

### 2026-07-04: PWA WoofGuide Key Detection Is Not Live AI Approval

Decision: the PWA WoofGuide surface cannot treat `/api/care-helper` reporting a server OpenAI key as live-AI approval. A key signal stays staged as `Provider proof pending` and `Structured AI proof needed`, and the PWA does not call the live helper until structured AI provider proof sets `proofReady`.

Reason: the PWA is an owner-facing preview surface. If it says `Live OpenAI` or sends questions to the provider from key detection alone, it contradicts the WoofGuide AI proof manifest, Privacy & Safety AI proof guard, and public-launch truth boundaries.

Consequences:

- `assistantStatus` separates key signal from structured proof readiness.
- PWA WoofGuide copy avoids `Live OpenAI` and `Credential found` until proof is attached.
- `reviewAssistantQuestion` only posts to `/api/care-helper` when `isAssistantLiveReady()` is true.
- Server OpenAI key storage, approved model policy, source/citation rules, owner-review write gate, veterinary safety boundary, fallback/incident handling, live AI approval, public launch, and Apollo sign-off remain separate blockers.

Owner: Codex.

Revisit trigger: Apollo attaches real WoofGuide AI provider proof files, or the API returns signed `proofReady` evidence from a provider-backed AI evidence service.

### 2026-07-04: Destructive Account Deletion Requires Structured Compliance Proof

Decision: the Account deletion proof manifest cannot treat generic deletion-route/export/receipt/audit/recovery/legal approval strings as destructive-deletion readiness. `Destructive deletion allowed` remains blocked until six structured proof files satisfy deletion-route/auth, export-before-delete, data/object deletion receipt, audit/support receipt, recovery/cancellation policy, and legal/store/Apollo approval.

Reason: self-serve account deletion is a destructive data, privacy, and store-compliance boundary. Text that says deletion or legal approval is ready can hide missing reauthentication proof, export-before-delete handoff, provider object deletion receipts, audit/support receipts, recovery/cancellation behavior, App Store/Play Store compliance, Apollo approval, or the local-preview no-delete boundary.

Consequences:

- `buildAccountDeletionProofManifest` keeps all six rows blocked when only legacy approval strings are present.
- Each proof file must include matching locator text, acceptable MIME, positive byte size, required row fields, and row-specific approval booleans.
- Provider-backed destructive deletion, storage/object deletion, privacy/legal approval, App Store or Play Store deletion compliance, public launch, and Apollo sign-off remain separate blockers.

Owner: Codex.

Revisit trigger: Apollo attaches real provider deletion and legal/store proof files, or WoofWatcher gains a provider-backed deletion evidence service with signed receipt metadata.

### 2026-07-04: Public Launch Requires Structured Support Legal Proof

Decision: the Support legal readiness proof manifest cannot treat generic support inbox/privacy-terms/refund/veterinary/deletion/incident/Apollo approval strings as public-launch readiness. `Public launch allowed` remains blocked until seven structured proof files satisfy support inbox, privacy policy and terms, refund/subscription policy, veterinary/emergency boundary, deletion escalation, incident response owner, and Apollo launch approval/no-launch boundary.

Reason: public launch is a support, legal, refund, veterinary-safety, store-review, and Apollo sign-off boundary. Text that says support or legal approval is ready can hide missing monitored inbox proof, final privacy/terms URLs, subscription/refund workflow, emergency boundary copy, deletion escalation, incident response ownership, no-launch boundary, or Apollo approval.

Consequences:

- `buildSupportLegalReadinessProofManifest` keeps all seven rows blocked when only legacy approval strings are present.
- Each proof file must include matching locator text, acceptable MIME, positive byte size, required row fields, and row-specific approval booleans.
- Legal/privacy approval, refund/subscription approval, support operations, veterinary-boundary sign-off, App Store or Play Store support review, public launch, and Apollo sign-off remain separate blockers.

Owner: Codex.

Revisit trigger: Apollo attaches real support/legal/refund/veterinary-boundary approval proof files, or WoofWatcher gains a provider-backed launch-approval evidence service with signed approval metadata.

### 2026-07-04: Support Runbook Requires Structured Public-Launch Proof

Decision: the Support runbook cannot treat support/legal approval booleans, support email, privacy policy URL, or terms URL as enough to mark public launch ready. It must consume the Support legal readiness proof manifest and keep `launchReady`, `supportRunbookApproved`, and `privacyLegalApproved` blocked until structured support/legal proof files make the manifest ready.

Reason: the Support runbook is an owner-facing launch safety surface. If it marks launch ready from local approval fields, it can contradict the focused Support Legal Readiness Proof manifest and the aggregate Launch Readiness proof guard.

Consequences:

- `deriveSupportRunbookPlan` accepts `supportLegalReadinessEvidence` and calls `buildSupportLegalReadinessProofManifest`.
- Staged support/legal fields now show as blocked sections until the matching proof rows are attached.
- Privacy & Safety may display or persist `provider-approved` support status only when the support runbook plan is `launchReady`; otherwise stale or attempted provider-approved saves are treated as owner-reviewed local packets.
- Privacy owner exports clamp launch support/provider status through `deriveSupportRunbookPlan` and `deriveLaunchProviderSetup` before serialization, so stale imported `provider-approved` profiles do not leak into owner export proof without structured evidence.
- Real support operations, privacy/legal copy, refund/subscription policy, veterinary-boundary sign-off, store review, public launch, and Apollo sign-off remain separate blockers.

Owner: Codex.

Revisit trigger: Apollo attaches real support/legal proof files or the app gains a provider-backed support/legal proof evidence service that can feed the Support runbook.

### 2026-07-04: Incremental Care Sync Requires Structured Provider Proof

Decision: the care-entry provider sync proof packet cannot treat generic Supabase ids, migration notes, RLS text, policy notes, CI URLs, or mobile sign-off strings as incremental-sync readiness. `Incremental sync allowed` remains blocked until six structured proof files satisfy Supabase project id, migration/backfill, active-household cursor/tombstone RLS, retention/export/deletion, dependency-complete build, and mobile incremental sign-off requirements.

Reason: incremental care-entry sync is a data-integrity, privacy, retention, and native-adoption boundary. Text that says provider sync is ready can hide missing production project confirmation, unapplied migrations, incomplete existing-row backfills, cross-household cursor/tombstone leaks, missing retention/export/deletion approval, stale dependency builds, missing native QA, or absent rollback approval.

Consequences:

- `deriveCareEntryProviderSyncProof` keeps all six rows blocked when only legacy provider strings are present.
- Each proof file must include matching file name or URI tokens, acceptable MIME, positive byte size, required row fields, and row-specific booleans or approvals.
- Supabase migration execution, production RLS/privacy approval, retention/export/deletion policy, native incremental QA, public launch, and Apollo sign-off remain separate blockers.

Owner: Codex.

Revisit trigger: Apollo attaches real Supabase/provider, native QA, and rollback proof files, or WoofWatcher gains a provider-backed sync evidence service with signed migration, RLS, retention, and native-adoption metadata.

### 2026-07-04: Report Binary Provider Storage Requires Structured Proof

Decision: the Report Binary Export proof manifest cannot treat `storageProviderConfigured` or a generic storage-policy note as provider-storage readiness. `Generated artifacts allowed` remains blocked until a structured provider storage proof file satisfies report PDFs, credential PNG/SVG/HTML, and QA evidence storage requirements.

Reason: report and credential binaries are user records. A single provider-configured boolean can hide missing bucket names, signed upload/download rules, household scoping, retention/export/deletion approval, QA evidence storage, file metadata, or row-specific approvals.

Consequences:

- `buildReportBinaryExportProofManifest` keeps the provider storage row blocked as `Provider storage pending structured proof` when only `storageProviderConfigured` is true.
- Provider storage proof must include a file name or URI, acceptable MIME, positive byte size, at least three bucket names, signed upload/download policy, household scope, retention, export, deletion, QA evidence storage, and approval booleans.
- Native share/reopen proof, renderer approval, provider storage configuration, store review, public launch, and Apollo sign-off remain separate blockers.

Owner: Codex.

Revisit trigger: Apollo attaches real storage/provider proof files, or WoofWatcher gains a provider-backed report-storage evidence service with signed bucket, policy, and lifecycle metadata.

### 2026-07-04: Attachment Storage Readiness Requires Structured Proof

Decision: the shared attachment manifest cannot treat `storageProviderConfigured` as upload readiness for local medication proof photos, record documents, Adventure memories, Care Pass reports, or QA screenshots. Local attachment queues remain `local-only` until structured attachment storage proof satisfies the shared storage boundary.

Reason: attachment storage spans owner care proof, medical records, generated handoffs, and QA evidence. A single storage checkbox can hide missing bucket names, signed upload/download rules, household scoping, retention/export/deletion approval, QA evidence ownership, and Apollo approval.

Consequences:

- `deriveAttachmentManifest` keeps local attachments blocked as `local-only` when only `storageProviderConfigured` is true.
- Attachment storage proof must include a file name or URI, acceptable MIME, positive byte size, at least three bucket names, signed upload and download policies, household scope, retention, export, deletion, QA evidence storage, approval owner, and row-specific approval booleans.
- More Launch Readiness and Privacy & Safety now require a separate `storageProviderProofReady`/structured proof boundary before storage can contribute to release readiness.
- Real storage bucket configuration, signed policy files, native share/reopen proof, store review, public launch, and Apollo sign-off remain separate blockers.

Owner: Codex.

Revisit trigger: Apollo attaches real attachment-storage provider proof files, or WoofWatcher gains a provider-backed attachment evidence service with signed bucket, policy, object lifecycle, and approval metadata.

### 2026-07-04: Auth Provider Readiness Requires Structured Proof Files

Decision: the Auth/Setup proof manifest cannot treat `clerkProductionApproved`, `redirectDeepLinkApproved`, `householdSyncApproved`, or `launchGateApproved` as account/onboarding readiness. Legacy booleans can stage row copy only; readiness requires structured proof files for Clerk production, redirect/deep-link URLs, household membership policy, and Apollo auth launch approval.

Reason: production auth is a trust, privacy, account custody, and household-boundary launch gate. Approval booleans can hide missing Clerk app ids, key custody, local placeholder key exclusion, OAuth return paths, invite permissions, role enforcement, denied cross-household access, native proof references, Apollo approval, or the no-launch boundary.

Consequences:

- `buildAuthSetupProofManifest` keeps provider rows blocked when only legacy approval booleans are present.
- Each provider proof file must include a locator, acceptable MIME, positive byte size, required row fields, and row-specific approval booleans.
- Real Clerk configuration, OAuth, provider-backed household creation, native screenshots, store approval, public launch, and Apollo sign-off remain separate blockers.

Owner: Codex.

Revisit trigger: Apollo attaches real Clerk/auth provider proof files, or WoofWatcher gains a provider-backed auth evidence service with signed app, redirect, household, and launch metadata.

### 2026-07-04: Launch Readiness Requires Aggregate Structured Proof Flags

Decision: the aggregate Launch Readiness dashboard, release packet, and store submission packet cannot treat provider-approved booleans as store readiness. Auth, care-entry sync, storage, AI, payments, account deletion, push delivery, store accounts, privacy/legal, and support/refund each need matching structured proof-ready flags before the top-level launch gate can close.

Reason: individual proof manifests already reject generic approval notes, but the aggregate dashboard could still overstate readiness if raw provider booleans were promoted without the same proof boundary. Release and store packets inherit that dashboard state, so this is a public-claim boundary.

Consequences:

- `deriveLaunchReadiness` keeps provider/store/approval tiles blocked when provider booleans are true but structured proof flags are absent.
- More passes aggregate proof flags as `false` until real evidence is attached, preventing staged provider setup from becoming `storeLaunchReady`.
- Release packets and store submission packets cannot claim launch or submission readiness until every aggregate proof flag is present alongside native/local readiness.
- Real provider proof files, native iOS/Android QA, store review, public launch, and Apollo sign-off remain separate blockers.

Owner: Codex.

Revisit trigger: WoofWatcher gains a provider-backed proof evidence service or Apollo attaches real proof files that can populate the aggregate proof-ready flags.

### 2026-07-04: Privacy & Safety AI Disclosure Requires Structured Provider Proof

Decision: Privacy & Safety cannot treat `aiProviderConfigured` as enough to mark the WoofGuide AI disclosure ready. It must consume the WoofGuide AI provider proof manifest and stay `limited` until structured proof files cover OpenAI key storage, approved model policy, source rules, owner-reviewed writes, veterinary safety, and fallback/incident handling.

Reason: Privacy & Safety is an owner-facing launch safety surface. If it marks AI ready from a provider checkbox, it can contradict the focused WoofGuide AI proof manifest and the aggregate Launch Readiness guard.

Consequences:

- `deriveAccountSafetyPlan` accepts `aiProviderEvidence` and calls `buildAiProviderProofManifest`.
- Configured AI without structured proof adds a WoofGuide AI provider-proof blocker instead of showing the disclosure as ready.
- Real OpenAI configuration, model approval, live AI, source/citation review, automatic-write approval, veterinary safety approval, public launch, and Apollo sign-off remain separate blockers.

Owner: Codex.

Revisit trigger: Apollo attaches real WoofGuide AI provider proof files or the app gains a provider-backed proof evidence service that can feed Privacy & Safety.

### 2026-07-04: Privacy & Safety Account Deletion Requires Structured Proof

Decision: Privacy & Safety cannot treat `accountDeletionEnabled` as enough to mark destructive account deletion ready. It must consume the Account deletion proof manifest and stay `blocked` until structured proof files cover route/auth, export-before-delete, data/object receipts, audit/support, recovery/cancellation, and legal/store approval.

Reason: Privacy & Safety is the owner-facing account and data-control surface. If it shows deletion ready from a provider checkbox, it can contradict the focused Account Deletion Proof manifest and make a destructive data action look safer than it is.

Consequences:

- `deriveAccountSafetyPlan` accepts `accountDeletionEvidence` and calls `buildAccountDeletionProofManifest`.
- Enabled account deletion without structured proof adds an account-deletion proof blocker instead of showing destructive deletion as ready.
- Real deletion routes, reauthentication, export-before-delete, data/object deletion receipts, audit/support receipts, recovery/cancellation rules, legal/store approval, public launch, and Apollo sign-off remain separate blockers.

Owner: Codex.

Revisit trigger: Apollo attaches real account-deletion proof files or the app gains a provider-backed proof evidence service that can feed Privacy & Safety.

### 2026-07-04: Privacy & Safety Payments Requires Structured Proof

Decision: Privacy & Safety cannot treat `paymentsEnabled` as enough to mark checkout ready. It must consume the Payments provider proof manifest and stay `blocked` until structured proof files cover product catalog, billing path, iOS App Store and Android Google Play sandbox receipts, restore purchases, refund/support policy, and Apollo checkout approval.

Reason: Privacy & Safety is an owner-facing launch safety surface and payments are a store, money-movement, refund, and support risk. If it marks payments ready from a provider checkbox, it can contradict the focused Payments Provider Proof manifest and the aggregate Launch Readiness guard.

Consequences:

- `deriveAccountSafetyPlan` accepts `paymentsProviderEvidence` and calls `buildPaymentsProviderProofManifest`.
- Enabled payments without structured proof adds a payments-proof blocker instead of showing checkout as ready.
- Real product ids, store billing path, sandbox receipts, restore purchases, entitlement mapping, refund/support approval, store review, public launch, and Apollo checkout sign-off remain separate blockers.

Owner: Codex.

Revisit trigger: Apollo attaches real payments provider proof files or the app gains a provider-backed proof evidence service that can feed Privacy & Safety.

### 2026-07-04: Reminder Center Push Delivery Requires Structured Proof

Decision: Reminder Center cannot treat configured/provider-approved push setup as provider-backed notification delivery. Calendar must consume the Push notifications proof manifest and keep provider-backed notification status local/in-app until structured Expo/APNs/FCM, permission, quiet-hours, opt-out, and native delivery proof makes `reminderDeliveryAllowed` true.

Reason: Reminder delivery is an owner-trust and store-review boundary. If Calendar marks notifications provider-backed from setup booleans alone, it can contradict the focused Push Notifications Proof manifest and imply delivered reminder behavior before any iOS APNs or Android FCM proof exists.

Consequences:

- `buildReminderNotificationPreferencesForCenter` accepts `pushNotificationsProofEvidence` and calls `buildPushNotificationsProofManifest`.
- Provider-approved push without structured proof stays staged, and shared Reminder Center copy explains that proof is still missing.
- Implementation commit `c36e36e` is pushed with local red/green proof; fresh branch CI for that commit remains pending because manual workflow dispatch was blocked before GitHub accepted it.
- Real Expo/APNs/FCM configuration, native delivery evidence, prompt/legal approval, store privacy review, public launch, and Apollo sign-off remain separate blockers.

Owner: Codex.

Revisit trigger: Apollo attaches real push notification proof files or the app gains a provider-backed proof evidence service that can feed Calendar.

### 2026-07-04: PWA Cloud Sync Requires Structured Provider Proof

Decision: The PWA cloud sync plan cannot treat `backendConfigured`, a backend URL, or a household id as cross-device sync readiness. It must keep staged backend setup at `provider_proof_pending` until structured cloud sync provider proof covers Supabase project id, migration/backfill, active-household RLS, retention/export/deletion, dependency-complete build proof, mobile full-refresh sign-off, and Apollo approval.

Reason: Cloud sync is a privacy, data-loss, and household-trust boundary. If the PWA marks sync `ready_to_connect` from a URL and household id alone, it contradicts the focused Care-entry Provider Sync proof manifest and can imply durable provider-backed sync before migrations, RLS, retention/export/deletion, dependency build, or mobile adoption proof exists.

Consequences:

- `buildCloudSyncPlan` separates backend setup from `providerProofReady`.
- Backend setup without structured proof returns `provider_proof_pending` and adds a structured cloud sync provider proof blocker.
- Real Supabase configuration, migrations, RLS, retention/export/deletion, dependency-complete provider build, mobile full-refresh sign-off, public launch, and Apollo sign-off remain separate blockers.

Owner: Codex.

Revisit trigger: Apollo attaches real care-entry/cloud sync provider proof files or the app gains a provider-backed proof evidence service that can feed PWA cloud sync planning.

### 2026-07-04: PWA Hosted Nudges Require Structured Delivery Proof

Decision: The PWA hosted nudge plan cannot treat `backendConfigured`, a backend URL, a household id, or push provider setup as closed-app delivery readiness. It must keep staged backend and provider setup at `provider_proof_pending` until structured hosted nudge delivery proof covers backend jobs, caregiver consent, provider delivery, caregiver privacy, quiet-hours and daily-budget enforcement, missed-delivery fallback, native delivery, and Apollo approval.

Reason: Hosted nudges can interrupt caregivers outside the app and expose household care context. If the PWA marks nudges `ready_to_schedule` from provider setup alone, it contradicts the Push Notifications proof manifest and can imply closed-app push/email/SMS delivery before consent, privacy, quiet-hours, fallback, or native delivery proof exists.

Consequences:

- `buildHostedNudgePlan` separates backend/push setup from `providerProofReady`.
- Staged backend and push setup without structured proof returns `provider_proof_pending`, adds a structured hosted nudge delivery proof blocker, and keeps generated jobs empty.
- Real backend job runners, caregiver consent/privacy approval, provider delivery setup, native delivery evidence, public launch, and Apollo sign-off remain separate blockers.

Owner: Codex.

Revisit trigger: Apollo attaches real hosted nudge delivery proof files or the app gains a provider-backed proof evidence service that can feed hosted nudge planning.

### 2026-07-04: Provider Launch Setup Rows Require Structured Proof Flags

Decision: Provider Launch Setup cannot treat provider-approved status plus configured provider booleans as enough to mark auth, database, storage, AI, payments, push, store, or account-deletion rows ready. Each row needs its matching structured proof-ready flag before it can become ready or feed true provider input into Launch Readiness.

Reason: The aggregate Launch Readiness model already requires structured proof flags, but Provider Launch Setup could still present provider-approved rows as ready from older booleans. That made the operator packet overstate readiness even though real provider files, native evidence, store proof, and Apollo sign-off were still missing.

Consequences:

- `deriveLaunchProviderSetup` normalizes row proof flags for auth, database, storage, AI, payments, push, store accounts, and account deletion.
- A row is ready only when setup is configured, `providerStatus` is `provider-approved`, and the row proof flag is true.
- Provider-approved rows without proof stay staged as `Proof pending` and say structured proof evidence is still required.
- `providerInput` only forwards true configured/proof flags for rows that are actually ready.
- More's Provider Launch Setup save path only preserves a persisted `provider-approved` status when every provider row has both configured setup and its matching `proofKey` flag; configured-only saved profiles are downgraded to `owner-reviewed`.
- Real provider proof files, native/store proof, public launch, and Apollo sign-off remain separate blockers.

Owner: Codex.

Revisit trigger: Apollo attaches real provider proof files for the provider rows, or WoofWatcher gains a provider-backed evidence service that can validate those files automatically.

### 2026-07-04: Care Documents Preserve Launch Proof Fields

Decision: The saved care document must preserve structured launch proof fields instead of treating them as transient UI-only state. `launchSupportProfile.supportLegalReadinessEvidence` and every Provider Launch Setup proof-ready flag must survive local cache hydration, server refresh, conflict merge, privacy export, and More's Launch Readiness derivation.

Reason: The proof models require structured evidence, but the care-document merge path could strip those fields before `deriveSupportRunbookPlan`, `deriveLaunchProviderSetup`, or `deriveLaunchReadiness` saw them. That made real saved/imported proof impossible to use and could leave operators stuck behind stale hardcoded proof placeholders even after evidence was attached.

Consequences:

- `CareContext` includes and normalizes `supportLegalReadinessEvidence`.
- `CareContext` includes all Provider Launch Setup proof-ready flags and normalizes `launchProviderProfile` through `normalizeLaunchProviderProfile`.
- More forwards only `launchProviderSetupPlan.providerInput` proof flags plus launch-ready support/legal proof variables into Launch Readiness.
- Raw configured/provider-approved booleans still cannot bypass structured proof gates.
- Real provider proof files, native/store proof, public launch, and Apollo sign-off remain separate blockers.

Owner: Codex.

Revisit trigger: WoofWatcher gains a provider-backed proof evidence service or a richer proof attachment editor that can validate and attach proof files directly from the app.

### 2026-07-04: Storage Provider Evidence Must Reach Records And Privacy

Decision: Provider Launch Setup must preserve structured storage provider evidence and forward it to the Records and Privacy proof consumers. `storageProviderEvidence` is durable launch-provider profile state, not a transient UI-only field, and it must reach Care Pass artifact export, Report Binary Export proof, and Privacy & Safety storage review.

Reason: Earlier storage guards correctly rejected `storageProviderConfigured` by itself, but valid saved/imported storage proof still could not satisfy the downstream validators because Provider Launch Setup and CareContext did not preserve a structured storage evidence object. That stranded real proof and made Records/Privacy behave as if no storage proof existed even after evidence was attached.

Consequences:

- `LaunchProviderProfile` includes normalized `storageProviderEvidence`.
- `deriveLaunchProviderSetup` forwards the evidence through `providerInput`.
- `CareContext` persists the typed storage evidence field with the launch provider profile.
- Records passes the evidence into Care Pass artifact export and Report Binary Export proof manifests.
- Privacy & Safety passes the evidence into `deriveAccountSafetyPlan`.
- Storage readiness still requires the existing structured proof validators; raw configured booleans do not count as upload, export, deletion, native, store, public-launch, or Apollo approval.

Owner: Codex.

Revisit trigger: WoofWatcher gains a provider-backed storage proof attachment service or Apollo attaches real storage bucket/policy proof files that should be validated from saved app state.

### 2026-07-04: Privacy Export Attachment State Uses Saved Storage Proof

Decision: Owner privacy export and deletion-request attachment summaries must derive storage readiness from the saved launch-provider storage proof instead of forcing attachment queues to local-only. If normalized `launchProviderProfile.storageProviderEvidence` satisfies the shared attachment-storage proof validator, export metadata and deletion copy may show files as ready for provider upload; otherwise they must keep the approved-storage-rules blocker.

Reason: The Privacy screen storage gate and Records proof surfaces could now consume structured storage proof, but `buildPrivacyExportBundle` and `buildAccountDeletionRequest` still called `deriveAttachmentManifest` with `storageProviderConfigured: false`. That made owner export/deletion copy stale and contradicted the shared storage proof boundary when valid proof was saved.

Consequences:

- Privacy export attachment queues use normalized `launchProviderProfile.storageProviderEvidence`.
- Deletion request attachment summaries use the same storage-proof-derived manifest.
- Export and deletion copy can show `ready for provider upload` only after the shared attachment-storage proof validator passes.
- Real provider upload, object ids, signed access, retention/export/deletion receipts, native proof, store review, public launch, and Apollo sign-off remain separate blockers.

Owner: Codex.

Revisit trigger: WoofWatcher gains provider-backed attachment object ids or Apollo attaches real storage migration/deletion receipt proof that should appear in owner export and deletion audit trails.

### 2026-07-04: Focused Report Binary Export Uses Saved Storage Proof

Decision: The focused `/care-twin-qa?qaSurface=report-binary-export-proof` helper route must derive Report Binary Export provider-storage state from the saved launch-provider profile instead of hardcoding storage as unavailable. The helper route should use `deriveLaunchProviderSetup(state.launchProviderProfile)` and pass saved `storageProviderEvidence` into `buildReportBinaryExportProofManifest`.

Reason: Records and Privacy now preserve and consume structured storage proof, but the focused helper mission still rendered provider storage from `storageProviderConfigured: false`. That made real saved/imported proof impossible to review from the exact QA mission Apollo, Replit, or a native helper is instructed to open for PDF/PNG readiness.

Consequences:

- `/care-twin-qa` consumes `useCare` state and derives the same Provider Launch Setup plan as owner-facing launch routes.
- The focused Report Binary Export proof manifest uses `launchProviderSetupPlan.providerInput.storageProviderConfigured`.
- The focused manifest forwards saved `storageProviderEvidence` as `providerStorageEvidence`.
- Valid structured storage proof can reach the helper route, but PDF/PNG readiness still requires local bytes, renderer proof, iOS/Android share/reopen evidence, structured provider storage proof, App Store/Play review where applicable, public launch approval, and Apollo sign-off.

Owner: Codex.

Revisit trigger: WoofWatcher gains provider-backed proof attachment capture or the helper route starts editing proof evidence directly instead of only reviewing saved launch-provider proof.

### 2026-07-06: More Launch Readiness Uses Saved Attachment Storage Proof

Decision: More's Launch Readiness attachment queue must derive storage readiness from the saved Provider Launch Setup storage proof path instead of forcing attachment manifests to local-only. The route should build `launchProviderSetupPlan` before `deriveAttachmentManifest`, then pass `providerInput.storageProviderConfigured` and saved `storageProviderEvidence`.

Reason: Records, Privacy, and the focused Report Binary Export helper can now consume valid saved/imported storage evidence. If More still passes `storageProviderConfigured: false`, the owner launch cockpit shows a stale storage queue and contradicts the storage-specific proof surfaces even when structured evidence is present.

Consequences:

- More's shared attachment manifest uses the same normalized Provider Launch Setup input as Launch Readiness.
- The Records Storage tile and storage queue can reflect valid structured storage proof when the shared validators accept it.
- Raw provider setup booleans still cannot prove provider upload, object ids, native share/reopen, store review, public launch, or Apollo sign-off.

Owner: Codex.

Revisit trigger: WoofWatcher gains provider-backed attachment object ids, native upload/share evidence capture, or an in-app proof editor that can attach storage evidence directly from More.

### 2026-07-06: Store Screenshot QA Uses Saved Launch Proof Paths

Decision: Store Screenshot QA's store-prep packet must derive provider, support, and storage state from saved Provider Launch Setup, Support Runbook, and attachment manifest models instead of hardcoding provider gates false.

Reason: Store Screenshot QA already powers the internal screenshot checklist and share packet. It should reflect valid structured proof that the rest of the launch cockpit can see, while still keeping native/store/public approval blocked.

Consequences:

- `/care-twin-qa` derives attachment manifest and support runbook state from saved care state.
- `storeLaunchReadinessPlan` consumes provider proof-ready flags, support/legal variables, and `attachmentManifest.launchQueue`.
- `nativeQa` remains `null`, so the store packet stays preparation evidence only.
- Real native screenshots, store accounts, store review, public launch, and Apollo sign-off remain separate blockers.

Owner: Codex.

Revisit trigger: WoofWatcher gains a provider-backed proof evidence service or Store Screenshot QA starts editing or attaching proof directly.

### 2026-07-06: Share Beta Handoff Records Current Branch CI Proof

Decision: Share Beta Handoff should record `WoofWatcher Verify` run `28836909561`
for commit `d21f44e` as the current dependency-complete automation-branch proof,
while leaving the recorded live-preview proof historical until a dependency-
complete helper reruns `proof:live-preview` and `preview:smoke`.

Reason: The automation branch accumulated multiple proof-propagation commits
after the last recorded green CI. Reusing older run `28705671803` would understate
the current dependency-proof boundary and keep docs saying later commits were
unproven even after GitHub accepted and passed a fresh workflow dispatch.

Consequences:

- Share Beta Handoff names run `28836909561`, job `85522525710`, commit
  `d21f44e`, and coverage for durable launch proof persistence, storage-provider
  evidence propagation, More launch queue storage proof propagation, and Store
  Screenshot QA proof input propagation.
- The rerun-after-new-commit boundary remains explicit.
- The live-preview proof still stays web-preview-only and historical until
  regenerated from a dependency-complete helper environment.
- Native iOS/Android proof, provider proof files, store approval, public launch,
  and Apollo sign-off remain separate blockers.

Owner: Codex.

Revisit trigger: A new automation commit lands, or a helper environment produces
fresh `proof:live-preview` and foreground `preview:smoke` output.

### 2026-07-07: Privacy Safety Uses Saved Provider Proof Evidence

Decision: Privacy & Safety should read saved Provider Launch Setup evidence for
WoofGuide AI, payments, and account deletion instead of treating those gates as
configured-booleans-only inputs.

Reason: Earlier slices added structured proof validators for AI, payments, and
account deletion, then persisted proof-ready flags and storage evidence. Without
preserving and forwarding the matching AI, payments, and deletion evidence
objects, valid saved proof could not reach the Privacy & Safety validators.

Consequences:

- `LaunchProviderProfile` preserves `aiProviderEvidence`,
  `paymentsProviderEvidence`, and `accountDeletionEvidence`.
- CareContext keeps those fields when saved or imported care documents merge.
- `/privacy` forwards the saved evidence into the existing account safety plan.
- Raw configured booleans still cannot prove live AI, checkout, destructive
  deletion, public launch, or Apollo sign-off.

Owner: Codex.

Revisit trigger: WoofWatcher gains a provider-backed proof evidence service,
in-app proof attachment editing, or Apollo changes the production provider
approval workflow.

### 2026-07-07: Push Notification Proof Evidence Must Reach Reminder Center

Decision: Saved Provider Launch Setup push notification proof evidence should
survive care-document normalization and feed both Reminder Center and the
focused Push Notifications proof mission.

Reason: The Reminder Center already requires the structured Push notifications
proof manifest before it can claim provider-backed delivery, but the saved
launch provider profile did not preserve the evidence object. That stranded real
APNs/FCM proof and kept `/care-twin-qa?qaSurface=push-notifications-proof`
rendering an empty manifest even when proof was imported or saved.

Consequences:

- `LaunchProviderProfile` preserves `pushNotificationsProofEvidence`.
- CareContext keeps that field when saved or imported care documents merge.
- Calendar reads the saved evidence through
  `buildReminderNotificationPreferencesForCenter`.
- The focused Push Notifications proof route feeds saved evidence into
  `buildPushNotificationsProofManifest`.
- Raw configured/provider-approved push booleans still cannot prove reminder
  delivery, native notification QA, store privacy review, public launch, or
  Apollo sign-off.

Owner: Codex.

Revisit trigger: WoofWatcher gains a provider-backed proof evidence service,
in-app proof attachment editing, or Apollo attaches real Expo/APNs/FCM/native
delivery proof files that should be validated from saved app state.

### 2026-07-07: Store Accounts Proof Evidence Must Reach Store QA

Decision: Saved Provider Launch Setup Store Accounts proof evidence should
survive care-document normalization and feed the focused Store Accounts proof
mission.

Reason: The Store Accounts proof manifest already requires structured
platform/store-named Apple Developer, App Store Connect, Google Play,
bundle/signing, reviewer access, metadata/privacy, and Apollo release approval
files. Without preserving the evidence object, real saved proof could not reach
`/care-twin-qa?qaSurface=store-accounts-proof`, and the helper route rendered an
empty manifest even when proof was imported or saved.

Consequences:

- `LaunchProviderProfile` preserves `storeAccountsProofEvidence`.
- CareContext keeps that field when saved or imported care documents merge.
- The focused Store Accounts proof route feeds saved evidence into
  `buildStoreAccountsProofManifest`.
- Raw configured/provider-approved store-account booleans still cannot prove
  App Review readiness, Play review readiness, public launch, or Apollo
  sign-off.

Owner: Codex.

Revisit trigger: WoofWatcher gains a provider-backed proof evidence service,
in-app proof attachment editing, or Apollo attaches real Apple/Google store
account proof files that should be validated from saved app state.

### 2026-07-07: Account Deletion Proof Evidence Must Reach Deletion QA

Decision: Saved Provider Launch Setup account-deletion proof evidence should
survive care-document normalization and feed the focused Account Deletion proof
mission.

Reason: The Account Deletion proof manifest already requires structured
deletion-route/auth, export-before-delete, data/object deletion receipt,
audit/support, recovery/cancellation, legal/store, and Apollo approval proof
files. Without forwarding the saved evidence object, real imported or saved
proof could not reach `/care-twin-qa?qaSurface=account-deletion-proof`, and the
helper route rendered an empty manifest even when proof was available.

Consequences:

- `LaunchProviderProfile` preserves `accountDeletionEvidence`.
- CareContext keeps that field when saved or imported care documents merge.
- The focused Account Deletion proof route feeds saved evidence into
  `buildAccountDeletionProofManifest`.
- Raw configured/provider-approved account-deletion booleans still cannot prove
  destructive deletion readiness, provider data deletion, legal/store approval,
  public launch, or Apollo sign-off.

Owner: Codex.

Revisit trigger: WoofWatcher gains a provider-backed proof evidence service,
in-app proof attachment editing, or Apollo attaches real account-deletion,
legal, store, and provider deletion proof files that should be validated from
saved app state.

### 2026-07-07: Support Legal Proof Evidence Must Reach Launch QA

Decision: Saved Launch Support Profile support/legal proof evidence should feed
the focused Support Legal Readiness proof mission.

Reason: The Support Legal Readiness proof manifest already requires structured
support inbox, privacy policy and terms, refund/subscription, veterinary and
emergency boundary, deletion escalation, incident response, and Apollo
launch/no-launch proof files. Without forwarding the saved evidence object, real
imported or saved proof could not reach
`/care-twin-qa?qaSurface=support-legal-readiness-proof`, and the helper route
rendered an empty manifest even when proof was available.

Consequences:

- `launchSupportProfile.supportLegalReadinessEvidence` now feeds
  `buildSupportLegalReadinessProofManifest` in the focused Support Legal
  Readiness proof route.
- Raw support/legal approval booleans still cannot prove public launch
  readiness without the structured proof manifest becoming ready.
- Legal/privacy copy, refund/subscription policy, support operations,
  veterinary-boundary approval, public launch, and Apollo sign-off remain
  separate blockers.

Owner: Codex.

Revisit trigger: WoofWatcher gains a provider-backed proof evidence service,
in-app proof attachment editing, or Apollo attaches real support/legal/refund,
veterinary-boundary, incident-response, and launch approval proof files that
should be validated from saved app state.

### 2026-07-07: Focused Provider Proof Missions Must Use Saved Evidence

Decision: Focused Care-entry Provider Sync and WoofGuide AI proof missions
should consume saved Provider Launch Setup evidence instead of rendering empty
manifests.

Reason: The proof manifests already require structured Supabase/RLS/migration
and OpenAI/model/source/write-gate/veterinary/fallback proof files. If the
focused helper routes ignore saved evidence, real imported or saved proof cannot
reach the QA mission that Apollo, Fable, Replit, or a helper would use to review
the provider gate.

Consequences:

- `LaunchProviderProfile` preserves `careEntryProviderSyncEvidence`.
- CareContext keeps that field when saved or imported care documents merge.
- `/care-twin-qa?qaSurface=care-entry-provider-sync-proof` feeds saved evidence
  into `deriveCareEntryProviderSyncProof`.
- `/care-twin-qa?qaSurface=woofguide-ai-provider-proof` feeds saved
  `aiProviderEvidence` into `buildAiProviderProofManifest`.
- Raw provider setup booleans still cannot prove incremental sync or live AI
  readiness without complete structured proof files and Apollo sign-off.

Owner: Codex.

Revisit trigger: WoofWatcher gains an in-app proof attachment editor or Apollo
attaches real Supabase/RLS/migration or OpenAI/model/safety proof files that
should be validated from saved app state.

### 2026-07-07: Payments Proof Evidence Must Reach Premium Review

Decision: Premium and the focused Payments Provider Proof mission should consume
saved Provider Launch Setup payments proof evidence instead of rendering empty
payment manifests.

Reason: The payments proof manifest already requires product catalog, billing
path, iOS App Store and Android Google Play sandbox receipts, restore purchase,
entitlement, refund/support, checkout-gate, and Apollo approval proof. If the
Premium screen or focused helper route ignores saved evidence, real imported or
saved payment proof cannot reach the owner-facing review surface or the QA
mission Apollo, Fable, Replit, or a helper would use to review the checkout
gate.

Consequences:

- `/premium` feeds saved `state.launchProviderProfile.paymentsProviderEvidence`
  into `buildPaymentsProviderProofManifest`.
- `/care-twin-qa?qaSurface=payments-provider-proof` feeds the same saved
  evidence into the focused payments proof manifest.
- Checkout still remains disabled until the structured payment proof manifest is
  complete and Apollo signs off; saved evidence visibility is not money movement
  approval.

Owner: Codex.

Revisit trigger: WoofWatcher gains an in-app proof attachment editor, store
billing is approved, or Apollo attaches real App Store / Google Play / refund
and support proof files that should be validated from saved app state.

## Open Decisions For Apollo

- Final launch target: Expo preview, TestFlight, app store, web dashboard, or staged combination.
- Monetization model and paid tier boundaries.
- Production providers for auth, database, storage, AI, deployment, and mobile release.
- Whether Figma is the canonical visual design source.
- Privacy/legal requirements for storing dog medical records and AI-assisted health summaries.
