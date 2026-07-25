/**
 * In-app legal content. Single source: docs/legal/*.md in the repo -
 * regenerate this file when those documents change so the app, the hosted
 * policy URL, and the store records never drift apart.
 */

export const PRIVACY_POLICY_MARKDOWN = `# WoofWatcher privacy policy

Effective: July 9, 2026

WoofWatcher is published by Pegasus Dreamscapes ("we," "us"). This policy explains what information the WoofWatcher app for iOS and Android handles, where it lives, and the choices you have. It is written to match how the app actually works at version 1.0.

## The short version

- WoofWatcher stores everything on your device. There are no WoofWatcher servers in this version of the app, and nothing you enter is transmitted to us.
- No account is required. You can use every feature without signing in, and there is no sign-in in this version.
- We do not collect, sell, share, or monetize your data. There are no ads, no analytics SDKs, and no trackers in the app.
- You are in control. You can export your data at any time and delete it from your device at any time.
- Nothing leaves your device unless you choose to share it (for example, exporting a care summary through your device's share sheet).

## 1. Who we are

WoofWatcher is a dog-care app that lets you log your dog's real daily care — meals, walks, potty breaks, medications, and observations — and see that care reflected in a pixel companion. It is published by:

Pegasus Dreamscapes
Support: reach us through the app's App Store or Google Play listing

## 2. What we collect: nothing

We do not collect any personal information from you through the app. In this version:

- The app does not connect to any WoofWatcher server, because none exist.
- The app does not require or offer account creation or sign-in.
- The app contains no advertising, no analytics or measurement SDKs, no crash-reporting services, and no third-party trackers.
- We never receive your name, email address, location, contacts, photos, care logs, or any other data you enter into the app.

Because we do not collect data, we also do not sell it, share it, or use it for advertising, profiling, or any other purpose. There is nothing for us to sell or share.

## 3. Data stored on your device

Everything you enter in WoofWatcher is stored locally on your device, in the app's private storage. Depending on how you use the app, this local data may include:

- Your dog's profile (name, breed, weight, care focus, and optional details you choose to add, such as a microchip number, insurance details, or vet and emergency contact information).
- Care logs and routines (meals, walks, potty breaks, medications, and other care events, with timestamps).
- Health observations you record (for example, appetite or stomach notes). These are your own observations, not medical data collected by us — see section 9.
- Records, report artifacts, Care Pass drafts, and adventure memories you create.
- Photos you choose to attach (see section 5). Photos stay on your device.
- App settings and preferences.

This data never leaves your device unless you explicitly share or export it (see section 6). If you use your device's or operating system's own backup features (such as an encrypted device backup), your app data may be included in that backup under your platform provider's terms — that backup relationship is between you and Apple or Google, not with us.

## 4. No account required; a note about optional sign-in

You do not need an account to use WoofWatcher, and this version of the app does not offer sign-in. The app's codebase contains groundwork for an optional sign-in feature, but it is not enabled in production builds and no sign-in data is created, transmitted, or processed.

If we ever introduce optional accounts, cloud sync, or any feature that sends data off your device, we will update this policy first, explain exactly what would be collected and why, and make any such feature opt-in. Your local-only use of the app will not silently change.

## 5. Camera and photo library access

WoofWatcher can use your device's camera and photo library, but only when you choose to attach a photo — for example, capturing a photo for your dog's avatar, a care log, or a record. Specifically:

- Access is optional. The app works fully without granting camera or photo permissions.
- The app asks for permission only at the moment you initiate a photo action, using the standard iOS and Android permission prompts.
- Photos you take or select stay on your device with the rest of your data. They are not uploaded anywhere by the app.

You can revoke camera or photo permissions at any time in your device settings; the app will keep working without them.

## 6. Sharing and exporting: always your choice

Some features let you send data off your device, and every one of them is initiated by you:

- Export care data. The Privacy & Safety screen can produce a plain-text export bundle of your care data and hand it to your device's share sheet. Where it goes from there (email, notes, a file, another app) is entirely your choice, and the receiving app's own policies apply.
- Care Pass and reports. You can generate shareable care summaries (for example, for a sitter or vet) and share them the same way.

We are not a party to these shares and never receive a copy.

## 7. Your controls: export and deletion

- Export: you can export your care data at any time from Privacy & Safety in the app.
- Deletion: your data lives only on your device, so you control deletion directly. The Privacy & Safety screen provides data deletion tools, and deleting the app from your device removes all WoofWatcher data stored by the app. Because we hold no copy, there is nothing for us to delete on a server.

## 8. Children

WoofWatcher is a general-audience app about dog care and is not directed at children. Because the app collects no data from anyone, it does not collect personal information from children either. If you are a parent or guardian with questions, contact us at the support address below.

## 9. Health-related notes are your observations, not medical data we process

The app lets you record observations about your dog (for example, meals eaten, stomach notes, or symptoms you noticed). These entries are notes you write for yourself, stored on your device. WoofWatcher does not diagnose, does not provide veterinary advice, and does not transmit these notes to us or anyone else. See the WoofWatcher terms of service for the full veterinary disclaimer.

## 10. Security

Your WoofWatcher data is protected by your device's own security. We recommend using a device passcode or biometric lock and keeping your operating system up to date. Because the data never leaves your device through the app, the main thing protecting it is the same thing protecting everything else on your phone: your device security.

## 11. Your privacy rights (GDPR, CCPA/CPRA, and similar laws)

Laws such as the EU General Data Protection Regulation and the California Consumer Privacy Act give people rights over personal data that companies collect and process. In this version of WoofWatcher, we do not collect or process your personal data at all, so there is no data held by us to access, correct, delete, or port — you already hold the only copy, on your device, with in-app export and deletion controls.

If you believe we hold any information about you (for example, from a support email you sent us), you can contact us and we will honor applicable access and deletion rights.

We do not sell personal information and do not share it for cross-context behavioral advertising, as those terms are defined under California law.

## 12. Changes to this policy

If we change this policy, we will update the effective date above and publish the new version at the same public URL where this policy is hosted. If a future version of the app introduces any feature that collects or transmits data (such as optional accounts or cloud sync), we will update this policy before that feature ships, and the feature will be opt-in.

## 13. Contact

Questions or requests about privacy:

Support: reach us through the app's App Store or Google Play listing
Publisher: Pegasus Dreamscapes
`;

