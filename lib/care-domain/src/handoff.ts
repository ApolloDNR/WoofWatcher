import { normalizeCareEventType, type CareEventType } from "./events.ts";
import { deriveCareDayStatus } from "./status.ts";
import { deriveHealthWatch, type CareHealthEntry, type CareHealthStatus } from "./health.ts";

export interface CareHandoffRoutine {
  id?: string;
  type: string;
  label: string;
  time: string;
  owner?: string;
  note?: string;
}

export interface CareHandoffCaregiver {
  name: string;
  role: string;
}

export interface CareHandoffInput {
  entries: readonly CareHealthEntry[];
  routines?: readonly CareHandoffRoutine[];
  caregivers?: readonly CareHandoffCaregiver[];
  now?: number;
}

export interface CareHandoffItem {
  kind: CareEventType | "health";
  label: string;
  detail: string;
  urgency: CareHealthStatus;
  entryIds: string[];
}

export interface CaregiverLoad {
  name: string;
  role: string;
  todayLogs: number;
  latestAction: string;
}

export interface CareHandoffSummary {
  message: string;
  sections: {
    done: CareHandoffItem[];
    watch: CareHandoffItem[];
    needsAttention: CareHandoffItem[];
  };
  next: CareHandoffRoutine | null;
  caregiverLoad: CaregiverLoad[];
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

function routineDateMs(routine: CareHandoffRoutine, now: number): number {
  const [time, periodRaw] = routine.time.trim().split(/\s+/);
  const [hStr, mStr] = time.split(":");
  const period = periodRaw?.toUpperCase();
  let hour = Number.parseInt(hStr, 10);
  if (!Number.isFinite(hour)) hour = 0;
  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  const d = new Date(now);
  d.setHours(hour, Number.parseInt(mStr || "0", 10) || 0, 0, 0);
  return d.getTime();
}

function getNextRoutine(
  routines: readonly CareHandoffRoutine[],
  now: number,
): CareHandoffRoutine | null {
  return (
    routines
      .map((routine) => ({ routine, ms: routineDateMs(routine, now) }))
      .filter(({ ms }) => ms > now)
      .sort((a, b) => a.ms - b.ms)[0]?.routine ?? null
  );
}

function idsForType(
  entries: readonly CareHealthEntry[],
  type: CareEventType,
): string[] {
  return entries
    .filter((entry) => normalizeCareEventType(entry.type, entry.details) === type)
    .map((entry) => entry.id ?? `${entry.type}_${entry.occurredAt}`);
}

function doneItem(
  kind: CareEventType,
  label: string,
  detail: string,
  entryIds: string[],
): CareHandoffItem | null {
  if (entryIds.length === 0) return null;
  return {
    kind,
    label,
    detail,
    urgency: "good",
    entryIds,
  };
}

export function deriveCareHandoff(input: CareHandoffInput): CareHandoffSummary {
  const now = input.now ?? Date.now();
  const entries = input.entries ?? [];
  const routines = input.routines ?? [];
  const caregivers = input.caregivers ?? [];
  const todays = entries.filter((entry) => isSameLocalDay(entry.occurredAt, now));
  const status = deriveCareDayStatus(entries, routines, now);
  const health = deriveHealthWatch({ entries, routines, now });

  const done = [
    doneItem(
      "meal",
      "Meals",
      `${status.counts.meals.done}/${status.counts.meals.target} meals logged.`,
      idsForType(todays, "meal"),
    ),
    doneItem(
      "walk",
      "Walks",
      `${status.counts.walks.done}/${status.counts.walks.target} walks, ${status.counts.walkMinutes} minutes.`,
      idsForType(todays, "walk"),
    ),
    doneItem(
      "potty",
      "Potty",
      `${status.counts.potty.done}/${status.counts.potty.target} potty breaks logged.`,
      idsForType(todays, "potty"),
    ),
    doneItem(
      "training",
      "Training",
      `${status.counts.training} training logs today.`,
      idsForType(todays, "training"),
    ),
  ].filter((item): item is CareHandoffItem => item !== null);

  const watch: CareHandoffItem[] =
    health.status === "good"
      ? []
      : [
          {
            kind: "health",
            label: health.status === "alert" ? "Health alert" : "Health watch",
            detail: health.summary,
            urgency: health.status,
            entryIds: health.signals.flatMap((signal) => signal.entryIds),
          },
        ];

  const needsAttention: CareHandoffItem[] = [];
  if (status.counts.meals.done < status.counts.meals.target) {
    needsAttention.push({
      kind: "meal",
      label: "Meal remaining",
      detail: `${status.counts.meals.target - status.counts.meals.done} meal log still open.`,
      urgency: "watch",
      entryIds: [],
    });
  }
  if (status.counts.walks.done < status.counts.walks.target) {
    needsAttention.push({
      kind: "walk",
      label: "Walk remaining",
      detail: `${status.counts.walks.target - status.counts.walks.done} walk still open.`,
      urgency: "watch",
      entryIds: [],
    });
  }

  const caregiverLoad = caregivers
    .map((caregiver) => {
      const caregiverEntries = todays
        .filter((entry) => entry.caregiver === caregiver.name)
        .sort(
          (a, b) =>
            new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
        );
      return {
        name: caregiver.name,
        role: caregiver.role,
        todayLogs: caregiverEntries.length,
        latestAction: caregiverEntries[0]?.title ?? "",
      };
    })
    .sort((a, b) => b.todayLogs - a.todayLogs);

  const topCaregiver = caregiverLoad[0];
  const message = topCaregiver
    ? `${topCaregiver.name} logged ${topCaregiver.todayLogs} ${topCaregiver.todayLogs === 1 ? "item" : "items"} today.`
    : "No caregiver handoff activity logged today.";

  return {
    message,
    sections: {
      done,
      watch,
      needsAttention,
    },
    next: getNextRoutine(routines, now),
    caregiverLoad,
  };
}
