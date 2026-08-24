# WoofWatcher V1 Release Status

- Integration branch: `release/woofwatcher-v1`
- Engineering implementation checkpoint: `57c5926ce844bef38c798069c602bc19dc09ad3c`
- Verified implementation tree: `98742050003dd59976073b4d0718ca21c1153b95`
- Exact-head GitHub CI: [WoofWatcher Verify #1028 — PASS](https://github.com/ApolloDNR/WoofWatcher/actions/runs/32691610467). The workflow checked out and tested exact head `57c5926ce844bef38c798069c602bc19dc09ad3c`; 1,528/1,528 focused tests passed with zero failures and zero skips, followed by successful typecheck, CI-safe builds, candidate packaging, and artifact upload.
- Exact-head web candidate artifact: ID `9507485215`, `woofwatcher-web-candidate-57c5926ce844bef38c798069c602bc19dc09ad3c`, 22,852,367 bytes, digest `sha256:01d9b839919354c4a885f15575956762062358d5c472f5e47e991de76bfbb081`. This is a web candidate preview, not a signed native binary.
- Local focused adversarial reset/deletion suite: 277/277 PASS on the verified implementation tree.
- Status identity rule: this tracked file names its exact verified predecessor, but cannot contain the SHA of its own containing commit because that text would change the commit. The resulting documentation-only head SHA and its CI evidence are recorded in PR #12 and the release handoff.
- Durable baseline: `0f1107b170b0a9c89548a51f5cdeb664ba98246f`
- Baseline code commit: `b6934f7a`
- Main at recovery start: `47234396`
- Scope: free, local-first V1
- Browser/engineering verdict: PASS at the exact implementation checkpoint; resulting documentation-only head evidence is recorded externally
- Native verdict: BLOCKED — NATIVE CANDIDATE AND PHYSICAL-DEVICE QA UNPROVED
- Production/App Store/Play status: **NOT APPROVED / NOT SUBMITTED / NOT PUBLISHED**

## Current milestone

M2B2 — Coordinated Local-Data Reset and Deletion Integrity: **COMPLETE AT THE ENGINEERING / AUTOMATED-PROOF BOUNDARY at `57c5926ce844bef38c798069c602bc19dc09ad3c`**

Next: N1 — Signed Native Candidate and Physical-Device QA

This milestone is complete at the exact implementation checkpoint above. It is
not native-device proof, owner approval, permission to merge PR #12, or
permission to submit or publish. Exact-head GitHub CI passed the complete
dependency-installed suite and preserved the exact-head web candidate artifact;
the resulting documentation-only head is recorded externally under the identity
rule above.

## M2B2 engineering checkpoint

- All eight required production owners are attached: `auth-credentials`, `avatar`, `care`, `device-preferences`, `files`, `query-cache`, `walk-capture`, and `web-runtime`: PASS
- Accepted removable-storage and app-file work is admission-controlled and drained before destructive commits: PASS
- Successful file-owner commit removes `WoofWatcherReports`, `WoofWatcherCredentials`, `woofwatcher-attachments`, and exact legacy root avatar files; every target is attempted and deletion errors remain exact `files` partial failures: PASS
- Sensitive same-origin `/api` responses bypass CacheStorage; owned runtime/data caches are cleared with service-worker acknowledgement while the current offline shell is preserved: PASS
- Active and pending walk capture is invalidated and drained; failed native teardown handles remain retryable; late callbacks cannot restore route state: PASS
- Picked-media and generated report/credential writers use the reset-aware file facade; revoked writers and late share fallbacks cannot recreate or apply deleted data: PASS
- Privacy export uses immutable synchronous capture through `runExport`; deletion uses only `runReset`; export/reset mutual exclusion is enforced by the root operation lane: PASS
- Query-cache deletion waits for the real personal-screen React shield's post-unmount acknowledgement, then cancels, identity-checks, clears, and rechecks before completion: PASS
- The rendered shield stays closed through deletion, partial failure, retry, and complete. Exact failed-owner/generic labels are accessible, Retry starts a fresh root reset, and only Return/Continue remounts personal screens: PASS
- Complete success copy is reserved for a complete coordinator result; partial failure/rejection remains visible and actionable: PASS
- Unsafe legacy Care wipe and direct Privacy/file/share bypasses are absent; Avatar Studio's legitimate feature reset remains: PASS
- Focused adversarial reset/deletion tests: 277/277 PASS on the exact implementation tree
- Full focused repository tests: 1,528/1,528 PASS with zero failures and zero skips in exact-head CI #1028
- TypeScript and CI-safe builds: PASS for libraries, scripts, API server, web app, mockup sandbox, and mobile in exact-head CI #1028
- Candidate proof: production-profile web export 260 files PASS; runtime 47/47 routes PASS; live-preview 56/56 checks PASS; exact-head artifact upload PASS
- Independent scoped code and security reviews: APPROVED; zero findings at all severities

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
- Expo/EAS tooling: no global or workspace-local EAS CLI, no authenticated EAS query, no Expo/EAS credential environment, and no committed `extra.eas.projectId`.
- Account/signing inputs: Expo project ownership/access is unproved. Apple Developer team, certificate, provisioning profile, registered internal device, App Store Connect app/TestFlight access, and Google Play Console, Play App Signing/upload-key, and internal-test access are unavailable or unproved. Release metadata still has null EAS project ID, Apple Team ID, App Store Connect Apple ID, and App Review phone.
- Native proof metadata remains false for signed TestFlight installation, the physical-iPhone matrix, and Apollo approval of the exact build.
- Safe areas, touch targets, VoiceOver/TalkBack, large text, haptics, permissions, native sharing/files, offline/background/relaunch, navigation/back/deep links, active walk capture, export, and reset remain unproved on a physical-device binary.

PR #12 remains draft and unmerged, and Issue #13 remains open as the release gate. No
App Store or Play Store submission and no production publication are authorized.
Apollo must personally approve the exact tested binary before release.

## Historical checkpoints

The sections below preserve prior checkpoint evidence. Their then-current
limitations and next-step statements are historical and are superseded by the
M2B2 and N1 status above.

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
