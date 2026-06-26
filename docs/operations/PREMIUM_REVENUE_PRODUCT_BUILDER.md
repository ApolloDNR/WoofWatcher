# Premium Revenue Product Builder

## Purpose

`Premium Revenue Product Builder` is the recurring autonomous build loop for WoofWatcher. Its job is to keep moving the app toward a premium mobile-first dog-care operating system without requiring Apollo to approve routine engineering decisions.

## Operating Mode

- Name: Premium Revenue Product Builder
- Product: WoofWatcher
- Canonical app: `artifacts/woofwatcher-mobile`
- Shared domain logic: `lib/care-domain`
- API: `artifacts/api-server`
- Sandbox: workspace-write
- Approval policy target: approve for routine local work where the platform allows it; never request approval for normal code edits, tests, docs, commits, or queue updates
- Cadence target: every 3 hours
- Worktree target: `../woofwatcher-premium-revenue-product-builder`
- Branch target: `automation/premium-revenue-product-builder`

## Required Read Order

Every run must read:

1. `AGENTS.md`
2. `docs/APOLLO_VISION_SYNTHESIS.md`
3. `docs/30_YEAR_NORTH_STAR.md`
4. `docs/MONEY_RELEASE_PLAN.md`
5. `docs/AUTONOMOUS_BUILD_QUEUE.md`
6. `docs/QUALITY_GATES.md`
7. `docs/QA_TEST_PLAN.md`
8. `docs/ULTIMATE_RELEASE_PLAN.md`
9. `docs/DECISION_LOG.md`
10. `docs/BLOCKERS_FOR_APOLLO.md`

## Work Loop

1. Inspect `git status --short --branch`.
2. Pull `main`.
3. Ensure the dedicated worktree exists.
4. Read the required docs.
5. Pick the highest-impact unfinished task from `docs/AUTONOMOUS_BUILD_QUEUE.md`.
6. Write or update behavior tests before implementation when the slice changes behavior.
7. Implement the smallest complete product slice.
8. Run focused tests.
9. Run typecheck/build when dependencies are available.
10. Fix introduced failures.
11. Update docs, decisions, blockers, quality gates, and the queue.
12. Commit with a clear product-facing message.
13. Push.
14. Check GitHub Actions `WoofWatcher Verify`.
15. If CI fails, fetch logs, fix, commit, push, and re-check.

## Verification Commands

Focused behavior tests:

```powershell
& "C:\Users\Apoll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\*.test.ts lib\care-domain\test\*.test.ts
```

Full CI-equivalent command when `pnpm` and dependencies are installed:

```powershell
pnpm run build:ci
```

GitHub Actions:

```powershell
& "C:\Users\Apoll\OneDrive\Documentos\New project\tools\gh\bin\gh.exe" run list --repo ApolloDNR/WoofWatcher --limit 3
```

Manual verification trigger if a push updates `main` without creating an Actions run:

```powershell
& "C:\Users\Apoll\OneDrive\Documentos\New project\tools\gh\bin\gh.exe" workflow run verify.yml --repo ApolloDNR/WoofWatcher --ref main
```

## Normal Decisions The Automation May Make

- Implementation order within the active queue.
- Small UI copy, layout, routing, and empty-state decisions.
- Test additions and focused refactors.
- Domain helper extraction.
- Queue and docs updates after verified work.
- Bug fixes discovered while implementing the chosen slice.

## Stop Conditions

Stop only for:

- missing secrets or credentials,
- destructive database or user-data risk,
- production deployment approval,
- App Store or Play Store submission approval,
- legal/compliance review,
- money movement,
- regulated health advice boundaries,
- source-of-truth contradictions.

## Current Next Slice

As of 2026-06-19, the current queue points to native runtime QA and premium polish. The mobile app now has a registered full Phoenix sprite manifest, a complete dogless PixelLab final-candidate room set for day, night, bedtime, health-watch, and home-alone states, PixelLab frame-to-strip tooling, room-variant tooling, two subscription seed strips for movement review, an archived supplemental subscription-backed bark reaction strip, a full current Option B hard-pixel Phoenix runtime candidate family for idle/tail-wag, walk, ear-perk, eat, drink, corrected curled sleep, comfort/home-alone, health-watch, celebrate, and dedicated bark/tap reaction, a tested care-twin native QA matrix for all 12 avatar motion states, live idle/walk sprite preview packs for every non-Phoenix launch template, crisp pixel rendering on web image paths, a cleaned Avatar Studio `LivingPhoenixRoom` Studio presentation, a tighter Option B-style Phoenix Home console with in-room status HUD readouts, live/still readiness badges in the Avatar Studio template picker, a stronger live-template pixel stage in Avatar Studio, a 12-item Avatar Studio template preview catalog, a full 12-template Avatar Studio base still pack, the first Shepherd/Phoenix accessory overlay PNG pack, the first Shepherd/Phoenix 10-state emote still pack, Retriever, Husky/Spitz, and Bully 10-state template emote packs, a 10-item PixelLab inventory accessory pack, premium board anatomy across the core routes, release-grade Expo identity, EAS profiles, local-first care workflows, report/handoff surfaces, medication/water/walk/potty/training/alone-time/weight/grooming derivations, and bounded WoofGuide drafts. Expo web export is locally working again in the premium revenue builder worktree through the package-local Expo CLI and Metro resolver patch. PixelLab asset verification should be rerun after each asset import and must show no missing or invalid files. Live Expo preview/browser screenshot capture has been unreliable in this desktop environment, so use mobile typecheck, focused tests, PixelLab verification, static Expo export, and visible in-app browser checks as the current verification evidence until device QA is available.

