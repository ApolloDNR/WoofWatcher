# WoofWatcher Mobile Release Runbook

## Release Position

WoofWatcher is mobile-first. The canonical product surface is the Expo app in `artifacts/woofwatcher-mobile`; the PWA/web dashboard remains a supporting surface for desktop access, visual reference, and care-room administration.

Fable should polish mobile first, then keep the web dashboard/PWA visually consistent. Do not let web polish override mobile navigation, logging speed, safe-area behavior, native sharing, or iOS/Android release constraints.

Version 1.0 ships **free and local-first**. It does not require Clerk, Supabase,
cloud storage, live AI, push, or payments. Those provider-backed systems remain
future-release work and must not be configured into the v1 store build.
The mobile package explicitly excludes the dormant `@clerk/expo` native module
from Expo autolinking, so the local-only binary does not inherit Clerk's native
iOS 17 deployment floor or ship the unused native account SDK. Internal
JavaScript auth work remains available for a later provider-enabled release.
The production permission footprint is foreground location plus user-invoked
camera/Photos access only. Microphone, background/always location, Android
location foreground-service, and Android shared-storage permissions stay
blocked. Picked medication-proof and record images are copied into the app's
document directory before their URI is persisted; a failed copy leaves the
care record unchanged.

## Current Mobile App Identity

- Expo app name: `WoofWatcher`
- Expo slug: `woofwatcher`
- URL scheme: `woofwatcher`
- iOS bundle identifier: `com.pegasusdreamscapes.woofwatcher`
- Android package: `com.pegasusdreamscapes.woofwatcher`
- Orientation: portrait
- Tablet: disabled for iOS v1 unless Apollo approves tablet layouts

## Build Profiles

The mobile app now has committed EAS profiles in `artifacts/woofwatcher-mobile/eas.json`.

- `development`: internal development-client builds. iOS targets simulator; Android emits an APK.
- `preview`: internal device testing. Use for Apollo/Fable review, household workflow QA, and pre-TestFlight/Play internal checks.
- `production`: store-ready build path. iOS uses default production archive behavior; Android emits an App Bundle for Google Play.
- `submit.production`: credential-free submit profile. Store identifiers and credentials stay in App Store Connect / EAS credential storage, never in git. Upload must wait for Apple Developer, Google Play, privacy/legal, and Apollo approval.

The root pnpm lockfile retains Linux x64 and Darwin arm64/x64 native tooling.
Do not restore the Darwin deletion overrides: EAS installs the monorepo on
macOS and needs those optional binaries for a frozen, reproducible iOS build.

## Required Accounts And Secrets

Do not commit secrets. Configure them in Expo/EAS, deployment providers, or local `.env.local` only.

- Expo account and EAS project access.
- Apple Developer account for iOS/TestFlight/App Store.
- Google Play Console account for Android internal testing/production.
- Public privacy, terms, and support sections matching `docs/legal/*` are live at
  `https://woofwatcher-support.paoloaduran.chatgpt.site/`.
- Monitored support contact: `apollo@pegasusdreamscapes.com`.

Not required for free v1: Clerk keys, API/database credentials, provider storage,
AI keys, push credentials, or payment credentials.

## Local And CI Verification Before Any Mobile Build

Run the focused behavior tests:

```powershell
& "C:\Users\Apoll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --experimental-strip-types --test artifacts\woofwatcher-mobile\lib\*.test.ts lib\care-domain\test\*.test.ts
```

When `pnpm` and dependencies are available, run:

```powershell
pnpm install --frozen-lockfile
pnpm run build:ci
pnpm --filter @workspace/woofwatcher-mobile run typecheck
pnpm --filter @workspace/woofwatcher-mobile run verify:pixellab-assets
```

GitHub Actions `WoofWatcher Verify` must pass on `main` before sending a build to external testers.

