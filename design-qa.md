final result: passed with native QA remaining

# Design QA - Avatar Studio Pixel Runtime Pass

Date: 2026-06-18

## Scope

- Target screen: WoofWatcher mobile `/portrait` Avatar Studio.
- Visual source: Apollo's Option B neo-retro digital pet reference boards.
- Implemented slice: PixelLab subscription seed strips, crisp pixel rendering, one-dog live Studio presentation, and Expo web export recovery.

## Evidence Completed

- PixelLab subscription path is active and produced local production seed strips for the `f0c6169b-88c0-4428-9089-31c0565c4129` Shepherd candidate.
- New seed strips were stitched, registered in asset verification, and saved as:
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/pixellab-idle-south-strip.png`
  - `artifacts/woofwatcher-mobile/assets/avatar/phoenix/pixellab-walk-south-strip.png`
- `pixelImageStyle` now keeps web-rendered PixelLab room, avatar, and sprite assets crisp instead of browser-smoothed.
- Avatar Studio now renders the live `LivingPhoenixRoom` with `presentation="studio"`, so the hero has one animated care twin and no Home HUD overlap.
- Expo web export now succeeds in this worktree through the package-local Expo CLI and Metro resolver fix.
- Chrome visual smoke captured `/portrait` and Home from the exported web build. The `/portrait` result showed a clean mobile Avatar Studio hero with the live pixel room, one dog, the top pixel ID card, and no overlay clipping.

## Checks Run

- PixelLab asset verification: passed, `ok=61 missing=0 invalid=0`.
- Mobile TypeScript: passed.
- Focused behavior/readiness suite: passed, 237 tests.
- Expo web export: passed.
- Headless Chrome visual smoke: passed for `/portrait` and Home export preview.

## Remaining QA

- Native iOS and Android simulator/device QA is still required for safe areas, frame timing, touch targets, and real device pixel crispness.
- Final illustrated night, bedtime, health-watch, and home-alone room variants still need replacement/approval.
- Non-Phoenix template emotes, body-class sprite strips, and overlay-aligned accessory layers remain production art tasks.

# Design QA - Premium Typography And Chrome Repair Pass

Date: 2026-07-06

## Scope

- Target: WoofWatcher mobile app-wide typography, stack-header chrome, Home header truth, Phoenix room speech bubble, WoofGuide/Plus console chips, Privacy export grid, auth gateway preview behavior, and the not-found route.
- Visual source: locked premium neo-retro pixel palette and existing board system.

## Findings Fixed

- `Inter_800ExtraBold` was referenced by 216 text elements and `PressStart2P_400Regular` by the WoofGuide/Plus consoles, but neither font was loaded, so console HUD values, chips, and primary action buttons rendered in the platform fallback serif across Log, Plans, Records, More, WoofGuide, and Plus. Inter ExtraBold is now loaded and the two console constants use the board-system `Fredoka_600SemiBold`.
- Stack headers for Setup, WoofGuide, WoofWatcher Plus, Privacy & Safety, Adventure Mode, and Care Twin QA used stale green-on-`#F7F5F1` chrome. They now use palette background, Fredoka titles, copper tint, and follow native dark mode.
- The Home header bell badge was hardcoded to `3`. It now derives from live Health/Bile watch signals, hides when calm, and carries the signal count in an accessibility hint.
- The Phoenix room speech bubble reserved a fixed-size box and rendered mostly empty for short lines; it now hugs its content.
- The WoofGuide "Owner review" console chip could be pushed past the card edge once real (wider) fonts loaded; console bubbles/chips can now shrink. The Plus checkout chip got the same guard.
- The Privacy & Safety export summary tiles wrapped to a single column at 390pt width; they now flex into a true two-up grid.
- `/sign-in` and `/sign-up` crashed to the error boundary in preview builds because Clerk hooks mounted without a configured provider. They now render a truthful local-preview gateway with a working continue action, and the Clerk forms mount only when Clerk is configured.
- The not-found route was the stock Expo template; it is now branded with a safe exit back to Home.

## Checks Run

- Focused behavior/readiness suite: passed, 594 tests, 0 failures (Node 24).
- Mobile TypeScript: passed.
- Expo web export smoke: passed.
- Headless Chromium screenshot QA at 390x844 across Home, Quick Log, Plans, Health, Records, More, WoofGuide, Plus, Setup, Privacy, sign-in, and not-found in the exported web build.

