# WoofWatcher go-live checklist (v1, iOS + Android)

The exact ordered path from this repo to both app stores. Split three ways: (A) what is already done in the repo, (B) automated steps anyone with the right credentials can run, and (C) steps only Apollo can do (accounts, money, legal sign-off).

Execution order across sections: A is done → C1-C6 (accounts and hosting must exist first) → B1-B5 (build) → C7-C11 (store forms and assets) → B6-B7 (submit) → C12 (review and release).

> **Current release boundary (2026-07-23):** the renovation branch targets a
> shared-account TestFlight beta first. The older local-only privacy policy,
> terms, store listing, “Data Not Collected,” and “no login” review notes are
> not valid for that build. Public store submission remains blocked until the
> production providers and data flows are verified and the legal/store answers
> are approved. No automated step below authorizes submission.

## A. Already done in this repo

- [x] A1. Expo app configured for release: `artifacts/woofwatcher-mobile/app.json` with app name WoofWatcher, version 1.0.0, iOS bundle id and Android package `com.pegasusdreamscapes.woofwatcher`, icon/splash assets, and camera/photo permission strings (the only permissions declared).
- [x] A2. EAS build profiles ready: `artifacts/woofwatcher-mobile/eas.json` defines `production` (iOS store build; Android app-bundle; `autoIncrement` on, remote app version source) plus `development`/`preview` profiles and `submit.production` stubs for both platforms.
- [x] A3. The app enforces truthful runtime gates: release builds require real
  account configuration; local route proof cannot activate in native release;
  provider-backed sync, storage, AI, payments, push, and destructive deletion
  stay blocked until their structured proof is present; health language remains
  non-diagnostic.
- [ ] A4. Replace the legacy local-only drafts in
  `docs/legal/PRIVACY_POLICY.md` and `docs/legal/TERMS_OF_SERVICE.md` with
  counsel-reviewed shared-account terms covering the actual production
  providers, data categories, retention/deletion, household roles, support,
  and user rights.
- [ ] A5. Replace the legacy local-only answers in
  `docs/release/STORE_LISTING.md`. Recalculate Apple privacy nutrition labels,
  Play Data safety, login/reviewer instructions, and deletion disclosures from
  the exact submitted build; “Data Not Collected” and “no login” must not be
  reused for the shared-account binary.
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

- [ ] C1. Approve the production launch mode and legal/data inventory. For the
  shared-account build, identify the legal entity, effective date, monitored
  support/privacy contact, jurisdiction, every production provider, each data
  category and purpose, retention/deletion timing, household access rules,
  incident process, and subscription/refund terms. Have counsel approve the
  replacement privacy policy and terms before external beta data is collected.
- [ ] C2. Enroll in the Apple Developer Program — $99/year, at developer.apple.com/programs. Individual enrollment usually clears in about 24-48 hours; organization enrollment needs a D-U-N-S number and can take longer.
- [ ] C3. Create the App Store Connect app record: App Store Connect → My Apps → "+" → New App → platform iOS, name WoofWatcher, primary language, bundle id `com.pegasusdreamscapes.woofwatcher` (register the bundle id under Certificates, Identifiers & Profiles first if it is not offered in the dropdown), SKU (e.g. `woofwatcher-v1`).
- [ ] C4. Create the Google Play Console developer account — $25 one-time, at play.google.com/console. **Decision point:** choose the account type deliberately.
  - Personal accounts created after November 13, 2023 must run a closed test with at least 12 testers opted in continuously for 14 days before Google grants production access. That adds two-plus weeks and tester wrangling to the launch.
  - An organization account avoids the closed-testing requirement but needs a D-U-N-S number and business verification.
  - Recommendation: use an organization account if a registered entity exists; otherwise plan the 14-day closed test into the schedule now (recruit 12+ testers — the household, friends, beta helpers) rather than discovering it at submission time.
- [ ] C5. Create the app in Play Console (All apps → Create app → WoofWatcher, App, Free) and set up signing: enroll in Play App Signing and register the EAS-managed upload key from step B5 (EAS handles this automatically on first manual AAB upload; no local keystore files to manage).
- [ ] C6. Host the **approved replacement** privacy policy and terms at stable
  public HTTPS URLs without login. Do not publish the legacy local-only drafts
  for the shared-account build. Record the final URLs in the in-app Launch
  Support profile and verify them from a signed-out browser.
- [ ] C7. Paste the privacy policy URL into both store records: App Store Connect → App Privacy → privacy policy URL, and Play Console → Store listing / App content → Privacy policy.
- [ ] C8. Complete Apple privacy nutrition labels and Play Data safety from the
  verified production data-flow inventory. Include account identifiers,
  household/care data, uploaded files, diagnostics, purchases, and provider
  processing wherever the submitted binary actually transmits them. Attach
  the approved deletion path and policy URLs. Do not reuse “Data Not
  Collected.”
- [ ] C9. Approve and enter refreshed listing copy plus App Review credentials
  or a deterministic reviewer-access path for the shared-account build.
  Explicitly explain provider-gated features and the non-diagnostic health
  boundary.
- [ ] C10. Capture and upload screenshots from the final signed build after
  native QA. The core set is Today, Plan, Quick Log, Health, and More, with Log
  History, Records, and Privacy as supporting proof. Capture required iPhone
  and Play sizes plus the Play feature graphic; do not reuse screenshots whose
  navigation or claims predate the five-destination care loop.
- [ ] C11. Submit for review on both stores (after B6/B7 have delivered the builds): select the build in App Store Connect and click Submit for Review; create and roll out a production release in Play Console (or the closed-testing track first if C4 landed on a personal account).
- [ ] C12. Review timelines and release:
  - Apple: most reviews complete within 24-48 hours; budget up to a week for a first submission and possible reviewer questions (the review notes in STORE_LISTING.md preempt the likely ones).
  - Google Play: a first submission from a new account can take up to 7 days to review, occasionally longer; subsequent updates are usually faster.
  - If on a new personal Play account: add the 14-day / 12-tester closed test from C4 before production is even available.
  - On approval: release (immediate or phased), verify the store pages render correctly, then confirm the in-app launch support profile and store-accounts proof cockpits reflect live status.

## Scope boundary

The current target is a shared-account TestFlight beta. Account, household,
and care-sync behavior may be enabled only after their provider configuration,
authorization tests, deletion/retention proof, and approved disclosures are
complete. Push notifications, live AI, payments/subscriptions, and cloud
document storage remain provider-gated and off unless their separate proof
manifests are complete. Any scope change requires the listing, privacy forms,
policy, terms, reviewer instructions, and native QA to be regenerated before
submission.
