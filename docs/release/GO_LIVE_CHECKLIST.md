# WoofWatcher go-live checklist (v1, iOS + Android)

The exact ordered path from this repo to both app stores. Split three ways: (A) what is already done in the repo, (B) automated steps anyone with the right credentials can run, and (C) steps only Apollo can do (accounts, money, legal sign-off).

Execution order across sections: A is done → C1-C5 (accounts must exist first) → B1-B5 (build) → C7-C11 (store forms and assets) → B6-B7 (submit) → C12 (review and release). Public legal/support hosting (C6) is already complete.

## A. Already done in this repo

- [x] A1. Expo app configured for release: `artifacts/woofwatcher-mobile/app.json` with app name WoofWatcher, version 1.0.0, iOS build number 1, iOS bundle id and Android package `com.pegasusdreamscapes.woofwatcher`, icon/splash assets, export-compliance declaration, privacy manifest, and camera/photo/foreground-location permission strings. Location is used only during a recorded walk; route rendering has no remote map provider. Disposable native prebuild inspection confirms iOS has no microphone or always/background-location usage keys, Android removes unused audio permission while retaining Expo ImagePicker's legacy photo permissions for older-OS compatibility, and the dormant Clerk native module is not linked.
- [x] A2. EAS build profiles ready: `artifacts/woofwatcher-mobile/eas.json` requires EAS CLI 16.0.1 or newer and defines `production` (iOS store build; Android app-bundle; `autoIncrement` on, remote app version source) plus `development`/`preview` profiles and credential-free `submit.production` stubs. The production profile is also the authoritative store capability boundary: push-token registration and cloud document upload are explicitly disabled and the store validator rejects `DATA_NOT_COLLECTED` if either flag is enabled or missing.
- [x] A3. v1 launch posture: local-first storage, no login required, no enabled cloud sync/push/live AI/payments/cloud storage, non-diagnostic health language, and Privacy & Safety export/deletion flows.
- [x] A4. Legal documents drafted under **Pegasus Dreamscapes Corp** with monitored contact **apollo@pegasusdreamscapes.com**: `docs/legal/PRIVACY_POLICY.md` and `docs/legal/TERMS_OF_SERVICE.md`. Public privacy, support, and terms sections are live without login. Apollo still must ratify the launch effective date and governing-law choice (C1).
- [x] A5. Store listing package drafted: `docs/release/STORE_LISTING.md` with name/subtitle/descriptions, keywords, category recommendation (Lifestyle), content-rating answers, Apple privacy label answers (Data Not Collected), Play Data safety answers, App Review notes, and the screenshot plan.
- [x] A6. Verification infrastructure and current local proof: 35/35 mounted-renderer tests plus 2,279/2,279 repository tests (2,314/2,314 total), full workspace typecheck/CI-safe builds, a strict 212-file / 1,924-module production consumer web export, 50-route runtime smoke, and 59-route live-preview proof. Production aliases exclude owner-only QA, launch, avatar-production, records-provider, and privacy runtimes from the consumer bundle. Production-profile iOS and Android Expo exports also compile, but those exports are unsigned bundling proof—not signed binaries or physical-device evidence. Native QA matrices, the deterministic store-pack generator, and `docs/release/tools/validate-store-materials.mjs` remain in place. The root frozen lockfile also retains the Darwin binaries EAS needs for a reproducible macOS iOS build.

## B. Automated steps (run by anyone with the credentials, once C1-C6 exist)

All commands run from `artifacts/woofwatcher-mobile`. Requires: an Expo account, and access to Apollo's Apple Developer and Google Play accounts (or EAS credentials/API keys delegated from them).

- [ ] B1. Install and sign in to EAS CLI:
  ```shell
  npm install -g eas-cli
  eas login
  ```
- [ ] B2. Link the app to an EAS project (first time only; writes `extra.eas.projectId` into app.json — commit that change):
  ```shell
  eas init
  ```
- [ ] B3. Run the pre-flight verification (must be green before building): focused tests, mobile typecheck, and `git diff --check` per the repo verification contract in `CLAUDE.md` / `docs/design/APOLLO_MASTER_VISION_PROMPT.md`.
- [ ] B4. Production iOS build (prompts for Apple account on first run; EAS creates and stores the distribution certificate and provisioning profile):
  ```shell
  eas build --profile production --platform ios
  ```
- [ ] B5. Production Android build (on first run EAS generates and stores the upload keystore — say yes and let EAS manage it; this keystore is what C5 registers with Play App Signing):
  ```shell
  eas build --profile production --platform android
  ```
- [ ] B6. Upload iOS to App Store Connect / TestFlight (requires the C3 app record; authenticate with an App Store Connect API key or Apple ID). This uploads the binary; it does **not** authorize App Review or public release:
  ```shell
  eas submit --profile production --platform ios
  ```
