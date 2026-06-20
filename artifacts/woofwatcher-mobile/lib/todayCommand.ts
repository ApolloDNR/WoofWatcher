import {
  deriveCareDayStatus,
  deriveRoutineBoard,
  normalizeCareEventType,
  type CareEventType,
  type RoutineBoardItem,
} from "../../../lib/care-domain/src/index.ts";

export type TodayCommandUrgency = "normal" | "watch" | "alert";

export type TodayCommandRoute =
  | "/log"
  | "/calendar"
  | "/records"
  | "/woofguide"
  | "/more";

export type TodayCommandIcon =
  | "bowl"
  | "paw"
  | "drop"
  | "star"
  | "heart"
  | "bone"
  | "candy"
  | "bolt"
  | "sad"
  | "vomit"
  | "house"
  | "scale"
  | "pill";

export type TodayCommandActionKind =
  | "sync"
  | "health"
  | "log-meal"
  | "log-walk"
  | "log-potty"
  | "routine"
  | "handoff"
  | "review";

export interface TodayCommandAction {
  kind: TodayCommandActionKind;
  label: string;
  detail: string;
  route: TodayCommandRoute;
  urgency: TodayCommandUrgency;
  icon: TodayCommandIcon;
}

export interface TodayCommandEntry {
  id: string;
  type: string;
  title?: string;
  caregiver?: string;
  occurredAt: string;
  durationMinutes?: number | null;
  mood?: string | null;
  severity?: string | null;
  note?: string | null;
  details?: Record<string, unknown> | null;
  syncStatus?: "local" | "pending" | "synced" | "failed";
  syncError?: string;
}

export interface TodayCommandRoutine {
  id?: string;
  label: string;
  type: string;
  time: string;
  owner?: string;
  note?: string;
}

export interface TodayCommandCaregiver {
  name: string;
  role: string;
}

export interface TodayCommandState {
  profile?: {
    name?: string;
  };
  entries: TodayCommandEntry[];
  routines: TodayCommandRoutine[];
  caregivers?: TodayCommandCaregiver[];
}

export interface TodayCommandHealth {
  label: string;
  detail: string;
  urgency: TodayCommandUrgency;
}

export interface TodayCommandHandoff {
  label: string;
  detail: string;
  caregiver: string | null;
  route: TodayCommandRoute;
}

export interface TodayCommandSync {
  pending: number;
  failed: number;
  local: number;
  label: string;
}

export interface TodayCommandModel {
  primaryAction: TodayCommandAction;
  health: TodayCommandHealth;
  handoff: TodayCommandHandoff;
  sync: TodayCommandSync;
}

const TYPE_ICON: Record<CareEventType, TodayCommandIcon> = {
  meal: "bowl",
  treat: "bone",
  water: "drop",
  walk: "paw",
  potty: "drop",
  play: "candy",
  training: "star",
  mood: "heart",
  medication: "pill",
  weight: "scale",
  vomit: "vomit",
  symptom: "vomit",
  incident: "sad",
  grooming: "star",
  alone: "house",
  note: "star",
};

function isSameLocalDay(iso: string, now: number): boolean {
  const d = new Date(iso);
  const n = new Date(now);
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

function sortNewestFirst<T extends { occurredAt: string }>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
}

function routineDateMs(routine: TodayCommandRoutine, now: number): number {
  const [time, periodRaw] = routine.time.trim().split(/\s+/);
  const [hStr, mStr] = time.split(":");
  const period = periodRaw?.toUpperCase();
  let h = Number.parseInt(hStr, 10);
  if (!Number.isFinite(h)) h = 0;
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  const d = new Date(now);
  d.setHours(h, Number.parseInt(mStr || "0", 10) || 0, 0, 0);
  return d.getTime();
}

function getRelevantRoutineOfType(
  routines: readonly TodayCommandRoutine[],
  type: CareEventType,
  now: number,
): TodayCommandRoutine | null {
  const candidates = routines
    .filter((routine) => normalizeCareEventType(routine.type) === type)
    .map((routine) => ({ routine, ms: routineDateMs(routine, now) }));

  return (
    candidates
      .filter(({ ms }) => ms <= now)
      .sort((a, b) => b.ms - a.ms)[0]?.routine ??
    candidates
      .filter(({ ms }) => ms > now)
      .sort((a, b) => a.ms - b.ms)[0]?.routine ??
    null
  );
}

