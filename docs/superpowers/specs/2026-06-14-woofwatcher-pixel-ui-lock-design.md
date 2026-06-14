# WoofWatcher Pixel UI Lock Design

Date: 2026-06-14

## Decision

Apollo approved the attached pixel UI direction as the visual source of truth for the next WoofWatcher pass.

This spec supersedes loose visual exploration. The app should now converge on the reference boards as closely as practical while preserving the existing mobile-first PWA, Expo, local-first care model, routines/logs relationship, backup/import behavior, reports, Health Watch, Bile Watch, records, Care Pass, WoofGuide routing, and safety boundaries.

## Reference Boards

The selected boards are mirrored in the repo so they do not expire with chat attachments:

- `docs/design/reference/woofwatcher-pixel-reference-board-01.png`
- `docs/design/reference/woofwatcher-pixel-reference-board-02.png`
- `docs/design/reference/woofwatcher-pixel-reference-board-03.png`
- `docs/design/reference/woofwatcher-pixel-reference-board-04.png`

Board 04 is the primary desktop and mobile layout target. Boards 02 and 03 define the cleanest component vocabulary. Board 01 is supporting evidence for spacing, icon preview, color, and mobile route coverage.

## Product Frame

WoofWatcher is a real-life digital pet care app.

Core line: Real care. Pixel heart.

Tagline: Your dog's day, brought to life.

Promise: Care for your real dog. Watch their care twin come alive.

The app should feel like serious dog-care software with a pixel-pet heart, not a generic tracker, toy game, or decorative dashboard.

## Locked Visual Direction

Name: Premium Neo-Retro Pixel Care.

The UI should be warm, compact, scannable, and trustworthy. The reference boards use a cream paper canvas, dark navy navigation shell, copper brand accents, sage completion states, blue hydration/bile signals, and pixel art as the emotional anchor.

Do not drift into:

- Generic SaaS dashboard styling.
- Soft beige lifestyle app styling without the dark shell and pixel identity.
- Purple/blue gradient AI-app styling.
- Full game UI that weakens trust for health, records, reports, and sitters.
- Large marketing hero sections.
- Placeholder cards with no connected workflow.

## Palette

Use these as the implementation target:

- Deep navy: `#081424`
- Shell navy: `#0D182A`
- Navy 2: `#102C40`
- Copper: `#C85A2A`
- Copper bright: `#E07A2F`
- Forest: `#4D8A56`
- Sage: `#6DA36F`
- Sage soft: `#D9BAA7`
- Cream: `#F7F2E8`
- Ivory: `#FFF9EF`
- Blue signal: `#A8CBE8`
- Amber: `#D8A852`
- Rose: `#C96358`
- Stone: `#E6DED2`
- Ink: `#142033`

Cream and ivory are the main content canvas. Navy is the app shell. Copper is brand emphasis and selected action warmth. Sage marks healthy/completed/good states. Blue marks hydration/bile/water states.

## Typography

- Main UI: Inter, Nunito Sans, system-ui, or the current app font if already configured.
- Display accent: Space Grotesk-like blocky display for board-style headers if available.
- Pixel accent: only for logo treatments, small badges, speech bubbles, level labels, HUD meters, and decorative status moments.
- Long care content must stay highly readable.

## Shell Requirements

Desktop:

- Left sidebar in deep navy.
- Selected item is sage/cream with a pixel icon.
- Navigation groups are clear and compact.
- Profile footer shows the current caregiver and Phoenix's current presence state.
- Main content sits on a cream/ivory canvas with thin stone borders.

Mobile:

- Bottom navigation is the primary surface.
- Required tabs: Home, Log, Plans, Health, More.
- Use a central paw/plus-style log affordance only if it still maps clearly to Log.
- Mobile screens must look like finished iOS/Android app screens, not shrunken desktop cards.

## Required Navigation

Care and wellbeing:

- Phoenix Home
- Quick Log
- Household Pulse
- Plans
- Health Watch
- Bile Watch
- Diet & Treats

More tools:

- Care Pass
- WoofGuide
- Avatar Studio

Records:

- Timeline
- Records
- Reports
- Achievements

System:

- Settings

The More screen on mobile must include every overflow route above, with no dead-end tiles.

