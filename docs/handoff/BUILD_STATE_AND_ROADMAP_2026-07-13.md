# WoofWatcher — Build State & Production Roadmap (2026-07-13)

A straight answer to: where are we, how close to finishing, what's good, what's
weak, what the backend needs, and how to hand off to Claude Code. Grounded in the
actual repo (api-server, lib/db, the proof-gate docs, the test suites), not
guesses.

---

## 1. How close are we? (two honest numbers)

It depends on which product you mean, because WoofWatcher is **local-first** — it
runs fully on the device with no backend.

- **As a polished, single-user, offline app that looks and feels finished: ~90%.**
  Every screen from your mockups is built, tested (711 mobile tests green), and
  runs with zero errors. Someone can open it today and use it for real care.
- **As a production, multi-user, cloud-synced, monetized, App-Store-shipped
  product: ~55–65%.** The entire provider/infrastructure/native/store layer is
  *built in code but deliberately unwired* — it needs real accounts, secrets,
  provisioning, native device QA, and store submission. Plus the art.

The gap between those two numbers is the whole "production" phase below. The good
news: it's mostly *configuration and provisioning*, not *inventing new code* —
the hard engineering is already done and tested.

---

## 2. What's GOOD (high quality, done)

- **The mobile app UI.** Every mockup screen built to your July boards — Today/
  Care Sense, Log, Plan, Trends, Calendar, Health, Reminders, Profile, Records,
  Pack, Story, More, Avatar Studio — plus the shared game-feel motion system.
  711/711 focused tests, typecheck clean, verified on the web export.
- **The care logic (`lib/care-domain`).** This is the brain: meal lifecycle,
  potty flow, mood/energy/trends, weight, reminders, health/bile watch, records,
  care pass, adventure, household logic. ~27 test files, heavily covered. Solid.
- **The backend actually exists and is real (`artifacts/api-server`).** Express +
  Clerk auth middleware + Drizzle ORM + care-domain, with routes for care-state,
  care-entries, household, avatar, care-helper, WoofGuide events, health. 6 API
  test files. This is not a stub.
- **The database schema is real (`lib/db`).** Typed Drizzle schema: users,
  households, householdMembers, householdInvitations, householdAuditEvents,
  careState, careEntries. Ready to migrate onto a real Postgres/Supabase.
- **The honesty discipline.** There's an elaborate "proof-gate" system: no
  provider feature (auth, sync, AI, payments, push) can show as "enabled" unless
  real evidence is attached and you sign off. This is rare and genuinely
  valuable — the app never lies about what's live. Keep it.

## 3. What's WEAK / needs attention

- **Art is the #1 real design gap.** The dog and rooms are PixelLab seed /
  placeholder assets. Your vision doc calls for a real animated sprite pipeline
  (walk/idle/sleep/mood cycles) and day/night rooms. **This is the design work I
  just started in Cowork** (see §7) — it's the one thing only this environment
  can do.
- **No provider is actually live yet.** Auth (Clerk), cloud sync (Supabase),
  WoofGuide AI (OpenAI/Gemini), payments, and push are all built-but-gated. So
  today there are no real accounts, no multi-device sync, no live AI, no
  payments, no push. Expected — but it's the bulk of "production."
- **Native iOS/Android QA has never been run.** Everything is verified on the
  Expo *web* export only. Safe areas, 60fps motion, haptics, and store-grade
  screenshots need a real device/simulator pass (EAS build).
- **CI is red for a billing reason, not a code reason.** GitHub Actions has been
  failing to start jobs because of a GitHub account billing / spending-limit
  problem (documented repeatedly in `docs/BLOCKERS_FOR_APOLLO.md`). Local tests
  pass; remote CI can't run until billing is fixed.

---

## 4. Backend — exactly what Claude Code needs to do

The pattern for every item: **configure the provider for real → attach the proof
→ flip its gate → verify.** In rough dependency order:

1. **Provision the database.** Create a Supabase (or Postgres) project, set
   `DATABASE_URL`, and run the Drizzle migrations from `lib/db` to create the
   schema. Enable Row-Level Security matching the household model. (There's a
   live Supabase connection in *this* Cowork session too, so I can help design/
   inspect the schema and RLS before Claude Code applies it.)
