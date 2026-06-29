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

The bundled-pnpm guard closes another beta handoff false-positive. The Codex
runtime can expose a bundled pnpm package that is not the release-required
`pnpm 10.24.0`; in this shell that bundled candidate is `pnpm 11.7.0`. The
doctor JSON now emits `unsupported bundled pnpm candidate` as a warning-level
check with the exact candidate path and version, while still blocking only on
the true export blockers. Treat any dependency proof that uses the bundled
candidate as invalid until a real PATH pnpm at `10.24.0` and the mobile Expo
dependencies are present.

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

The owner-preview proof-status pass keeps the most important beta loop visible
even when other QA surfaces appear earlier in the next-capture list.
`buildMobileLaunchQaCapturePlan` now always derives `ownerPreviewProofStatus`
for `Owner Preview Core Loop`, including whether it is complete, Pass pending
proof, Needs tune, not reviewed, or missing from the QA plan. More's Native QA
panel shows that status as an `Owner preview proof` row and keeps the cockpit
CTA at `Finish Proof` whenever the owner loop is marked Pass but still lacks
the Mission note. The Native QA share text and `Share Beta Handoff` packet also
print the owner-preview proof status and missing proof so Apollo, Replit,
Fable, or a device helper cannot claim owner-preview beta proof from partial
screenshots alone.

The owner-preview doctor source-validation pass now protects that wiring from
drift. `scripts/mobile-beta-doctor.mjs --json` emits `owner preview proof
wiring is source-backed` only when the QA evidence model still derives
`ownerPreviewProofStatus` from `OWNER_PREVIEW_CORE_LOOP_ID`, the beta handoff
packet still prints `Owner preview proof` plus `Owner preview missing`, and
More still displays `Owner preview proof` with the `Finish Proof` recovery CTA.
This gives Apollo, Replit, Fable, or a native helper one machine-readable check
that the owner-preview beta proof row is still wired before anyone spends time
on device screenshots.

The `/care-twin-qa` route source-validation pass protects the actual device
mission next. `scripts/mobile-beta-doctor.mjs --json` emits `care-twin QA route
proof flow is source-backed` only when the route still carries Mission note,
Pass pending proof, attach-proof, stage test IDs, and QA-return wiring, and
when the release QA matrix still declares the `Owner Preview Core Loop`, the
iOS Quick Log/Log screenshot proof, the Android Launch Readiness screenshot
proof, and `/care-twin-qa` route. This keeps the doctor tied to the real screen
Apollo or a helper will use, not just to handoff prose.

The Native QA Needs tune recovery pass now protects the repair loop after the
device mission finds an issue. `scripts/mobile-beta-doctor.mjs --json` emits
`native QA Needs tune fix brief is source-backed` only when the QA evidence
builder still creates a `WoofWatcher Needs Tune Fix Brief`, tracks
`firstNeedsTuneTarget`, includes the truthful no-needs-tune fallback, and tells
the helper to return to `/care-twin-qa` after the fix, while More still imports
the builder, detects `nativeQaCaptureNeedsTuneTarget`, and exposes the `Share
Fix Brief` recovery action. This keeps the first below-beta route actionable
without pretending native proof is complete.