The 2026-06-19 subscription-backed Phoenix replacement review did not promote weaker PixelLab candidates over the current Option B runtime family. Continue by testing and refining the approved layered runtime on real phone-sized screens before spending another generation batch on main-character replacement art. An internal/development `/care-twin-qa` route now renders every care-twin matrix scenario through the production `LivingPhoenixRoom`, so the next device pass can inspect all states without manually manipulating care history. The route now also captures Pass/Needs tune status, per-state notes, summary counts, and a native shareable QA report for device-session evidence.

The 2026-06-20 unblocked care-workflow pass added Incident Watch as a canonical behavior-safety workflow while native QA remains blocked. Incident Watch now covers altercations, bites, rough greetings, escape/injury, and trigger/exposure/follow-up context across Log, Records, Care Pass, shared domain logic, and tests. Keep future polish non-diagnostic and trainer/vet-review friendly.

The follow-up 2026-06-20 Incident Watch polish pass added trend windows, rising/improving/steady/clear labels, owner follow-up tasks, trainer goal suggestions, Records follow-up routing, and Care Pass trend/follow-up/goal language. The 2026-06-20 mobile-release QA pass then extended `/care-twin-qa` beyond the 12-state animation matrix into an internal launch workflow cockpit for Phoenix Home, Care Twin State Lab, Avatar Studio, Incident Composer, Records Incident Watch, and Trainer Care Pass, with Pass/Needs tune controls, per-surface notes, screenshot prompts, route-open buttons, launch-risk copy, and a combined native share report. A follow-up persistence pass made that internal QA session local-durable via AsyncStorage so testers can leave the route, inspect target workflows, return, and keep their evidence notes. The next choreography pass made Phoenix room taps state-aware and QA-readable: `careTwinChoreography.ts` derives primary loop, ambient loops, tap reaction, reaction timing, and motion-recipe copy so rest and Health Watch states stay calm instead of always barking. The latest QA evidence passes let testers attach local screenshot evidence from device Photos to each release surface and care-twin state, persist those attachments in the same local session, include filenames/counts in the share report, distinguish iOS evidence from Android evidence, and show tested Native proof open/ready plus exact missing iOS/Android/flexible evidence copy without claiming provider-backed QA storage or launch approval. Future Incident Watch work should focus on native QA polish and provider-backed behavior goal persistence after account/storage rules are approved.

The 2026-06-20 mobile-layout passes centralized floating-paw tab chrome, tabbed route bottom spacing, standalone route bottom spacing, auth/setup spacing, and docked WoofGuide composer spacing in `mobileLayout.ts`. The tab shell now uses shared tab/FAB metrics; Home, Log, Plans, Health, More, and Records use `getTabbedRouteBottomPadding`; Adventure, Avatar Studio, Care Twin QA, Premium, Privacy, Setup, and AuthShell use `getStandaloneRouteBottomPadding`; and WoofGuide uses `getDockedComposerBottomPadding` instead of route-local fixed padding. This reduces mobile safe-area drift before the native device pass, but real iOS/Android QA still must confirm phone-size bottom-nav clearance, keyboard/composer fit, touch reach, and route scrolling.

The 2026-06-20 household setup pass turned first-run onboarding into a real account-aware decision surface without pretending provider invites are live. Setup now captures Create household, Join by invite, or Local preview intent; persists `householdSetup` in the local care document; exports it in owner privacy data; blocks join saves until an invite code is present; and shows post-save confirmation copy that distinguishes local-only, account-needed, and provider-ready states. The same pass locked Apollo's latest light/dark visual reference boards into `docs/design/reference/` and the design lock docs. Provider-backed household creation, invite acceptance, role enforcement, and multi-device membership sync remain the next account/provider work.

