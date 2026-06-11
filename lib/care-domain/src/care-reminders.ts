import { normalizeCareEventType, type CareEventDetails } from "./events.ts";
import { deriveGroomingCare } from "./grooming-care.ts";
import {
  deriveMedicationFollowUps,
  type MedicationRecord,
} from "./medication.ts";
import { deriveRecordReminders, type CareRecord } from "./record-vault.ts";
import {
  deriveRoutineBoard,
  type RoutineBoardCaregiver,
} from "./routine-board.ts";

export type CareReminderKind = "routine" | "medication" | "record" | "grooming";
export type CareReminderUrgency = "alert" | "watch" | "info";
export type CareReminderStatus = "clear" | "attention" | "watch";

export interface CareReminderRoutine {
  id?: string;
  label: string;
  type: string;
  time: string;
  owner?: string | null;
  note?: string | null;
  dose?: string | null;
}

export interface CareReminderEntry {
  id?: string;
  type: string;
  title?: string | null;
  caregiver?: string | null;
  occurredAt: string;
  durationMinutes?: number | null;
  note?: string | null;
  details?: CareEventDetails;
}

export interface CareReminderRecord extends CareRecord, MedicationRecord {}

export interface CareReminderCaregiver extends RoutineBoardCaregiver {}

export interface CareReminderCenterInput {
  routines: readonly CareReminderRoutine[];
  entries: readonly CareReminderEntry[];
  records?: readonly CareReminderRecord[];
  caregivers?: readonly CareReminderCaregiver[];
  now?: number;
  limit?: number;
  routineLookaheadHours?: number;
}

export interface CareReminderItem {
  id: string;
  kind: CareReminderKind;
  label: string;
  detail: string;
  action: string;
  urgency: CareReminderUrgency;
  owner: string;
  time?: string;
  sourceId?: string;
  daysUntil?: number;
}

export interface CareReminderCenter {
  items: CareReminderItem[];
  total: number;
  alertCount: number;
  watchCount: number;
  routineCount: number;
  medicationCount: number;
  recordCount: number;
  groomingCount: number;
  status: CareReminderStatus;
  summary: string;
  nextStep: string;
  notificationReadiness: string;
}

const DAY_MS = 86400000;
const URGENCY_RANK: Record<CareReminderUrgency, number> = { alert: 0, watch: 1, info: 2 };
const KIND_RANK: Record<CareReminderKind, number> = { routine: 0, medication: 1, record: 2, grooming: 3 };

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parseDateMs(value: unknown): number | null {
  const text = clean(value);
  if (!text) return null;
  const parsed = new Date(text).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function daysUntil(value: unknown, now: number): number | undefined {
  const dueMs = parseDateMs(value);
  if (dueMs == null) return undefined;
  return Math.ceil((dueMs - now) / DAY_MS);
}

function routineDetail(time: string, owner: string): string {
  return [time ? `Scheduled ${time}` : "", owner ? `owner ${owner}` : ""].filter(Boolean).join(" with ") || "Routine needs review.";
}

function sortReminderItems(items: CareReminderItem[]): CareReminderItem[] {
  return [...items].sort(
    (a, b) =>
      URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] ||
      (a.daysUntil ?? 9999) - (b.daysUntil ?? 9999) ||
      KIND_RANK[a.kind] - KIND_RANK[b.kind] ||
      a.label.localeCompare(b.label),
  );
}

function summaryFor(total: number, alertCount: number, watchCount: number): string {
  if (total === 0) return "No reminder candidates need attention right now.";
  return `${total} reminder candidate${total === 1 ? "" : "s"} - ${alertCount} urgent, ${watchCount} watch.`;
}

function nextStepFor(status: CareReminderStatus): string {
  if (status === "attention") {
    return "Handle overdue or missed care first, then update the shared log so the household sees the result.";
  }
  if (status === "watch") {
    return "Review due-soon reminders and assign the owner before the care window closes.";
  }
  return "Keep routines and records current; push notifications still need provider setup.";
}

