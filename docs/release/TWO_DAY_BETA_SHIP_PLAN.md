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
- Tap `Share Beta Handoff` when you need one owner-readable packet for Apollo, a helper, Fable, Replit, or a design-polish pass.
- If any target is marked `Needs tune`, tap `Share Fix Brief` from More's Native QA Next Captures before editing so the first route issue has a focused repair packet.
- Share the Launch Packet.
- Open `/care-twin-qa`.
- Use the `48-hour beta run` card to start with the next required launch-critical surface.
- Use the large cockpit actions first: platform tag, `Open Next Surface`, `Attach proof`, `Pass`, `Needs tune`, `Share QA`, and per-surface `Open surface` are all intended to be phone-sized beta controls.
- If the card shows `Owner route loop`, follow that ordered checklist before marking the mission Pass; it is the beta's real owner journey, not an optional note.
- When the current mission is `Owner Preview Core Loop`, use the bottom nav to open Home, Log, Plans, Health, and More in order, then confirm Records, Avatar Studio, and Care Pass are reachable from More without dead ends.
- On Home, confirm the header/menu action, Avatar Studio hero entry, household presence panel, Adventure inline action, pixel-room crop, and bottom-nav fit feel phone-sized, useful, and aligned with the premium neo-retro care-twin promise.
- In the owner-preview loop, quick-log one safe care event or open the detail sheet, then undo it or leave a QA note if you do not want the test log to stay in local preview data.
- On Log, confirm the care-type tabs, Undo/Add details, meal outcome, potty outcome, trust review, walk finish, and alone-time return controls feel phone-sized and easy to tap.
- On Plans, confirm schedule tabs, Add plan, Find event, suggestion add, routine done, owner chips, save, and delete controls feel phone-sized and easy to tap.
- On Health, confirm the Health/Bile tabs plus `Log health note` and `Records` actions feel phone-sized, calm, and clearly non-diagnostic.
- On More, confirm Launch Readiness, Native QA Next Captures, provider setup, household invite, Access Pass, profile edit, and save/share actions feel phone-sized and easy to tap.
- On Records, confirm Dog ID share/print, medication search/filter, Care Pass preview, report resend/print, record add/delete, attachment, and sheet save/cancel controls feel phone-sized and easy to tap.
- On Avatar Studio, confirm Scan/Template/Customize/Emotes tabs, Gallery, Take photo, template tiles, coat swatches, face options, accessories, mood previews, Reset, and Save Avatar controls feel phone-sized and easy to tap.
- On Adventure, confirm quest cards, private memory capture, `Save Memory`, and `Share Adventure` feel phone-sized, useful, and aligned with the real-care RPG promise instead of decorative game fluff.
- On WoofGuide, confirm quick questions, suggested actions, the send button, and owner-review Cancel/Apply draft controls feel phone-sized, useful, and clearly non-diagnostic.
- Write the `Mission note` in the 48-hour beta card before marking the owner-preview mission Pass; this note is required proof for the no-dead-ends route loop.
- Read the `Next device mission` panel before leaving the cockpit: it shows route, setup steps, pass criteria, evidence count, and the Needs tune rule for that screen.
- Tap `Open Next Surface`, test the route, capture proof, then return to `/care-twin-qa`.
- If the target screen shows `Return to QA Cockpit`, use that banner after capture instead of manually hunting for the QA route.
- Capture at least one iOS screenshot and one Android screenshot when devices/simulators are available.
- For the owner-preview loop, capture the iOS screenshot on Quick Log or Log and the Android screenshot on More's Launch Readiness panel.
- The shareable QA script should include the same route loop: Home, Log, Plans, Health, More, Records, Avatar Studio, Care Pass.
- In `/care-twin-qa`, set `Tag screenshot evidence` to iOS or Android before attaching the screenshot from Photos.
- Attach screenshots from Photos to the current mission through the 48-hour beta card's `Attach proof` control, or to the matching QA surface farther down the cockpit.
- Confirm the attached file shows the expected counted platform label.
- Mark the current mission `Pass` or `Needs tune` from the 48-hour beta card before moving on.
- If the card shows `Pass pending proof`, the mission is not complete yet; attach the missing screenshots or save the required Mission note until that gate clears.
- In More's Launch Readiness panel, check Native QA Next Captures before sharing: if `Proof status` says `Pass pending proof`, tap `Finish Proof`, attach proof or save the Mission note in `/care-twin-qa`, and recheck before moving on.
- Use `/care-twin-qa`'s `Share QA` action after writing mission notes or attaching proof; it now includes the live native capture plan before the full release QA, store packet, and care-twin state report.
- Use More's `Share Beta Handoff` action after the saved proof state is current; it combines the beta verdict, public-launch boundary, next device mission, missing proof, route loop, and truth boundaries in one packet.
- Mark any visual route that feels below App Store quality as Needs tune.
- When a visual route is marked Needs tune, use More's `Share Fix Brief` action to send the exact route, QA note, proof gaps, setup/repro steps, done condition, and return-to-`/care-twin-qa` instructions before repairing it.
- Tap `Share Beta Packet` only after local verification and owner sign-off are still truthful for an internal beta.

## Current Gates

Shippable for internal beta after local verification passes:

- Focused behavior/readiness tests.
- Mobile TypeScript.
- PixelLab asset verification.
- Package-local Expo web export.
- `git diff --check`.

Current environment note:

- The latest cross-platform install-guard slice removed the root `sh -c` preinstall dependency that was blocking Windows package/export attempts before Expo could run. `preinstall` now calls `node scripts/enforce-pnpm-install.mjs`, which still removes forbidden npm/yarn lockfiles and rejects npm/yarn user agents while running in a Windows-friendly Node process.
- The latest Expo config slice also declares `ios`, `android`, and `web` platforms in `artifacts/woofwatcher-mobile/app.json` and sets `expo.web.bundler` to `metro`, matching the committed `smoke:web` export path. A direct package-local Expo CLI export attempt now advances past the earlier Metro-platform configuration error and stops at the current dependency-layer blocker: `Cannot determine the project's Expo SDK version because the module 'expo' is not installed`.
- Mobile TypeScript/export remain blocked in this cleaned Windows shell by the missing Expo/mobile dependency layer, local `pnpm` is still not on PATH here, and no local iOS/Android simulator/tooling is visible here. Re-run install, TypeScript/export, and actual device capture from Replit, Git Bash/WSL with pnpm installed, CI after billing is fixed, or a native-device environment before treating this as dependency/export/device-proven.

Still blocked for public launch:

- Real iOS/Android screenshots and human visual approval.
- Supabase migration/RLS/provider access rules.
- Provider-backed invite delivery and household sync approval.
- Storage retention/export/deletion policy.
- Support, privacy/legal, refund, and veterinary-boundary approval.
- Apple Developer, Google Play, Expo/EAS credentials, and final store submission approval.
