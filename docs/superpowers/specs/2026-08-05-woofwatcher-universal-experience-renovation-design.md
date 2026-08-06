# WoofWatcher Universal Experience Renovation

Date: 2026-08-05
Status: Approved implementation contract
Approved by owner: 2026-08-05
Owner direction: One universal interface; no separate Simple Mode

## Decision

WoofWatcher will be renovated as one clear, truthful, accessible care experience for people of different ages and technical confidence. The product will not split into “simple” and “advanced” modes. Instead, every screen will use a simple primary path with progressive disclosure for secondary and advanced tools.

The renovation is a staged improvement of the existing local-first application, not a rewrite. Existing care data, domain logic, recovery behavior, and safety boundaries remain protected while navigation, layout, motion, accessibility, and broken or misleading workflows are corrected.

The fixed mobile information architecture is:

1. Home
2. Log
3. Plans
4. Health
5. More

This restores the navigation already specified in WoofWatcher’s approved product documents and replaces the current `Log / Plan / Today / Pack / Story` drift.

## Product Standard

A first-time caregiver should be able to open WoofWatcher and understand, without instructions:

- where the dog is and whether attention is needed;
- what care is due next;
- how to record care quickly;
- where to review plans, health information, and records;
- which capabilities work now and which require unavailable provider services.

The universal experience must meet these rules:

- One obvious primary action per screen state.
- Core tasks are reachable in no more than two visible taps from a primary tab.
- No essential action depends on a hidden gesture, long press, unlabeled icon, or knowledge of brand jargon.
- Every visible control either works, explains the missing setup, or is removed.
- Advanced detail remains available through labeled secondary actions rather than a separate mode.
- Layout remains understandable at large text sizes and with screen readers.
- Motion communicates state and care feedback; it never delays or obscures work.
- Local-only features are labeled honestly. Provider-backed claims remain absent until their providers exist and pass release gates.

“Within two visible taps” means reaching or initiating the workflow, not completing a form that legitimately needs care details. The measured core tasks are:

- record a safe quick Water action;
- start or finish a Walk or Alone Time session;
- open the next planned-care item;
- open the current health alert or calm health status;
- reach full Log History and correct an earlier entry;
- reach Dog Profile;
- reach Privacy/export/delete controls.

From any primary tab, each task’s first actionable screen or safe action must be available within two labeled taps. Back, cancel, and Undo remain visible throughout the task.

## Evidence and Confirmed Problems

This contract is based on a source and behavior audit of merged `main` at `4723439` plus the owner’s hands-on assessment. The private hosted build required an authenticated owner session, so the current pass does not claim a complete live screenshot audit. Exact-build visual and device audits are required during implementation.

| Area | Confirmed problem | User impact |
| --- | --- | --- |
| Navigation | The build exposes Log, Plan, Today, Pack, Story while hiding Health, Records, and More | People cannot predict where important tools live |
| Home | A 4,000+ line route presents many competing cards, progress systems, summaries, and care tools | The next action is unclear |
| Quick Log | “Tap saves, hold for details” makes an essential path depend on a hidden long press | Details and corrections are undiscoverable |
| Ownership | Care Pass, profile editing, progress, logs, and records appear in several places | The same task seems to have several homes |
| Plans | Fresh states can resemble completed/sample schedules and free-form date/time input accepts invalid values | The product can appear fake or save misleading plans |
| Motion | Walk art has uneven frame spacing; pose, bob, shadow, and travel use different clocks; JS timers hard-cut actions | Phoenix slides, jumps, resets, and feels choppy |
| Screen motion | Whole-screen entrances and nested card entrances run together with inconsistent springs | Navigation feels floaty and slow |
| Care Pass PDF | One ASCII-only page is hard-capped, silently dropping later medical and record sections | Shared reports can omit critical care information |
| Android sharing | Generated PDF/PNG/HTML is sent as text/URL instead of a true attachment | Recipients may not receive the report |
| Local dates | Several “Today,” streak, calendar, record, and guide paths use UTC calendar keys | Evening care can appear on the wrong day |
| Avatar Studio | Photo “scan” results are generated from the pet name/template, not the selected image | The interface makes a false analysis claim |
| Attachments | Record images are copied but cannot be opened or shared; cancel, replace, and delete leak files | The vault is write-only and accumulates orphan data |
| Dog ID image | Visible output drops Microchip and Insurance rows | A shared ID can omit essential identification |
| Share history | A Care Pass is recorded as shared before the share succeeds | History can state an event that never happened |
| Validation | Impossible dates, invalid times, trailing numeric garbage, and impossible meal quantities can be accepted | Stored care data can become unreliable |