The beta handoff section pass made that recovery loop part of the required
48-hour packet. `buildBetaHandoffPacketShareText` now prints a dedicated
`Native QA Needs tune fix brief` section telling helpers to use More's `Share
Fix Brief` before claiming beta proof when any route is marked Needs tune, then
fix the first below-beta route, return to `/care-twin-qa`, attach confirmation
proof, and update the Mission note. `scripts/mobile-beta-doctor.mjs --json`
lists the same section in `handoffProofSections`, so automation can check for
the repair handoff without scraping packet prose.

The pending-meal formula pass hardened the core routines/logs relationship while
the dependency-complete native beta path remains external. A meal that is only
`served`, `outcome-pending`, or `grazing` now stays open in shared day status as
a `pending` meal outcome instead of being counted as fully resolved. Today
Command now prioritizes `Update [meal] outcome` for the oldest household-visible
pending meal before moving on to the walk/routine queue, and caregiver handoff
now separates "meals resolved" from "outcome pending" so sitters, owners, and
reports do not mistake a bowl on the floor for a completed meal.

The Routine Board pending-state pass made the same lifecycle visible in Plans
and assigned routine views. `deriveRoutineBoard` now has a `pending` status and
`Outcome pending` completion label for served/grazing meals, keeps those routines
open, preserves who served them, and surfaces them as the next routine until the
household records the outcome. Partial, skipped/refused, and completed meal
outcomes still satisfy the matching routine.

The pending meal outcome edit pass made the correction path reusable and more
complete. `mealOutcomeUpdate.ts` now owns the shared Log detail update formula
for `Ate all`, `Ate most`, `Ate some`, `Refused`, and `Still grazing`, while
preserving household visibility, routine ids, expected/served portions, eaten
amounts, trust state, and audit history. Log's detail sheet now uses that helper
instead of a local inline formula, so Timeline/Recent Activity meal outcome
updates include `Ate some`, keep grazing meals open as pending, mark refused and
partial outcomes as watch items, and write a correction trail for owner review.

The diet/report truth pass made downstream outputs respect the same lifecycle.
`deriveDietProgress` no longer counts a `served`, `grazing`, or
`outcome-pending` bowl as eaten food, now counts pending meal outcomes and
estimated partial amounts separately, and only estimates partial intake when an
exact eaten amount was not supplied. Care Pass Diet sections now include the
Daily food summary and a Meal amount note when outcomes are pending or estimated,
so sitter/vet exports stay honest about what is confirmed versus still waiting
for household follow-up.

The WoofGuide meal-draft truth pass closed the remaining assistant copy gap.
WoofGuide's missing-meal owner-review draft now creates a served meal with
`mealLifecycle: outcome-pending` and `requiresOutcomeUpdate: true` instead of
claiming the meal was complete, and Today Command's latest handoff says a
pending meal was served with outcome pending rather than generically logged.
This keeps the care RPG loop playful without letting the assistant or Home
handoff imply that Phoenix actually ate before the household confirms it.

The Care Pass meal follow-up pass made the same lifecycle shareable. Care Pass
reports now include a `Meal Follow-ups` section when household-visible meal logs
have unresolved outcomes, estimated partial amounts, or corrected audit history.
This gives sitters, vets, and future report/PDF polish a direct owner-review row
instead of forcing them to infer pending or corrected meal truth from totals.

The Weekly Care Trends pending-meal pass closed the remaining trend/report copy
gap around open bowls. `deriveCareTrends` now tracks pending meal outcomes
separately from complete, partial, and skipped meals, summaries/highlights/signals
tell the household when served or grazing meals still need outcome updates, Care
Pass trend sections include the pending count, and Records shows a `Meal open`
metric in the Care Trends card. This keeps the weekly report layer aligned with
Routine Board, Today Command, Diet Progress, WoofGuide, and Care Pass follow-ups
instead of letting a served bowl read as resolved progress.

The provider-aware Care Pass storage pass connected Report History to the
Provider Launch Setup sheet without claiming cloud storage is finished. Saved
Care Pass artifacts stay local-only by default, become `Ready to upload` only
when storage provider setup is marked configured, and still keep
`providerBacked` false until real provider upload, signed access, retention,
export, and deletion rules exist. This makes Records/Care Pass production status
more useful for Apollo, Replit, Fable, and native helpers while preserving the
truth boundary.

The beta doctor guard pass made that same provider-aware storage chain
source-backed. `scripts/mobile-beta-doctor.mjs --json` now checks the
care-domain helper and Records route directly before reporting provider-aware
Care Pass storage as protected, so helper environments can catch a regression
before claiming export or handoff readiness.

The owner-preview native QA pass made the same truth boundary part of the real
phone loop. Testers must now confirm Care Pass Report History storage status
stays `Saved on this device` or `Ready to upload` without implying provider
upload, and the proof stays a required Mission note rather than an extra
screenshot slot.

The owner-preview storage-proof doctor pass made that phone-loop requirement
source-backed for handoff environments. `scripts/mobile-beta-doctor.mjs --json`
now reports `owner-preview Care Pass storage proof is source-backed` only when
the release QA matrix still includes the Care Pass Report History storage-status
proof, the native QA capture share text still carries route-check `Proof:`
lines, and `/care-twin-qa` still renders the Owner route-loop proof text. This
keeps Apollo, Replit, Fable, or a native helper from losing the storage-truth
Mission note while the dependency/export gate remains external.

The beta handoff packet pass moved the same proof into the one-tap helper script
itself. `buildBetaHandoffPacketShareText` now lists `Confirm Care Pass Report
History storage status says Saved on this device or Ready to upload` under
`Required beta proof after export`, and the doctor source-backed guard requires
that line before passing the Owner Preview storage-proof check.

The bundled-pnpm handoff guard keeps the same packet from letting a helper use
the wrong package manager. `buildBetaHandoffPacketShareText` now warns that
dependency proof requires a real PATH `pnpm` at `10.24.0` and not a bundled
`pnpm 11.x` candidate, and the doctor source-backed handoff check requires that
line before it passes.

The Care Pass export manifest pass makes saved report artifacts clearer for
owners, device testers, and future PDF/provider work. `describeCarePassArtifactExport`
now describes the actual artifact available today as `Printable HTML`, includes
the filename, MIME type, byte size, source status, storage readiness, and
provider-backed truth flag, and explicitly says PDF export still needs native or
provider-backed generation. Records Report History renders that manifest beside
the existing resend and printable-source actions, and the mobile beta doctor now
source-validates the new export-helper route through `exportView.storage`.

The beta handoff export-manifest proof pass makes the same boundary visible in
the one-tap helper packet. `buildBetaHandoffPacketShareText` now tells helpers
to confirm Report History shows `Printable HTML`, file size, and `PDF pending`
before claiming PDF readiness, and the mobile beta doctor requires that line in
the handoff source before its source-backed guards pass.

The beta doctor export-manifest next-action pass keeps the machine-readable
doctor aligned with that handoff packet. `scripts/mobile-beta-doctor.mjs --json`
now includes a `nextActions` item telling helpers to verify Records/Care Pass
Report History shows `Printable HTML`, file size, and `PDF pending` before
claiming PDF readiness. This keeps Replit, Fable, Apollo, or a native QA helper
from reading the JSON doctor as export-complete while the real artifact is still
printable HTML with PDF generation pending.

The beta doctor truth-boundary pass makes the JSON doctor harder to misuse as a
launch approval artifact. `scripts/mobile-beta-doctor.mjs --json` now emits
`truthBoundaries`, and human mode prints the same list: `READY_FOR_EXPORT` only
means dependency install and web export gates are ready to verify, it does not
approve App Store, Play Store, native device QA, provider sync, storage, AI,
payments, legal/privacy/support, or Apollo launch sign-off, and `BLOCKED` means
helpers must not claim beta export readiness until the listed issues and proof
commands pass.

The Phoenix Home first-screen polish pass gave the flagship screen a reusable
responsive composition contract. `homeFirstScreenLayout.ts` now controls
compact/balanced/showcase density, hero stage ratio, presence-card overlap,
status tile sizing, and mission-deck peek above the floating paw nav. Home uses
that contract instead of a hardcoded room ratio, and mobile readiness protects
the wiring so future Fable/Replit/native polish can tune the first screen
without breaking the care-command layer.

The Health Watch Care Status polish pass moved the Health tab closer to the
saved Option B boards. The top Health screen is now a cream `CARE STATUS`
console with a pixel medallion, score track, shared segmented `StatusMeter`
rows, a 7-day rhythm strip derived from care logs versus watch signals, and the
visible boundary `Health observations, not diagnosis`. This keeps Health calm,
premium, non-diagnostic, and more App Store-ready while still grounded in real
care data.

The Quick Log workflow literacy polish pass made the locked logging doctrine
visible in the actual product. The Log launcher now shows `Tap`, `Hold`, and
`Edit later` as compact workflow chips before the action grid, and launcher
detail sheets render the same interaction rail from `describeQuickLogDetailSheet`
alongside an editable-Timeline reminder. Routine care stays fast, medication and
health/safety logs still open details first, and the UI now explains that saved
logs can be updated, corrected, confirmed, or given sticky notes later.

The Log detail control polish pass made saved care entries feel more like
durable product records. Detail sheets now show a `Review / Edit / Sticky /
Audit` command rail, live audit event counts when available, a labeled `Record
controls` action cluster, accessible handoff/sticky/edit/delete actions, and
48px mobile touch targets. Local verification passed mobile readiness, the
390-test behavior/readiness suite, TypeScript, PixelLab verification at 149
files, Expo web export, preview `HEAD 200`, `/log` browser console smoke, and
`git diff --check` with expected Windows CRLF warnings only.

Remote verification for that pass was dispatched as GitHub Actions run
`28284289996`, but job `83805462813` failed before execution with no steps and
no logs. The check-run annotation reports the standing account
billing/spending-limit blocker, so this remains an external CI gate rather than
a product regression.

The Avatar Studio scan-truth polish pass made the product hook clearer and more
honest. `AVATAR_SCAN_WORKFLOW_STEPS` now locks the route to `Photo reference ->
Template match -> Pixel twin -> Owner approval`, `/portrait` shows
PixelLab-backed/not-a-photo-filter truth chips, and the Scan tab renders the
four-step pipeline before Gallery/Take Photo. Local verification passed the
intentional red/green Avatar Studio guard, the 391-test behavior/readiness
suite, TypeScript, PixelLab verification at 149 files, Expo web export, preview
`HEAD 200`, `/portrait` browser console smoke, and `git diff --check` with
expected Windows CRLF warnings only.

Remote verification for that pass was dispatched as GitHub Actions run
`28284851874`, but job `83806951495` failed before execution with no steps. The
check-run annotation reports the standing account billing/spending-limit
blocker, so this remains an external CI gate rather than a product regression.

The Records Care Pass export-manifest polish pass made saved report artifacts
more readable and launch-trustworthy. `describeCarePassArtifactExport` now
returns explicit manifest rows for `Format`, `Source`, `PDF`, and `Storage`;
Records Report History renders those rows as a compact board grid while keeping
the existing resend and printable-source share actions. The surface still says
`PDF pending` and keeps provider-backed storage false until native/provider PDF
generation and real storage upload exist. Local verification passed the
red/green Care Pass/mobile readiness guard, the 391-test behavior/readiness
suite, PixelLab verification at 149 files, mobile TypeScript after regenerating
ignored care-domain declarations, Expo web export, preview `HEAD 200`,
`/records` browser console smoke, and `git diff --check` with expected Windows
CRLF warnings only. A broad root `tsc --build --pretty false` still fails on
pre-existing duplicate exports in `lib/api-zod/src/index.ts`, unrelated to this
Records polish.

Remote verification for that pass was dispatched as GitHub Actions run
`28285718091`, but job `83809213051` failed before execution with no steps and
no failed log. The check-run annotation reports the standing account
billing/spending-limit blocker, so this remains an external CI gate rather than
a product regression.

The API Zod barrel typecheck cleanup pass resolved the root TypeScript blocker
that surfaced during Records verification. `lib/api-zod/src/index.ts` now keeps
generated Zod schemas as runtime exports, explicitly re-exports non-colliding
generated model types, and aliases the eight household invitation/cleanup model
type collisions with `Type` suffix names. `apiReadiness.test.ts` now prevents
the barrel from regressing to ambiguous generated type star exports. Local
verification passed the API readiness suite, the 431-test root focused suite,
and `tsc --build --pretty false`.

Remote verification for that pass was dispatched as GitHub Actions run
`28286143588`, but job `83810329982` failed before execution with no steps and
no failed log. The check-run annotation reports the standing account
billing/spending-limit blocker, so this remains an external CI gate rather than
a product regression.

The living care-twin motion recipe polish pass made the existing single-sprite
room renderer more game-like. `motionRecipeForSpriteAction` now gives each
runtime sprite action its own bob, sway, tilt, scale pulse, and shadow pulse,
and `LivingPhoenixRoom` applies the recipe to the main layered Phoenix rig plus
the ground shadow. This strengthens the Tamagotchi/video-game feel without
adding a duplicate dog avatar. Local verification passed care-twin
choreography/mobile readiness, mobile TypeScript, PixelLab verification at 149
files, Expo web export, and `git diff --check` with expected Windows CRLF
warnings only. Real device QA still needs to confirm phone-size crop, jitter,
and motion readability through `/care-twin-qa`.

Remote verification for that pass was dispatched as GitHub Actions run
`28286493067`, but job `83811229532` failed before execution with no steps and
no failed log. The check-run annotation reports the standing account
billing/spending-limit blocker, so this remains an external CI gate rather than
a product regression.

The care-twin motion QA proof pass connected those living motion recipes to the
native device review cockpit. `describeMotionRecipeForSpriteAction` now formats
each sprite action's bob, sway, tilt, scale pulse, shadow pulse, and QA hint;
`/care-twin-qa` renders those values in a `Motion proof` panel for every state;
and the Care Twin QA share report includes the same line for handoff notes. This
does not replace native screenshots, but it gives iOS/Android testers a precise
single-sprite motion checklist for crop, gait, tap reaction, and game-feel
review. Local verification passed focused Care Twin QA/mobile readiness, the
392-test behavior/readiness suite, mobile TypeScript, PixelLab verification at
149 files, Expo web export, preview `HEAD 200` on `/` and `/care-twin-qa`, and
`git diff --check` with expected Windows CRLF warnings only.

Remote verification for that pass was dispatched as GitHub Actions run
`28287189715`, but job `83813113862` failed before execution with no steps and
no failed log. The check-run annotation reports the standing account
billing/spending-limit blocker, so this remains an external CI gate rather than
a product regression.

The Avatar Studio accessory-fit polish pass made customization more
production-truthful. `deriveAvatarAccessoryFit` now separates Shepherd
template-fitted PixelLab overlays from inventory-ready accessories whose
template overlay pack is still pending, and `/portrait` surfaces this as a
small hero fit badge plus a `Template overlay readiness` panel and per-accessory
`Template-fitted`/`Pack pending` labels. This avoids implying that every breed
template already has perfect accessory alignment while still making Phoenix's
current Shepherd pack feel like a real avatar editor. Local verification passed
focused Avatar Studio/mobile readiness, the 394-test behavior/readiness suite,
mobile TypeScript, PixelLab verification at 149 files, Expo web export, preview
`HEAD 200` on `/` and `/portrait`, and `git diff --check` with expected Windows
CRLF warnings only. Real native QA still needs to confirm accessory crop,
motion, and tap-state readability on iOS/Android screens before store
screenshots.

Remote verification for that pass was dispatched as GitHub Actions run
`28287872512`, but job/check-run `83814845814` failed before execution with no
steps and no failed log. The check-run annotation reports the standing account
billing/spending-limit blocker, so this remains an external CI gate rather than
a product regression.

The follow-up store screenshot QA pass connected Avatar Studio's new
accessory-fit truth to App Store/Play Store preparation. The Store Submission
packet now requires Avatar Studio screenshots that show `Template overlay
readiness`, `Template-fitted`, and `Pack pending` labels, and
`buildStoreSubmissionScreenshotQaSurfaces` adds Avatar-specific setup,
verification, required evidence, acceptance, and failure-escalation copy. Local
verification passed focused store/QA/mobile readiness, the 394-test
behavior/readiness suite, mobile TypeScript, PixelLab verification at 149 files,
Expo web export, preview `HEAD 200` on `/portrait` and `/care-twin-qa`, and
`git diff --check` with expected Windows CRLF warnings only.

Remote verification for that pass was dispatched as GitHub Actions run
`28288357429`, but job/check-run `83816058572` failed before execution with no
steps and no failed log. The check-run annotation reports the standing account
billing/spending-limit blocker, so this remains an external CI gate rather than
a product regression.

The Phoenix room stage-framing proof pass made `/care-twin-qa` more actionable
for the exact mockup and video-game feel Apollo wants. `getCareTwinStageFraming`
now gives each room zone a crop rule, HUD-clearance rule, single-live-sprite
rule, Option B hard-pixel accuracy rule, and phone-screenshot hint; every runtime
QA scenario carries that contract; the QA route renders a `Stage framing proof`
panel; and the native share report includes the same line. Local verification
passed focused Care Twin/mobile readiness, the 395-test behavior/readiness
suite, mobile TypeScript, PixelLab verification at 149 files, Expo web export,
preview `HEAD 200` on `/` and `/care-twin-qa`, and `git diff --check` with
expected Windows CRLF warnings only.

Remote verification for that pass was dispatched as GitHub Actions run
`28288840784`, but job/check-run `83817272943` failed before execution with no
steps and no failed log. The check-run annotation reports the standing account
billing/spending-limit blocker, so this remains an external CI gate rather than
a product regression.

The Health Review Packet polish pass made Health/Bile Watch more operational
and App Store credible. `deriveHealthReviewPacket` now turns Health Watch status,
Bile Watch status, food gap, bedtime snack proof, and signal counts into
steady/watch/review labels, approved language pills, owner prompts, a vet-share
checklist, and Log/WoofGuide actions. `/health` renders the source-backed
`Review packet`, `Vet-share checklist`, `Log health detail`, and `Draft vet
questions` workflow while preserving the non-diagnostic `Not veterinary advice`
boundary. Local verification passed the red/green Health helper and mobile
readiness guards, the 398-test behavior/readiness suite, mobile TypeScript,
PixelLab verification at 149 files, Expo web export, live preview `GET /health`
with no browser console errors, and `git diff --check` with expected Windows
CRLF warnings only.

Remote verification for that pass was dispatched as GitHub Actions run
`28289670042`, but job/check-run `83819441855` failed before execution with no
steps and no failed log. The check-run annotation reports the standing account
billing/spending-limit blocker, so this remains an external CI gate rather than
a product regression.

The Health Review Packet store-screenshot guard pass made App Store/Play Store
prep source-backed against the new Health workflow. The Store Submission packet
now requires Health Watch screenshots that include the non-diagnostic `Review
packet`, `Vet-share checklist`, and `Draft vet questions` action, and
`buildStoreSubmissionScreenshotQaSurfaces` adds Health-specific setup,
verification, required evidence, acceptance, and failure-escalation copy. The
Owner Preview Core Loop also requires testers to confirm the Review packet and
Draft vet questions in Health instead of only checking a generic Health/Bile
screen. Local verification passed focused store/QA tests, the 398-test
behavior/readiness suite, mobile TypeScript, and `git diff --check` with
expected Windows CRLF warnings only.

Remote verification for that pass was dispatched as GitHub Actions run
`28290226684`, but job/check-run `83820856141` failed before execution with no
steps and no failed log. The check-run annotation reports the standing account
billing/spending-limit blocker, so this remains an external CI gate rather than
a product regression.

The store screenshot proof surfacing pass made the launch QA plan easier to use
under the two-day ship deadline. `buildMobileLaunchQaCapturePlan` now exposes
`storeScreenshotProofStatus` with store-screen counts, the next store screenshot
target, and missing proof, and the shareable QA plan now calls out Store
screenshot proof, Next store screenshot, and Store screenshot missing lines.
More's Launch Readiness section renders a tappable `Store screenshot proof` row
beside Owner preview proof so testers can jump to `/care-twin-qa` and capture
the next store-safe image without digging through every native QA surface. Local
verification passed focused mobile launch QA/mobile readiness, the 399-test
behavior/readiness suite, mobile TypeScript, Expo web export to `.expo-smoke`,
and `git diff --check` with expected Windows CRLF warnings only.

Remote verification for that pass was dispatched as GitHub Actions run
`28290628303`, but job/check-run `83821873036` failed before execution with no
steps and no failed log. The check-run annotation reports the standing account
billing/spending-limit blocker, so this remains an external CI gate rather than
a product regression.

The focused mobile release QA pass made the Launch Readiness handoff more
direct for the two-day ship deadline. `buildMobileLaunchQaFocusedTarget` now
derives one proof target from the same missing-evidence logic as the capture
plan; More deep-links native QA, Store screenshot proof, next-capture rows, and
the 48-hour beta action into `/care-twin-qa?qaSurface=...`; and the QA cockpit
renders a `Focused QA Target` card with route, priority, proof gaps, setup,
verification, pass criteria, note, attach-proof, open-route, Pass, and Needs
tune controls. This does not complete native QA, but it gives Apollo, Fable,
Replit, or a device tester the exact screen and evidence gap to capture next.
Local verification passed focused mobile launch QA/mobile readiness, the
400-test behavior/readiness suite, mobile TypeScript, PixelLab asset
verification at 149 files, Expo web export to `.expo-smoke`, and
`git diff --check` with expected Windows CRLF warnings only.

Remote verification for that pass was dispatched as GitHub Actions run
`28291975054`, but job/check-run `83825401869` failed before execution with no
steps and no failed log. The check-run annotation reports the standing account
billing/spending-limit blocker, so this remains an external CI gate rather than
a product regression. The final local closeout also passed the 440-test focused
contract suite, mobile TypeScript, PixelLab asset verification at 149 files,
Expo web export to `.expo-smoke`, and `git diff --check`.

The focused QA return-route pass kept the proof mission alive after testers
leave `/care-twin-qa` to inspect a target screen. `BoardRouteHeader` now
returns to `/care-twin-qa?qaSurface=...` when the route was opened from a
focused QA card, so the missing proof list, notes, and Pass/Needs tune controls
do not reset to the generic cockpit after a screenshot is captured. Red/green
verification first failed on the generic return route, then passed
`mobileReadiness.test.ts` with 81/81 tests.

Remote verification for that pass was dispatched as GitHub Actions run
`28292452126`, but job/check-run `83826666530` failed before execution with no
steps and no failed log. The check-run annotation reports the standing account
billing/spending-limit blocker, so this remains an external CI gate rather than
a product regression. Local verification passed the red/green mobile readiness
check, the 440-test focused contract suite, mobile TypeScript, PixelLab asset
verification at 149 files, Expo web export to `.expo-smoke`, focused route
`HEAD 200`, and `git diff --check`.

The Native QA Needs tune jump pass removed a remaining dead-end from More's
Launch Readiness actions. When a saved QA session marks a route as Needs tune,
More now shows `Open Needs Tune` beside `Share Fix Brief`; the new action opens
the focused `/care-twin-qa?qaSurface=...` target directly, while the share brief
remains the handoff/export path. The button has a dedicated shared-touch-target
style so the urgent issue route stays thumb-safe on mobile. Red/green
verification first failed on the missing action/style, then passed
`mobileReadiness.test.ts` with 81/81 tests.

Remote verification for Needs Tune focused target commit `eb9986e` was manually
dispatched as GitHub Actions run `28292935016`, but the job failed before
executing any steps. Job/check-run `83827915264` reported `steps: []`,
`gh run view --log-failed` returned `log not found: 83827915264`, and the
check-run annotation said the job was not started because recent account
payments failed or the spending limit needs to be increased. This is the
standing GitHub billing/spending-limit blocker, not a local regression. Local
verification passed the red/green mobile readiness check, the 440-test focused
contract suite, mobile TypeScript, PixelLab asset verification at 149 files,
Expo web export to `.expo-smoke`, root route `HEAD 200`, focused QA route
`HEAD 200`, and `git diff --check`. Direct `/more` `HEAD` returned `404` from
the current local server, while the app root and focused QA route served
successfully.

The focused Needs Tune handoff pass made `/care-twin-qa?qaSurface=...`
self-contained after a route is marked Needs tune. The focused target card now
shows `Share fix brief` only for Needs Tune targets and uses the same
source-backed `WoofWatcher Needs Tune Fix Brief` generator as More, so a tester
can open the route, record the issue, mark Needs tune, and share the repair
packet without leaving the cockpit. Red/green verification first failed on the
missing import/action, then passed `mobileReadiness.test.ts` with 81/81 tests.

Remote verification for focused Needs Tune brief commit `eeaf315` was manually
dispatched as GitHub Actions run `28293402700`, but the job failed before
executing any steps. Job/check-run `83829115323` reported `steps: []`,
`gh run view --log-failed` returned `log not found: 83829115323`, and the
check-run annotation said the job was not started because recent account
payments failed or the spending limit needs to be increased. This is the
standing GitHub billing/spending-limit blocker, not a local regression. Local
verification passed the red/green mobile readiness check, the 440-test focused
contract suite, mobile TypeScript, PixelLab asset verification at 149 files,
Expo web export to `.expo-smoke`, root route `HEAD 200`, focused QA route
`HEAD 200`, and `git diff --check`.

The focused screenshot proof pass made the QA cockpit more self-contained for
the remaining native launch gate. A focused `/care-twin-qa?qaSurface=...`
target now renders `Focused screenshot proof` using the saved surface evidence,
including attached filenames and iOS/Android/Web platform tags, and it can clear
only that target's focused proof without wiping unrelated QA evidence. Red/green
verification first failed on the missing proof panel, then passed
`mobileReadiness.test.ts` with 81/81 tests.

Remote verification for focused QA screenshot proof commit `0de87ef` was
manually dispatched as GitHub Actions run `28294054369`, but job/check-run
`83830830154` failed before executing any steps. `gh run view --log-failed`
returned `log not found: 83830830154`, and the check-run annotation says the
job was not started because recent account payments failed or the spending limit
needs to be increased. This is the standing GitHub billing/spending-limit
blocker, not a local regression. Local verification passed the red/green mobile
readiness check, the 440-test focused contract suite, mobile TypeScript,
PixelLab asset verification at 149 files, Expo web export to `.expo-smoke`, root
route `HEAD 200`, focused QA route `HEAD 200`, and `git diff --check`.

The focused target checklist pass added a source-backed share action for phone
QA and handoff work. `buildMobileLaunchQaFocusedTargetShareText` now packages
the active focused target into a checklist with the focused cockpit URL, target
route, missing proof, attached proof count, setup, verification, pass criteria,
Needs tune rule, optional owner route loop, and the App Store/Play Store
approval boundary. The focused `/care-twin-qa?qaSurface=...` card now shows
`Share target checklist` next to the attach/open route controls so Apollo,
Fable, Replit, or a device tester can get the exact task before capturing iOS or
Android screenshots. Red/green verification first failed on the missing
export/action, then passed focused mobile launch QA/mobile readiness with 97/97
tests.

Remote verification for focused target checklist commit `591c203` was manually
dispatched as GitHub Actions run `28294610682`, but job/check-run `83832264186`
failed before executing any steps. `gh run view --log-failed` returned
`log not found: 83832264186`, and the check-run annotation says the job was not
started because recent account payments failed or the spending limit needs to be
increased. This is the standing GitHub billing/spending-limit blocker, not a
local regression. Local verification passed focused mobile launch QA/mobile
readiness with 97/97 tests, the 441-test focused contract suite, mobile
TypeScript, PixelLab asset verification at 149 files, Expo web export to
`.expo-smoke`, root route `HEAD 200`, focused QA route `HEAD 200`, and
`git diff --check`.

The Provider Launch Setup next-gate pass made the production-provider handoff
more direct for Apollo, Fable, Replit, or a helper. `deriveLaunchProviderSetup`
now exposes `openCount` plus `nextGate`; the share packet includes a `Next
Provider Gate` section with owner, action, and proof; and More's Launch
Readiness provider panel highlights the single next provider blocker before the
row list. The row preview now prioritizes open gates before ready gates, so a
partially configured setup does not hide AI, payments, push, store accounts, or
deletion work behind already-ready rows. The all-ready state still says final
owner review is required and does not approve App Store or Play Store
submission. Red/green verification first failed on the missing `openCount`,
`nextGate`, share text, and More UI, then passed focused provider/mobile
readiness, the 402-test behavior/readiness suite, mobile TypeScript, PixelLab
asset verification at 149 files, Expo web export to `.expo-smoke`, root route
`HEAD 200`, and focused QA route `HEAD 200`.

Remote verification for Provider Launch Setup next-gate commit `3cc6534` was
manually dispatched as GitHub Actions run `28295375561`, but job/check-run
`83834270843` failed before executing any steps. `gh run view --log-failed`
returned `log not found: 83834270843`, matching the standing GitHub
billing/spending-limit pre-job blocker rather than a local product regression.

The Health Review Packet share pass made Health Watch more handoff-ready for
vet and caregiver conversations without changing the non-diagnostic boundary.
`buildHealthReviewPacketShareText` now packages the current packet into a
single share message with generated time, dog name, status, safe language
label, summary, suggested prompts, vet-share checklist, and owner-observation
boundary copy. Health Watch exposes that through a compact `Share review`
button below the packet boundary. Red/green verification first failed on the
missing share helper/UI contract, then passed focused Health Review
Packet/mobile readiness checks, the 403-test behavior/readiness suite, mobile
TypeScript, PixelLab asset verification at 149 files, package-local Expo web
export to `.expo-smoke`, preview root `HEAD 200`, focused QA route `HEAD 200`,
and `git diff --check` with expected Windows CRLF warnings only.

Remote verification for Health Review Packet share commit `295db19` was
manually dispatched as GitHub Actions run `28309546119`, but job/check-run
`83871694493` failed before executing any steps. The job reported `steps: []`,
and `gh run view --log-failed` returned `log not found: 83871694493`, matching
the standing GitHub billing/spending-limit pre-job blocker rather than a local
product regression.

The 2026-06-28 mood and energy care-trend pass reconciled the highest-impact
latest main-line care logic into this richer premium branch without doing a
destructive broad merge. A full `origin/main` merge was tested and aborted after
large conflicts across API, mobile routes, generated clients, binary avatar
assets, and docs. The accepted path adds `deriveMoodTrend` in shared
care-domain logic, captures structured mood energy level, household visibility,
care context, and sticky notes in Quick Log, and upgrades Records Mood Trend
with source-backed status, energy mix, latest context, and next-step copy. Local
verification passed focused mood/mobile readiness tests 88/88, the 405-test
behavior/readiness suite, `tsc --build`, mobile TypeScript, PixelLab verifier
`ok=149 missing=0 invalid=0`, package-local Expo web export, preview root
`HEAD 200`, focused QA route `HEAD 200`, and `git diff --check` with expected
Windows CRLF warnings only.

Fresh resumed verification then caught one stale launch-readiness assertion in
the mobile beta doctor JSON contract. The doctor was correctly blocking beta
export because the available CLI was `pnpm 11.7.0` while the repo pins
`pnpm 10.24.0`; the readiness test now treats `pnpm CLI matches pinned version`
as a named dependency/export gate alongside missing pnpm and missing Expo
resolution. Fresh local verification passed mobile readiness 82/82, the
405-test behavior/readiness suite, `tsc --build`, mobile TypeScript, PixelLab
asset verification at 149 files, package-local Expo web export to
`.expo-smoke`, and `git diff --check` with expected Windows CRLF warnings only.

Remote verification for head `3aa29b7` was manually dispatched as GitHub
Actions run `28311224386`, but job/check-run `83876299726` failed before
executing any steps. `gh run view --log-failed` returned
`log not found: 83876299726`. This matches the standing GitHub
billing/spending-limit pre-job blocker rather than a local product regression.

The static beta preview handoff pass made the owner-review preview path a
tested product contract. Root `preview:mobile-beta` now delegates to the mobile
`preview:smoke` script, the mobile package also exposes `preview:web`, and the
static preview server defaults to `http://127.0.0.1:4194/` with a foreground
terminal reminder. `scripts/mobile-beta-doctor.mjs --json` now includes
`pnpm --filter @workspace/woofwatcher-mobile run preview:smoke` in the proof
sequence and tells helpers to serve the exact `.expo-smoke` export after
`smoke:web`. Local verification passed mobile readiness 83/83, the 406-test
behavior/readiness suite, `tsc --build`, mobile TypeScript, PixelLab asset
verification at 149 files, package-local Expo web export to `.expo-smoke`,
foreground preview root `HEAD 200`, and `git diff --check` with expected
Windows CRLF warnings only. This keeps Apollo/Fable/Replit preview review
aligned to the same exported build without claiming native iOS/Android,
provider, or store proof.

