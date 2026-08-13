# WoofWatcher V1 Release Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover the lost local-only hardening on top of the durable universal-navigation baseline, preserve every verified product behavior, and produce a remotely checkpointed native beta candidate whose status can be proven from GitHub after any workspace disappears.

**Architecture:** `release/woofwatcher-v1` is the durable integration branch, beginning at documentation-inclusive commit `0f1107b170b0a9c89548a51f5cdeb664ba98246f` (code tree parent `b6934f7a`). Each task is test-first, independently reviewed, committed, pushed, and verified on its exact remote SHA before the next task begins. Data safety is rebuilt as four explicit boundaries: generation permits stop stale asynchronous work, serialized writers preserve write order, one reset coordinator owns cross-provider deletion, and one injected filesystem facade owns app files. UI completion then moves through modal accessibility, theme/motion/permission consistency, rendered navigation proof, and native beta proof.

**Tech Stack:** Expo SDK 54, React Native 0.81, Expo Router 6, TypeScript 5.9, Node 24, pnpm 10.24.0, AsyncStorage, expo-file-system/legacy behind an adapter, expo-location, Node test runner, GitHub Actions, EAS.

## Global Constraints

- The canonical product surface is `artifacts/woofwatcher-mobile`; shared reusable care rules remain in `lib/care-domain`.
- V1 submission scope is free and local-first: no production account requirement, cloud sync/storage, push delivery, live AI, payment, or subscription claim may be enabled without its structured provider proof.
- Preserve the universal five-tab shell: Home, Log, Plans, Health, More. Legacy URLs must continue redirecting to their canonical tab and section.
- Preserve the dog-first product contract and routines-to-logs relationship, including expected/served/eaten meal amounts, skipped/partial outcomes, and household visibility.
- All care writes remain append-safe where applicable, authenticated and household-scoped when provider sync is enabled, and visibly recoverable when sync fails.
- WoofGuide may summarize and organize care but must not diagnose or replace veterinary care; urgent red flags direct the owner to a veterinarian.
- No secrets, credentials, signing material, access tokens, private route traces, or owner data may enter commits, test fixtures, or chat output.
- Exact runtime is Node 24 with pnpm 10.24.0 and `pnpm install --frozen-lockfile`.
- A task is not complete until focused tests, TypeScript, the relevant build/export checks, independent review, remote push, and exact-SHA GitHub verification pass.
- No force-push or history rewrite is allowed after the first remote checkpoint. Fixes are additive commits.
- Browser evidence never clears iOS, Android, VoiceOver, TalkBack, large-text, native Back, permission, safe-area, haptic, sharing, or store gates.
- The current durable baseline is browser-verified but native-blocked: 1,037/1,037 focused tests; build/typecheck/export pass; 47/47 runtime routes; 56/56 preview routes; historical rendered Chromium navigation 544/544; physical native proof pending.

---

### Task 1: M0 Durable Release Control

**Files:**
- Create: `docs/release/STATUS.md`
- Create: `docs/operations/DURABLE_DEVELOPMENT_WORKFLOW.md`
- Create: `docs/release/tools/durability-policy.test.mjs`
- Modify: `.github/workflows/verify.yml`
- Modify: `AGENTS.md`
- Include: `docs/superpowers/plans/2026-08-13-woofwatcher-v1-release-recovery.md`

**Interfaces:**
- Consumes: remote branch `release/woofwatcher-v1` at `0f1107b170b0a9c89548a51f5cdeb664ba98246f`.
- Produces: a committed status ledger, binding checkpoint SOP, exact-SHA CI gate, and one source of current release truth that later tasks update.

- [ ] **Step 1: Write the failing durability-policy test**

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("release status records an immutable remote checkpoint and native boundary", () => {
  const status = read("docs/release/STATUS.md");
  assert.match(status, /release\/woofwatcher-v1/);
  assert.match(status, /0f1107b170b0a9c89548a51f5cdeb664ba98246f/);
  assert.match(status, /PENDING NATIVE|BLOCKED.*NATIVE/s);
  assert.match(status, /1,037\/1,037/);
});

