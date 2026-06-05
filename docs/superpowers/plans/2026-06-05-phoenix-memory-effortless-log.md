# Phoenix Memory + Effortless Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn WoofWatcher from the older care-command dashboard into the approved Phoenix-first app slice with avatar state, Household Pulse, Plans, Effortless Log, Diet Profile, Treat Log, Training Win, and Alone Time.

**Architecture:** Preserve the existing dependency-light PWA and local-first model. Add deterministic core helpers in `src/woof-core.js`, cover them with Node built-in tests, then adapt `src/app.js` and `styles.css` to the approved Premium Playful Storybook Utility UI without changing storage keys or requiring cloud services.

**Tech Stack:** Vanilla HTML/CSS/ES modules, Node built-in test runner, localStorage, service worker, existing static server and render-smoke scripts.

---

## File Structure

- Modify `src/woof-core.js`: add new event types, diet profile normalization, Household Pulse helper, Avatar State Engine, richer entry fields, and assistant context additions.
- Modify `test/woof-core.test.mjs`: add failing tests for diet profile normalization, treat/training/alone log fields, Household Pulse labels, avatar evidence, and health-safe copy.
- Modify `src/app.js`: import new helpers, replace the default home surface with Phoenix Home, add Plans tab, rename everyday handoff to Household Pulse, add Effortless Log grid, and add Diet Profile UI under More/Records-adjacent surfaces.
- Modify `styles.css`: implement the approved warm ivory/deep navy/forest/copper visual system, mobile-first app shell, Phoenix avatar scene, compact cards, bottom nav, and responsive desktop rail.
- Modify `scripts/render-smoke.mjs`: update smoke text/routes from old labels to `Phoenix`, `Log`, `Plans`, `Health`, `More`, `Household Pulse`, and `WoofGuide`.
- Modify `README.md` and `docs/V1_COMPLETION_AUDIT.md`: record this as the next implemented product slice after verification.

## Task 1: Core Care Model

**Files:**
- Modify: `src/woof-core.js`
- Test: `test/woof-core.test.mjs`

- [ ] **Step 1: Write failing tests for new entry fields and diet profile**

Add tests that demonstrate the intended API:

```js
test("normalizes diet profile and preserves Phoenix appetite quirks", () => {
  const state = normalizeState({
    dietProfile: {
      primaryFood: "Sensitive stomach kibble",
      normalPortion: "1.5 cups",
      bedtimeSnack: "Small biscuit before sleep",
      treatsAllowed: "Training treats, dental chew",
      avoid: "Rich table scraps",
      appetiteQuirks: "Eats best when the house is calm"
    }
  }, "2026-06-05T12:00:00.000Z");

  assert.equal(state.dietProfile.primaryFood, "Sensitive stomach kibble");
  assert.equal(state.dietProfile.bedtimeSnack, "Small biscuit before sleep");
  assert.match(state.dietProfile.appetiteQuirks, /house is calm/);
});

test("normalizes treat, training win, and alone time logs with optional details", () => {
  const treat = createEntry({
    type: "treat",
    title: "Training treat",
    treatType: "High-value",
    reason: "Recall practice",
    reaction: "Focused"
  });
  const win = createEntry({
    type: "training",
    title: "Loose leash win",
    skill: "Loose leash",
    outcome: "win",
    moodAfter: "proud"
  });
  const alone = createEntry({
    type: "alone",
    title: "Home alone",
    durationMinutes: 82,
    aloneOutcome: "calm",
    endedAt: "2026-06-05T20:10:00.000Z"
  });

  assert.equal(treat.treatType, "High-value");
  assert.equal(treat.reason, "Recall practice");
  assert.equal(win.skill, "Loose leash");
  assert.equal(win.outcome, "win");
  assert.equal(alone.type, "alone");
  assert.equal(alone.aloneOutcome, "calm");
});
```

- [ ] **Step 2: Run red tests**

Run:

```powershell
& "C:\Users\Apoll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --test test/woof-core.test.mjs
```

Expected: FAIL because `dietProfile` defaults and the new entry detail fields are not normalized yet.

- [ ] **Step 3: Implement minimal core normalization**