## Approaches Considered

### A. One universal, progressively disclosed interface — selected

The five primary tabs contain clear core paths. Secondary tools are grouped under the correct owner screen, and advanced detail opens from labeled actions. This is the only approach that improves usability for everyone without maintaining two products.

### B. Separate Simple and Advanced modes — rejected

Two modes would duplicate navigation, documentation, tests, and support. It would also force caregivers to decide which experience they need before they understand the product. Shared households could see different routes for the same dog.

### C. Cosmetic polish on the current architecture — rejected

Changing colors, spacing, or springs would leave the navigation drift, duplicate ownership, hidden gestures, fake scan claim, report truncation, and data correctness problems intact.

## Universal Navigation Contract

The mobile bottom bar always shows five labeled destinations. The selected state uses color and shape, not color alone. The center item is no longer a dual-purpose paw that sometimes navigates Home and sometimes opens Fast Log.

| Tab | Primary job | Canonical contents | Excluded from this tab |
| --- | --- | --- | --- |
| Home | Understand the dog’s current day | Phoenix room, presence, one next-care item, compact Care Sense summary, visible Quick Log shortcuts, one urgent health signal, short recent-care summary | Full history, large mission systems, settings, report management |
| Log | Record and correct care | Fast log, detailed log, active walk/alone sessions, today’s history, edit/undo/delete, sticky notes | Routines, long-term trends, profile setup |
| Plans | Decide who does what and when | Routines, ownership, reminders, manual events, today/upcoming schedule, day/week/month views | Historical logs presented as plans, provider-backed push claims |
| Health | Review health and professional records | Health Watch, Bile Watch, medications, diet, trends, Records, attachments, Dog ID, Care Pass reports and vet packet | General settings, game progress, household administration |
| More | Manage the dog, people, app, and secondary experiences | Dog Profile, Avatar Studio, Care Team, Supplies & Travel, Story & Progress, Adventure, Care Pass sharing shortcut, WoofGuide, Settings, Privacy, export/delete, legal | Another dashboard competing with Home |

### Secondary route ownership

- `/fastlog` becomes the explicit “Log care” flow owned by Log.
- `/records` becomes a Health child with Documents, Trends, and Reports sections.
- `/pack` is retired as a primary concept; its real Care Team and Supplies tools move under More.
- `/story` becomes “Story & Progress” under More.
- `/profile` owns all dog profile editing.
- `/setup` remains first-run setup only.
- Care Pass generation and clinical records live under Health; More may contain one clearly labeled sharing shortcut, not a second implementation.
- Story, Adventure, XP, and missions are rewarding secondary layers. They never compete with current care status or required care actions.

### Route and tab behavior

- A tab press navigates to that tab’s root without stacking duplicate roots. Re-tapping the selected tab scrolls its root to the top and performs no unrelated action.
- A child screen keeps its parent tab visibly selected. Back returns to the previous meaningful screen; a direct deep link can still return to the parent root.
- Legacy `/pack` links replace to More → Care Team & Supplies.
- Legacy `/story` links remain compatible but open Story & Progress with More selected.
- `/records` remains deep-link compatible but opens Records with Health selected.
- `/reminders` opens Plans with Plans selected.
- Existing `/more?section=diet` links map to Health → Diet.
- Existing `household` and `access` section links map to More → Care Team.
- Existing `care-pass` links map to Health → Care Pass.
- Existing `career` links map to More → Story & Progress.
- Redirects preserve supported item/report identifiers and reject unknown query values with a calm parent-screen fallback.

