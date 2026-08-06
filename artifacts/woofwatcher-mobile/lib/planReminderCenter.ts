import type { CareReminderItem, CareReminderUrgency } from "@workspace/care-domain";

import {
  resolveCanonicalDestination,
  type CanonicalDestination,
} from "./navigationOwnership.ts";

export const PLAN_REMINDER_LIMIT = 50;

export type PlanReminderSectionKey = "today" | "tomorrow" | "later" | "no-date";

export interface PlanReminderSection {
  key: PlanReminderSectionKey;
  label: "Today" | "Tomorrow" | "Later" | "No date";
  items: CareReminderItem[];
}

export type PlanReminderAction =
  | { kind: "edit-routine"; routineId: string }
  | { kind: "stay-plans" }
  | {
      kind: "navigate";
      pathname: "/health" | "/log";
      params: Readonly<Record<string, string>>;
    };

export type PlanReminderInteraction =
  | {
      kind: "focus";
      itemId: string;
      routeTopPadding: number;
    }
  | {
      kind: "activate";
      item: CareReminderItem;
    };

export interface PlanReminderInteractionEffects {
  measureItemInScrollContent: (
    itemId: string,
    onMeasured: (contentY: number) => void,
  ) => boolean;
  scrollTo: (y: number) => void;
  navigate: (
    pathname: "/health" | "/log",
    params: Readonly<Record<string, string>>,
  ) => void;
  editRoutine: (routineId: string) => void;
  // Reminder rows never write directly. Keeping the write boundary explicit
  // makes focus and activation tests fail if a future handler crosses it.
  writeCare: () => void;
}

const SECTION_ORDER: readonly Omit<PlanReminderSection, "items">[] = [
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "later", label: "Later" },
  { key: "no-date", label: "No date" },
];

const URGENCY_RANK: Readonly<Record<CareReminderUrgency, number>> = {
  alert: 0,
  watch: 1,
  info: 2,
};

function sectionKey(item: CareReminderItem): PlanReminderSectionKey {
  if (item.daysUntil !== undefined && Number.isFinite(item.daysUntil)) {
    if (item.daysUntil <= 0) return "today";
    if (item.daysUntil === 1) return "tomorrow";
    return "later";
  }
  if (item.kind === "routine" || item.kind === "medication") return "today";
  return "no-date";
}

function clockMinutes(time: string | undefined): number {
  if (!time) return Number.MAX_SAFE_INTEGER;
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time.trim());
  if (!match) return Number.MAX_SAFE_INTEGER;
  let hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
    return Number.MAX_SAFE_INTEGER;
  }
  if (match[3].toUpperCase() === "AM" && hour === 12) hour = 0;
  if (match[3].toUpperCase() === "PM" && hour !== 12) hour += 12;
  return hour * 60 + minute;
}

export function buildPlanReminderSections(
  items: readonly CareReminderItem[],
): PlanReminderSection[] {
  const visible = items.slice(0, PLAN_REMINDER_LIMIT);
  return SECTION_ORDER.map(({ key, label }) => ({
    key,
    label,
    items: visible
      .filter((item) => sectionKey(item) === key)
      .sort(
        (a, b) =>
          URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] ||
          clockMinutes(a.time) - clockMinutes(b.time) ||
          (a.daysUntil ?? Number.MAX_SAFE_INTEGER) -
            (b.daysUntil ?? Number.MAX_SAFE_INTEGER) ||
          a.label.localeCompare(b.label),
      ),
  })).filter((section) => section.items.length > 0);
}

export function reminderWhenLabel(item: CareReminderItem): string {
  if (item.time) return item.time;
  if (item.daysUntil !== undefined && Number.isFinite(item.daysUntil)) {
    if (item.daysUntil < 0) return `${Math.abs(item.daysUntil)}d overdue`;
    if (item.daysUntil === 0) return "Due today";
    if (item.daysUntil === 1) return "Due tomorrow";
    return `In ${item.daysUntil} days`;
  }
  if (item.kind === "routine" || item.kind === "medication") {
    return item.urgency === "alert" ? "Overdue" : "Due now";
  }
  return "No date";
}

export function resolvePlanReminderFocus(
  params: Readonly<Record<string, unknown>> | undefined,
  items: readonly CareReminderItem[],
): string | undefined {
  const destination = resolvePlanReminderDestination(params);
  const item = destination.params?.item;
  return item && items.some((candidate) => candidate.id === item) ? item : undefined;
}

export function resolvePlanReminderDestination(
  params: Readonly<Record<string, unknown>> | undefined,
): CanonicalDestination {
  const ownItem = params && Object.prototype.hasOwnProperty.call(params, "item")
    ? params.item
    : undefined;
  return resolveCanonicalDestination({
    pathname: "/reminders",
    params: typeof ownItem === "string" ? { item: ownItem } : undefined,
  });
}

export function getPlanReminderAction(item: CareReminderItem): PlanReminderAction {
  if (item.kind === "routine") {
    return item.sourceId
      ? { kind: "edit-routine", routineId: item.sourceId }
      : { kind: "stay-plans" };
  }
  if (item.kind === "medication") {
    return {
      kind: "navigate",
      pathname: "/health",
      params: { section: "medications" },
    };
  }
  if (item.kind === "record") {
    return {
      kind: "navigate",
      pathname: "/health",
      params: { section: "records" },
    };
  }
  return {
    kind: "navigate",
    pathname: "/log",
    params: { type: "grooming", detail: "1" },
  };
}

export function getReminderFocusScrollY(
  rowLayoutY: number,
  routeTopPadding: number,
): number {
  if (!Number.isFinite(rowLayoutY) || !Number.isFinite(routeTopPadding)) return 0;
  return Math.max(0, rowLayoutY - Math.max(0, routeTopPadding));
}

export function runPlanReminderInteraction(
  interaction: PlanReminderInteraction,
  effects: PlanReminderInteractionEffects,
): boolean {
  if (interaction.kind === "focus") {
    return effects.measureItemInScrollContent(
      interaction.itemId,
      (rowContentY) => {
        effects.scrollTo(
          getReminderFocusScrollY(rowContentY, interaction.routeTopPadding),
        );
      },
    );
  }

  const action = getPlanReminderAction(interaction.item);
  if (action.kind === "navigate") {
    effects.navigate(action.pathname, action.params);
    return true;
  }
  if (action.kind === "edit-routine") {
    effects.editRoutine(action.routineId);
    return true;
  }
  return false;
}
