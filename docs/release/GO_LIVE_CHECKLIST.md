# WoofWatcher go-live checklist (v1, iOS + Android)

The exact ordered path from this repo to both app stores. Split three ways: (A) what is already done in the repo, (B) automated steps anyone with the right credentials can run, and (C) steps only Apollo can do (accounts, money, legal sign-off).

Execution order across sections: A is done → C1-C6 (accounts and hosting must exist first) → B1-B5 (build) → C7-C11 (store forms and assets) → B6-B7 (submit) → C12 (review and release).

## A. Already done in this repo

- [x] A1. Expo app configured for release: `artifacts/woofwatcher-mobile/app.json` with app name WoofWatcher, version 1.0.0, iOS bundle id and Android package `com.pegasusdreamscapes.woofwatcher`, icon/splash assets, and camera/photo permission strings (the only permissions declared).
- [x] A2. EAS build profiles ready: `artifacts/woofwatcher-mobile/eas.json` defines `production` (iOS store build; Android app-bundle; `autoIncrement` on, remote app version source) plus `development`/`preview` profiles and `submit.production` stubs for both platforms.
- [x] A3. v1 launch posture enforced in-app: local-first storage (AsyncStorage, no server), no login required, provider-gated features (sync, push, AI, payments, cloud storage) visibly gated off, non-diagnostic health language, and Privacy & Safety export/deletion flows.
- [x] A4. Legal documents drafted: `docs/legal/PRIVACY_POLICY.md` and `docs/legal/TERMS_OF_SERVICE.md`, accurate to the local-first v1 reality. The former bracketed placeholders are now filled with sensible **defaults Apollo must confirm or correct** (see C1) — publisher "Pegasus Dreamscapes", effective date July 9 2026, contact routed through the store listing rather than a dedicated support email, and a consumer-friendly "laws of your country of residence" jurisdiction clause. No brackets remain; these are decisions to ratify, not blanks to fill.
- [x] A5. Store listing package drafted: `docs/release/STORE_LISTING.md` with name/subtitle/descriptions, keywords, category recommendation (Lifestyle), content-rating answers, Apple privacy label answers (Data Not Collected), Play Data safety answers, App Review notes, and the screenshot plan.
- [x] A6. Verification infrastructure: focused test suites, mobile typecheck, the `WoofWatcher Verify` CI workflow, QA matrices (`docs/release/CARE_TWIN_NATIVE_QA_MATRIX.md`), and in-app store-accounts / support-legal proof cockpits that track exactly what remains gated.

## B. Automated steps (run by anyone with the credentials, once C1-C6 exist)

All commands run from `artifacts/woofwatcher-mobile`. Requires: an Expo account, and access to Apollo's Apple Developer and Google Play accounts (or EAS credentials/API keys delegated from them).

- [ ] B1. Install and sign in to EAS CLI:
  ```
  npm install -g eas-cli
  eas login
  ```
- [ ] B2. Link the app to an EAS project (first time only; writes `extra.eas.projectId` into app.json — commit that change):
  ```
  eas init
  ```
- [ ] B3. Run the pre-flight verification (must be green before building): focused tests, mobile typecheck, and `git diff --check` per the repo verification contract in `CLAUDE.md` / `docs/design/APOLLO_MASTER_VISION_PROMPT.md`.
- [ ] B4. Production iOS build (prompts for Apple account on first run; EAS creates and stores the distribution certificate and provisioning profile):
  ```
  eas build --profile production --platform ios
  ```
- [ ] B5. Production Android build (on first run EAS generates and stores the upload keystore — say yes and let EAS manage it; this keystore is what C5 registers with Play App Signing):
  ```
  eas build --profile production --platform android
  ```
- [ ] B6. Submit iOS to App Store Connect (requires the C3 app record to exist; authenticate with an App Store Connect API key or Apple ID when prompted):
  ```
  eas submit --profile production --platform ios
  ```
- [ ] B7. Submit Android to Google Play (requires the C4/C5 app record; needs a Google Service Account JSON key with Play Console access). Note: Google requires the very first AAB for a new app to be uploaded manually in the Play Console UI — do that once with the B5 artifact, then use this for every subsequent release:
  ```
  eas submit --profile production --platform android
  ```

## C. Apollo-only steps (accounts, money, legal decisions)