## Screen Contracts

### Home

Home answers five questions in the first viewport: Where is my dog? Is anything urgent? What is next? What can I log? What just happened?

The order is:

1. Compact greeting, dog identity, and current caregiver context. No dog selector appears until true multi-dog support exists.
2. Phoenix room with presence and current state.
3. One “Next care” card with a concrete primary action.
4. A visible Quick Log row; each shortcut follows the safety matrix below and exposes a labeled “Details” route. No hidden long press.
5. One compact care/health alert when actionable; otherwise a calm status line.
6. A short recent-care summary with “View all” to Log.

XP, missions, long trend summaries, redundant Today cards, full Health/Bile boards, and promotional utility cards leave the Home primary hierarchy.

Quick actions follow an explicit safety matrix:

| Care type | Fast-path behavior | Required safeguard |
| --- | --- | --- |
| Water | Save “water refreshed” immediately | Confirmation and Undo; quantity requires Details |
| Meal | Show configured meal/portion confirmation, or Details if none is configured | Never invent a portion; preserve served → outcome follow-up |
| Potty | Open the visible outcome chooser | Parent tap never guesses pee, poop, both, accident, or no result |
| Walk | Start the walk session; an active card exposes Finish | Persist/recover the session; route and location claims remain truthful |
| Alone Time | Start the session; Finish opens the return-outcome step | Never create a completed absence from one tap |
| Medication | Open medication/dose confirmation | Never default a medication to “taken” |
| Note | Open the note composer | Save only after non-empty content is confirmed |

Every saved action records the local caregiver label and trust/proof state supported by the existing model. The interface calls this “Logging as [label]” and explains that it is a local household label, not an authenticated identity or enforced permission.

### Log

Log opens on a fast, forgiving care recorder:

- large labeled actions for Meal, Water, Potty, Walk, Medication, Alone Time, and Note;
- safe fast paths governed by the care-type matrix, with immediate confirmation and Undo after every save;
- an always-visible Details action for quantities, outcomes, notes, and timestamps;
- active-session controls that remain visible and survive reload;
- today’s entries in reverse chronology with Edit and Delete actions;
- full historical logs, search, filters, and correction access under Log → History within two visible taps;
- strict input validation with plain-language recovery messages.

Logging must preserve the meal served-to-outcome lifecycle, potty outcomes, walk/alone sessions, routine matching, trust state, household visibility, sticky notes, corrections, and local persistence.

### Plans

Plans opens on Today and distinguishes scheduled care from completed care. Empty states never fabricate activity.

- “Add routine” is the primary action when no routine exists.
- V1 routines remain daily. They show time, owner label, and next daily occurrence; this renovation does not invent a recurrence schema.
- Completion comes from real logs and is visually distinct from the plan itself.
- Day, Week, and Month are labeled controls, not a crowded horizontal mystery rail.
- Date and time fields use canonical pickers where native, plus strict parsers for imported or web-entered text.
- Reminder copy describes local reminder preparation honestly until push delivery exists.

### Health

Health is the single trusted destination for health status and professional handoff material:

- current non-diagnostic alerts and calm “nothing needs attention” state;
- Health Watch and Bile Watch summaries;
- medications and diet;
- trends with understandable time ranges and source data links;
- Records with openable/shareable attachments;
- complete Dog ID and Care Pass preview, generate, share, and history flows;
- explicit medical-safety language and emergency escalation guidance where relevant.

Health never implies diagnosis, live veterinary review, cloud document storage, or successful sharing without evidence.

