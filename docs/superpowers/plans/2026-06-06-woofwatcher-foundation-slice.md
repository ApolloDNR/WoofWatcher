# WoofWatcher Foundation Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make WoofWatcher runnable, understandable, safer for production, and ready for higher-end product/UI work by adding a shared care-domain package, configuration guardrails, documentation, tests, and first-pass text cleanup.

**Architecture:** Add `lib/care-domain` as a zero-dependency TypeScript workspace package that owns the canonical care event taxonomy and status helpers. Keep the current app layout intact, but migrate mobile quick-log/full-log constants and status derivation to shared domain rules so future reports, AI, and UI flows use one vocabulary.

**Tech Stack:** pnpm workspace, TypeScript, Expo React Native, Express, Drizzle, OpenAPI, Node 24 built-in test runner with TypeScript type stripping for zero-install tests.

---

### Task 1: Root Handoff Docs And Environment Contract

**Files:**
- Create: `README.md`
- Create: `.env.example`
- Create: `docs/operations/ENVIRONMENT.md`
- Modify: `replit.md`

- [ ] **Step 1: Write the repo README**

Create `README.md` with:

```markdown
# WoofWatcher

WoofWatcher is a mobile-first shared dog care OS for coordinating routines, logs,
health patterns, records, handoffs, and AI-assisted care.

## Primary App

- Mobile app: `artifacts/woofwatcher-mobile`
- API server: `artifacts/api-server`
- Shared packages: `lib/*`
- Web app/dashboard prototype: `artifacts/woofwatcher`

## Local Setup

This repo is a pnpm workspace.

1. Install Node 24.
2. Enable pnpm with Corepack or install pnpm.
3. Copy `.env.example` to `.env.local` and fill required values.
4. Install dependencies with `pnpm install`.
5. Run typecheck with `pnpm run typecheck`.

## Important Scripts

- `pnpm run typecheck` checks workspace TypeScript.
- `pnpm run build` typechecks and builds packages with build scripts.
- `pnpm --filter @workspace/api-server run dev` starts the API.
- `pnpm --filter @workspace/woofwatcher-mobile run dev` starts Expo.
- `pnpm --filter @workspace/care-domain test` runs zero-dependency domain tests.

## Product Direction

See `docs/superpowers/specs/2026-06-06-woofwatcher-dog-care-os-design.md`.
```

- [ ] **Step 2: Write environment docs**

Create `.env.example` and `docs/operations/ENVIRONMENT.md` listing required and optional variables:

```text
PORT=
BASE_PATH=/
DATABASE_URL=
CLERK_SECRET_KEY=
CLERK_PUBLISHABLE_KEY=
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=
EXPO_PUBLIC_DOMAIN=
ALLOWED_ORIGINS=
AI_INTEGRATIONS_GEMINI_API_KEY=
AI_INTEGRATIONS_GEMINI_BASE_URL=
```

- [ ] **Step 3: Replace placeholder `replit.md` sections**

Make `replit.md` name the app, primary surfaces, run scripts, env requirements,
and gotchas. Remove placeholder lines.

- [ ] **Step 4: Verify docs are clean**

Run:

```powershell
rg -n "Project name|Replace the heading|Populate as you build|TBD|TODO" README.md replit.md docs/operations/ENVIRONMENT.md .env.example
```

Expected: no placeholder matches except intentional command text.

### Task 2: Shared Care-Domain Package

**Files:**
- Create: `lib/care-domain/package.json`
- Create: `lib/care-domain/tsconfig.json`
- Create: `lib/care-domain/src/events.ts`
- Create: `lib/care-domain/src/status.ts`
- Create: `lib/care-domain/src/index.ts`
- Create: `lib/care-domain/test/care-domain.test.ts`
- Modify: `tsconfig.json`

- [ ] **Step 1: Write failing domain tests**

Create `lib/care-domain/test/care-domain.test.ts` with Node's built-in test
runner. Cover:

- `normalizeCareEventType("meds")` returns `"medication"`.
- `normalizeCareEventType("symptom", { what: "vomit" })` returns `"vomit"`.
- `getCareEventDefinition("walk")` returns a visible label and icon.
- `deriveCareDayStatus` counts meals, walks, potty, training, vomit, and anxiety.

Run:

```powershell
& "C:\Users\Apoll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --experimental-strip-types --test lib/care-domain/test/care-domain.test.ts
```

Expected before implementation: FAIL because the package files do not exist.

- [ ] **Step 2: Implement event taxonomy**

`events.ts` exports:

- `CARE_EVENT_TYPES`
- `CareEventType`
- `CareEventIcon`
- `CARE_EVENT_DEFINITIONS`
- `normalizeCareEventType`
- `getCareEventDefinition`
- `isHealthWatchEventType`

Canonical types:

```text
meal, treat, water, walk, potty, play, training, mood, medication, weight,
vomit, symptom, grooming, alone, note
```

Aliases:

```text
meds -> medication
medicine -> medication
pee -> potty
poop -> potty
anxious -> mood
zoomies -> mood
```

- [ ] **Step 3: Implement status helper**

`status.ts` exports `deriveCareDayStatus(entries, routines, now)` and counts
canonical event types for today's meals, walks, potty, training, vomit, anxiety,
and health alerts.

- [ ] **Step 4: Wire project references**

Add `./lib/care-domain` to root `tsconfig.json` references.

- [ ] **Step 5: Verify package tests pass**

Run the Node command from Step 1 again.

Expected: PASS.

### Task 3: Mobile Taxonomy Migration

**Files:**
- Modify: `artifacts/woofwatcher-mobile/package.json`
- Modify: `artifacts/woofwatcher-mobile/tsconfig.json`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/index.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/log.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/phoenixStatus.ts`
- Modify: `artifacts/woofwatcher-mobile/app/woofguide.tsx`

- [ ] **Step 1: Add workspace dependency**

Add `"@workspace/care-domain": "workspace:*"` to the mobile package.

- [ ] **Step 2: Add TypeScript reference**

Add `../../lib/care-domain` to mobile `tsconfig.json` references.

- [ ] **Step 3: Migrate quick-log constants**

Import `normalizeCareEventType` and shared type metadata where appropriate.
Store `"medication"` instead of `"meds"` and use normalized types when logging.

- [ ] **Step 4: Migrate full-log constants**

Use canonical `"medication"` in the full log composer. Keep UI label "Meds" if
desired, but persisted type must be `"medication"`.

- [ ] **Step 5: Migrate status and AI context**

Use shared normalization for day counts and health watch filtering so `"meds"`,
`"symptom"` with `{ what: "vomit" }`, and direct `"vomit"` events are understood
consistently.

- [ ] **Step 6: Fix visible mojibake**

Replace corrupted UI text in touched files with plain ASCII or real Unicode:

- Broken dash placeholders become `--` or `—`.
- Broken check marks become `✓`.
- Broken ellipses become `…`.
- Broken emoji strings become valid emoji or plain text.

### Task 4: API Configuration And CORS Guardrails

**Files:**
- Modify: `artifacts/api-server/src/app.ts`
- Modify: `artifacts/woofwatcher-mobile/app/_layout.tsx`

- [ ] **Step 1: Harden CORS**

In production, require `ALLOWED_ORIGINS`. In development, continue allowing
reflected origins for easier local work.

- [ ] **Step 2: Guard mobile Clerk config**

Replace the non-null assertion for `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` with a
clear runtime error or controlled fallback message before rendering
`ClerkProvider`.

### Task 5: Verification

**Files:**
- None

- [ ] **Step 1: Run domain tests**

```powershell
& "C:\Users\Apoll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --experimental-strip-types --test lib/care-domain/test/care-domain.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run placeholder scan**

```powershell
rg -n "Project name|Replace the heading|Populate as you build|TBD|TODO" README.md replit.md docs/operations/ENVIRONMENT.md .env.example
```

Expected: no unresolved placeholder language.

- [ ] **Step 3: Run mojibake scan**

```powershell
rg -n "â|ð|Ÿ|ï|€|œ|�" artifacts/woofwatcher-mobile README.md replit.md docs lib/care-domain
```

Expected: no matches in touched user-visible text.

- [ ] **Step 4: Report package-manager limitation**

If `pnpm` is still unavailable locally, state that full workspace typecheck/build
could not be run in this environment and give the exact command that should run
after installing pnpm.

