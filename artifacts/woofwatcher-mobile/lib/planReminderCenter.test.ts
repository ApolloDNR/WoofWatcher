import assert from "node:assert/strict";
import { test } from "node:test";

import type { CareReminderItem } from "@workspace/care-domain";

import * as planReminderCenter from "./planReminderCenter.ts";
import {
  buildPlanReminderFocusRequestKey,
  buildPlanReminderSections,
  coordinatePlanReminderFocus,
  createPlanReminderFocusLifecycle,
  getPlanReminderAction,
  getReminderFocusScrollY,
  PLAN_REMINDER_FOCUS_MAX_ATTEMPTS,
  PLAN_REMINDER_LIMIT,
  reminderWhenLabel,
  resolvePlanReminderDestination,
  resolvePlanReminderFocus,
  runPlanReminderInteraction,
  type PlanReminderFocusRequest,
} from "./planReminderCenter.ts";

function reminder(
  id: string,
  patch: Partial<CareReminderItem> = {},
): CareReminderItem {
  return {
    id,
    kind: "record",
    label: id,
    detail: "detail",
    action: "review",
    urgency: "info",
    owner: "Household",
    ...patch,
  };
}

function frameScheduler() {
  let nextHandle = 1;
  const pending = new Map<number, () => void>();
  const scheduled = new Map<number, () => void>();
  const cancelled: number[] = [];

  return {
    scheduler: {
      request(callback: () => void) {
        const handle = nextHandle++;
        pending.set(handle, callback);
        scheduled.set(handle, callback);
        return handle;
      },
      cancel(handle: unknown) {
        const numericHandle = Number(handle);
        cancelled.push(numericHandle);
        pending.delete(numericHandle);
      },
    },
    runNext() {
      const next = pending.entries().next().value as
        | [number, () => void]
        | undefined;
      if (!next) return false;
      pending.delete(next[0]);
      next[1]();
      return true;
    },
    runAll() {
      let runs = 0;
      while (this.runNext()) {
        runs += 1;
        assert.ok(runs < 20, "bounded retry scheduler must terminate");
      }
      return runs;
    },
    get pendingCount() {
      return pending.size;
    },
    get scheduledCallbacks() {
      return [...scheduled.values()];
    },
    cancelled,
  };
}

test("groups at most 50 reminders without inventing a date", () => {
  const items = [
    reminder("today", { daysUntil: 0 }),
    reminder("tomorrow", { daysUntil: 1 }),
    reminder("later", { daysUntil: 8 }),
    reminder("undated"),
    ...Array.from({ length: 55 }, (_, index) =>
      reminder(`tail-${index}`, { daysUntil: 20 + index }),
    ),
  ];
  const sections = buildPlanReminderSections(items);

  assert.deepEqual(
    sections.map((section) => section.label),
    ["Today", "Tomorrow", "Later", "No date"],
  );
  assert.equal(
    sections.reduce((count, section) => count + section.items.length, 0),
    PLAN_REMINDER_LIMIT,
  );
  assert.equal(reminderWhenLabel(items[3]), "No date");
});

test("focuses only a validated known row and never turns focus into an action", () => {
  const items = [reminder("record_known")];
  assert.equal(
    resolvePlanReminderFocus({ item: "record_known" }, items),
    "record_known",
  );
  assert.equal(
    resolvePlanReminderFocus({ item: ["record_known", "ignored"] }, items),
    undefined,
  );
  assert.deepEqual(
    resolvePlanReminderDestination({ item: ["record_known", "ignored"] }),
    {
      parent: "plans",
      pathname: "/calendar",
      params: { section: "reminders" },
      replace: true,
    },
  );
  assert.equal(resolvePlanReminderFocus({ item: "missing" }, items), undefined);
  assert.equal(
    resolvePlanReminderFocus({ item: "bad value" }, items),
    undefined,
  );

  const inherited = Object.create({ item: "record_known" }) as Record<
    string,
    unknown
  >;
  assert.equal(resolvePlanReminderFocus(inherited, items), undefined);
  assert.deepEqual(getPlanReminderAction(items[0]), {
    kind: "navigate",
    pathname: "/health",
    params: { section: "records" },
  });
});