export const TERMS_OF_SERVICE_MARKDOWN = `# WoofWatcher terms of service

Effective: July 9, 2026

These terms are an agreement between you and Pegasus Dreamscapes ("we," "us"), the publisher of the WoofWatcher app for iOS and Android. By downloading or using WoofWatcher, you agree to these terms. If you do not agree, do not use the app.

## 1. What WoofWatcher is

WoofWatcher is a dog-care companion app. You log your dog's real daily care — meals, walks, potty breaks, medications, and observations — and the app turns that record into routines, summaries, shareable care documents, and a pixel companion whose progress reflects the care you actually logged. In this version, all of your data is stored locally on your device; the app does not require an account and does not transmit your data to us (see the WoofWatcher privacy policy).

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
- Because this version of the app stores everything locally on your device, we never receive, host, or moderate your content, and we claim no license over it.
- You are responsible for what you enter and for anything you choose to share out of the app (for example, a Care Pass or export sent to a sitter or vet). Once you share content through your device's share sheet, its handling is governed by whatever service you sent it to.

## 6. Local-first storage, backups, and data loss

All WoofWatcher data lives on your device. That is a deliberate privacy choice, and it comes with a trade-off you accept by using the app:

- If your device is lost, damaged, reset, or the app is deleted, your WoofWatcher data may be permanently lost. There is no cloud copy in this version.
- We strongly recommend using the in-app export feature regularly and/or your device's own backup system to protect data you care about.
- To the maximum extent permitted by law, we are not liable for loss of data stored on your device.

## 7. Acceptable use

You agree not to:

- Use the app in violation of any law.
- Attempt to interfere with, compromise, or reverse engineer the app except as permitted by law.
- Misrepresent app content as veterinary documentation or professional medical records. Shared summaries such as a Care Pass are owner-maintained records, and you should present them as such.

## 8. Fees

This version of WoofWatcher does not charge fees, does not offer in-app purchases or subscriptions, and does not display ads. If paid features are introduced in a future version, they will be clearly disclosed, offered through the platform's purchase system, and covered by updated terms before you are charged anything.

## 9. Features not in this version

This version of the app does not include cloud sync, online accounts, push notifications, live AI assistance, payments, or cloud document storage. Where the app mentions such capabilities, they are shown as gated or "setup needed" and are not active. Do not rely on any capability the app has not actually made available to you.

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

You may stop using the app at any time; deleting the app removes your license and your locally stored data. We may terminate or suspend the license granted here if you materially breach these terms. Sections that by their nature should survive (including sections 2, 5, 6, 10, 11, 12, and 14) survive termination.

## 14. Governing law and disputes

These terms are governed by the laws of your country of residence, and any disputes may be brought in the courts of the place where you live, consistent with your local consumer-protection rights.

## 15. App store terms

Your use of the app is also subject to the applicable app store's terms. If you obtained the app from the Apple App Store, Apple is not a party to these terms, has no obligation to provide support or maintenance, and is a third-party beneficiary of these terms with the right to enforce them against you. Equivalent provisions apply to Google Play under Google's terms.

## 16. Changes to these terms

We may update these terms from time to time. We will update the effective date above and publish the current version at the same public URL where these terms are hosted. If a change is material (for example, introducing paid features or online accounts), we will provide notice in the app before the change applies to you. Continued use after the effective date of updated terms constitutes acceptance.

## 17. Contact

Support: reach us through the app's App Store or Google Play listing
Publisher: Pegasus Dreamscapes
`;
