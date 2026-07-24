# WoofWatcher Premium iOS Renovation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the verified July 22 WoofWatcher branch into a trustworthy, simpler, premium iOS-first dog-care app whose local/cloud data boundaries are safe, whose primary care loop is obvious, and whose release claims are backed by real evidence.

**Architecture:** Preserve the Expo Router app, local-first `CareContext`, shared `lib/care-domain`, Express/Drizzle API, and existing care workflows. First close confirmed account, privacy, wipe, household, concurrency, and history-loss defects behind tested interfaces. Then reconcile the five safe newer-branch improvements, replace simulated wellness claims with a shared evidence model, and simplify the shell to Today / Plan / Quick Log / Health / More with one reusable logging controller.

**Tech Stack:** Node 24, pnpm 10.24.0 workspaces, Expo SDK 54, Expo Router 6, React Native 0.81, React 19, TypeScript 5.9, React Query, Clerk Expo, AsyncStorage, Express, Drizzle/Postgres/Supabase, Node test runner, Playwright/Chromium web-export QA.

## Global Constraints

- Work only from `c0531bebbde7ca546feda7f34d585f8af249cfe1` or its `codex/woofwatcher-premium-renovation` continuation; never merge `b771a4a6`.
- Canonical product surface: `artifacts/woofwatcher-mobile`; shared care rules stay in `lib/care-domain`; API rules stay in `artifacts/api-server`.
- Node 24 and pnpm `10.24.0` are required. The pre-change baseline is exactly 740 focused tests passing, full workspace typecheck passing, and Expo web export passing.
- No production behavior change without a failing regression test first. Confirm the failure reason, then implement the smallest passing change.
- Every number, meter, status, waypoint, completion, and health statement must be derived from real owner-entered evidence or render an explicit unknown/not-logged state.
- Health language organizes evidence for owner/veterinarian review and never diagnoses, treats, or claims emergency certainty.
- A control labeled private is a server-enforced authorization boundary, not merely a report filter.
- Local persistence failures, refresh failures, partial wipes, conflicts, and offline work must be visible; never imply success after a failed operation.
- A wipe cannot be undone by a stale asynchronous result. Every post-`await` write path checks the current erase/identity generation.
- Preserve meal served-to-outcome, Potty parent/outcome, routines-to-logs matching, Health/Bile Watch, Records, Care Pass, WoofGuide owner review, privacy/export, and real-care XP behavior.
- Visible primary navigation is exactly Today, Plan, central Quick Log, Health, More. Pack, Story, Records, Adventure, Avatar Studio, Care Pass, Log History, and internal QA remain routable secondary surfaces.
- One motion vocabulary only: `components/motion/GameFeel.tsx`; all loops honor Reduce Motion.
- UI colors come from `constants/colors.ts`; primary/forest surfaces use `primaryForeground`; copper/warm surfaces use the reviewed `warmForeground` token.
- Do not claim cloud sync, push, payments, live AI, document storage, TestFlight, App Store, or public launch unless the matching provider and native proof exists.
- Keep existing untracked files outside task scope unless their ownership is resolved: `artifacts/woofwatcher-mobile/components/AnimatedAvatar.tsx`, `docs/release/tools/store-panels.mjs`, and `docs/release/tools/store-shots.mjs`.

---

### Task 1: Account- and household-scoped local care storage

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/careStorageScope.ts`
- Create: `artifacts/woofwatcher-mobile/lib/careStorageScope.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/auth.ts`
- Modify: `artifacts/woofwatcher-mobile/context/CareContext.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/_layout.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`

**Interfaces:**
- Produces:
  - `type CareStorageScope = { kind: "local" } | { kind: "account"; userId: string; householdId: string }`
  - `getCareStorageKey(scope: CareStorageScope): string`
  - `getCareRecoveryKey(scope: CareStorageScope): string`
  - `shouldAdoptUnscopedV2Cache(input: { clerkConfigured: boolean; scope: CareStorageScope }): boolean`
  - `useWoofAuth()` exposes `userId: string | null`.
- `CareProvider` resolves `/me` before selecting an account scope, clears its live refs and React Query cache when scope changes, hydrates that scope, then permits sync.

- [ ] **Step 1: Write failing scope tests**

```ts
test("different accounts and households never share a care cache key", () => {
  assert.notEqual(
    getCareStorageKey({ kind: "account", userId: "user_a", householdId: "house_1" }),
    getCareStorageKey({ kind: "account", userId: "user_b", householdId: "house_1" }),
  );
  assert.notEqual(
    getCareStorageKey({ kind: "account", userId: "user_a", householdId: "house_1" }),
    getCareStorageKey({ kind: "account", userId: "user_a", householdId: "house_2" }),
  );
});

