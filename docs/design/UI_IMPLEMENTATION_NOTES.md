# UI Implementation Notes

Date: 2026-06-14

## Current Approach

Implement v1.5 incrementally. Do not rewrite the product from scratch.

The app should converge on a shared visual system across:
- Expo mobile app.
- Local-first PWA/dashboard.
- Future Figma components.

Apollo's latest reference boards are now the visual source of truth. Keep them mirrored in `docs/design/reference/` and use `docs/superpowers/specs/2026-06-14-woofwatcher-pixel-ui-lock-design.md` as the implementation spec before making visual changes.

## Tokens

Use the v1.5 palette:
- Deep navy `#081424`
- Navy `#081A2A`
- Navy 2 `#102C40`
- Copper `#C85A2A`
- Copper 2 `#E07A2F`
- Forest `#4D8A56`
- Sage `#6DA36F`
- Sage soft `#E8F3E7`
- Cream `#F7F2E8`
- Ivory `#FFF9EF`
- Blue signal `#A8CBE8`
- Amber `#D8A852`
- Rose `#C96358`
- Stone `#E6DED2`
- Ink `#142033`

## Typography

- Use readable UI text for product content.
- Use pixel styling only as an accent for logo, badges, speech bubbles, status labels, and small UI feedback.

## PWA Notes

- Keep `woofwatcher.v1.state`.
- Keep backup/import/export actions.
- Keep localStorage as the v1.5 PWA data source until cloud sync is explicitly implemented.
- The PWA shell should expose grouped desktop navigation and five-tab mobile navigation.
- Quick Log should remove confusing pee/poop top-level concepts and use Potty as the parent action.

## Mobile Notes

- Mobile remains canonical.
- Keep Home, Log, Plans, Health, More as bottom nav.
- Put overflow tools under More.
- Continue moving reusable rules into `lib/care-domain`.
- Prioritize the actual Expo mobile screens before polishing the PWA because mobile is the primary product surface.
- Match the reference-board mobile layouts: Home, Quick Log, Plans, Health/Bile, Household Pulse/Alone Time, Care Pass, Avatar Studio, and Reports.

## Visual Fidelity Notes

- Use the navy shell and bottom bar as the strongest brand frame.
- Use cream/ivory content backgrounds with thin stone borders.
- Keep cards compact and purposeful.
- Use segmented HUD meters for energy, hunger, hydration, bile risk, bond, and similar status signals.
- Use pixel icons and Phoenix room art as product identity, but keep care copy readable.
- No button should be introduced unless it has a real action, route, or honest setup explanation.

## 2026-06-14 Mobile Foundation Pass

Implemented the first board-accurate Expo mobile foundation slice:

- Locked board palette tokens in `artifacts/woofwatcher-mobile/constants/colors.ts`.
- Added reusable board primitives in `artifacts/woofwatcher-mobile/components/board/BoardPrimitives.tsx`.
- Converted mobile bottom navigation to the dark navy shell with cream active states.
- Rebuilt Phoenix Home around the reference-board composition: pixel room hero, speech bubble, presence chip, segmented status meters, Quick Actions, Today at a Glance, Recent Activity, and Health/Bile/Alone watch cards.
- Added a static readiness test so the app keeps the locked palette, board primitives, Home wiring, and navy tab shell.

Remaining visual work:

- Continue deep visual polish on Quick Log, Plans, More, Records, Care Pass, WoofGuide, and Avatar Studio now that route chrome is aligned.
- Run simulator/browser screenshot QA once dependencies are installed.
- Replace current static board assets with final Phoenix pixel states when available.

## 2026-06-14 Board Route Adoption Pass

Extended the mobile board primitive system beyond Phoenix Home:

- Added `BoardRouteHeader`, `BoardPill`, and `BoardMetricTile` to `artifacts/woofwatcher-mobile/components/board/BoardPrimitives.tsx`.
- Converted Health Watch/Bile Watch to shared board cards, pills, metric tiles, section headers, and care rows while preserving non-diagnostic health copy.
- Added shared route headers to Quick Log, Plans, More, Records, WoofGuide, and Avatar Studio.
- Added board section usage to Quick Log, Plans, More, Records, WoofGuide, and Avatar Studio so the visual system now reaches every core v1.5 mobile route.
- Added a mobile readiness test that protects board primitive adoption across Log, Plans, Health, More, Records, WoofGuide, and Avatar Studio.

Known implementation note:

- `more.tsx` and `portrait.tsx` still contain hidden legacy header markup because those source blocks contain older encoded characters. The visible UI uses `BoardRouteHeader`; a later cleanup pass can safely remove the hidden legacy markup after a formatter/typechecker run.