Remote verification for static beta preview handoff commit `21ce8b3` was
manually dispatched as GitHub Actions run `28312278566`, but job/check-run
`83879075992` failed before executing any steps. `gh run view --log-failed`
returned `log not found: 83879075992`. This matches the standing GitHub
billing/spending-limit pre-job blocker rather than a local product regression.

The Home immediate-action reorder pass tightened the visible beta toward
Apollo's locked pixel mockups. Phoenix Home now renders `Next Up` and
`Quick Log` directly after the living room/status strip and before the richer
care-RPG mission deck, so the first owner review path prioritizes "what is
next" and "what can I log now" before secondary progress/story content. A new
mobile readiness guard protects this order. Fresh local verification passed the
407-test behavior/readiness suite, `tsc --build`, mobile TypeScript, PixelLab
asset verification at 149 files, package-local Expo web export to
`.expo-smoke`, foreground preview root `HEAD 200` at
`http://127.0.0.1:4194/`, and `git diff --check` with expected Windows CRLF
warnings only.

Remote verification for Home immediate-action reorder commit `e83bf7c` was
manually dispatched as GitHub Actions run `28312943812`, but job/check-run
`83880810426` failed before executing any steps. The job reported `steps: []`,
and `gh run view --log-failed` returned `log not found: 83880810426`. This
matches the standing GitHub billing/spending-limit pre-job blocker rather than
a local product regression.