### More

More is a quiet, searchable list grouped under Dog, People & Home, Experiences, and App & Privacy. Critical privacy actions are not buried beneath internal or provider tooling.

- Dog Profile and Avatar Studio
- Care Team and household labels
- Supplies & Travel
- Story & Progress and Adventure
- WoofGuide, with provider availability stated truthfully
- Settings and accessibility preferences
- Backup/export, reset/delete, privacy, and legal

Visible “Add pet” is replaced with an informational availability row until true multi-dog support exists. Owner-only QA/provider panels stay outside the consumer build.

Care Team copy says clearly that people and roles are local labels for coordination, not signed-in accounts, verified identities, or enforced access control.

More contains a visible search field after its title. It indexes destination labels and plain-language synonyms such as “delete data,” “export,” “vet report,” and “caregiver.” Results show canonical destinations, open the canonical route instead of a duplicate tool, support keyboard and screen-reader operation, and provide a plain no-results state. “Share Care Pass” is one indexed shortcut: with or without an existing report it opens the canonical Health → Care Pass preview/builder; More never generates or stores a separate report.

## Instructions and First-Run Experience

The app must work exactly as its instructions describe.

### Setup

First-run setup requires only the dog’s display name. Device locale/timezone is derived locally. Photo, breed, birth date, weight, sex, diet, allergies, medications, veterinarian, care priorities, caregiver labels, and routine starter are optional, clearly skippable, and editable later. Setup is complete when the name is saved; skipped data produces neutral empty states rather than invented defaults or health claims.

### First-use guidance

A maximum three-step, dismissible introduction explains:

1. Home shows what is happening now.
2. Log records care and supports corrections.
3. Plans schedules care; Health keeps trends and shareable records.

It does not block the app, require a swipe gesture, or reappear after dismissal. Contextual empty states teach the next real action at the moment it is needed.

### Permanent help

More includes “How WoofWatcher works,” written in plain language and organized around the same five tabs. Every instruction is backed by a navigation/behavior test so copy cannot promise a control or outcome that does not exist.

## Visual and Interaction System

The approved Premium Neo-Retro Pixel Care identity remains: cream/ivory content, navy shell, copper emphasis, sage completion, readable modern type, and pixel art as the emotional center.

Universal interaction rules:

- Minimum touch target: 48×48 logical pixels.
- Body text target: 16 logical pixels; secondary text never below 14 without an accessibility exception.
- Dynamic Type/font scaling must not hide controls or truncate care-critical content.
- Repeated cards use one spacing, border, radius, and elevation vocabulary.
- Primary actions use action verbs: “Log meal,” “Start walk,” “Generate Care Pass.”
- Brand terms such as Care Sense are followed by plain-language meaning.
- Icons support labels; they do not replace labels for primary navigation or care actions.
- Loading, empty, error, offline/local-only, saved, canceled, and failed states are explicit.
- Destructive actions identify exactly what will be removed and preserve recovery where practical.

Desktop remains a framed/supporting experience. It uses the same information ownership and does not introduce a competing navigation model.

## Motion System

Motion is rebuilt as a coherent system, not tuned one spring at a time.

### Phoenix asset pipeline

Phoenix animation work follows the repository’s sprite pipeline:

1. Approve one production seed pose and hard-pixel style.
2. Generate or draw an entire action strip in one pass so scale, palette, lighting, and anatomy remain consistent.
3. Normalize every frame with one shared scale and bottom-center/root anchor.
4. Lock the approved seed frame when normalization must not alter it.
5. Render a labeled preview sheet and inspect it before integration.
6. Test the normalized assets inside the real Home renderer at final device size.

Separate strips are required for idle breathing, tail wagging, walking, and reactions. Reusing the same strip at different frame rates is not an acceptable substitute.

