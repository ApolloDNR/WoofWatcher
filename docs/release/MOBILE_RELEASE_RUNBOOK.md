# WoofWatcher Mobile Release Runbook

## Release Position

WoofWatcher is mobile-first. The canonical product surface is the Expo app in `artifacts/woofwatcher-mobile`; the PWA/web dashboard remains a supporting surface for desktop access, visual reference, and care-room administration.

Fable should polish mobile first, then keep the web dashboard/PWA visually consistent. Do not let web polish override mobile navigation, logging speed, safe-area behavior, native sharing, or iOS/Android release constraints.

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
- `submit.production`: placeholder submit profile. Store submission must wait for Apple Developer, Google Play, privacy/legal, and Apollo approval.

## Required Accounts And Secrets

Do not commit secrets. Configure them in Expo/EAS, deployment providers, or local `.env.local` only.

- Expo account and EAS project access.
- Apple Developer account for iOS/TestFlight/App Store.
- Google Play Console account for Android internal testing/production.
- Clerk production publishable key and secret.
- API production URL and allowed origins.
- Database/Supabase production credentials.
- Storage provider for records, receipts, and generated reports.
- AI provider key and model policy before live WoofGuide generation.
- Privacy policy, terms, support/refund policy, and veterinary boundary copy.

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
```

GitHub Actions `WoofWatcher Verify` must pass on `main` before sending a build to external testers.

## iOS Path

1. Confirm Apple Developer access.
2. Confirm Expo/EAS project ownership.
3. Confirm production environment variables are configured.
4. Confirm app icon, splash screen, and Fable screenshots are final.
5. Run an internal preview build first.
6. Test on at least one iPhone small screen and one modern large iPhone.
7. Verify sign-in, setup, Home, Quick Log, meal lifecycle, potty flow, Health/Bile Watch, Records, Care Pass, WoofGuide, Privacy, and Settings.
8. Promote to TestFlight only after Apollo approves the build.
9. Do not submit to App Store review until privacy/legal/support/subscription obligations are approved.

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
7. Verify sign-in, setup, Home, Quick Log, meal lifecycle, potty flow, Health/Bile Watch, Records, Care Pass, WoofGuide, Privacy, and Settings.
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
- Bottom tab target sizes: at least 44px equivalent.
- Quick Log can complete common logs in under five seconds.
- Meal served/outcome state is visually obvious.
- Potty parent flow is not split into confusing pee/poop top-level routes.
- Health/Bile language remains non-diagnostic.
- Care Pass reports feel credible enough to send to a sitter, trainer, or vet.
- WoofGuide never claims live AI unless provider-backed generation is configured.
- Empty, loading, failed-sync, and offline states are visible and useful.

## Release Blockers

- No production Apple/Google/Expo account access in this repo.
- No provider-backed document storage yet.
- No live payments yet.
- No live push notifications yet.
- No provider-backed WoofGuide generation yet.
- No native simulator/device screenshots from Codex in this environment.
- App Store or Play Store submission requires Apollo approval.
