# UI Implementation Notes

Date: 2026-06-12

## Current Approach

Implement v1.5 incrementally. Do not rewrite the product from scratch.

The app should converge on a shared visual system across:
- Expo mobile app.
- Local-first PWA/dashboard.
- Future Figma components.

## Tokens

Use the v1.5 palette:
- Navy `#081A2A`
- Navy 2 `#102C40`
- Copper `#C85A2A`
- Copper 2 `#E07A2F`
- Sage `#6DA36F`
- Sage soft `#E8F3E7`
- Cream `#F7F2E8`
- Ivory `#FFF9EF`
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