test("an unscoped v2 cache is adopted only by the explicit local-preview scope", () => {
  assert.equal(
    shouldAdoptUnscopedV2Cache({ clerkConfigured: false, scope: { kind: "local" } }),
    true,
  );
  assert.equal(
    shouldAdoptUnscopedV2Cache({
      clerkConfigured: true,
      scope: { kind: "account", userId: "user_b", householdId: "house_2" },
    }),
    false,
  );
});
```

- [ ] **Step 2: Run the tests and confirm RED**

Run: `node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/careStorageScope.test.ts`

Expected: FAIL because `careStorageScope.ts` and the scoped key functions do not exist.

- [ ] **Step 3: Implement scoped keys and auth identity**

Use `woofwatcher.v3.local` for local preview and
`woofwatcher.v3.account.${encodeURIComponent(userId)}.${encodeURIComponent(householdId)}`
for authenticated care. Keep `woofwatcher.v2.state` as a quarantined legacy backup when Clerk is configured; never infer that it belongs to the current account.

- [ ] **Step 4: Gate CareContext lifecycle on a stable scope**

On identity/scope change: increment an identity generation, pause persistence and sync, clear `docRef`, `entriesRef`, version/id maps, and React Query account data, load the new key, update refs synchronously, set `hydrated`, and only then call `syncFromServer`. A rejected read keeps persistence and sync paused with `storageWarning: "read-failed"`.

- [ ] **Step 5: Add source/lifecycle guards**

Extend `mobileReadiness.test.ts` to require `userId`, `household.id`, scoped storage keys, query-cache clearing, and `hydrated` in the automatic-sync guard.

- [ ] **Step 6: Verify and commit**

Run:

```bash
node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/careStorageScope.test.ts artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
pnpm --filter @workspace/woofwatcher-mobile run typecheck
```

Commit: `fix(data): isolate care state by account and household`

---

### Task 2: Wipe receipts and stale-mutation resurrection guards

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/careDeviceWipe.ts`
- Create: `artifacts/woofwatcher-mobile/lib/careDeviceWipe.test.ts`
- Modify: `artifacts/woofwatcher-mobile/context/CareContext.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/privacy.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/privacySafety.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`

**Interfaces:**
- Produces:
  - `type WipeTarget = "async-storage" | "reports" | "attachments" | "query-cache"`
  - `type CareDeviceWipeReceipt = { mode: "device-only"; complete: boolean; steps: Array<{ target: WipeTarget; status: "deleted" | "failed" | "not-applicable"; message?: string }> }`
  - `runCareDeviceWipe(adapters): Promise<CareDeviceWipeReceipt>`
- Changes `eraseAllLocalData(): Promise<CareDeviceWipeReceipt>`.

- [ ] **Step 1: Write failing receipt tests**

Cover all-success, AsyncStorage failure, one directory failure, and web not-applicable behavior. Assert `complete === false` whenever a required target fails.

- [ ] **Step 2: Confirm RED**

Run: `node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/careDeviceWipe.test.ts`

Expected: FAIL because the receipt runner does not exist.

- [ ] **Step 3: Implement the injected wipe runner**

The helper must never swallow a required failure. It returns one result per target and does not convert partial completion into success.

- [ ] **Step 4: Guard every create/update callback**

In `persistEntryCreate`, its queued PATCH, `persistEntryUpdate`, and direct `updateEntry`, capture both erase and identity generations before the request. Check both generations before every success or failure state/ref write. Clear query cache and pending mutation maps during wipe.

- [ ] **Step 5: Make the Privacy result truthful**

When signed in, label the action “Clear care from this device” and disclose that synced provider data remains. Show “Device cleared” only for `receipt.complete`; otherwise show the exact failed targets and a Retry action. Keep provider account deletion behind its existing proof gate.