## Component Language

The reference boards define this vocabulary:

- Thin stone card borders.
- 8px or smaller radii for repeated cards.
- Pixel icon tiles with small labels.
- Retro HUD meters made of segmented bars.
- Compact rows with icon, label, time/context, right chevron or clear action.
- Speech bubbles attached to Phoenix state, not generic help text.
- Cream cards over ivory page canvas.
- Large Phoenix room card as the emotional center.
- Navy bottom bar and navy desktop sidebar as the strongest brand frame.
- Copper micro-headings and route labels.
- Sage primary buttons.
- Navy serious buttons for reports, exports, and WoofGuide.

## Primary Screen Target

Phoenix Home must match the board structure:

- Top greeting with search, notification, date, and caregiver profile.
- Large Phoenix pixel room card with speech bubble.
- Presence chip: "With Emma", "Home Alone", or "Status unknown".
- Mood and status mini cards.
- Next Up card with a concrete action.
- Phoenix Status / status meter card.
- Household Pulse card.
- Upcoming Plans card.
- Quick Log card.
- Health Watch and Bile Watch snapshot cards.
- Care Pass or WoofGuide utility card where space allows.
- Recent Activity or Today at a Glance in the lower grid.

In five seconds, a caregiver must know:

1. Where Phoenix is.
2. Whether Phoenix is alone.
3. How Phoenix feels.
4. What is next.
5. What they can log quickly.

## Mobile Screen Targets

Implement the mobile board set as actual navigable screens:

- Home: pixel room, status meters, next up, today summary, bottom nav.
- Quick Log: grouped care actions, fast tactile tiles, recent logs.
- Plans: today/upcoming routine rows, add/edit plan affordance.
- Health/Bile: calm metric list, non-diagnostic labels, view full report.
- Household Pulse / Alone Time: Phoenix status, timer, return outcome flow.
- Care Pass: credential-style card, tier/perks/export/share actions.
- Avatar Studio: upload/customize/gallery, pixel styles, states.
- Reports: weekly/monthly metrics and view/export report.

## Workflow Guardrails

- No fake cloud sync, payment, push notification, AI, or document-storage claims.
- No medical diagnosis or treatment certainty.
- Every button must perform a real action, route to a real screen, or clearly explain what setup is missing.
- All existing data actions and persistence hooks should remain intact unless replaced with a better real workflow.
- Local-first and backup/import behavior must remain recoverable.
- Meal logging retains served -> outcome lifecycle.
- Potty remains the parent action; pee/poop are outcomes.
- Logs stay editable with sticky notes, trust state, corrections, and household visibility.
- Household Pulse and Alone Time remain manual for v1.5.

## Motion Direction

Motion should feel like care feedback, not decoration:

- Pixel room idle state.
- Subtle tail wag or breathing loop.
- Quick Log tile press and success feedback.
- Meal outcome completion pulse.
- Routine completion pulse.
- Calm Health/Bile state transitions.
- Care Pass export/generation progress.
- Avatar Studio state preview changes.

For now, static pixel assets and CSS/native animation placeholders are acceptable. The code should be shaped for later Rive/Lottie/Reanimated sprites without blocking current delivery.

## Implementation Order

1. Lock references and docs in Git.
2. Create shared visual tokens that match the boards.
3. Build reusable shell and card primitives.
4. Upgrade the Expo mobile screens first.
5. Align the PWA desktop shell and routes after mobile patterns are stable.
6. Add screenshot-based QA when browser or simulator tooling is available.
7. Hand off to Fable/Replit/Figma only after the app has real navigable workflows and a precise visual target.

## Acceptance Criteria

- Reference images are versioned in `docs/design/reference/`.
- The app shell visibly matches the navy sidebar/bottom bar, cream canvas, pixel icons, and compact card language.
- Home looks like WoofWatcher, not a generic pet tracker.
- Mobile is the canonical experience.
- Desktop remains useful as a supporting dashboard.
- Light and dark modes do not break hierarchy.
- The app remains truthful about local-only, provider-ready, and AI-ready states.
- Existing tests pass or failures are documented with exact blockers.
- New UI work does not remove care-domain, records, backup/import, reports, Health Watch, Bile Watch, or Care Pass behavior.

