# Care Twin Native QA Matrix

Status: active checklist for the next iOS/Android device or simulator pass.

Source of truth in code:

- `artifacts/woofwatcher-mobile/lib/careTwinAssets.ts`
- `CARE_TWIN_RUNTIME_QA_SCENARIOS`
- `evaluateCareTwinRuntimeQaScenario`
- `artifacts/woofwatcher-mobile/lib/avatarSpriteProductionQa.ts`
- `artifacts/woofwatcher-mobile/lib/avatarTemplateSpriteAssets.ts`
- `artifacts/woofwatcher-mobile/lib/mobileReleaseQa.ts`
- `artifacts/woofwatcher-mobile/app/care-twin-qa.tsx`

## In-App QA Route

Open `/care-twin-qa` in a development or internal Expo build. The route renders
all 12 matrix scenarios using the production `LivingPhoenixRoom` component, the
registered dogless room layers, and the registered Phoenix sprite strips.

The route is linked from More as `Care Twin QA` only in development builds, so
it is available for Apollo/device testers without becoming normal user-facing
product clutter.

The route also includes session-level `Pass`, `Needs tune`, note fields, and a
native share action that produces a plain-text QA summary. Use that summary as
device-session evidence, then attach the required screenshots before treating a
state as release-approved.

As of 2026-06-20, the same route also includes a Mobile Release QA cockpit for
the broader launch-critical workflows that need phone-size review:

- Phoenix Home.
- Care Twin State Lab.
- Avatar Studio.
- Incident Composer.
- Records Incident Watch.
- Trainer Care Pass.

Each surface has Pass/Needs tune controls, route-open action, launch-risk copy,
required screenshot/evidence prompts, and a device note field. The combined
share report includes both this workflow checklist and the 12-state care-twin
matrix.

The route autosaves the internal QA session locally on the device. This lets a
tester open a target surface, return to `/care-twin-qa`, and keep the same
Pass/Needs tune status plus notes. The saved session is a local QA convenience
only; it is not provider-backed storage and does not replace attached
screenshots.

As of 2026-06-20, testers can attach local screenshot evidence directly inside
the QA route. Capture the native iOS/Android screen first, return to
`/care-twin-qa`, tap `Attach screenshot` on the matching release surface or
care-twin state, and select the screenshot from Photos. The route persists the
attachment locally, shows the file name, updates attached/missing screenshot
counts, and includes attached screenshot file names in the combined share report.
This makes the evidence packet easier to hand off, but it is still local-only QA
evidence until provider-backed storage rules are approved.

Screenshot attachments are platform-aware. Screenshots attached while running on
iOS count toward iOS evidence slots; screenshots attached while running on
Android count toward Android slots. Web/unknown attachments remain visible in
the report but must not be used as native release proof. Do not mark the device
pass complete until both the iOS and Android counts satisfy the required slots.

As of 2026-06-21, `/care-twin-qa` also includes Store Screenshot QA generated
from the Store Submission packet. Use those cards to capture App Store and Play
Store screenshot evidence for:

- Phoenix Home.
- Quick Log.
- Plans & Schedule.
- Health Watch.
- Care Pass.
- Avatar Studio.
- Privacy & Launch Gates.

Each store screenshot card has its own route-open action, Pass/Needs tune
controls, notes, explicit iOS screenshot slot, explicit Android screenshot slot,
and store-safety prompt. Store screenshot evidence helps prepare the listing;
it does not approve submission.

As of 2026-06-21, More's Launch Readiness cockpit reads the same saved local QA
session. After attaching real device screenshots and marking surfaces, return to
More and verify the iOS + Android tile no longer stays at generic "Device proof
required"; it should show the derived missing iOS, Android, or flexible
evidence counts from the saved `/care-twin-qa` session. If the QA session is
empty, More intentionally keeps native proof blocked.

As of 2026-06-30, Mobile Release QA also includes `Avatar Sprite Production
Review`, a launch-critical surface generated from the actual PixelLab template
sprite registry. It checks all 12 launch dog templates and 24 registered
template sprite slots, then sends testers to Avatar Studio and the Care Twin
State Lab with route-backed proof rows. This review is specifically for the
game-feel layer: crisp hard-pixel sprites, one visible dog, bottom-center
anchor stability, idle breathing/tail-wag motion, walk-loop gait, phone-size
crop, and accessory overlay fit. It remains `Pass pending proof` until iOS and
Android Avatar Studio screenshots plus a gait/crop QA note are attached.

Each state card also shows a Motion recipe and a Motion proof panel generated
from the same choreography and motion-recipe model Home uses. Reviewers should
confirm the primary loop, ambient micro-loops, tap reaction, bob, sway, tilt,
scale pulse, and shadow pulse match the state: happy states may bark/playfully
react, rest states should use a soft check-in, and Health Watch should stay
calm. The native share report includes the same recipe line so screenshot notes
and motion findings can travel together.