- [ ] C1. Confirm or correct the four default choices now baked into `docs/legal/PRIVACY_POLICY.md` and `docs/legal/TERMS_OF_SERVICE.md` (no brackets remain — these are filled defaults, not blanks): (1) **legal entity name** — is "Pegasus Dreamscapes" the registered entity, or should it be your legal name / LLC? (2) **effective date** — currently July 9 2026; set it to the actual public-launch date. (3) **contact** — currently "reach us through the app's store listing"; if you want a dedicated support email, add it in the Contact section of both docs and the two "support address" references in the privacy policy. (4) **jurisdiction** — currently the consumer-friendly "laws of your country of residence"; keep, or name a specific governing law if your counsel prefers. A quick lawyer review pass is recommended before hosting.
- [ ] C2. Enroll in the Apple Developer Program — $99/year, at developer.apple.com/programs. Individual enrollment usually clears in about 24-48 hours; organization enrollment needs a D-U-N-S number and can take longer.
- [ ] C3. Create the App Store Connect app record: App Store Connect → My Apps → "+" → New App → platform iOS, name WoofWatcher, primary language, bundle id `com.pegasusdreamscapes.woofwatcher` (register the bundle id under Certificates, Identifiers & Profiles first if it is not offered in the dropdown), SKU (e.g. `woofwatcher-v1`).
- [ ] C4. Create the Google Play Console developer account — $25 one-time, at play.google.com/console. **Decision point:** choose the account type deliberately.
  - Personal accounts created after November 13, 2023 must run a closed test with at least 12 testers opted in continuously for 14 days before Google grants production access. That adds two-plus weeks and tester wrangling to the launch.
  - An organization account avoids the closed-testing requirement but needs a D-U-N-S number and business verification.
  - Recommendation: use an organization account if a registered entity exists; otherwise plan the 14-day closed test into the schedule now (recruit 12+ testers — the household, friends, beta helpers) rather than discovering it at submission time.
- [ ] C5. Create the app in Play Console (All apps → Create app → WoofWatcher, App, Free) and set up signing: enroll in Play App Signing and register the EAS-managed upload key from step B5 (EAS handles this automatically on first manual AAB upload; no local keystore files to manage).
- [ ] C6. Host the privacy policy at a public URL — required by both stores before submission. Simplest path: publish `docs/legal/PRIVACY_POLICY.md` (and the terms) via GitHub Pages from this repo, or any static host. The URL must be publicly reachable without login. Record the final URL; it also belongs in the in-app launch support profile (Privacy & Safety → Launch support profile).
- [ ] C7. Paste the privacy policy URL into both store records: App Store Connect → App Privacy → privacy policy URL, and Play Console → Store listing / App content → Privacy policy.
- [ ] C8. Complete the privacy forms using the pre-written answers in `docs/release/STORE_LISTING.md`: Apple privacy nutrition label = Data Not Collected (all categories); Play Data safety = no data collected or shared, deletion handled on-device. Complete the Play content rating (IARC) questionnaire: Everyone, no sensitive content, no ads, no purchases.
- [ ] C9. Enter the listing copy from `docs/release/STORE_LISTING.md`: name, subtitle/short description, full description, keywords, category (Lifestyle), and App Review notes (no login needed; camera/photos optional; gated features are intentional).
- [ ] C10. Capture and upload screenshots per the plan in `docs/release/STORE_LISTING.md`: iOS 6.7" and 5.5" sets plus Play phone and tablet sets, covering Today, Plan, Log, Pack, Story; plus the 1024x500 Play feature graphic.
- [ ] C11. Submit for review on both stores (after B6/B7 have delivered the builds): select the build in App Store Connect and click Submit for Review; create and roll out a production release in Play Console (or the closed-testing track first if C4 landed on a personal account).
- [ ] C12. Review timelines and release:
  - Apple: most reviews complete within 24-48 hours; budget up to a week for a first submission and possible reviewer questions (the review notes in STORE_LISTING.md preempt the likely ones).
  - Google Play: a first submission from a new account can take up to 7 days to review, occasionally longer; subsequent updates are usually faster.
  - If on a new personal Play account: add the 14-day / 12-tester closed test from C4 before production is even available.
  - On approval: release (immediate or phased), verify the store pages render correctly, then confirm the in-app launch support profile and store-accounts proof cockpits reflect live status.

## Not in scope for v1 (do not let these creep into the submission)

Cloud sync, accounts/sign-in, push notifications, live AI, payments/subscriptions, and cloud document storage are all provider-gated and OFF. The listing, privacy forms, and review notes above are only truthful while that remains the case — if any of these are turned on later, redo STORE_LISTING.md answers and update the privacy policy first.
