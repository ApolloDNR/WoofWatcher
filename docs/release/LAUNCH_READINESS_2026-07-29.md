# WoofWatcher — Launch Readiness Scorecard (updated 2026-07-30)

The single, honest, production-standard answer to: *"Is this a solid, monetizable
product ready for the App Store, and what exactly is left?"*

Every claim here was verified this session — code run, tests executed,
screenshots rendered and inspected, materials read line by line, monetization
path traced through the actual code. Nothing is assumed.

---

## 0. Verdict

**The app is a solid, genuinely valuable release candidate, but it is not yet
ready to submit.** The engineering foundation, real persistence, GPS,
file-export, and data-safety work remain strong. A second launch audit found
store-facing truth, screenshot, production-surface, and native-proof gaps that
must close before App Review.

**It is NOT ready to charge money at first submission.** Real subscriptions are a
multi-week build plus business setup only you can do (Apple Paid Apps agreement,
banking/tax, store products, pricing decisions). The professional path is
**launch free now, add paid subscriptions as a fast-follow v1.1** — reasoning in
§6.

The store/legal/configuration gaps that can be fixed in-repo are now in the
launch-hardening pass. Submission still depends on a signed TestFlight build,
physical-iPhone QA, App Store Connect identifiers, a review phone number, legal
date/jurisdiction confirmation, and Apollo's approval of the exact binary.

---

## 1. Production quality — VERIFIED ✅

| Check | Result |
|---|---|
| Workspace typecheck (all 5 packages) | **Clean** — 0 errors |
| Focused test suite | **755 / 755 pass** on Node 24.14.0 with pnpm 10.24.0 |
| Full CI build | **Passed** — all workspace typechecks/builds, Expo export, runtime smoke, and live-preview proof |
| Web export smoke | **Passed** — 270 files exported |
| Runtime route smoke | **Passed** — all 13 user routes |
| Production routes / dead ends | **Passed** — production policy hides provider-only household, event, future-dog, sync, account, push, AI, and payment controls while preserving internal QA surfaces |
| Store-material validation | **Passed** — six 1290×2796 iPhone shots, six 1080×1920 Play shots, 1024×500 feature graphic, and 512×512 Play icon |
| Honesty of unavailable features | **Store rule locked** — no positive cloud sync, account, push, live AI, or purchase claim is allowed in free v1 |
| Data-safety laws | **Held** — erase-generation guard, optimistic+reconciled writes, storage-health warnings surfaced, idempotent creates, and picked care photos copied to durable app storage before persistence |
| Generated native config | **Passed** — iOS 15.1 target, foreground location only, no microphone/always/background location usage key, no Clerk native linkage; Android unused audio permission removed and ImagePicker's legacy photo permissions retained for older-OS compatibility |
| EAS macOS install lock | **Passed** — pinned pnpm 10.24.0 accepts the frozen lockfile with Darwin arm64/x64 native tooling retained |

This is the quality bar of a real product, not a demo.

---

## 2. Product completeness & value

**Strongest, genuinely useful features (the reasons someone keeps it):**
1. **Fast care logging** — 10-second, one-handed meal/potty/walk/meds entry with
   double-tap dedupe and undo. The daily loop, and it's solid.
2. **Records / Care Pass / Dog ID with real file export** — generates real
   HTML/PNG/SVG care summaries to share with a vet or sitter. Useful at a real
   vet visit.
3. **Local-first data safety** — genuinely well-engineered; most v1 apps lack it.
4. **Health Watch / reminders derived only from real logs** — non-diagnostic,
   honest, useful for spotting patterns to show a vet.
5. **The living pixel care-twin + Story/Adventure/XP** — the emotional retention
   hook, and every point of it is earned from real logged care.

**Honest ceilings (fine for v1, but know them):**
- **Effectively a single-dog app.** Multi-dog is data-modeled but gated with an
  honest "coming soon." Many owners have 2+ dogs — this is the main limitation.
