# WoofWatcher Sync Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent care logs from disappearing during offline, failed, or delayed server sync.

**Architecture:** Add a pure `careSync` helper in the mobile app for entry sync status and server/local merge behavior, test it with Node 24's TypeScript stripping, then wire CareContext to keep failed/local entries visible and retry them after sign-in or refresh.

**Tech Stack:** Expo React Native, AsyncStorage, React context, Node 24 built-in test runner.

---

### Task 1: Sync Merge Helper

**Files:**
- Create: `artifacts/woofwatcher-mobile/lib/careSync.ts`
- Create: `artifacts/woofwatcher-mobile/lib/careSync.test.ts`

- [ ] **Step 1: Write failing tests**

Tests cover:

- Server entries are marked `synced`.
- Local `temp_` entries with `failed`, `pending`, or `local` status survive a server refresh.
- Synced local entries are replaced by authoritative server rows.
- Merged entries sort newest first.

Run:

```powershell
& "C:\Users\Apoll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --experimental-strip-types --test artifacts/woofwatcher-mobile/lib/careSync.test.ts
```

- [ ] **Step 2: Implement helper**

Export:

- `EntrySyncStatus`
- `SyncableEntry`
- `withSyncedStatus`
- `isUnsyncedEntry`
- `mergeServerAndLocalEntries`

### Task 2: CareContext Integration

**Files:**
- Modify: `artifacts/woofwatcher-mobile/context/CareContext.tsx`

- [ ] **Step 1: Add sync fields**

Add `syncStatus?: EntrySyncStatus` and `syncError?: string` to `Entry`.

- [ ] **Step 2: Preserve failed creates**

Change failed `createCareEntry` behavior from removing the optimistic entry to
marking it `failed` with a readable sync error.

- [ ] **Step 3: Merge server refreshes safely**

Use `mergeServerAndLocalEntries` in `syncFromServer` so server rows do not
delete local unsynced entries.

- [ ] **Step 4: Retry local/failed entries**

On sign-in or refresh, retry entries marked `local` or `failed`. Keep `pending`
entries visible while the request is in flight.

### Task 3: Visible Sync State

**Files:**
- Modify: `artifacts/woofwatcher-mobile/app/(tabs)/log.tsx`

- [ ] **Step 1: Show sync state in the timeline**

Show `Pending sync`, `Saved offline`, or `Sync failed` beside affected entries.

### Task 4: Verification

- [ ] **Step 1: Run sync tests**
- [ ] **Step 2: Run care-domain tests**
- [ ] **Step 3: Run placeholder/mojibake scans**
- [ ] **Step 4: Run `git diff --check`**
- [ ] **Step 5: Report that full workspace typecheck still requires pnpm if pnpm is unavailable**
