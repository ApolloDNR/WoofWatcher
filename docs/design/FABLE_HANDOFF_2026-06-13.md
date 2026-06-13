# Fable Handoff - WoofWatcher v1.5 Skeleton

## Purpose

This handoff is for the Fable/Replit visual pass. The app should not be rebuilt from scratch unless a specific architecture blocker is found. The current repo already has the local-first care model, persistence, backup/import, reports, Health Watch, Bile Watch, records, routines/logs relationship, and PWA route skeleton.

Fable's job is to make it feel premium, animated, and emotionally memorable without breaking the care workflows.

## Preserve

- Local-first state and localStorage behavior.
- JSON backup import/export and care-room transfer.
- Query route switching through `?tab=`.
- Existing `data-action`, `data-form`, and `data-tab` hooks.
- Meal served-to-outcome lifecycle.
- Potty parent/outcome flow.
- Household Pulse and manual alone-time flow.
- Health Watch and Bile Watch non-diagnostic language.
- Scoped Care Pass exports.
- WoofGuide owner-reviewed routing and local fallback.
- Avatar Studio state inventory and local reference photo memory.
- Evidence-based Achievements model.
- Settings truth surface for local-only, backup, import, provider readiness, and safety boundaries.

## Current PWA Routes

- Phoenix Home
- Quick Log
- Plans
- Health Watch
- Household Pulse
- Diet & Treats
- Timeline
- Records
- Reports
- Care Pass
- WoofGuide
- Avatar Studio
- Achievements
- Settings
- More directory

## Highest-Impact Visual Pass

1. Phoenix Home
   - Make the pixel room the emotional center.
   - Keep the first-screen answers obvious: where Phoenix is, whether she is alone, how she feels, what is next, and what can be logged.
   - Turn the new "Where Phoenix is" and Health/Bile snapshot cards into premium, glanceable modules.

2. Quick Log
   - Make action groups fast and tactile.
   - Add save feedback, selected-state motion, and compact detail flows.
   - Keep Meal and Potty as structured flows, not one-tap-only actions.

3. Health, Bile, Diet, Records
   - Keep health language calm and non-diagnostic.
   - Use color and icons for watch/review/steady states without making it look clinical or scary.
   - Make records and Care Pass feel serious enough for vets and sitters.

4. Avatar Studio
   - Replace template cards with a polished upload/customize/state preview flow.
   - Required states: Happy, Calm, Excited, Sleepy, Anxious, Bored, Hungry, Proud, Home Alone, Not Feeling Well.

5. Achievements
   - Keep achievements meaningful, not coin-like.
   - Style them as care milestones based on real evidence.

6. Settings
   - Keep Settings trustworthy and plain-spoken.
   - Do not imply cloud sync, live AI, provider auth, payments, push notifications, or document storage are enabled until they are.

## Motion Direction

- Pixel room idle animation.
- Tail wag, sleepy idle, anxious glance, proud sparkle, home-alone waiting, and not-feeling-well low posture.
- Quick Log tap feedback.
- Meal outcome completion feedback.
- Routine completion pulse.
- Care Pass generation/export animation.
- Health/Bile status should transition calmly, without alarmist effects.

## Visual Guardrails

- Premium Neo-Retro Pixel Care.
- Use readable UI typography for real content.
- Pixel accents are for Phoenix, badges, emotes, labels, and motion.
- Light and dark modes must both be designed.
- Do not bury core workflows behind decorative cards.
- No dead buttons or fake integrations.
- No veterinary diagnosis or treatment claims.
- No claim of live AI unless an OpenAI key/provider is actually configured.

## Runtime QA Note

Codex could not attach to the in-app Browser tool in this session because the `iab` browser target was unavailable. Local behavior and syntax checks pass, and GitHub Actions is the authoritative build/typecheck gate, but Fable/Replit should perform visual runtime QA with screenshots across mobile and desktop.

## Suggested Fable Task

Polish the existing WoofWatcher PWA into a premium neo-retro pixel dog-care app while preserving the current route structure, local-first workflows, state hooks, data actions, non-diagnostic health language, and backup/import behavior. Start with Phoenix Home, Quick Log, Health/Bile, Care Pass, Avatar Studio, Achievements, and Settings.