test("durable workflow forbids local-only completion and history rewrites", () => {
  const workflow = read("docs/operations/DURABLE_DEVELOPMENT_WORKFLOW.md");
  assert.match(workflow, /not complete until.*push.*remote SHA/is);
  assert.match(workflow, /No force-push/i);
  assert.match(workflow, /workspace.*pruned.*clone/is);
});

test("GitHub verification runs on release pushes with least privilege and store validation", () => {
  const workflow = read(".github/workflows/verify.yml");
  assert.match(workflow, /release\/\*\*/);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.match(workflow, /concurrency:/);
  assert.match(workflow, /validate-store-materials\.mjs/);
  assert.doesNotMatch(workflow, /uses:\s+[^\n]+@v\d+\s*$/m);
});
```

- [ ] **Step 2: Run the policy test and verify it fails because the M0 files do not exist**

Run: `node --test docs/release/tools/durability-policy.test.mjs`

Expected: FAIL with `ENOENT` for `docs/release/STATUS.md`.

- [ ] **Step 3: Create the release status ledger with exact baseline truth**

The file must contain these sections and values:

```markdown
# WoofWatcher V1 Release Status

- Integration branch: `release/woofwatcher-v1`
- Durable baseline: `0f1107b170b0a9c89548a51f5cdeb664ba98246f`
- Baseline code commit: `b6934f7a`
- Main at recovery start: `47234396`
- Scope: free, local-first V1
- Browser verdict: PASS
- Native verdict: PENDING NATIVE

## Current milestone
M0 — Durable Release Control

## Exact baseline verification
- Focused tests: 1,037/1,037 PASS
- TypeScript and CI build: PASS
- Expo web export: 260 files / 1,943 modules PASS
- Runtime routes: 47/47 PASS
- Live-preview routes: 56/56 PASS
- Historical rendered Chromium navigation: 544/544 PASS

## Active risks
- Physical iOS/Android, VoiceOver/TalkBack, large text, Back/deep-link history, safe areas, touch targets, haptics, permissions, and native sharing remain unproved.
- Later local-only hardening commits were pruned and are being reconstructed from tests and documented behavior.
```

- [ ] **Step 4: Create the binding durable-development workflow**

Record the exact sequence:

```text
fetch -> branch/worktree -> failing test -> implementation -> focused gate -> full gate -> independent review -> commit -> push -> read remote SHA -> CI on that SHA -> update STATUS.md
```

Also state that every pause receives a pushed WIP checkpoint, agents use separate non-overlapping worktrees, a milestone cannot be reported complete from a local commit, and a pruned workspace is recovered only from the last verified remote SHA.

- [ ] **Step 5: Harden the GitHub workflow**

Configure `.github/workflows/verify.yml` to:

```yaml
name: WoofWatcher Verify

on:
  workflow_dispatch:
  push:
    branches:
      - main
      - "release/**"
  pull_request:

permissions:
  contents: read

concurrency:
  group: woofwatcher-verify-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

Pin checkout to `de0fac2e4500dabe0009e67214ff5f5447ce83dd`, pnpm setup to `0977fd99725f1db4007ccb2928dbb4e90d06cc86`, and Node setup to `395ad3262231945c25e8478fd5baf05154b1d79f`. Assert `pnpm --version` is exactly `10.24.0` before installing. Add `node docs/release/tools/validate-store-materials.mjs` after the beta doctor and before focused tests.

- [ ] **Step 6: Make the new status ledger the first current-status source in `AGENTS.md`**

Place `docs/release/STATUS.md` before the dated 2026-07-18 handoff, and state that dated handoffs and the Premium Revenue Product Builder journal retain history but cannot override the exact release-branch SHA and verdict in `STATUS.md`.