`build:ci` executes the PixelLab verifier before Expo `smoke:web`, then runs
the runtime and live-preview shell checks from the shared universal-navigation
manifest. Static HTTP success proves shell availability only. It does not prove
client redirects, selected tabs, re-tap, Back, or history behavior.

## Universal Navigation Release Gate

- Confirm the exact visible order and labels are **Home, Log, Plans, Health, More**,
  with a selected shape plus color and minimum 48 px touch targets.
- Under Health, exercise Overview, Health Watch, Bile Watch, Medications, Diet,
  Trends, Records, Dog ID, and Care Pass.
- Under More, exercise Dog Profile, Avatar Studio, Care Team, Care Team &
  Supplies, Story & Progress, Adventure, WoofGuide, Settings, Privacy & Data,
  and Legal.
- Load `/records`, `/reminders`, `/pack`, `/story`, `/profile`, `/portrait`,
  `/adventure`, `/woofguide`, `/privacy`, and `/legal`; confirm the canonical
  owner stays selected, Back is clean, and no duplicate root is stacked.
- Verify Home re-tap is idempotent, selected More re-tap resets only its active
  child, and malformed queries fall back to the owning root.
- Capture physical iOS VoiceOver and Android TalkBack order, labels, hints,
  selected values, and large-text layout. Browser accessibility inspection is
  supplemental; the gate remains blocked until both physical captures exist.

## iOS Path

1. Confirm Apple Developer access.
2. Confirm Expo/EAS project ownership.
3. Confirm production environment variables are configured.
4. Confirm app icon, splash screen, and Fable screenshots are final.
5. Run an internal preview build first.
6. Test on at least one iPhone small screen and one modern large iPhone.
7. Verify first-run Explore, Home, Log, Plans, Health, and More; then exercise Care Team & Supplies and Story & Progress under More, plus Records and Care Pass under Health, before checking local guidance, Privacy & Data, export, and deletion.
8. Upload to internal TestFlight, install that signed binary, and repeat the native matrix on a physical iPhone.
9. Do not submit to App Store review until privacy/legal/support obligations are approved and Apollo approves the exact TestFlight build.

Suggested commands once EAS is authenticated:

```powershell
cd artifacts/woofwatcher-mobile
pnpm exec eas build --platform ios --profile preview
pnpm exec eas build --platform ios --profile production
pnpm exec eas submit --platform ios --profile production
```

## Android Path

1. Confirm Google Play Console access.
2. Confirm Expo/EAS project ownership.
3. Confirm production environment variables are configured.
4. Confirm adaptive icon, splash screen, and Fable screenshots are final.
5. Run an internal preview APK first.
6. Test on at least one compact Android phone and one larger Android phone.
7. Verify first-run Explore, Home, Log, Plans, Health, and More; then exercise Care Team & Supplies and Story & Progress under More, plus Records and Care Pass under Health, before checking local guidance, Privacy & Data, export, and deletion.
8. Use production App Bundle for Google Play internal testing.
9. Do not submit publicly until privacy/legal/support/subscription obligations are approved.

Suggested commands once EAS is authenticated:

```powershell
cd artifacts/woofwatcher-mobile
pnpm exec eas build --platform android --profile preview
pnpm exec eas build --platform android --profile production
pnpm exec eas submit --platform android --profile production
```

## Web Dashboard/PWA Path

The web dashboard/PWA is useful for desktop care review and Fable visual exploration, but it is not the canonical product experience.

Before relying on the web surface:

- Preserve localStorage, backup/import, Care Pass, Health Watch, Bile Watch, records, reports, Settings, and route switching.
- Verify responsive mobile and desktop screenshots.
- Keep mobile app flows as the product source of truth.

## Fable Mobile Design QA Checklist

