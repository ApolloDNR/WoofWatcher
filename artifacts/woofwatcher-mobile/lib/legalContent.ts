/**
 * In-app legal content. Single source: docs/legal/*.md in the repo -
 * regenerate this file when those documents change so the app, the hosted
 * policy URL, and the store records never drift apart.
 */

export const PRIVACY_POLICY_MARKDOWN = `# WoofWatcher privacy policy

> **Draft status — shared-account release disclosure under review; do not publish.**
> The implementation includes staged account, household, provider-backed care
> sync, precise foreground walk routes, and OpenStreetMap area requests. Owner
> and legal approval of production providers, purposes, data categories,
> retention/deletion behavior, user rights, and store-form answers is still
> required before any external beta or public release.

Effective: July 9, 2026

WoofWatcher is published by Pegasus Dreamscapes ("we," "us"). This policy explains what information the WoofWatcher app for iOS and Android handles, where it lives, and the choices you have. It is written to match how the app actually works at version 1.0.

## The short version

- WoofWatcher is local-first: care is cached on your device. If you sign in to a provider-synced household, care entries may also be stored by that provider and visible to members of your household.
- Local preview works without an account. Provider-synced household features require sign-in when they are enabled.
- We do not sell or monetize your precise location, use it for ads, or enable background location tracking.
- WoofWatcher asks for precise foreground location only when you start recording a walk route. The points draw that walk's map and calculate distance.
- You are in control. You can export your data at any time and delete it from your device at any time.
- Opening a recorded route map requests map tiles or neighborhood geometry from OpenStreetMap services for that recorded area. Their own policies apply.

## 1. Who we are

WoofWatcher is a dog-care app that lets you log your dog's real daily care — meals, walks, potty breaks, medications, and observations — and see that care reflected in a pixel companion. It is published by:

Pegasus Dreamscapes
Support: reach us through the app's App Store or Google Play listing

## 2. Information the app handles

Depending on how you use WoofWatcher and which providers are enabled in the release, the app may handle:

- The profile, dog-care, household, health-observation, record, and preference information you choose to enter.
- Account and household identifiers if you choose provider-backed sign-in and household sync.
- Precise foreground location points only after you start recording a walk route.
- Recorded-area requests sent to OpenStreetMap services when a route map loads.

WoofWatcher does not use this information for advertising or cross-app tracking. Final provider identities, retention terms, export rules, and deletion rules must be approved and published before a provider-backed public release; this draft does not invent those guarantees.

## 3. Data stored on your device

Everything you enter in WoofWatcher is stored locally on your device, in the app's private storage. Depending on how you use the app, this local data may include:

- Your dog's profile (name, breed, weight, care focus, and optional details you choose to add, such as a microchip number, insurance details, or vet and emergency contact information).
- Care logs and routines (meals, walks, potty breaks, medications, and other care events, with timestamps).
- Health observations you record (for example, appetite or stomach notes). These are your own observations, not medical data collected by us — see section 10.
- Records, report artifacts, Care Pass drafts, and adventure memories you create.
- Recorded walk route points and calculated route distance when you choose route recording.
- Photos you choose to attach (see section 5). Photos stay on your device.
- App settings and preferences.

In local preview, this care data stays in the app's local storage unless you explicitly share or export it (see section 7). If you sign in to a provider-synced household, care entries — including a recorded walk route stored in an entry — may sync to that provider and be visible to members of the household. If you use your device's or operating system's own backup features, app data may also be included under your platform provider's terms.

## 4. Local preview and optional provider sign-in

You do not need an account for local preview. When provider-backed household sync is enabled, signing in connects care entries to the configured account and household so authorized household members can coordinate care.

The final public policy must name the configured providers and their approved retention, export, and deletion terms before that release ships. Local preview does not itself prove or approve provider behavior.

## 5. Camera and photo library access

WoofWatcher can use your device's camera and photo library, but only when you choose to attach a photo — for example, capturing a photo for your dog's avatar, a care log, or a record. Specifically:

- Access is optional. The app works fully without granting camera or photo permissions.
- The app asks for permission only at the moment you initiate a photo action, using the standard iOS and Android permission prompts.
- Photos you take or select stay on your device with the rest of your data. They are not uploaded anywhere by the app.

You can revoke camera or photo permissions at any time in your device settings; the app will keep working without them.

## 6. Walk route location and map services

WoofWatcher requests precise foreground location only when you start recording a walk route. It uses the captured points to draw that walk's route and calculate its distance. Route recording is optional, and the walk can still be logged if permission is denied. Background location is not enabled.

The route points and distance are saved with the walk in the care log on your device. If you are signed in to a provider-synced household, that care entry may sync to the configured provider and be visible to members of that household. This policy does not promise a provider retention period until the final provider policy is approved.

When you open a recorded route map, the app requests OpenStreetMap raster tiles or neighborhood geometry for the recorded area. That map-area request goes to OpenStreetMap tile or Overpass services under their own terms and privacy policies. WoofWatcher does not use the route for advertising or cross-app tracking.

You can deny or revoke location access in device settings. WoofWatcher does not enable background location permission.

## 7. Sharing and exporting: always your choice

Some features let you send data off your device, and every one of them is initiated by you:

- Export care data. The Privacy & Safety screen can produce a plain-text export bundle of your care data and hand it to your device's share sheet. Where it goes from there (email, notes, a file, another app) is entirely your choice, and the receiving app's own policies apply.
- Care Pass and reports. You can generate shareable care summaries (for example, for a sitter or vet) and share them the same way.

The receiving app's policies apply to share-sheet exports. Provider-synced household care and map-area requests follow the separate boundaries described in sections 4 and 6.

## 8. Your controls: export and deletion

- Export: you can export your care data at any time from Privacy & Safety in the app.
- Device deletion: the Privacy & Safety screen can clear local WoofWatcher data, and deleting the app removes data stored by the app on that device.
- Provider deletion: clearing a device does not delete care already synced to a provider. Provider-backed public release remains blocked until the account-deletion route, provider/object deletion receipts, retention terms, and support escalation are approved.

## 9. Children

WoofWatcher is a general-audience app about dog care and is not directed at children. Children should not create provider accounts or submit precise location through walk-route recording. If you are a parent or guardian with questions, contact us at the support address below.

## 10. Health-related notes are your observations, not medical advice

The app lets you record observations about your dog (for example, meals eaten, stomach notes, or symptoms you noticed). WoofWatcher does not diagnose and does not provide veterinary advice. These entries are stored locally and may follow the provider-synced household boundary described above. See the WoofWatcher terms of service for the full veterinary disclaimer.

## 11. Security

Local WoofWatcher data is protected by your device's own security. We recommend using a device passcode or biometric lock and keeping your operating system up to date. A provider-backed release must separately document and approve its transport, access-control, retention, and deletion safeguards before launch.

## 12. Your privacy rights (GDPR, CCPA/CPRA, and similar laws)

Laws such as the EU General Data Protection Regulation and the California Consumer Privacy Act give people rights over personal data that companies collect and process. You can export and clear local data in the app. For provider-backed data, use the approved account-deletion and support process published for the final release; those routes and terms must be completed before public launch.

If you believe we hold any information about you (for example, from a support email you sent us), you can contact us and we will honor applicable access and deletion rights.

We do not sell personal information and do not share it for cross-context behavioral advertising, as those terms are defined under California law.

## 13. Changes to this policy

If we change this policy, we will update the effective date above and publish the new version at the same public URL where this policy is hosted. Provider identities, retention terms, and store privacy-form answers must be added and approved before a provider-backed build is publicly released.

## 14. Contact

Questions or requests about privacy:

Support: reach us through the app's App Store or Google Play listing
Publisher: Pegasus Dreamscapes
`;