- [ ] **Step 7: Run M0 verification**

Run:

```bash
node --test docs/release/tools/durability-policy.test.mjs
node docs/release/tools/validate-store-materials.mjs
pnpm run doctor:mobile-beta:json
pnpm run test:focused
pnpm run build:ci
git diff --check
```

Expected: policy tests PASS; store materials PASS with owner/native blockers reported; doctor `READY_FOR_EXPORT`; 1,037 focused tests plus the new policy tests PASS; full build/export/runtime/live-preview PASS; clean diff check.

- [ ] **Step 8: Commit M0 for independent review**

```bash
git add .github/workflows/verify.yml AGENTS.md docs/operations/DURABLE_DEVELOPMENT_WORKFLOW.md docs/release/STATUS.md docs/release/tools/durability-policy.test.mjs docs/superpowers/plans/2026-08-13-woofwatcher-v1-release-recovery.md
git commit -m "chore: establish durable v1 release control"
```

Expected: the task commit contains only the reviewed M0 files and the worktree is clean.

- [ ] **Step 9: After independent approval, push and verify M0 remotely**

```bash
git push -u origin release/woofwatcher-v1
git ls-remote origin refs/heads/release/woofwatcher-v1
```

Expected: the remote SHA exactly equals local `HEAD`; GitHub Actions `Install, Test, Typecheck, Build` passes on that SHA; `STATUS.md` is updated with the M0 commit and CI URL/result in an additive follow-up commit if needed.

---

### Task 2: Serialized Care Snapshot Persistence

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/carePersistenceWriter.ts`
- Create: `artifacts/woofwatcher-mobile/lib/carePersistenceWriter.test.ts`
- Modify: `artifacts/woofwatcher-mobile/context/CareContext.tsx`
- Modify: `docs/release/STATUS.md`

**Interfaces:**
- Consumes: `CareDoc`, `Entry[]`, `serverVersion`, hydration state, and the existing owner-wipe generation.
- Produces: `createCarePersistenceWriter<T>(write)` with ordered `enqueue`, `invalidateAndDrain`, and `drain` operations; no older snapshot may finish after a newer snapshot or owner wipe.

- [ ] **Step 1: Write failing writer tests**

```ts
test("serializes snapshots so an older slow write cannot overtake the latest state", async () => {
  const first = deferred<void>();
  const writes: string[] = [];
  const writer = createCarePersistenceWriter<string>(async (value) => {
    if (value === "old") await first.promise;
    writes.push(value);
  });
  const oldWrite = writer.enqueue("old");
  const newWrite = writer.enqueue("new");
  first.resolve();
  await Promise.all([oldWrite, newWrite]);
  assert.deepEqual(writes, ["old", "new"]);
});

test("invalidateAndDrain prevents queued pre-wipe snapshots from writing", async () => {
  const first = deferred<void>();
  const writes: string[] = [];
  const writer = createCarePersistenceWriter<string>(async (value) => {
    if (value === "active") await first.promise;
    writes.push(value);
  });
  const active = writer.enqueue("active");
  const stale = writer.enqueue("stale");
  const invalidation = writer.invalidateAndDrain();
  first.resolve();
  await Promise.allSettled([active, stale, invalidation]);
  assert.deepEqual(writes, ["active"]);
});
```

- [ ] **Step 2: Run the new tests and verify the module is missing**

Run: `node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/carePersistenceWriter.test.ts`

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the writer**

```ts
export interface CarePersistenceWriter<T> {
  enqueue(value: T): Promise<void>;
  drain(): Promise<void>;
  invalidateAndDrain(): Promise<void>;
}