2. **Wire auth (Clerk).** Production Clerk app, publishable/secret keys, redirect
   + deep-link URLs, session/token policy. Connect both the mobile app and
   `api-server` (the Clerk middleware is already written).
3. **Deploy the api-server.** Ship `artifacts/api-server` (Replit Autoscale is
   already configured, or any Node host) with the env secrets, then point the
   mobile app's `EXPO_PUBLIC_DOMAIN` at it.
4. **Turn on care-entry cloud sync.** Once 1–3 are real, satisfy the sync proof
   (Supabase project id, migration/backfill, active-household RLS, retention/
   export/deletion policy) and flip the sync gate. Now it's a real account-backed,
   multi-device app.
5. **WoofGuide AI.** Configure the OpenAI/Gemini key + model policy, keep the
   owner-review write gate and the non-diagnostic vet-safety boundary, flip the
   AI gate.
6. **Payments (only if launching paid).** Decide billing path (App Store / Google
   Play / Stripe), set product ids + prices, prove sandbox receipts + restore +
   entitlements, flip the payments gate.
7. **Push notifications.** Expo push project, APNs (iOS) + FCM (Android)
   credentials, permission copy, quiet hours, then flip the push gate.
8. **Native builds + store.** EAS build for iOS/Android; Apple Developer + Google
   Play accounts, bundle ids, signing; run native device QA; capture store
   screenshots; account-deletion + privacy/legal + support runbook; submit.

Env vars the backend needs (from `.env.example`): `DATABASE_URL`,
`CLERK_SECRET_KEY` / `CLERK_PUBLISHABLE_KEY` /
`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `EXPO_PUBLIC_DOMAIN`, and the
Gemini/OpenAI keys for WoofGuide.

---

## 5. External blockers only YOU (Apollo) can clear

These need your accounts/decisions/money — no agent can do them:

- **Fix GitHub billing / spending limit** so CI can run (this is blocking remote
  verification today).
- **Create/authorize the provider accounts:** Supabase, Clerk, OpenAI (or
  confirm Gemini), and — for launch — Apple Developer + Google Play, and a
  payments provider.
- **Product decisions:** paid tiers + prices, whether multi-dog / Access Pass /
  Adventure cloud media are launch or post-launch, and the launch target
  (Expo preview → TestFlight/Play beta → public).
- **Legal/privacy:** approve privacy policy, terms, refund/support policy, and
  the veterinary-boundary language before public launch.

---

## 6. Recommended build sequence

- **Phase 0 — Unblock (hours).** Fix GitHub billing. Push branch
  `claude/mockup-parity-polish`, open a PR, let CI go green, merge.
- **Phase 1 — Make it real, single-player cloud (days).** Supabase + migrations +
  RLS, Clerk auth, deploy api-server, turn on sync. Now it has real accounts and
  multi-device.
- **Phase 2 — Art + native (parallel).** Cowork (me) generates the sprite/room
  asset set; Claude Code wires them in and does EAS native builds + device QA.
- **Phase 3 — Monetize + launch.** Payments, push, store accounts, legal/support,
  screenshots, submit to App Store / Play.

Design (art, visual polish, screen tweaks, QA) → do with me in Cowork. Everything
that writes code or config into the repo and ships → Claude Code.

---

## 7. Art — started this session (Cowork only)

I've begun generating the production art the app is missing, palette-locked to
your mockups (parchment / forest / gold): a **day room background** (9:16,
high-horizon, no dog baked in per the vision doc) and a **dog character concept**.
These are for you to react to before I generate the full set (day + night rooms,
the animated dog sprite sheets via the Scenario pipeline, marketing art). The
room art is production-usable; the animated *sprite* still needs the Scenario
Retro-Diffusion step the vision doc specifies.

---

## 8. Handoff mechanics (unchanged, still valid)

Everything is on branch `claude/mockup-parity-polish` (git bundle + patches
delivered). Node 24 required. Read order for any new agent:
`docs/handoff/HANDOFF_2026-07-12.md` → this file →
`docs/design/APOLLO_MASTER_VISION_PROMPT.md`. Keep GitHub as the single source of
truth so Cowork and Claude Code stay in sync.