- [ ] B7. Upload Android to Google Play (requires the C4/C5 app record and a Google Service Account JSON key with Play Console access). EAS Submit can create a new app's first release directly on the internal-testing track; a manual B5 AAB upload in Play Console is an optional fallback, not a prerequisite:
  ```shell
  eas submit --profile production --platform android
  ```

## C. Apollo-only steps (accounts, money, legal decisions)

- [ ] C1. Ratify the two remaining legal choices in `docs/legal/PRIVACY_POLICY.md` and `docs/legal/TERMS_OF_SERVICE.md`: (1) set the **effective date** to the real public-launch date; (2) keep the consumer-friendly “laws of your country of residence” jurisdiction or replace it on counsel's advice. Entity and contact are resolved as Pegasus Dreamscapes Corp / `apollo@pegasusdreamscapes.com`. A lawyer review is recommended.
- [ ] C2. Enroll in the Apple Developer Program — $99/year, at developer.apple.com/programs. Individual enrollment usually clears in about 24-48 hours; organization enrollment needs a D-U-N-S number and can take longer.
- [ ] C3. Create the App Store Connect app record: App Store Connect → My Apps → "+" → New App → platform iOS, name WoofWatcher, primary language, bundle id `com.pegasusdreamscapes.woofwatcher` (register the bundle id under Certificates, Identifiers & Profiles first if it is not offered in the dropdown), SKU (e.g. `woofwatcher-v1`).
- [ ] C4. Create the Google Play Console developer account — $25 one-time, at play.google.com/console. **Decision point:** choose the account type deliberately.
  - Personal accounts created after November 13, 2023 must run a closed test with at least 12 testers opted in continuously for 14 days before Google grants production access. That adds two-plus weeks and tester wrangling to the launch.
  - An organization account avoids the closed-testing requirement but needs a D-U-N-S number and business verification.
  - Recommendation: use an organization account if a registered entity exists; otherwise plan the 14-day closed test into the schedule now (recruit 12+ testers — the household, friends, beta helpers) rather than discovering it at submission time.
- [ ] C5. Create the app in Play Console (All apps → Create app → WoofWatcher, App, Free), enroll it in Play App Signing, grant the Google Service Account used by EAS Submit access to the app, and keep the EAS-managed key from B5 as the upload credential while Google Play manages the app-signing key. The first release may be created by B7 on the internal-testing track; manual AAB upload remains an optional fallback.
- [x] C6. Public legal/support hosting is live without login at `https://woofwatcher-support.paoloaduran.chatgpt.site/#privacy`, `https://woofwatcher-support.paoloaduran.chatgpt.site/#support`, and `https://woofwatcher-support.paoloaduran.chatgpt.site/#terms`. The support section visibly includes `apollo@pegasusdreamscapes.com`; the retired private Claude artifact URL is not used.
- [ ] C7. Paste the verified privacy and support URLs into App Store Connect; paste the privacy URL and support email into Play Console.
- [ ] C8. Complete the privacy forms using `docs/release/STORE_LISTING.md`: Apple privacy label = Data Not Collected; Play Data safety = no data collected/shared. For Apple's current age-rating questionnaire, declare Health or Wellness Topics and infrequent Medical or Treatment Information. Those answers map to 13+ on OS 26 and later and 12+ on earlier OS versions under Apple's current definitions; record and use the OS- and region-specific results App Store Connect calculates. Complete Google IARC honestly and use its calculated result.
- [ ] C9. Enter the listing copy from `docs/release/STORE_LISTING.md`: name, subtitle/short description, full description, 99-byte keywords, Lifestyle category, copyright, and review notes.
- [ ] C10. Upload the validated pack from `docs/release/store-screenshots/`: six iPhone 6.9" accepted 1290x2796 shots, six true-9:16 Play phone shots, 1024x500 feature graphic, and 512x512 Play icon. Do not upload the retired Health Score or 1080x2340 Play shots.
- [ ] C11. Install the B6 build from internal TestFlight and complete the physical-iPhone matrix first. Only after GPS, permissions, share/export, safe areas, keyboard, VoiceOver, data deletion, and every visible production route pass should Apollo select the build and click **Submit for Review**. For Play, use internal/closed testing before production.
- [ ] C12. Review timelines and release:
  - Apple: most reviews complete within 24-48 hours; budget up to a week for a first submission and possible reviewer questions (the review notes in STORE_LISTING.md preempt the likely ones).
  - Google Play: a first submission from a new account can take up to 7 days to review, occasionally longer; subsequent updates are usually faster.
  - If on a new personal Play account: add the 14-day / 12-tester closed test from C4 before production is even available.
  - On approval: release (immediate or phased), verify the store pages render correctly, then confirm the in-app launch support profile and store-accounts proof cockpits reflect live status.

## Not in scope for v1 (do not let these creep into the submission)

Cloud sync, accounts/sign-in, push notifications, live AI, payments/subscriptions, and cloud document storage are all provider-gated and OFF. The listing, privacy forms, and review notes above are only truthful while that remains the case — if any of these are turned on later, redo STORE_LISTING.md answers and update the privacy policy first.