- **WoofGuide** is deterministic owner-reviewed guidance, not a live AI chat (by
  design, honestly labeled).
- **Household sharing is local drafts only** — cross-device sync is built but
  gated off. The store listing correctly scopes the app to single-device.

None of these block launch **as long as the listing describes a single-device,
local-first app** — which it does.

---

## 3. Truthfulness fixes and corrections

Two defects where the app's behavior didn't match its words. Both fixed:

1. **Location was undisclosed.** Foreground walk recording is now disclosed in
   the listing, privacy policy, permission prompt, and review notes.
2. **The route map contradicted “local-only.”** The prior map requested remote
   OpenStreetMap tiles and Overpass geometry using location-derived
   coordinates. Launch hardening removes those paths in favor of bundled/local
   rendering and adds a no-remote-map regression check. “Data Not Collected”
   remains valid only while that regression check passes.
3. **Caregivers were labeled "Synced," implying cross-device sync** that doesn't
   exist. Renamed to **"Ready"** (people) / **"Covered"** (care board) in
   `more.tsx`, `pack.tsx`, `calendar.tsx`. The real sync-engine labels were left
   untouched.

---

## 4. Materials completeness scorecard

| Material | Status | Owner of remaining gap |
|---|---|---|
| Store listing copy (name, subtitle, short + full description, keywords, category) | ✅ Complete, within all character limits | — |
| Apple privacy label (Data Not Collected) + Play Data safety | ✅ Complete & accurate | — |
| Content rating answers | ✅ Corrected: current Apple questionnaire declares Health/Wellness + infrequent Medical/Treatment information; expect calculated 13+ | — |
| App Review notes | ✅ Complete (now includes location) | — |
| Privacy Policy + Terms | ✅ Publisher/contact resolved and public no-login privacy/support/terms sections are live | **Apollo:** confirm effective date + jurisdiction |
| `app.json` (version, bundle id, permissions, icons) | ✅ Production-correct; generated native projects confirm the minimal permission footprint | **Apollo:** `eas init` writes the EAS projectId |
| `eas.json` (production build + submit profiles) | ✅ Build profile ready | **Apollo:** submit credentials (ASC API key / Play service account) |
| **Store screenshots** | ✅ Generator hardened for coherent real routines/logs, full viewport, 9:16 Play art, and Care Pass instead of the unexplained Health Score | **Apollo:** upload only after final visual review |
| Play feature graphic (1024×500) | ✅ **Generated this session** | **Apollo:** upload |

**Icons verified on disk:** `app-icon.png` 1024×1024 (no alpha — correct for
iOS); adaptive/splash 1024×1024. A 512×512 Play hi-res icon downscales from it.

---

## 5. Store assets generated this session

Filmed from the **real app** with real care seeded through its own UI, in
`docs/release/store-screenshots/`:

- **iPhone 6.9" accepted size** (1290×2796) — Today, Fast Log, Plan, Story, Pack, Care Pass — 6 shots
- **Google Play phone** (1080×1920, true 9:16) — same 6 screens
- **Play feature graphic** — 1024×500
- **Play high-resolution icon** — 512×512 RGBA

The generated pack must pass `validate-store-materials.mjs` and visual review.
Do not upload Android tablet art until tablet layout is explicitly supported and
tested.

---

## 6. Monetization — the real answer

**What exists:** a polished "WoofWatcher Plus" preview screen and a complete
plan/entitlement data model (Free / Plus / Family, 14 mapped features).

**What does NOT exist (the honest part):**
- **No billing SDK** and **no buy button** anywhere. Checkout is hard-gated off
  in four independent layers.
- **No feature is actually gated** — every "premium" feature is fully free today.
  The entitlement model is display-only marketing scaffolding.
- **Prices are placeholder ranges**, not real price points.