The Home Quick Log header action pass removed another owner-preview dead end.
The compact Home Quick Log card now renders `Open` as a real `Pressable`
accessory that routes to `/log`, uses the `Open full Quick Log` accessibility
label, shares the inline hit slop, and keeps the 48px touch-target contract
through `quickHeaderAction`. Fresh local verification passed mobile readiness
85/85, the 408-test behavior/readiness suite, `tsc --build`, mobile TypeScript,
PixelLab asset verification at 149 files, package-local Expo web export to
`.expo-smoke`, foreground preview root `HEAD 200` at
`http://127.0.0.1:4194/`, and `git diff --check`.

Remote verification for Home Quick Log header action commit `f6d66d1` was
manually dispatched as GitHub Actions run `28313525292`, but job/check-run
`83882396792` failed before executing any steps. The job reported `steps: []`,
and `gh run view --log-failed` returned `log not found: 83882396792`. This
matches the standing GitHub billing/spending-limit pre-job blocker rather than
a local product regression.

The Home section-action polish pass removed two more owner-preview dead ends.
`Recent activity / View all` now renders as a real `HomeHeaderAction` that
opens `/log`, and `Phoenix status / View full report` opens `/health`. Both
header actions carry explicit accessibility labels, use shared inline hit slop,
and keep the 48px mobile touch-target contract through `homeHeaderAction`.
Red/green verification first failed on the missing route targets, then passed
mobile readiness 86/86. Fresh local verification passed the 409-test
behavior/readiness suite, `tsc --build`, mobile TypeScript, PixelLab asset
verification at 149 files, package-local Expo web export to `.expo-smoke`
after adding the bundled Node directory to `PATH` for the local shell, preview
root `HEAD 200` at `http://127.0.0.1:4194/`, and `git diff --check`.