The walk target is 12–16 intentionally spaced hard-pixel poses at 12–15 fps. Pixel poses may remain deliberately stepped, while room travel and interaction feedback render at display refresh rate. Every looping strip has a measured loop seam, contains no identical consecutive padding frames, and meets a documented minimum meaningful-pose count for its action. Each one-shot reaction contains genuine enter, action, settle, and final-hold poses with no duplicate padding.

The approved Home slot is 112 logical pixels unless the visual audit changes the component measurement before asset production. The pipeline exports pre-rasterized 112px web, 224px @2x, and 336px @3x variants with nearest-neighbor resampling and verifies that the native renderer does not smooth them. If the measured slot changes, all three variants are regenerated from the normalized masters; runtime scaling of a 256px frame into an arbitrary slot is not accepted.

No runtime texture exceeds 4096 pixels in either dimension. A 3× action that would exceed that limit is split into deterministic pages rather than downscaled. The scene keeps no more than the current and next Phoenix actions resident during a transition, stays within a 20 MiB decoded Phoenix-texture budget at 3× density, releases non-current action pages after transition, and releases scene textures when the scene is offscreen or the app is backgrounded.

### Runtime controller

A single `PhoenixMotionController` owns Phoenix time on the UI thread:

- one normalized phase drives sprite frame, body root, paw contact, shadow, bob, and travel;
- `SpriteSheetPlayer` consumes external phase/frame state instead of creating an independent repeating clock;
- no continuous visual motion is coordinated by React state plus JS timers;
- walking and dwell textures remain mounted and preloaded;
- state changes use an aligned 80–120ms crossfade or a defined contact frame, with no blanking or frame-zero reset;
- user reactions use explicit enter, hold, and settle phases whose animation completion owns the transition;
- motion pauses when the app is inactive or the scene is offscreen.

During a crossfade, both atlases use the same root, scale, frame box, contact phase, shadow, and accessory stack. Their opacities are complementary and render as one aligned silhouette; a second shadow, accessory, or visibly doubled dog is a defect.

The current independent 800ms gait, 680ms bob, and 760ms body clocks are removed. The authored sprite supplies gait motion; the parent rig adds only contact-derived movement, not a second unrelated bounce.

### App motion vocabulary

- Centralize timings and springs in `GameFeel`.
- Use one entrance layer: visible cards only, 0/40/80ms stagger, completed within 260ms.
- Remove simultaneous whole-screen and nested-card entrances.
- Buttons and tabs respond on touch-down within one rendered frame; navigation and haptic follow the same interaction.
- Entrances do not replay merely because a tab regains focus.
- Reduce Motion disables perpetual sprite, roam, bob, shimmer, parallax, hearts, and translated screen entrances. Phoenix snaps to a meaningful state pose; essential state changes use instant or minimal opacity feedback.

### Motion acceptance

- The reproducible baseline is a Release build on an iPhone 13 / iOS 18.6 and Pixel 7a / Android 15, plus the owner’s current release-candidate devices. Record the exact hardware, OS, build SHA, data fixture, profiler, and thermal state in the PR. Use Xcode Instruments for iOS and Android Studio System Trace/Perfetto for Android, one warm-up followed by three identical measured runs, and report the median plus worst run.
- Release builds sustain a median of at least 59 fps on 60Hz test devices.
- Fewer than 1% of frames exceed 20ms during a 15-second idle → walk → react → tab-switch trace.
- No frame exceeds 50ms during Home collapse, tab change, or reaction transition.
- No JavaScript task exceeds 50ms during a motion-critical interaction.
- Adjacent normalized walk frames have root/pelvis drift no greater than 2 source pixels and unintended displayed torso movement no greater than 1 pixel.
- Named landmarks are pelvis/root, shoulder line, eye line, planted paws, and torso bounding box. Adjacent torso width/height may vary no more than 4% unless an annotated reaction intentionally uses squash/stretch.
- Adjacent silhouette delta, including the loop seam, stays within 2.5× the sequence median.
- Every looping strip meets the seam threshold and has no identical consecutive frames; every reaction has distinct enter/action/settle poses and a purposeful terminal hold.
- Paw baseline drift stays within 1 source pixel.
- Paw contact is the authoritative phase event. Pose, bob, shadow, and travel accumulate zero phase drift and remain within one authored pose frame after 60 seconds.
- Across planted-contact frames, the contacting paw moves no more than 1 displayed pixel in world space after parent travel is applied.
- No sprite blanking, hard reset, double silhouette, second shadow, or scale jump occurs during walk/dwell transitions.
- Touch-down-to-visible button/tab response is at most 50ms, and tab content does not replay its entrance when refocused.
- Leaving Home and backgrounding the app stops scene clocks/CPU work; resuming produces no catch-up jump and starts from a deterministic meaningful pose/anchor.
- With Reduce Motion, a settled three-second capture has zero perpetual frame, roam, bob, shimmer, parallax, or heart changes; Phoenix immediately uses the correct anchor and no screen/card translation runs.
- During every sampled Home-collapse frame, fixed-room/spacer alignment error is at most 1px; collapse is included in the native frame trace.