function routineActionDetail(routine: RoutineBoardItem): string {
  const owner = routine.owner ? `${routine.owner} is assigned.` : "No caregiver assigned yet.";
  if (routine.status === "overdue") return `${routine.label}: ${owner} It was due at ${routine.time}.`;
  if (routine.status === "due") return `${routine.label}: ${owner} It is due now.`;
  return routine.owner ? `${routine.label}: ${routine.owner} is on deck.` : `${routine.label}: open the day plan.`;
}

function nextOpenRoutine(items: readonly RoutineBoardItem[]): RoutineBoardItem | null {
  const open = items.filter((item) => item.status !== "done");
  return (
    open.find((item) => item.status === "overdue") ??
    open.find((item) => item.status === "due") ??
    open.find((item) => item.status === "upcoming") ??
    null
  );
}

function openRoutineOfType(
  items: readonly RoutineBoardItem[],
  type: CareEventType,
): RoutineBoardItem | null {
  const open = items.filter((item) => item.normalizedType === type && item.status !== "done");
  return nextOpenRoutine(open);
}

function getHealthUrgency(entries: readonly TodayCommandEntry[]): TodayCommandUrgency {
  const severities = entries.map((entry) => (entry.severity ?? "").toLowerCase());
  if (severities.some((severity) => severity === "alert" || severity === "urgent")) {
    return "alert";
  }
  if (entries.length > 0 || severities.some((severity) => severity === "watch")) {
    return "watch";
  }
  return "normal";
}