Remote verification for Home section-action polish commit `30ca6c5` was
manually dispatched as GitHub Actions run `28314204282`, but job/check-run
`83884302449` failed before executing any steps. The job reported `steps: []`,
`runner_id: 0`, and `gh run view --log-failed` returned
`log not found: 83884302449`. This matches the standing GitHub
billing/spending-limit pre-job blocker rather than a local product regression.

The Health header action polish pass removed two mockup-style Health Watch dead
affordances without weakening the medical boundary. `Health Snapshot / 7-day
view` now renders as a real thumb-safe `HealthHeaderAction` that returns owners
to the top 7-day rhythm view, and `Pattern Board / Owner notes` opens the
symptom/health note composer in Quick Log so owners can add the observation
evidence the screen asks for. Red/green verification first failed on the
missing shared action contract, then passed mobile readiness 86/86. Fresh local
verification passed the 409-test behavior/readiness suite, `tsc --build`,
mobile TypeScript, PixelLab asset verification at 149 files, package-local Expo
web export to `.expo-smoke`, preview root `HEAD 200` at
`http://127.0.0.1:4194/`, and `git diff --check` with expected Windows CRLF
warnings only.

Remote verification for Health header action polish commit `5ed483a` was
manually dispatched as GitHub Actions run `28314910163`, but job/check-run
`83886240566` failed before executing any steps. The job reported `steps: []`,
and `gh run view --log-failed` returned `log not found: 83886240566`. This
matches the standing GitHub billing/spending-limit pre-job blocker rather than
a local product regression.

The Log status-pill polish pass removed three more mockup-style dead
affordances from the high-frequency logging workflow. `Choose care type /
Fast tap`, `Today at a glance / N logged`, and `Find care logs / Filtered` now
render passive state through `BoardPill` accessories instead of
`BoardSectionHeader` action labels. Red/green verification first failed on the
old action-label contract, then passed mobile readiness 86/86. Fresh local
verification passed the 409-test behavior/readiness suite, `tsc --build`,
mobile TypeScript, PixelLab asset verification at 149 files, package-local Expo
web export to `.expo-smoke`, preview root `HEAD 200` at
`http://127.0.0.1:4194/`, and `git diff --check` with expected Windows CRLF
warnings only.

Remote verification for Log status-pill polish commit `7c9d934` was manually
dispatched as GitHub Actions run `28315508447`, but job/check-run
`83887885078` failed before executing any steps. The job reported `steps: []`,
and `gh run view --log-failed` returned `log not found: 83887885078`. This
matches the standing GitHub billing/spending-limit pre-job blocker rather than
a local product regression.

The Home Next Up status-pill pass removed another first-screen passive label
that looked like an action. `Next Up / 1 of N` now renders the count as a
shared `BoardPill` accessory while keeping real Home header actions reserved
for pressable route targets. Red/green verification first failed on the old
`BoardSectionHeader action` contract, then passed mobile readiness 86/86.
Fresh local verification passed the 409-test behavior/readiness suite,
`tsc --build`, mobile TypeScript after rerunning the mobile compiler with an
absolute TypeScript path, PixelLab asset verification at 149 files,
package-local Expo web export to `.expo-smoke`, preview root `HEAD 200` at
`http://127.0.0.1:4194/`, and `git diff --check` with expected Windows CRLF
warnings only.

Remote verification for Home Next Up status-pill commit `165ae80` was manually
dispatched as GitHub Actions run `28315976464`, but job/check-run
`83889217105` failed before executing any steps. The job reported `steps: []`,
and `gh run view --log-failed` returned `log not found: 83889217105`. This
matches the standing GitHub billing/spending-limit pre-job blocker rather than
a local product regression.

The Records status-pill polish pass removed the remaining passive
`BoardSectionHeader action` labels from the Records/Care Pass route. Care
Trends, Weight Trend, Mood Trend, Hydration, Walk Activity, Training Progress,
Alone Time, Grooming Care, Potty Health, Care Pass, Report History, and
Records Cabinet now render compact status through shared `BoardPill`
accessories while leaving actual sharing, preview, print, edit, and add-record
controls as real touch targets. Red/green verification first failed on the old
Records action-label contract, then passed mobile readiness 87/87. Fresh local
verification passed the 410-test behavior/readiness suite, `tsc --build`,
mobile TypeScript, PixelLab asset verification at 149 files, package-local Expo
web export to `.expo-smoke`, preview root `HEAD 200` at
`http://127.0.0.1:4194/`, and `git diff --check` with expected Windows CRLF
warnings only.

The Premium status-pill polish pass removed passive `BoardSectionHeader action`
labels from the revenue screen. `Why upgrade`, `Plans`, and
`Launch entitlements` now render status through shared `BoardPill`
accessories, while the real actions remain the launch checklist and back
navigation. Red/green verification first failed on the missing Premium pill
contract, then passed mobile readiness 87/87. Fresh local verification passed
the 410-test behavior/readiness suite, `tsc --build`, mobile TypeScript,
PixelLab asset verification at 149 files, package-local Expo web export to
`.expo-smoke` with 223 files, preview root `HEAD 200` at
`http://127.0.0.1:4194/`, and `git diff --check` with expected Windows CRLF
warnings only.

The Adventure status-pill polish pass removed passive `BoardSectionHeader action`
labels from the care-RPG route. `Next quest`, `Quest board`,
`Care proof`, and `Memory shelf` now render their state through shared
`BoardPill` accessories, while the real Adventure actions remain save memory,
share summary, and back navigation. Red/green verification first failed on the
missing Adventure pill contract, then passed mobile readiness 87/87. Fresh
local verification passed the 410-test behavior/readiness suite, `tsc --build`,
mobile TypeScript, PixelLab asset verification at 149 files, package-local Expo
web export to `.expo-smoke` with 223 files, preview root `HEAD 200` at
`http://127.0.0.1:4194/`, and `git diff --check` with expected Windows CRLF
warnings only.

The Avatar Studio status-pill polish pass removed passive
`BoardSectionHeader action` labels from the scan-to-pixel route. Generated mood
review, scan/configuration state, live template count, coat editability, face
marking, accessory fit, and mood pack state now render through shared
`BoardPill` accessories, while real actions remain gallery, camera, template
selection, customization controls, mood preview, save, reset, and back
navigation. Red/green verification first failed on the old Avatar Studio action
labels, then passed mobile readiness 87/87. Fresh local verification passed the
410-test behavior/readiness suite, `tsc --build`, mobile TypeScript, PixelLab
asset verification at 149 files, package-local Expo web export to
`.expo-smoke` with 223 files, preview root `HEAD 200` at
`http://127.0.0.1:4194/`, and `git diff --check` with expected Windows CRLF
warnings only.

The WoofGuide status-pill polish pass removed passive `BoardSectionHeader action`
labels from the assistant route. `Quick questions` and `Suggested actions` now
render `Tap to ask` and `Owner reviewed` through shared `BoardPill`
accessories, while real actions remain quick-question chips, suggested action
rows, send controls, owner-review modal, and back navigation. Red/green
verification first failed on the missing WoofGuide pill contract, then passed
mobile readiness 87/87. Fresh local verification passed the 410-test
behavior/readiness suite, `tsc --build`, mobile TypeScript, PixelLab asset
verification at 149 files, package-local Expo web export to `.expo-smoke` with
223 files, preview root `HEAD 200` at `http://127.0.0.1:4194/`, and
`git diff --check` with expected Windows CRLF warnings only.

The Privacy status-pill polish pass removed passive `BoardSectionHeader action`
labels from the launch trust route. `Export summary`, `Attachment queue`,
`Support runbook`, and `Launch safety gates` now render local bundle,
attachment count, launch gate, and gate count through shared `BoardPill`
accessories, while real actions remain care-data export, deletion request,
support profile edit, support runbook share, modal saves, and back navigation.
Red/green verification first failed on the missing Privacy pill contract, then
passed mobile readiness 87/87. Fresh local verification passed the 410-test
behavior/readiness suite, `tsc --build`, mobile TypeScript, PixelLab asset
verification at 149 files, package-local Expo web export to `.expo-smoke` with
223 files, preview root `HEAD 200` at `http://127.0.0.1:4194/`, and
`git diff --check` with expected Windows CRLF warnings only.