test("targets the Reminder Center anchor when a canonical center link has no known row", () => {
  const planReminderCenterFocusTarget = Reflect.get(
    planReminderCenter,
    "PLAN_REMINDER_CENTER_FOCUS_TARGET",
  ) as unknown;
  const resolvePlanReminderFocusTarget = Reflect.get(
    planReminderCenter,
    "resolvePlanReminderFocusTarget",
  ) as unknown;
  assert.equal(typeof planReminderCenterFocusTarget, "string");
  assert.equal(typeof resolvePlanReminderFocusTarget, "function");
  const resolveTarget = resolvePlanReminderFocusTarget as (
    params: Readonly<Record<string, unknown>>,
    items: readonly CareReminderItem[],
  ) => string | undefined;
  const items = [reminder("record_known")];

  assert.equal(
    resolveTarget({ section: "reminders", item: "record_known" }, items),
    "record_known",
  );
  assert.equal(
    resolveTarget({ section: "reminders" }, items),
    planReminderCenterFocusTarget,
  );
  assert.equal(
    resolveTarget({ section: "reminders", item: "missing" }, items),
    planReminderCenterFocusTarget,
  );
  assert.equal(resolveTarget({}, items), undefined);
  assert.equal(
    resolveTarget({ section: "not-reminders", item: "record_known" }, items),
    undefined,
  );
});

test("routes canonical reminder actions by owner", () => {
  assert.deepEqual(
    getPlanReminderAction(
      reminder("routine", { kind: "routine", sourceId: "dinner" }),
    ),
    { kind: "edit-routine", routineId: "dinner" },
  );
  assert.deepEqual(
    getPlanReminderAction(reminder("med", { kind: "medication" })),
    {
      kind: "navigate",
      pathname: "/health",
      params: { section: "medications" },
    },
  );
  assert.deepEqual(getPlanReminderAction(reminder("record")), {
    kind: "navigate",
    pathname: "/health",
    params: { section: "records" },
  });
  assert.deepEqual(
    getPlanReminderAction(reminder("groom", { kind: "grooming" })),
    {
      kind: "navigate",
      pathname: "/log",
      params: { type: "grooming", detail: "1" },
    },
  );
});

test("subtracts route top padding exactly once from focused-row scroll geometry", () => {
  assert.equal(getReminderFocusScrollY(640, 72), 568);
  assert.equal(getReminderFocusScrollY(40, 72), 0);
});

test("measures a nested row in ScrollView content coordinates and focus causes no care action", () => {
  const effects = {
    measured: [] as string[],
    scrolled: [] as number[],
    navigated: 0,
    edited: 0,
    writes: 0,
  };
  const handled = runPlanReminderInteraction(
    { kind: "focus", itemId: "record_known", routeTopPadding: 72 },
    {
      measureItemInScrollContent: (itemId, onMeasured) => {
        effects.measured.push(itemId);
        // This is the row's real ScrollView-content y. It already includes
        // every nested BoardCard, header, list, section, and row offset.
        onMeasured(712);
        return true;
      },
      scrollTo: (y) => effects.scrolled.push(y),
      navigate: () => {
        effects.navigated += 1;
      },
      editRoutine: () => {
        effects.edited += 1;
      },
      writeCare: () => {
        effects.writes += 1;
      },
    },
  );

  assert.equal(handled, true);
  assert.deepEqual(effects, {
    measured: ["record_known"],
    scrolled: [640],
    navigated: 0,
    edited: 0,
    writes: 0,
  });
});