The 2026-06-21 mobile interaction contract pass ported the latest main-line
safe-area and touch hardening into this richer advanced branch without doing a
destructive merge. `mobileLayout.ts` now centralizes route top padding, modal
sheet bottom padding, centered modal padding, keyboard avoiding offsets, floating
feedback/debug offsets, minimum touch targets, and inline hit slop. Home, Log,
Plans, Health, More, Records, Adventure, Avatar Studio, Care Twin QA, Premium,
Privacy, Setup, AuthShell, WoofGuide, ErrorFallback, and board primitives use
those helpers. Static readiness tests reject the old route-local formulas.
Local verification passed focused mobile layout/readiness tests, the 306-test
behavior/readiness suite, mobile TypeScript, PixelLab asset verification at 149
files, and Expo web export to
`tmp/woofwatcher-mobile-interaction-contract-export`.

The 2026-06-21 launch-readiness pass made the release cockpit truthful in code.
`launchReadiness.ts` derives internal-preview, native-QA-open, provider-gated,
approval-open, and store-ready states from native evidence, local release
foundations, sync health, storage, AI, payments, push, account deletion, legal,
support, store-account, and Apollo approval gates. More now uses that model for
six actionable launch tiles instead of hard-coded optimistic copy, so the app can
show exactly why it is not store-ready yet.

The follow-up 2026-06-21 storage backbone pass added a shared attachment
manifest for the local-first media/report queue. `attachmentManifest.ts` now
collects medication proof photos, record attachments, Adventure memory photos,
Care Pass print artifacts, and QA screenshots; marks each item local-only,
upload-ready, or provider-saved; and feeds the queue into Launch Readiness. More
can now show a concrete local-file storage gate without claiming cloud upload,
cross-device persistence, or provider-backed deletion is active.

The privacy continuation pass wires the same queue into owner data controls.
Privacy export bundles now include the local attachment queue count/summary, the
Privacy screen Files stat uses that full queue, document-storage gate copy names
local queued files, and deletion requests explicitly call for attachment-queue
review before destructive deletion. Provider object ids, signed downloads,
retention, and deletion receipts are still future storage-provider work.

The privacy queue review pass makes that queue owner-visible. Privacy export
bundles now include grouped review rows and the mobile Privacy screen renders
care proof photos, record documents, Adventure memories, Care Pass reports, and
QA screenshots with counts, status labels, safe action copy, and sample
filenames. The product remains truthful: rows stay local/provider-gated until
approved storage rules exist.

The release packet pass turns Launch Readiness into a shareable owner/operator
handoff. `releasePacket.ts` derives a release score, verdict, gate rows, owner
approval checklist, blockers, next actions, and truthful handoff notes from the
same `launchReadiness.ts` plan that powers More. More now displays the packet
score/verdict and exposes Share Launch Packet through native sharing. This is a
handoff artifact only; it does not approve App Store, Play Store, payments, AI,
storage, provider sync, or account deletion.

The support runbook pass makes one of the remaining launch gates concrete.
`supportRunbook.ts` derives support inbox, refund/subscription policy,
veterinary/emergency boundary, privacy/terms links, deletion escalation,
incident response, blockers, and share text. Privacy & Safety now shows a
Support runbook card with explicit blockers and native sharing. It is still a
readiness packet, not legal approval or payment activation.

The launch support profile pass made that packet editable and durable.
`CareContext` now persists `launchSupportProfile`; Privacy export includes it;
and Privacy & Safety derives the support runbook from local state instead of
hardcoded blanks. Apollo can stage support email, privacy and terms URLs,
refund/subscription approval, veterinary-boundary approval, deletion
escalation, and incident response in a bottom-sheet editor, then save as a
draft or owner-reviewed packet. This is still local owner review only, not a
claim of legal, store, provider, or payment approval.

The owner-staged launch cockpit pass connected that persisted owner review back
into More's Launch Readiness surface. `launchReadiness.ts` can now distinguish a
fully approved Store Gates state from a locally staged owner packet. More derives
privacy/legal and support-runbook owner-review flags from `state.launchSupportProfile`
and `supportRunbook.ts`, so the launch cockpit can say "Owner packet staged"
while still naming the remaining final legal/provider, support/provider,
app-store account, notification, and account-deletion approvals.

The store submission packet pass made store-prep actionable without pretending
the app is approved for submission. `storeSubmissionPacket.ts` derives App
Store/Play Store metadata draft, keyword draft, screenshot checklist, review
notes, privacy disclosures, and blocked-until gates from the release packet.
More now shows this as a Store Submission panel and a separate native share
action inside Launch Readiness. This is preparation only; final Apple, Google,
legal/privacy, support, deletion, notification, native-QA, and provider approvals
still control public launch.