## Purpose

The care twin must feel like one living game character layered over dogless room art. Native QA should verify room fit, sprite scale, stage crop, touch response, and state readability on phone-sized screens. Web export and static tests do not replace this pass.

## Required Checks

For every scenario below:

- Phoenix is the only dog visible.
- The room background is dogless, text-free, and watermark-free.
- The sprite remains inside the stage crop on small phone screens.
- The action reads clearly at phone size.
- The state feels warm and game-like without becoming medically certain.
- The bottom-center sprite anchor does not visibly jump between frames.
- On Phoenix Home, tapping the main dog should produce care-twin feedback, while
  long-pressing the same dog target should open Avatar Studio without losing the
  current care context.

## State Matrix

| Scenario | State | Expected Sprite | Room | Zone | QA Prompt |
| --- | --- | --- | --- | --- | --- |
| Steady happy idle | happy | tail-wag | day | rug | Phoenix should idle on the day-room rug with a soft tail wag and no duplicate dog baked into the room. |
| Upcoming activity excitement | excited | celebrate-hop | day | door | Phoenix should feel ready by the door without leaving the stage crop on a phone viewport. |
| Bored activity need | bored | walk-loop | day | door | Walk-cycle motion should read as activity-needed and keep paws anchored inside the day room. |
| Meal due attention | annoyed | ear-perk | night | bowl | Ear-perk attention should use the night room when Phoenix is anxious, with the bowl zone still visually clear. |
| Needs comfort | sad | comfort-loop | homeAlone | window | Comfort motion should feel calm and emotionally warm in the home-alone room, not medically alarming. |
| Low energy rest | tired | sleep-loop | bedtime | bed | The sleep loop should sit naturally in the bedtime room and keep the moonlit background dogless. |
| Quiet-hours sleep | sleeping | sleep-loop | bedtime | bed | Quiet-hours sleep should feel like a soft game idle state, with no clipping at the bottom-center anchor. |
| Meal logged | eating | eat-loop | day | bowl | Eating should route to the bowl zone and stay visually separate from the room art. |
| Water logged | drinking | drink-loop | day | bowl | Drinking should read as hydration at phone size, not as a generic idle loop. |
| Walk logged | walking | walk-loop | day | door | The walk loop should feel alive like a game sprite while remaining inside the room bounds. |
| Treat or training win | treat | celebrate-hop | day | rug | Celebration should feel rewarding without fake currency or visual clutter. |
| Health Watch signal | sick | health-watch | healthWatch | bed | Health Watch should be calm and non-diagnostic, using the health room without scary medical framing. |

## Pass Evidence To Capture

- iPhone small viewport screenshot of Home idle.
- iPhone small viewport screenshot of `/care-twin-qa` happy idle.
- iPhone small viewport screenshot of `/care-twin-qa` Health Watch state.
- Android small viewport screenshot of `/care-twin-qa` bedtime/sleep state.
- Avatar Studio screenshot with one live template selected.
- Avatar Sprite Production Review screenshot pair: iOS with Shepherd/Phoenix
  live sprite selected, Android with a non-Phoenix live template selected, plus
  a note naming any weak gait, crop, duplicate-avatar, or accessory overlay
  issue by template.
- Incident Composer screenshot showing trigger, exposure, injury/action, follow-up, notes, and household visibility fields fitting without keyboard overlap.
- Records Incident Watch screenshot showing trend signal, follow-up tasks, trainer goals, and non-diagnostic boundary language.
- Trainer Care Pass screenshot or shared text snippet showing Incident Watch trend/follow-up/goal lines.
- Combined Mobile Release QA share report from `/care-twin-qa`.
- Store Screenshot QA attachments for Phoenix Home, Quick Log, Plans &
  Schedule, Health Watch, Care Pass, Avatar Studio, and Privacy & Launch Gates
  on both iOS and Android.
- Store Submission packet share text from `/care-twin-qa`.
- Attached screenshot evidence names visible in the shared QA report for each reviewed surface/state.
- Notes for any clipped sprite, weak gait, unreadable action, duplicate dog, or room/sprite scale mismatch.

## Current Limitation

This Windows worktree can run static tests, TypeScript, PixelLab asset verification, and Expo web export. It now also ships an in-app QA route for device review and local screenshot attachment, but it still cannot produce authoritative native simulator proof without iOS/Android runtime access.

The in-app pass/needs-tune controls are an evidence-capture aid only. They do
not replace the screenshots and human review listed above, and local screenshot
attachments do not replace provider-backed QA storage when that becomes a
production requirement.
