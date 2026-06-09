# WoofWatcher Decision Log

## Decision Format

Each decision should include:

- Date
- Decision
- Reason
- Owner
- Revisit trigger

## Decisions

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

### 2026-06-08: Log Details Stay In The Log Workflow

Decision: Entry details, sticky notes, sync state, edit/delete actions, and entry-level handoff sharing are implemented as a Log screen bottom sheet rather than a separate route.

Reason: The user needs fast review and action from the timeline. A separate route would add navigation cost before the app has search, long-history, or audit requirements that justify it.

Owner: Codex.

Revisit trigger: Log search/history, audit trails, or deep links require a routed entry-detail screen.

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

## Open Decisions For Apollo

- Final launch target: Expo preview, TestFlight, app store, web dashboard, or staged combination.
- Monetization model and paid tier boundaries.
- Production providers for auth, database, storage, AI, deployment, and mobile release.
- Whether Figma is the canonical visual design source.
- Privacy/legal requirements for storing dog medical records and AI-assisted health summaries.