export const TERMS_OF_SERVICE_MARKDOWN = `# WoofWatcher terms of service

> **Draft status — shared-account release terms under review; do not publish.**
> Account, household, care-sync, walk-location, map-service, deletion,
> subscription, support, and provider terms require owner and legal approval
> before any production capability is enabled for external users.

Effective: July 9, 2026

These terms are an agreement between you and Pegasus Dreamscapes ("we," "us"), the publisher of the WoofWatcher app for iOS and Android. By downloading or using WoofWatcher, you agree to these terms. If you do not agree, do not use the app.

## 1. What WoofWatcher is

WoofWatcher is a dog-care companion app. You log your dog's real daily care — meals, walks, potty breaks, medications, and observations — and the app turns that record into routines, summaries, shareable care documents, and a pixel companion whose progress reflects the care you actually logged. Care is cached locally. Provider-synced household features require sign-in when enabled, and recorded walk routes follow the location, map-service, and household-sync boundaries in the WoofWatcher privacy policy.

## 2. WoofWatcher is not veterinary advice

Please read this section carefully.

- WoofWatcher is a record-keeping and care-organization tool. It records observations that you, the owner, choose to enter.
- The app does not diagnose, treat, cure, or prevent any illness or condition, and nothing in the app — including health-tracking features, trend summaries, guides, or reference content — is veterinary advice, a medical opinion, or a substitute for professional veterinary care.
- Features that surface patterns in your logs (for example, appetite or stomach observations) only reflect back what you entered. They are conversation starters for your vet, not conclusions.
- If your dog appears sick, injured, or in distress, contact a licensed veterinarian or an emergency animal hospital immediately. Do not delay seeking professional care because of anything in this app.
- You are solely responsible for decisions about your dog's health and care.

## 3. Who may use the app

You must be old enough to enter into these terms under the laws where you live (or have a parent or guardian's consent). The app is a general-audience product and is not directed at children.

## 4. Your license to use WoofWatcher

We grant you a personal, non-exclusive, non-transferable, revocable license to install and use WoofWatcher on devices you own or control, in accordance with these terms and the app store rules under which you obtained it (the Apple App Store or Google Play). You may not copy, modify, distribute, sell, lease, reverse engineer, or create derivative works from the app except where the law expressly permits it despite this restriction.

## 5. Your content and your data

- You own the content you create in WoofWatcher — your logs, notes, photos, records, and exports.
- Local preview stores your content on your device. If you sign in to a provider-synced household, care entries may also be stored by the configured provider and visible to authorized household members under the approved provider terms.
- You are responsible for what you enter and for anything you choose to share out of the app (for example, a Care Pass or export sent to a sitter or vet). Once you share content through your device's share sheet, its handling is governed by whatever service you sent it to.

## 6. Local-first and provider-synced storage

WoofWatcher keeps a local care cache. A provider-synced household may also have a provider copy of care entries, including recorded walk routes:

- Local-preview data may be permanently lost if your device is lost, damaged, reset, or the app is deleted.
- Clearing or deleting the app does not delete care already synced to a provider. Provider retention, export, and deletion terms must be approved before public launch and are not invented by these draft terms.
- We strongly recommend using the in-app export feature regularly and/or your device's own backup system to protect data you care about.
- To the maximum extent permitted by law, we are not liable for loss of data stored on your device.

## 7. Acceptable use

You agree not to:

- Use the app in violation of any law.
- Attempt to interfere with, compromise, or reverse engineer the app except as permitted by law.
- Misrepresent app content as veterinary documentation or professional medical records. Shared summaries such as a Care Pass are owner-maintained records, and you should present them as such.

## 8. Fees

This version of WoofWatcher does not charge fees, does not offer in-app purchases or subscriptions, and does not display ads. If paid features are introduced in a future version, they will be clearly disclosed, offered through the platform's purchase system, and covered by updated terms before you are charged anything.

## 9. Provider and location boundaries

Only rely on a provider-backed capability when the submitted build makes it available and the matching privacy/support terms are approved. Walk-route recording requests precise foreground location only after you start it, uses the points to draw that walk and calculate distance, and does not enable background location. Opening the map requests OpenStreetMap data for the recorded area.

## 10. Intellectual property

The WoofWatcher name, logo, pixel art, characters (including the pixel dog companion), design, and software are owned by Pegasus Dreamscapes or its licensors and are protected by intellectual-property laws. These terms do not grant you any rights in our trademarks or branding.

## 11. Disclaimer of warranties

The app is provided "as is" and "as available," without warranties of any kind, express or implied, including implied warranties of merchantability, fitness for a particular purpose, accuracy, and non-infringement, to the maximum extent permitted by law. We do not warrant that the app will be uninterrupted, error-free, or that data will never be lost. Some jurisdictions do not allow the exclusion of certain warranties, so some of these exclusions may not apply to you.

## 12. Limitation of liability

To the maximum extent permitted by law:

- We are not liable for any indirect, incidental, special, consequential, or punitive damages, or for loss of data, arising from your use of or inability to use the app.
- We are not liable for any harm to any animal or person arising from care decisions, which remain solely your responsibility (see section 2).
- Our total aggregate liability for all claims relating to the app will not exceed the greater of the amount you paid us for the app in the twelve months before the claim (which, for this free version, is zero) or USD 50.

Some jurisdictions do not allow certain limitations of liability, so some of these limitations may not apply to you. Nothing in these terms excludes liability that cannot be excluded by law.

## 13. Termination

You may stop using the app at any time; deleting the app removes your license and data stored by the app on that device, but it does not delete care already synced to a provider. We may terminate or suspend the license granted here if you materially breach these terms. Sections that by their nature should survive (including sections 2, 5, 6, 10, 11, 12, and 14) survive termination.

## 14. Governing law and disputes

These terms are governed by the laws of your country of residence, and any disputes may be brought in the courts of the place where you live, consistent with your local consumer-protection rights.

## 15. App store terms

Your use of the app is also subject to the applicable app store's terms. If you obtained the app from the Apple App Store, Apple is not a party to these terms, has no obligation to provide support or maintenance, and is a third-party beneficiary of these terms with the right to enforce them against you. Equivalent provisions apply to Google Play under Google's terms.

## 16. Changes to these terms

We may update these terms from time to time. We will update the effective date above and publish the current version at the same public URL where these terms are hosted. If a change is material (for example, changing provider, location, storage, sharing, or paid-feature behavior), we will provide notice in the app before the change applies to you. Continued use after the effective date of updated terms constitutes acceptance.

## 17. Contact

Support: reach us through the app's App Store or Google Play listing
Publisher: Pegasus Dreamscapes
`;
