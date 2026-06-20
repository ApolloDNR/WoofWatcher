# WoofWatcher UI Direction Lock

Date: 2026-06-20

## Locked Style

Premium Neo-Retro Pixel Care.

The product should feel like real software from a strong product team, with a playful pixel-pet identity. It should be memorable, fast, and emotionally warm without becoming childish or unserious.

The current visual source of truth is now the reference-board set mirrored in `docs/design/reference/`, with implementation guidance in `docs/superpowers/specs/2026-06-14-woofwatcher-pixel-ui-lock-design.md`.

Primary references:

- `docs/design/reference/woofwatcher-premium-light-design-system.png`
- `docs/design/reference/woofwatcher-care-adventure-rpg-dark-board.png`
- `docs/design/reference/woofwatcher-premium-product-board-light.png`
- `docs/design/reference/woofwatcher-care-rpg-north-star.png`

Apollo re-confirmed these two boards on 2026-06-20 as the accuracy target for the app: premium App Store-ready care software, crest-led WoofWatcher branding, living pixel Phoenix, mobile-first iOS/Android polish, and a long-range care-adventure RPG system.

Apollo re-attached the same light and dark north-star boards on 2026-06-20 and asked Codex to always remember them. Future UI work should compare implementation against these boards before claiming polish: if the result drifts into generic tracker UI, soft prototype cards, non-pixel avatars, or weak mobile hierarchy, it is not aligned.

Supporting references:

- `docs/design/reference/woofwatcher-pixel-reference-board-04.png`
- `docs/design/reference/woofwatcher-pixel-reference-board-01.png`
- `docs/design/reference/woofwatcher-pixel-reference-board-02.png`
- `docs/design/reference/woofwatcher-pixel-reference-board-03.png`

## Non-Negotiables

- Desktop uses a grouped left sidebar.
- Mobile uses bottom navigation.
- Mobile bottom nav is Home, Log, Plans, Health, More.
- Light and dark modes work.
- Every major page has a purpose.
- Every button either performs a real action or routes to a real surface.
- Pixel art is used for Phoenix, icons, status meters, badges, emotes, speech bubbles, and delightful feedback.
- Long text uses readable UI typography.
- Health surfaces remain calm and non-diagnostic.
- The dark navy shell, cream/ivory canvas, copper/sage accents, pixel Phoenix room, compact cards, and segmented status meters are not optional styling details.
- Do not replace the selected direction with generic SaaS, gradient AI-app, soft beige lifestyle, or full-game UI styling.

## App Shell Components

- AppShell
- DesktopSidebar
- MobileBottomNav
- TopBar
- PageHeader
- Card
- StatusChip
- StatusMeter
- QuickActionTile
- PlanRow
- TimelineRow
- RecordRow
- ReportMetricCard
- CarePassCard
- AvatarRoomCard

## Phoenix Home Promise

Phoenix Home must answer in five seconds:

1. Where is Phoenix?
2. Is Phoenix alone?
3. How does Phoenix feel?
4. What is next?
5. What can I log quickly?

## Interaction Tone

- Fast logging.
- Clear feedback.
- Pixel delight tied to real care state.
- No dead ends.
- No fake provider claims.
- No medical certainty.

## Reference Match Rule

When visual implementation choices conflict, prefer the current primary reference boards over earlier loose descriptions. `woofwatcher-premium-light-design-system.png` locks the App Store-quality brand system, crest, desktop shell, mobile utility screens, and component language. `woofwatcher-care-adventure-rpg-dark-board.png` locks the long-range care-adventure RPG direction: Home, My Care Today, Adventure Map, Adventure Log, Household Pulse, Pet Profile, Access Pass, Care Pass, levels, badges, memories, and marketplace readiness. Board 04 remains the closest supporting implementation target for compact neo-retro daily-care layouts.