test("keys reminder focus by id, top padding, ordered rendered fields, and row count", () => {
  const sections = buildPlanReminderSections([
    reminder("record_known", {
      label: "Rabies renewal",
      detail: "Due in 8 days",
      action: "Open Records",
      urgency: "watch",
      owner: "Apollo",
      sourceId: "rabies-record",
      time: "9:00 AM",
      daysUntil: 8,
    }),
    reminder("med_known", {
      label: "Vaccination renewal",
      detail: "Due in 9 days",
      action: "Open Records",
      urgency: "info",
      daysUntil: 9,
    }),
  ]);
  const baseRequest = {
    itemId: "record_known",
    routeTopPadding: 72,
    sections,
    summary: "2 reminders - 0 urgent, 1 watch.",
    alertCount: 0,
    watchCount: 1,
    totalCount: 2,
  };
  const base = buildPlanReminderFocusRequestKey(baseRequest);

  assert.equal(typeof base, "string");
  assert.equal(
    buildPlanReminderFocusRequestKey({
      ...baseRequest,
      sections: structuredClone(sections),
    }),
    base,
    "object identity and an unrelated rerender must not change the focus key",
  );
  assert.notEqual(
    buildPlanReminderFocusRequestKey({ ...baseRequest, routeTopPadding: 96 }),
    base,
  );
  assert.notEqual(
    buildPlanReminderFocusRequestKey({ ...baseRequest, itemId: "med_known" }),
    base,
  );
  assert.notEqual(
    buildPlanReminderFocusRequestKey({
      ...baseRequest,
      sections: sections.map((section) => ({
        ...section,
        items: section.items.map((item) =>
          item.id === "record_known"
            ? { ...item, detail: "Due tomorrow" }
            : item,
        ),
      })),
    }),
    base,
  );
  assert.notEqual(
    buildPlanReminderFocusRequestKey({
      ...baseRequest,
      sections: sections.map((section) => ({
        ...section,
        items: [...section.items].reverse(),
      })),
    }),
    base,
  );
  assert.notEqual(
    buildPlanReminderFocusRequestKey({
      ...baseRequest,
      sections: sections.map((section, index) =>
        index === 0 ? { ...section, items: section.items.slice(1) } : section,
      ),
    }),
    base,
  );

  const withChangedFocusedRow = (patch: Partial<CareReminderItem>) =>
    buildPlanReminderFocusRequestKey({
      ...baseRequest,
      sections: sections.map((section) => ({
        ...section,
        items: section.items.map((item) =>
          item.id === "record_known" ? { ...item, ...patch } : item,
        ),
      })),
    });
  for (const patch of [
    { owner: "Emma" },
    { sourceId: "replacement-record" },
    { time: "9:30 AM" },
    { daysUntil: 7 },
  ] as const) {
    assert.notEqual(withChangedFocusedRow(patch), base);
  }
  assert.notEqual(
    buildPlanReminderFocusRequestKey({
      ...baseRequest,
      summary: "Summary changed.",
    }),
    base,
  );
  assert.notEqual(
    buildPlanReminderFocusRequestKey({ ...baseRequest, totalCount: 3 }),
    base,
  );
});