- [ ] **Step 6: Verify and commit**

Run:

```bash
node --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/careDeviceWipe.test.ts artifacts/woofwatcher-mobile/lib/privacySafety.test.ts artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
pnpm --filter @workspace/woofwatcher-mobile run typecheck
```

Commit: `fix(data): make device wipes final and truthful`

---

### Task 3: Server-enforced private care entries

**Files:**
- Create: `supabase/migrations/0004_care_entry_visibility.sql`
- Modify: `lib/db/src/schema/careEntries.ts`
- Modify: `artifacts/api-server/src/routes/care-entries-router.ts`
- Modify: `artifacts/api-server/src/index.ts`
- Modify: `artifacts/api-server/test/careEntryRoutes.test.ts`
- Modify: `artifacts/api-server/test/apiReadiness.test.ts`
- Modify: `artifacts/woofwatcher-mobile/context/CareContext.tsx`

**Interfaces:**
- Adds `household_visible boolean not null default true` to `care_entries`.
- Adds `household_visible boolean not null default true` and `caregiver_user_id text` to `care_entry_tombstones`.
- List/read visibility condition is `household_visible = true OR caregiver_user_id = authenticatedUserId`.
- Private update/delete is author-only; shared update/delete retains the existing role policy.

- [ ] **Step 1: Add failing real-route tests**

Drive the Express router as two users in one household. Prove A can read its private row, B cannot, both can read a shared row, B cannot update/delete A’s private row, and B does not receive A’s private tombstone.

- [ ] **Step 2: Confirm RED**

Run: `node --experimental-strip-types --test artifacts/api-server/test/careEntryRoutes.test.ts`

Expected: FAIL because list returns every household row and write paths do not check private authorship.

- [ ] **Step 3: Add the migration/schema and route predicates**

Derive `householdVisible` from `details.householdVisible !== false` on create/update. Persist creator identity on tombstones. Add Drizzle `or` support to router dependencies and apply the same visibility predicate to full, cursor, and tombstone reads.

- [ ] **Step 4: Preserve creator identity on mobile**

Extend `Entry` with `caregiverUserId?: string`; map it from API rows and retain it through optimistic merges.

- [ ] **Step 5: Verify and commit**

Run:

```bash
node --experimental-strip-types --test artifacts/api-server/test/careEntryRoutes.test.ts artifacts/api-server/test/apiReadiness.test.ts lib/care-domain/test/share-privacy-regression.test.ts
pnpm run typecheck
```

Commit: `fix(privacy): enforce private logs on the server`

---

### Task 4: Durable active-household selection and invitation authority

**Files:**
- Create: `supabase/migrations/0005_user_active_household.sql`
- Modify: `lib/db/src/schema/users.ts`
- Modify: `artifacts/api-server/src/lib/household.ts`
- Modify: `artifacts/api-server/src/routes/household.ts`
- Modify: `lib/api-spec/openapi.yaml`
- Regenerate: `lib/api-zod/src/generated/*`
- Regenerate: `lib/api-client-react/src/generated/*`
- Modify: `artifacts/api-server/test/householdInvitation.test.ts`
- Modify: `artifacts/api-server/test/apiReadiness.test.ts`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/more.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`

**Interfaces:**
- Adds `users.active_household_id`.
- Adds authenticated endpoints to list the caller’s memberships and select an active household.
- Successful invitation acceptance atomically marks the invitation accepted, creates membership once, and sets the joined household active.
- Production join accepts only durable invitation rows; the permanent `households.invite_code` fallback is removed.
- Household rename requires owner/admin authority.

- [ ] **Step 1: Write failing API tests**

Prove: a fresh user joins H2 and subsequent `/me`, care-state, and care-entry resolution uses H2; static household codes cannot join; revoked/expired/accepted invitation codes cannot be reused; helper/kid/expired-pass roles cannot rename; exactly one concurrent acceptance succeeds.

- [ ] **Step 2: Confirm RED**

Run:

```bash
node --experimental-strip-types --test artifacts/api-server/test/householdInvitation.test.ts artifacts/api-server/test/apiReadiness.test.ts
```

Expected: FAIL on post-join active selection, legacy fallback, rename authorization, and concurrent acceptance.

- [ ] **Step 3: Implement durable selection and atomic acceptance**

Resolve `activeHouseholdId` only when the user still has membership; otherwise fall back to the earliest valid membership and persist it. Claim an invitation with a conditional approved-state update inside the same transaction that creates membership and updates the user.

- [ ] **Step 4: Replace More’s permanent-code share flow**

Create an approved, expiring invitation through the generated API and share that invitation’s code. Add an owner-visible household switcher backed by the membership list; after selection, clear React Query and let Task 1 rehydrate the selected household cache.

- [ ] **Step 5: Verify and commit**

Run:

```bash
node --experimental-strip-types --test artifacts/api-server/test/householdInvitation.test.ts artifacts/api-server/test/apiReadiness.test.ts artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts
pnpm run typecheck
```

Commit: `fix(household): make joined packs active and invitations revocable`

---

### Task 5: Atomic care-document compare-and-swap and three-way reconciliation

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/careDocMerge.ts`
- Create: `artifacts/woofwatcher-mobile/lib/careDocMerge.test.ts`
- Modify: `artifacts/api-server/src/routes/care-state.ts`
- Modify: `artifacts/api-server/test/apiReadiness.test.ts`
- Modify: `artifacts/woofwatcher-mobile/context/CareContext.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/careSync.test.ts`