## Remaining QA

- Native iOS and Android simulator/device screenshot proof is still required for store-grade sign-off; this pass covers the exported web preview only.
- Dark mode remains native-only by design in `useColors`; native dark-mode screenshots are still pending.

# Design QA - Care Career Game Layer Pass

Date: 2026-07-06

## Scope

- Target: evidence-based Tamagotchi/RPG progression toward Apollo's care + adventure vision board.
- New shared logic: `artifacts/woofwatcher-mobile/lib/careCareer.ts` derives lifetime care XP, level, care-journey title (New Paw through Legendary Companion), per-level progress, and today's XP from real care logs only. No coins, no purchasable progress, future-dated and unparseable logs never mint XP.
- Home now shows a care level strip (level badge, title, pixel-segment XP bar, today's XP) between the presence panel and Care Status, announces the values to screen readers, appends "+N care XP" to quick-log toasts, and fires a celebrate-hop room reaction with success haptics when a real log crosses a level threshold.

## Checks Run

- careCareer unit + wiring tests: passed, 9 tests.
- Focused behavior/readiness suite: passed, 602 tests, 0 failures (Node 24).
- Mobile TypeScript: passed.
- Expo web export smoke: passed.
- Headless Chromium screenshot QA of Home at 390x844.

## Remaining QA

- Level thresholds and title ladder are a first tuning pass; Apollo may want different pacing before launch.
- Native haptics/celebration timing needs on-device QA.
- Adventure map, career stats board, and shareable Care Pass QR from the vision board remain future slices.

# Design QA - Mockup Parity Sweep (Apollo's July Boards)

Date: 2026-07-12

## Scope

- Visual source: Apollo's three July 2026 mock boards (uploaded this session),
  now canonical in APOLLO_MASTER_VISION_PROMPT.md.
- Foundation: lighter parchment palette (#F7F1E1 page / #FDF9EE card), deep
  forest #33582F primary, Care Sense meter tones, 7-pip meters, quiet sage
  kickers, edge-to-edge compact web preview (navy letterbox removed).
- New shared motion kit (components/motion/GameFeel.tsx): PressScale squish,
  staggered BoardCard entrances, MeterPip pop-fills, paw-FAB bounce,
  ProgressFill - one spring language everywhere, reduced-motion aware.
- Home: mood card + recency chips + duplicate status-tile grid folded into
  the mock-board Care Sense card (mood/energy/hunger/alone, all real);
  Quick Log is a card with Meal/Potty/Walk/Meds + real More tile; Care
  Status slimmed to Bond meter + diet door.
- Log + fastlog: parchment consoles, segmented option chips, forest save
  pills, red-text delete, light Add Log sheet.
- Plan: light command deck, mock-board timeline rows, Week tab = This
  Week's Plan with real M-S day dots + weekly goal + streak.
- Health: Next Reminder / Health Summary (honest "Not on file" states) /
  Medications; Records: light stat chips.
- Pack: new Supplies segment (Essentials + Travel bag) - user-set statuses
  only, no fake countdowns, AsyncStorage persistence, 12-test pure lib.
- Story: month-grouped Memories grid, honest journal cards (hearts omitted -
  no real reaction model exists); More: parchment launch hub; Avatar
  Studio: forest segments.

## Checks Run

- Focused behavior/readiness suite: 693 tests, 0 failures (Node 24).
- Mobile TypeScript: clean.
- Expo web export: passed; headless Chromium screenshots of every route at
  390x844 plus interaction flows (Week tab, Pack status cycling, meal
  detail chips, fastlog meal -> Home meter/Next Up/Today's Story ripple).
- Zero console/page errors across the sweep.

## Remaining QA

- Native iOS/Android device pass (safe areas, haptics timing, 60fps motion).
- Dark-mode audit of the new meter tones (EXPO_PUBLIC_WEB_COLOR_SCHEME=auto).
- Real-photo Memories grid check once photo logs exist on device.

# Design QA - Standalone Board Screens (Trends / Profile / Reminders / Calendar)

Date: 2026-07-12

## Scope

Built the four screens Apollo's July boards show as standalone but the app had
folded into other tabs, completing the mockup screen set. Each is a Stack card
that renders its own header, is registered in app/_layout.tsx (headerShown
false), derives from real logged care, and has a real entry point.

- app/trends.tsx (+lib/trendsChart.ts +test): Day/Week/Month/Year windows; Mood
  line chart (react-native-svg) + Activity (walk+play+training minutes) bars +
  Potty bars. No sleep event type exists in the data model, so it charts Potty
  in the mockup's third-chart slot instead of fabricating sleep. Honest
  per-chart empty states; This Week summary from deriveCareTrends. Entry: the
  "Trends" link on the Home Care Sense card.
- app/profile.tsx: full-bleed park hero + gold-ringed avatar; Details table
  from real profile fields. Birthday and Sex have NO field in the data model,
  so they render honest "Not tracked yet / Not on file" rather than invented
  values. About card from profile.background; edit routes to setup/portrait.
  Entry: the Home header dog chip.
- app/reminders.tsx: Upcoming/Past; items from deriveCareReminderCenter grouped
  Today/Tomorrow/Later by real daysUntil (dateless routine/med items -> Today,
  others -> "No date"); honest Past empty state; honest notification-readiness
  line (does not claim push is enabled). New Reminder -> Plan. Entry: Home bell.
- app/calendar-month.tsx (+lib/monthCalendar.ts +test): real month grid with
  day dots from real entries/routines; selected-day timeline with colored type
  spines; row -> log detail; FAB -> fastlog. Entry: "Month view" under Plan.

Entry-point rewiring (Home dog chip -> profile, bell -> reminders, Care Sense
-> trends) required updating the mobileReadiness navigation contracts to the new
truth.

## Checks Run

- Focused behavior/readiness suite: 711 tests, 0 failures (Node 24) - includes
  18 new pure-lib tests (trendsChart 9, monthCalendar 9).
- Mobile TypeScript: clean.
- Expo web export: passed. Headless Chromium screenshots at 390x844 of all four
  new screens plus the changed Home and Plan; zero console/page errors. On a
  fresh/empty account the charts, timeline, and reminder groups correctly show
  honest empty states.

## Remaining QA

- Native iOS/Android device pass (safe areas, 60fps motion, haptics).
- Re-check the four screens on a device with a populated account (real charts,
  day dots, reminder grouping).
- Widgets + Apple Watch faces (native-only) remain future work.

# Design QA - Dark-Mode Audit (meter tones + fixed-light docks)

Date: 2026-07-14

## Scope

Closed the "dark-mode audit of the new meter tones" item the prior passes left
open (handoff §4-B). The Care Sense meter tones and the restyled screens
shipped a dark theme that had never actually been looked at. Method: Expo web
export built with EXPO_PUBLIC_WEB_COLOR_SCHEME=auto, then a headless Chromium
sweep of 16 routes at 390x844 with prefers-color-scheme: dark emulated (Home,
Log, Plan, Health, Records, Pack, Story, More, fastlog, portrait, Trends,
Profile, Reminders, month Calendar, Adventure, WoofGuide), each shot top and
scrolled, plus a high-DPI light-vs-dark capture of the Care Sense card.

## Findings and fixes

- Care Sense empty pip track was near-invisible in dark. StatusMeter drew empty
  pips with `colors.muted` (#102C40), which sits ~1.16:1 against the dark card
  (#0D182A), so the seven chunky pips collapsed into a plain colored bar and the
  Hunger row (all empty) barely read. Added a dedicated `meterTrack` token:
  dark #223A52 (lifted well above the card so the segmented track reads), light
  #EDE5CF (identical to the old value, so light mode is unchanged). StatusMeter
  now uses `colors.meterTrack`.
- Records credential HUD and Log command HUD stat chips flipped dark on their
  fixed-light cream docks. Both sit on a deliberately theme-independent cream
  "physical card / console" surface (`colors.ivory`), but their inner stat chips
  used `colors.background` for the fill and `colors.ink`/`colors.foreground` for
  the value - all of which flip with the theme - so in dark mode the chips
  rendered as dark navy tiles floating on cream (the code comments call for
  "light parchment stat chips"). Pinned the chip fill to `colors.cream` and the
  value ink to `colors.brandNavy` (both constant-light / constant-dark), so the
  chips stay light parchment with dark ink in both themes. Light mode is
  unchanged (light `cream` == light `background`; `brandNavy` ~= `ink`).
- All other 13 screens and the other fixed-light surfaces (WoofGuide boundary
  card, auth/setup stage HUD + proof manifest) already used constant inks
  (`brandNavy`, `copper`, `BUBBLE_INK`) on their cream surfaces and rendered
  correctly in dark; no change needed.

## Checks Run

- Mobile + workspace TypeScript: clean.
- Focused behavior/readiness suite: 710/711. The one failure is the mobile beta
  doctor test that asserts a Node-24 runtime; this environment is Node 22, so it
  is an environment artifact, not a regression (same failure before and after).
- Expo web export: passed (262 files).
- Dark sweep: 16 routes, 0 console/page errors; both fixes confirmed against the
  boards. Light-mode regression check (Records, Log, Home) confirmed unchanged.

## Remaining QA

- Native iOS/Android device pass in dark mode (safe areas, 60fps motion,
  haptics) - device-only, still owed.
- Re-check the dark meters and docks on a device with a populated account.
- Widgets + Apple Watch faces (native-only) remain future work.

# Design QA - Populated-Account Pass + Full build:ci

Date: 2026-07-14

## Scope

Closed the "re-check on a populated account" item every prior pass deferred
(each had only exercised the honest empty states of a fresh account). Seeded
~14 days of realistic care into the web export's local cache
(woofwatcher.v2.state -> { entries }) - meals, potty, water, walks with place
names, play, training, daily mood checks, and weigh-ins (133 entries) - then
swept the data-driven screens in a headless Chromium at 390x844. Harness added
as artifacts/woofwatcher-mobile/scripts/qa-seed-populated.mjs so it is
repeatable (QA_COLOR_SCHEME=dark also supported).

## Result - everything derives correctly from real data, 0 console errors

- Home Care Sense: meters read real values (Mood "Content", Energy 81%, Hunger
  2/2 once the day's meals are logged, Alone OK); glance line reflects state.
- Trends: Week view charts the mood line (4.1/5 avg with the anxious-day dip),
  312 activity minutes, and 24 potty logs; Month view spreads the same data
  across a 30-day axis (labels every 5 days) and correctly leaves the
  pre-history half empty rather than inventing points.
- Month Calendar: day dots land on every day with entries; selected-day
  timeline shows the 12 real entries with correct colored type spines and
  caregiver attribution.
- Health: score derives (91) with a full 7-day rhythm; vet-share checklist
  computes the real longest food gap; Health Summary weight row shows the trend
  delta + sparkline; vet visit / vaccinations / sensitivities stay honest
  "None on file" (not seeded). Non-diagnostic language intact.
- Story: walks with place names became discovered trail spots with real visit
  counts and average durations ("River Loop ~29 min, 12 visits";
  "Neighborhood ~20 min, 7 visits").
- Records correctly still reads 0 (it tracks formal documents, not care logs,
  which were not seeded).

No rendering bugs surfaced; the fresh-account empty states and the populated
states are both correct.

## Checks Run

- Full `pnpm run build:ci`: passed (typecheck + api-server build + web build +
  mockup-sandbox build + mobile smoke:web + smoke:runtime + live-preview proof).
- Focused suite: 710/711 (the one failure is the Node-24 doctor assertion, an
  environment artifact on this Node-22 box).
- Populated sweep: 9 data-driven routes, top + scrolled, 0 console/page errors.

## Remaining QA

- Native iOS/Android device pass (safe areas, 60fps motion, haptics) - the last
  owed item, and it needs real hardware / a simulator.
- Widgets + Apple Watch faces (native-only) remain future work.

# Design QA - Home Care-Twin Scale + Grounding

Date: 2026-07-14

## Scope

Fixed the scale of the Home living-room hero: the care twin was rendered at
150x150 over the full-bleed storybook room, which measured ~2x the width of the
window behind it and overlapped/hid the potted plant and bookshelf - the dog
read as oversized and the room felt cramped. Retuned getImmersiveSpriteZone
(the Home-only immersive path; other screens use getCompactSpriteZone and are
untouched) to 112x112 and re-grounded it (top 22% -> 42%, left 30% -> 35%) so
the twin plants its paws on the rug instead of dominating/floating.

Tuned empirically: measured the current render against a 10% grid, then
previewed vertical grounding live (the rig `top` is a plain inline style
Reanimated does not animate) to land the paws on the rug in one export.

## Result

- The twin now reads as a believably-sized dog inside the room: comparable to
  the plant and bookshelf, smaller than before relative to the window, still
  the clear focal point, paws grounded on the rug.
- Verified light + dark, empty + populated account; 0 console errors; the dog
  stays clear of the Care Sense card (no clipping) in every state.
- Guardrail suite still 710/711 (the one failure is the Node-24 doctor
  assertion). The getCompactSpriteZone contract (width/height 150, used by the
  other screens' room hero cards) is unchanged.

## Not in scope this pass

- The roaming/walking rig (ROAM_RIG_SIZE, active only when the twin is awake and
  roaming the floor) still uses its original 150 size. It anchors its top-left
  to floor waypoints, so shrinking it needs grounding re-tuning that can only be
  verified in the awake/day roam state (not reachable in a static export).
- The other screens' compact room hero cards (getCompactSpriteZone) were left
  as-is; they use a different baked landscape room and a smaller card frame.

# Design QA - Roaming Twin Scale Match

Date: 2026-07-15

## Scope

Followed the Home resting-twin scale fix through to the roaming/awake twin so
the dog is ONE consistent size whether it is curled up (night, resting) or
pacing the floor (day, awake). The roaming rig still used the old
ROAM_RIG_SIZE 150, so the awake dog measured about as tall as the bookshelf and
~2x the dog house/plant - the same oversized read the resting twin had before.

Set ROAM_RIG_SIZE to 112 (matching getImmersiveSpriteZone). The rig is
bottom-aligned and top-left anchored to floor waypoints tuned for 150, so
shrinking naively would lift the paws ~38px off the floor; kept it grounded by
nudging the rig's `top` by (ROAM_RIG_BASELINE - ROAM_RIG_SIZE), which the
depth-scale math holds to sub-pixel.

## Verification

Forced the awake/roam state by mocking the clock to mid-afternoon and seeding a
content (fed + walked) dog, then sampled the roaming rig across frames:
- Rig is 112x112 (matches the resting twin) and travels as it walks.
- Paws stay planted on the rug at multiple floor positions (left + right);
  feet landed within ~8px of the old 150 rig's floor line.
- The awake dog now reads believably - comparable to the dog house, plant, and
  bookshelf - instead of dominating the room.
- Focused suite 710/711 (the one failure is the Node-24 doctor assertion). The
  roaming-rig testID contract is intact.

# Design QA - Web/PWA Palette Alignment (deep-forest primary)

Date: 2026-07-15

## Scope

Started the "web/PWA visually aligns after mobile is strong" priority
(CLAUDE.md #9). The web dashboard's brand green was a medium `#6DA36F` while the
mobile storybook primary is the deep forest `#33582F`, so the two surfaces read
as different products. Aligned the light-theme `--forest` to `#33582F`.

Because `--forest` does double duty (fills AND text), every fill rule already
used white/`#fff` ink except `.side-link.active`, which used `--navy` (invisible
on a deep green). Added a theme-flipping `--on-forest` ink token (light
`#F4EFE0`, dark `#06131F`) and pointed the active nav at it, so the deep
light-mode green takes cream while the lighter dark-mode green keeps its dark
ink. Dark `--forest` left unchanged (dark themes legitimately run a lighter
accent; mobile does the same), so the dark surface is untouched.

## Verification

Rebuilt the web app and screenshotted light + dark at desktop (1200px) and
PWA/phone (420px) widths:
- Light: active nav, links, avatars, energy bar, and status text now render the
  deep forest, matching the mobile app; cream ink on the active nav is clearly
  readable.
- Dark: unchanged (active nav keeps dark-on-light-green via `--on-forest`); no
  regression.
- PWA/phone width: the collapsed bottom tab bar's active tab is now deep forest;
  layout intact.
- 0 console/page errors; web typecheck clean; vanilla web tests 18/18.

## Not in scope

- Dark-theme green could be nudged from `#8FC48E` toward mobile's dark forest
  family in a follow-up (needs its own contrast pass on the active nav).
- Typography (mobile's Fraunces/Fredoka display faces) not yet brought to web.
