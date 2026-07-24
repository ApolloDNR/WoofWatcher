# WoofWatcher Ultimate Release Plan

## Current release boundary

WoofWatcher is a premium, mobile-first dog-care operating system for owners,
households, caregivers, sitters, trainers, walkers, and veterinary handoffs.
The approved sequence is:

1. finish and verify the premium renovation locally;
2. connect approved production providers;
3. complete native iOS and Android acceptance;
4. distribute a shared-account TestFlight/internal beta;
5. prepare public App Store and Play submission only after beta evidence,
   legal approval, store disclosures, and Apollo's explicit release approval.

This repository is not evidence that TestFlight or a public store release is
already approved. Web preview proof cannot replace a signed native build,
provider proof, legal review, or store review.

## Premium release definition

A premium release must:

- create or join the correct household without exposing another account's
  cached care;
- answer what the dog needs now through Today and Plan;
- log care quickly through one Quick Log model while retaining a detailed,
  searchable Log History;
- organize owner-entered health evidence without diagnosis or invented
  confidence;
- preserve private logs as a server authorization boundary;
- make offline work, conflicts, refresh failures, partial wipes, and deletion
  limits visible;
- support records, handoffs, reports, reminders, household responsibility,
  and recovery without dead ends;
- reflow for Dynamic Type, preserve 48-point targets, expose control state,
  honor Reduce Motion, and remain keyboard/screen-reader operable;
- keep provider-backed sync, storage, AI, push, payments, deletion, and
  release claims disabled until their structured proof exists;
- pass behavior, database, type, build, rendered-route, visual, native, and
  release-control gates for the exact submitted commit.

## Premium renovation status

| Area | Implemented in the renovation branch | Remaining release proof |
| --- | --- | --- |
| Data isolation | Local care is partitioned by account and household. Identity changes clear live refs and query data before the next scope hydrates. Delayed requests cannot repopulate a wiped or replaced lifecycle. | Real multi-account and multi-device testing against approved production Clerk/database projects. |
| Privacy and deletion | Private care rows and tombstones are author-filtered server-side. Device clearing produces a per-target receipt and cannot report partial deletion as success. | Production migration/RLS/backfill evidence, retention/export rules, and an approved provider account-deletion path. |
| Household authority | Active-household selection is durable. Invitation acceptance is atomic and caller-scoped. Role, expiry, rename, and access rules are API-tested. | Provider-backed invitation delivery/UI, production migration proof, live role/RLS validation, and native household acceptance. |
| Sync and history | Care documents merge disjoint edits, care-entry writes use revision/CAS rules, conflicts remain owner-visible, refresh errors surface, and complete pagination covers long histories without partial replacement. | Provider deployment, offline/multi-device soak, retention policy, monitoring, and production recovery drills. |
| Core navigation | The visible loop is exactly Today, Plan, central Quick Log, Health, and More. Secondary Records, Story, Pack, Adventure, Avatar Studio, Care Pass, Log History, Privacy, and QA remain routable. | Native safe-area, Back gesture/hardware Back, haptics, and final signed-build navigation acceptance. |
| Logging | Fast Log and detailed logging share one taxonomy/controller; Log opens as History. Meal outcomes, medication, potty, mood/energy, walk, water, grooming, incidents, training, alone time, weight, notes, privacy, audit, search, and recovery paths remain available. | Native keyboard/share/attachment proof, production sync proof, and long-retention search policy. |
| Today, Plan, and Health | Today is focused on Now, Next, Quick Log, evidence, and real-care Story. Plan owns routines and reminders. Health uses owner-entered seven-day evidence and non-diagnostic guidance instead of a simulated score. | Native populated/empty/error review, notification delivery proof, and veterinary/legal review of release copy. |
| Accessibility and design | Shared board primitives, reviewed color tokens, 48-point targets, selection semantics, accessible labels/hints, large-text reflow, keyboard-safe sheets, and Reduce Motion contracts cover the core loop. Web preflight passed the 1.0×/1.4×/2.0× reflow and four-edge containment matrix, 15/15. | Native Dynamic Type glyph scaling, VoiceOver/TalkBack, contrast, motion, and physical-device visual acceptance. |
| Release truth | Local auth fallback is web-only; production auth/provider features fail closed. Store, provider, account deletion, AI, payments, push, storage, and native QA each have explicit proof gates. | Expo/EAS linkage, signed builds, provider credentials, approved policies/support URLs, store accounts/forms/assets, beta acceptance, and Apollo submission approval. |

## Current verification contract