test("coordinates focus once, rejects stale callbacks, clears on absence, and retries failed measurement", () => {
  const sections = buildPlanReminderSections([
    reminder("record_known", { daysUntil: 4 }),
    reminder("record_other", { daysUntil: 8 }),
  ]);
  const tracker = {
    active: { current: null as { requestKey: string } | null },
    consumed: { current: null as string | null },
  };
  const callbacks = new Map<string, (contentY: number) => void>();
  const failures = new Map<string, () => void>();
  const effects = {
    measured: [] as string[],
    scrolled: [] as number[],
    navigated: 0,
    edited: 0,
    writes: 0,
  };
  const interactionEffects = {
    measureItemInScrollContent: (
      itemId: string,
      onMeasured: (contentY: number) => void,
      onMeasureFailed?: () => void,
    ) => {
      effects.measured.push(itemId);
      callbacks.set(itemId, onMeasured);
      if (onMeasureFailed) failures.set(itemId, onMeasureFailed);
      return true;
    },
    scrollTo: (y: number) => effects.scrolled.push(y),
    navigate: () => {
      effects.navigated += 1;
    },
    editRoutine: () => {
      effects.edited += 1;
    },
    writeCare: () => {
      effects.writes += 1;
    },
  };
  const firstRequest = {
    itemId: "record_known",
    routeTopPadding: 72,
    sections,
    summary: "2 reminders - 0 urgent, 2 watch.",
    alertCount: 0,
    watchCount: 2,
    totalCount: 2,
  } satisfies PlanReminderFocusRequest;

  assert.equal(
    coordinatePlanReminderFocus(firstRequest, tracker, interactionEffects),
    true,
  );
  assert.equal(
    coordinatePlanReminderFocus(
      { ...firstRequest, sections: structuredClone(sections) },
      tracker,
      interactionEffects,
    ),
    false,
    "an active request must not start a duplicate measurement",
  );

  const secondRequest = { ...firstRequest, itemId: "record_other" };
  assert.equal(
    coordinatePlanReminderFocus(secondRequest, tracker, interactionEffects),
    true,
  );
  failures.get("record_known")?.();
  callbacks.get("record_known")?.(712);
  assert.deepEqual(
    effects.scrolled,
    [],
    "a superseded measurement callback must not scroll",
  );
  const secondRequestCallback = callbacks.get("record_other");
  secondRequestCallback?.(812);
  assert.deepEqual(effects.scrolled, [740]);
  secondRequestCallback?.(812);
  assert.deepEqual(
    effects.scrolled,
    [740],
    "one successful measurement callback may consume and scroll only once",
  );
  assert.equal(
    coordinatePlanReminderFocus(secondRequest, tracker, interactionEffects),
    false,
  );
  assert.deepEqual(effects.measured, ["record_known", "record_other"]);

  const changedSections = sections.map((section) => ({
    ...section,
    items: section.items.map((item) =>
      item.id === "record_other"
        ? { ...item, detail: "A meaningful content revision" }
        : item,
    ),
  }));
  assert.equal(
    coordinatePlanReminderFocus(
      { ...secondRequest, sections: changedSections },
      tracker,
      interactionEffects,
    ),
    true,
  );
  callbacks.get("record_other")?.(900);
  assert.deepEqual(effects.scrolled, [740, 828]);

  assert.equal(
    coordinatePlanReminderFocus(
      { ...secondRequest, routeTopPadding: 96, sections: changedSections },
      tracker,
      interactionEffects,
    ),
    true,
  );
  callbacks.get("record_other")?.(900);
  assert.deepEqual(effects.scrolled, [740, 828, 804]);

  coordinatePlanReminderFocus(undefined, tracker, interactionEffects);
  assert.deepEqual(tracker, {
    active: { current: null },
    consumed: { current: null },
  });
  assert.equal(
    coordinatePlanReminderFocus(firstRequest, tracker, interactionEffects),
    true,
  );
  coordinatePlanReminderFocus(undefined, tracker, interactionEffects);
  callbacks.get("record_known")?.(712);
  assert.deepEqual(
    effects.scrolled,
    [740, 828, 804],
    "clearing focus must invalidate an already-started measurement callback",
  );
  assert.equal(
    coordinatePlanReminderFocus(firstRequest, tracker, interactionEffects),
    true,
    "clearing an absent focus must allow the same validated id to focus again later",
  );
  const failedAttemptCallback = callbacks.get("record_known");
  failures.get("record_known")?.();
  assert.equal(tracker.active.current, null);
  assert.equal(
    coordinatePlanReminderFocus(firstRequest, tracker, interactionEffects),
    true,
    "an asynchronous measurement failure must leave the request retryable",
  );
  failedAttemptCallback?.(712);
  assert.deepEqual(
    effects.scrolled,
    [740, 828, 804],
    "a late success callback from the failed same-key attempt must stay stale",
  );
  callbacks.get("record_known")?.(712);
  assert.deepEqual(effects.scrolled, [740, 828, 804, 640]);

  const retryTracker = {
    active: { current: null as { requestKey: string } | null },
    consumed: { current: null as string | null },
  };
  let attempts = 0;
  const retryEffects = {
    ...interactionEffects,
    measureItemInScrollContent: () => {
      attempts += 1;
      return false;
    },
  };
  assert.equal(
    coordinatePlanReminderFocus(firstRequest, retryTracker, retryEffects),
    false,
  );
  assert.equal(
    coordinatePlanReminderFocus(firstRequest, retryTracker, retryEffects),
    false,
  );
  assert.equal(
    attempts,
    2,
    "a measurement that did not start must remain retryable",
  );
  assert.equal(retryTracker.active.current, null);
  assert.equal(retryTracker.consumed.current, null);
  assert.deepEqual(
    {
      navigated: effects.navigated,
      edited: effects.edited,
      writes: effects.writes,
    },
    { navigated: 0, edited: 0, writes: 0 },
  );
});

