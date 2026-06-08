# WoofWatcher Decision Log

## Decision Format

Each decision should include:

- Date
- Decision
- Reason
- Owner
- Revisit trigger

## Decisions

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

## Open Decisions For Apollo

- Final launch target: Expo preview, TestFlight, app store, web dashboard, or staged combination.
- Monetization model and paid tier boundaries.
- Production providers for auth, database, storage, AI, deployment, and mobile release.
- Whether Figma is the canonical visual design source.
- Privacy/legal requirements for storing dog medical records and AI-assisted health summaries.
