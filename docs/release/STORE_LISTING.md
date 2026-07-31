# WoofWatcher store listing (v1)

Canonical listing copy and store-form answers for the free v1 submission of the Expo mobile app (`artifacts/woofwatcher-mobile`, bundle id `com.pegasusdreamscapes.woofwatcher`). Every claim below is held to the v1 truth: local-first, no account, no cloud features.

## Honesty rule (read before editing any copy)

The v1 listing must NOT claim: cloud sync, backups, accounts/sign-in, push notifications or reminders that fire as notifications, AI features, payments/subscriptions, document cloud storage, or veterinary diagnosis. All of these are provider-gated and off in v1 (see `docs/BLOCKERS_FOR_APOLLO.md`). If copy drifts toward any of these, cut it.

## App name

WoofWatcher

## Publisher and support

- Publisher / copyright owner: **Pegasus Dreamscapes Corp**
- Support email: **apollo@pegasusdreamscapes.com**
- Copyright: **2026 Pegasus Dreamscapes Corp**

## Store URLs and required links

Both stores require a publicly reachable privacy policy before submission, and Apple requires a Support URL that leads to real contact information. The old private Claude artifact URL is retired and **must not be submitted**.

Use the published first-party WoofWatcher support site:

- **Privacy Policy URL** (required): `https://woofwatcher-support.paoloaduran.chatgpt.site/#privacy`
- **Support URL** (required by Apple): `https://woofwatcher-support.paoloaduran.chatgpt.site/#support`
- **Terms of Service URL** (recommended): `https://woofwatcher-support.paoloaduran.chatgpt.site/#terms`
- **Marketing URL** (optional): leave blank for v1.

The site was published publicly on July 30, 2026. Its support section visibly includes `apollo@pegasusdreamscapes.com`, and its privacy and terms sections faithfully reflect the reviewed source documents in `docs/legal/`.

## iOS subtitle (30 characters max)

Real care. Pixel heart.

(23 characters. Alternative if a more literal line tests better: "Your dog's day, come to life" — 28 characters.)

## Google Play short description (80 characters max)

Log real dog care and watch a pixel companion bring each day to life

(68 characters.)

## Full description (App Store and Play, shared base)

Your dog's day, brought to life.

WoofWatcher turns the real care you give your dog into a little world worth checking on. Log a meal, a walk, a potty break, or a medication in seconds, and watch your pixel companion respond — wagging, leveling up, and settling into a room that changes with the real time of day. Every level, streak, and badge is earned only by real logged care. No shortcuts, no fake progress.

Real care. Pixel heart.

WHAT YOU CAN DO

- Fast care logging: meals (served through outcome), walks, potty breaks, meds, and notes — built for one-handed, ten-second entries.
- Routines that hold the day together: build a clear care plan and see what is done or still due.
- Health Watch: jot down appetite and tummy observations over time so patterns are easy to show your vet. WoofWatcher records your observations — it never diagnoses and is not veterinary advice.
- Records and Care Pass: keep your dog's important details in one place and share a clean, owner-maintained care summary with a sitter, walker, or vet whenever you choose.
- A living pixel companion: a hand-crafted pixel dog who earns XP and levels only from care you actually logged, in a room that shifts from day to night on the real clock.
- Memories and milestones: streaks, achievements, and little celebrations for showing up every day.

PRIVATE BY DESIGN

- No account needed. Open the app and start caring.
- Everything you enter stays on your device. WoofWatcher has no backend, ads, trackers, or analytics. Recorded walk routes use a bundled map view and are not sent to a map provider.
- Export anytime. Send a full text export of your care data wherever you like, straight from the share sheet.
- Photos are optional and stay on your device.

One honest note: because your data lives only on your device, use the in-app export (or your device backup) to protect it — there is no cloud copy.

WoofWatcher is a care journal and companion, not a medical device. If your dog seems unwell, contact a veterinarian.

## Keywords (iOS, 100 characters max, comma-separated)

dog,pet,puppy,tracker,log,routine,journal,health,potty,feeding,walk,medication,sitter,vet,companion

(99 ASCII bytes, comma-separated with no spaces.)

## Category

- Primary: Lifestyle (both stores).
- Alternative considered: Health & Fitness.
- Recommendation: Lifestyle. Health & Fitness invites extra review scrutiny of health claims, and WoofWatcher's health features are deliberately non-diagnostic owner journaling. Lifestyle matches the "companion/journal" positioning and avoids medical-app review paths.

## Content rating answers

