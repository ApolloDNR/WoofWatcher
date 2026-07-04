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

The Provider Launch Setup provider-approval clamp keeps those saved rows from
becoming fake launch readiness. `deriveLaunchProviderSetup` can still show
owner-reviewed gates as staged checklist progress, but its `providerInput` now
passes auth, database, storage, AI, payments, push, store-account, and deletion
booleans into Launch Readiness only when the saved provider status is
`provider-approved`. This prevents a local owner-reviewed checklist from making
More's Launch Readiness, release packet, or store gates behave as if real
Clerk/Supabase/storage/AI/payments/push/store/deletion providers are approved.

The production auth provider proof pass turns the old Clerk one-line proof into
a source-backed packet. `authProviderProof.ts` now defines the Clerk production
app, redirect/deep-link URL, OAuth sign-in, session/token policy, and household
membership evidence required before provider-backed account sync or household
creation can be claimed. Provider Launch Setup and Share Beta Handoff print
those proof steps under Production auth, and the JSON mobile beta doctor reports
`auth provider proof packet is source-backed`. This does not configure Clerk,
approve OAuth, enable household creation, or clear native Auth/Setup screenshots.

The Auth/Setup proof manifest pass makes the first native-proof blocker visible
on the Auth gateway, Setup route, and focused helper route. `authProviderProof.ts`
now builds rows for Clerk production app, Redirect and deep links, Native auth
screenshots, Setup local-preview proof, Household sync boundary, and Launch gate;
`auth-ui.tsx`, `setup.tsx`, and
`/care-twin-qa?qaSurface=auth-setup-onboarding-proof` render those rows under
`Auth/Setup proof manifest` and keep the visible status at
`Native proof blocked` / `Native proof allowed: No` until real Clerk, native
screenshot, household sync, and Apollo approval evidence is attached. The JSON
mobile beta doctor reports `auth/setup proof manifest is source-backed`. Branch
CI proved the focused helper-route guard in `WoofWatcher Verify` run
`28690620657`, job `85091134806`, on commit `e8a1ea9`.

The WoofWatcher Plus payments proof pass turns the old payments one-line proof
into a source-backed packet. `paymentsProviderProof.ts` now defines the Plus and
Family product catalog, App Store/Google Play/Stripe or web billing decision,
sandbox receipt tests, entitlement mapping, refund/support/subscription terms,
and checkout-gate evidence required before paid checkout can be enabled.
Provider Launch Setup and Share Beta Handoff print those proof steps under
WoofWatcher Plus payments, and the JSON mobile beta doctor reports `payments provider proof packet is source-backed`. This does not confirm exact paid tiers,
enable checkout, approve App Store or Play Store billing, prove receipts, or
clear Apollo launch sign-off.

The Premium payments proof manifest pass makes that same billing boundary
visible on the revenue screen itself. `paymentsProviderProof.ts` now builds rows
for Product catalog, Billing path decision, Sandbox receipts, Entitlements and
restore, Refund and support policy, and Checkout gate; `premium.tsx` renders
those rows under `Payments proof manifest` and lists blockers while the pill
stays `Checkout disabled`. The JSON mobile beta doctor reports `premium payments
proof manifest is source-backed`, proving the route surfaces the required
billing evidence without enabling money movement.

The focused Payments Provider proof manifest pass makes the helper capture
surface carry the same billing boundary. The route
`/care-twin-qa?qaSurface=payments-provider-proof` now renders Product catalog,
Billing path decision, Sandbox receipts, Entitlements and restore, Refund and
support policy, and Checkout gate rows with blockers and `Checkout allowed: No`
until real billing, receipt, restore, refund/support, store, and Apollo checkout
proof are attached. The JSON mobile beta doctor now reports `payments provider
proof manifest is source-backed`, but this is visibility only; it does not
configure App Store, Play Store, Stripe, sandbox receipts, restore purchases,
tax terms, refund approval, money movement, or Apollo checkout sign-off. Branch
CI proved the focused manifest guard in `WoofWatcher Verify` run `28690249414`,
job `85090172228`, on commit `12c63eb`, with JSON mobile beta doctor, focused
behavior tests, and Typecheck plus CI-safe builds passing.

The WoofGuide AI provider proof pass turns the old AI one-line proof into a
source-backed packet. `aiProviderProof.ts` now defines the OpenAI key location,
approved model policy, source/citation rules, owner-review write gate,
veterinary safety boundary, and fallback/incident handling evidence required
before live AI can be enabled. Provider Launch Setup and Share Beta Handoff
print those proof steps under WoofGuide AI, and the JSON mobile beta doctor
reports `ai provider proof packet is source-backed`. This does not configure an
OpenAI key, approve a live model, enable provider-backed AI answers, allow
automatic care-log writes, clear veterinary safety review, or replace Apollo
launch sign-off.

The self-serve account deletion proof pass turns the old deletion one-line
proof into a source-backed packet. `accountDeletionProof.ts` now defines the
self-serve deletion route and reauthentication gate, export-before-delete
handoff, data/object deletion receipt, audit/support receipt, recovery-window
cancellation rules, and legal/store approval required before destructive
account deletion can be enabled. Provider Launch Setup and Share Beta Handoff
print those proof steps under Self-serve account deletion, and the JSON mobile
beta doctor reports `account deletion proof packet is source-backed`. This does
not enable provider-backed destructive deletion, delete storage objects, satisfy
App Store or Play Store review, approve privacy/legal language, or replace
Apollo launch sign-off.

The Apple and Google store accounts proof pass turns the old store-account
one-line proof into a source-backed packet. `storeAccountsProof.ts` now defines
the Apple Developer team id, App Store Connect app record, Google Play package
record, bundle ids and signing ownership, reviewer access/test credentials,
store screenshots/metadata ownership, and release role approval required before
store submission can be claimed. Provider Launch Setup and Share Beta Handoff
print those proof steps under Apple and Google store accounts, and the JSON
mobile beta doctor reports `store accounts proof packet is source-backed`. This
does not create store accounts, approve screenshots or metadata, submit to App
Review or Play review, satisfy legal/privacy approval, or replace Apollo launch
sign-off.

The push notifications proof pass turns the old push one-line proof into a
source-backed packet. `pushNotificationsProof.ts` now defines Expo push project
config, APNs credentials, Firebase/FCM credentials, permission prompt and
preference copy, quiet hours and opt-out behavior, and delivery QA/fallback
evidence required before reminder delivery can be claimed. Provider Launch
Setup and Share Beta Handoff print those proof steps under Push notifications,
and the JSON mobile beta doctor reports `push notifications proof packet is
source-backed`. This does not configure Expo/APNs/FCM, deliver notifications,
approve prompt copy, clear native notification QA, or replace Apollo launch
sign-off.

The push notifications focused proof target pass gives native helpers a
concrete route for that packet. `/care-twin-qa?qaSurface=push-notifications-proof`
now directs iOS and Android capture through Provider Launch Setup's Push
notifications gate, Reminder Center, Expo push project config, APNs
credentials, Firebase/FCM credentials, permission prompt/preference copy, quiet
hours, opt-out behavior, delivery QA, and missed-notification fallback before
reminder delivery can be claimed. Share Beta Handoff, the Release Smoke
Checklist, the live-preview route verifier, the JSON mobile beta doctor, and
the native QA tooling doctor all name the target. This remains proof routing
only; it does not configure providers or prove delivered notifications.

The Reminder Center notification preference boundary pass makes Calendar show
that same push truth in the product surface. `deriveCareReminderCenter` now
returns `notificationPreferenceSummary`, `notificationQuietHours`,
`notificationOptOut`, and `providerBackedNotifications`, and Calendar renders
the provider-gated status, quiet-hours policy, and opt-out copy below reminder
readiness. The default state keeps reminders in-app until Expo/APNs/FCM proof is
attached; even when provider-backed preferences are marked eligible, delivery
still needs native notification QA and delivered-notification evidence before
launch.