## Functional Correctness Work

Correctness is part of the redesign and precedes presentation polish where data could be lost or misrepresented.

### Reports and sharing

- Replace the one-page ASCII Care Pass writer with a paginated, Unicode-capable generator.
- Preserve every report section and verify unique sentinels survive generation.
- Use a real native file-sharing adapter for PDF, PNG, and HTML on Android and iOS, with MIME type and recipient-open proof.
- Make Dog ID layout show all priority fields, including Microchip and Insurance, without relying on invisible metadata.
- Record only the outcome the platform can prove: “share sheet opened,” “copied,” “downloaded,” “canceled,” or “failed.” Never claim “delivered” or “shared” without an external receipt.
- Test worst-case reports with many sections, page breaks, long emergency contacts, long microchip/insurance values, and Unicode names/medications. Inspect recipient-rendered PDF and PNG screenshots for clipping in addition to parsing the artifacts.

### Local calendar and validation

- Centralize an injected local calendar-key/date-time helper and migrate every Today, streak, schedule, Records, and WoofGuide consumer.
- Reject impossible dates through strict parse-and-round-trip validation.
- Use one canonical time parser for save, sort, handoff, medication, and routine derivation.
- Require full-string numeric input; enforce positive served amount for completed meals and eaten amount no greater than served when units match.
- Version and migrate existing malformed routine, event, and record dates without coercion or loss. Preserve the raw value, mark it “Needs correction,” sort it after valid values, and exclude it from due/next-occurrence calculations until the owner fixes it.
- Exercise the local-date helper at an evening UTC rollover, both sides of local midnight, year rollover, DST spring-forward/fall-back, and at least one timezone east and west of UTC.

### Records and attachments

- Add open, preview, share, and download actions for owned attachments.
- Define an app-owned attachment as a manifest-tracked file inside the versioned Records attachment directory. Never delete an external, cache, web, or arbitrary `content://` URI.
- Replace transaction order is: copy the new file to owned storage → durably persist the new metadata reference → delete the old app-owned file. A failed persistence step deletes the new draft copy and leaves the old reference/file intact.
- Cancel and delete remove only manifest-owned files, are idempotent, and expose recovery/error state when cleanup fails.
- Do not claim transient web references are durable after reload.
- Verify attachment bytes survive save/open/share and that lifecycle cleanup is idempotent.

### Truthful capabilities

- Remove photo-analysis confidence, detected traits, and `scanAssisted` claims until a real analyzer adapter provides them.
- In the current product, Avatar Studio may use a clearly labeled profile-based template and selected photo as a manual visual reference.
- Keep household accounts/invites, multi-device sync, live AI, push delivery, payments, cloud report storage, provider account deletion, and true multi-dog care gated and absent from consumer claims.