The store screenshot QA cockpit pass connected that packet to the actual device
review path. `mobileReleaseQa.ts` now converts the Store Submission screenshot
checklist into route-targeted QA surfaces with explicit iOS and Android
evidence slots, and `/care-twin-qa` renders those screens under Store Screenshot
QA. The same cockpit now tracks launch workflow screenshots, store listing
screenshots, care-twin state screenshots, notes, Pass/Needs tune status, and
native share reports. Store screenshot capture remains preparation evidence only
until Apollo completes final App Store, Play Store, legal/privacy, support,
deletion, notification, provider, and native QA approval.

The saved-QA launch-readiness pass closed the loop between the internal QA
route and the main operator cockpit. `mobileLaunchQaEvidence.ts` derives the
combined launch/store QA surface list and turns the saved `/care-twin-qa`
session into the exact native QA summary used by `deriveLaunchReadiness`, while
returning `null` for empty sessions. More reloads the saved session on focus, so
real iOS/Android evidence can move the launch tile from generic "Device proof
required" to the specific missing evidence state without claiming store
approval.

The Native QA next-captures pass made that cockpit more actionable. The same
model now computes the next open capture targets, including missing iOS,
Android, and flexible screenshot evidence by surface, sorted with
launch-critical screens first. More renders those targets as direct route jumps
inside Launch Readiness so Apollo or a device tester can see exactly which
screens to capture next.

The Native QA share-plan pass makes that queue handoff-ready. More can now
share a route-by-route QA script generated from the same saved-session capture
plan, including progress, missing proof, evidence counts, and a done condition.
This lets Apollo send the next device-testing plan to himself, Fable/Replit, or
a helper without drifting from the live app state.

The Provider Launch Setup pass turns production setup from vague blockers into
a saved operator workflow. `launchProviderSetup.ts` derives the eight provider
gates needed for a real public release: production auth, household database
sync, record/media storage, WoofGuide AI, Plus payments, push notifications,
Apple/Google store accounts, and self-serve account deletion. More renders the
plan inside Launch Readiness with a progress score, first open rows, an edit
sheet, and a native Share Provider Plan action. `CareContext` persists
`launchProviderProfile`, Privacy export includes it, and Launch Readiness now
consumes those saved gates while still refusing to claim public launch until
native QA, legal/support/store approval, and Apollo sign-off are complete.

The Provider Launch Setup proof pass made those gates more operator-ready for
the two-day beta handoff. Each provider row now includes a `proofRequired`
checklist, More shows `Proof needed:` under the row detail, and the shared
provider packet includes a `Proof Needed` section. This gives Apollo, Replit, or
a native helper concrete evidence to collect for Clerk, Supabase/RLS, storage,
AI policy, payments, push, store accounts, and account deletion without
pretending those external approvals are complete.

The two-day beta QA cockpit pass made device capture less fragile. `/care-twin-qa`
now tags attached screenshot evidence explicitly as iOS, Android, or Web instead
of relying on the runtime platform, and target routes opened from the cockpit
carry temporary QA return context. Shared board-header screens show a `Return to
QA Cockpit` banner during those capture sessions, so a tester can open the next
surface, screenshot it, return, attach proof, and mark Pass or Needs tune without
getting lost. This is still capture tooling only; it does not replace actual
iOS/Android screenshots or human visual approval.

The device mission briefing pass made the same two-day QA flow more operator
proof. `/care-twin-qa` now shows a `Next device mission` panel before route
launch with the target route, priority, review status, evidence count, setup
steps, pass criteria, and exact Needs tune escalation copy. Apollo or a helper
can read the mission, choose the correct platform tag, open the route, capture,
return, and attach proof without cross-checking separate docs. Real iOS/Android
screenshots remain the next gate. Local verification passed the targeted QA
suite, full focused behavior/readiness suite, mobile TypeScript, PixelLab asset
verification, `git diff --check`, and package-local Expo web export.

The mission action rail pass made the 48-hour QA card faster for real testers.
`/care-twin-qa` now resolves the active `nextBetaSurface` and exposes top-card
controls to attach proof, mark the mission Pass, or mark it Needs tune using
the selected iOS/Android/Web evidence tag. Those actions feed the same local QA
evidence and surface-review state as the full checklist below, with accessible
labels and shared 48px touch targets. This still does not replace real
iOS/Android screenshots or human approval; it reduces the taps needed to collect
that proof under the two-day beta deadline.