The Reminder Center local preference persistence pass turns that read-only
boundary into saved product behavior without enabling delivery. The care
document now stores `reminderNotificationPreferences` with push preference
intent, permission status, quiet-hours start/end, opt-out state, and update
time; Calendar can save "allow after provider setup", "opt out", and "save
quiet hours" actions into that object; `buildReminderNotificationPreferencesForCenter`
only marks provider delivery configured when Provider Launch Setup has push
notifications configured and provider-approved; and privacy export bundles carry
the saved preference state. This closes the local preference-persistence slice,
not Expo/APNs/FCM setup, device permission proof, delivered-notification QA, or
store/privacy approval.

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
helper can test Home, Log, Plans, Health, More, Adventure, Records, Avatar
Studio, and Care Pass in order without drifting from the app's live QA model. This is still a
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
History storage status says Saved on this device, or Ready to upload only after
provider-approved storage` under `Required beta proof after export`, and the
doctor source-backed guard requires that line before passing the Owner Preview
storage-proof check.

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
terminal reminder. `proof:live-preview` now runs a disposable preview server
over `.expo-smoke`, checks 9 launch-critical preview routes, and emits JSON
route proof before helpers keep `preview:smoke` open for browser review; root
`build:ci` runs it after `smoke:web` and `smoke:runtime`.
`scripts/mobile-beta-doctor.mjs --json` now includes
`pnpm --filter @workspace/woofwatcher-mobile run proof:live-preview` and
`pnpm --filter @workspace/woofwatcher-mobile run preview:smoke` in the proof
sequence and tells helpers to serve the exact `.expo-smoke` export after
`smoke:web` and `smoke:runtime`. Local verification passed mobile readiness
83/83, the 406-test behavior/readiness suite, `tsc --build`, mobile TypeScript,
PixelLab asset verification at 149 files, package-local Expo web export to `.expo-smoke`,
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

Manual remote verification for commit `ea969da` was dispatched as GitHub Actions
run `28384327830` on branch `automation/premium-revenue-product-builder`, but it
failed before producing useful logs. `gh run view --log-failed` returned
`log not found: 84094921945` after the run completed in about seven seconds.
Treat this as the standing GitHub billing/spending-limit pre-job blocker, not as
product verification evidence or a local app regression.

The Native QA Incident Composer routing pass tightened the next focused
device-review route. The `incident-composer` surface now opens
`/log?type=incident&detail=1&intent=incident-composer` instead of the old broad
`/log?type=incident` route, so `/care-twin-qa?qaSurface=incident-composer`
lands testers in the real detail-first Log sheet for factual safety context,
trust/visibility, notes, and household review. Red/green verification first
failed on the shallow route, then passed `mobileReleaseQa.test.ts` 9/9 and
mobile readiness 93/93. Fresh local verification passed the 417-test
mobile/domain behavior suite, root TypeScript, mobile TypeScript, PixelLab asset
verification `ok=149 missing=0 invalid=0`, package-local Expo web export to
`.expo-smoke` with 223 files, `git diff --check` with expected Windows CRLF
warnings only, and route smoke for `/`,
`/care-twin-qa?qaSurface=incident-composer`, and
`/log?type=incident&detail=1&intent=incident-composer`. This clears only local
web preview routing proof; it does not clear native iOS/Android device QA,
provider-backed sync/storage/AI/payments/push, app-store accounts,
legal/privacy/support review, CI completion, or Apollo launch sign-off.

Manual remote verification for commit `dd8db31` was dispatched as GitHub Actions
run `28386277013` on branch `automation/premium-revenue-product-builder`, but it
failed before producing useful logs. `gh run view --log-failed` returned
`log not found: 84101633637` after the run completed in about five seconds.
Treat this as the standing GitHub billing/spending-limit pre-job blocker, not as
product verification evidence or a local app regression.

The Records Incident Watch follow-up pass removed another broad route from the
owner-review loop. `Review latest` now opens the exact saved
`/log?entry=...` incident when the watch model has a latest incident id, while
`Log incident` and id-less fallbacks open the detail-first incident composer at
`/log?type=incident&detail=1&intent=...`. The Trainer follow-up remains the
Trainer Care Pass preview. Red/green mobile readiness first failed on the old
`params: { type: "incident" }` route, then passed 93/93 after implementation.
Fresh local verification passed the 417-test mobile/domain suite, root
TypeScript, mobile TypeScript, PixelLab asset verification
`ok=149 missing=0 invalid=0`, package-local Expo web export to `.expo-smoke`
with 223 files, `git diff --check` with expected Windows CRLF warnings, and
route smoke for `/`, `/records`, `/log?entry=dog-gate`, and
`/log?type=incident&detail=1&intent=123`. This clears only local web preview
routing proof for Records Incident Watch follow-ups; it does not clear native
iOS/Android device QA, provider-backed sync/storage/AI/payments/push, app-store
accounts, legal/privacy/support review, CI completion, or Apollo launch
sign-off.

Manual remote verification for commit `3fef8c1` was dispatched as GitHub Actions
run `28387648585` on branch `automation/premium-revenue-product-builder`, but it
failed before producing useful logs. `gh run view --log-failed` returned
`log not found: 84106367436` after the run completed in about six seconds.
Treat this as the standing GitHub billing/spending-limit pre-job blocker, not as
product verification evidence or a local app regression.

The Home safety-critical quick tap pass removed the remaining bare
detail-required route from the first-screen Quick Log path. Home now sends
detail-required policies through `homeLogDetailRoute(policy.type, Date.now())`
instead of `/log?type=...`, preserving normalized safety types for medication,
vomit, symptom, and incident so the Log detail sheet owns the required context,
notes, proof, and household review flow. Red/green mobile readiness first failed
on the old bare branch, then passed 93/93 after implementation. Fresh local
verification passed the 417-test mobile/domain suite, root TypeScript, mobile
TypeScript, PixelLab asset verification `ok=149 missing=0 invalid=0`,
package-local Expo web export to `.expo-smoke` with 223 files,
`git diff --check` with expected Windows CRLF warnings, and route smoke for `/`,
`/log?type=medication&detail=1&intent=123`,
`/log?type=vomit&detail=1&intent=123`, and
`/log?type=incident&detail=1&intent=123`. This clears only local web preview
routing proof for Home safety-critical quick taps; it does not clear native
iOS/Android device QA, provider-backed sync/storage/AI/payments/push, app-store
accounts, legal/privacy/support review, CI completion, or Apollo launch
sign-off.

Manual remote verification for commit `c48c163` was dispatched as GitHub Actions
run `28389127987` on branch `automation/premium-revenue-product-builder`, but it
failed before producing useful logs. `gh run view --log-failed` returned
`log not found: 84111370284` after the run completed in about ten seconds.
Treat this as the standing GitHub billing/spending-limit pre-job blocker, not as
product verification evidence or a local app regression.

The Health Review Packet route-contract pass removed the old `/log` plus
`params: { type: "symptom" }` action shape from the visible `Log health detail`
button. The packet primary action now carries
`/log?type=symptom&detail=1&intent=health-review`, and Health Watch routes
`/log?...` packet actions directly while preserving WoofGuide prompt params for
`Draft vet questions`. Red/green tests first failed on the old packet action and
handler, then passed `healthReviewPacket.test.ts` 4/4 and mobile readiness 93/93
after implementation. Fresh local verification passed the 417-test mobile/domain
suite, root TypeScript, mobile TypeScript, PixelLab asset verification
`ok=149 missing=0 invalid=0`, package-local Expo web export to `.expo-smoke`
with 223 files, `git diff --check` with expected Windows CRLF warnings, and
route smoke for `/health`, `/log?type=symptom&detail=1&intent=health-review`,
and `/woofguide?prompt=health-review`. This clears only local web preview
routing proof for the Health Review Packet action; it does not clear native
iOS/Android device QA, provider-backed sync/storage/AI/payments/push, app-store
accounts, legal/privacy/support review, CI completion, or Apollo launch
sign-off.

Manual remote verification for commit `ddb6987` was dispatched as GitHub Actions
run `28390628880` on branch `automation/premium-revenue-product-builder`, but it
failed before producing useful logs. `gh run view --log-failed` returned
`log not found: 84116536531` after the run completed in about five seconds.
Treat this as the standing GitHub billing/spending-limit pre-job blocker, not as
product verification evidence or a local app regression.

The Home Today Command pass made the release-plan command model visible and
source-backed. `deriveTodayCommand` now returns exact source-log routes for
pending meal outcomes and handoff review, and detail-first meal, walk, and potty
routes for missing core care actions. Phoenix Home renders a compact `Today
Command` control under the status tiles with a pixel icon, urgency color,
concise CTA, screen-reader label/hint, and shared 48px mobile touch target.
Red/green verification first failed on the old broad `/log` Today Command routes
and missing Home render, then passed `todayCommand.test.ts` 8/8 and mobile
readiness 94/94 after implementation. Fresh local verification passed the
459-test mobile/domain/API/PWA suite, root TypeScript, mobile TypeScript,
PixelLab asset verification `ok=149 missing=0 invalid=0`, package-local Expo
web export to `.expo-smoke` with 219 assets, `git diff --check` with expected
Windows CRLF warnings, and route smoke for `/`,
`/log?type=meal&detail=1&intent=today-command-meal`,
`/log?type=walk&detail=1&intent=today-command-walk`,
`/log?type=potty&detail=1&intent=today-command-potty`, and
`/log?entry=training_1`. This clears only local web preview routing proof for
the Home Today Command surface; it does not clear native iOS/Android device QA,
provider-backed sync/storage/AI/payments/push, app-store accounts,
legal/privacy/support review, CI completion, or Apollo launch sign-off.

Manual remote verification for commit `c735e2e` was dispatched as GitHub Actions
run `28392240344` on branch `automation/premium-revenue-product-builder`, but it
failed before producing useful logs. `gh run view --log-failed` returned
`log not found: 84121968977` after the run completed in about six seconds.
Treat this as the standing GitHub billing/spending-limit pre-job blocker, not as
product verification evidence or a local app regression.

The Avatar Studio sprite-first pass tightened the care-twin presentation around
the PixelLab assets Apollo selected. The hero preview now renders a dedicated
`avatar-studio-pixel-sprite-viewport` and uses the 256px sprite strip as the
visible dog layer whenever a live pack exists, instead of hiding a still portrait
under the sprite. The live badge now reads `PIXELLAB SPRITE`, and launch-template
mood previews for hungry, anxious, sleepy, home-alone, and not-feeling-well stay
animated through the idle loop instead of dropping to still art. Red/green
verification first failed on the missing viewport guard, then passed
Avatar Studio-focused readiness after implementation. Fresh local verification
passed root TypeScript, mobile TypeScript, the 459-test mobile/domain/API/PWA
suite, PixelLab asset verification `ok=149 missing=0 invalid=0`, package-local
Expo web export to `.expo-smoke` with 219 assets / 223 files, and route smoke for
`/`, `/portrait`, `/log?type=meal&detail=1&intent=smoke`,
`/health?tab=health`, and `/more`. This clears only local web preview and asset
packaging proof; it does not clear native iOS/Android sprite/gait QA,
provider-backed sync/storage/AI/payments/push, app-store accounts,
legal/privacy/support review, CI completion, or Apollo launch sign-off.

Manual remote verification for commit `5f2c4be` was dispatched as GitHub Actions
run `28393907730` on branch `automation/premium-revenue-product-builder`, but it
failed before producing useful logs. Job `84127618580` completed with zero
recorded steps, and `gh run view --log-failed` returned
`log not found: 84127618580`. Treat this as the standing GitHub
billing/spending-limit pre-job blocker, not as product verification evidence or
a local app regression.

The Home care-twin avatar runtime pass connected Avatar Studio back into the
main Phoenix room. `avatarRoomRuntime.ts` now derives Home room sprite mode and
accessory layers from the saved Avatar Studio config: Shepherd/Phoenix keeps the
full Option B action sprite family with fitted overlays/underlays, and
non-Shepherd launch templates use their live PixelLab idle/walk sprite packs in
Home. Home and Avatar Studio both pass the saved/draft config to
`LivingPhoenixRoom`, and readiness tests protect this wiring. Local verification
passed mobile readiness 94/94, the 461-test behavior/readiness suite, root and
mobile TypeScript, PixelLab verification, Expo web export, route smoke, and
`git diff --check`. Remaining work is native iOS/Android crop/gait/tap QA plus
production-scale overlay/emote packs for every launch template.

The Home live-twin HUD polish pass made that runtime visible on the first
screen. `LivingPhoenixRoom` now displays a compact `PHOENIX TWIN`/`STUDIO RIG`
title plus a bounded detail line naming the selected template and fitted add-on
count when accessories are active, instead of always showing the old static
`PHOENIX ROOM` chip. Local verification passed mobile readiness, the 461-test
behavior/readiness suite, TypeScript, PixelLab verification, Expo web export,
and route smoke.

The Home care-twin long-press pass made the main dog more tactile. The same
`LivingPhoenixRoom` press target now keeps tap-to-react behavior while adding a
long-press handoff to Avatar Studio through Home's shared `openAvatarStudio`
handler and an explicit accessibility hint. Local verification passed mobile
readiness 94/94, the 461-test behavior/readiness suite, root and mobile
TypeScript, PixelLab verification `ok=149 missing=0 invalid=0`, Expo web export
to `.expo-smoke` with 219 assets / 223 files, route smoke for `/`, `/portrait`,
`/log?type=meal&detail=1&intent=smoke`, `/health?tab=health`, and `/more`, and
`git diff --check`. Remaining proof is native iOS/Android long-press, haptics,
crop, and gait QA.

Manual remote verification for commit `dbf56ff` was dispatched as GitHub Actions
run `28399882587` on branch `automation/premium-revenue-product-builder`, but
it failed before the job started. GitHub reported job `84148107633` with the
billing/spending-limit annotation, and `gh run view --log-failed` returned
`log not found: 84148107633`. Treat this as the standing GitHub account blocker,
not as product verification evidence or a local app regression.

The native QA long-press coverage pass updated `MOBILE_RELEASE_QA_SURFACES` so
Phoenix Home device testing now explicitly includes the main dog
long-press-to-Studio handoff in the device prompt, verification steps, pass
criteria, failure escalation, required evidence, and Owner Preview Core Loop
route checklist. Red/green verification first failed because the QA script did
not mention the interaction, then passed `mobileReleaseQa.test.ts` 10/10. Fresh
local verification passed the 462-test behavior/readiness suite, root and mobile
TypeScript, Expo web export to `.expo-smoke` with 219 assets / 223 files, and
route smoke for `/care-twin-qa?qaSurface=phoenix-home`, `/`, and `/portrait`.

Manual remote verification for commit `227bd37` was dispatched as GitHub Actions
run `28400884728` on branch `automation/premium-revenue-product-builder`, but
it failed before the job started. GitHub reported job `84151501310` with the
billing/spending-limit annotation, and `gh run view --log-failed` returned
`log not found: 84151501310`. Treat this as the standing GitHub account blocker,
not as product verification evidence or a local app regression.

The Today Command health-routing pass removed a first-screen workflow mismatch.
`deriveTodayCommand` now treats symptom logs as health signals, keeps vomit/bile
signals routed to `/health?tab=bile`, routes non-vomit symptoms to
`/health?tab=health`, and no longer sends the primary Health Watch command to
Records. Red/green verification first failed on the old `/records` route and
on symptoms being buried behind the meal command, then passed
`todayCommand.test.ts` 9/9 after implementation. Fresh local verification
passed mobile readiness 94/94, the 463-test behavior/readiness suite, root and
mobile TypeScript, PixelLab verification `ok=149 missing=0 invalid=0`, Expo web
export to `.expo-smoke` with 219 assets / 223 files, and route smoke for `/`,
`/health?tab=health`, `/health?tab=bile`, and
`/log?type=symptom&detail=1&intent=smoke`. Remaining proof is still native
iOS/Android device QA and the standing GitHub billing/spending-limit recovery.

Manual remote verification for commit `648d685` was dispatched as GitHub Actions
run `28402608398` on branch `automation/premium-revenue-product-builder`, but
it failed before the job started. GitHub reported job `84157380035` with the
billing/spending-limit annotation, and `gh run view --log-failed` returned
`log not found: 84157380035`. Treat this as the standing GitHub account blocker,
not as product verification evidence or a local app regression.

The Adventure Mode pixel-stage pass moved the route closer to Apollo's Option B
mockups. The old abstract gradient hero is now an `ImageBackground` using the
Option B pixel room, a live `walk-loop` `SpriteSheetPlayer`, a quest speech
bubble, pixel rendering, and a compact level/XP/memory HUD. Existing local
quest actions still create real care logs, open exact proof logs, save local
private memories, and keep storage/provider copy honest. Red/green verification
first failed on the missing pixel-stage contract, then passed mobile readiness
94/94 after implementation. Fresh local verification passed mobile TypeScript,
the 463-test behavior/readiness suite, root TypeScript, PixelLab verification
`ok=149 missing=0 invalid=0`, Expo web export to `.expo-smoke` with 219 assets
/ 223 files, `/adventure` route smoke, and `git diff --check`.

Remote verification for Adventure Mode pixel-stage commit `d4e0479` was
manually dispatched as GitHub Actions run `28404391031`, but job `84163369485`
failed before execution with GitHub's billing/spending-limit annotation. `gh run
view --log-failed` returned `log not found: 84163369485`. Treat this as the
standing GitHub account blocker, not as product verification evidence or a local
app regression.

The Health Watch pixel-stage pass moved the health route closer to the premium
neo-retro mockups without weakening the health boundary. The hero now renders
the dogless `healthWatch` room, a live `health-watch` `SpriteSheetPlayer`,
hard-pixel rendering, a calm speech bubble, status chip, and compact score/bile
HUD while preserving the existing Health Watch/Bile Watch formulas, review
packet actions, exact Log routes, Records handoff, and non-diagnostic copy.
Red/green verification first failed on the missing pixel-stage contract, then
passed mobile readiness 94/94 after implementation. Fresh local verification
passed mobile TypeScript, the 463-test behavior/readiness suite, root
TypeScript, PixelLab verification `ok=149 missing=0 invalid=0`, Expo web export
to `.expo-smoke` with 219 assets / 223 files, `/health?tab=health` and
`/health?tab=bile` route smoke, and `git diff --check`.

Remote verification for Health Watch pixel-stage commit `83f4a32` was manually
dispatched as GitHub Actions run `28405759745`, but job `84167756433` failed
before execution with GitHub's billing/spending-limit annotation. `gh run view
--log-failed` returned `log not found: 84167756433`. Treat this as the standing
GitHub account blocker, not as product verification evidence or a local app
regression.

The Plans command-deck pass moved another core route closer to Apollo's Option B
mockups without weakening the operating workflow. Plans now renders an
`ImageBackground` with the Option B day room, hard-pixel rendering, a live
`idle-breathe` `SpriteSheetPlayer`, next-care speech, completion/open counters,
and signal bars derived from the schedule state. The existing routine board,
Reminder Center routing, owner assignment, add/edit/delete routines, and
recoverable routine quick-log behavior remain intact. Red/green verification
first failed on the missing pixel-stage contract, then passed mobile readiness
95/95 after implementation. Fresh local verification passed mobile TypeScript,
the 464-test API/mobile/PWA/care-domain focused suite, root TypeScript,
PixelLab verification `ok=149 missing=0 invalid=0`, Expo web export to
`.expo-smoke` with 219 assets / 223 files, `/calendar` route smoke, and
`git diff --check`.

Remote verification for Plans command-deck commit `bb4a2e0` was manually
dispatched as GitHub Actions run `28407281363`, but job `84172491881` failed
before execution with `steps: []` and `runner_id: 0`. `gh run view
--log-failed` returned `log not found: 84172491881`. Treat this as the
standing GitHub account/pre-job blocker, not as product verification evidence or
a local app regression.

The Records credential-stage pass moved the records route closer to Apollo's
Option B mockups without weakening the vault/report workflow. Records now
renders the dogless Option B day room, a live `tail-wag` `SpriteSheetPlayer`,
hard-pixel rendering, Dog ID speech, status chip, and compact Saved/Ready/Alerts
HUD derived from record vault coverage, credential readiness, missing critical
records, and reminders. Existing Dog ID sharing, printable credential source,
Care Pass previews/history, record reminders, medication history, health/potty/
training/alone-time/grooming/incident summaries, and add/delete record flows
remain intact. Red/green verification first failed on the missing pixel-stage
contract, then passed mobile readiness 96/96 after implementation. Fresh local
verification passed mobile TypeScript, the 465-test behavior/readiness suite,
root TypeScript, PixelLab verification `ok=149 missing=0 invalid=0`, Expo web
export to `.expo-smoke` with 219 assets / 223 files, `/records` route smoke,
and `git diff --check`.

Remote verification for Records credential-stage commit `d56cce7` was manually
dispatched as GitHub Actions run `28408619053`, but job `84176575777` failed
before execution with `steps: []` and `runner_id: 0`. `gh run view
--log-failed` returned `log not found: 84176575777`. Treat this as the standing
GitHub account/pre-job blocker, not as product verification evidence or a local
app regression.

The More launch command-hub pass moved the system/tools route closer to Apollo's
Option B mockups without weakening the serious launch workflow. More now opens
with the dogless night room, a live `idle-breathe` `SpriteSheetPlayer`,
hard-pixel rendering, `Launch Command Hub` speech, a readiness chip, and a compact
Launch/QA/Sync/Roster HUD derived from the release score, saved native-QA proof
counts, sync dashboard, and CareTwin roster state. The command action routes to
the native QA cockpit while beta is QA-first, or shares the beta handoff packet
when local beta proof is ready. The existing Profile, CareTwin Roster, Care
Intelligence, Launch Readiness, Provider Launch Setup, Native QA capture,
Household Access, Access Pass, My Care Today, Sync Health, Diet, and tool links
remain intact. Red/green verification first failed on the missing pixel-stage
contract, then passed mobile readiness 97/97 after implementation. Fresh local
verification passed mobile TypeScript, the 466-test behavior/readiness suite,
root TypeScript, PixelLab verification `ok=149 missing=0 invalid=0`, Expo web
export to `.expo-smoke` with 219 assets / 223 files, `/more` route smoke, and
`git diff --check`.

Remote verification for More launch command-hub commit `64a76e8` was manually
dispatched as GitHub Actions run `28410138254`, but job `84181160392` failed
before execution with `steps: []` and `runner_id: 0`. `gh run view
--log-failed` returned `log not found: 84181160392`. Treat this as the standing
GitHub account/pre-job blocker, not as product verification evidence or a local
app regression.

The Quick Log pixel-console pass moved the highest-frequency care workflow
closer to Apollo's Option B mockups without weakening the real logging system.
Quick Log now opens with the Option B day room, a live `ear-perk`
`SpriteSheetPlayer`, hard-pixel rendering, `Quick Care Console` speech, a
selected-action readiness chip, and a compact Today/Care IQ/Open/Sync HUD
derived from actual log count, care intelligence, pending meal/open walk/open
alone loops, and the durable sync outbox. The stage action quick-logs the
selected launcher item or opens the detail-first sheet for safety-critical logs,
so the existing meal served-to-outcome lifecycle, potty parent/outcome model,
trust review, sticky notes, audit history, and editable timeline remain intact.
Red/green verification first failed on the missing pixel-stage contract, then
passed mobile readiness 98/98 after implementation. Fresh local verification
passed mobile TypeScript, the 467-test behavior/readiness suite, root
TypeScript, PixelLab verification `ok=149 missing=0 invalid=0`, Expo web export
to `.expo-smoke` with 219 assets / 223 files, `/log` route smoke, and
`git diff --check`.

Remote verification for Quick Log pixel-console commit `f882f31` was manually
dispatched as GitHub Actions run `28411487836`, but job `84185172515` failed
before execution with `steps: []`. `gh run view --log-failed` returned
`log not found: 84185172515`. Treat this as the standing GitHub account/pre-job
blocker, not as product verification evidence or a local app regression.

The WoofGuide pixel-console pass moved the assistant route closer to Apollo's
Option B mockups without weakening the owner-review or veterinary boundary. The
empty assistant state now opens with the dogless night room, a live
`idle-breathe` `SpriteSheetPlayer`, hard-pixel rendering, `WoofGuide Console`
speech sourced from the current suggested action, an `Owner review` chip, a
source-backed Actions/Review/Watch/Boundary HUD, and a `Not veterinary advice`
footer action that asks the first quick question. Existing quick-question
chips, deterministic suggested actions, owner-review modal, care draft handlers,
and non-diagnostic copy remain intact. Red/green verification first failed on
the missing pixel-stage contract, then passed mobile readiness 99/99 after
implementation. Fresh local verification passed mobile TypeScript, the 468-test
behavior/readiness suite, root TypeScript, PixelLab verification `ok=149
missing=0 invalid=0`, Expo web export to `.expo-smoke` with 218 assets / 222
files, `/woofguide` route smoke, and `git diff --check`.

Remote verification for WoofGuide pixel-console commit `a4c05ea` was manually
dispatched as GitHub Actions run `28412519162`, but job `84188359018` failed
before execution with `steps: []`. `gh run view --log-failed` returned
`log not found: 84188359018`. Treat this as the standing GitHub account/pre-job
blocker, not as product verification evidence or a local app regression.

The Premium pixel value-console pass moved the revenue surface into the same
Option B product world without pretending checkout is live. Premium now opens
with the dogless day room, a live `celebrate-hop` `SpriteSheetPlayer`,
hard-pixel rendering, `Plus Value Console` speech tied to the recommended plan
and locked entitlement, a `Checkout gated` chip, source-backed Plan/Price/
Signals/Gate HUD metrics, and a launch-checklist CTA. Existing premium value
signals, plan cards, launch entitlements, the disabled-payments notice, and
Free-plan state remain intact. Red/green verification first failed on the
missing pixel-stage contract, then passed mobile readiness 100/100 after
implementation. Fresh local verification passed mobile TypeScript, the 469-test
behavior/readiness suite, root TypeScript, PixelLab verification `ok=149
missing=0 invalid=0`, Expo web export to `.expo-smoke` with 218 assets / 222
files, `/premium` route smoke, and `git diff --check`. No payment provider,
checkout action, subscription activation, app-store approval, or store billing
claim was added.

Remote verification for Premium pixel value-stage commit `2e53abb` was manually
dispatched as GitHub Actions run `28413556876`, but job `84191529946` failed
before execution with `steps: []`. `gh run view --log-failed` returned
`log not found: 84191529946`. Treat this as the standing GitHub account/pre-job
blocker, not as product verification evidence or a local app regression.

The Launch Readiness next-gate pass made More behave like a real launch cockpit
instead of a passive checklist. `deriveLaunchReadiness` now returns a focused
`nextGate` object with an owner-readable kind, action, label, detail, and CTA for
native QA proof, Needs tune fix briefs, local Expo/EAS and PixelLab foundations,
provider setup, owner approval, and store packet prep. More renders this as a
pressable `Next launch gate` card under Launch Readiness and routes/shares the
right next action: QA cockpit, Needs tune fix brief, Provider Launch Setup,
Privacy, Premium, WoofGuide, Avatar Studio, beta handoff, launch packet, or
store packet. Red/green verification first failed on missing `nextGate` and
More UI hooks, then passed after implementation. Fresh local verification passed
launch readiness tests 6/6, mobile readiness 100/100, the 470-test
behavior/readiness suite, root TypeScript, mobile TypeScript, PixelLab
verification `ok=149 missing=0 invalid=0`, Expo web export to `.expo-smoke` with
218 assets / 222 files, and `git diff --check`. This does not clear native
iOS/Android device proof, provider-backed services, app-store approval, legal/
support approval, CI completion, or Apollo launch sign-off.

Remote verification for Launch Readiness next-gate commit `d50abea` was
manually dispatched as GitHub Actions run `28415068044`, but job `84196124798`
failed before execution with `steps: []`. `gh run view --log-failed` returned
`log not found: 84196124798`. Treat this as the standing GitHub account/pre-job
blocker, not as product verification evidence or a local app regression.

The Native QA primary-mission pass made the device-proof workflow deterministic
instead of relying on the first item in the capture queue. `buildMobileLaunchQaCapturePlan`
now returns `primaryMission`, which prioritizes the first Needs tune target,
Pass-pending-proof targets, the Owner Preview Core Loop, store screenshot proof,
then the normal next capture. More's Care Twin QA link, Native QA tile, Next
launch gate, command-hub CTA, Native QA Next Captures panel, and beta packet CTA
all open the same primary target. `/care-twin-qa` uses the same mission for the
48-hour beta run, labels it as the primary device mission, and shows the done
condition in-card. Fresh local verification passed the Native QA model tests
19/19, mobile readiness 100/100, mobile TypeScript, the 473-test
API/mobile/PWA/care-domain focused suite, PixelLab verification `ok=149
missing=0 invalid=0`, package-local Expo web export to `.expo-smoke` with 218
assets / 222 files, live preview route smoke `200` for `/` and `/care-twin-qa`
at `http://127.0.0.1:4194/`, and `git diff --check` with expected Windows CRLF
warnings only. `scripts/mobile-beta-doctor.mjs --json` is still blocked in this shell
because Corepack is not on PATH and bundled pnpm is `11.7.0` while the repo pins
`pnpm@10.24.0`; this is dependency-environment proof, not an app regression.

