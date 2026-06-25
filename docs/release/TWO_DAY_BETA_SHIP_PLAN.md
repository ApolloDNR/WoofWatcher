# WoofWatcher Two-Day Beta Ship Plan

Date: 2026-06-25

## Decision

The two-day target is an internal beta / owner-preview ship, not a public App Store or Play Store launch.

This keeps the product moving fast without pretending that provider credentials, Supabase migration/RLS, payments, legal/privacy approval, store accounts, or final native QA are already complete.

## Ship Target

Ship a polished Expo/PWA beta candidate that Apollo can preview, share with a small trusted tester group, and hand to design polish tools without losing the real care workflows.

The beta can include:

- Local-first Phoenix care workflows.
- Home, Log, Plans, Health, More, Records, Reports, Care Pass, Avatar Studio, WoofGuide, and Launch Readiness.
- Meal served-to-outcome lifecycle.
- Potty parent/outcome model.
- Household pulse, Access Pass drafts, My Care Today, care logs, reminders, records, and report packets.
- PixelLab asset-backed care twin visuals and state-aware animation architecture.
- Release packet and store-prep packet that clearly say public launch is not approved yet.

The beta must not claim:

- App Store or Play Store approval.
- Provider-backed household sync if Supabase/Clerk/provider gates are not configured.
- Live payments.
- Live AI provider behavior without keys/policy.
- Live document/photo storage without approved storage rules.
- Veterinary diagnosis or treatment certainty.

## 48-Hour Priority Order

1. Keep the app compiling, exporting, and opening as an Expo/PWA beta.
2. Make Launch Readiness distinguish internal beta readiness from public launch readiness.
3. Capture or prepare the native iOS/Android QA path through `/care-twin-qa`.
4. Keep the core workflows navigable and fast: Home, Log, Plans, Health, More.
5. Preserve all truth boundaries around provider setup, payments, AI, storage, and store submission.
6. Commit and push each verified beta-shipping slice.

## Owner/Test Checklist

- Open the Expo/PWA beta on phone-size viewport.
- Visit Home, Log, Plans, Health, More, Records, Avatar Studio, and Care Pass.
- From More, open Launch Readiness.
- Read the 48-hour beta card's next actions.
- Tap `Open QA Cockpit` if the card says device proof is still needed.
- Share the Launch Packet.
- Open `/care-twin-qa`.
- Use the `48-hour beta run` card to start with the next required launch-critical surface.
- Read the `Next device mission` panel before leaving the cockpit: it shows route, setup steps, pass criteria, evidence count, and the Needs tune rule for that screen.
- Tap `Open Next Surface`, test the route, capture proof, then return to `/care-twin-qa`.
- If the target screen shows `Return to QA Cockpit`, use that banner after capture instead of manually hunting for the QA route.
- Capture at least one iOS screenshot and one Android screenshot when devices/simulators are available.
- In `/care-twin-qa`, set `Tag screenshot evidence` to iOS or Android before attaching the screenshot from Photos.
- Attach screenshots from Photos to the current mission through the 48-hour beta card's `Attach proof` control, or to the matching QA surface farther down the cockpit.
- Confirm the attached file shows the expected counted platform label.
- Mark the current mission `Pass` or `Needs tune` from the 48-hour beta card before moving on.
- Mark any visual route that feels below App Store quality as Needs tune.
- Tap `Share Beta Packet` only after local verification and owner sign-off are still truthful for an internal beta.

## Current Gates

Shippable for internal beta after local verification passes:

- Focused behavior/readiness tests.
- Mobile TypeScript.
- PixelLab asset verification.
- Package-local Expo web export.
- `git diff --check`.

Still blocked for public launch:

- Real iOS/Android screenshots and human visual approval.
- Supabase migration/RLS/provider access rules.
- Provider-backed invite delivery and household sync approval.
- Storage retention/export/deletion policy.
- Support, privacy/legal, refund, and veterinary-boundary approval.
- Apple Developer, Google Play, Expo/EAS credentials, and final store submission approval.