Add event types: `potty`, `poop`, `pee`, `play`, `mood`, `alone`, and keep all existing types. Add `dietProfile` to default/normalized state. Extend `normalizeEntryInput` with optional fields: `food`, `portionOffered`, `portionEaten`, `appetite`, `treatType`, `reason`, `reaction`, `skill`, `outcome`, `moodBefore`, `moodAfter`, `aloneOutcome`, `endedAt`.

- [ ] **Step 4: Run green tests**

Run the same focused test command. Expected: all tests in `test/woof-core.test.mjs` pass.

## Task 2: Household Pulse + Avatar State Engine

**Files:**
- Modify: `src/woof-core.js`
- Test: `test/woof-core.test.mjs`

- [ ] **Step 1: Write failing tests for Household Pulse and avatar states**

Add tests:

```js
test("builds Household Pulse with daily status and careful language", () => {
  const state = {
    ...getDefaultState("2026-06-05T12:00:00.000Z"),
    entries: [
      createEntry({ type: "meal", title: "Breakfast", caregiver: "Apollo", occurredAt: "2026-06-05T14:00:00.000Z" }),
      createEntry({ type: "walk", title: "Morning walk", caregiver: "Emma", occurredAt: "2026-06-05T15:00:00.000Z" }),
      createEntry({ type: "vomit", title: "Yellow bile", caregiver: "Apollo", occurredAt: "2026-06-05T16:00:00.000Z" })
    ]
  };

  const pulse = getHouseholdPulse(state, "2026-06-05T18:00:00.000Z");

  assert.equal(pulse.label, "Household Pulse");
  assert.match(pulse.summary, /Phoenix/);
  assert.equal(pulse.timeline.length, 3);
  assert.match(pulse.healthBoundary, /not veterinary advice/);
});

test("chooses Phoenix avatar state from evidence without diagnosing", () => {
  const state = {
    ...getDefaultState("2026-06-05T12:00:00.000Z"),
    entries: [
      createEntry({ type: "vomit", title: "Yellow bile", occurredAt: "2026-06-05T16:00:00.000Z" })
    ]
  };

  const avatar = getAvatarState(state, "2026-06-05T18:00:00.000Z");

  assert.equal(avatar.mood, "tummy-watch");
  assert.equal(avatar.urgency, "watch");
  assert.match(avatar.speech, /tummy/);
  assert.match(avatar.evidence.join(" "), /vomit/i);
  assert.doesNotMatch(avatar.speech, /diagnosed|treat/i);
});
```

- [ ] **Step 2: Run red tests**

Expected: FAIL because `getHouseholdPulse` and `getAvatarState` do not exist.

- [ ] **Step 3: Implement helpers**

Export `getHouseholdPulse(state, now)` and `getAvatarState(state, now)`. Use existing `getTodayPlan`, `getReminderCenter`, `getHealthWatch`, and `getBileWatch`. Priority order for avatar state: vomit/urgent health -> active alone time -> overdue walk/play -> upcoming walk -> training win -> all care complete -> calm/default.

- [ ] **Step 4: Run green tests**

Expected: focused tests pass.

## Task 3: Phoenix Home + App Navigation

**Files:**
- Modify: `src/app.js`
- Modify: `styles.css`
- Test: `scripts/render-smoke.mjs`

- [ ] **Step 1: Update smoke expectations first**

Change render-smoke fallback checks to expect:

```js
{ route: "/", label: "phoenix", text: ["WoofWatcher", "Phoenix", "Household Pulse", "WoofGuide", "Next best action"] },
{ route: "/?tab=plans", label: "plans", text: ["Plans", "Today plan", "Scheduled walks", "Bedtime snack"] },
{ route: "/?tab=log", label: "log", text: ["Effortless Log", "Meal", "Treat", "Training Win", "Alone Time"] },
{ route: "/?tab=health", label: "health", text: ["Health", "Bile Watch", "No new alerts"] },
{ route: "/?tab=more", label: "more", text: ["More", "Diet Profile", "Care Pass", "WoofGuide"] }
```

- [ ] **Step 2: Run red smoke**

Run:

```powershell
& "C:\Users\Apoll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts/render-smoke.mjs
```

