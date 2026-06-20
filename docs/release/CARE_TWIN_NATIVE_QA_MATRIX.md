# Care Twin Native QA Matrix

Status: active checklist for the next iOS/Android device or simulator pass.

Source of truth in code:

- `artifacts/woofwatcher-mobile/lib/careTwinAssets.ts`
- `CARE_TWIN_RUNTIME_QA_SCENARIOS`
- `evaluateCareTwinRuntimeQaScenario`
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

Each state card also shows a Motion recipe generated from the same choreography
model Home uses. Reviewers should confirm the primary loop, ambient micro-loops,
and tap reaction match the state: happy states may bark/playfully react, rest
states should use a soft check-in, and Health Watch should stay calm.

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
- Incident Composer screenshot showing trigger, exposure, injury/action, follow-up, notes, and household visibility fields fitting without keyboard overlap.
- Records Incident Watch screenshot showing trend signal, follow-up tasks, trainer goals, and non-diagnostic boundary language.
- Trainer Care Pass screenshot or shared text snippet showing Incident Watch trend/follow-up/goal lines.
- Combined Mobile Release QA share report from `/care-twin-qa`.
- Notes for any clipped sprite, weak gait, unreadable action, duplicate dog, or room/sprite scale mismatch.

## Current Limitation

This Windows worktree can run static tests, TypeScript, PixelLab asset verification, and Expo web export. It now also ships an in-app QA route for device review, but it still cannot produce authoritative native simulator proof without iOS/Android runtime access.

The in-app pass/needs-tune controls are an evidence-capture aid only. They do
not replace the screenshots and human review listed above.