**To actually charge money (honest scope):**
- **Build (multi-week, mostly Large):** add `react-native-purchases`
  (RevenueCat), a config plugin + native rebuild of both platforms, an entitlement
  context, real purchase buttons, a **mandatory Restore Purchases button** (Apple
  3.1.1), subscription disclosure UI (Apple 3.1.2), and — the big one — **newly
  gate ~10 features across the app without creating dead ends or gutting the free
  tier** (directly in tension with our "no dead ends / preserve care workflows"
  rules; this is careful product work, not just wiring).
- **Business setup — only you (Apollo):** Apple Paid Applications agreement +
  banking/tax forms; App Store Connect subscription products; Google Play
  subscription products; a RevenueCat account + keys.
- **Decisions — only you:** real prices, tier structure (Free/Plus/Family or
  just Free/Plus), monthly vs annual, free-trial y/n, and **exactly what goes
  behind the paywall vs stays free** so the free tier still feels solid.
- **Materials that must be redone if paid:** content rating flips to "has
  purchases," Apple privacy label + Play Data safety add purchase/identifier
  data, App Review notes, subscription terms, and the legal copy that currently
  says "no in-app purchases."

**Recommendation: launch free now (v1), add subscriptions in v1.1.** Why:
1. The app is coherent and shippable as free **today**; adding IAP forces redoing
   every privacy/rating/legal answer and adds a whole new review surface.
2. IAP is a genuine multi-week effort *chiefly because nothing is gated yet* —
   real work, not plumbing.
3. Most blockers are your real-world business setup regardless of code, and the
   pricing/packaging isn't decided.
4. A monetized *first* submission invites heavier review scrutiny; a rejected
   paywall would block the entire launch. As a v1.1 update, a paywall hiccup
   never holds the app hostage.
5. The codebase was deliberately architected for exactly this staged path.

---

## 7. The remaining path — who does what

**Only you can do these (accounts / money / legal — no code):**
1. Enroll in **Apple Developer Program** ($99/yr) and create the App Store
   Connect app record.
2. Create a **Google Play Console** account ($25). **Decide account type early:**
   a personal account created now requires a 14-day / 12-tester closed test
   before production; an organization account skips that but needs a D-U-N-S
   number. This can add 2+ weeks.
3. Confirm the legal effective date and jurisdiction; a lawyer glance is
   recommended.
4. Provide App Review phone, App Store Connect Apple ID, Apple Team ID, and EAS
   project ID.

**Resolved public hosting:** privacy, support, and terms are live without login
at `https://woofwatcher-support.paoloaduran.chatgpt.site/#privacy`,
`https://woofwatcher-support.paoloaduran.chatgpt.site/#support`, and
`https://woofwatcher-support.paoloaduran.chatgpt.site/#terms`.

**Automated once your accounts exist (anyone with credentials runs these):**
5. `eas init` → clean production build → upload to internal TestFlight.
6. Install the signed build and pass GPS, permissions, sharing, safe areas,
   keyboard, VoiceOver, export, deletion, and production-route QA on a physical
   iPhone.

**Then:** paste listing copy + privacy URL into the store forms (answers are
pre-written in `STORE_LISTING.md`), upload the screenshots from
`docs/release/store-screenshots/`, complete the privacy/rating forms, and submit.
Apple review ≈ 1–2 days (budget a week for a first app); Google up to 7.

---

## 8. Bottom line

- **Product:** solid, valuable, honest, verified. ✅
- **Materials:** truthfulness and dimensions are hardened; public URLs are live;
  owner identifiers remain blocked.
- **Screenshots:** regenerated from one coherent local care state and require
  final visual review.
- **To submit (free v1):** merge the verified hardening PR, confirm the remaining
  legal choices, create/link store accounts, and pass signed TestFlight
  physical-device QA.
- **To monetize:** a deliberate v1.1 — I can build the IAP integration on your
  word once you've made the pricing/packaging decisions and done the Apple/Google
  business setup.
