# WoofWatcher privacy policy

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
