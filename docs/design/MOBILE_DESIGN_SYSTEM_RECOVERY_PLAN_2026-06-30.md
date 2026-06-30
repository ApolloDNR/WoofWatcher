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

## Next Design Passes

1. Quick Log: reduce visual noise, add clear tap vs long-press hierarchy, and make the detail sheet feel premium.
2. Plans: make the daily schedule feel like missions/responsibilities instead of a task dump.
3. More: split into grouped menu sections with stronger hierarchy and less wall-of-options feel.
4. Records: turn dense record sections into scannable credential/vault rows.
5. Home: final pass against the dark RPG board after Health/Log/Plans share the same system.