Remote verification for Native QA primary-mission commit `2d0594d` was manually
dispatched as GitHub Actions run `28416512265`, but job `84200466442` failed
before execution with `steps: []`. `gh run view --log-failed` returned
`log not found: 84200466442`. Treat this as the standing GitHub account/pre-job
blocker, not as product verification evidence or a local app regression.

The Owner Preview Adventure QA pass made the beta route loop match the current
care-RPG product promise. `MOBILE_RELEASE_QA_SURFACES` now requires Adventure
Mode in the Owner Preview Core Loop, tells iOS/Android testers to open it from
Home or More, and checks that private care quests, proof rows, and the memory
shelf are reachable without implying public maps, cloud sharing, native proof,
or provider-backed storage. The capture-plan primary mission, share script,
beta handoff fixture, two-day beta ship plan, and automation queue now carry the
same route order: Home, Log, Plans, Health, More, Adventure, Records, Avatar
Studio, and Care Pass. Focused local verification passed `mobileReleaseQa.test.ts`
10/10, `mobileLaunchQaEvidence.test.ts` 19/19, and `betaHandoffPacket.test.ts`
2/2 after the expected red test first caught the old route checklist omission.
Fresh local closeout verification also passed mobile readiness 100/100, launch
readiness 6/6, release packet 5/5, store submission packet 3/3, mobile
TypeScript, root TypeScript, the 473-test API/mobile/PWA/care-domain focused
suite, PixelLab assets `ok=149 missing=0 invalid=0`, package-local Expo web
export to `.expo-smoke` with 218 assets / 222 files after prepending bundled
Node to PATH, live preview route smoke `200` for `/`, `/care-twin-qa`,
`/adventure`, and `/log` at `http://127.0.0.1:4194/`, and `git diff --check`
with expected Windows CRLF warnings only. The JSON mobile beta doctor remains
truthfully `BLOCKED` because Corepack is not on PATH and the
available bundled pnpm is `11.7.0` while the repo pins `pnpm@10.24.0`; this is
dependency-environment proof, not an app regression.