The Setup, Plans, and Care Twin QA status-pill polish pass removed the remaining
passive `BoardSectionHeader action` labels from setup, planning, and launch QA
surfaces. Setup progress, after-save review, upcoming event count, Reminder
Center status, launch workflow proof state, store screenshot verdict, and device
review matrix count now render through shared `BoardPill` accessories, while
real actions remain save/finish-later, plan/routine editing and logging,
reminder rows, QA proof attachment, QA/store packet sharing, review surfaces,
and back navigation. Red/green verification first failed on the missing setup
and planning/QA pill contracts, then passed mobile readiness 87/87. Fresh local
verification passed the 410-test behavior/readiness suite, `tsc --build`,
mobile TypeScript, PixelLab asset verification at 149 files, package-local Expo
web export to `.expo-smoke` with 223 files, preview root `HEAD 200` at
`http://127.0.0.1:4194/`, and `git diff --check` with expected Windows CRLF
warnings only.

The Home Quick Log long-press polish pass made the first-screen care actions
match the locked logging doctrine. Tapping a Home quick tile still saves the
default fast log, while long pressing Meal, Walk, Potty, Water, Training, Treat,
or Play now opens the typed Log detail flow through `/log?type=...`; the More
tile continues to open the full Quick Log surface. The shared `QuickActionTile`
primitive now supports `onLongPress`, `delayLongPress`, and explicit
accessibility hints so future quick-action surfaces can reuse the same
fast-or-detailed contract. Red/green verification first failed on the missing
long-press contract, then passed mobile readiness 87/87. Fresh local
verification passed the 410-test behavior/readiness suite, `tsc --build`,
mobile TypeScript, preview root `HEAD 200` at `http://127.0.0.1:4194/`, and
`git diff --check` with expected Windows CRLF warnings only.

The Home-to-Log detail sheet intent polish pass tightened that UX into a true
compact-detail handoff. Home now sends `/log?type=...&detail=1&intent=...` on
long press, and Log consumes the typed route intent by selecting the matching
launcher action and opening the existing bottom-sheet launcher detail flow. A
fresh intent is generated per long press and Log remembers the last consumed
intent so stale route params do not reopen the sheet accidentally. Red/green
verification first failed on the missing detail-intent route contract, then
passed mobile readiness 87/87. Fresh local verification passed the 410-test
behavior/readiness suite, `tsc --build`, mobile TypeScript, package-local Expo
web export to `.expo-smoke` with 223 files, preview root `HEAD 200`, detail
route `HEAD 200` at `/log?type=meal&detail=1&intent=smoke`, and
`git diff --check` with expected Windows CRLF warnings only.

The Home Quick Log undo/detail polish pass added a recovery loop to first-screen
quick taps. Successful Home quick logs now keep a longer feedback toast with
real `Undo` and `Add details` actions; Undo deletes the just-created local care
entry, while Add details routes to `/log?entry=...` so Log opens the saved entry
detail sheet for the exact event. Log now consumes an `entry` route param and
guards against stale already-consumed entry params. Red/green verification
first failed on the missing Home undo/detail and Log entry-route contract, then
passed mobile readiness 87/87. Fresh local verification passed the 410-test
behavior/readiness suite, `tsc --build`, mobile TypeScript, package-local Expo
web export to `.expo-smoke` with 223 files, preview root `HEAD 200`, entry route
`HEAD 200` at `/log?entry=smoke`, and `git diff --check` with expected Windows
CRLF warnings only.

The Home pending-meal open-loop routing pass made the served-to-outcome meal
lifecycle feel more like one coherent household workflow. When Home detects a
served or grazing meal whose outcome is still pending, both the `Next Up` row
and the care-RPG `My Care Today` mission now route to `/log?entry=...` for that
exact meal instead of generic `/log?type=meal`. Active walk/alone loops still
route to Log, while ordinary scheduled care routes to Plans. Red/green
verification first failed on the missing exact-entry route contract, then
passed mobile readiness 87/87. Fresh local verification passed the 410-test
behavior/readiness suite, `tsc --build`, mobile TypeScript, package-local Expo
web export to `.expo-smoke` with 223 files after adding bundled Node to `PATH`
for the export script, preview root `HEAD 200`, entry route `HEAD 200` at
`/log?entry=smoke`, and `git diff --check` with expected Windows CRLF warnings
only.

The Home Recent Activity exact-log routing pass removed another owner-preview
dead end. Home now keeps each recent activity entry id, uses it as the stable
row key, and routes taps to `/log?entry=...` so owners can open the exact saved
care record for sticky notes, outcome updates, corrections, trust review, and
audit history. The shared `CareRow` primitive now accepts explicit
accessibility labels, so route-backed rows can say `Open recent care log: ...`
instead of exposing generic title/detail text. Fresh local verification passed
mobile readiness 87/87, the 410-test mobile/domain behavior suite,
`tsc --build`, mobile TypeScript, package-local Expo web export to
`.expo-smoke` with 223 files, and the entry route remains available at
`/log?entry=smoke`.

The Home HUD status tile routing pass made the first-screen Tamagotchi-style
status cards behave like real care controls. `Happiness` now opens the Mood
detail flow, `Energy` opens Health Watch, `Hunger` opens More with Diet Profile
expanded through `/more?section=diet`, and `Bond` opens the Play detail flow.
Each tile is pressable, carries an explicit accessibility label, and keeps the
existing compact HUD layout. More now consumes the `section=diet` route param
and expands Diet Profile without inventing a fake standalone Diet route. Red
verification first failed on the missing HUD route contract, then passed mobile
readiness 87/87. Fresh local verification passed the 410-test mobile/domain
behavior suite, `tsc --build`, mobile TypeScript, and package-local Expo web
export to `.expo-smoke` with 223 files.

The Health Snapshot care-action pass made the health overview navigable instead
of passive. Activity now opens Walk details, Appetite opens Meal details, Stool
opens Potty details, Hydration opens Water details, Energy opens Mood details,
and Vomiting opens the Symptom/Vomit detail path through the same
`/log?type=...&detail=1&intent=...` contract used by Home long-press actions.
The Health hero `Log health note` and Pattern Board `Owner notes` actions also
use that detail-intent route, so health evidence flows into the existing Log
bottom sheet, Timeline, sticky notes, trust review, Care Pass, and reports.
Red/green verification first failed on the missing Health Snapshot route
contract, then passed mobile readiness 87/87. Fresh local verification passed
the 410-test mobile/domain behavior suite, PixelLab assets `ok=149 missing=0
invalid=0`, root TypeScript, mobile TypeScript, package-local Expo web export
to `.expo-smoke` with 223 files, preview route smoke for `/`, `/health`, and
`/log?type=water&detail=1&intent=smoke`, and `git diff --check` with only
expected Windows CRLF warnings.

The Plans Reminder Center detail-intent pass tightened another owner-preview
care loop. Medication and grooming reminder rows now open the typed compact Log
detail flow through `/log?type=...&detail=1&intent=...` instead of landing on a
generic Log screen. Routine reminders still open the routine editor, and record
reminders still open Records, preserving the correct owner context for each
reminder kind. Red/green verification first failed on the missing Plans reminder
detail-intent contract, then passed mobile readiness 87/87. Fresh local
verification passed the 410-test mobile/domain behavior suite, PixelLab assets
`ok=149 missing=0 invalid=0`, root TypeScript, mobile TypeScript, package-local
Expo web export to `.expo-smoke` with 223 files, preview route smoke for `/`,
`/calendar`, and `/log?type=grooming&detail=1&intent=smoke`, and
`git diff --check` with only expected Windows CRLF warnings.

The Plans routine log recovery pass made Daily Routine completion safer and more
consistent with the locked quick-log doctrine. Tapping a routine `Log done`
button still creates the routine-aware care entry immediately, but the screen now
keeps the returned entry id and shows a bottom-safe feedback bar with real
`Undo` and `Add details` actions. Undo deletes the exact created entry. Add
Details routes to `/log?entry=...` so owners can edit the real source log for
notes, sticky notes, corrections, trust review, and audit history instead of
creating duplicate evidence. Red/green verification first failed on the missing
recoverable Plans routine logging contract, then passed mobile readiness 88/88.
Fresh local verification passed the 411-test mobile/domain behavior suite,
PixelLab assets `ok=149 missing=0 invalid=0`, root TypeScript, mobile TypeScript,
package-local Expo web export to `.expo-smoke` with 223 files, preview route
smoke for `/`, `/calendar`, and `/log?entry=smoke`, and `git diff --check` with
only expected Windows CRLF warnings.

The Avatar Studio PixelLab truth polish pass removed mock-era wording from the
care-twin creation path. The scan suggestion helper is now
`buildTemplateScanSuggestion`, the working scan badge says `PixelLab template
match`, and the future scanning note now says provider scanning can plug in later
while this build ships the reliable PixelLab template matcher, character creator,
and emote-preview system first. Red/green verification first failed on the
missing truthful Avatar Studio copy contract, then passed mobile readiness 88/88.
Fresh local verification passed focused Avatar Studio/mobile readiness 96/96, the
411-test mobile/domain behavior suite, PixelLab assets `ok=149 missing=0
invalid=0`, root TypeScript, mobile TypeScript, package-local Expo web export
to `.expo-smoke` with 223 files, preview route smoke for `/` and `/portrait`,
and `git diff --check` with only expected Windows CRLF warnings.

The Adventure Quest action pass made the care-RPG layer operational instead of
decorative. Shared `AdventureQuest` data now carries an action contract and
label, and the mobile Adventure route can start/reopen a walk-session proof,
create training or play care evidence, save a private memory, and open exact
completed proof logs through `/log?entry=...`. Newly-created quest logs show a
bottom-safe recovery panel with real `Undo` and `Add details` actions; Undo
deletes the exact entry, while Add Details opens the saved log for notes, sticky
notes, trust review, corrections, and audit history. Red/green verification
first failed on missing quest action contracts, then passed focused
adventure/mobile readiness 91/91. Fresh local verification passed the 411-test
mobile/domain behavior suite, PixelLab assets `ok=149 missing=0 invalid=0`, root
TypeScript, mobile TypeScript, package-local Expo web export to `.expo-smoke`
with 223 files, preview route smoke for `/`, `/adventure`, and
`/log?entry=smoke`, and `git diff --check` with only expected Windows CRLF
warnings.