**Interfaces:**
- Produces `mergeCareDocThreeWay<T extends CareDoc>(input: { base: T; server: T; local: T }): { doc: T; conflicts: CareDocConflict[] }`.
- Stable-id arrays (`routines`, `records`, `calendarEvents`, `reportArtifacts`, `accessPasses`, `adventureMemories`, `pets`) merge by id.
- Disjoint field edits survive; same-field edits return an explicit conflict and keep the latest local value only after surfacing it.

- [ ] **Step 1: Write failing CAS and merge tests**

Add a concurrent route test where two version-7 writes produce exactly one 200 and one 409. Add pure tests where A changes routines and B changes diet, and both changes survive; same-record edits produce a conflict row.

- [ ] **Step 2: Confirm RED**

Run:

```bash
node --experimental-strip-types --test artifacts/api-server/test/apiReadiness.test.ts artifacts/woofwatcher-mobile/lib/careDocMerge.test.ts artifacts/woofwatcher-mobile/lib/careSync.test.ts
```

- [ ] **Step 3: Implement SQL compare-and-swap**

Update with `WHERE household_id = householdId AND version = expectedVersion`, increment using the database value, and return 409 with the current envelope when no row returns.

- [ ] **Step 4: Track the last acknowledged base document**

Store `baseDocRef` per storage scope. On 409 merge `baseDocRef`, server doc, and current `docRef`; never shallow-spread the entire stale local document over the server. Surface same-field conflicts in sync status instead of silently discarding either edit.

- [ ] **Step 5: Verify and commit**

Run the three focused files above plus `pnpm run typecheck`.

Commit: `fix(sync): preserve disjoint household edits`

---

### Task 6: Ordered, revision-safe care-entry updates

**Files:**
- Create: `supabase/migrations/0006_care_entry_revision.sql`
- Modify: `lib/db/src/schema/careEntries.ts`
- Modify: `lib/api-spec/openapi.yaml`
- Regenerate: `lib/api-zod/src/generated/*`
- Regenerate: `lib/api-client-react/src/generated/*`
- Modify: `artifacts/api-server/src/routes/care-entries-router.ts`
- Modify: `artifacts/api-server/test/careEntryRoutes.test.ts`
- Create: `artifacts/woofwatcher-mobile/lib/careEntryMutationQueue.ts`
- Create: `artifacts/woofwatcher-mobile/lib/careEntryMutationQueue.test.ts`
- Modify: `artifacts/woofwatcher-mobile/context/CareContext.tsx`

**Interfaces:**
- Adds `revision integer not null default 1`.
- PATCH accepts `expectedRevision`; SQL update requires that revision and increments it atomically.
- Produces a per-entry mutation queue that coalesces pending patches and never applies an older response after a newer optimistic edit.

- [ ] **Step 1: Write reverse-resolution tests**

Queue two patches for one entry, resolve the newer request first in the harness, and assert the final note/mood is the newest edit. Add a route test proving stale `expectedRevision` receives 409.

- [ ] **Step 2: Confirm RED**

