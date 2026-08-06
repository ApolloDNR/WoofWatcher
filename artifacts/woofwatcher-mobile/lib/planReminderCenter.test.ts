import assert from "node:assert/strict";
import { test } from "node:test";

import type { CareReminderItem } from "@workspace/care-domain";

import {
  buildPlanReminderSections,
  getPlanReminderAction,
  getReminderFocusScrollY,
  PLAN_REMINDER_LIMIT,
  reminderWhenLabel,
  resolvePlanReminderDestination,
  resolvePlanReminderFocus,
  runPlanReminderInteraction,
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

  assert.deepEqual(sections.map((section) => section.label), [
    "Today",
    "Tomorrow",
    "Later",
    "No date",
  ]);
  assert.equal(
    sections.reduce((count, section) => count + section.items.length, 0),
    PLAN_REMINDER_LIMIT,
  );
  assert.equal(reminderWhenLabel(items[3]), "No date");
});

test("focuses only a validated known row and never turns focus into an action", () => {
  const items = [reminder("record_known")];
  assert.equal(resolvePlanReminderFocus({ item: "record_known" }, items), "record_known");
  assert.equal(resolvePlanReminderFocus({ item: ["record_known", "ignored"] }, items), undefined);
  assert.deepEqual(
    resolvePlanReminderDestination({ item: ["record_known", "ignored"] }),
    { parent: "plans", pathname: "/calendar", replace: true },
  );
  assert.equal(resolvePlanReminderFocus({ item: "missing" }, items), undefined);
  assert.equal(resolvePlanReminderFocus({ item: "bad value" }, items), undefined);

  const inherited = Object.create({ item: "record_known" }) as Record<string, unknown>;
  assert.equal(resolvePlanReminderFocus(inherited, items), undefined);
  assert.deepEqual(getPlanReminderAction(items[0]), {
    kind: "navigate",
    pathname: "/health",
    params: { section: "records" },
  });
});

test("routes canonical reminder actions by owner", () => {
  assert.deepEqual(
    getPlanReminderAction(reminder("routine", { kind: "routine", sourceId: "dinner" })),
    { kind: "edit-routine", routineId: "dinner" },
  );
  assert.deepEqual(getPlanReminderAction(reminder("med", { kind: "medication" })), {
    kind: "navigate",
    pathname: "/health",
    params: { section: "medications" },
  });
  assert.deepEqual(getPlanReminderAction(reminder("record")), {
    kind: "navigate",
    pathname: "/health",
    params: { section: "records" },
  });
  assert.deepEqual(getPlanReminderAction(reminder("groom", { kind: "grooming" })), {
    kind: "navigate",
    pathname: "/log",
    params: { type: "grooming", detail: "1" },
  });
});

test("subtracts route top padding exactly once from focused-row scroll geometry", () => {
  assert.equal(getReminderFocusScrollY(640, 72), 568);
  assert.equal(getReminderFocusScrollY(40, 72), 0);
});

test("measures a nested row in ScrollView content coordinates and focus causes no care action", () => {
  const effects = { measured: [] as string[], scrolled: [] as number[], navigated: 0, edited: 0, writes: 0 };
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
      navigate: () => { effects.navigated += 1; },
      editRoutine: () => { effects.edited += 1; },
      writeCare: () => { effects.writes += 1; },
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

test("executes reminder row actions at their canonical navigation and editor boundaries", () => {
  const navigations: Array<{ pathname: string; params: Readonly<Record<string, string>> }> = [];
  const edits: string[] = [];
  let writes = 0;
  const effects = {
    measureItemInScrollContent: () => false,
    scrollTo: () => undefined,
    navigate: (pathname: string, params: Readonly<Record<string, string>>) => navigations.push({ pathname, params }),
    editRoutine: (routineId: string) => edits.push(routineId),
    writeCare: () => { writes += 1; },
  };

  runPlanReminderInteraction({ kind: "activate", item: reminder("med", { kind: "medication" }) }, effects);
  runPlanReminderInteraction({ kind: "activate", item: reminder("groom", { kind: "grooming" }) }, effects);
  runPlanReminderInteraction({ kind: "activate", item: reminder("routine", { kind: "routine", sourceId: "dinner" }) }, effects);

  assert.deepEqual(navigations, [
    { pathname: "/health", params: { section: "medications" } },
    { pathname: "/log", params: { type: "grooming", detail: "1" } },
  ]);
  assert.deepEqual(edits, ["dinner"]);
  assert.equal(writes, 0);
});