## Code Architecture

The renovation decomposes oversized routes incrementally. It does not replace the tested care domain or migrate frameworks in the same change.

- Tab route files become composition shells.
- Screen sections become focused components with explicit inputs and callbacks.
- Workflow controllers own UI state and invoke domain/services.
- Calendar keys, validation, artifact generation, file lifecycle, and sharing live in independently tested helpers/adapters.
- Canonical route ownership prevents multiple implementations of the same workflow.
- AsyncStorage migrations remain backward-compatible and recoverable.
- SDK 54 Expo Router tabs remain during this program. Native Tabs or an SDK 55 upgrade is a separate evaluated migration after the universal experience is stable.

## Accessibility and All-Ages Acceptance

The universal interface must pass:

- VoiceOver and TalkBack traversal in visual order with useful names, values, hints, and roles;
- large-text layouts at supported accessibility sizes without losing primary actions;
- sufficient contrast for text, status, focus, and disabled states;
- status communication through text/shape as well as color;
- touch targets of at least 48×48;
- keyboard and focus support for web/desktop;
- Reduce Motion behavior defined above;
- the observed first-time usability protocol below.

No essential control may require precision dragging, timed input, long press, or animation interpretation.

Required text-size checks are iOS Accessibility Large and `UIContentSizeCategory.accessibilityExtraExtraExtraLarge`, plus Android `fontScale=2.0` and the emulator/device’s largest display size. Content may reflow or scroll, but primary controls, care values, validation messages, and navigation labels may not clip, overlap, or become unreachable.

### Observed usability protocol

Test at least five first-time participants: the owner, one adult aged 60 or older, one responsible younger caregiver aged 13–17 with guardian permission, one self-described low-technical-confidence adult, and one additional target caregiver. A participant may satisfy more than one demographic requirement, but the session set still contains five people.

From a seeded but previously unseen build, measure these tasks without revealing navigation:

1. Identify Phoenix’s presence, next care, and whether anything needs attention within 15 seconds.
2. Safely log Water and one detailed Meal/Potty action within 45 seconds.
3. Start a Walk, find its active state, and locate Finish within 30 seconds.
4. Find and correct an older log within 60 seconds.
5. Find a health record and the Care Pass preview within 45 seconds.
6. Find Dog Profile and Privacy/export/delete within 45 seconds each.
7. Recover from one mistaken tap and return to the intended task within 15 seconds.

At least four of five participants must complete every task within its limit without a facilitator hint. All five must complete the safety-critical logging, active-session, correction, and privacy tasks with no unrecovered data error. The older and younger participant must each complete those safety-critical tasks. Any misleading label, repeated wrong turn, accidental medication completion, inaccessible text/control, or required hidden gesture blocks acceptance even if the time threshold is met.

## Delivery Slices

Each slice is a separate reviewable pull request or small related PR group. Every slice begins with failing behavior tests and ends with exact-build QA.

### 0. Truth and data integrity

Local dates/times, strict validation, complete Care Pass/Dog ID output, real native sharing, truthful share history, attachment lifecycle, and removal of fake photo-scan claims.

This slice cannot merge on browser tests alone. Its own gate includes a Release-build iOS and Android test proving attached files open in a recipient app, saved attachments reopen byte-for-byte, canceled/replaced/deleted attachments follow the ownership transaction, and a failed save never deletes the previous file.

### 1. Universal shell and ownership

Five labeled tabs, explicit Log action, route redirects/backward compatibility, More grouping, Health ownership of Records/Reports, and removal of Pack/Story as primary destinations.

The same slice updates all onboarding, empty-state, help, deep-link, accessibility-label, and test copy that names the old tabs. Instruction parity is a merge gate, not deferred documentation work.

### 2. Home hierarchy

Decompose Home, implement the first-viewport contract, expose Quick Log details, simplify status and recent care, preserve fixed-room/swipe behavior, and remove competing progress/promo sections.