Expected: FAIL or fallback failure because the new labels/screens do not exist.

- [ ] **Step 3: Implement navigation and Phoenix Home**

Import `getAvatarState` and `getHouseholdPulse`. Set default tab to `phoenix`. Keep old route aliases working: `today` -> `phoenix`, `assistant` -> `more`, `schedule` -> `plans`, `reminders` -> `plans`, `team` -> `more`, `records` -> `more`, `report` -> `more`.

Render bottom nav: `Phoenix`, `Log`, `Plans`, `Health`, `More`. Create Phoenix Home with avatar scene, mood, evidence, next best action, today's care overview, Household Pulse, Health Watch, and WoofGuide compact card.

- [ ] **Step 4: Implement visual system**

Update `styles.css` tokens and shell:

```css
:root {
  color-scheme: light;
  --ivory: #f7f5f1;
  --navy-shell: #0f1f33;
  --forest: #2e5b46;
  --sage-soft: #d6e0d2;
  --copper-warm: #b8643d;
  --stone: #e5e2dc;
}
```

Keep responsive mobile constraints and prevent text overlap.

- [ ] **Step 5: Run green smoke**

Expected: render smoke passes through fallback or CDP.

## Task 4: Effortless Log + Plans + More

**Files:**
- Modify: `src/app.js`
- Modify: `styles.css`
- Test: `scripts/render-smoke.mjs`

- [ ] **Step 1: Write/adjust smoke checks for forms**

Ensure smoke can submit a meal, treat, training win, and alone time through the UI and then verify localStorage contains entries of those types.

- [ ] **Step 2: Run red smoke**

Expected: FAIL before UI handlers exist.

- [ ] **Step 3: Implement Effortless Log grid**

Add one-tap buttons for Meal, Treat, Walk, Potty, Poop, Pee, Play, Zoomies, Training Win, Anxious, Happy, Sleepy, Vomit, Medication, Alone Time, Vet, Note. Clicking a button creates a safe default entry and shows it in the recent log strip. Keep the deep manual form available under `Add details`.

- [ ] **Step 4: Implement Plans and More surfaces**

Plans should show today routine, scheduled walks, meals, bedtime snack, training, vet visit, alone-time windows, and reminder proof. More should show Diet Profile, Humans/Care Team, Records, Reports, Care Pass, and WoofGuide.

- [ ] **Step 5: Run green smoke**

Expected: the new UI workflows write local state and visible text updates.

## Task 5: Docs And Final Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/V1_COMPLETION_AUDIT.md`
- Modify: `docs/V1_PLAN.md`

- [ ] **Step 1: Update docs after tests pass**

Record that Phoenix Home, Avatar State Engine, Household Pulse, Effortless Log, Diet Profile, Treat Log, Training Win, and Alone Time are implemented locally.

- [ ] **Step 2: Run full verification**

Run:

```powershell
& "C:\Users\Apoll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --test
& "C:\Users\Apoll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --check src/woof-core.js
& "C:\Users\Apoll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --check src/app.js
& "C:\Users\Apoll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --check scripts/render-smoke.mjs
& "C:\Users\Apoll\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts/render-smoke.mjs
```

Expected: all pass.

- [ ] **Step 3: Commit**

Commit message:

```text
Build Phoenix-first care experience
```

## Out Of Scope For This Plan

- Live OpenAI key setup.
- Cloud household accounts and realtime sync.
- Closed-app cross-device push notifications.
- Native iOS Xcode/App Store shipping.
- Rive character rig.
- Public Vercel demo with Phoenix/private split.

These are separate implementation plans after the local app feels like WoofWatcher.

## Self-Review

- Spec coverage: this plan covers the next local app slice from the visual lock and product vision. Cloud, AI-live, iOS, and Rive animation are intentionally deferred.
- Placeholder scan: no `TBD`, `TODO`, or unspecified edge handling remains.
- Type consistency: new helper names are `getAvatarState`, `getHouseholdPulse`, and `dietProfile`; UI labels match `Phoenix`, `Log`, `Plans`, `Health`, `More`, `Household Pulse`, `Care Pass`, and `WoofGuide`.
