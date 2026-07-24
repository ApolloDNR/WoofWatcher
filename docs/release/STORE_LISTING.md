# WoofWatcher store listing (v1)

> **Submission status — blocked for the shared-account build.** This file is
> the working future shared-account listing draft. It replaces the earlier “no
> account,” “no server,” and “Data Not Collected” answers, but it is not
> approved store metadata. Do not paste it into App Store Connect or Play
> Console until the launch mode is fixed, production data flows are verified,
> and owner/legal review approves the final answers. The current renovation
> targets a shared TestFlight beta first.

Canonical listing copy and store-form review notes for the Expo mobile app
(`artifacts/woofwatcher-mobile`, bundle id
`com.pegasusdreamscapes.woofwatcher`). Every claim below must match the
submitted build's local-first care log, optional provider-synced household,
and foreground walk-route recording.

## Honesty rule (read before editing any copy)

The listing must not claim that a provider-backed feature is live unless that
exact release configuration and its privacy/support evidence are approved. It
must also not claim that location is never requested or that all data always
stays on-device: starting route recording requests precise foreground
location, provider sync can carry the resulting route with the household care
entry, and opening the map requests OpenStreetMap data for the recorded area.

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

- Fast care logging: meals (served through outcome), walks, potty breaks, meds, and notes — built for one-handed, ten-second entries. When you start route recording for a walk, WoofWatcher can use foreground location to draw its map and calculate distance.
- Routines that hold the day together: see what's next, keep the household on the same page, and never wonder whether the dog was fed.
- Health Watch: jot down appetite and tummy observations over time so patterns are easy to show your vet. WoofWatcher records your observations — it never diagnoses and is not veterinary advice.
- Records and Care Pass: keep your dog's important details in one place and share a clean, owner-maintained care summary with a sitter, walker, or vet whenever you choose.
- A living pixel companion: a hand-crafted pixel dog who earns XP and levels only from care you actually logged, in a room that shifts from day to night on the real clock.
- Memories and milestones: streaks, achievements, and little celebrations for showing up every day.

PRIVATE BY DESIGN

- Local-first care works without an account. Provider-synced household features require sign-in when they are enabled in the submitted build.
- Care is cached on your device. Care entries, including recorded walk routes, may also sync with your configured provider and be visible to your household when provider sync is enabled.
- WoofWatcher has no ads and does not use precise location for cross-app tracking. Background location is not enabled.
- Export anytime. Send a full text export of your care data wherever you like, straight from the share sheet.
- Photos are optional. Their final local/provider storage boundary must match the approved release configuration.

One honest note: local preview data has no provider copy. If you sign in to a provider-synced household, follow that provider's approved retention, export, and deletion terms; those terms must be finalized before external release.

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
- User-generated content shared with others: provider-synced household care entries may be visible to members of that household. OS share-sheet exports are also user initiated.
- Ads: none.
- In-app purchases: none in v1.
- Location: optional precise foreground location is requested only after the owner starts walk-route recording. It is used to draw that walk's map and calculate distance. Background location is not enabled.
- Network access: provider-synced care uses the configured care provider. Opening a recorded route map requests OpenStreetMap raster tiles or neighborhood geometry for the recorded area.

## Apple privacy nutrition label

Status: **owner and legal approval required before submission. Do not use the previous blanket “Data Not Collected” answer.**

The current implementation handles **Precise Location** for **App Functionality**. Route points are stored with the walk care entry and can be linked to the signed-in user and household when provider sync is enabled. Opening a route map also requests OpenStreetMap data for the recorded area. The Expo privacy manifest declares precise location as linked, not used for tracking, and used for app functionality.

- Data used to track you: no location tracking or cross-app advertising use is implemented.
- Precise Location: declare App Functionality; linked to the user when the release enables provider-synced household care.
- Before submission, re-audit the final provider configuration and approve every other applicable App Store data category. This document does not invent retention terms or approve the final privacy form.

## Google Play Data safety form

- Status: **owner and legal approval required before submission. Do not answer “No data collected or shared.”**
- Location: disclose precise foreground location for the walk-route app functionality. It is optional at the OS permission layer and background location is not enabled.
- Storage and sharing boundary: the route is saved locally with the walk; in a provider-synced household it may be sent to the configured provider and visible to household members. OpenStreetMap services receive the recorded-area request needed to render the map.
- Re-audit the final provider build for all other Play data types, encryption-in-transit answers, retention, and deletion. Use the approved provider policy and receipts; do not infer those answers from the local cache.
- Committed to the Play Families policy: not enrolled (general-audience app, rated Everyone).
- Independent security review: not claimed in this draft.

## App Review notes (paste into App Store Connect "Notes" and Play "App access")

- The app can open in a local preview without login. If provider-synced household care is enabled in the submitted build, provide App Review with valid reviewer access and matching account/deletion instructions.
- Care is cached locally. Signed-in household care may sync with the configured provider and be visible to household members.
- Camera and photo library permissions are OPTIONAL and requested only when the reviewer chooses to attach a photo (avatar, care log, or record). The app is fully functional if permission is denied. Permission strings are declared in the app's Info.plist.
- Precise foreground location is OPTIONAL and requested only when the reviewer starts recording a walk route. It draws that walk's map and calculates its distance. The app does not enable background location. The saved route follows the same local/provider household boundary as its care entry, and opening the map requests OpenStreetMap data for the recorded area.
- Health features (Health Watch / Bile Watch) record owner observations only. The app displays non-diagnostic language throughout and directs users to a veterinarian; it makes no diagnosis or treatment claims.
- Any provider-backed capability that remains unconfigured in the submitted build is visibly gated as setup needed. Do not paste this note until the final build's enabled providers and reviewer access are confirmed.
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