Run the new queue test and `careEntryRoutes.test.ts`; expect stale responses to overwrite and PATCH to accept stale revisions.

- [ ] **Step 3: Implement revision CAS and the serialized queue**

Store revision on mobile entries. Send one PATCH per entry at a time, coalesce later patches, and issue the next request from the latest optimistic row after the previous settles. Treat 409 as a visible sync conflict, never as synced success.

- [ ] **Step 4: Verify and commit**

Run the two focused test files, `careSync.test.ts`, and workspace typecheck.

Commit: `fix(sync): serialize care-entry edits by revision`

---

### Task 7: Complete, stable care-history pagination

**Files:**
- Modify: `artifacts/api-server/src/lib/care-entry-query.ts`
- Modify: `artifacts/api-server/src/routes/care-entries-router.ts`
- Modify: `lib/api-spec/openapi.yaml`
- Regenerate: `lib/api-zod/src/generated/*`
- Regenerate: `lib/api-client-react/src/generated/*`
- Modify: `artifacts/api-server/test/careEntryQuery.test.ts`
- Modify: `artifacts/api-server/test/careEntryRoutes.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/careSync.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/careSync.test.ts`
- Modify: `artifacts/woofwatcher-mobile/context/CareContext.tsx`

**Interfaces:**
- Adds stable descending history cursor inputs `beforeOccurredAt` and `beforeId`.
- Server ordering is `occurredAt DESC, id DESC`.
- Produces `loadCompleteCareEntrySnapshot(fetchPage, pageSize = 500): Promise<ApiCareEntry[]>`.
- Replacement merge occurs only after all pages complete.

- [ ] **Step 1: Write failing 251/501-row tests**

Assert all ids survive, identical timestamps use id tie-breaking, and a failed second page leaves the previous cached snapshot intact.

- [ ] **Step 2: Confirm RED**

Run the care-entry query, route, and careSync tests. Expect current “full” refresh to return 250 and drop absent synced rows.

- [ ] **Step 3: Implement stable keyset pagination**

When a page has `pageSize` rows, request the next page using the last row’s tuple. Stop on a shorter page. Do not mutate live state until the complete snapshot is available.

- [ ] **Step 4: Verify and commit**

Run the three focused suites, workspace typecheck, and the full 740-test command.

Commit: `fix(sync): retain complete care history`

---

### Task 8: Reconcile staged-auth error handling

**Files:**
- Modify: `artifacts/woofwatcher-mobile/app/(auth)/sign-in.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/(auth)/sign-up.tsx`
- Modify: `artifacts/woofwatcher-mobile/eas.json`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`

**Source:** Manually replay the behavior of `ae20ee81811763b2cbd7e864e5af787fd0260afb`; do not merge surrounding branch work.

- [ ] Add failing readiness/behavior checks for rejected sign-in, rejected verification, resend failure, and explicit development auth enforcement.
- [ ] Run the checks and confirm current async actions can reject without owner-visible errors.
- [ ] Add bounded `try/catch/finally` handling and accessible error copy; enable `EXPO_PUBLIC_ENFORCE_AUTH_IN_DEV=true` only in the development EAS profile.
- [ ] Run mobile readiness, typecheck, and auth web route smoke.
- [ ] Commit: `fix(auth): surface staged sign-in failures`

---

### Task 9: Make household refresh failure visible

**Files:**
- Modify: `artifacts/woofwatcher-mobile/lib/careSync.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/careSync.test.ts`
- Modify: `artifacts/woofwatcher-mobile/context/CareContext.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/more.tsx`

**Source:** Manually port only the additive behavior of `e327d82581e8976275e82580e9911a7c01d8c6d5`; preserve Tasks 1–7.

- [ ] Add a failing dashboard test for `refreshError` with copy stating cached/local care remains saved.
- [ ] Confirm RED.
- [ ] Add `syncRefreshError`, clear it on a new/successful refresh, set it on fetch failure, and render Retry in More.
- [ ] Run `careSync.test.ts`, mobile readiness, typecheck, and commit: `fix(sync): surface household refresh failures`.

---

### Task 10: Prevent invalid partial-meal saves and complete privacy-toggle semantics

**Files:**
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/log.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`