- iOS safe areas: notch, Dynamic Island, bottom home indicator, modal keyboard avoidance.
- Android safe areas: status bar, gesture navigation, back behavior, keyboard avoidance.
- Bottom tab target sizes: at least 48 px on every platform.
- Quick Log can complete common logs in under five seconds.
- Meal served/outcome state is visually obvious.
- Potty parent flow is not split into confusing pee/poop top-level routes.
- Health/Bile language remains non-diagnostic.
- Care Pass reports feel credible enough to send to a sitter, trainer, or vet.
- WoofGuide never claims live AI unless provider-backed generation is configured.
- Empty, loading, failed-sync, and offline states are visible and useful.

## Codex Launch-Readiness Checkpoint - 2026-06-16

- Mobile app identity is release-grade for Expo/EAS, iOS, and Android, and native appearance is configured as `automatic`.
- The web preview at `http://127.0.0.1:4192/more` was rebuilt from the Expo web export and verified for the More launch-readiness card, Plus, Care Team, Household Access, Responsibility Center, Sync Health, Tools & Sharing, and Diet Profile.
- More now exposes truthful internal-preview launch gates: iOS/Android EAS readiness, privacy review, sync health, and checkout gating.
- Shared Care Intelligence now derives Care IQ, routine fit, core care progress, log confidence, sync health, pending meal outcomes, and next actions from the tested care-domain package instead of isolated screen math.
- Home, Quick Log, and More should preserve Care Intelligence as a functional operating layer while visual polish is improved in Fable/Replit/Figma.
- `pnpm --filter @workspace/woofwatcher-mobile run typecheck` passed.
- `pnpm run test:focused` passed with 217 tests.
- `expo export --platform web --output-dir .expo-smoke --clear` passed.
- `pnpm --filter @workspace/woofwatcher-mobile run smoke:web` passed after the smoke script was corrected to pass Expo a relative `.expo-smoke` output path.
- `pnpm run build:ci` passed with elevated Windows filesystem access for the API server esbuild step.
- Browser DOM smoke passed for Home and More Care Intelligence. Screenshot capture is still unavailable in this Codex browser adapter, so native simulator/device screenshots and visual regression screenshots remain a Fable/manual QA responsibility.

## Release Blockers

- No production Apple/Google/Expo account access in this repo.
- Public privacy, support, and terms anchor URLs are verified and recorded in
  `STORE_LISTING.md` and `APP_STORE_CONNECT_METADATA.json`.
- Signed TestFlight / physical-iPhone evidence does not yet exist.
- App Store Connect app ID, review phone, and EAS project ID are not yet recorded.
- Provider-backed storage, payments, push, sync, and live AI are intentionally out of scope for free v1.
- No native simulator/device screenshots from Codex in this environment.
- The internal `/care-twin-qa` route can now collect local screenshot evidence from the device photo library and tags it by platform. A release QA packet is not complete until the iOS and Android evidence counts are both satisfied in the cockpit/share report.
- App Store or Play Store submission requires Apollo approval.

## Codex Native Release Checkpoint - 2026-07-30

- `pnpm run test:focused` passed **819/819** on Node 24.14.0 with pnpm 10.24.0.
- `pnpm run build:ci` passed all workspace typechecks/builds, a 267-file Expo web export, all 13 runtime routes, and live-preview proof.
- Provider-enabled internal builds deploy the API before the marked mobile client; `revision-v1` PATCHes then require the exact next server revision, while unmarked legacy requests retain backwards-compatible advancement.
- The store-material validator passed the full iPhone/Play pack while preserving the 10 real owner/native blockers.
- Pinned pnpm 10.24.0 accepted the updated frozen lockfile; Darwin arm64/x64 native packages are present for EAS macOS.
- Disposable iOS/Android prebuild inspection confirmed iOS 15.1, no Clerk native linkage, foreground-only location, no microphone usage key, and Android removal of unused audio permission while retaining Expo ImagePicker's legacy photo permissions for older-OS compatibility.
- These are configuration and generated-project checks, not a signed TestFlight install or physical-iPhone pass.