### 3. Core workflow screens

Simplify Log, Plans, Health/Records, and More; add truthful empty/error states; align all secondary routes and instruction copy.

### 4. Phoenix and interaction motion

Produce normalized independent animation strips, add the unified motion controller, remove JS-timer visual scheduling and double entrances, complete Reduce Motion, and tune only from native traces.

### 5. Onboarding, help, accessibility, and release evidence

Add minimal first-use guidance and permanent help, complete screen-reader/large-text audits, regenerate accurate store screenshots, and run physical iPhone/Android owner acceptance.

Critical correctness work may ship ahead of the visual slices. Navigation and route ownership land before large screen-layout rewrites. Motion assets do not ship until preview-sheet, in-engine, performance, and Reduce Motion gates pass.

## Verification Matrix

| Gate | Required evidence |
| --- | --- |
| Unit/domain | Red-to-green tests for the full timezone/DST matrix, legacy-invalid-value migration, strict input, report completeness, visible Dog ID fields, precise share outcomes, transactional attachment ownership/lifecycle, and motion math |
| Component/navigation | All five tabs and canonical secondary/deep-link routes; selected-parent behavior; Quick Log safety matrix; full Log History; truthful empty/error states; instruction parity |
| Artifact rendering | Parsed section/Unicode completeness plus recipient-rendered screenshots using long emergency, insurance, microchip, medication, and multi-page fixtures |
| Asset | Shared normalization, root/paw/body-box alignment, palette/alpha, unique-pose count, no duplicate padding, every loop seam, distinct idle/tail/walk/reaction strips, preview sheet, texture budget |
| Web/export | Full typecheck, tests, asset audit, Expo export, runtime and handoff routes, no app-origin console errors |
| Rendered layout | 390×844 phone, short 1365×700 desktop, required large-text settings, ≤1px alignment at every sampled Home-collapse frame, scroll starting over Phoenix |
| iOS | Fixed-baseline Release build, VoiceOver, required Dynamic Type sizes, Reduce Motion settled capture, report/attachment sharing and recipient open, persistence/reload, three-run Instruments trace |
| Android | Fixed-baseline Release build, TalkBack, 200% font/largest display, Reduce Motion settled capture, true attached-file sharing opened by a recipient app, persistence/reload, three-run Perfetto trace |
| Observed usability | Five-person protocol, task times, wrong turns, hints, errors, recovery, and accessibility notes; required demographic and pass thresholds met |
| Owner acceptance | Exact release-candidate navigation, visual quality, animation quality, real functionality, and explicit approval |

If the hosted browser remains behind owner authentication, the owner may sign in directly without sharing credentials. A local Playwright or simulator fallback is used only with explicit permission. Browser evidence never substitutes for physical-device sharing, accessibility, or performance gates.

## Non-Goals

This renovation does not:

- enable cloud sync, provider accounts, live AI, push delivery, payments, subscriptions, cloud storage, or true multi-dog support;
- deploy to production or submit to an app store without a later explicit release decision;
- change medical safety boundaries;
- rewrite the care domain from scratch;
- combine a risky Expo/Router SDK migration with the experience renovation;
- treat automated tests as a substitute for owner experience and device QA.

## Definition of Done

The renovation is complete only when:

- the five-tab universal navigation is consistent across mobile and supporting desktop experiences;
- a first-time caregiver can complete setup, log care, create a plan, find health records, generate/share a complete report, and find privacy controls without hidden gestures or instructions from the developer;
- every instruction matches a tested feature;
- all confirmed correctness defects in this document are closed;
- Phoenix motion meets the asset, synchronization, transition, performance, and Reduce Motion thresholds;
- the app passes automated, rendered, physical iOS, physical Android, accessibility, and owner-acceptance gates;
- all visible consumer claims describe functionality that is actually available;
- production remains untouched until a separately approved release handoff.