function plural(count: number, singular: string, multiple = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : multiple}`;
}

function describeLastEntry(entry: TodayCommandEntry | undefined, now: number): string {
  if (!entry) return "No handoff activity logged yet.";
  const normalized = normalizeCareEventType(entry.type, entry.details);
  const title = entry.title || normalized;
  const minutes = Math.max(
    0,
    Math.round((now - new Date(entry.occurredAt).getTime()) / 60000),
  );
  const when =
    minutes < 60
      ? `${minutes} min ago`
      : `${Math.round(minutes / 60)} hr ago`;
  const caregiver = entry.caregiver || "Someone";
  return `${caregiver} logged ${title} ${when}.`;
}

export function deriveTodayCommand(
  state: TodayCommandState,
  now: number = Date.now(),
): TodayCommandModel {
  const entries = state.entries ?? [];
  const routines = state.routines ?? [];
  const todays = entries.filter((entry) => isSameLocalDay(entry.occurredAt, now));
  const sortedEntries = sortNewestFirst(entries);
  const dayStatus = deriveCareDayStatus(entries, routines, now);
  const routineBoard = deriveRoutineBoard({
    routines,
    entries,
    caregivers: state.caregivers,
    now,
  });

  const sync = {
    pending: entries.filter((entry) => entry.syncStatus === "pending").length,
    failed: entries.filter((entry) => entry.syncStatus === "failed").length,
    local: entries.filter(
      (entry) =>
        entry.syncStatus === "local" ||
        (!entry.syncStatus && entry.id.startsWith("temp_")),
    ).length,
    label: "Synced",
  };
  sync.label =
    sync.failed > 0
      ? `${sync.failed} sync failed`
      : sync.local > 0
        ? `${sync.local} saved offline`
        : sync.pending > 0
          ? `${sync.pending} syncing`
          : "Synced";

  const vomitEntries = todays.filter(
    (entry) => normalizeCareEventType(entry.type, entry.details) === "vomit",
  );
  const healthUrgency = getHealthUrgency(vomitEntries);
  const health: TodayCommandHealth =
    vomitEntries.length > 0
      ? {
          label: "Health watch",
          detail: `${plural(vomitEntries.length, "vomit")} logged today. Check notes and watch for repeats.`,
          urgency: healthUrgency,
        }
      : {
          label: "Health steady",
          detail: "No health alerts logged today.",
          urgency: "normal",
        };

  const lastEntry = sortedEntries[0];
  const handoff: TodayCommandHandoff = {
    label: lastEntry ? "Latest handoff" : "Start handoff",
    detail: describeLastEntry(lastEntry, now),
    caregiver: lastEntry?.caregiver ?? null,
    route: lastEntry ? "/log" : "/more",
  };

  if (sync.failed > 0 || sync.local > 0) {
    return {
      primaryAction: {
        kind: "sync",
        label: "Retry care sync",
        detail:
          sync.failed > 0
            ? "A local care log failed to reach the shared household record."
            : "Offline logs are saved locally and need to sync.",
        route: "/log",
        urgency: "watch",
        icon: "bolt",
      },
      health,
      handoff,
      sync,
    };
  }

  if (health.urgency !== "normal" || dayStatus.healthAlert) {
    return {
      primaryAction: {
        kind: "health",
        label: health.urgency === "alert" ? "Review health alert" : "Review health watch",
        detail: health.detail,
        route: "/records",
        urgency: health.urgency,
        icon: "vomit",
      },
      health,
      handoff,
      sync,
    };
  }

  const hour = new Date(now).getHours();
  const mealRoutine = openRoutineOfType(routineBoard.items, "meal");
  const walkRoutine = openRoutineOfType(routineBoard.items, "walk");

  if ((mealRoutine || dayStatus.counts.meals.done < dayStatus.counts.meals.target) && hour >= 6) {
    const fallbackMealRoutine = getRelevantRoutineOfType(routines, "meal", now);
    return {
      primaryAction: {
        kind: "log-meal",
        label: mealRoutine
          ? `Log ${mealRoutine.label.toLowerCase()}`
          : fallbackMealRoutine
            ? `Log ${fallbackMealRoutine.label.toLowerCase()}`
            : "Log meal",
        detail: mealRoutine
          ? routineActionDetail(mealRoutine)
          : `${dayStatus.counts.meals.done}/${dayStatus.counts.meals.target} meals logged today.`,
        route: "/log",
        urgency: mealRoutine?.status === "overdue" ? "watch" : "normal",
        icon: "bowl",
      },
      health,
      handoff,
      sync,
    };
  }

  if ((walkRoutine || dayStatus.counts.walks.done < dayStatus.counts.walks.target) && hour >= 8) {
    const fallbackWalkRoutine = getRelevantRoutineOfType(routines, "walk", now);
    return {
      primaryAction: {
        kind: "log-walk",
        label: walkRoutine
          ? `Log ${walkRoutine.label.toLowerCase()}`
          : fallbackWalkRoutine
            ? `Log ${fallbackWalkRoutine.label.toLowerCase()}`
            : "Log walk",
        detail: walkRoutine
          ? routineActionDetail(walkRoutine)
          : `${dayStatus.counts.walks.done}/${dayStatus.counts.walks.target} walks logged today.`,
        route: "/log",
        urgency: walkRoutine?.status === "overdue" ? "watch" : "normal",
        icon: "paw",
      },
      health,
      handoff,
      sync,
    };
  }

  if (dayStatus.counts.potty.done < dayStatus.counts.potty.target && hour >= 10) {
    return {
      primaryAction: {
        kind: "log-potty",
        label: "Log potty break",
        detail: `${dayStatus.counts.potty.done}/${dayStatus.counts.potty.target} potty breaks logged today.`,
        route: "/log",
        urgency: "normal",
        icon: "drop",
      },
      health,
      handoff,
      sync,
    };
  }

  const nextRoutine = nextOpenRoutine(routineBoard.items);
  if (nextRoutine) {
    return {
      primaryAction: {
        kind: "routine",
        label:
          nextRoutine.status === "overdue"
            ? `${nextRoutine.label} overdue`
            : `${nextRoutine.label} at ${nextRoutine.time}`,
        detail: routineActionDetail(nextRoutine),
        route: "/calendar",
        urgency: nextRoutine.status === "overdue" ? "watch" : "normal",
        icon: TYPE_ICON[nextRoutine.normalizedType],
      },
      health,
      handoff,
      sync,
    };
  }

  return {
    primaryAction: {
      kind: lastEntry ? "handoff" : "review",
      label: lastEntry ? "Review handoff" : `Set up ${state.profile?.name ?? "your dog"}`,
      detail: lastEntry
        ? handoff.detail
        : "Add the care profile and routine so the day can run from one place.",
      route: lastEntry ? "/log" : "/more",
      urgency: "normal",
      icon: lastEntry ? TYPE_ICON[normalizeCareEventType(lastEntry.type, lastEntry.details)] : "house",
    },
    health,
    handoff,
    sync,
  };
}