export function createCarePersistenceWriter<T>(
  write: (value: T) => Promise<void>,
): CarePersistenceWriter<T>;
```

Each queued job captures the current generation. `invalidateAndDrain()` increments the generation, rejects/skips queued jobs from the prior generation, and resolves only after the active write settles. A rejected write must not stall later valid writes.

- [ ] **Step 4: Replace the unordered CareContext persistence effect**

Create one writer in a ref and change the effect from direct `AsyncStorage.setItem` to `carePersistenceWriter.enqueue(serializedSnapshot)`. Capture the care-write generation with every enqueue, preserve the existing `save-failed` warning behavior, and clear that warning only after the latest accepted snapshot persists.

- [ ] **Step 5: Drain and invalidate before owner deletion removes keys**

At the start of `eraseAllLocalData`, invalidate new pre-wipe persistence work, await `invalidateAndDrain()`, then remove owned keys. After in-memory defaults are installed, allow the normal effect to enqueue only the new pristine snapshot.

- [ ] **Step 6: Run focused and full gates**

Run:

```bash
node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/carePersistenceWriter.test.ts artifacts/woofwatcher-mobile/lib/careSync.test.ts artifacts/woofwatcher-mobile/lib/careWriteProtection.test.ts
pnpm run test:focused
pnpm run typecheck
git diff --check
```

Expected: all tests and typecheck PASS; no direct unordered write remains for `woofwatcher.v2.state`.

- [ ] **Step 7: Review, update the ledger, commit, push, and verify the remote SHA**

Commit message: `fix: serialize durable care snapshot writes`.

---

### Task 3: Coordinated Privacy Export and Local Reset

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/generationPermit.ts`
- Create: `artifacts/woofwatcher-mobile/lib/generationPermit.test.ts`
- Create: `artifacts/woofwatcher-mobile/context/LocalDataResetContext.tsx`
- Create: `artifacts/woofwatcher-mobile/lib/localDataResetCoordinator.ts`
- Create: `artifacts/woofwatcher-mobile/lib/localDataResetCoordinator.test.ts`
- Modify: `artifacts/woofwatcher-mobile/app/_layout.tsx`
- Modify: `artifacts/woofwatcher-mobile/context/CareContext.tsx`
- Modify: `artifacts/woofwatcher-mobile/context/AvatarContext.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/more/PrivacyDataScreen.tsx`
- Modify: `docs/release/STATUS.md`

**Interfaces:**
- Consumes: care reset, avatar reset, AsyncStorage keys, app-file erasure, and privacy export serialization.
- Produces: one reset coordinator with participant registration, one global generation permit, and an explicit `idle | exporting | deleting | failed | complete` operation state.

- [ ] **Step 1: Write failing generation-permit tests**

```ts
test("invalidation revokes every permit captured before a reset", () => {
  const permits = createGenerationPermitAuthority();
  const before = permits.capture();
  assert.equal(permits.isValid(before), true);
  permits.invalidate();
  assert.equal(permits.isValid(before), false);
  assert.equal(permits.isValid(permits.capture()), true);
});
```

- [ ] **Step 2: Write failing coordinator tests**

Cover deterministic participant ordering, duplicate-id rejection, one reset at a time, preparation failure causing zero commits, commit failures returning the exact failed participant ids, and unregister preventing a stale provider from participating.

- [ ] **Step 3: Implement the pure coordinator**

```ts
export interface LocalDataResetParticipant {
  id: string;
  prepare(): Promise<void>;
  commit(): Promise<void>;
}

export interface LocalDataResetResult {
  status: "complete" | "partial-failure";
  committedParticipantIds: string[];
  failedParticipantIds: string[];
}

export interface LocalDataResetCoordinator {
  register(participant: LocalDataResetParticipant): () => void;
  run(): Promise<LocalDataResetResult>;
}
```

`run()` calls every `prepare()` before the first `commit()`. It serializes concurrent calls onto the same promise and never hides a participant failure.

- [ ] **Step 4: Add the reset provider above Care and Avatar providers**