Remote verification for Owner Preview Adventure QA contract commit `f0810be` was
manually dispatched as GitHub Actions run `28418527482`, but job `84206610368`
failed before execution with `steps: []`. `gh run view --log-failed` returned
`log not found: 84206610368`. Treat this as the standing GitHub account/pre-job
blocker, not as product verification evidence or a local app regression.

The Owner Preview route-loop actionability pass made `/care-twin-qa` a stronger
native QA cockpit instead of a passive checklist. Each route-loop row now opens
its target surface with the same QA return params used by the primary mission,
keeps a 48px shared touch target, provides haptic selection on native, and names
the route action for assistive tech. This means an iOS or Android tester can run
Home, Log, Plans, Health, More, Adventure, Records, Avatar Studio, and Care Pass
from the QA card without manually hunting through the app. Fresh local
verification passed mobile readiness 100/100, mobile TypeScript, root
TypeScript, the 473-test API/mobile/PWA/care-domain focused suite, PixelLab
assets `ok=149 missing=0 invalid=0`, package-local Expo web export to
`.expo-smoke` with 218 assets / 222 files after prepending bundled Node to PATH,
live preview route smoke `200` for `/`, `/care-twin-qa`, and `/adventure` at
`http://127.0.0.1:4194/`, and `git diff --check` with expected Windows CRLF
warnings only. The in-app browser automation bridge timed out while attaching to
the Codex webview, but the exported preview server itself is running and
route-smoke verified.

Remote verification for route-loop actionability commit `d2e4d80` was manually
dispatched as GitHub Actions run `28419827821`, but job `84210404098` failed
before execution with `steps: []`. `gh run view --log-failed` returned
`log not found: 84210404098`. Treat this as the standing GitHub account/pre-job
blocker, not as product verification evidence or a local app regression.

The Store Screenshot QA route-check pass made `/care-twin-qa` useful for store
packet capture instead of leaving screenshot requirements as passive text.
`buildStoreSubmissionScreenshotQaSurfaces` now gives every store screenshot
surface an exact route-check row with expected store-safe framing, proof
language, and blocked-gate instructions. `/care-twin-qa` renders those rows as
48px pressable targets with haptic selection, accessibility labels, open-route
affordances, and QA return params so testers can open Avatar Studio,
Privacy/Launch Gates, Health Watch, Home, Log, Plans, Records, or the fallback
QA route directly from the Store Screenshot QA card, then return to attach
iOS/Android proof. Fresh local verification passed `mobileReleaseQa.test.ts`
11/11, mobile readiness 100/100, mobile TypeScript, root TypeScript, the
474-test API/mobile/PWA/care-domain focused suite, PixelLab assets `ok=149
missing=0 invalid=0`, package-local Expo web export to `.expo-smoke` with 218
assets / 222 files after prepending bundled Node to PATH, live preview route
smoke `200` for `/`, `/care-twin-qa`, `/privacy`, `/portrait`, and `/health` at
`http://127.0.0.1:4194/`, and `git diff --check` with expected Windows CRLF
warnings only. This clears only local web preview and QA-workflow proof; it
does not clear actual native iOS/Android screenshots, provider-backed
sync/storage/AI/payments/push, app-store accounts, legal/privacy/support, CI
completion, store approval, or Apollo launch sign-off.

Remote verification for Store Screenshot QA route-check commit `53637e4` was
manually dispatched as GitHub Actions run `28421032998`, but job `84214027680`
failed before execution with `steps: []`. `gh run view --log-failed` returned
`log not found: 84214027680`. Treat this as the standing GitHub account/pre-job
blocker, not as product verification evidence or a local app regression.

The scenario-level Care Twin QA proof-gate pass made the 12-state avatar matrix
harder to overclaim. `summarizeCareTwinQaReviews` now separates total passes,
native-proof passes, and pass-pending-proof states. `careTwinQaReviewStatusLabel`
labels a passed care-twin state as `Pass pending proof` until that exact state has
at least one iOS or Android screenshot attached, and the share report lists the
same missing-proof language. `/care-twin-qa` now renders a `Pass pending native
proof` gate directly on each scenario card after evidence capture, so device
testers can see which animated Phoenix states still need native proof before
launch. Fresh local verification passed `careTwinQaReport.test.ts` 4/4, mobile
readiness 100/100, mobile TypeScript, root TypeScript, the 475-test
API/mobile/PWA/care-domain focused suite, PixelLab assets `ok=149 missing=0
invalid=0`, package-local Expo web export to `.expo-smoke` with 218 assets / 222
files after prepending bundled Node to PATH, live preview route smoke `200` for
`/`, `/care-twin-qa`, `/health`, and `/portrait` at `http://127.0.0.1:4194/`,
and `git diff --check` with expected Windows CRLF warnings only. This clears
local QA workflow proof only; actual native iOS/Android care-twin proof still
requires attached screenshots from real devices or simulators.

Remote verification for scenario-level Care Twin QA proof-gate commit `a7f5933`
was manually dispatched as GitHub Actions run `28422240814`, but job
`84217558788` failed before execution with `steps: []`. `gh run view
--log-failed` returned `log not found: 84217558788`. Treat this as the standing
GitHub account/pre-job blocker, not as product verification evidence or a local
app regression.

The release-surface proof-gate pass carried the same truth rule into Mobile
Release QA and Store Screenshot QA. `mobileReleaseQa.ts` now separates total
passes, proof-backed passes, and pass-pending-proof surfaces. Any release or
store screenshot card marked Pass stays labeled `Pass pending proof` until the
surface has every required iOS screenshot, Android screenshot, flexible
screenshot, and required QA note. The `/care-twin-qa` release and store cards
also show an amber `Pass pending release proof` gate with the missing proof, and
the share report lists the same gap under each affected surface. Fresh local
verification passed `mobileReleaseQa.test.ts` 12/12, mobile readiness 100/100,
mobile TypeScript, root TypeScript, the 476-test API/mobile/PWA/care-domain
focused suite, PixelLab assets `ok=149 missing=0 invalid=0`, package-local Expo
web export to `.expo-smoke` with 218 assets / 222 files after prepending bundled
Node to PATH, live preview route smoke `200` for `/`, `/care-twin-qa`, `/health`,
and `/portrait` at `http://127.0.0.1:4194/`, and `git diff --check` with
expected Windows CRLF warnings only. This clears local proof that the release QA
cockpit cannot overclaim green passes; it does not clear actual native
iOS/Android screenshots, provider-backed storage, CI completion, store approval,
or Apollo launch sign-off.

Remote verification for release-surface proof-gate commit `9a507b1` was manually
dispatched as GitHub Actions run `28423666264`, but job `84221815527` failed
before execution with `steps: []`. `gh run view --log-failed` returned
`log not found: 84221815527`. Treat this as the standing GitHub account/pre-job
blocker, not as product verification evidence or a local app regression.

The beta-doctor release-proof guard now source-validates that the release and
store screenshot QA surfaces cannot be overclaimed during handoff. `scripts/mobile-beta-doctor.mjs --json` emits `release QA proof gate is source-backed`
only when `mobileReleaseQa.ts` still separates proof-backed passes from `pass
pending proof`, exposes `mobileReleaseQaMissingEvidenceForSurface` and
`mobileReleaseQaReviewStatusLabel`, keeps `Pass pending proof` plus `Missing
proof:` share-report language, and `/care-twin-qa` still renders the amber `Pass
pending release proof` gate from the same missing-evidence helper. The first
focused readiness run failed on the missing doctor check, then passed after the
doctor was updated. Fresh local verification passed mobile readiness 100/100,
direct JSON doctor with the new check PASS while still truthfully blocked on
pnpm `11.7.0` vs required `10.24.0`, mobile TypeScript, root TypeScript, the
476-test API/mobile/PWA/care-domain focused suite, PixelLab assets `ok=149
missing=0 invalid=0`, package-local Expo web export to `.expo-smoke` with 218
assets / 222 files after prepending bundled Node to PATH, live preview route
smoke `200` for `/`, `/care-twin-qa`, `/health`, `/log`, and `/portrait` at
`http://127.0.0.1:4194/`, and `git diff --check` with expected Windows CRLF
warnings only. This is source-backed local handoff proof, not native
iOS/Android screenshot proof or public launch approval.

Remote verification for beta-doctor release-proof guard commit `178d91f` was
manually dispatched as GitHub Actions run `28424879485`, but job `84225618354`
failed before execution with `steps: []`. `gh run view --log-failed` returned
`log not found: 84225618354`. Treat this as the standing GitHub account/pre-job
blocker, not as product verification evidence or a local app regression.

The QA proof-manifest handoff pass adds a stable local proof ID to saved
`/care-twin-qa` evidence so Apollo, native-device testers, Replit, or Fable can
discuss the same evidence set without overclaiming. `mobileQaSession.ts` now
builds a deterministic `wwqa-*` manifest from saved care-twin, release, and
store QA evidence; summarizes pass, needs-tune, unreviewed, notes, and
iOS/Android/Web evidence counts; and emits share text with explicit boundaries
that local metadata is not App Store or Play Store approval, native screenshot
proof, provider-backed storage, live AI, payments, push, generated PDF output,
or public launch readiness. `/care-twin-qa` shows the proof ID, evidence file
count, platform summary, and includes the manifest at the top of the shared QA
report. Fresh local verification passed `mobileQaSession.test.ts` 4/4, mobile
readiness 100/100, mobile TypeScript, root TypeScript, the 477-test
API/mobile/PWA/care-domain focused suite, PixelLab assets `ok=149 missing=0
invalid=0`, package-local Expo web export to `.expo-smoke` with 218 assets / 222
files after prepending bundled Node to PATH, route smoke `200` for `/`,
`/care-twin-qa`, `/health`, `/log`, and `/portrait` at
`http://127.0.0.1:4194/`, and the JSON mobile beta doctor still truthfully
blocked only on pnpm `11.7.0` versus required `10.24.0`.

