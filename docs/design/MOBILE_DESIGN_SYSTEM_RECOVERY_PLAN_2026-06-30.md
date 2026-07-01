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

## Log And Records Stage-Dock Slice

The 2026-07-01 Log/Records stage-dock pass fixes the most visible remaining overlap from the route visual consistency pass:

- Quick Log keeps the animated pixel scene, but the care-IQ HUD and selected action now sit in a separated command dock below the room instead of floating over the dog.
- Quick Log trims the tutorial copy to one line: `Tap saves. Hold opens details.` The first quick-action row now appears above the floating paw nav in the 390x844 preview.
- Records keeps the Records Command Vault pixel scene, but the Dog ID plate and saved/ready/alerts HUD now sit in a dock below the scene instead of covering the sprite and room.
- Both routes are protected by mobile readiness checks that prevent the old `marginTop`/absolute overlay HUD pattern from returning.
- Chrome proof exists at `tmp/route-log-compact-stage-dock-final.png` and `tmp/route-records-credential-dock-final.png`; native iOS/Android screenshots are still required before store-ready design sign-off.

## Compact Route Visual QA Slice

The later 2026-07-01 compact visual QA pass tightened the screens Apollo
flagged as still not App Store quality:

- Quick Log now keeps the animated command scene as flavor, not the whole
  screen. The sprite, speech bubble, and command dock are smaller so the first
  quick-action grid is visible immediately.
- Health Watch now treats the first Health Snapshot as the primary utility
  panel, with four priority rows before the pixel room. Deeper report content
  stays below the fold instead of colliding with the floating paw nav.
- Avatar Studio now follows the `one dog, one room, one truth label` rule:
  one main pixel dog, one small identity card, one small template-built badge,
  and one concise PixelLab caption. Duplicate HUDs and long hero summaries are
  not allowed on the first viewport.
- Clean export proof was captured at
  `tmp/design-audit-2026-07-01-final/home.png`,
  `tmp/design-audit-2026-07-01-final/log.png`,
  `tmp/design-audit-2026-07-01-final/health.png`, and
  `tmp/design-audit-2026-07-01-final/avatar-studio-final.png`.

## Plans Schedule-First Slice

The 2026-07-01 Plans compact pass applies the same rule to schedule-heavy
screens:

- Plans keeps a pixel command scene, but the command scene is compact context,
  not the main product.
- `Mission Schedule` now appears before `Today's Missions` so the owner sees
  the actual care plan before secondary explanations.
- The command stage, speech bubble, sprite, HUD, mission rows, and action chips
  are all smaller to avoid poster-like first screens.
- Mission rows use one-line detail copy. If a task needs more context, the
  existing detail/edit flow owns it.
- This route is protected by readiness tests for schedule-first order, compact
  command-stage height, and compact mission rows.

## Quick Log And Health Artwork Chrome Polish

The later 2026-07-01 artwork/chrome pass tightened two routes that still felt
visually off against the saved Option B boards:

- Quick Log now uses stretch-framed pixel room artwork instead of a cover crop
  that turned the command scene into a blank wall.
- The Quick Log live Phoenix sprite is larger, lower, and closer to the scene
  floor, with a lighter shade layer and a wider speech bubble.
- Health keeps the utility-first hierarchy from the previous recovery pass, but
  the support pixel room is more compact: lower stage height, smaller sprite,
  lighter shade, shorter speech bubble, and tighter health HUD.
- These changes preserve the stage-dock rule: real care actions and health
  status remain primary, and the game-feel layer supports the workflow instead
  of fighting it.
- Fresh screenshot proof is still pending because local Chrome exited
  successfully without writing PNG files during this pass. Native iOS/Android
  visual proof remains required before design sign-off.

## Compact Bottom Nav Chrome Recovery

The 2026-07-01 compact bottom-nav pass fixes the global chrome issue Apollo
called out after reviewing the mobile preview:

- The floating paw nav is now treated as app chrome, not a large game overlay.
- Shared mobile metrics use a shorter tab bar, smaller center paw FAB, tighter
  web bottom offset, and slightly wider horizontal inset.
- Tab labels, tab item spacing, FAB icon size, and shadow weight were reduced
  to match the calmer premium mobile app direction.
- Route bottom padding was lowered only after the chrome was compacted, so the
  app keeps usable breathing room without forcing first-screen command cards
  too far below the fold.
- `mobileLayout.test.ts` now guards against the old oversized paw chrome coming
  back and requires the command-card route height to stay within the intended
  compact budget.

Design rule:

- Bottom navigation should feel like a stable game-controller dock.
- It must never hide the first actionable row on Home, Log, Plans, Health,
  Records, More, or Avatar Studio.
- If a route still feels crowded, fix the route hierarchy first; do not enlarge
  the bottom nav to compensate.

## Avatar Studio Hero Declutter

The 2026-07-01 Avatar Studio pass applies the same route-clarity rule to the
care-twin creation surface:

- The first hero follows `one dog, one room, one bottom truth label`.
- The old in-room console bar, top-right ID card, and separate live-chip overlay
  were removed because they fought the dog and made the screen feel like a
  mockup collage instead of a focused app surface.
- The bottom label now carries the production truth: `Template-built` or
  `Scan-assisted`, the dog name, and `Live PixelLab sprite rig.` or the still
  preview boundary.
- The scan workflow cards are shorter so the first owner action sits higher on
  compact phones.
- A mobile readiness guard rejects the old stacked HUD pattern.

Design rule:

- Avatar Studio may show production truth, but not by stacking multiple HUDs on
  top of the dog.
- PixelLab template matching must stay truthful and owner-approved.
- Native iOS/Android screenshots and a gait/crop note remain required before
  store-ready avatar sign-off.

## Next Design Passes

## Health Flagship Room Redesign

The 2026-07-01 Health pass reverses the earlier compact-support choice because
Apollo's current direction is that the core health route should still feel like
a premium care-twin screen, not a utility page with a small decorative room.

- Health now opens with one flagship pixel room and one status panel.
- The old separate compact snapshot card was removed.
- The room HUD strip was removed so the scene is not competing with repeated
  score/bile chrome.
- The score, `CARE STATUS`, support copy, 7-day rhythm, and health signal rows
  live inside a single panel below the room.
- The review packet remains below the flagship room as the serious vet/sitter
  handoff surface.
- A readiness guard rejects the old duplicate compact snapshot and room-HUD
  pattern.

Design rule:

- Health Watch should feel calm and trustworthy, but still alive.
- Use one pixel room and one primary status panel before review content.
- Do not stack multiple score/HUD layers around the same room.
- Keep medical language non-diagnostic and route actions to real logging,
  records, or review-packet workflows.

## Next Design Passes

1. Device visual QA: capture real iOS/Android screenshots for Home, Log, Plans, Health, More, Records, and Avatar Studio before calling the UI store-ready.
2. Route Visual Consistency: mark the first route with overlap, clipped copy, hidden primary action, duplicate-avatar behavior, bottom-nav collision, or mockup drift as Needs tune.
3. Home and Avatar Studio: continue dark-RPG/game-feel alignment once native screenshots identify the highest-impact remaining drift.
4. Polish pass: use the one-room/one-status-panel rule on any remaining route where a HUD, credential card, or duplicated metric rail is fighting the pixel scene.
