# WoofWatcher V1 Release Status

- Integration branch: `release/woofwatcher-v1`
- Engineering implementation checkpoint: `3e90f5527780354aacd931d256fb8be7acbaf532`
- Verified implementation tree: `a3a509ef39d11b3ea0cf8dcfa9b996daa25374d1`
- Exact-checkpoint local verification: 34/34 mounted-renderer tests and 2,227/2,227 repository tests passed (2,261/2,261 total), with zero failures and zero skips, followed by successful typecheck, CI-safe builds, Expo compatibility checks, a 260-file production-profile web candidate export, 47-route runtime smoke, and 56-route live-preview proof.
- Exact-checkpoint GitHub CI: [WoofWatcher Verify #1040 — PASS](https://github.com/ApolloDNR/WoofWatcher/actions/runs/33272562673). The workflow checked and tested `3e90f5527780354aacd931d256fb8be7acbaf532` and completed successfully.
- Exact-checkpoint web candidate artifact: [ID `9720570465`](https://github.com/ApolloDNR/WoofWatcher/actions/runs/33272562673/artifacts/9720570465), `woofwatcher-web-candidate-3e90f5527780354aacd931d256fb8be7acbaf532`, 22,895,098 bytes, digest `sha256:22b840f1bccac61a5df553b9ae2f501907c9d0cb96407654409a8c60f168b057`, retained through 2026-09-05. This is a downloadable static web candidate, not a hosted preview or signed native binary.
- Independent review-session evidence from ad hoc file selections, not checked-in aggregate scripts: whole privacy/authority 509/509 PASS; owner/concurrency subset 281/281 PASS.
- Independent review-session source/test UI and accessibility evidence from an ad hoc file selection, not a checked-in aggregate script: 241/241 PASS. This is not rendered-browser or physical-device visual proof.
- Status identity rule: this tracked file names its exact verified predecessor, but cannot contain the SHA of its own containing commit because that text would change the commit. The resulting documentation-only head SHA and its CI evidence are recorded in PR #12.
- Durable baseline: `0f1107b170b0a9c89548a51f5cdeb664ba98246f`
- Baseline code commit: `b6934f7a`
- Main at recovery start: `47234396`
- Scope: free, local-first V1
- Automated engineering verdict: PASS locally and in exact-checkpoint GitHub CI; rendered-browser and physical-device review remain required
- Native verdict: BLOCKED — NATIVE CANDIDATE AND PHYSICAL-DEVICE QA UNPROVED
- Production/App Store/Play status: **NOT APPROVED / NOT SUBMITTED / NOT PUBLISHED**

## Current milestone

V1 engineering closeout — privacy, household authority, coordinated reset/deletion integrity, and source-level product-quality gates: **COMPLETE AT THE ENGINEERING / AUTOMATED-PROOF BOUNDARY at `3e90f5527780354aacd931d256fb8be7acbaf532`**

Next: N1 — Signed Native Candidate and Physical-Device QA, plus owner/legal metadata closure

This milestone is complete at the exact implementation checkpoint above. It is
not rendered-browser review, native-device proof, owner approval, permission to
merge PR #12, or permission to submit or publish. Exact-checkpoint GitHub CI
#1040 passed and uploaded the exact-checkpoint web candidate archive. The
resulting documentation-only head is recorded externally under the identity rule
above.

## V1 engineering closeout checkpoint

- Care-entry privacy is creator- and household-scoped across create, list, update, delete, idempotency, tombstones, migration, and generated clients: PASS
- Household capability, invitation, join, role, membership, active-identity, server-clock expiry, and transaction-serialization boundaries fail closed: PASS
- Auth and household identity transitions revoke stale queries, permits, mutation callbacks, cached personal UI, and live walk capture before replacement identity admission: PASS
- Source/test anti-slop checks cover accessible names and roles, 48pt controls, large-text reflow, reduced motion, modal/dialog focus, route ownership, truthful empty/error states, and removal of deceptive or dead actions: PASS. Rendered visual and native-device inspection remain N1 work.
- Release hardening at `3e90f5527780354aacd931d256fb8be7acbaf532`: neutral and repeated Log intents no longer invent or retain abandoned answers; historical records and Care Pass dates no longer masquerade as expired renewals; malformed migrations and device-local attachment boundaries fail safely; Health and Plans clocks refresh on focus/foreground; Reduce Motion suppresses care-twin reactions; charts have spoken summaries; narrow and large-text layouts reflow; and the Codex Expo Run action uses SDK-compatible dependencies.
- Current-head rendered-browser audit: **BLOCKED / NOT COMPLETE**. The secure cloud browser could not open the local preview, and no accessible forwarded URL or fresh route-by-route screenshot set exists. Source/test accessibility repairs and HTTP route checks do not satisfy rendered visual proof.
- All eight required production owners are attached: `auth-credentials`, `avatar`, `care`, `device-preferences`, `files`, `query-cache`, `walk-capture`, and `web-runtime`: PASS
- Accepted removable-storage and app-file work is admission-controlled and drained before destructive commits: PASS
- Successful file-owner commit removes `WoofWatcherReports`, `WoofWatcherCredentials`, `woofwatcher-attachments`, and exact legacy root avatar files; every target is attempted and deletion errors remain exact `files` partial failures: PASS
- Sensitive same-origin `/api` responses bypass CacheStorage; owned runtime/data caches are cleared with service-worker acknowledgement while the current offline shell is preserved: PASS
- Active and pending walk capture is invalidated and drained; failed native teardown handles remain retryable; late callbacks cannot restore route state: PASS
- Picked-media and generated report/credential writers use the reset-aware file facade; revoked writers and late share fallbacks cannot recreate or apply deleted data: PASS
- Privacy export uses immutable synchronous capture through `runExport`; deletion uses only `runReset`; export/reset mutual exclusion is enforced by the root operation lane: PASS
- Query-cache deletion waits for the real personal-screen React shield's post-unmount acknowledgement, then cancels, identity-checks, clears, and rechecks before completion: PASS
- The shipping shield under mounted React lifecycle tests stays closed through deletion, partial failure, retry, and complete. Exact failed-owner/generic labels are accessible, Retry starts a fresh root reset, and only Return/Continue remounts personal screens: PASS
- Complete success copy is reserved for a complete coordinator result; partial failure/rejection remains visible and actionable: PASS
- Unsafe legacy Care wipe and direct Privacy/file/share bypasses are absent; Avatar Studio's legitimate feature reset remains: PASS
- Predecessor review-session ad hoc selections passed 509/509 whole privacy/authority checks, including a 281/281 owner/concurrency subset. They remain useful regression context but are not independent review of `3e90f5527780354aacd931d256fb8be7acbaf532`.
- Full focused tests at the latest implementation checkpoint: 34/34 mounted-renderer plus 2,227/2,227 repository tests, 2,261/2,261 total, passing locally with zero failures and zero skips.
- TypeScript and CI-safe builds at the latest implementation checkpoint: local and exact-checkpoint GitHub CI #1040 PASS for libraries, scripts, API server, web app, mockup sandbox, and mobile.
- Candidate proof at the latest implementation checkpoint: production-profile web export 260 files PASS; runtime 47/47 routes PASS; live-preview 56/56 checks PASS; exact-checkpoint artifact upload PASS.
- Independent review-session whole privacy, owner/concurrency, UI/accessibility, scope, generated-client, and final timezone-portability approvals belong to predecessor checkpoints. No current-head independent rendered approval is claimed.

Automated integrity proof uses controlled native adapters. Physical Expo
filesystem deletion, location-watch teardown, native sharing, offline/relaunch,
and installed-binary UI behavior remain part of N1 and are not implied by this
engineering verdict.

## N1 native candidate and device gate

- Configured identity only: app version `1.0.0`, iOS configured build number `1`, and iOS/Android bundle/package `com.pegasusdreamscapes.woofwatcher`. These values are not a native candidate or build identifier.
- Signed iOS candidate: **BLOCKED / NONE**; no `.ipa`, EAS build ID, artifact URL, signed install, or TestFlight evidence exists.
- Android candidate: **BLOCKED / NONE**; no `.apk`, `.aab`, EAS build ID, artifact URL, or signed install evidence exists.
- Physical iPhone QA: **NOT RUN**; no physical iPhone is accessible from this Linux environment and `xcrun` is unavailable.
- Physical Android QA: **NOT RUN**; no physical Android device is accessible. Java is available at `/usr/bin/java`, but `adb` and `emulator` are unavailable and `ANDROID_HOME`, `ANDROID_SDK_ROOT`, and `JAVA_HOME` are unset.
- Native screenshots/video: **NONE**. Existing store screenshots and historical Chromium navigation evidence are web evidence, not native or physical-device proof.
- Local Expo launch tooling: PASS — the Codex Run action and `script/build_and_run.sh` launch the SDK-compatible Expo project and expose start, iOS, Android, web, dev-client, tunnel, export, and doctor modes.
- EAS/signing tooling: BLOCKED — no global or workspace-local EAS CLI, authenticated EAS project or query, Expo/EAS credential environment, committed `extra.eas.projectId`, Apple signing material, or registered physical device is available.
- Account/signing inputs: Expo project ownership/access is unproved. Apple Developer team, certificate, provisioning profile, registered internal device, App Store Connect app/TestFlight access, and Google Play Console, Play App Signing/upload-key, and internal-test access are unavailable or unproved. Release metadata still has null EAS project ID, Apple Team ID, App Store Connect Apple ID, and App Review phone.
- Owner/legal inputs: legal effective date, governing law, and rights to all shipped art/fonts remain unconfirmed.
- Native proof metadata remains false for signed TestFlight installation, the physical-iPhone matrix, and Apollo approval of the exact build.
- Safe areas, touch targets, VoiceOver/TalkBack, large text, haptics, permissions, native sharing/files, offline/background/relaunch, navigation/back/deep links, active walk capture, export, and reset remain unproved on a physical-device binary.

PR #12 remains draft and unmerged, and Issue #13 remains open as the release gate. No
App Store or Play Store submission and no production publication are authorized.
Apollo must personally approve the exact tested binary before release.

## Historical checkpoints

The sections below preserve prior checkpoint evidence. Their then-current
limitations and next-step statements are historical and are superseded by the
V1 engineering closeout and N1 status above.

### M2B1 durable checkpoint

- Remote branch and exact tree equality: PASS
- Independent adversarial review: PASS; zero remaining critical, important, or minor findings
- Root reset provider is mounted above Care and Avatar: PASS
- Required Care and Avatar participant slots fail closed when unattached: PASS
- Accepted non-storage work is permit-aware, drainable, and re-entrancy safe: PASS
- Shared removable-storage and tracked-work drains complete before permit invalidation: PASS
- Runtime operation state catches up after passive subscription attachment: PASS
- Reset settlement epoch is deduplicated by exact reset Promise: PASS
- New B1 tests: 30/30 PASS
- Combined M2A+B1 tests: 72/72 PASS
- Focused tests: 1,119/1,119 PASS
- Mobile beta doctor, store-material validation, TypeScript, and CI-safe builds: PASS

Historical limitation at M2B1: this was inert infrastructure, not a completed
deletion flow. Care and Avatar had not attached their destructive delegates at
that checkpoint, so the runtime deliberately returned partial failure. The
later M2B2 checkpoint above closes this owner, files/cache/walk, and truthful UI
work.

### M2A durable checkpoint

- Remote branch and exact tree equality: PASS
- Independent adversarial review: PASS; zero critical, important, or minor findings
- Opaque generation permits revoke old asynchronous work and reject foreign/forged tokens: PASS
- Two-phase participants prepare deterministically before the transactional commit barrier: PASS
- Preparation failure performs zero destructive commits and preserves the current generation: PASS
- Concurrent and re-entrant reset/export callers coalesce onto exact in-flight promises: PASS
- Removable storage writes are FIFO, admission-aware, permit-checked, and drainable: PASS
- Immutable export capture and export/reset mutual exclusion: PASS
- New reset-core tests: 42/42 PASS
- Focused tests: 1,089/1,089 PASS
- Mobile beta doctor, store-material validation, TypeScript, and CI-safe builds: PASS
- Native release verdict: unchanged at PENDING NATIVE

Historical limitation at M2A: the core was durable and independently proved,
but production providers and screens had not yet moved onto it. M2B2 later
closed the owner integration, writer drain, complete file inventory, and honest
Privacy result work described above.

### M1 durable checkpoint

- Remote branch and exact tree equality: PASS
- Independent adversarial review: PASS; no in-scope critical or important issues
- Primary care snapshots execute in FIFO order: PASS
- Owner wipe invalidates queued stale snapshots and drains the active write before key removal: PASS
- Concurrent owner-wipe calls coalesce onto one operation: PASS
- Hydration, retry, and legacy-import continuations cannot restore in-memory pre-wipe state: PASS
- Targeted persistence/sync/protection tests: 75/75 PASS
- Focused tests: 1,047/1,047 PASS
- Mobile beta doctor: READY_FOR_EXPORT
- TypeScript and CI-safe builds: PASS
- Expo web export: 260 files PASS
- Runtime routes: 47/47 PASS
- Live-preview routes: 56/56 PASS
- Native release verdict: unchanged at PENDING NATIVE

Historical limitation at M1: recovery-key and legacy-import writes were not yet
registered with the root reset coordinator. The M2B2 checkpoint above records
the later coordinated integration and adversarial proof.

### M0 durable checkpoint

- Remote branch and exact tree equality: PASS
- Independent review: PASS; zero unresolved issues
- Frozen install with Node 24 and pnpm 10.24.0: PASS
- Focused tests: 1,041/1,041 PASS
- Mobile beta doctor: READY_FOR_EXPORT
- Store-material validation: PASS; owner/native release gates remain open
- TypeScript and CI-safe builds: PASS
- Expo web export: 260 files / 1,943 modules PASS
- Runtime routes: 47/47 PASS
- Live-preview routes: 56/56 PASS
- Native release verdict: unchanged at PENDING NATIVE

The first M0 run exposed a `pnpm/action-setup` v6.0.1 bootstrap regression, not a damaged lockfile. The repair pins the corrected v6.0.10 commit and fails fast unless the runner resolves pnpm 10.24.0 before installation.

### Recovered baseline verification

- Focused tests: 1,037/1,037 PASS
- TypeScript and CI build: PASS
- Expo web export: 260 files / 1,943 modules PASS
- Runtime routes: 47/47 PASS
- Live-preview routes: 56/56 PASS
- Historical rendered Chromium navigation: 544/544 PASS