**Source:** Replay `c01d1f67d613759db0b3cf1cff269f3fb0415177`; manually port only the accessibility delta from `b771a4a6e2e1a808ca359ce74cc1d2b8e8bbf9ad`.

- [ ] Add failing tests that Save is disabled and a live validation message appears when partial-meal amount is blank/malformed.
- [ ] Add a failing accessibility source test requiring role switch, `aria-checked`, native `accessibilityState.checked`, and state-specific hints.
- [ ] Confirm RED.
- [ ] Implement the minimal validation/semantics without changing Task 3’s server privacy boundary.
- [ ] Run mobile readiness, mobile typecheck, and web DOM accessibility probe.
- [ ] Commit: `fix(log): validate partial meals and announce privacy state`.

---

### Task 11: Add the reviewed warm-action foreground token

**Files:**
- Modify: `artifacts/woofwatcher-mobile/constants/colors.ts`
- Modify only affected call sites in `app/(tabs)/calendar.tsx`, `app/(tabs)/more.tsx`, and `app/+not-found.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`

**Source:** Manually port only the token/call-site behavior of `0a5c7bc00359eeeeaaff3b81744f1b423030cea2`.

- [ ] Add a failing token test for light `#050A12` and dark `#081424`.
- [ ] Confirm RED.
- [ ] Add `warmForeground`; replace only text/icon foreground on copper/warm actions.
- [ ] Render the three affected routes in light and dark mode and run an automated contrast calculation requiring WCAG AA for normal text.
- [ ] Commit: `fix(ui): restore warm action contrast`.

---

### Task 12: Replace simulated wellness with a shared evidence model

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/careEvidence.ts`
- Create: `artifacts/woofwatcher-mobile/lib/careEvidence.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/phoenixStatus.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/avatarMotion.ts`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/index.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/health.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`

**Interfaces:**
- Produces:
  - `type EvidenceStatus = "observed" | "not-logged" | "watch"`
  - `type EvidenceLaneId = "mood" | "energy" | "appetite" | "hydration" | "stool" | "activity"`
  - `deriveCareEvidenceSnapshot(entries, now): { windowDays: 7; observedCount: number; totalCount: 6; lanes: EvidenceLane[] }`
- No numeric “health score” remains.

- [ ] **Step 1: Write failing honesty tests**

Prove zero entries yields six `not-logged` lanes; an unrelated note does not unlock positive claims; explicit mood/energy, meal, water, poop, and walk evidence unlock only their own lanes; private entries are excluded from household summaries.

- [ ] **Step 2: Confirm RED**

Run `careEvidence.test.ts`; expect missing module/current synthetic behavior.

- [ ] **Step 3: Implement factual derivation**

Mood and energy labels require explicit recent owner input. The avatar may use a neutral idle animation with no observation, but Home copy reads “Not logged,” never “Content,” “Impatient,” or “64%” without evidence.

- [ ] **Step 4: Replace Health score/positive defaults**

Render “Care evidence · N of 6 observed in 7 days,” named evidence rows, timestamps, and explicit missing prompts. Remove the arbitrary base 94 and independently gate Activity/Appetite/Stool/Hydration/Energy claims.

- [ ] **Step 5: Verify and commit**

Run the new tests, mobile readiness, care-domain health tests, mobile typecheck, and screenshot Home/Health at zero and populated data.

Commit: `fix(health): show evidence instead of simulated wellness`

---

### Task 13: Honest Plan, supplies, and unconfigured identity states

**Files:**
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/calendar.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/packSupplies.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/packSupplies.test.ts`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/pack.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/petIdentity.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`

- [ ] Add failing tests for no fictional completed routines, untouched supplies as `unconfirmed`, and an unconfigured production identity resolving to “Your dog” rather than a configured Phoenix.
- [ ] Confirm RED.
- [ ] Replace Plan’s fictional day with dashed structural routine placeholders and one Add first routine action.
- [ ] Add `unconfirmed` to supply status; first owner tap moves to Plenty, then Low, Out, Plenty.
- [ ] Preserve Phoenix only when it is the saved real profile or an explicitly labeled preview/demo channel.
- [ ] Run focused tests, typecheck, zero-data screenshots, and commit: `fix(empty): keep starter states honest`.

---

### Task 14: Five-destination care-loop navigation