Remote verification for QA proof-manifest handoff commit `34f9eca` was manually
dispatched as GitHub Actions run `28426606118`, but job `84231097976` failed
before execution with `steps: []`. `gh run view --log-failed` returned
`log not found: 84231097976`. Treat this as the standing GitHub account/pre-job
blocker, not as product verification evidence or a local app regression.

The More/Beta Handoff proof-manifest surfacing pass makes that same `wwqa-*`
proof ID visible in the owner launch cockpit and included in the shareable beta
handoff packet. `buildBetaHandoffPacketShareText` now accepts an optional
`MobileQaSessionProofManifest`; More rebuilds the manifest from the saved local
QA session, passes it into Share Beta Handoff, and renders a `Proof manifest`
row in Native QA Next Captures with the proof ID, evidence file count, platform
evidence label, and local-metadata-only boundary. Fresh local verification
passed `betaHandoffPacket.test.ts` 3/3, mobile readiness 100/100, mobile
TypeScript, root TypeScript, the 478-test API/mobile/PWA/care-domain focused
suite, PixelLab assets `ok=149 missing=0 invalid=0`, package-local Expo web
export to `.expo-smoke` with 218 assets / 222 files after prepending bundled
Node to PATH, live preview route smoke `200` for `/`, `/more`, `/care-twin-qa`,
`/health`, `/log`, and `/portrait` at `http://127.0.0.1:4194/`, and `git diff
--check` with expected Windows CRLF warnings only. This improves QA handoff
traceability; it is still local evidence metadata, not native screenshot proof,
provider-backed storage, generated PDF output, app-store approval, or public
launch readiness.

Remote verification for More/Beta Handoff proof-manifest surfacing commit
`a2701e6` was manually dispatched as GitHub Actions run `28428161588`, but job
`84236133163` failed before execution with `steps: []`. `gh run view
--log-failed` returned `log not found: 84236133163`. Treat this as the standing
GitHub account/pre-job blocker, not as product verification evidence or a local
app regression.

The proof-manifest no-dead-end polish pass made More's saved manifest row
actionable instead of decorative. When a saved QA proof manifest exists, Native
QA Next Captures renders it as an accessible button with the current `wwqa-*`
proof ID in the label, a share icon, and `shareBetaHandoffPacket` as the action
so Apollo/testers can immediately share the handoff packet that contains the
manifest. Fresh local verification passed mobile readiness 100/100, mobile
TypeScript, root TypeScript, the 478-test API/mobile/PWA/care-domain focused
suite, PixelLab assets `ok=149 missing=0 invalid=0`, package-local Expo web
export to `.expo-smoke` with 218 assets / 222 files after prepending bundled
Node to PATH, live preview route smoke `200` for `/`, `/more`, `/care-twin-qa`,
`/health`, `/log`, and `/portrait` at `http://127.0.0.1:4194/`, and `git diff
--check` with expected Windows CRLF warnings only.

Remote verification for proof-manifest row action commit `8e7a611` was manually
dispatched as GitHub Actions run `28429093154`, but job `84239132933` failed
before execution with `steps: []`. `gh run view --log-failed` returned
`log not found: 84239132933`. Treat this as the standing GitHub account/pre-job
blocker, not as product verification evidence or a local app regression.

The Avatar Sprite Production Review pass turns the "make it feel like a video
game" requirement into a source-backed native QA target. `avatarSpriteProductionQa.ts`
now builds a production review summary from the actual Avatar Studio template
catalog and PixelLab sprite registry: 12/12 launch templates, 24 live template
sprite slots, required checks for hard-pixel crispness, single-dog rendering,
bottom-center anchor stability, idle motion, walk gait, phone crop, and overlay
fit, plus an explicit boundary that local sprite metadata is not native proof.
`mobileReleaseQa.ts` exposes that summary as the launch-critical `Avatar Sprite
Production Review` card with route-backed rows to `/portrait` and
`/care-twin-qa?qaSurface=care-twin-state-lab`; `/care-twin-qa` and More inherit
it through the existing release QA capture plan. The mobile beta doctor now
emits `avatar sprite production review is source-backed` as a PASS check while
still truthfully blocking overall beta readiness on pnpm `11.7.0` versus the
pinned `10.24.0`.

Fresh local verification for the Avatar Sprite Production Review slice passed
the red/green focused helper and release QA tests, the focused doctor/readiness
suite at 114/114, the full 480-test API/mobile/PWA/care-domain focused suite,
mobile TypeScript, root TypeScript, PixelLab assets `ok=149 missing=0 invalid=0`,
package-local Expo web export to `.expo-smoke` with 218 assets / 222 files
after prepending bundled Node to PATH, live preview route smoke `200` for `/`,
`/care-twin-qa?qaSurface=avatar-sprite-production-review`, `/portrait`, `/more`,
and `/health` at `http://127.0.0.1:4194/`, and `git diff --check` with expected
Windows CRLF warnings only. This clears only local source-backed QA cockpit and
web preview proof; it does not clear actual native iOS/Android gait/crop proof,
provider-backed storage, CI completion, store approval, payments, push, live AI,
generated PDF output, or Apollo launch sign-off.

Remote verification for Avatar Sprite Production Review commit `67f5c08` was
manually dispatched as GitHub Actions run `28464997946`, but job `84362376140`
failed before execution with GitHub's billing/spending-limit annotation:
"The job was not started because recent account payments have failed or your
spending limit needs to be increased." `gh run view --log-failed` returned
`log not found: 84362376140`. Treat this as the standing GitHub account/pre-job
blocker, not as product verification evidence or a local app regression.

The focused QA checklist polish made `/care-twin-qa?qaSurface=...` more useful
for phone-side review. Focused targets now show four setup items, a six-item
`Game-feel checklist`, and four pass criteria instead of truncating each section
to two lines. This keeps Avatar Sprite Production Review's crisp-pixel,
single-dog, gait, crop, and overlay checks visible when Apollo or a native helper
opens the focused link. Fresh local verification passed `mobileReadiness.test.ts`
100/100, mobile TypeScript, route smoke `200` for
`/care-twin-qa?qaSurface=avatar-sprite-production-review`, and `git diff --check`
with expected Windows CRLF warnings only.

Remote verification for focused QA checklist polish commit `de71616` was
manually dispatched as GitHub Actions run `28466077400`, but job `84366081750`
failed before execution with the standing GitHub billing/spending-limit
annotation, and `gh run view --log-failed` returned
`log not found: 84366081750`. Treat this as an external account/pre-job blocker,
not a local regression.

The Avatar Studio sprite-review surface pass moved the PixelLab game-feel review
into the actual creator workflow instead of leaving it only in release QA. The
selected-template helper `buildAvatarSpriteProductionTemplateReview` now derives
the chosen template's production review from the live sprite registry, and
`/portrait` renders a `Sprite production review` card below the template picker.
That card shows 12/12 live templates, 24 sprite slots, the selected body class,
idle and walk loop frame/fps/anchor notes, four game-feel checks, the
local-metadata-only native proof boundary, and an accessible `Open sprite QA
cockpit` action that routes by object to `/care-twin-qa` with
`qaSurface=avatar-sprite-production-review`. This gives Apollo, Fable, Replit,
or a native tester an exact screen-level place to review whether the avatar feels
like a video-game dog instead of a softened still portrait.

Fresh local verification for the Avatar Studio sprite-review surface passed
`avatarSpriteProductionQa.test.ts` 2/2, `mobileReadiness.test.ts` 100/100,
mobile TypeScript, root TypeScript, the 481-test API/mobile/PWA/care-domain
focused suite, PixelLab assets `ok=149 missing=0 invalid=0`, package-local Expo
web export to `.expo-smoke` with 218 assets / 222 files after prepending bundled
Node and pnpm to PATH, live preview route smoke `200` for `/`, `/portrait`, and
`/care-twin-qa?qaSurface=avatar-sprite-production-review` at
`http://127.0.0.1:4194/`, and `git diff --check` with expected Windows CRLF
warnings only. The JSON mobile beta doctor still reports `BLOCKED` only because
the local bundled pnpm is `11.7.0` while the repo is pinned to `10.24.0`; its
release proof, avatar sprite production review, and truth-boundary checks pass.
This does not clear actual native iOS/Android gait/crop proof, provider-backed
storage, CI completion, store approval, payments, push, live AI, generated PDF
output, or Apollo launch sign-off.

Remote verification for Avatar Studio sprite-review surface commit `3c2778b`
was manually dispatched as GitHub Actions run `28468154370`, but job
`84373284710` failed before execution with `steps: []`. `gh run view
--log-failed` returned `log not found: 84373284710`. Treat this as the standing
GitHub billing/spending-limit pre-job blocker, not product verification evidence
or a local app regression.

The production auth entry is now a board-accurate CareTwin gateway instead of a
generic sign-in form. `AuthShell` renders the WoofWatcher mark, active PixelLab
day room, hard-pixel Phoenix avatar, `Real care. Pixel heart.` speech, current
provider/local-preview status, and trust tiles for Provider account,
Local-first care, and CareTwin readiness. Sign-in and sign-up copy no longer
claims shared sync is complete; it says the account layer is ready while care
data stays local-first until production sync providers are configured. Primary
and Google auth actions also expose explicit button roles and labels.

Fresh local verification for the auth gateway polish passed
`mobileReadiness.test.ts` 101/101, mobile TypeScript, root TypeScript, the
482-test API/mobile/PWA/care-domain focused suite, PixelLab assets
`ok=149 missing=0 invalid=0`, package-local Expo web export to `.expo-smoke`
with 218 assets / 222 files after prepending bundled Node and pnpm to PATH,
live preview route smoke `200` for `/`, `/sign-in`, `/setup`, and `/portrait`
at `http://127.0.0.1:4194/`, and `git diff --check` with expected Windows CRLF
warnings only. The JSON mobile beta doctor still reports `BLOCKED` only because
the local bundled pnpm is `11.7.0` while the repo is pinned to `10.24.0`; its
source-backed launch, proof, avatar sprite, Care Pass storage, and truth
boundary checks pass. This does not clear production provider-backed account
sync, native iOS/Android auth/setup proof, generated PDF output, payments, push,
live AI, app-store approval, or Apollo launch sign-off.

Remote verification for auth gateway polish commit `6a0319b` was manually
dispatched as GitHub Actions run `28470515203`, but job `84381589343` failed
before execution with `steps: []`. `gh run view --log-failed` returned
`log not found: 84381589343`. Treat this as the standing GitHub billing or
runner pre-job blocker, not product verification evidence or a local app
regression.

The return-aware QA target route pass removed a handoff trap in the native QA
flow. `mobileLaunchQaEvidence.ts` now builds a shared
`buildMobileLaunchQaReturnRoute` and every `MobileLaunchQaCaptureTarget` carries
`qaReturnRoute`. Focused target shares, the full native capture plan, store
screenshot proof, and Needs tune fix briefs now include `Open with QA return`
routes, while `/care-twin-qa` uses the same helper for its open-target buttons.
This means Apollo, Fable/Replit, or a device tester can open a target with the
QA return banner already armed, capture proof, and return to the exact mission
card instead of manually hunting back through the app.