`LocalDataResetProvider` owns the coordinator and generation authority. `CareProvider` and `AvatarProvider` register stable participants and unregister on unmount. The provider exposes `runLocalDataReset`, `operationState`, and `generationAuthority`.

- [ ] **Step 5: Guard Avatar asynchronous hydration and persistence**

Every Avatar load/save/reset captures a permit. Post-await in-memory writes occur only while the permit remains valid. Reset invalidates old work before clearing avatar memory and keys, so a late load or save cannot restore a deleted avatar.

- [ ] **Step 6: Move PrivacyDataScreen onto the coordinator**

Replace raw `Promise.all([eraseAllLocalData(), clearAvatarSet(), resetAvatarConfig()])` with `runLocalDataReset()`. Disable export while deleting and deletion while exporting. Show success only for `complete`; show a retryable failure sheet naming incomplete categories for `partial-failure`.

- [ ] **Step 7: Prove export/reset race behavior**

Add tests showing export captures one immutable snapshot, deletion cannot begin until that export operation settles, and a rejected participant never produces “All data deleted.”

- [ ] **Step 8: Run gates and checkpoint**

Run the new unit tests, `careWriteProtection.test.ts`, `legacyImport.test.ts`, `accountDeletionProof.test.ts`, the full focused suite, TypeScript, and `build:ci`. Commit `fix: coordinate privacy export and local reset`, push, verify remote SHA and CI, then update `STATUS.md`.

---

### Task 4: App-Owned Filesystem Boundary

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/appFileSystem.ts`
- Create: `artifacts/woofwatcher-mobile/lib/appFileSystem.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/durablePickedMedia.ts`
- Modify: `artifacts/woofwatcher-mobile/context/CareContext.tsx`
- Modify: `artifacts/woofwatcher-mobile/context/AvatarContext.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/log.tsx`
- Modify: `artifacts/woofwatcher-mobile/components/health/RecordsScreen.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`
- Modify: `docs/release/STATUS.md`

**Interfaces:**
- Consumes: `expo-file-system/legacy` only inside the facade.
- Produces: injected, testable file inspection/copy/write/delete functions and one registry of app-owned directories.

- [ ] **Step 1: Write failing filesystem-boundary tests**

Cover tri-state inspection (`exists`, `missing`, `unknown`), idempotent directory deletion, cache URI copy into `woofwatcher-attachments/`, unchanged state after copy failure, report directory cleanup, and web no-op behavior.

- [ ] **Step 2: Implement the facade**

```ts
export const APP_OWNED_DIRECTORIES = [
  "WoofWatcherReports",
  "woofwatcher-attachments",
] as const;

export type FileAvailability = "exists" | "missing" | "unknown";

export interface AppFileSystem {
  inspect(uri: string): Promise<FileAvailability>;
  persistPickedFile(input: { sourceUri: string; fileName: string }): Promise<string>;
  deleteAllOwnedFiles(): Promise<{ deleted: string[]; failed: string[] }>;
}
```

Transient inspection errors return `unknown`, never `missing`. Native code lazily accesses the Expo module; web remains a deterministic no-op/fallback.

- [ ] **Step 3: Remove direct filesystem imports from contexts and screens**

After refactoring, only `lib/appFileSystem.ts` may import `expo-file-system/legacy`. Add a readiness assertion that fails if another production `.ts` or `.tsx` file imports it.

- [ ] **Step 4: Register file deletion with the reset coordinator**

The file participant prepares without mutation, then calls `deleteAllOwnedFiles()` during commit. Any failed directory returns `partial-failure`; PrivacyDataScreen must not claim total deletion.

- [ ] **Step 5: Run gates and checkpoint**

Run `appFileSystem.test.ts`, `durablePickedMedia.test.ts`, report export tests, `mobileReadiness.test.ts`, full focused tests, TypeScript, and `build:ci`. Commit `refactor: centralize app-owned file lifecycle`, push, verify SHA/CI, update status.

---

### Task 5: Durable Walk Route Checkpoints

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/walkRouteCheckpoint.ts`
- Create: `artifacts/woofwatcher-mobile/lib/walkRouteCheckpoint.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/walkRoute.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/walkRoute.test.ts`
- Modify: `artifacts/woofwatcher-mobile/components/WalkRouteRecorder.tsx`
- Modify: `artifacts/woofwatcher-mobile/context/LocalDataResetContext.tsx`
- Modify: `docs/release/STATUS.md`

