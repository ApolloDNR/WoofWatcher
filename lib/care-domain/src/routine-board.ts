import { normalizeCareEventType, type CareEventDetails, type CareEventType } from "./events.ts";
import { parseClockTime } from "./clock-time.ts";

export type RoutineBoardStatus = "done" | "pending" | "overdue" | "due" | "upcoming" | "needs-correction";
export type RoutineCompletion = "complete" | "partial" | "skipped" | "pending";

export interface RoutineBoardRoutine {
  id?: string;
  label: string;
  type: string;
  time: string;
  owner?: string | null;
  note?: string | null;
}

export interface RoutineBoardEntry {
  id?: string;
  type: string;
  title?: string | null;
  caregiver?: string | null;
  occurredAt: string;
  details?: CareEventDetails;
}

export interface RoutineBoardCaregiver {
  name: string;
  role?: string;
}

export interface RoutineBoardInput {
  routines: readonly RoutineBoardRoutine[];
  entries: readonly RoutineBoardEntry[];
  caregivers?: readonly RoutineBoardCaregiver[];
  now?: number;
}

interface RoutineBoardItemBase extends RoutineBoardRoutine {
  id: string;
  normalizedType: CareEventType;
  owner: string;
  completion: RoutineCompletion | null;
  completionLabel: string | null;
  completedBy: string | null;
  completedAt: string | null;
}

export type RoutineBoardScheduledItem = RoutineBoardItemBase & {
  status: Exclude<RoutineBoardStatus, "needs-correction">;
  minutesFromNow: number;
};

export type RoutineBoardCorrectionItem = RoutineBoardItemBase & {
  status: "needs-correction";
  minutesFromNow: null;
};

export type RoutineBoardItem = RoutineBoardScheduledItem | RoutineBoardCorrectionItem;

export interface RoutineOwnerLoad {
  owner: string;
  assigned: number;
  done: number;
  open: number;
}

export interface RoutineBoard {
  items: RoutineBoardItem[];
  doneCount: number;
  openCount: number;
  correctionCount: number;
  unassignedCount: number;
  ownerLoads: RoutineOwnerLoad[];
  next: RoutineBoardScheduledItem | null;
  summary: string;
}