Fresh local verification for the return-aware QA target route pass passed
`mobileLaunchQaEvidence.test.ts` 20/20, `mobileReadiness.test.ts` 101/101, the
483-test API/mobile/PWA/care-domain focused suite, root TypeScript, mobile
TypeScript, PixelLab assets `ok=149 missing=0 invalid=0`, package-local Expo web
export to `.expo-smoke` with 218 assets / 222 files after prepending bundled
Node and pnpm to PATH, live preview route smoke `200` for `/`,
`/care-twin-qa?qaSurface=store-health-watch`, the return-aware
`/health?qaReturn=care-twin-qa&qaSurface=store-health-watch&qaTitle=Store%3A%20Health%20Watch`,
and `/portrait` at `http://127.0.0.1:4194/`, and `git diff --check` with
expected Windows CRLF warnings only. The JSON mobile beta doctor still reports
`BLOCKED` only because the local bundled pnpm is `11.7.0` while the repo is
pinned to `10.24.0`; its source-backed launch, proof, avatar sprite, Care Pass
storage, and truth-boundary checks pass. This does not clear actual native
iOS/Android proof, provider-backed sync/storage/AI/payments/push, generated PDF
output, CI completion, app-store approval, or Apollo launch sign-off.

Remote verification for return-aware QA target routes commit `4a39d99` was
manually dispatched as GitHub Actions run `28473097266`, but job `84390646083`
failed before executing any steps with `steps: []`. `gh run view --log-failed`
returned `log not found: 84390646083`. Treat this as the standing GitHub
billing or runner pre-job blocker, not product verification evidence or a local
app regression.

The care-entry provider sync proof packet pass makes the Supabase handoff
specific enough to execute without pretending provider work is complete.
`careEntryProviderSyncProof.ts` models six proof items: Supabase project,
migration/backfill for `care_entries.updated_at` and `care_entry_tombstones`,
active-household RLS for `/care-entries?updatedSince=` and
`/care-entries/tombstones?updatedSince=`, retention/export/deletion policy,
dependency-complete build proof, and mobile incremental sign-off. Provider
Launch Setup, More, and Share Beta Handoff now carry that checklist, while
mobile care-entry sync remains on full refresh until every proof artifact plus
native QA evidence exists. Fresh local verification passed focused
provider/readiness tests `123/123`, the API/mobile/PWA/care-domain suite
`514/514`, mobile TypeScript, `pnpm run typecheck:libs`, API TypeScript, and
Expo web export to `.expo-smoke` with 219 assets / 223 files. The JSON mobile
beta doctor remains blocked only on local pnpm `11.7.0` versus pinned
`10.24.0`, with Corepack absent from PATH.

The Release Smoke Checklist handoff pass turns the beta packet into a single
rehearsal script without pretending blocked launch gates are clear.
`mobileReleaseSmokeChecklist.ts` covers dependency/export proof commands, route
rehearsal, Records local-file export truth for `WoofWatcherReports` and
`WoofWatcherCredentials`, provider proof gates, native/store proof, and launch
truth boundaries. Share Beta Handoff now embeds that checklist, and the JSON
mobile beta doctor verifies both `release smoke checklist is source-backed` and
the `Release smoke checklist` handoff section. Fresh local verification passed
focused smoke/beta/readiness tests `116/116`, the API/mobile/PWA/care-domain
suite `515/515`, mobile TypeScript, `pnpm run typecheck:libs`, API TypeScript,
`git diff --check`, Expo web export to `.expo-smoke` with 219 assets / 223
files, and static preview route smoke `200` for `/`, `/more`, `/care-twin-qa`,
`/records`, and `/woofguide`. The JSON mobile beta doctor remains blocked only
on local pnpm `11.7.0` versus pinned `10.24.0`, with Corepack absent from PATH.
This clears a source-backed checklist gap; it does not clear actual native
iOS/Android proof, provider approvals, generated PDF/image export, store
approval, public launch, or Apollo sign-off.

The Records local-file handoff proof pass turns the current Records blocker
into a focused native QA mission without pretending device evidence exists.
`mobileReleaseQa.ts` now adds `records-local-file-handoff` immediately after the
owner-preview loop, and Share Beta Handoff, the Release Smoke Checklist, and the
JSON mobile beta doctor all point helpers to
`/care-twin-qa?qaSurface=records-local-file-handoff`. The mission requires Care
Pass Report History local HTML proof in `WoofWatcherReports`, Dog ID local HTML
and SVG image-source proof in `WoofWatcherCredentials`, native share-sheet
behavior, Android content URI or saved-file proof, fallback copy, and explicit
`generated PDF/PNG proof remains separate` language. This is a source-backed
proof path for HTML/SVG files; real iOS/Android screenshots/share-dialog
evidence still must be attached before the handoff is device-verified.

The focused Records local-file handoff proof manifest pass makes that same
native file-proof mission explicit before Evidence Capture. The route
`/care-twin-qa?qaSurface=records-local-file-handoff` now shows Care Pass Report
History local HTML, Dog ID local HTML credential, Dog ID SVG image source,
native share-sheet behavior, Android content URI or saved-file proof, fallback
copy, and generated PDF/PNG/provider boundary rows with blockers and
`Native file proof allowed: No`. The JSON mobile beta doctor reports `records
local file handoff proof manifest is source-backed`, but this is visibility
only; it does not prove native iOS or Android share sheets, Android content URI
handoff, generated PDF/PNG readiness, provider-backed storage, cloud sync,
public launch, or Apollo sign-off.
Branch CI later proved the manifest on commit `8268809` in `WoofWatcher Verify`
run `28691115501`, job `85092467507`, which completed successfully in `3m1s`
with Setup pnpm, Setup Node, install, JSON mobile beta doctor, focused behavior
tests, and Typecheck plus CI-safe builds all passing.

The report binary export proof packet pass keeps the next export boundary
truthful before anyone claims native/provider readiness. `reportBinaryExportProof.ts`
now names the required proof for local Care Pass PDF and Dog ID PNG artifact
bytes, provider storage handoff, native share/reopen behavior, and iOS/Android
generated-file artifact proof. Provider Launch Setup's Records/media storage row
carries that packet in its proof checklist, while the Release Smoke Checklist
and JSON mobile beta doctor guard that the packet remains source-backed. Fresh verification
passed the focused report/provider/smoke/readiness tests `120/120`, the broader
API/mobile/PWA/care-domain suite `520/520`, mobile TypeScript, and `tsc
--build`; the JSON doctor still blocks only on local pnpm `11.7.0` versus pinned
`10.24.0`. This is not PDF/PNG implementation and does not approve provider
storage or native artifact proof.

The focused binary export proof target pass turns that packet into an executable
native QA mission. `mobileReleaseQa.ts` now registers
`report-binary-export-proof` at `/care-twin-qa?qaSurface=report-binary-export-proof`
after the Records local-file handoff target and before broad route visual
screenshots. Share Beta Handoff, the Release Smoke Checklist, and the JSON
mobile beta doctor all point helpers to the same mission for approved PDF
generator, approved PNG renderer, generated file name/size/MIME/share proof,
provider storage policy, and iOS/Android artifact evidence. Fresh verification
passed focused mobile release/beta/smoke/readiness tests `133/133`, the broader
API/mobile/PWA/care-domain suite `521/521`, mobile TypeScript, and `tsc
--build`; the JSON doctor still blocks only on local pnpm `11.7.0` versus pinned
`10.24.0`.

The focused Report Binary Export Proof manifest pass makes that native/provider
artifact gate visible on the helper route itself. `/care-twin-qa?qaSurface=report-binary-export-proof`
now renders the existing `Report binary export proof manifest` with Care Pass
PDF, Dog ID PNG, Provider storage, and Native artifact proof rows, ready/open
counts, `Generated artifacts allowed: No`, blockers, and the boundary that
native iOS/Android share/reopen behavior, PDF/PNG renderer approval, provider
storage, app-store review, public launch, and Apollo sign-off remain blocked.
The JSON mobile beta doctor now guards `report binary export proof manifest is
source-backed`. Local verification first failed on the missing route manifest
and missing JSON doctor guard, then passed focused care-twin/doctor readiness
`114/114`, the full zero-dependency API/mobile/PWA/care-domain suite `559/559`,
root TypeScript, mobile TypeScript, and `git diff --check` with expected Windows
CRLF warnings only. The direct mobile beta doctor still blocks only on local
pnpm `11.7.0` versus pinned `10.24.0`, and native QA tooling remains blocked in
this Windows shell because `adb`, `emulator`, `java`, Android SDK env vars, and
`JAVA_HOME` are missing.
Branch CI proved the implementation commit `822ff54` in `WoofWatcher Verify`
run `28691498890`, job `85093511875`, which completed successfully in `3m21s`
with Set up job, Checkout, Setup pnpm, Setup Node, install dependencies, JSON
mobile beta doctor, focused behavior tests, Typecheck plus CI-safe builds, post
steps, and Complete job all passing.

The Records binary proof manifest pass brings that packet back into the product
surface. Each saved Care Pass in Report History now shows a `Binary proof
manifest` with Care Pass PDF, Dog ID PNG, Provider storage, and Native artifact
proof rows built from the local Care Pass HTML source and Dog ID SVG source.
The JSON mobile beta doctor now guards `records binary export proof manifest is
source-backed`, so generated PDF/PNG readiness stays blocked until the manifest
has real file name, file size, MIME, share/reopen, provider storage, and
iOS/Android evidence instead of HTML/SVG-only source proof.

The generated binary artifact pass moves the Records route from manifest-only
proof into real local artifact bytes. `reportGeneratedBinaryArtifact.ts` now
builds base64 Care Pass PDF bytes and Dog ID PNG bytes with file name, MIME type,
byte size, and local-file share plans; Records exposes generated PDF actions for
Report History and a generated PNG action for Dog ID while feeding those
metadata rows into the binary proof manifest. The JSON mobile beta doctor now
guards `generated binary artifact exports are source-backed`. This closes only
the local generator/source gap; native iOS/Android share-reopen proof, provider
storage, retention/export/deletion policy, and Apollo sign-off remain launch
blockers.

The Route Visual Consistency handoff target pass makes the existing route-by-route
native screenshot mission explicit in every beta helper surface. Share Beta
Handoff, the Release Smoke Checklist, and the JSON mobile beta doctor now point
helpers to `/care-twin-qa?qaSurface=route-visual-consistency`, name Home, Log,
Plans, Health, Records, and More, require both iOS and Android proof, and state
that web preview screenshots do not replace native route proof. Fresh local
verification passed focused beta/smoke/readiness tests `117/117`, the broader
API/mobile/PWA/care-domain suite `521/521`, mobile TypeScript, `tsc --build`,
and JSON doctor source-backed checks including `route visual proof target is
source-backed`, plus `git diff --check` with expected Windows CRLF warnings only;
the doctor still blocks only on local pnpm `11.7.0` versus pinned `10.24.0`.
This is a handoff and guardrail slice, not actual native screenshot
evidence, provider approval, store approval, public launch, or Apollo sign-off.

The Route Visual proof manifest pass makes that handoff harder to overclaim.
`buildRouteVisualProofManifest` derives the six route rows from the existing
Route Visual Consistency QA surface, counts attached iOS and Android screenshot
slots, requires the QA note, and keeps a web-preview-only boundary visible.
The focused `/care-twin-qa?qaSurface=route-visual-consistency` route now renders
the manifest, blockers, per-route iOS/Android slot status, and the boundary
before visual proof can be marked complete. The JSON mobile beta doctor reports
`route visual proof manifest is source-backed`; this still does not create
native screenshots, approve route visuals, or replace Apollo sign-off.

The Route Visual route-named proof hardening pass closes a remaining overclaim
hole in that manifest. Attached iOS and Android screenshot counts are still
shown for helper context, but a Home, Log, Plans, Health, Records, or More row
now becomes ready only when the saved evidence file name or URI contains that
route label for the matching platform. A red test first showed six generic iOS
and six generic Android screenshots incorrectly marking the manifest ready; the
green pass now keeps generic `native-ios-*` and `native-android-*` attachments
blocked with route-specific missing-proof rows. Fresh local verification passed
focused Route Visual tests `26/26`, focused care-twin route and machine-readable
doctor readiness `114/114`, the full zero-dependency API/mobile/PWA/care-domain
suite `560/560`, root TypeScript, mobile TypeScript, and `git diff --check`
with expected Windows CRLF warnings only. Direct JSON mobile beta doctor
source-backed checks pass, including `route visual proof manifest is
source-backed`, while the doctor still blocks only on local pnpm `11.7.0` versus
pinned `10.24.0` and Corepack missing from PATH; direct native QA tooling doctor
still blocks because this Windows shell lacks Android `adb`, Android `emulator`,
Java, `ANDROID_HOME`/`ANDROID_SDK_ROOT`, and `JAVA_HOME`. This is route-proof
truth hardening only, not native screenshot evidence, visual approval, provider
approval, store approval, public launch, or Apollo sign-off.
Remote verification passed for implementation commit `f273d3e` in `WoofWatcher
Verify` run `28691984899`, job `85094842263`, with Setup pnpm, Setup Node,
install dependencies, JSON mobile beta doctor, focused behavior tests, Typecheck
plus CI-safe builds, post steps, and Complete job all green.