**Interfaces:**
- Consumes: stable walk `sessionKey`, accepted route points, AsyncStorage, serialized persistence, and reset generation.
- Produces: schema-versioned local checkpoint recovery across component remount and native process restart.

- [ ] **Step 1: Write failing checkpoint tests**

```ts
test("restores only the checkpoint matching the persisted open walk", async () => {
  await store.save({ schemaVersion: 1, sessionKey: "walk-a", points, updatedAt: 100 });
  assert.deepEqual(await store.load("walk-a"), { sessionKey: "walk-a", points });
  assert.equal(await store.load("walk-b"), null);
});

test("clear waits behind the last point write so a finished route cannot reappear", async () => {
  const save = store.save(checkpoint);
  const clear = store.clear("walk-a");
  await Promise.all([save, clear]);
  assert.equal(await store.load("walk-a"), null);
});
```

Also cover corrupt JSON recovery, invalid coordinates, stale session mismatch, maximum point count, reset invalidation, and storage failure without crashing the walk.

- [ ] **Step 2: Implement the checkpoint store**

```ts
export const WALK_ROUTE_CHECKPOINT_KEY = "woofwatcher.walk-route-checkpoint.v1";

export interface WalkRouteCheckpoint {
  schemaVersion: 1;
  sessionKey: string;
  points: WalkRoutePoint[];
  updatedAt: number;
}
```

Use a serialized writer. `load(sessionKey)` returns only validated matching data. `clear(sessionKey)` cannot be overtaken by an older save.

- [ ] **Step 3: Resume capture from a matching checkpoint**

Make `startWalkRouteCapture(sessionKey)` load the checkpoint before establishing the platform watch. Every accepted point queues a checkpoint save. A generation check prevents a late load from replacing a newer session.

- [ ] **Step 4: Make finish and cancel asynchronous and durable**

`finishWalkRouteCapture(sessionKey)` and `cancelWalkRouteCapture(sessionKey)` must clear and drain the checkpoint before returning. Update `WalkRouteRecorderBridge` to await the result and then persist the finished route exactly once.

- [ ] **Step 5: Register checkpoint deletion with local reset**

The owner wipe clears the walk checkpoint even if no Walk recorder component is mounted.

- [ ] **Step 6: Run gates and checkpoint**

Run walk route/session/avatar motion tests, full focused tests, TypeScript, and `build:ci`. Commit `fix: recover active walk routes after relaunch`, push, verify remote SHA/CI, update status.

---

### Task 6: Shared Accessible Modal Contract

