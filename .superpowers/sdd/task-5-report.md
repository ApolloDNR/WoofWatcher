# Task 5 report: atomic care-document sync

## Outcome

Care-document writes now use a household-scoped SQL compare-and-swap, mobile
reconciliation uses the last acknowledged document as a three-way merge base,
and direct edits plus refreshes share one generation-owned serialized
coordinator. Full conflict operands remain in the scoped cache and Sync Health.
Independent review confirmed that shared owner review cannot be closed by a
device-local dismissal; the separate owner-shared workflow is intentionally
not claimed by this patch and will follow the Task 6 integration.

## RED evidence

Tests were written and run before production changes. The first targeted run
failed for the intended missing behavior:

- the API route had no injected router for a real concurrent handler test;
- `careDocMerge.ts` and its three-way merge contract did not exist;
- care sync returned the previous whole-document `keep-local-newer` decision
  instead of preserving disjoint local and server edits with a merged push.

The RED suite also covered adversarial cases before implementation: invalid or
duplicate stable ids, JSON-safe missing/null conflict operands, missing and
mismatched acknowledged bases, deterministic metadata, deferred cross-scope
network responses, malformed/stale envelopes, repeated 409 responses, cached
snapshot restart, and bounded conflict presentation.

## Implementation

- Added an injected care-state router and changed PUT to one atomic SQL update:
  the predicate includes household id and expected version, while the new
  version is calculated from the database column. Empty `RETURNING` results are
  re-read to distinguish 404 from 409.
- Added a pure recursive three-way document merge. Stable-id policy covers
  routines, records, calendar events, report artifacts, access passes,
  adventure memories, pets, and goals. Non-id arrays remain atomic.
- Added explicit local-resolution conflict records with JSON-safe operands,
  deterministic paths/order, deletion semantics, invalid-id fallback, and
  root metadata handling.
- Replaced wall-clock whole-document reconciliation with acknowledged-base
  reconciliation. Missing legacy baselines use a conservative no-base merge
  and remain visible as a conflict instead of inventing a base.
- Added one serialized document coordinator for GET and PUT operations.
  Generation changes detach a new household/account from hung old work; every
  post-await commit checks ownership. A 409 reconciles the latest local
  document and retries once, while malformed, stale, repeated-conflict, 404,
  5xx, and transport failures stay visible.
- Persisted current document, server version, acknowledged `{version, doc}`,
  conflicts, document sync error, and entries in one existing
  account-and-household-scoped snapshot.
- Added bounded Sync Health conflict summaries without rendering raw operand
  contents. The later independent review identified account-local dismissal as
  insufficient for household-shared owner review.

## Verification

All commands used the pinned temporary Corepack/pnpm cache environment where
applicable.

- Targeted Task 5 and readiness tests: **181 passed, 0 failed**.
- Task 1 lifecycle/storage plus Task 4 household-switch regressions:
  **186 passed, 0 failed**.
- Full focused workspace suite: **823 passed, 0 failed**.
- `pnpm run typecheck`: passed all workspace library and artifact projects.
- Mobile `smoke:web`: passed; Expo exported 266 files.
- `git diff --check`: passed.

The real route race uses PGlite, Drizzle, Express, and two concurrent HTTP PUT
requests at version 7. It asserts exactly one 200 and one 409, both version 8,
the conflict envelope contains the winning document, the winning document is
the persisted row, and a database trigger observed exactly one update.

## Self-review

- No stale full-document shallow spread remains in care-document sync.
- Successful retries preserve accumulated conflicts.
- Old-generation responses cannot advance document, version, acknowledged
  base, conflict, or error state in the newly active scope.
- Stable-id corruption falls back to the complete local array and emits a
  review conflict; it never silently collapses rows through a map.
- Cached acknowledged state is accepted only when its version matches the
  cached server version. Legacy/malformed snapshots never manufacture a base.
- The protected untracked avatar and release-tool files were neither edited nor
  staged.

## Independent review correction

### RED evidence

The independent review found three unsafe edge cases and three concurrency /
compatibility gaps. New isolated regressions were added without editing the
concurrent Task 6 test files.

The first run of `careDocSyncRegression.test.ts` failed **2/2**:

- a scalar cached `currentDoc` had no corrupt outcome and could inherit the
  cached acknowledged base;
- a no-op retry returned success and cleared an earlier network error without
  any network round trip.

The next RED runs proved the remaining findings:

- an established cache with no `currentDoc` or legacy `doc` was treated as
  usable;
- present malformed known object sections and arrays silently became defaults;
- equal-version and invalid-timestamp 409 envelopes were retried and adopted.

### Correction

- Parsing now marks an unusable or missing established current document as
  corrupt and returns only a pristine version-0 fallback with no acknowledged
  base or conflicts.
- `CareContext` writes the exact corrupt raw snapshot to the scoped recovery
  key before hydration or primary-cache persistence can resume. Only then does
  it hydrate the already-reset pristine document, allowing the first valid GET
  to be accepted without a PUT.
- Runtime care-document normalization rejects malformed present known object
  sections and arrays. Missing legacy fields still receive deterministic
  defaults. Valid unknown top-level, nested, evidence, reminder, and stable-row
  fields survive round trip.
- Fresh documents record a real `createdAt` while keeping epoch `updatedAt` so
  first refresh remains pristine. Legacy normalization uses deterministic epoch
  metadata and never manufactures a merge conflict.
- A content-equal push with a pre-existing document error returns false and
  retains the exact error until a successful GET or PUT proves recovery.
- 409 envelopes must have a valid timestamp and advance strictly beyond both
  the attempted and current versions.
- Added exact proofs for a hung old-generation PUT, a repeated 409's retained
  alternatives and two-call retry bound, and delayed household-1 persistence
  remaining isolated from household 2.

### Corrective files

- `artifacts/woofwatcher-mobile/lib/careSync.ts`
- `artifacts/woofwatcher-mobile/context/CareContext.tsx`
- `artifacts/woofwatcher-mobile/lib/careDocNormalization.ts`
- `artifacts/woofwatcher-mobile/lib/careDocNormalization.test.ts`
- `artifacts/woofwatcher-mobile/lib/careDocSyncRegression.test.ts`
- `artifacts/woofwatcher-mobile/lib/careDocScopePersistenceRegression.test.ts`
- `.superpowers/sdd/task-5-report.md`

### Verification

Fresh isolated run:

```bash
node --experimental-strip-types --test \
  artifacts/woofwatcher-mobile/lib/careDocNormalization.test.ts \
  artifacts/woofwatcher-mobile/lib/careDocSyncRegression.test.ts \
  artifacts/woofwatcher-mobile/lib/careDocScopePersistenceRegression.test.ts
```

Result: **16 passed, 0 failed**.

The existing coordinator/restart compatibility selection passed **6/6**. A
mobile typecheck reached the compiler but is temporarily blocked by Task 6's
concurrent generated `CareEntryUpdate.expectedRevision` contract; Task 6 owns
the corresponding entry-queue wiring and will run the combined compiler gate
after this isolated Task 5 commit.
