# WoofWatcher store listing (v1)

Canonical listing copy and store-form answers for the v1 submission of the Expo mobile app (`artifacts/woofwatcher-mobile`, bundle id `com.pegasusdreamscapes.woofwatcher`). Every claim below is held to the v1 truth: local-first, no account, no cloud features.

## Honesty rule (read before editing any copy)

The v1 listing must NOT claim: cloud sync, backups, accounts/sign-in, push notifications or reminders that fire as notifications, AI features, payments/subscriptions, document cloud storage, or veterinary diagnosis. All of these are provider-gated and off in v1 (see `docs/BLOCKERS_FOR_APOLLO.md`). If copy drifts toward any of these, cut it.

## App name

WoofWatcher

## Store URLs and required links

Both stores require a publicly reachable Privacy Policy URL before submission. WoofWatcher's policy and terms are hosted on one page with in-page anchors, so the same base URL satisfies every field:

- **Privacy Policy URL** (App Store Connect · Play Data safety): `https://claude.ai/code/artifact/623bc970-911f-4a50-952e-709f33e348f9#privacy`
- **Terms of Service URL** (App Store "License Agreement" / EULA link, optional): `https://claude.ai/code/artifact/623bc970-911f-4a50-952e-709f33e348f9#terms`
- Base page (both, no anchor): `https://claude.ai/code/artifact/623bc970-911f-4a50-952e-709f33e348f9`

The page content is transcribed verbatim from `docs/legal/PRIVACY_POLICY.md` and `docs/legal/TERMS_OF_SERVICE.md` (Pegasus Dreamscapes, effective 2026-07-09, v1.0).

Before pasting these into the store forms:
1. The hosted page is private by default — open it and use the page's **Share** menu to make it public, or the store reviewer's crawler will 404.
2. Optional but recommended for a polished listing: republish this same content on your own domain (e.g. `pegasusdreamscapes.com/woofwatcher/privacy`) and swap the URLs above. The claude.ai link is a valid, functional interim host.

Still needed from the publisher (not fabricated here):
- **Support URL or email** (Apple requires one of the two; Play requires an email). Provide a real contact you monitor — do not reuse the privacy page.
- **Marketing URL** (optional on both stores; leave blank if there is no product site).

## iOS subtitle (30 characters max)

Real care. Pixel heart.

(23 characters. Alternative if a more literal line tests better: "Your dog's day, come to life" — 28 characters.)

## Google Play short description (80 characters max)

Log real care for your dog and watch a pixel companion bring their day to life.

(79 characters.)

## Full description (App Store and Play, shared base)

Your dog's day, brought to life.

WoofWatcher turns the real care you give your dog into a little world worth checking on. Log a meal, a walk, a potty break, or a medication in seconds, and watch your pixel companion respond — wagging, leveling up, and settling into a room that changes with the real time of day. Every level, streak, and badge is earned only by real logged care. No shortcuts, no fake progress.

Real care. Pixel heart.

WHAT YOU CAN DO

- Fast care logging: meals (served through outcome), walks, potty breaks, meds, and notes — built for one-handed, ten-second entries.
- Routines that hold the day together: see what's next, keep the household on the same page, and never wonder whether the dog was fed.
- Health Watch: jot down appetite and tummy observations over time so patterns are easy to show your vet. WoofWatcher records your observations — it never diagnoses and is not veterinary advice.
- Records and Care Pass: keep your dog's important details in one place and share a clean, owner-maintained care summary with a sitter, walker, or vet whenever you choose.
- A living pixel companion: a hand-crafted pixel dog who earns XP and levels only from care you actually logged, in a room that shifts from day to night on the real clock.
- Memories and milestones: streaks, achievements, and little celebrations for showing up every day.

PRIVATE BY DESIGN

- No account needed. Open the app and start caring.
- Everything stays on your device. WoofWatcher has no servers, no ads, no trackers, and no analytics. Your dog's data is yours.
- Export anytime. Send a full text export of your care data wherever you like, straight from the share sheet.
- Photos are optional and stay on your device.

One honest note: because your data lives only on your device, use the in-app export (or your device backup) to protect it — there is no cloud copy.

WoofWatcher is a care journal and companion, not a medical device. If your dog seems unwell, contact a veterinarian.