**Files:**
- Create: `artifacts/woofwatcher-mobile/components/AccessibleSheetModal.tsx`
- Create: `artifacts/woofwatcher-mobile/lib/accessibleModalContract.ts`
- Create: `artifacts/woofwatcher-mobile/lib/accessibleModalContract.test.ts`
- Modify: all production modal owners reported by the contract test under `app/` and `components/`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`
- Modify: `docs/release/STATUS.md`

**Interfaces:**
- Consumes: React Native `Modal`, safe-area insets, reduced-motion preference, explicit title/description, cancel callback, and initial-focus ref.
- Produces: one sheet/alert facade with dialog semantics, safe-area padding, focus restoration, Back/Escape cancellation, large-text scrolling, and consistent touch targets.

- [ ] **Step 1: Write the failing modal inventory contract**

Scan production `.tsx` files and assert that raw `Modal` imports/usages exist only inside `AccessibleSheetModal.tsx`, `WebDialogHost.tsx`, and `ErrorFallback.tsx`. Require every facade call to supply `title`, `onRequestClose`, and `presentation`.

- [ ] **Step 2: Implement the shared facade**

```ts
export interface AccessibleSheetModalProps {
  visible: boolean;
  title: string;
  description?: string;
  presentation: "sheet" | "alert";
  onRequestClose(): void;
  children: React.ReactNode;
}
```

The facade uses `accessibilityViewIsModal`, an accessible heading, 48×48 minimum close target, `allowFontScaling`, a scrollable content region, safe-area bottom padding, reduced/fade motion when requested, and focus restoration on close.

- [ ] **Step 3: Migrate one bounded owner at a time**

Order: Privacy, Diet, Setup, Dog Profile, WoofGuide, Records, Calendar, Log, Care Team/Supplies, More provider setup. After each owner, run its existing focused tests and the modal inventory test.

- [ ] **Step 4: Verify destructive cancellation is a no-op**

Add tests for delete cancellation, native Back/Escape cancellation, no background activation while visible, and no duplicate confirmation callback.

- [ ] **Step 5: Run gates and checkpoint**

Run modal contract, mobile readiness/layout, full focused tests, TypeScript, `build:ci`, and rendered web interaction checks. Commit `feat: unify accessible modal behavior`, push, verify SHA/CI, update status.

---

### Task 7: Theme, Motion, and Permission Consistency

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/permissionOutcome.ts`
- Create: `artifacts/woofwatcher-mobile/lib/permissionOutcome.test.ts`
- Create: `artifacts/woofwatcher-mobile/hooks/useReducedMotion.ts`
- Modify: `artifacts/woofwatcher-mobile/hooks/useColors.ts`
- Modify: `artifacts/woofwatcher-mobile/app/_layout.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/walkRoute.ts`
- Modify: animated components and permission callers identified by repository scans
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`
- Modify: `docs/release/STATUS.md`

**Interfaces:**
- Consumes: system color scheme, AccessibilityInfo reduced-motion setting, and native/web permission results.
- Produces: real automatic web/native theme behavior, one reduced-motion source, and one permission classifier with denied/restricted/unavailable/error recovery copy.

- [ ] **Step 1: Write failing theme and permission tests**

Assert web follows the actual scheme without an export-only environment switch. For permissions, cover `granted`, `denied-can-ask`, `denied-permanent`, `restricted`, `unavailable`, and `error`, with a deterministic owner action for each.

- [ ] **Step 2: Remove the forced-light web exception**

`useColors()` selects `colors.dark` whenever `useColorScheme()` is `dark` on every platform. Root navigation theme, status bar, web frame/background, and modal surfaces consume the same result.

- [ ] **Step 3: Implement one reduced-motion hook and migrate looping/entrance motion**

The hook listens to native AccessibilityInfo and web `prefers-reduced-motion`. Reduced mode freezes decorative loops on a meaningful frame, replaces long transforms with opacity/no animation, and preserves feedback required to understand state changes.

- [ ] **Step 4: Centralize permission outcomes**

Walk route capture uses the classifier and requests foreground location only after the owner starts a walk. Denial never breaks the walk log. Permanent denial offers Settings; restricted/unavailable explains that route capture is unavailable; transient error offers retry. No background location or microphone permission may be introduced.

- [ ] **Step 5: Run gates and checkpoint**

Run permission, motion, avatar, theme/readiness tests, full focused tests, TypeScript, `build:ci`, and dark/reduced-motion rendered browser probes. Commit `fix: unify theme motion and permission behavior`, push, verify SHA/CI, update status.

---

### Task 8: Exact-Tree Rendered and Native Beta Proof

**Files:**
- Create: `docs/qa/2026-08-13-v1-release-recovery-evidence.md`
- Create or update: `docs/release/CARE_TWIN_NATIVE_QA_MATRIX.md`
- Update: `docs/release/STATUS.md`
- Update only when results exist: `docs/release/GO_LIVE_CHECKLIST.md`

**Interfaces:**
- Consumes: exact release candidate SHA, fresh CI, Expo export, route manifest, EAS artifacts, physical iOS/Android devices, and owner review.
- Produces: a beta candidate verdict tied to immutable code and evidence; it cannot silently promote browser proof into native proof.

- [ ] **Step 1: Run exact-tree automated gates**

```bash
pnpm install --frozen-lockfile
pnpm run doctor:mobile-beta:json
pnpm run test:focused
pnpm run build:ci
node docs/release/tools/validate-store-materials.mjs
git diff --check
```

Record command, runtime versions, start/end timestamp, exact SHA, result counts, export bundle hash, and route counts.

- [ ] **Step 2: Re-run rendered navigation at both canonical viewports**

Verify all 47 runtime routes and 56 live-preview targets, canonical tab selection, legacy redirects, re-tap behavior, browser Back/Forward, reload persistence, modal cancellation, dark theme, and reduced motion at 390×844 and 430×932. Store the report and screenshot manifest under a commit-named evidence directory; record hashes in the QA document.

- [ ] **Step 3: Produce signed internal iOS and Android builds tied to the SHA**

Run EAS preview profiles only after Expo, Apple, and Google credentials are available. Record EAS project id, build ids, artifact URLs/checksums, bundle/application ids, build profile, runtime version, and Git SHA. Do not submit to either store in this step.

- [ ] **Step 4: Execute physical-device matrix**

On iOS and Android verify onboarding/local setup, Home quick logs, meal outcomes, walk start/background/foreground/process-relaunch/finish, correction/delete, Plans, Records file share/reopen, privacy export/reset, dark theme, reduced motion, large text, safe areas, 48×48 targets, one intended haptic per tab action, native Back/deep links, permission denial/permanent denial, VoiceOver, and TalkBack.

- [ ] **Step 5: Record evidence without overclaiming**

For every device row record device, OS, build id, SHA, exact action, expected result, observed result, screenshot/video filename, artifact MIME/byte size where relevant, and PASS/FAIL/BLOCKED. A missing platform row remains `PENDING NATIVE`.

- [ ] **Step 6: Resolve release-candidate findings with additive commits**

Only blocker/important findings may change the candidate. Each fix receives a failing test where reproducible, focused/full gates, independent review, remote push, CI on the new SHA, and a new evidence run. Never reuse proof from an older SHA.

- [ ] **Step 7: Mark internal beta ready only when every beta gate passes**

The final status may become `READY FOR INTERNAL BETA` after automated, rendered, iOS, and Android matrices pass. Public submission remains blocked until legal/store metadata, App Store Connect/Play records, signed-build installation, privacy forms, support contact details, art/font rights, and Apollo’s approval of the exact SHA are recorded.

- [ ] **Step 8: Commit, push, verify CI, and hand off the exact candidate**

Commit message: `docs: record exact-tree v1 beta evidence`. Push, verify remote SHA and CI, then report the SHA, build ids, verdict, remaining owner gates, and links to the status/evidence files.

---

## Self-Review Record

- Spec coverage: durability, data write ordering, cross-provider reset, file lifecycle, walk relaunch recovery, accessible modals, dark theme, reduced motion, permissions, browser evidence, native evidence, and store truth boundaries each map to a task.
- Scope boundary: provider-backed auth/sync/storage/AI/payments/push are not silently added to free local-first V1; their future Full Premium requirements remain documented separately.
- Type consistency: the generation authority, reset participant/result, persistence writer, filesystem facade, checkpoint schema, and modal props are defined before their consumers.
- Recovery property: every task ends in a reviewed remote SHA and `STATUS.md` update, so workspace pruning cannot erase an accepted milestone.