test("focus lifecycle performs false-false-success retries without a rerender and then stays terminal", () => {
  const request = {
    itemId: "record_known",
    routeTopPadding: 72,
    sections: buildPlanReminderSections([
      reminder("record_known", { daysUntil: 4 }),
    ]),
    summary: "1 reminder - 0 urgent, 0 watch.",
    alertCount: 0,
    watchCount: 0,
    totalCount: 1,
  } satisfies PlanReminderFocusRequest;
  const tracker = {
    active: { current: null as { requestKey: string } | null },
    consumed: { current: null as string | null },
  };
  const frames = frameScheduler();
  const measurementResults = [false, false, true];
  const successes: Array<(contentY: number) => void> = [];
  const failures: Array<() => void> = [];
  const effects = {
    attempts: 0,
    scrolled: [] as number[],
    navigated: 0,
    edited: 0,
    writes: 0,
  };

  const lifecycle = createPlanReminderFocusLifecycle(frames.scheduler);
  const focusEffects = {
    measureItemInScrollContent: (_itemId, onMeasured, onMeasureFailed) => {
      effects.attempts += 1;
      successes.push(onMeasured);
      failures.push(onMeasureFailed ?? (() => undefined));
      return measurementResults.shift() ?? true;
    },
    scrollTo: (y) => effects.scrolled.push(y),
    navigate: () => {
      effects.navigated += 1;
    },
    editRoutine: () => {
      effects.edited += 1;
    },
    writeCare: () => {
      effects.writes += 1;
    },
  };
  lifecycle.update({ request, tracker, effects: focusEffects });

  assert.equal(effects.attempts, 1);
  assert.equal(frames.pendingCount, 1);
  assert.equal(
    frames.runNext(),
    true,
    "the scheduler itself must perform retry two",
  );
  assert.equal(effects.attempts, 2);
  assert.equal(frames.pendingCount, 1);
  assert.equal(
    frames.runNext(),
    true,
    "the scheduler itself must perform retry three",
  );
  assert.equal(effects.attempts, 3);
  assert.equal(frames.pendingCount, 0);
  successes[2]?.(712);
  successes[2]?.(712);
  failures[2]?.();
  assert.deepEqual(effects.scrolled, [640]);
  assert.equal(frames.pendingCount, 0);
  assert.equal(frames.runAll(), 0);
  lifecycle.update({
    request: { ...request, sections: structuredClone(request.sections) },
    tracker,
    effects: focusEffects,
  });
  assert.equal(
    effects.attempts,
    3,
    "the consumed semantic key must remain terminal",
  );
  assert.deepEqual(
    {
      navigated: effects.navigated,
      edited: effects.edited,
      writes: effects.writes,
    },
    { navigated: 0, edited: 0, writes: 0 },
  );

  lifecycle.dispose();

  const preconsumedFrames = frameScheduler();
  const preconsumedTracker = {
    active: { current: null as { requestKey: string } | null },
    consumed: {
      current: buildPlanReminderFocusRequestKey(request) as string | null,
    },
  };
  let preconsumedMeasures = 0;
  const preconsumedLifecycle = createPlanReminderFocusLifecycle(
    preconsumedFrames.scheduler,
  );
  preconsumedLifecycle.update({
    request,
    tracker: preconsumedTracker,
    effects: {
      ...focusEffects,
      measureItemInScrollContent: () => {
        preconsumedMeasures += 1;
        return false;
      },
    },
  });
  assert.equal(preconsumedMeasures, 0);
  assert.equal(
    preconsumedFrames.pendingCount,
    0,
    "a fresh lifecycle must treat the tracker's already-consumed key as terminal",
  );
  preconsumedLifecycle.update({
    request: { ...request, sections: structuredClone(request.sections) },
    tracker: preconsumedTracker,
    effects: {
      ...focusEffects,
      measureItemInScrollContent: () => {
        preconsumedMeasures += 1;
        return false;
      },
    },
  });
  assert.equal(preconsumedMeasures, 0);
  assert.equal(preconsumedFrames.pendingCount, 0);
  preconsumedLifecycle.update({
    request: { ...request, routeTopPadding: 96 },
    tracker: preconsumedTracker,
    effects: {
      ...focusEffects,
      measureItemInScrollContent: () => {
        preconsumedMeasures += 1;
        return false;
      },
    },
  });
  assert.equal(
    preconsumedMeasures,
    1,
    "a changed semantic key must start a fresh attempt",
  );
  assert.equal(preconsumedFrames.pendingCount, 1);
  preconsumedLifecycle.dispose();
});