- Apple age-rating questionnaire: declare **Health or Wellness Topics** and **infrequent Medical or Treatment Information** because the app organizes medication logs, symptoms, and urgent vet follow-up guidance even though it is non-diagnostic. On Apple platforms using the current rating system, expect a **13+** global rating; use the rating App Store Connect calculates rather than overriding it downward.
- Google Play: complete the IARC questionnaire as a general-audience dog-care journal and use the calculated rating. Do not enroll in the Designed for Families program.
- Violence: none. Sexual content: none. Profanity: none. Drugs/alcohol/tobacco: none. Gambling: none (no simulated gambling; progression is earned by care logging only, no chance mechanics).
- User-generated content shared with others: No. Users write private notes on their own device; sharing happens only through the OS share sheet at the user's initiative, and the app hosts no content.
- Social media capability: none. WoofWatcher has no social feed, public profiles, redistribution, amplification, or interaction with hosted user-generated content.
- Ads: none.
- In-app purchases: none in v1.
- Location: the app requests foreground ("when in use") location only when the owner starts a walk, to draw an on-device trail map of that walk. The route is saved in the local care log. Its visualization uses bundled artwork and geometry, so route coordinates are not sent to WoofWatcher, a map provider, or anyone else. Walk logging still works if permission is denied.
- Unrestricted internet access: the app does not browse the web or load remote content in v1.

## Apple privacy nutrition label

Answer: **Data Not Collected** (all categories), provided the release build passes the no-remote-map regression check and contains no enabled analytics, crash-reporting, account, sync, AI, or advertising SDK.

Justification to keep on file for App Review: WoofWatcher v1 has no backend, account system, analytics/ads/crash SDKs, or network transmission of user data. All care data is stored locally on the device. Photos remain on-device. Foreground walk routes are saved only in the local care log and rendered without remote map tiles, remote geometry, or a map SDK. Data leaves the device only when the user explicitly invokes the OS share sheet, which is user-initiated sharing rather than developer collection. Therefore no data types are collected as Apple defines the term, including location.

- Data used to track you: none.
- Data linked to you: none.
- Data not linked to you: none.

## Google Play Data safety form

- Does your app collect or share any of the required user data types? **No.**
- Data collected: none. Data shared: none.
- Is data encrypted in transit? Not applicable — no user data is transmitted (the form allows this only when nothing is collected; answer the collection question "No" and this question does not apply).
- Can users request data deletion? Data never leaves the device, so there is nothing held by the developer to delete. In-app: the Privacy & Safety screen provides export and deletion tools, and uninstalling the app removes all app data. If the form requires a deletion path anyway, state: "All data is stored locally on the user's device only; users can delete it in-app via Privacy & Safety or by uninstalling the app."
- Committed to the Play Families policy: not enrolled (general-audience app, rated Everyone).
- Independent security review: not applicable for v1.

## App Review notes (paste into App Store Connect "Notes" and Play "App access")

- The app requires no login. On first launch, choose **Explore first** to enter the on-device experience. There are no demo credentials because there are no accounts.
- All care data is stored locally on the device. There is no WoofWatcher backend in this release.
- Camera and photo library permissions are OPTIONAL and requested only when the reviewer chooses to attach a photo (avatar, care log, or record). The app is fully functional if permission is denied. Permission strings are declared in the app's Info.plist.
- Location permission is optional and foreground-only ("when in use"). It is requested only when the reviewer starts a walk. The recorded route is saved in the local care log and rendered with bundled map artwork; no route coordinates are sent to WoofWatcher or a map provider. Walk logging works if location is denied. No background location is used.
- Health features (Health Watch / Bile Watch) record owner observations only. The app displays non-diagnostic language throughout and directs users to a veterinarian; it makes no diagnosis or treatment claims.
- This free v1 does not include accounts, cross-device sync, push notifications, live AI, purchases, ads, or subscriptions.
- To see the core flow: open Today, log a meal or potty break from Fast Log, then view Plan, Story, Pack, and Records → Care Pass.

## Screenshot plan

Capture these six screens from one internally consistent care state, in this upload order:

1. Today — Phoenix in the daylight room, real care state, level strip, and Quick Log.
2. Fast Log — completed meal, potty, water, and walk rows from the same capture session.
3. Plan — real saved routines only; no “sample day” or placeholder metrics.
4. Story — the same four care moments as real timeline waypoints.
5. Pack — supplies checklist with no cross-device or household-sync claim.
6. Care Pass — sitter preview generated from the same local data. It makes a stronger handoff-focused store story than the factual Days Logged coverage on Health.

Required sets:

- iPhone 6.9" accepted portrait set: **1290 x 2796**. Apple lists this as an accepted 6.9" size and scales it for smaller iPhone classes. No 5.5" set is required.
- Google Play phone: **1080 x 1920**, true 9:16. The old 1080 x 2340 assets exceeded Play's 2:1 max-dimension rule and are retired.
- Do not upload tablet screenshots until native tablet layout is explicitly supported and tested. `supportsTablet` is false on iOS v1.
- Play feature graphic: 1024 x 500 (pixel-dog-in-room key art with the wordmark; no device frames, no claims text).

Capture rules: daylight room for the first shot; one dog and one timestamp-consistent state across every shot; real routines and logs only; no sample-day banner, placeholder metrics, debug UI, sync/cloud language, or unexplained health score. Keep the full app viewport and bottom navigation visible. Overlay captions may occupy no more than 20% of the Play image. Run `node docs/release/tools/validate-store-materials.mjs` before upload.