export function deriveCareReminderCenter(input: CareReminderCenterInput): CareReminderCenter {
  const now = input.now ?? Date.now();
  const limit = Math.max(0, input.limit ?? 5);
  const routineLookaheadMinutes = Math.max(0, input.routineLookaheadHours ?? 3) * 60;
  const records = input.records ?? [];

  const routineBoard = deriveRoutineBoard({
    routines: input.routines,
    entries: input.entries,
    caregivers: input.caregivers,
    now,
  });

  const routineItems = routineBoard.items
    .filter((item) => item.status !== "done")
    .filter((item) => normalizeCareEventType(item.type) !== "medication")
    .filter((item) => item.status !== "upcoming" || item.minutesFromNow <= routineLookaheadMinutes)
    .map((item): CareReminderItem => {
      const urgency: CareReminderUrgency =
        item.status === "overdue" ? "alert" : item.status === "due" ? "watch" : "info";
      const labelStatus = item.status === "overdue" ? "overdue" : item.status === "due" ? "due now" : "coming up";
      return {
        id: `routine_${item.id}_${item.status}`,
        kind: "routine",
        label: `${clean(item.label) || "Routine"} ${labelStatus}`,
        detail: routineDetail(item.time, item.owner),
        action:
          item.status === "overdue"
            ? "Log it, reschedule it, or assign an owner."
            : "Log completion from Calendar or open the full Log composer.",
        urgency,
        owner: item.owner || "Household",
        time: item.time,
        sourceId: item.id,
      };
    });

  const medicationItems = deriveMedicationFollowUps({
    routines: input.routines,
    entries: input.entries,
    records,
    now,
  }).map((item): CareReminderItem => ({
    id: `medication_${item.id}`,
    kind: "medication",
    label: item.label,
    detail: item.detail,
    action: item.action,
    urgency: item.urgency,
    owner: "Household",
    sourceId: item.routineId ?? item.recordId,
    daysUntil: item.daysUntil,
  }));

  const recordItems = deriveRecordReminders(records, { now })
    .slice(0, 4)
    .map((item): CareReminderItem => ({
      id: `record_${item.recordId ?? item.section ?? item.label}`,
      kind: "record",
      label: item.label,
      detail: item.detail,
      action: item.action,
      urgency: item.urgency,
      owner: "Household",
      sourceId: item.recordId,
      daysUntil: item.daysUntil,
    }));

  const grooming = deriveGroomingCare({ entries: input.entries, now, lookbackDays: 60, limit: 1 });
  const groomingDueIn = daysUntil(grooming.nextDue, now);
  const groomingItems =
    grooming.status === "watch"
      ? [
          {
            id: "grooming_watch",
            kind: "grooming" as const,
            label: "Grooming watch",
            detail: grooming.summary,
            action: grooming.nextStep,
            urgency: "watch" as const,
            owner: grooming.latest?.caregiver ?? "Household",
            sourceId: grooming.latest?.id,
            daysUntil: groomingDueIn,
          },
        ]
      : groomingDueIn != null && groomingDueIn <= 14
        ? [
            {
              id: "grooming_due",
              kind: "grooming" as const,
              label: groomingDueIn < 0 ? "Grooming overdue" : "Grooming due soon",
              detail:
                groomingDueIn < 0
                  ? `The next grooming date was ${grooming.nextDue}.`
                  : `The next grooming date is ${grooming.nextDue}.`,
              action: grooming.nextStep,
              urgency: groomingDueIn < 0 ? "alert" as const : "watch" as const,
              owner: grooming.latest?.caregiver ?? "Household",
              sourceId: grooming.latest?.id,
              daysUntil: groomingDueIn,
            },
          ]
        : [];

  const allItems = sortReminderItems([
    ...routineItems,
    ...medicationItems,
    ...recordItems,
    ...groomingItems,
  ]);
  const alertCount = allItems.filter((item) => item.urgency === "alert").length;
  const watchCount = allItems.filter((item) => item.urgency === "watch").length;
  const status: CareReminderStatus = alertCount > 0 ? "attention" : watchCount > 0 ? "watch" : "clear";

  return {
    items: allItems.slice(0, limit),
    total: allItems.length,
    alertCount,
    watchCount,
    routineCount: allItems.filter((item) => item.kind === "routine").length,
    medicationCount: allItems.filter((item) => item.kind === "medication").length,
    recordCount: allItems.filter((item) => item.kind === "record").length,
    groomingCount: allItems.filter((item) => item.kind === "grooming").length,
    status,
    summary: summaryFor(allItems.length, alertCount, watchCount),
    nextStep: nextStepFor(status),
    notificationReadiness:
      "Reminder candidates are ready for owner review; real push notifications still need provider setup.",
  };
}