test("focus lifecycle exhausts at three attempts until the key changes or focus becomes absent", () => {
  assert.equal(PLAN_REMINDER_FOCUS_MAX_ATTEMPTS, 3);
  const sections = buildPlanReminderSections([
    reminder("record_known", { daysUntil: 4 }),
    reminder("record_other", { daysUntil: 8 }),
  ]);
  const baseRequest = {
    itemId: "record_known",
    routeTopPadding: 72,
    sections,
    summary: "2 reminders - 0 urgent, 0 watch.",
    alertCount: 0,
    watchCount: 0,
    totalCount: 2,
  } satisfies PlanReminderFocusRequest;
  const tracker = {
    active: { current: null as { requestKey: string } | null },
    consumed: { current: null as string | null },
  };
  const frames = frameScheduler();
  let cappedAttempts = 0;
  const lifecycle = createPlanReminderFocusLifecycle(frames.scheduler);
  const focusEffects = {
    measureItemInScrollContent: () => {
      cappedAttempts += 1;
      return false;
    },
    scrollTo: () => undefined,
    navigate: () => undefined,
    editRoutine: () => undefined,
    writeCare: () => undefined,
  };
  lifecycle.update({ request: baseRequest, tracker, effects: focusEffects });

  assert.equal(frames.runAll(), 2);
  assert.equal(cappedAttempts, 3);
  assert.equal(frames.pendingCount, 0);
  lifecycle.update({
    request: {
      ...baseRequest,
      sections: structuredClone(baseRequest.sections),
    },
    tracker,
    effects: focusEffects,
  });
  assert.equal(
    cappedAttempts,
    3,
    "incidental same-key updates must not restart an exhausted budget",
  );

  lifecycle.update({
    request: { ...baseRequest, itemId: "record_other" },
    tracker,
    effects: focusEffects,
  });
  assert.equal(
    cappedAttempts,
    4,
    "a changed semantic key must restore a fresh attempt budget",
  );
  assert.equal(frames.pendingCount, 1);
  lifecycle.update({ request: undefined, tracker, effects: focusEffects });
  assert.equal(frames.pendingCount, 0);
  lifecycle.update({ request: baseRequest, tracker, effects: focusEffects });
  assert.equal(
    cappedAttempts,
    5,
    "an absent focus must reset the same key for a later visit",
  );
  lifecycle.dispose();
});

test("focus lifecycle cancels stale async work on key change, absence, and unmount", () => {
  const sections = buildPlanReminderSections([
    reminder("record_known", { daysUntil: 4 }),
    reminder("record_other", { daysUntil: 8 }),
  ]);
  const request = {
    itemId: "record_known",
    routeTopPadding: 72,
    sections,
    summary: "2 reminders - 0 urgent, 0 watch.",
    alertCount: 0,
    watchCount: 0,
    totalCount: 2,
  } satisfies PlanReminderFocusRequest;
  const tracker = {
    active: { current: null as { requestKey: string } | null },
    consumed: { current: null as string | null },
  };
  const frames = frameScheduler();
  const successes: Array<(contentY: number) => void> = [];
  const failures: Array<() => void> = [];
  const effects = {
    attempts: [] as string[],
    scrolls: 0,
    navigated: 0,
    edited: 0,
    writes: 0,
  };
  const focusEffects = {
    measureItemInScrollContent: (
      itemId: string,
      onMeasured: (y: number) => void,
      onFailed?: () => void,
    ) => {
      effects.attempts.push(itemId);
      successes.push(onMeasured);
      failures.push(onFailed ?? (() => undefined));
      return true;
    },
    scrollTo: () => {
      effects.scrolls += 1;
    },
    navigate: () => {
      effects.navigated += 1;
    },
    editRoutine: () => {
      effects.edited += 1;
    },
    writeCare: () => {
      effects.writes += 1;
    },
  };
  const lifecycle = createPlanReminderFocusLifecycle(frames.scheduler);

  lifecycle.update({ request, tracker, effects: focusEffects });
  failures[0]?.();
  assert.equal(frames.pendingCount, 1);
  const oldRetry = frames.scheduledCallbacks[0];
  lifecycle.update({
    request: { ...request, itemId: "record_other" },
    tracker,
    effects: focusEffects,
  });
  assert.equal(frames.pendingCount, 0);
  oldRetry?.();
  successes[0]?.(712);
  assert.deepEqual(effects.attempts, ["record_known", "record_other"]);
  assert.equal(effects.scrolls, 0);

  failures[1]?.();
  const absentRetry = frames.scheduledCallbacks.at(-1);
  assert.equal(frames.pendingCount, 1);
  lifecycle.update({ request: undefined, tracker, effects: focusEffects });
  absentRetry?.();
  successes[1]?.(812);
  assert.equal(frames.pendingCount, 0);
  assert.equal(effects.scrolls, 0);

  lifecycle.update({ request, tracker, effects: focusEffects });
  failures[2]?.();
  const unmountRetry = frames.scheduledCallbacks.at(-1);
  lifecycle.dispose();
  unmountRetry?.();
  successes[2]?.(712);
  assert.equal(effects.scrolls, 0);
  assert.deepEqual(
    {
      navigated: effects.navigated,
      edited: effects.edited,
      writes: effects.writes,
    },
    { navigated: 0, edited: 0, writes: 0 },
  );
});

