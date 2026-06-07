import { normalizeCareEventType, type CareEventDetails, type CareEventType } from "./events.ts";

export type RoutineBoardStatus = "done" | "overdue" | "due" | "upcoming";

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

export interface RoutineBoardItem extends RoutineBoardRoutine {
  id: string;
  normalizedType: CareEventType;
  owner: string;
  status: RoutineBoardStatus;
  completedBy: string | null;
  completedAt: string | null;
  minutesFromNow: number;
}

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
  unassignedCount: number;
  ownerLoads: RoutineOwnerLoad[];
  next: RoutineBoardItem | null;
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

function routineDateMs(routine: RoutineBoardRoutine, now: number): number {
  const [time, periodRaw] = clean(routine.time).split(/\s+/);
  const [hStr, mStr] = (time || "0:00").split(":");
  const period = periodRaw?.toUpperCase();
  let h = Number.parseInt(hStr, 10);
  if (!Number.isFinite(h)) h = 0;
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  const d = new Date(now);
  d.setHours(h, Number.parseInt(mStr || "0", 10) || 0, 0, 0);
  return d.getTime();
}

function entryRoutineId(entry: RoutineBoardEntry): string {
  const details = entry.details;
  const id = details?.routineId;
  return typeof id === "string" ? id : "";
}

function entryTitleMatches(entry: RoutineBoardEntry, routine: RoutineBoardRoutine): boolean {
  const title = clean(entry.title).toLowerCase();
  const label = clean(routine.label).toLowerCase();
  return Boolean(title && label && (title.includes(label) || label.includes(title)));
}

function statusFor(routineMs: number, completed: boolean, now: number): RoutineBoardStatus {
  if (completed) return "done";
  const diffMinutes = Math.round((routineMs - now) / 60000);
  if (diffMinutes < -DUE_WINDOW_MINUTES) return "overdue";
  if (Math.abs(diffMinutes) <= DUE_WINDOW_MINUTES) return "due";
  return "upcoming";
}

export function deriveRoutineBoard(input: RoutineBoardInput): RoutineBoard {
  const now = input.now ?? Date.now();
  const todays = input.entries
    .filter((entry) => isSameLocalDay(entry.occurredAt, now))
    .map((entry, index) => ({
      entry,
      key: entry.id ? `id:${entry.id}` : `index:${index}`,
      ms: new Date(entry.occurredAt).getTime(),
      normalizedType: normalizeCareEventType(entry.type, entry.details),
    }))
    .sort((a, b) => a.ms - b.ms);
  const usedEntryKeys = new Set<string>();

  const sortedRoutines = [...input.routines].sort((a, b) => routineDateMs(a, now) - routineDateMs(b, now));

  const items = sortedRoutines.map((routine, index): RoutineBoardItem => {
    const id = clean(routine.id) || `routine_${index}`;
    const normalizedType = normalizeCareEventType(routine.type);
    const routineMs = routineDateMs(routine, now);
    const exact = todays.find(
      (candidate) =>
        !usedEntryKeys.has(candidate.key) &&
        entryRoutineId(candidate.entry) === id,
    );
    const fuzzy =
      exact ??
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

    const owner = clean(routine.owner);
    return {
      ...routine,
      id,
      owner,
      normalizedType,
      status: statusFor(routineMs, Boolean(fuzzy), now),
      completedBy: fuzzy ? clean(fuzzy.entry.caregiver) || null : null,
      completedAt: fuzzy?.entry.occurredAt ?? null,
      minutesFromNow: Math.round((routineMs - now) / 60000),
    };
  });

  const ownerNames = new Set<string>(
    [
      ...(input.caregivers ?? []).map((caregiver) => clean(caregiver.name)),
      ...items.map((item) => item.owner),
    ].filter(Boolean),
  );
  const ownerLoads = [...ownerNames].map((owner) => {
    const assignedItems = items.filter((item) => item.owner === owner);
    const done = assignedItems.filter((item) => item.status === "done").length;
    return {
      owner,
      assigned: assignedItems.length,
      done,
      open: assignedItems.length - done,
    };
  });
  const doneCount = items.filter((item) => item.status === "done").length;
  const openItems = items.filter((item) => item.status !== "done");

  return {
    items,
    doneCount,
    openCount: openItems.length,
    unassignedCount: items.filter((item) => !item.owner).length,
    ownerLoads,
    next:
      openItems.find((item) => item.status === "due") ??
      openItems.find((item) => item.status === "overdue") ??
      openItems.find((item) => item.status === "upcoming") ??
      null,
    summary: `${doneCount}/${items.length} routines done today`,
  };
}
