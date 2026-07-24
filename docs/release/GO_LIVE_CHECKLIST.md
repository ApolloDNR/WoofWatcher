# WoofWatcher go-live checklist (v1, iOS + Android)

The exact ordered path from this repo to both app stores. Split three ways: (A) what is already done in the repo, (B) automated steps anyone with the right credentials can run, and (C) steps only Apollo can do (accounts, money, legal sign-off).

Execution order: finish the source-level A items and C1-C6 → run B1-B5 →
complete native QA and reconcile the signed binaries under A7/C7-C10 → run
B6/B7 to upload the binaries → complete C11 review submission → complete C12
monitored release.

> **Current release boundary (2026-07-23):** the renovation branch targets a
> shared-account TestFlight beta first. The older local-only privacy policy,
> terms, store listing, “Data Not Collected,” and “no login” review notes are
> not valid for that build. Public store submission remains blocked until the
> production providers and data flows are verified and the legal/store answers
> are approved. No automated step below authorizes submission.

## A. Already done in this repo

- [x] A1. Expo app configured for release:
  `artifacts/woofwatcher-mobile/app.json` has the app name WoofWatcher,
  version 1.0.0, iOS bundle id and Android package
  `com.pegasusdreamscapes.woofwatcher`, icon/splash assets, camera/photos
  permission copy, and foreground-only walk-location permission copy.
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
- [ ] A7. Reconcile the iOS privacy manifest, Apple privacy nutrition labels,
  Play Data safety answers, and in-app disclosures against the exact signed
  shared-account binary. The manifest now truthfully declares linked precise
  location for optional walk-route recording/provider sync, but that single
  row is not a complete production data inventory or store-form approval.

## B. Automated steps (run by anyone with the credentials, once C1-C6 exist)

Run B1/B2/B4-B7 from `artifacts/woofwatcher-mobile`; run the B3 repository
verification commands from the repository root. These steps require an Expo
account and access to Apollo's Apple Developer and Google Play accounts, or
delegated EAS credentials/API keys.

- [ ] B1. Install and sign in to EAS CLI:
  ```
  npm install -g eas-cli
  eas login
  ```
- [ ] B2. Link the app to an EAS project (first time only; writes `extra.eas.projectId` into app.json — commit that change):
  ```
  eas init
  ```
- [ ] B3. Run the complete pre-flight verification from the repository root
  with Node 24 and pnpm 10.24.0. Keep the machine-readable output with the
  build:
  ```
  pnpm install --frozen-lockfile
  pnpm run test:focused
  pnpm run typecheck
  pnpm run build:ci
  pnpm --filter @workspace/woofwatcher-mobile run verify:pixellab-assets
  pnpm --filter @workspace/woofwatcher-mobile run smoke:web
  pnpm --filter @workspace/woofwatcher-mobile run smoke:runtime
  pnpm --filter @workspace/woofwatcher-mobile run proof:live-preview
  pnpm --filter @workspace/woofwatcher-mobile exec playwright install chromium
  pnpm --filter @workspace/woofwatcher-mobile run e2e:web
  pnpm run doctor:mobile-beta:json
  pnpm run doctor:native-qa:json
  git diff --check
  ```
  `smoke:runtime` and `proof:live-preview` must reject a missing or stale
  source fingerprint; a web proof does not replace native QA.
  `doctor:native-qa:json` is evidence capture: `BLOCKED` is expected on a host
  without the required SDK/device tooling and must remain a native handoff
  blocker rather than being relabeled as a passed native gate.
- [ ] B4. Production iOS build (prompts for Apple account on first run; EAS creates and stores the distribution certificate and provisioning profile):
  ```
  eas build --profile production --platform ios
  ```
- [ ] B5. Production Android build (on first run EAS generates and stores the upload keystore — say yes and let EAS manage it; this keystore is what C5 registers with Play App Signing):
  ```
  eas build --profile production --platform android
  ```
- [ ] B6. Upload the iOS build to App Store Connect/TestFlight (requires the
  C3 app record; authenticate with an App Store Connect API key or Apple ID).
  EAS Submit uploads the binary but does not submit it for App Review:
  ```
  eas submit --profile production --platform ios
  ```
- [ ] B7. Upload the Android AAB to Google Play (requires the C4/C5 app record
  and a Google Service Account JSON key with Play Console access). First-time
  manual upload is optional. Before automated submission, configure and review
  an explicit internal track and draft release status, verify the resulting
  release in Play Console, and do not promote it to production without
  Apollo's approval:
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
- [ ] C2. Enroll in the Apple Developer Program — $99/year, at
  developer.apple.com/programs. Organization enrollment requires verified
  legal-entity authority and may require a D-U-N-S record; allow time for
  verification and contact Apple support if purchase confirmation does not
  arrive within the published support window.
- [ ] C3. Create the App Store Connect app record: App Store Connect → My Apps → "+" → New App → platform iOS, name WoofWatcher, primary language, bundle id `com.pegasusdreamscapes.woofwatcher` (register the bundle id under Certificates, Identifiers & Profiles first if it is not offered in the dropdown), SKU (e.g. `woofwatcher-v1`).
- [ ] C4. Create the Google Play Console developer account — $25 one-time, at play.google.com/console. **Decision point:** choose the account type deliberately.
  - Personal accounts created after November 13, 2023 must run a closed test with at least 12 testers opted in continuously for 14 days before Google grants production access. That adds two-plus weeks and tester wrangling to the launch.
  - An organization account avoids the closed-testing requirement but needs a D-U-N-S number and business verification.
  - Recommendation: use an organization account if a registered entity exists; otherwise plan the 14-day closed test into the schedule now (recruit 12+ testers — the household, friends, beta helpers) rather than discovering it at submission time.
- [ ] C5. Create the app in Play Console (All apps → Create app → WoofWatcher,
  App, Free) and set up signing. Enroll in Play App Signing in Play Console,
  choose or generate the app-signing key there, retain the EAS-managed
  keystore as the upload key, and record both certificate fingerprints and
  ownership.
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
  - Apple reports that 90% of submissions are reviewed in under 24 hours, but
    timing varies. Use refreshed, approved reviewer notes generated from the
    exact signed build; do not rely on the current legacy
    `STORE_LISTING.md` draft.
  - Google advises planning at least a one-week buffer because review can take
    seven days or longer. Do not promise a faster review window.
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