The owner-preview QA loop pass adds the real first-user journey as its own
launch-critical surface. Mobile Release QA now requires testers to prove Home,
Log, Plans, Health, More, Records, Avatar Studio, and Care Pass are reachable
without dead ends; quick-log one safe care event or open the detail sheet; inspect
Plans and Health Watch/Bile Watch; open Launch Readiness from More; and attach
platform-specific evidence for iOS Quick Log/Log plus Android Launch Readiness.
This is the strongest remaining internal-beta proof path before wider sharing,
while provider setup, legal/privacy, store approval, and public launch remain
separate gates.

The owner route-loop guide pass made that proof path visible inside the cockpit.
`/care-twin-qa` now renders an `Owner route loop` panel in the 48-hour beta run
card when the current target is the Owner Preview Core Loop. The same route
checklist is carried into the capture plan and share script, so Apollo or a
helper can test Home, Log, Plans, Health, More, Records, Avatar Studio, and Care
Pass in order without drifting from the app's live QA model. This is still a
native-capture guide; real iOS/Android screenshots and human approval remain the
next release gate.

The owner-preview note gate pass made required QA-note proof real instead of
copy-only. The capture-plan model now recognizes required `Note ...` evidence
and keeps the Owner Preview Core Loop open until a QA note is written, even if
screenshots are attached and the surface is marked Pass. `/care-twin-qa` exposes
that `Mission note` in the top 48-hour beta run card and labels it Required
when the active target needs note proof. This helps Apollo capture the no-dead-
ends owner journey in one place.

The QA cockpit share-packet pass made the same owner-preview mission portable
from the screen where proof is captured. `/care-twin-qa`'s `Share QA` action now
starts with the live native capture plan, then appends the full mobile release
QA, store submission packet, and care-twin state report. This keeps the next
target, missing evidence, Owner route loop, Mission note requirement, and done
condition aligned between the cockpit UI and the handoff text Apollo can send to
a phone tester or design-polish tool.

The proof-gated mission pass tightened the two-day beta cockpit against false
completion. `/care-twin-qa` now shows `Pass pending proof` when the active
mission is marked Pass but the capture plan still needs required screenshot or
Mission note evidence. The same card explains why the mission remains open and
lists the first missing proof items, so Apollo or a helper can resolve the gap
without reading separate docs.

The Launch Readiness proof-status pass carried that same truth state back into
More. The Native QA Next Captures panel now shows `Proof status` for each
target and labels incomplete Pass rows as `Pass pending proof`; the shareable
QA capture script exports the same owner-readable status. This keeps Apollo,
phone testers, and design-polish helpers from mistaking a marked Pass for
complete proof.

The proof-completion navigation pass made that More panel actionable under the
two-day deadline. Native QA Next Captures now pairs `Share QA Plan` with a
second 48px action: `Finish Proof` when any target is still `Pass pending proof`,
otherwise `Open QA Cockpit`. That action routes directly to `/care-twin-qa`, so
testers can resolve missing screenshots or Mission notes without hunting
through More.

The QA cockpit touch-target pass hardened the actual proof screen before the
native capture run. `/care-twin-qa` now uses the shared 48px mobile target for
the screenshot platform picker, Open Next Surface, Share QA, Share QA Summary,
evidence attach/clear, per-surface Open Surface, and Pass/Needs tune review
controls. Static readiness parses those style blocks by name so the two-day
beta cockpit cannot quietly regress to cramped route-local controls.

The Quick Log touch-target pass hardened the highest-frequency owner action.
The Log route now applies the shared 48px target to retry, care-type tabs,
Undo/Add details, alone-time return outcomes, active-walk finish, trust proof
attachment, trust review, meal outcome, potty outcome, and potty save controls.
This keeps the under-five-second logging flow more phone-native while still
preserving the neo-retro board layout.

The Health Watch touch-target pass hardened the route that needs to feel calm,
trustworthy, and easy under pressure. Health now applies the shared 48px target
to the Health/Bile segmented tabs plus the `Log health note` and `Records` hero
actions, while leaving visual meters and pixel health cards untouched. This
keeps the non-diagnostic Health Watch/Bile Watch owner-preview path more usable
on phones without turning the screen into generic utility UI.

The Plans touch-target pass hardened the schedule/routine route for the same
owner-preview loop. Plans now applies the shared 48px target to Add plan, Find
event, suggestion add, schedule tabs, schedule completion, routine add, event
remove, routine done, modal type chips, owner chips, save, and delete controls.
Static readiness guards those named style blocks, so the route cannot quietly
fall back to cramped 28-42px controls while Apollo or a helper is trying to
prove the beta journey under the two-day deadline.