test("focus lifecycle retries an asynchronous measurement failure without an external update", () => {
  const request = {
    itemId: "record_known",
    routeTopPadding: 72,
    sections: buildPlanReminderSections([
      reminder("record_known", { daysUntil: 4 }),
    ]),
    summary: "1 reminder - 0 urgent, 0 watch.",
    alertCount: 0,
    watchCount: 0,
    totalCount: 1,
  } satisfies PlanReminderFocusRequest;
  const tracker = {
    active: { current: null as { requestKey: string } | null },
    consumed: { current: null as string | null },
  };
  const frames = frameScheduler();
  const successes: Array<(contentY: number) => void> = [];
  const failures: Array<() => void> = [];
  let attempts = 0;
  const scrolls: number[] = [];
  const lifecycle = createPlanReminderFocusLifecycle(frames.scheduler);

  lifecycle.update({
    request,
    tracker,
    effects: {
      measureItemInScrollContent: (_itemId, onMeasured, onFailed) => {
        attempts += 1;
        successes.push(onMeasured);
        failures.push(onFailed ?? (() => undefined));
        return true;
      },
      scrollTo: (y) => scrolls.push(y),
      navigate: () => undefined,
      editRoutine: () => undefined,
      writeCare: () => undefined,
    },
  });
  failures[0]?.();
  assert.equal(frames.pendingCount, 1);
  assert.equal(frames.runNext(), true);
  assert.equal(
    attempts,
    2,
    "the async failure must retry without another lifecycle update",
  );
  successes[1]?.(712);
  assert.deepEqual(scrolls, [640]);
  assert.equal(frames.pendingCount, 0);
  lifecycle.dispose();
});

test("focus lifecycle supports a scheduler that invokes retry callbacks synchronously", () => {
  const request = {
    itemId: "record_known",
    routeTopPadding: 72,
    sections: buildPlanReminderSections([
      reminder("record_known", { daysUntil: 4 }),
    ]),
    summary: "1 reminder - 0 urgent, 0 watch.",
    alertCount: 0,
    watchCount: 0,
    totalCount: 1,
  } satisfies PlanReminderFocusRequest;
  const tracker = {
    active: { current: null as { requestKey: string } | null },
    consumed: { current: null as string | null },
  };
  const results = [false, false, true];
  const successes: Array<(contentY: number) => void> = [];
  let attempts = 0;
  let scheduled = 0;
  const scrolls: number[] = [];
  const lifecycle = createPlanReminderFocusLifecycle({
    request: (callback) => {
      scheduled += 1;
      callback();
      return scheduled;
    },
    cancel: () => undefined,
  });

  lifecycle.update({
    request,
    tracker,
    effects: {
      measureItemInScrollContent: (_itemId, onMeasured) => {
        attempts += 1;
        successes.push(onMeasured);
        return results.shift() ?? true;
      },
      scrollTo: (y) => scrolls.push(y),
      navigate: () => undefined,
      editRoutine: () => undefined,
      writeCare: () => undefined,
    },
  });
  assert.equal(attempts, 3);
  assert.equal(scheduled, 2);
  successes[2]?.(712);
  assert.deepEqual(scrolls, [640]);
  lifecycle.dispose();
});

