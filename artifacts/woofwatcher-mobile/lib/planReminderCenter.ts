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
    onMeasureFailed?: () => void,
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

export interface PlanReminderFocusRequest {
  itemId: string;
  routeTopPadding: number;
  sections: readonly PlanReminderSection[];
  summary: string;
  alertCount: number;
  watchCount: number;
  totalCount: number;
}

export interface PlanReminderFocusAttempt {
  requestKey: string;
}

export interface PlanReminderFocusTracker {
  active: { current: PlanReminderFocusAttempt | null };
  consumed: { current: string | null };
}

export interface PlanReminderFocusFrameScheduler {
  request: (callback: () => void) => unknown;
  cancel: (handle: unknown) => void;
}

export interface PlanReminderFocusLifecycle {
  update: (input: {
    request: PlanReminderFocusRequest | undefined;
    tracker: PlanReminderFocusTracker;
    effects: PlanReminderInteractionEffects;
  }) => void;
  dispose: () => void;
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

export function buildPlanReminderFocusRequestKey(
  request: PlanReminderFocusRequest,
): string {
  const sections = request.sections.map((section) => ({
    key: section.key,
    label: section.label,
    count: section.items.length,
    rows: section.items.map((item) => ({
      id: item.id,
      kind: item.kind,
      when: reminderWhenLabel(item),
      label: item.label,
      detail: item.detail,
      action: item.action,
      urgency: item.urgency,
      owner: item.owner,
      time: item.time ?? null,
      sourceId: item.sourceId ?? null,
      daysUntil: item.daysUntil ?? null,
    })),
  }));

  return JSON.stringify({
    itemId: request.itemId,
    routeTopPadding: Number.isFinite(request.routeTopPadding)
      ? Math.max(0, request.routeTopPadding)
      : 0,
    sectionCount: sections.length,
    rowCount: sections.reduce((count, section) => count + section.count, 0),
    summary: request.summary,
    alertCount: request.alertCount,
    watchCount: request.watchCount,
    totalCount: request.totalCount,
    sections,
  });
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

export function coordinatePlanReminderFocus(
  request: PlanReminderFocusRequest | undefined,
  tracker: PlanReminderFocusTracker,
  effects: PlanReminderInteractionEffects,
): boolean {
  if (!request) {
    tracker.active.current = null;
    tracker.consumed.current = null;
    return false;
  }

  const requestKey = buildPlanReminderFocusRequestKey(request);
  if (tracker.consumed.current === requestKey) {
    // Clearing the attempt invalidates any delayed callback without changing
    // the deterministic key that records the already-consumed request.
    tracker.active.current = null;
    return false;
  }
  if (tracker.active.current?.requestKey === requestKey) return false;

  const attempt: PlanReminderFocusAttempt = { requestKey };
  tracker.active.current = attempt;
  let measurementStarted: boolean;
  try {
    measurementStarted = runPlanReminderInteraction(
      {
        kind: "focus",
        itemId: request.itemId,
        routeTopPadding: request.routeTopPadding,
      },
      {
        ...effects,
        measureItemInScrollContent: (itemId, onMeasured) =>
          effects.measureItemInScrollContent(
            itemId,
            onMeasured,
            () => {
              if (tracker.active.current === attempt) {
                tracker.active.current = null;
              }
            },
          ),
        scrollTo: (scrollY) => {
          if (tracker.active.current !== attempt) return;
          try {
            effects.scrollTo(scrollY);
          } catch (error) {
            if (tracker.active.current === attempt) {
              tracker.active.current = null;
            }
            throw error;
          }
          if (tracker.active.current === attempt) {
            tracker.consumed.current = requestKey;
            tracker.active.current = null;
          }
        },
      },
    );
  } catch (error) {
    if (tracker.active.current === attempt) tracker.active.current = null;
    throw error;
  }

  if (
    !measurementStarted &&
    tracker.active.current === attempt &&
    tracker.consumed.current !== requestKey
  ) {
    tracker.active.current = null;
  }
  return measurementStarted;
}

export const PLAN_REMINDER_FOCUS_MAX_ATTEMPTS = 3;

interface PendingPlanReminderFocusFrame {
  handle?: unknown;
  handleReady: boolean;
}

interface PlanReminderFocusLifecycleState {
  requestKey: string;
  request: PlanReminderFocusRequest;
  tracker: PlanReminderFocusTracker;
  effects: PlanReminderInteractionEffects;
  attempts: number;
  attemptIdentity: object | null;
  pending: PendingPlanReminderFocusFrame | null;
  terminal: "active" | "consumed" | "exhausted";
}

/**
 * Owns the short render-to-layout retry window for a deep-linked reminder row.
 * A semantic request gets at most three measurement attempts. Incidental React
 * renders cannot restart a consumed or exhausted budget; a different request
 * key (or an intervening absent focus) creates a fresh lifecycle instead.
 */
export function createPlanReminderFocusLifecycle(
  scheduler: PlanReminderFocusFrameScheduler,
): PlanReminderFocusLifecycle {
  let current: PlanReminderFocusLifecycleState | null = null;

  const cancelPending = (state: PlanReminderFocusLifecycleState) => {
    const pending = state.pending;
    state.pending = null;
    if (pending?.handleReady) scheduler.cancel(pending.handle);
  };

  const invalidate = (state: PlanReminderFocusLifecycleState) => {
    cancelPending(state);
    state.attemptIdentity = null;
    coordinatePlanReminderFocus(undefined, state.tracker, state.effects);
  };

  const invalidateCurrent = (state: PlanReminderFocusLifecycleState) => {
    if (current !== state) return;
    invalidate(state);
    current = null;
  };

  const exhaust = (state: PlanReminderFocusLifecycleState) => {
    state.terminal = "exhausted";
    state.attemptIdentity = null;
    state.tracker.active.current = null;
  };

  const scheduleRetry = (state: PlanReminderFocusLifecycleState) => {
    if (current !== state || state.terminal !== "active" || state.pending) return;
    if (state.attempts >= PLAN_REMINDER_FOCUS_MAX_ATTEMPTS) {
      exhaust(state);
      return;
    }

    const pending: PendingPlanReminderFocusFrame = { handleReady: false };
    state.pending = pending;
    try {
      const handle = scheduler.request(() => {
        if (current !== state || state.pending !== pending || state.terminal !== "active") {
          return;
        }
        state.pending = null;
        runAttempt(state);
      });
      pending.handle = handle;
      pending.handleReady = true;
      if (state.pending !== pending) return;
    } catch (error) {
      if (state.pending === pending) state.pending = null;
      invalidateCurrent(state);
      throw error;
    }
  };

  const runAttempt = (state: PlanReminderFocusLifecycleState) => {
    if (current !== state || state.terminal !== "active") return;
    if (state.attempts >= PLAN_REMINDER_FOCUS_MAX_ATTEMPTS) {
      exhaust(state);
      return;
    }

    state.attempts += 1;
    const attemptIdentity = {};
    state.attemptIdentity = attemptIdentity;
    let measurementStarted: boolean;
    try {
      measurementStarted = coordinatePlanReminderFocus(
        state.request,
        state.tracker,
        {
          ...state.effects,
          measureItemInScrollContent: (itemId, onMeasured, onMeasureFailed) =>
            state.effects.measureItemInScrollContent(
              itemId,
              (contentY) => {
                if (
                  current !== state ||
                  state.terminal !== "active" ||
                  state.attemptIdentity !== attemptIdentity
                ) {
                  return;
                }
                try {
                  onMeasured(contentY);
                } catch (error) {
                  invalidateCurrent(state);
                  throw error;
                }
                if (state.tracker.consumed.current === state.requestKey) {
                  state.terminal = "consumed";
                  state.attemptIdentity = null;
                  cancelPending(state);
                }
              },
              () => {
                if (
                  current !== state ||
                  state.terminal !== "active" ||
                  state.attemptIdentity !== attemptIdentity
                ) {
                  return;
                }
                state.attemptIdentity = null;
                onMeasureFailed?.();
                scheduleRetry(state);
              },
            ),
        },
      );
    } catch (error) {
      if (state.attemptIdentity === attemptIdentity) state.attemptIdentity = null;
      invalidateCurrent(state);
      throw error;
    }

    if (
      current === state &&
      state.tracker.consumed.current === state.requestKey
    ) {
      state.terminal = "consumed";
      state.attemptIdentity = null;
      cancelPending(state);
      return;
    }
    if (current !== state || state.terminal !== "active") return;
    if (!measurementStarted && state.attemptIdentity === attemptIdentity) {
      state.attemptIdentity = null;
      scheduleRetry(state);
    }
  };

  return {
    update: ({ request, tracker, effects }) => {
      if (!request) {
        if (current) invalidate(current);
        else coordinatePlanReminderFocus(undefined, tracker, effects);
        current = null;
        return;
      }

      const requestKey = buildPlanReminderFocusRequestKey(request);
      if (current?.requestKey === requestKey) return;
      if (current) invalidate(current);

      const next: PlanReminderFocusLifecycleState = {
        requestKey,
        request,
        tracker,
        effects,
        attempts: 0,
        attemptIdentity: null,
        pending: null,
        terminal: "active",
      };
      current = next;
      runAttempt(next);
    },
    dispose: () => {
      if (current) invalidate(current);
      current = null;
    },
  };
}