**Files:**
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/_layout.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileLayout.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileLayout.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`
- Modify route headers/back controls in `log.tsx`, `health.tsx`, `more.tsx`, and secondary routes as required.

**Visible contract:** Today / Plan / Quick Log / Health / More. The center action always opens `/fastlog`, is always labeled “Quick Log,” and never changes meaning based on the current tab.

- [ ] Add failing route/source tests for the exact five labels, one Quick Log meaning, visible Health/More, hidden secondary Pack/Story/Records/Log History, and valid secondary route links.
- [ ] Confirm RED.
- [ ] Implement the shell while preserving all secondary route registrations/deep links.
- [ ] Remove the fake Back button from primary tabs; secondary stack routes use `router.back()` with a `replace("/(tabs)")` fallback.
- [ ] Run navigation tests, all 19+ route runtime checks, mobile typecheck, and screenshot the shell at 320/390/430 widths.
- [ ] Commit: `feat(nav): center WoofWatcher on the daily care loop`.

---

### Task 15: One reusable Quick Log controller and one Log History surface

**Files:**
- Create: `artifacts/woofwatcher-mobile/components/logging/QuickLogGrid.tsx`
- Create: `artifacts/woofwatcher-mobile/components/logging/useQuickLogController.ts`
- Create: `artifacts/woofwatcher-mobile/lib/quickLogPolicy.ts`
- Create: `artifacts/woofwatcher-mobile/lib/quickLogPolicy.test.ts`
- Modify: `artifacts/woofwatcher-mobile/app/fastlog.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/index.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/log.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`

**Interfaces:**
- `QUICK_LOG_ACTIONS` is the single tile taxonomy.
- `useQuickLogController()` owns quick-save policy, duplicate protection, walk/alone open loops, haptics, success/undo, failure copy, and detail routing.
- `QuickLogGrid` renders compact Home and expanded sheet variants from the same actions/controller.
- Full Log retains detail composer/edit/audit/trust flows; its first screen is History, not another quick-action console.

- [ ] Write failing policy tests for tile order, Meal/Potty detail requirements, one-tap Water/Walk/Medication rules, dedupe, undo, and open lifecycle behavior.
- [ ] Add failing source tests requiring Home and Fast Log to import the shared grid/controller and forbidding the duplicate Log quick console.
- [ ] Confirm RED.
- [ ] Extract policy/controller without changing care-domain payloads.
- [ ] Replace Home and Fast Log implementations with the shared component; remove Log’s duplicate hero/console and keep a single Add Log action that opens Fast Log/detail mode.
- [ ] Verify a quick tap saves in under one interaction from Home, long press/details remains reachable, undo reverses XP/evidence, and History editing still works.
- [ ] Run focused tests, typecheck, route smoke, interaction probe, and commit: `refactor(log): unify quick care and history`.

---

### Task 16: Simplified Today information architecture and component boundaries

**Files:**
- Create: `artifacts/woofwatcher-mobile/components/home/HomeNowNextCard.tsx`
- Create: `artifacts/woofwatcher-mobile/components/home/HomeEvidenceCard.tsx`
- Create: `artifacts/woofwatcher-mobile/components/home/HomeStorySummary.tsx`
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/index.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/homeFirstScreenLayout.test.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`

**Today order:** living room + presence; Now/Next; shared Quick Log; one evidence summary; one real Today story/history summary; secondary links. Do not repeat Care Sense, Care Status, Today at a glance, Recent activity, Watch cards, Missions, and Quest blocks on the same route.

- [ ] Add failing source/layout tests for the exact order and one occurrence of each status/history concept.
- [ ] Confirm RED.
- [ ] Extract the focused components and remove/relocate duplicate cards. Keep XP/Story/Adventure reachable through Today story and More; keep health/watch detail in Health; keep full history in Log History.
- [ ] Preserve the high-horizon room and open foreground so consoles do not cover the dog.
- [ ] Run Home layout/readiness tests, typecheck, and inspect zero/populated screenshots at 390x844.
- [ ] Commit: `refactor(home): focus Today on now next and quick care`.

---

### Task 17: Dynamic Type, touch, accessibility, and navigation semantics