The More gateway touch-target pass hardened the route that connects Launch
Readiness, Records, Care Pass, Avatar Studio, provider setup, household invite,
and profile/diet editing. More now applies the shared 48px target to profile
edit, Care Intelligence action, provider setup actions, native QA share/cockpit
actions, beta next action, Launch/Store packet share actions, Access Pass share
and role chips, household invite, prompt modal actions, provider status chips,
weight-unit chips, and profile/diet/provider save buttons. This makes the beta
handoff and owner-preview route loop easier to run on phones without pretending
public store or provider gates are closed.

The Records/Care Pass touch-target pass hardened the route where beta testers
show the serious value of the app: Dog ID, medication history, records, saved
reports, and Care Pass export. Records now applies the shared 48px target to
Dog ID share/print actions, medication search clear and filter chips, Care Pass
preview rows, saved report artifact resend/print actions, progress report tabs,
record delete, empty add, record type chips, attachment, and sheet cancel/save
controls. Static readiness guards those named style blocks so the report and
handoff workflows stay phone-sized during the owner-preview route loop.

The Avatar Studio touch-target pass hardened the creator route that sells the
care-twin promise. Avatar Studio now applies the shared 48px target to creator
tabs, gallery/take-photo/reset/save buttons, coat swatches, face-marking
options, mood preview chips, and shared-constant-backed template/accessory
tiles. The larger art tiles remain visually rich, but the route is now guarded
against cramped mobile controls during the scan, template, customize, emote,
and save portions of the owner-preview route loop.

The Adventure Mode touch-target pass hardened the beta's game/memory layer.
Adventure now applies the shared 48px target to `Save Memory` and `Share
Adventure`, with static readiness guarding the route's `primaryBtn` and
`secondaryBtn` styles. Local verification passed red/green readiness, targeted
QA/readiness, broad behavior/readiness, PixelLab verification, and `git diff
--check`. Mobile TypeScript is currently dependency-blocked in this cleaned
Windows shell because the Expo/mobile dependency layer is absent
(`expo/tsconfig.base` not found). Expo web export still needs to be rerun from a
shell-compatible environment because the current Windows bundled-pnpm attempt
reached the registry but failed before export when the root preinstall script
called missing `sh`.

The Phoenix Home owner-preview touch-target pass hardened the first impression
for the two-day beta. Home now applies the shared 48px target to the
header/menu action, Avatar Studio hero entry, household presence panel, and
Adventure inline action. Static readiness guards `headerButton`,
`heroStudioButton`, `presencePanel`, and `adventureInline`, after first failing
on the route-local 42px `headerButton`. Local verification passed targeted
QA/readiness, broad behavior/readiness, PixelLab verification, and `git diff
--check`. Mobile TypeScript and Expo web export remain dependency/shell
environment gates in this cleaned Windows shell and should be rerun from Git
Bash, WSL, CI, or a preinstalled dependency layer.

The WoofGuide touch-target pass hardened the assistant route that turns care
history into owner-reviewed actions. WoofGuide now applies the shared 48px
target to quick question chips, suggested action rows, the chat composer send
button, and owner-review Cancel/Apply draft controls. Static readiness guards
`quickChip`, `actionRow`, `sendBtn`, `reviewCancel`, and `reviewApply`, after
first failing on `quickChip`. Local verification passed targeted QA/readiness,
broad behavior/readiness, PixelLab verification, and `git diff --check`. Mobile
TypeScript and Expo web export remain dependency/shell environment gates in
this cleaned Windows shell and should be rerun from Git Bash, WSL, CI, or a
preinstalled dependency layer.