test("focus lifecycle surfaces scheduler and measurement exceptions", () => {
  const request = {
    itemId: "record_known",
    routeTopPadding: 72,
    sections: buildPlanReminderSections([
      reminder("record_known", { daysUntil: 4 }),
    ]),
    summary: "1 reminder - 0 urgent, 0 watch.",
    alertCount: 0,
    watchCount: 0,
    totalCount: 1,
  } satisfies PlanReminderFocusRequest;
  const tracker = {
    active: { current: null as { requestKey: string } | null },
    consumed: { current: null as string | null },
  };
  const inertEffects = {
    scrollTo: () => undefined,
    navigate: () => undefined,
    editRoutine: () => undefined,
    writeCare: () => undefined,
  };
  const measureFrames = frameScheduler();
  const measureThrowing = createPlanReminderFocusLifecycle(
    measureFrames.scheduler,
  );
  let measureAttempts = 0;
  const measureEffects = {
    ...inertEffects,
    measureItemInScrollContent: () => {
      measureAttempts += 1;
      if (measureAttempts === 1) throw new Error("measure exploded");
      return false;
    },
  };
  assert.throws(
    () =>
      measureThrowing.update({
        request,
        tracker,
        effects: measureEffects,
      }),
    /measure exploded/,
  );
  measureThrowing.update({ request, tracker, effects: measureEffects });
  assert.equal(
    measureAttempts,
    2,
    "a measurement throw must invalidate the same-key lifecycle",
  );
  measureThrowing.dispose();

  const scrollCallbacks: Array<(contentY: number) => void> = [];
  let scrollAttempts = 0;
  const scrollThrowing = createPlanReminderFocusLifecycle(
    frameScheduler().scheduler,
  );
  const scrollEffects = {
    ...inertEffects,
    measureItemInScrollContent: (
      _itemId: string,
      onMeasured: (contentY: number) => void,
    ) => {
      scrollCallbacks.push(onMeasured);
      return true;
    },
    scrollTo: () => {
      scrollAttempts += 1;
      if (scrollAttempts === 1) throw new Error("scroll exploded");
    },
  };
  scrollThrowing.update({ request, tracker, effects: scrollEffects });
  assert.throws(() => scrollCallbacks[0]?.(712), /scroll exploded/);
  scrollThrowing.update({ request, tracker, effects: scrollEffects });
  scrollCallbacks[1]?.(712);
  assert.equal(
    scrollAttempts,
    2,
    "a scroll throw must invalidate the same-key lifecycle",
  );
  scrollThrowing.dispose();

  let schedulerAttempts = 0;
  const schedulerThrowing = createPlanReminderFocusLifecycle({
    request: () => {
      schedulerAttempts += 1;
      throw new Error("scheduler exploded");
    },
    cancel: () => undefined,
  });
  const schedulerEffects = {
    ...inertEffects,
    measureItemInScrollContent: () => false,
  };
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    assert.throws(
      () =>
        schedulerThrowing.update({
          request,
          tracker,
          effects: schedulerEffects,
        }),
      /scheduler exploded/,
    );
    assert.equal(
      schedulerAttempts,
      attempt,
      "a scheduler throw must invalidate the same-key lifecycle",
    );
  }
});

test("executes reminder row actions at their canonical navigation and editor boundaries", () => {
  const navigations: Array<{
    pathname: string;
    params: Readonly<Record<string, string>>;
  }> = [];
  const edits: string[] = [];
  let writes = 0;
  const effects = {
    measureItemInScrollContent: () => false,
    scrollTo: () => undefined,
    navigate: (pathname: string, params: Readonly<Record<string, string>>) =>
      navigations.push({ pathname, params }),
    editRoutine: (routineId: string) => edits.push(routineId),
    writeCare: () => {
      writes += 1;
    },
  };

  runPlanReminderInteraction(
    { kind: "activate", item: reminder("med", { kind: "medication" }) },
    effects,
  );
  runPlanReminderInteraction(
    { kind: "activate", item: reminder("groom", { kind: "grooming" }) },
    effects,
  );
  runPlanReminderInteraction(
    {
      kind: "activate",
      item: reminder("routine", { kind: "routine", sourceId: "dinner" }),
    },
    effects,
  );

  assert.deepEqual(navigations, [
    { pathname: "/health", params: { section: "medications" } },
    { pathname: "/log", params: { type: "grooming", detail: "1" } },
  ]);
  assert.deepEqual(edits, ["dinner"]);
  assert.equal(writes, 0);
});