## Keywords (iOS, 100 characters max, comma-separated)

dog care,pet care,dog log,puppy,dog routine,pet journal,dog health diary,potty training,virtual pet

(99 characters.)

## Category

- Primary: Lifestyle (both stores).
- Alternative considered: Health & Fitness.
- Recommendation: Lifestyle. Health & Fitness invites extra review scrutiny of health claims, and WoofWatcher's health features are deliberately non-diagnostic owner journaling. Lifestyle matches the "companion/journal" positioning and avoids medical-app review paths.

## Content rating answers

- Apple age rating: 4+ (no objectionable content).
- Google Play (IARC questionnaire): Everyone.
- Violence: none. Sexual content: none. Profanity: none. Drugs/alcohol/tobacco: none. Gambling: none (no simulated gambling; progression is earned by care logging only, no chance mechanics).
- User-generated content shared with others: No. Users write private notes on their own device; sharing happens only through the OS share sheet at the user's initiative, and the app hosts no content.
- Ads: none.
- In-app purchases: none in v1.
- Location sharing: none (the app does not request location permission in v1).
- Unrestricted internet access: the app does not browse the web or load remote content in v1.

## Apple privacy nutrition label

Answer: **Data Not Collected** (all categories).

Justification to keep on file for App Review: WoofWatcher v1 has no server component, no account system, no analytics/ads/crash SDKs, and makes no network transmission of user data. All care data is stored locally on the device (AsyncStorage). Photos, when attached, remain on-device. Data leaves the device only when the user explicitly invokes the OS share sheet, which is user-initiated sharing, not developer collection. Therefore no data types are "collected" as Apple defines the term (transmitted off device to the developer or third parties).

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

- The app requires NO login. It opens directly to the home screen with sample/local data; reviewers can use every feature immediately. There are no demo credentials because there are no accounts.
- All data is stored locally on the device. The app makes no network calls with user data; there is no server component in this release.
- Camera and photo library permissions are OPTIONAL and requested only when the reviewer chooses to attach a photo (avatar, care log, or record). The app is fully functional if permission is denied. Permission strings are declared in the app's Info.plist.
- Health features (Health Watch / Bile Watch) record owner observations only. The app displays non-diagnostic language throughout and directs users to a veterinarian; it makes no diagnosis or treatment claims.
- Some screens reference future provider-backed capabilities (sync, notifications, AI); in this build they are visibly gated as "setup needed" and non-functional by design, not broken. No purchase is offered anywhere.
- To see the core flow: open Today (home), log a meal or potty break from the Log tab, then view Plan, Pack, and Story.

## Screenshot plan

Capture the same five screens per device class, in this order (matches the app's bottom navigation):

1. Today — full-screen living room with the pixel dog, level strip, and care status (the hero shot).
2. Plan — routines/calendar view showing the day's care schedule.
3. Log — Quick Log with meal/potty flows (mid-log state, showing how fast entry is).
4. Pack — Supplies checklist (Essentials + Travel bag), showing the household keeps the dog stocked. (The People/caregivers tab is intentionally empty in the sample data, so Supplies is the richer hero for this slot.)
5. Story — memories, streaks, and achievements.

Optional 6th: Records/Care Pass (the shareable care summary), which supports the "serious enough for a vet" positioning.

Required sets:

- iOS 6.7" (1290 x 2796, e.g. iPhone 15 Pro Max simulator) — primary required set.
- iOS 5.5" (1242 x 2208, e.g. iPhone 8 Plus simulator) — legacy size; App Store Connect can scale from 6.7" but a native 5.5" set avoids layout surprises.
- Google Play phone (1080 x 2400 or similar 9:16; minimum 2 screenshots, we ship all 5).
- Google Play 7" and 10" tablet sets (Play requires tablet screenshots for full listing quality; the app is phone-first, so capture the phone layout on a tablet-sized window and confirm it renders acceptably — `supportsTablet` is false on iOS, so no iPad set is needed there).
- Play feature graphic: 1024 x 500 (pixel-dog-in-room key art with the wordmark; no device frames, no claims text).

Capture rules: day-mode room for at least the first shot, real (non-lorem) sample data, no debug UI, status bar clean, and captions overlaid only if they restate true v1 features.
