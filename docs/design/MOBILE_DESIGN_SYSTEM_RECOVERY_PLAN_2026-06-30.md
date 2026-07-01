# Mobile Design System Recovery Plan - 2026-06-30

## Why This Exists

Apollo rejected the current mobile UI direction as too ugly, crowded, overlapping, and confusing. The app must now converge harder on the locked Neo-Retro Pixel Care boards and the simpler Paw Friends mobile reference.

Use these references first:

- `docs/design/reference/woofwatcher-dark-rpg-board-2026-06-30.png`
- `docs/design/reference/paw-friends-mobile-simplicity-reference-2026-06-30.png`
- `docs/design/reference/woofwatcher-pixel-reference-board-05-neo-retro-digital-pet.png`
- `docs/design/reference/woofwatcher-pixel-reference-board-06-ecosystem-supporting-pages.png`

## Screen Recipe

Every primary mobile screen should follow this order:

1. Route header with one clear action.
2. Pixel scene or compact hero that explains the screen emotionally.
3. One primary status or command panel.
4. One selected content module, not multiple competing dashboards.
5. One clear action row.
6. Supporting detail below the fold.

Do not show duplicate metric blocks on the same screen. If a concept has a tab, keep that concept inside its tab instead of repeating it under another tab.

## Layout Rules

- Mobile first: one column, 18px horizontal page padding, 8px card radius.
- Use rows for dense operational data. Avoid two-column card grids when labels, statuses, and actions compete.
- Keep the hero clean: pixel scene plus one compact status panel. Do not stack status console, meter rail, metrics, and review cards all inside the hero.
- One primary action per section. Secondary actions should be smaller and predictable.
- Every touch target must use the shared 44px minimum contract.
- No overlapping avatar HUDs, dog sprites, speech bubbles, or floating nav.
- Pixel art carries emotion; UI typography carries information.

## Navigation Rules

Mobile nav remains simple:

- Home
- Log
- Plans
- Health
- More

Secondary concepts live inside More until they deserve their own primary tab:

- Adventure
- Household Pulse
- My Care Today
- Timeline
- Records
- Reports
- Care Pass
- Access Pass
- WoofGuide
- Avatar Studio
- Achievements
- Settings

## Health Watch Recovery Slice

The 2026-06-30 Health Watch pass is the first proof of this plan:

- Hero now uses one pixel Health Watch stage and one compact care-status panel.
- The old top metric rail and status meter rail were removed.
- Health Snapshot rows replaced the cramped two-column status grid.
- Bile Watch content only appears on the Bile Watch tab.
- The 7-day rhythm chart moved into Health Snapshot, where it is useful but not visually loud.
- Review Packet was trimmed to the top prompts and checklist items.

The later Health polish pass tightened the route further:

- The route header now matches the rest of the mobile app shell instead of using a centered/plain treatment.
- A compact Health command deck gives Appetite, Potty, Vomit, and Water their own fast routes before deeper review content.
- Health signal rows use two-line anatomy plus a short `Log` pill so title, status, detail, and action no longer fight on one line.
- The Health pixel stage and sprite footprint are smaller, keeping the first screen useful instead of dominated by one illustration.

## Quick Log Recovery Slice

The 2026-06-30 Quick Log pass is the second proof of this plan:

- The pixel command stage was tightened so the speech bubble, live sprite, HUD, and action footer no longer compete for the same space.
- The action grid now appears before the teaching rail, matching the Paw Friends-style priority of action first, explanation second.
- A compact `Quick Log Flow` header explains tap, hold, and detail-first safety behavior without turning the screen into a tutorial wall.
- Today support metrics sit between the action console and the full detail composer, so the primary flow stays fast but the care context is still visible.
- The full composer is treated as a secondary detail dock, preserving advanced meal, potty, medication, vomit, notes, trust, and edit behavior without making it the first visual focus.
- A mobile readiness test now protects this screen recipe from regressing back into a crowded stack.

## More Command Hub Recovery Slice

The 2026-07-01 More compact command pass tightens the app's navigation hub:

- The route header now has centered, padded subtitle behavior so preview/native frames no longer read as edge-aligned accidents.
- The Launch Command stage is shorter and keeps its HUD/footer pinned inside the scene, which prevents the illustration from pushing the real directory below the useful first viewport.
- The live pixel sprite remains present, but the stage is treated as navigation context instead of the whole screen.
- Command Directory rows are denser while preserving shared touch-target rules, making Care Today, Household, Records & Passes, Design QA, and Launch QA easier to scan.
- The route is protected by mobile readiness checks for compact stage height, pinned HUD/footer, centered subtitle behavior, and dense directory rows.

## Next Design Passes

1. Log: reduce stage/HUD competition and keep the fast action grid above the floating nav.
2. Records: reduce credential-stage overlap so the Dog ID card and live sprite do not fight for the same focal point.
3. Home: keep refining dark-RPG alignment after the core route tops share the same system.
4. Device visual QA: capture real iOS/Android screenshots for Home, Log, Plans, Health, More, Records, and Avatar Studio before calling the UI store-ready.