**Files:**
- Modify: `artifacts/woofwatcher-mobile/lib/mobileLayout.ts`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileLayout.test.ts`
- Modify: `artifacts/woofwatcher-mobile/components/board/BoardPrimitives.tsx`
- Modify: `QuickLogGrid.tsx`, `HomeNowNextCard.tsx`, `health.tsx`, `calendar.tsx`, and `log.tsx`
- Modify: `artifacts/woofwatcher-mobile/lib/mobileReadiness.test.ts`

**Interfaces:**
- Layout helpers accept `fontScale`.
- Quick actions use at least two columns at large accessibility text sizes.
- Every high-frequency target is at least 48×48 or has equivalent hit slop.
- Selectable chips expose role, label, selected/checked state, and a state-specific hint.

- [ ] Add failing tests for 1.0/1.4/2.0 font-scale layout metrics, 48-point controls, chip semantics, and correct primary/secondary back behavior.
- [ ] Confirm RED.
- [ ] Implement reflow: grids reduce columns, horizontal status rows stack, chrome grows, and metadata yields before action labels.
- [ ] Reuse accessible Board primitives rather than bespoke controls.
- [ ] Run web DOM accessibility probes and screenshots with emulated font scaling; leave VoiceOver/TalkBack closure marked native-proof pending.
- [ ] Commit: `fix(a11y): make core care usable at accessibility sizes`.

---

### Task 18: Whole-branch visual, runtime, and release proof

**Files:**
- Modify: `docs/handoff/HANDOFF_2026-07-18.md`
- Modify: `docs/release/CARE_TWIN_NATIVE_QA_MATRIX.md`
- Modify: `docs/release/GO_LIVE_CHECKLIST.md`
- Modify: `docs/ULTIMATE_RELEASE_PLAN.md`
- Add reviewed screenshots only through the existing release tooling.

- [ ] Run a fresh full verification:

```bash
pnpm install --frozen-lockfile
pnpm run test:focused
pnpm run typecheck
pnpm --filter @workspace/woofwatcher-mobile run verify:pixellab-assets
pnpm --filter @workspace/woofwatcher-mobile run smoke:web
pnpm --filter @workspace/woofwatcher-mobile run smoke:runtime
pnpm --filter @workspace/woofwatcher-mobile run proof:live-preview
pnpm run doctor:mobile-beta:json
pnpm run doctor:native-qa:json
git diff --check
```

- [ ] Serve the rebuilt Expo export and drive every route at 390×844 with zero console/page errors.
- [ ] Capture and inspect Today, Plan, Quick Log, Health, More, Log History, Records, and Privacy in light and dark mode, zero and populated data, normal and Reduce Motion.
- [ ] Run the storage-failure, corrupt-cache, offline boot, account-switch, private-log, wipe-during-request, conflict, and 501-row history drills.
- [ ] If native tooling is available, run iOS/Android safe-area, Dynamic Type, VoiceOver/TalkBack, haptics, keyboard, hardware/swipe Back, attachment/share, and Reduce Motion QA. If unavailable, keep each row blocked with the doctor output; do not claim native completion.
- [ ] Update handoff/release docs with exact observed evidence and external blockers: Expo/EAS access, Apple Developer/App Store Connect, production Clerk/Supabase/storage/push/AI/payment credentials, approved legal/support URLs, and Apollo submission approval.
- [ ] Dispatch final whole-branch review, fix every Critical/Important finding, re-run the complete gate, and commit: `docs(release): record premium renovation proof`.
- [ ] Push `codex/woofwatcher-premium-renovation`; open a PR only if Apollo’s repository workflow permits it. Never merge to `main` or submit to a store without explicit approval.

## Plan self-review

- Audit coverage: Tasks 1–7 cover all 3 Critical and 9 Important data-trust findings; Task 4 also tests both plausible invitation concurrency and active selection; Task 2 covers partial-wipe truth; Tasks 8–11 cover the five approved newer-branch improvements; Tasks 12–17 cover every confirmed experience finding; Task 18 preserves native/provider blockers.
- Placeholder scan: no implementation step delegates unspecified “appropriate” behavior; each task has explicit files, interfaces, failing scenario, command, and commit boundary.
- Type consistency: storage scope feeds CareContext identity; wipe uses the same generations; household selection changes the storage scope; document/entry concurrency changes precede complete pagination; Quick Log consumes evidence-safe care state after data foundations.