The 48-hour beta handoff pass turned the launch packet plus native QA plan into
one owner-readable share artifact. `betaHandoffPacket.ts` now combines the
truthful release packet with the live native QA capture plan, including beta
verdict, public-launch verdict, QA progress, current device mission, missing
proof, setup/device steps, pass criteria, Needs tune copy, Owner route loop run
order, Pass pending proof instruction, and public/provider/AI truth boundaries.
More's Launch Readiness beta card now exposes a phone-sized `Share Beta
Handoff` action while keeping `Open QA Cockpit` as the primary path when device
proof is still missing. Local verification passed the red/green helper and
readiness tests, targeted beta QA/readiness, broad behavior/readiness, PixelLab
verification, and `git diff --check`. Mobile TypeScript and Expo web export
remain dependency/shell environment gates in this cleaned Windows shell and
should be rerun from Git Bash, WSL, CI, or a preinstalled dependency layer.

The Native QA Needs Tune fix-brief pass tightened the two-day beta repair loop.
`mobileLaunchQaEvidence.ts` now carries `firstNeedsTuneTarget` for the first
route marked Needs tune, even if that route is outside the visible next-four
capture rows, and `buildMobileLaunchQaFixBriefShareText` turns it into a
focused repair packet with route, QA note, proof gaps, setup/repro steps,
optional route loop, done condition, and return-to-`/care-twin-qa`
instructions. More's Native QA Next Captures panel now shows `Share Fix Brief`
only when a Needs tune target exists, and the new button uses the shared 48px
touch target. Red/green local verification passed after the helper and More
wiring were absent: `mobileLaunchQaEvidence.test.ts` passed 12 tests and
`mobileReadiness.test.ts` passed 78 tests. Follow-up local verification passed
the 100-test targeted beta QA/readiness suite, the 401-test focused
behavior/readiness suite, PixelLab verification at 149 files, and `git diff
--check` with expected Windows line-ending warnings only. Mobile TypeScript and
Expo export remain dependency/shell-gated in this cleaned Windows shell. Real
iOS/Android capture is still the deadline gate.

The Expo export config pass removed another packaging ambiguity before the
two-day beta. `artifacts/woofwatcher-mobile/app.json` now explicitly declares
the intended `ios`, `android`, and `web` platforms and sets `expo.web.bundler`
to `metro`, matching the `smoke:web` route that CI and local export use. Static
readiness protects those values. A direct package-local Expo CLI export now
advances past the previous Metro platform-config error and stops at the
truthful dependency-layer blocker: the mobile package cannot currently resolve
`expo` in this cleaned Windows shell. Treat the Expo config as ready, but do
not treat the beta as export-proven until a dependency-complete environment
runs the smoke export and verifies emitted HTML/JavaScript output.

The mobile beta doctor pass gives Apollo/Replit/device helpers a single
pre-export command. `pnpm run doctor:mobile-beta` checks pnpm, the root
Windows-friendly install guard, mobile `smoke:web`, Expo iOS/Android/web +
Metro config, mobile Expo dependency resolution, PixelLab verifier presence,
and the `/care-twin-qa` proof path with iOS/Android screenshot and Mission note
requirements. In this cleaned Windows shell it currently reports the expected
two blockers: no local `pnpm` and no mobile `expo` dependency resolution. Use
the doctor before claiming the two-day beta is export-ready.

The package-manager alignment pass removed another handoff ambiguity before the
two-day beta. Root `package.json` now declares `packageManager: pnpm@10.24.0`,
matching the pnpm version in `.github/workflows/verify.yml`, and
`scripts/mobile-beta-doctor.mjs` checks that alignment before export handoff.
This gives Replit, Corepack, local shells, and CI the same pnpm target. In this
cleaned Windows shell the doctor now passes the package-manager gate while
still reporting the true install/export blockers: no local `pnpm` and no mobile
`expo` dependency resolution.

The Corepack guidance pass made the remaining install blocker more actionable
without pretending export proof exists. `scripts/mobile-beta-doctor.mjs` now
checks Corepack as a warning-level bootstrap helper and prints the exact command
`corepack prepare pnpm@10.24.0 --activate` when pnpm is missing. In this cleaned
Windows shell Corepack is not on PATH, so the doctor tells a helper to install
pnpm 10.24.0 directly or use Replit/WSL, then still blocks on the true missing
pnpm and mobile `expo` dependency gates.

The Node/EAS doctor pass hardened the native beta export handoff. The mobile
beta doctor now checks the active runtime as `Node 24 runtime` and verifies
`artifacts/woofwatcher-mobile/eas.json` has iOS and Android build profile
coverage for both preview and production. In this cleaned Windows shell those
native-environment checks pass, while the doctor still blocks honestly on the
missing pnpm and missing mobile `expo` dependency gates.

The exact pnpm CLI pass hardened the dependency/export gate one more step. The
doctor now derives `expectedPackageManager` from `expectedPnpmVersion` and
blocks any available `pnpm` command whose `pnpm --version` output is not exactly
`10.24.0`. This prevents a helper environment or bundled runtime with pnpm 11.x
from being mistaken for the pinned beta export path.

The machine-readable doctor pass made the same gate usable by Replit, native
helpers, or automation. `pnpm run doctor:mobile-beta:json` now calls
`scripts/mobile-beta-doctor.mjs --json` and emits a single JSON payload with the
doctor name, purpose, `result`, individual `checks`, `issues`, `warnings`,
`proofCommands`, and `nextActions`. In this cleaned Windows shell the JSON
output is parseable and truthfully reports `BLOCKED` for the same two real
export issues: missing pnpm and missing mobile `expo` dependency resolution.
Use the text command for humans and the JSON command for any helper that needs
to decide whether the beta environment is ready without scraping console prose.

The beta handoff dependency-proof pass moved that same command sequence into
the owner-readable `Share Beta Handoff` packet. Helpers now see
`corepack prepare pnpm@10.24.0 --activate`, `pnpm install`,
`pnpm run doctor:mobile-beta`, `pnpm run doctor:mobile-beta:json`, and
`pnpm --filter @workspace/woofwatcher-mobile run smoke:web` in the generated
handoff, alongside explicit copy that dependency proof only counts when both
doctor commands report no blockers.

The beta handoff provider-proof pass merged the Provider Launch Setup evidence
map into that same owner-readable packet. `buildBetaHandoffPacketShareText` now
accepts a provider setup plan, keeps backward-compatible timestamp calls, and
adds a `Provider proof needed` section for Clerk, Supabase/RLS, storage, AI
policy, payments, push, store accounts, and account deletion. More passes the
live `launchProviderSetupPlan` into `Share Beta Handoff`, so the deadline packet
now carries dependency proof, device proof, provider proof, and truth boundaries
without requiring helpers to cross-reference a second provider share artifact.

The beta doctor proof-section pass made the same expectation machine-readable.
`scripts/mobile-beta-doctor.mjs --json` now emits `handoffProofSections` with
the required 48-hour packet sections: `Dependency proof commands`, `Required
beta proof after export`, `Provider proof needed`, and `Truth boundaries`. The
human doctor output prints the same checklist after the proof commands and
device proof list. This lets Replit, Fable, Apollo, or a native QA helper verify
that the one-tap handoff packet is complete before anyone claims dependency,
device, provider, or public-launch proof. In this cleaned Windows shell the
doctor remains correctly blocked on missing pnpm and missing mobile `expo`
dependency resolution.

The beta doctor source-validation pass made that proof-section checklist harder
to drift. `buildBetaHandoffPacketShareText` now has a literal `Required beta
proof after export` section for `/care-twin-qa`, iOS/Android screenshot proof,
Mission note, and Pass pending proof requirements. The doctor now reads the
actual beta handoff packet source plus the More route and passes `beta handoff
source includes proof sections` only when the packet still contains dependency
proof, required beta proof, provider proof, truth boundaries, `Share Beta
Handoff`, and `providerSetupPlan: launchProviderSetupPlan` wiring. This keeps
the one-tap handoff, provider setup, and machine-readable doctor aligned under
the two-day beta deadline.

Next highest-impact work:

1. Run `corepack prepare pnpm@10.24.0 --activate` when Corepack is available and pnpm is missing, then run `pnpm run doctor:mobile-beta`, `pnpm run doctor:mobile-beta:json`, and package install/export from a dependency-complete environment now that the root `preinstall` guard no longer requires `sh -c`, the root package manager is pinned to `pnpm@10.24.0`, the mobile app declares Metro web export platforms, and the doctor verifies Node 24, exact pnpm 10.24.0 CLI usage, plus native EAS iOS/Android profile coverage. Use Replit, Git Bash/WSL with pnpm 10.24.0 installed or Corepack-enabled, CI after billing is fixed, or another environment with the Expo/mobile dependency layer, then record TypeScript/export evidence.
2. Run native iOS/Android simulator or device QA with `/care-twin-qa` and `docs/release/CARE_TWIN_NATIVE_QA_MATRIX.md`, starting with the `Owner Preview Core Loop`: read the in-card `Owner route loop`, complete Home, Log, Plans, Health, More, Records, Avatar Studio, Care Pass, and Adventure without dead ends, attach iOS Quick Log/Log proof and Android Launch Readiness proof through the 48-hour mission card or lower platform-aware evidence controls, write the required `Mission note`, confirm `Pass pending proof` clears only after required proof is saved in both `/care-twin-qa` and More's Native QA Next Captures, use More's `Share Beta Handoff` action after saved proof is current, then continue the Store Screenshot QA checklist and 12-state care-twin matrix, confirm More's Launch Readiness updates from the saved proof, share/export the QA report, mark the first visible stage/sprite/Incident Watch/safe-area/composer/setup/modal/touch issue as Needs tune, use More's `Share Fix Brief`, and fix that first route before moving on.
3. Fill the Provider Launch Setup sheet only as real providers are configured: Clerk, Supabase/Postgres, storage buckets/rules, AI key/model policy, app-store payments, push, Apple/Google accounts, and self-serve deletion. Share the provider plan for Apollo/Fable/Replit handoff, but do not treat it as store approval.
4. Continue production-scale Avatar Studio animation packs: native phone-size QA for the wired Option B Phoenix family, review all template-matched sprite strips, refine weak gait loops where needed, add overlay layers, remaining emote stills, and body-class polish.
5. Continue screen-by-screen polish, accessibility traversal, and visual regression.
6. Prepare provider-backed auth, storage, AI, notifications, checkout, and app-store submission only after Apollo approves those production decisions.