const DUE_WINDOW_MINUTES = 30;
const FUZZY_MATCH_WINDOW_MINUTES = 120;

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isSameLocalDay(iso: string, now: number): boolean {
  const d = new Date(iso);
  const n = new Date(now);
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

function routineDateMs(routine: RoutineBoardRoutine, now: number): number | null {
  const parsed = parseClockTime(routine.time);
  if (!parsed) return null;
  const d = new Date(now);
  d.setHours(0, parsed.minutesSinceMidnight, 0, 0);
  return d.getTime();
}

function entryRoutineId(entry: RoutineBoardEntry): string {
  const details = entry.details;
  const id = details?.routineId;
  return typeof id === "string" ? id : "";
}

function entryIsHouseholdVisible(entry: RoutineBoardEntry): boolean {
  return entry.details?.householdVisible !== false;
}

function detailText(details: CareEventDetails, key: string): string {
  const value = details?.[key];
  return typeof value === "string" ? clean(value).toLowerCase() : "";
}

function entryCompletion(entry: RoutineBoardEntry, normalizedType: CareEventType): RoutineCompletion {
  if (normalizedType !== "meal") return "complete";
  const mealCompletion = detailText(entry.details, "mealCompletion");
  const lifecycle = detailText(entry.details, "mealLifecycle");
  const completion = detailText(entry.details, "completion");
  const portion = detailText(entry.details, "portion");
  const outcome = mealCompletion || completion || portion;
  if (
    ["served", "pending", "outcome-pending", "still grazing", "grazing"].includes(outcome) ||
    ["served", "pending", "outcome-pending", "still grazing", "grazing"].includes(lifecycle)
  ) {
    return "pending";
  }
  if (["skipped", "skip", "none", "no"].includes(outcome)) return "skipped";
  if (["partial", "partially eaten", "half", "light", "small", "some"].includes(outcome)) return "partial";
  return "complete";
}

function completionLabel(completion: RoutineCompletion): string {
  if (completion === "pending") return "Outcome pending";
  if (completion === "skipped") return "Skipped";
  if (completion === "partial") return "Partial";
  return "Complete";
}

function entryTitleMatches(entry: RoutineBoardEntry, routine: RoutineBoardRoutine): boolean {
  const title = clean(entry.title).toLowerCase();
  const label = clean(routine.label).toLowerCase();
  return Boolean(title && label && (title.includes(label) || label.includes(title)));
}

function statusFor(
  routineMs: number,
  completed: boolean,
  now: number,
): Exclude<RoutineBoardStatus, "needs-correction"> {
  if (completed) return "done";
  const diffMinutes = Math.round((routineMs - now) / 60000);
  if (diffMinutes < -DUE_WINDOW_MINUTES) return "overdue";
  if (Math.abs(diffMinutes) <= DUE_WINDOW_MINUTES) return "due";
  return "upcoming";
}

export function isRoutineBoardScheduledItem(
  item: RoutineBoardItem,
): item is RoutineBoardScheduledItem {
  return item.status !== "needs-correction" && item.minutesFromNow !== null;
}

export function deriveRoutineBoard(input: RoutineBoardInput): RoutineBoard {
  const now = input.now ?? Date.now();
  const todays = input.entries
    .filter((entry) => isSameLocalDay(entry.occurredAt, now) && entryIsHouseholdVisible(entry))
    .map((entry, index) => ({
      entry,
      key: entry.id ? `id:${entry.id}` : `index:${index}`,
      ms: new Date(entry.occurredAt).getTime(),
      normalizedType: normalizeCareEventType(entry.type, entry.details),
    }))
    .sort((a, b) => a.ms - b.ms);
  const usedEntryKeys = new Set<string>();

  const sortedRoutines = input.routines
    .map((routine, index) => ({ routine, index, routineMs: routineDateMs(routine, now) }))
    .sort((a, b) => {
      if (a.routineMs == null) return b.routineMs == null ? a.index - b.index : 1;
      if (b.routineMs == null) return -1;
      return a.routineMs - b.routineMs || a.index - b.index;
    });

  const items = sortedRoutines.map(({ routine, routineMs }, index): RoutineBoardItem => {
    const id = clean(routine.id) || `routine_${index}`;
    const normalizedType = normalizeCareEventType(routine.type);
    const owner = clean(routine.owner);
    if (routineMs == null) {
      return {
        ...routine,
        id,
        owner,
        normalizedType,
        status: "needs-correction",
        completion: null,
        completionLabel: null,
        completedBy: null,
        completedAt: null,
        minutesFromNow: null,
      };
    }

    const exact = todays.find(
      (candidate) =>
        !usedEntryKeys.has(candidate.key) &&
        entryRoutineId(candidate.entry) === id,
    );
    const fuzzy = exact ??
      todays.find((candidate) => {
        if (usedEntryKeys.has(candidate.key)) return false;
        const linkedRoutineId = entryRoutineId(candidate.entry);
        if (linkedRoutineId && linkedRoutineId !== id) return false;
        if (candidate.normalizedType !== normalizedType) return false;
        const minutes = (candidate.ms - routineMs) / 60000;
        return minutes >= -DUE_WINDOW_MINUTES && minutes <= FUZZY_MATCH_WINDOW_MINUTES;
      }) ??
      todays.find((candidate) => {
        if (usedEntryKeys.has(candidate.key)) return false;
        const linkedRoutineId = entryRoutineId(candidate.entry);
        if (linkedRoutineId && linkedRoutineId !== id) return false;
        if (candidate.normalizedType !== normalizedType) return false;
        return entryTitleMatches(candidate.entry, routine);
      });

    if (fuzzy) usedEntryKeys.add(fuzzy.key);

    const completion = fuzzy ? entryCompletion(fuzzy.entry, normalizedType) : null;
    const pendingOutcome = completion === "pending";
    return {
      ...routine,
      id,
      owner,
      normalizedType,
      status: pendingOutcome ? "pending" : statusFor(routineMs, Boolean(fuzzy), now),
      completion,
      completionLabel: completion ? completionLabel(completion) : null,
      completedBy: fuzzy ? clean(fuzzy.entry.caregiver) || null : null,
      completedAt: fuzzy?.entry.occurredAt ?? null,
      minutesFromNow: Math.round((routineMs - now) / 60000),
    };
  });

  const scheduledItems = items.filter(isRoutineBoardScheduledItem);
  const correctionCount = items.length - scheduledItems.length;
  const ownerNames = new Set<string>(
    [
      ...(input.caregivers ?? []).map((caregiver) => clean(caregiver.name)),
      ...scheduledItems.map((item) => item.owner),
    ].filter(Boolean),
  );
  const ownerLoads = [...ownerNames].map((owner) => {
    const assignedItems = scheduledItems.filter((item) => item.owner === owner);
    const done = assignedItems.filter((item) => item.status === "done").length;
    return {
      owner,
      assigned: assignedItems.length,
      done,
      open: assignedItems.length - done,
    };
  });
  const doneCount = scheduledItems.filter((item) => item.status === "done").length;
  const scheduledOpenItems = scheduledItems.filter((item) => item.status !== "done");
  const correctionSummary = correctionCount
    ? `. ${correctionCount} routine${correctionCount === 1 ? "" : "s"} ${correctionCount === 1 ? "needs" : "need"} correction.`
    : "";

  return {
    items,
    doneCount,
    openCount: scheduledOpenItems.length,
    correctionCount,
    unassignedCount: scheduledItems.filter((item) => !item.owner).length,
    ownerLoads,
    next:
      scheduledOpenItems.find((item) => item.status === "pending") ??
      scheduledOpenItems.find((item) => item.status === "due") ??
      scheduledOpenItems.find((item) => item.status === "overdue") ??
      scheduledOpenItems.find((item) => item.status === "upcoming") ??
      null,
    summary: `${doneCount}/${scheduledItems.length} routines done today${correctionSummary}`,
  };
}