Use Node 24 and pnpm 10.24.0 from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm run test:focused
pnpm run typecheck
pnpm run build:ci
pnpm --filter @workspace/woofwatcher-mobile run verify:pixellab-assets
pnpm --filter @workspace/woofwatcher-mobile run smoke:web
pnpm --filter @workspace/woofwatcher-mobile run smoke:runtime
pnpm --filter @workspace/woofwatcher-mobile run proof:live-preview
pnpm --filter @workspace/woofwatcher-mobile exec playwright install chromium
pnpm --filter @workspace/woofwatcher-mobile run e2e:web
pnpm run doctor:mobile-beta:json
pnpm run doctor:native-qa:json
git diff --check
```

`smoke:runtime` and `proof:live-preview` must bind their result to the current
mobile/shared source fingerprint. Preserve the command output with the commit
and build. The current exact results belong in
`docs/handoff/HANDOFF_2026-07-18.md`; this plan intentionally does not freeze a
test count that will drift as regressions are added. Treat
`doctor:native-qa:json` as evidence capture: `BLOCKED` is expected on a host
without the required native SDK/device tooling and must remain a native
handoff blocker.

## External release blockers

| Blocker | Required evidence before it closes |
| --- | --- |
| Expo/EAS | Authorized Expo account, linked EAS project id, delegated credentials, successful signed internal builds, and retained build URLs/logs. |
| Apple | Active Apple Developer membership, App Store Connect app record, signing ownership, internal tester path, privacy forms, review access, screenshots, and Apollo approval. |
| Google Play | Verified developer account/app record, Play App Signing/upload key ownership, required testing track, Data safety, screenshots/feature graphic, and Apollo approval. |
| Clerk/auth | Production keys, redirect/deep-link configuration, reviewer access, account/household onboarding, recovery, logout, and native proof. |
| Database/sync | Applied migrations `0004`, `0005`, `0006`, and `0008`; RLS/backfill/retention/export/deletion evidence; live API deployment; monitoring and rollback. |
| Storage/documents | Approved buckets, signed access, household scoping, encryption/retention/deletion, upload/download/reopen proof, and native file-share evidence. |
| Push | APNs/FCM/Expo configuration, permission copy, quiet hours/preferences, delivery/failure proof on both platforms, and privacy approval. |
| WoofGuide AI | Approved model/source policy, secret storage, citations, owner-review write gate, veterinary boundary, fallback/incident handling, and disclosure approval. |
| Payments | Store products, entitlement rules, sandbox purchase/restore, refund/support policy, receipts, family/plus policy, and store approval. |
| Legal/support | Final legal entity, policy/terms, privacy contact, support owner/SLA, retention/deletion language, household rules, public HTTPS URLs, and counsel/Apollo approval. |
| Native QA | iOS and Android proof for core routes, largest text, VoiceOver/TalkBack, Reduce Motion, safe areas, keyboard, Back behavior, haptics, files/sharing, offline/recovery, and populated/empty states. |

The current Linux environment has no iOS simulator and no configured Android
SDK, emulator, `adb`, or Java home. Those native rows must remain blocked; the
absence of a native host is not a reason to mark them passed.

## Execution sequence

### Phase 1 — lock the renovation branch

- Complete every local verification command.
- Inspect light/dark, zero/populated, motion, and accessibility-size captures.
- Resolve every Critical or Important independent-review finding.
- Push the dedicated renovation branch; do not merge `main`.

### Phase 2 — production foundations

- Approve the legal/data/provider inventory.
- Link EAS and configure Clerk, API, database, and required storage.
- Apply migrations through a reviewed, reversible production procedure.
- Validate RLS, private-log visibility, household switching, 501-row history,
  conflicts, offline recovery, export, and deletion using non-production test
  accounts first.

### Phase 3 — signed native acceptance

- Produce iOS and Android internal builds from the same commit.
- Run `docs/release/CARE_TWIN_NATIVE_QA_MATRIX.md` on both platforms.
- Attach route-named screenshots and session notes.
- Fix and rebuild until there are no open Critical or Important findings.

### Phase 4 — shared-account beta

- Publish approved policies/support URLs before collecting external beta data.
- Invite a controlled household beta group.
- Monitor auth, sync, conflicts, crashes, support, deletion, and privacy
  incidents.
- Keep AI, push, payments, cloud documents, or public sharing disabled unless
  each feature's proof gate is complete.

### Phase 5 — public stores

- Freeze the exact signed release candidate.
- Recalculate Apple privacy labels, Play Data safety, reviewer instructions,
  screenshots, and listing copy from that binary.
- Complete purchase/restore and account-deletion requirements where enabled.
- Submit only after Apollo explicitly approves submission. Use phased release
  and a documented rollback/support path.

## Product truths that must not regress

- Real owner-entered evidence only; unknown states stay unknown.
- Health is evidence organization, not diagnosis or emergency certainty.
- Private means server-enforced and excluded from every shared artifact.
- Persistence, refresh, conflict, and deletion failures remain visible.
- One visible care loop and one Quick Log model.
- No hidden provider, native, subscription, or launch claims.
- No production secrets or personal test data in source control.

## Decisions still requiring Apollo

- Production legal entity, privacy/support contacts, jurisdiction, retention,
  deletion, incident, subscription, and refund policies.
- Apple and Google account ownership and delegated build/submission access.
- Final production providers for auth, database, storage, AI, push, payments,
  deployment, analytics/crash reporting, and support.
- Whether Adventure Mode will use photos, maps/location, share links, or
  community discovery in the paid release; each expands privacy and safety
  scope.
- Final Free/Plus/Family packaging and which gated provider features belong in
  the first public version.
- Explicit approval for TestFlight distribution, public store submission, and
  release timing.