The Route Visual route-named capture-instructions pass makes that stricter gate
actionable for a helper with devices. Share Beta Handoff, the Release Smoke
Checklist, the Route Visual QA mission model, the mobile beta doctor, the native
QA tooling doctor, `docs/release/TWO_DAY_BETA_SHIP_PLAN.md`, and
`docs/release/CARE_TWIN_NATIVE_QA_MATRIX.md` now tell testers to save or rename
each Route Visual attachment with route label plus platform before attaching it,
using examples from `Home-iOS` / `Home-Android` through `More-iOS` /
`More-Android`. Fresh local verification first failed on missing handoff wording
and a missing JSON doctor route-named next action, then passed focused
handoff/smoke/Route Visual/readiness tests `144/144`, focused doctor readiness
`114/114`, the full zero-dependency API/mobile/PWA/care-domain suite `560/560`,
root TypeScript, mobile TypeScript, and `git diff --check` with expected Windows
CRLF warnings only. Direct JSON mobile beta doctor source-backed checks pass
while still blocking only on local pnpm `11.7.0` versus pinned `10.24.0` and
Corepack missing from PATH; direct native QA tooling doctor now carries the
route-named next action but still blocks because this Windows shell lacks
Android `adb`, Android `emulator`, Java, `ANDROID_HOME`/`ANDROID_SDK_ROOT`, and
`JAVA_HOME`. This is capture guidance and guard coverage only, not actual native
screenshots or visual approval.
Remote verification then passed for implementation commit `fd3a98f` in
GitHub Actions `WoofWatcher Verify` run `28692423522`, job `85096033279`.
The run completed successfully in about `3m06s`; Set up job, Checkout,
Setup pnpm, Setup Node, install dependencies, JSON mobile beta doctor, focused
behavior tests, Typecheck plus CI-safe builds, post steps, and Complete job all
passed. This proves the route-named capture instructions and source guards, not
native screenshot capture or human visual approval.

The Live Preview Handoff proof pass turns the dependency-complete preview handoff
into a first-class section instead of a hidden command. The Release Smoke
Checklist now lists `Live preview handoff proof` immediately after dependency
and export proof, requiring branch CI, JSON doctor/export/runtime evidence,
`proof:live-preview` JSON route proof, `preview:smoke` output, the
`http://127.0.0.1:4194/` URL, a browser-open note, and the explicit boundary
that live preview proof does not replace native
iOS/Android proof. Share Beta Handoff inherits that section, and the JSON mobile
beta doctor now verifies `live preview handoff proof is source-backed`, verifies
`live preview handoff verifier is source-backed`, and lists `Live preview
handoff proof` in its handoff sections. Fresh local verification
passed focused beta/smoke/readiness tests `117/117`, the broader
API/mobile/PWA/care-domain suite `521/521`, mobile TypeScript, and `tsc
--build`, plus `git diff --check` with expected Windows CRLF warnings only; the
doctor still blocks only on local pnpm `11.7.0` versus pinned `10.24.0`. This is
live web-preview handoff proof only, not native device proof,
provider approval, store approval, public launch, or Apollo sign-off.

The live preview handoff verifier pass adds machine-readable preview evidence
without pretending browser proof is native proof. `scripts/live-preview-handoff-proof.js`
starts the same static `.expo-smoke` server on a disposable local port, verifies
Home, Log, Calendar, Health, Records, More, Records local-file handoff, Report
Binary Export Proof, Care-entry Provider Sync Proof, and Route Visual
Consistency return the Expo web shell, and emits JSON/text proof with commit,
export index timestamp, route checks, and
web-preview-only truth boundaries. The mobile package exposes
`proof:live-preview`, root `build:ci` runs it after `smoke:web` and
`smoke:runtime`, the Release Smoke Checklist and JSON doctor include it before
foreground `preview:smoke`, and the doctor verifies `live preview handoff
verifier is source-backed`. Fresh local verification passed focused
live-preview/smoke/beta/readiness tests `119/119`, the broader
API/mobile/PWA/care-domain suite `523/523`, mobile TypeScript, `tsc --build`,
direct runtime smoke with `11/11` exported routes passing, direct
`live-preview-handoff-proof.js --json` with `10/10` preview routes against the
existing `.expo-smoke` export, JSON mobile beta doctor source-backed checks, and
`git diff --check` with expected Windows CRLF warnings only. Direct JSON doctor
still blocks only on local pnpm `11.7.0` versus pinned `10.24.0`, with Corepack
not on PATH. This is web preview route proof only, not native device proof,
provider approval, store approval, public launch, or Apollo sign-off.

The recorded live-preview proof attachment pass puts recorded local
`proof:live-preview` JSON evidence directly into Share Beta Handoff. The packet
now prints a `Recorded live preview proof` section with the `10/10` route result,
the recorded disposable verifier URL, the foreground `http://127.0.0.1:4194/`
`preview:smoke` URL, export index mtime, route statuses, and rerun-after-new
commit/export boundary. More passes that proof into the one-tap packet, and the
JSON mobile beta doctor verifies `recorded live preview proof attachment is
source-backed`. Fresh local verification passed the red/green beta handoff and
readiness tests `116/116`, the broader API/mobile/PWA/care-domain suite
`523/523`, mobile TypeScript, `tsc --build`, Expo web export with 219 assets /
223 files, runtime smoke for 11 routes, direct live preview proof for 10 routes,
and `git diff --check` with expected Windows CRLF warnings only. Direct JSON
doctor still blocks only on local pnpm `11.7.0` versus pinned `10.24.0`, with
Corepack not on PATH. This is recorded web-preview proof only, not native device
proof, provider approval, store approval, public launch, or Apollo sign-off.

The care-entry provider sync proof target pass gives the existing Supabase
provider proof packet a focused launch-critical QA route. `/care-twin-qa?qaSurface=care-entry-provider-sync-proof`
now directs Apollo/Replit/native helpers through Provider Launch Setup's
Household database sync gate, requiring Supabase project id, migration/backfill
for `care_entries.updated_at` and `care_entry_tombstones`, active-household RLS
for `/care-entries?updatedSince=` and `/care-entries/tombstones?updatedSince=`,
backup plus retention/export/deletion policy, dependency-complete build proof,
and mobile full-refresh sign-off before incremental care-entry sync can be
enabled. Share Beta Handoff, the Release Smoke Checklist, the live-preview
verifier, the recorded live-preview proof, and the JSON mobile beta doctor all
name that focused target, and the doctor verifies `care-entry provider sync
proof target is source-backed`. Fresh local verification passed the red/green
focused tests `136/136`, the broader API/mobile/PWA/care-domain suite
`524/524`, mobile TypeScript, `tsc --build`, Expo web export with 219 assets /
223 files, runtime smoke for 11 routes, direct live preview proof for 10 routes,
JSON mobile beta doctor source-backed checks, and `git diff --check` with
expected Windows CRLF warnings only. Direct JSON doctor still
blocks only on local pnpm `11.7.0` versus pinned `10.24.0`, with Corepack not
on PATH. This is a provider-proof handoff route and web-preview proof only; it
does not execute the Supabase migration, approve RLS, enable incremental sync,
clear native iOS/Android proof, approve storage/AI/payments/push, approve store
submission, or replace Apollo sign-off.

The recorded CI proof freshness pass keeps Share Beta Handoff from treating a
historical branch run as current proof after later commits. The recorded proof
now points to `WoofWatcher Verify` run `28685693291`, job `85077855560`, commit
`0f60c22`, and the packet labels it `Recorded branch CI proof` while requiring a
fresh workflow rerun after any new commit before dependency proof can be treated
as current. This refresh records the branch CI that passed after the Route Visual
proof manifest landed, including pinned pnpm 10.24.0, the JSON mobile beta
doctor with auth/setup smoke proof, auth/setup native QA target coverage, auth
provider proof packet coverage, provider staged-row truth coverage, support/legal
readiness proof coverage, Premium payments proof manifest coverage, Auth/Setup
proof manifest coverage, Route Visual proof manifest coverage, focused behavior
tests, and `build:ci` with `smoke:web`, `smoke:runtime`, and
`proof:live-preview`. The recorded live preview proof now carries a local
`proof:live-preview` run generated `2026-07-03T22:21:21.304Z` on commit
`0f60c22` from `http://127.0.0.1:60160/`, with `19/19` web-preview route shell
checks and the web-preview-only boundary still explicit. Fresh refresh
verification covered the
stale beta-handoff/doctor assertions for the old recorded run, then passed
focused beta handoff plus mobile readiness tests. Direct JSON doctor still
blocks only on local pnpm `11.7.0` versus pinned `10.24.0`, with Corepack not on
PATH. This is dependency-proof freshness guardrail work only, not native device
proof, provider approval, store approval, public launch, or Apollo sign-off.

The mobile runtime route smoke pass makes the export proof more execution-like
without overclaiming native QA. `scripts/smoke-runtime-preview.js` starts a
disposable static server over `.expo-smoke`, verifies Home, Log, Plans, Health,
Records, More, Care Twin QA, WoofGuide, Premium, Privacy, and Avatar Studio
return the Expo web shell, then closes the server. The mobile package exposes
`smoke:runtime`, root `build:ci` runs it immediately after `smoke:web`, and the
Release Smoke Checklist plus JSON doctor list it before preview handoff. Fresh
local verification passed focused smoke/beta/readiness tests `117/117`, the
API/mobile/PWA/care-domain suite `516/516`, mobile TypeScript,
`pnpm run typecheck:libs`, API TypeScript, Expo web export to `.expo-smoke`
with 219 assets / 223 files, and direct runtime smoke for all 11 routes. The
JSON mobile beta doctor source-backed checks pass but remain `BLOCKED` only
because local pnpm is `11.7.0` versus pinned `10.24.0`. This is exported
web-runtime proof, not native simulator/device proof, provider approval,
generated PDF/image export, store approval, public launch, or Apollo sign-off.

The CI mobile beta doctor pass moves the exact pnpm 10.24 dependency/export
doctor into branch verification. `.github/workflows/verify.yml` now runs
`pnpm run doctor:mobile-beta:json` immediately after frozen dependency install,
before focused tests and `build:ci`. A red/green readiness check first failed
because the workflow did not include the JSON doctor command, then passed after
the step was added. Direct local JSON doctor output still remains `BLOCKED`
only because this Windows shell exposes pnpm `11.7.0` while the repo pins
`10.24.0`; the branch runner is the dependency-complete authority for that
doctor gate. This is dependency/export proof only, not native screenshots,
provider setup, generated PDF/image export, store approval, public launch, or
Apollo sign-off.

The native QA tooling doctor pass makes the local native-proof blocker explicit
instead of burying it in chat. Root now exposes `pnpm run doctor:native-qa` and
`pnpm run doctor:native-qa:json`, which check `adb`, `emulator`, `java`,
`ANDROID_HOME` or `ANDROID_SDK_ROOT`, `JAVA_HOME`, Expo native target config,
focused `/care-twin-qa` proof targets, the native QA matrix, and the
web-preview-only boundary. In this Windows shell the JSON doctor truthfully
reports `BLOCKED` because Android SDK/Java tooling is absent; it still confirms
the native QA cockpit and matrix are source-backed. The mobile beta doctor now
checks that the native tooling doctor command is wired and tells helpers to run
it before attempting iOS or Android proof, while beta export remains separate
from native QA.