The Adventure Next-Quest CTA polish pass corrected the top card's misleading
memory-first action. The `Next quest` primary button now derives the current
quest proof id, labels itself from the real quest state (`Start walk`, `Log
training`, `Log play`, `Save memory`, `Open proof`, or `Locked`), disables
locked quests, and calls the same source-backed `startQuest` path as Quest Board
rows. Red/green verification first failed on the missing action-aware top CTA
contract, then passed mobile readiness 88/88. Fresh local verification passed
the 411-test mobile/domain behavior suite, PixelLab assets `ok=149 missing=0
invalid=0`, root TypeScript, mobile TypeScript, package-local Expo web export
to `.expo-smoke` with 223 files, preview route smoke for `/`, `/adventure`, and
`/log?entry=smoke`, and `git diff --check` with only expected Windows CRLF
warnings.

The Adventure Care Proof routing polish pass removed the last passive proof row
from the Adventure screen. Completed `Care proof` rows now open their exact
source log through `/log?entry=...`, carry explicit `Open Adventure proof log`
accessibility labels, use haptic feedback, show a chevron affordance, and stay
on the shared 48px mobile touch-target contract. Red/green verification first
failed on the missing proof-route and touch-target contracts, then passed mobile
readiness 88/88. Fresh local verification passed the 411-test mobile/domain
behavior suite, PixelLab assets `ok=149 missing=0 invalid=0`, root TypeScript,
mobile TypeScript, package-local Expo web export to `.expo-smoke` with 223
files, preview route smoke for `/`, `/adventure`, and `/log?entry=smoke`, and
`git diff --check` with only expected Windows CRLF warnings.

The Adventure Quest Row copy polish pass made Quest Board buttons as specific
as the underlying action contract. Available quests now show labels such as
`Start walk`, `Log training`, `Log play`, or `Save memory` instead of the
generic `Start quest`; completed quests still show `Open proof`, and locked
quests show `Locked`. Red/green verification first failed on the old generic
label contract, then passed mobile readiness 88/88. Fresh local verification
passed the 411-test mobile/domain behavior suite, root TypeScript, mobile
TypeScript, package-local Expo web export to `.expo-smoke` with 223 files,
preview route smoke for `/`, `/adventure`, and `/log?entry=smoke`, and
`git diff --check` with only expected Windows CRLF warnings.

The Adventure Memory Shelf polish pass removed another decorative dead end from
the care-RPG layer. Saved memories now render as pressable, haptic, accessible
48px rows with a visible `Share` affordance. Tapping a memory opens a private
share-sheet summary containing the memory title, note, humans, XP, storage
status, media status, and a truthful provider-gated photo/sync boundary, so the
memory is useful without pretending public cloud/photo storage is live.
Red/green verification first failed on the missing memory-share and touch-target
contracts, then passed mobile readiness 88/88. Fresh local verification passed
the 411-test mobile/domain behavior suite, PixelLab assets `ok=149 missing=0
invalid=0`, root TypeScript, mobile TypeScript, package-local Expo web export
to `.expo-smoke` with 223 files, and preview route smoke for `/`, `/adventure`,
and `/log?entry=smoke`. The first export attempt failed because the smoke script
needed the bundled Node path on `PATH`; rerunning with that environment set
passed. The preview server was restarted directly on `http://127.0.0.1:4194/`.

The Avatar Studio creator control polish pass raised the scan/template/customize
surface toward a finished mobile editor. Studio tabs, coat swatches,
face-marking chips, mood previews, Reset, and Save now use explicit named
handlers, haptic selection feedback, shared inline hit slop, screen-reader
labels, and action hints while preserving the current PixelLab template/config
data model. Reset now clearly restores the draft, and Save clearly persists the
current local pixel-twin configuration. Red/green verification first failed on
the missing creator-control contract, then passed mobile readiness 88/88. Fresh
local verification passed the 411-test mobile/domain behavior suite, PixelLab
assets `ok=149 missing=0 invalid=0`, root TypeScript, mobile TypeScript,
package-local Expo web export to `.expo-smoke` with 223 files, preview route
smoke for `/` and `/portrait`, and `git diff --check` with only expected
Windows CRLF warnings.

The Care Intelligence action-routing pass made the open-loop summary in More
source-backed. `deriveCareIntelligence` now carries exact `targetEntryId` and
`targetRoutineId` fields on actionable loops, and More's next-action button uses
those targets before falling back to broad Log or Plans routes. Pending meal
outcomes now open the original `/log?entry=...` record for outcome updates,
sticky notes, corrections, trust review, and audit history; failed sync still
uses retry, and routine work still routes to Plans. Red/green verification first
failed on the missing target ids and More route helper, then passed focused Care
Intelligence tests 2/2 and mobile readiness 88/88. Fresh local verification
passed the 411-test mobile/domain behavior suite, root TypeScript, mobile
TypeScript, PixelLab assets `ok=149 missing=0 invalid=0`, package-local Expo
web export to `.expo-smoke` with 223 files, and preview route smoke for `/`,
`/more`, `/log?entry=dinner-1`, and `/care-twin-qa?qaSurface=home`. The local
beta doctor still reports `BLOCKED` because this Windows shell exposes
`pnpm@11.7.0` while the launch path is pinned to `pnpm@10.24.0`.
Manual branch verify run `28344966240` was triggered after the commit and
failed before job execution with GitHub's billing/spending-limit annotation, so
remote CI still cannot provide app proof for this slice.

The Home Care Intelligence CTA pass carried the same source-backed open-loop
contract onto the first screen. The Home `Care quest` card now shows a compact
`Next care move` control that refreshes failed sync state, opens exact
`/log?entry=...` source logs for pending meals or sparse evidence, sends routine
work to Plans, and falls back to Log only when there is no more specific target.
This keeps Home aligned with the product promise: the living pixel care surface
should immediately route owners to the real care record that needs action.
Red/green verification first failed on the missing Home route contract, then
passed mobile readiness 88/88. Fresh local verification passed the 411-test
mobile/domain behavior suite, root TypeScript, mobile TypeScript via the
absolute TypeScript CLI path, PixelLab asset verification `ok=149 missing=0
invalid=0`, package-local Expo web export to `.expo-smoke` with 223 files,
preview route smoke for `/`, `/log?entry=dinner-1`, and
`/care-twin-qa?qaSurface=home`, and `git diff --check` with expected Windows
CRLF warnings only. The preview server was restarted at
`http://127.0.0.1:4194/` for Apollo review.

The Home Today summary metric routing pass made the `Today at a glance` cells
operational. Activity now opens the Walk detail sheet, Meals opens Meal detail
for portion/outcome updates, and Potty opens the Potty parent detail flow for
pee, poop, accidents, and notes through the same
`/log?type=...&detail=1&intent=...` contract as other compact care actions.
The cells are accessible 48px pressable targets with haptics and typed route
mapping, so the first screen keeps feeling like a planned care command surface
instead of a static report. Red/green verification first failed on the missing
Today metric route/touch-target contract, then passed mobile readiness 89/89.
Fresh local verification passed the 412-test mobile/domain behavior suite, root
TypeScript, mobile TypeScript, PixelLab asset verification `ok=149 missing=0
invalid=0`, package-local Expo web export to `.expo-smoke` with 223 files, and
preview route smoke for `/`, `/log?type=walk&detail=1&intent=smoke`,
`/log?type=meal&detail=1&intent=smoke`, and
`/log?type=potty&detail=1&intent=smoke`. The preview server is running at
`http://127.0.0.1:4194/` for Apollo review.

The Home Phoenix status meter routing pass removed another passive first-screen
surface. The shared `StatusMeter` primitive now has optional pressable behavior
with inline hit slop, accessible labels/hints, and 48px target sizing only when
`onPress` is provided. Home uses that path so Energy and Bile Risk open Health
Watch, Hunger opens Meal detail, Hydration opens Water detail, and Bond opens
Play detail. Red/green verification first failed on the missing status-meter
route contract, then passed mobile readiness 90/90. Fresh local verification
passed the 413-test mobile/domain behavior suite, root TypeScript, mobile
TypeScript, PixelLab asset verification `ok=149 missing=0 invalid=0`,
package-local Expo web export to `.expo-smoke` with 223 files, and preview
route smoke for `/`, `/health`, `/log?type=meal&detail=1&intent=smoke`,
`/log?type=water&detail=1&intent=smoke`, and
`/log?type=play&detail=1&intent=smoke`. Manual branch verify run `28347096325`
failed before job execution with GitHub's billing/spending-limit annotation, so
remote CI still cannot provide app proof for this slice.

The Home watch-card deep-link pass made the lower signal row route to exact
care workflows. `Health Watch` opens the Health overview route, `Bile Watch`
opens `/health?tab=bile` and Health honors that route param, and `Alone Time`
opens the typed Alone Time detail-intent flow so owners can start away time or
complete the return check-in from Home. Red/green verification first failed on
the missing watch-card contract, then passed mobile readiness 91/91. Fresh
local verification passed the 414-test mobile/domain behavior suite, root
TypeScript, mobile TypeScript, PixelLab asset verification `ok=149 missing=0
invalid=0`, package-local Expo web export to `.expo-smoke` with 223 files,
preview route smoke for `/`, `/health?tab=bile`, and
`/log?type=alone&detail=1&intent=smoke`, and `git diff --check` with expected
Windows CRLF warnings only. The preview server is running at
`http://127.0.0.1:4194/` for Apollo review.