The auth/setup runtime smoke proof pass extends dependency-complete web-runtime
proof to the account gateway and first-run setup route without claiming provider
sync. `smoke:runtime` now lists 13 exported routes, including `/sign-in` and
`/setup`, while `proof:live-preview` lists 13 launch-critical preview routes with
the same auth/onboarding front doors plus the focused auth/setup native QA
target. The Release Smoke Checklist now includes
an `Auth and setup route smoke` row, and the JSON mobile beta doctor reports
`auth/setup runtime smoke proof is source-backed` only when `smoke:runtime`,
`proof:live-preview`, and the checklist all carry `/sign-in` plus `/setup`.
Fresh red/green local verification first failed on the missing live-preview
routes and doctor check, then passed focused live-preview/readiness tests
`116/116`, direct runtime route-list proof for 13 routes, and direct JSON mobile
beta doctor source-backed checks. Direct JSON doctor still blocks only on local
pnpm `11.7.0` versus pinned `10.24.0`, with Corepack not on PATH. This is
web-runtime onboarding proof only, not provider-backed auth, household creation,
native iOS/Android proof, store approval, public launch, or Apollo sign-off.

The auth/setup native QA target pass adds a focused launch-critical mission at
`/care-twin-qa?qaSurface=auth-setup-onboarding-proof`. Share Beta Handoff, the
Release Smoke Checklist, the live-preview route verifier, the native tooling
doctor, and the JSON mobile beta doctor now all point helpers to capture the
Auth gateway and Setup local-preview path on iOS and Android while keeping
provider-backed auth, household creation, invite delivery, and cross-device sync
blocked until real provider proof exists. This is device-capture routing and
truth-boundary copy only, not native proof, provider approval, store approval,
public launch, or Apollo sign-off.

The focused Auth/Setup proof manifest route pass puts the same provider/native
proof rows directly on that helper mission before Evidence Capture. The route now
shows Clerk, redirect/deep-link, native Auth screenshot, Setup local-preview,
household sync, and launch-gate rows with blockers and `Native proof allowed: No`;
the JSON mobile beta doctor checks the focused route before reporting
`auth/setup proof manifest is source-backed` as `PASS`. This is visibility and
handoff proof only; it does not configure Clerk, approve OAuth, prove native
iOS/Android screenshots, enable provider-backed household creation, sync invites,
clear store approval, launch publicly, or replace Apollo sign-off.

The care-entry provider sync proof manifest pass makes the focused database
mission explicit instead of relying on a generic checklist. The route
`/care-twin-qa?qaSurface=care-entry-provider-sync-proof` now shows the
Care-entry provider sync proof manifest with Supabase project, migration/backfill,
active-household RLS, retention/export/deletion, dependency-complete build, and
mobile sign-off rows, plus blockers and `Incremental sync allowed: No` until
real provider proof and native QA are attached. The JSON mobile beta doctor now
reports `care-entry provider sync proof manifest is source-backed` as `PASS`,
but this is visibility only; it does not run migrations, approve RLS, enable
incremental sync, or replace Apollo sign-off.

The WoofGuide AI provider proof manifest pass makes the focused AI mission
explicit instead of leaving helpers with a generic OpenAI checklist. The route
`/care-twin-qa?qaSurface=woofguide-ai-provider-proof` now shows the WoofGuide AI
provider proof manifest with OpenAI key storage, approved model policy,
source/citation rules, owner-review write gate, veterinary safety, and
fallback/incident rows, plus blockers and `Live AI allowed: No` until real
provider proof and safety approval are attached. The JSON mobile beta doctor now
reports `woofguide ai provider proof manifest is source-backed` as `PASS`, but
this is visibility only; it does not configure OpenAI, approve a model, allow
automatic writes, enable live AI, clear veterinary safety review, or replace
Apollo sign-off.

The Push Notifications provider proof manifest pass makes the focused reminder
delivery mission explicit instead of leaving helpers with a generic push
checklist. The route `/care-twin-qa?qaSurface=push-notifications-proof` now
shows the Push notifications proof manifest with Expo push project config, APNs
credentials, Firebase/FCM credentials, permission prompt/preference copy,
quiet-hours/opt-out behavior, and delivery QA rows, plus blockers and
`Reminder delivery allowed: No` until real provider proof and iOS/Android
delivery evidence are attached. The JSON mobile beta doctor now reports
`push notifications proof manifest is source-backed` as `PASS`, but this is
visibility only; it does not configure Expo/APNs/FCM, deliver notifications,
approve prompt/legal copy, enable reminders, or replace Apollo sign-off.

The Store Accounts proof manifest pass makes the focused app-submission mission
explicit instead of leaving helpers with a generic Apple/Google checklist. The
route `/care-twin-qa?qaSurface=store-accounts-proof` now shows the Store
accounts proof manifest with Apple Developer/App Store Connect access, Google
Play package record, bundle/signing ownership, reviewer access/test credentials,
screenshots/metadata ownership, privacy-label readiness, and release role
approval rows, plus blockers and `App submission allowed: No` until real
Apple/Google account and approval proof are attached. The JSON mobile beta
doctor now reports `store accounts proof manifest is source-backed` as `PASS`,
but this is visibility only; it does not create store accounts, approve
metadata/screenshots, submit to App Review or Play review, clear legal/privacy
approval, enable public launch, or replace Apollo sign-off.

The Account Deletion proof manifest pass makes the focused destructive-deletion
compliance mission explicit instead of leaving helpers with a generic deletion
packet. The route `/care-twin-qa?qaSurface=account-deletion-proof` now shows the
Account deletion proof manifest with deletion route/auth, export-before-delete,
data/object deletion receipt, audit/support receipt, recovery/cancellation, and
legal/store approval rows, plus blockers and `Destructive deletion allowed: No`
until real provider, legal, store, and Apollo approval proof are attached. The
JSON mobile beta doctor now reports `account deletion proof manifest is
source-backed` as `PASS`, but this is visibility only; it does not enable
destructive deletion, delete provider data or storage objects, approve
privacy/legal language, satisfy App Store or Play Store review, or replace
Apollo sign-off.

The Support Legal Readiness proof manifest pass makes the focused public-launch
approval mission explicit instead of leaving helpers with a generic support/legal
capture target. The route
`/care-twin-qa?qaSurface=support-legal-readiness-proof` now shows the Support
legal readiness proof manifest with support inbox, privacy policy and terms
links, refund/subscription policy, veterinary and emergency boundary, deletion
escalation, incident response owner, and Apollo approval rows, plus blockers and
`Public launch allowed: No` until real support/legal, store-review, and Apollo
approval proof are attached. The JSON mobile beta doctor now reports `support
legal readiness proof manifest is source-backed` as `PASS`, but this is
visibility only; it does not approve legal/privacy copy, refund policy, support
operations, veterinary-boundary language, App Store or Play Store review, public
launch, or Apollo sign-off.
Branch CI later proved the manifest on commit `0489972` in `WoofWatcher Verify`
run `28689927419`, job `85089300582`, which completed successfully in about
`3m0s` with Setup pnpm, Setup Node, install, JSON mobile beta doctor, focused
behavior tests, and Typecheck plus CI-safe builds all passing.

Next highest-impact work:

1. After each new commit, rerun branch CI before treating dependency proof as current. Then use branch CI as the dependency-complete proof for `pnpm run doctor:mobile-beta:json`, focused tests, `smoke:web`, `smoke:runtime`, and `proof:live-preview`, including `/sign-in` and `/setup`; run `pnpm --filter @workspace/woofwatcher-mobile run preview:smoke` from Replit, Git Bash/WSL with pnpm 10.24.0 installed or Corepack-enabled, or a native helper environment when Apollo needs a foreground live preview handoff. Attach the JSON doctor/export/runtime/live-preview/preview proof to Share Beta Handoff's `Live preview handoff proof` section without claiming native QA or provider-backed auth.
2. Run `pnpm run doctor:native-qa:json` before attempting native proof. If it reports missing `adb`, `emulator`, `java`, `ANDROID_HOME` or `ANDROID_SDK_ROOT`, or `JAVA_HOME`, move native capture to a configured Mac, Android Studio machine, physical device, TestFlight build, or helper environment instead of claiming local native QA. Then run native iOS/Android simulator or device QA with More's focused `/care-twin-qa?qaSurface=...` links and `docs/release/CARE_TWIN_NATIVE_QA_MATRIX.md`, starting with More's `Next launch gate` or `Native QA Next Captures > Primary mission`. For the `Owner Preview Core Loop`, read the in-card `Owner route loop`, complete Home, Log, Plans, Health, More, Adventure, Records, Avatar Studio, and Care Pass without dead ends, attach iOS Quick Log/Log proof and Android Launch Readiness proof through the focused card or 48-hour mission card, write the required note, confirm `Pass pending proof` clears only after required proof is saved in both `/care-twin-qa` and More's Native QA Next Captures, use More's `Share Beta Handoff` action after saved proof is current, then continue the Records local-file handoff, Report Binary Export Proof, Route Visual Consistency, Store Screenshot QA checklist, and 12-state care-twin matrix. Confirm More's Launch Readiness updates from the saved proof, share/export the QA report, mark the first visible stage/sprite/Incident Watch/safe-area/composer/setup/modal/touch issue as Needs tune, use More's `Share Fix Brief`, and fix that first route before moving on.
3. Fill the Provider Launch Setup sheet only as real providers are configured: Clerk, Supabase/Postgres, storage buckets/rules, AI key/model policy, app-store payments, push, Apple/Google accounts, and self-serve deletion. Use the production auth provider proof packet for Clerk production app id, redirect/deep-link URLs, OAuth sign-in proof, session/token policy, and household membership evidence; use the care-entry provider sync proof manifest on `/care-twin-qa?qaSurface=care-entry-provider-sync-proof` for Supabase migration/backfill, active-household RLS, retention/export/deletion, dependency-complete build, and mobile incremental sign-off evidence; use the WoofGuide AI provider proof manifest on `/care-twin-qa?qaSurface=woofguide-ai-provider-proof` for OpenAI key storage, approved model policy, source/citation rules, owner-review write gate, veterinary safety, and fallback/incident evidence before claiming live AI readiness; use the Push notifications proof manifest on `/care-twin-qa?qaSurface=push-notifications-proof` for Expo push project config, APNs credentials, Firebase/FCM credentials, permission prompt/preference copy, quiet-hours/opt-out behavior, and delivery QA before claiming reminder delivery; use the Payments provider proof manifest on `/care-twin-qa?qaSurface=payments-provider-proof` for Plus and Family product ids, billing path decision, sandbox purchase/renewal/cancel/refund/expired receipt proof, restore purchases, entitlement mapping, refund/support, and checkout-gate proof before claiming paid checkout readiness; use the Store accounts proof manifest on `/care-twin-qa?qaSurface=store-accounts-proof` for Apple Developer/App Store Connect access, Google Play package record, bundle/signing ownership, reviewer access/test credentials, screenshots/metadata/privacy-label approval, and release role approval before claiming App Review or Play review readiness; use the Account deletion proof manifest on `/care-twin-qa?qaSurface=account-deletion-proof` for deletion route/auth, export-before-delete handoff, data/object deletion receipt, audit/support receipt, recovery/cancellation policy, legal/store approval, and Apollo approval before claiming destructive deletion readiness; use the Support legal readiness proof manifest on `/care-twin-qa?qaSurface=support-legal-readiness-proof` for support inbox, privacy policy and terms links, refund/subscription policy, veterinary and emergency boundary, deletion escalation, incident response owner, and Apollo approval before claiming public launch readiness; use the Report binary export proof packet for Care Pass PDF generator, Dog ID PNG renderer, provider storage, and iOS/Android artifact proof before claiming binary export readiness. Share the provider plan for Apollo/Fable/Replit handoff, but do not treat it as store approval, money-movement approval, live AI approval, push delivery approval, app-submission approval, destructive-deletion approval, public-launch approval, or veterinary safety approval.
4. Continue production-scale Avatar Studio animation packs: native phone-size QA for the wired Option B Phoenix family, review all template-matched sprite strips, refine weak gait loops where needed, add overlay layers, remaining emote stills, and body-class polish.
5. Continue screen-by-screen polish, accessibility traversal, and visual regression.
6. Prepare provider-backed auth, storage, AI, notifications, checkout, and app-store submission only after Apollo approves those production decisions.