The Home health signal tab-routing pass finished the same exact-route contract
for the remaining Home health controls. The Health status tile and Energy meter
open `/health?tab=health`, Bile Risk opens `/health?tab=bile`, and the mission
deck now routes Health Review to Bile Watch while stable Health Watch opens the
overview tab. Red/green verification first failed on the old generic mission
routes, then passed focused Home mission tests 2/2 and mobile readiness 92/92.
Fresh local verification passed the 415-test mobile/domain behavior suite, root
TypeScript, mobile TypeScript, PixelLab asset verification `ok=149 missing=0
invalid=0`, package-local Expo web export to `.expo-smoke` with 223 files, and
preview route smoke for `/`, `/health?tab=health`, and `/health?tab=bile`.
This clears local web preview and tab-deep-link proof only; it does not clear
native iOS/Android device QA, provider-backed sync/storage/AI/payments/push,
app-store accounts, legal/privacy/support review, CI completion, or Apollo
launch sign-off.

The Home and Quick Log health entry routing pass removed the last broad Health
shortcuts found in the visible owner-preview flow. Home's top health shortcut,
Phoenix Status `View full report`, and Quick Log's header Health action now all
open `/health?tab=health`; Bile-specific entry points remain routed to
`/health?tab=bile`. Red/green mobile readiness first failed on the old broad
routes, then passed 92/92 after the update. Fresh local verification passed the
415-test mobile/domain behavior suite, root TypeScript, mobile TypeScript,
PixelLab asset verification `ok=149 missing=0 invalid=0`, package-local Expo
web export to `.expo-smoke` with 223 files, and preview route smoke for `/`,
`/log`, `/health?tab=health`, and `/health?tab=bile`. This clears local web
preview and owner-flow Health routing proof only; it does not clear native
iOS/Android device QA, provider-backed sync/storage/AI/payments/push, app-store
accounts, legal/privacy/support review, CI completion, or Apollo launch
sign-off.

The Home Next Up row-routing pass removed a subtle first-screen dead end.
`Next Up` now derives typed row objects instead of one shared route: active
walk, active home-alone, and pending meal rows open the exact source
`/log?entry=...` record when an id exists, with Walk/Alone/Meal detail-sheet
fallbacks for older id-less imported rows. Routine rows stay in Plans, and
starter rows open the matching Walk, Meal, or Training detail composer. Red/green
mobile readiness first failed on the missing row-level route contract, then
passed 92/92 after implementation; focused Home/readiness verification passed
94/94. Fresh local verification passed root TypeScript, mobile TypeScript, the
415-test mobile/domain behavior suite, PixelLab asset verification `ok=149
missing=0 invalid=0`, package-local Expo web export to `.expo-smoke` with 223
files, and preview route smoke for `/`, `/log?entry=dinner-1`,
`/log?type=walk&detail=1&intent=123`,
`/log?type=alone&detail=1&intent=123`, `/calendar`, `/health?tab=health`, and
`/health?tab=bile`. This clears local web preview and first-screen row routing
proof only; it does not clear native iOS/Android device QA, provider-backed
sync/storage/AI/payments/push, app-store accounts, legal/privacy/support review,
CI completion, or Apollo launch sign-off.

The Home presence-panel routing pass made the "Phoenix is with..." panel act
like a real household care-state gateway. Active home-alone and active walk
states now open the exact source `/log?entry=...` record when possible, with
Alone Time or Walk detail-sheet fallback routes for older id-less/imported
sessions. Normal caregiver presence routes to `/more?section=household`, and
More renders a top `Household focus` card so the route lands on care-team,
household access, and Household Pulse context instead of a generic tools page.
Red/green mobile readiness first failed on the missing presence-panel contract,
then passed 93/93 after implementation. Fresh local verification passed root
TypeScript, mobile TypeScript, the 416-test mobile/domain behavior suite,
PixelLab asset verification `ok=149 missing=0 invalid=0`, package-local Expo
web export to `.expo-smoke` with 223 files, `git diff --check` with only
expected Windows CRLF warnings, and route smoke for `/`,
`/more?section=household`, `/log?entry=dinner-1`,
`/log?type=walk&detail=1&intent=123`,
`/log?type=alone&detail=1&intent=123`, `/health?tab=health`, and
`/health?tab=bile`. This clears only local web preview and first-screen
presence routing proof; it does not clear native iOS/Android device QA,
provider-backed sync/storage/AI/payments/push, app-store accounts,
legal/privacy/support review, CI completion, or Apollo launch sign-off.

The Home active-walk quick-tap pass tightened the last broad walk shortcut found
in the first-screen fast-care loop. If a walk is already active and the owner
taps Walk in Home Quick Log, the app now opens the exact active walk
`/log?entry=...` record when possible, with the Walk detail sheet as the
id-safe fallback for older imported sessions. This preserves the fast tap
doctrine while keeping the running walk available for finish, duration, route,
notes, trust review, and audit history. Red/green mobile readiness first failed
on the old generic `Walk already active` route, then passed 93/93 after
implementation. Fresh local verification passed root TypeScript, mobile
TypeScript, the 416-test mobile/domain suite, PixelLab asset verification
`ok=149 missing=0 invalid=0`, package-local Expo web export to `.expo-smoke`
with 223 files, `git diff --check` with expected Windows CRLF warnings, and
route smoke for `/`, `/log?entry=dinner-1`,
`/log?type=walk&detail=1&intent=123`, and `/more?section=household`. This
clears only local web preview and first-screen active walk routing proof; it
does not clear native iOS/Android device QA, provider-backed
sync/storage/AI/payments/push, app-store accounts, legal/privacy/support
review, CI completion, or Apollo launch sign-off.

Manual remote verification for commit `0e368fc` was dispatched as GitHub
Actions run `28382937262` on branch
`automation/premium-revenue-product-builder`, but it failed before producing
useful logs. `gh run view --log-failed` returned `log not found: 84090077600`
after the run completed in about six seconds. Treat this as the standing GitHub
billing/spending-limit pre-job blocker, not as product verification evidence or
a local app regression.

The Home mission deck route-contract pass removed the last bare Meal mission
route allowed by the shared mission type. `HomeMissionRoute` no longer permits
`/log?type=meal`; mission rows must use exact log entries, typed detail-intent
routes, Plans, Health tabs, Adventure, Records, or the full Log route. The
mission deck unit test now exercises `/log?type=meal&detail=1&intent=123`, and
mobile readiness guards against reintroducing the broad meal route. Red/green
mobile readiness first failed on the old route allowance, then passed 93/93
after implementation. Fresh local verification passed Home mission deck tests
2/2, root TypeScript, mobile TypeScript, the 416-test mobile/domain suite,
PixelLab asset verification `ok=149 missing=0 invalid=0`, package-local Expo web
export to `.expo-smoke` with 223 files, `git diff --check` with expected Windows
CRLF warnings, and route smoke for `/`, `/log?type=meal&detail=1&intent=123`,
`/adventure`, and `/health?tab=health`.

Next highest-impact work:

1. Run `corepack prepare pnpm@10.24.0 --activate` when Corepack is available and pnpm is missing, then run `pnpm run doctor:mobile-beta`, `pnpm run doctor:mobile-beta:json`, and package install/export from a dependency-complete environment now that the root `preinstall` guard no longer requires `sh -c`, the root package manager is pinned to `pnpm@10.24.0`, the mobile app declares Metro web export platforms, and the doctor verifies Node 24, exact pnpm 10.24.0 CLI usage, plus native EAS iOS/Android profile coverage. Use Replit, Git Bash/WSL with pnpm 10.24.0 installed or Corepack-enabled, CI after billing is fixed, or another environment with the Expo/mobile dependency layer, then record TypeScript/export evidence.
2. Run native iOS/Android simulator or device QA with More's focused `/care-twin-qa?qaSurface=...` links and `docs/release/CARE_TWIN_NATIVE_QA_MATRIX.md`, starting with the focused target shown by Launch Readiness. For the `Owner Preview Core Loop`, read the in-card `Owner route loop`, complete Home, Log, Plans, Health, More, Records, Avatar Studio, Care Pass, and Adventure without dead ends, attach iOS Quick Log/Log proof and Android Launch Readiness proof through the focused card or 48-hour mission card, write the required note, confirm `Pass pending proof` clears only after required proof is saved in both `/care-twin-qa` and More's Native QA Next Captures, use More's `Share Beta Handoff` action after saved proof is current, then continue the Store Screenshot QA checklist and 12-state care-twin matrix, confirm More's Launch Readiness updates from the saved proof, share/export the QA report, mark the first visible stage/sprite/Incident Watch/safe-area/composer/setup/modal/touch issue as Needs tune, use More's `Share Fix Brief`, and fix that first route before moving on.
3. Fill the Provider Launch Setup sheet only as real providers are configured: Clerk, Supabase/Postgres, storage buckets/rules, AI key/model policy, app-store payments, push, Apple/Google accounts, and self-serve deletion. Share the provider plan for Apollo/Fable/Replit handoff, but do not treat it as store approval.
4. Continue production-scale Avatar Studio animation packs: native phone-size QA for the wired Option B Phoenix family, review all template-matched sprite strips, refine weak gait loops where needed, add overlay layers, remaining emote stills, and body-class polish.
5. Continue screen-by-screen polish, accessibility traversal, and visual regression.
6. Prepare provider-backed auth, storage, AI, notifications, checkout, and app-store submission only after Apollo approves those production decisions.
