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

function detailRecord(entry: CareHealthEntry): Record<string, unknown> {
  return entry.details != null && typeof entry.details === "object" && !Array.isArray(entry.details)
    ? (entry.details as Record<string, unknown>)
    : {};
}

function caregiverKey(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
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
  const pendingMealOutcomes = status.counts.meals.pending ?? 0;
  const missingMealLogs = Math.max(
    status.counts.meals.target - status.counts.meals.done - pendingMealOutcomes,
    0,
  );

  const done = [
    doneItem(
      "meal",
      "Meals",
      pendingMealOutcomes
        ? `${status.counts.meals.done}/${status.counts.meals.target} meals resolved. ${pendingMealOutcomes} outcome pending.`
        : `${status.counts.meals.done}/${status.counts.meals.target} meals logged.`,
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

  // Each attention item is a hand-crafted full sentence with real
  // subject-verb agreement; these lines are quoted verbatim in the shared
  // Care Pass, so machine-glued grammar reads as a broken product.
  const needsAttention: CareHandoffItem[] = [];
  if (pendingMealOutcomes > 0) {
    needsAttention.push({
      kind: "meal",
      label: pendingMealOutcomes === 1 ? "Meal outcome pending" : "Meal outcomes pending",
      detail:
        pendingMealOutcomes === 1
          ? "1 meal outcome needs confirmation - ate all, ate some, refused, or still grazing."
          : `${pendingMealOutcomes} meal outcomes need confirmation - ate all, ate some, refused, or still grazing.`,
      urgency: "watch",
      entryIds: [],
    });
  }
  if (missingMealLogs > 0) {
    needsAttention.push({
      kind: "meal",
      label: missingMealLogs === 1 ? "Meal remaining" : "Meals remaining",
      detail: `${missingMealLogs} more meal${missingMealLogs === 1 ? "" : "s"} to log today.`,
      urgency: "watch",
      entryIds: [],
    });
  }
  // A started-but-unfinished walk session is different news than a routine
  // walk that has not happened yet. "Still open" only fits the in-progress
  // session (walkLifecycle "in-progress"); a finished walk must never be
  // described as open just because today's walk target is not met yet.
  const openWalks = todays.filter((entry) => {
    if (normalizeCareEventType(entry.type, entry.details) !== "walk") return false;
    const details = detailRecord(entry);
    return details.householdVisible !== false && details.walkLifecycle === "in-progress";
  });
  if (openWalks.length > 0) {
    needsAttention.push({
      kind: "walk",
      label: openWalks.length === 1 ? "Walk in progress" : "Walks in progress",
      detail:
        openWalks.length === 1
          ? "1 walk is still in progress - log the finish to close it out."
          : `${openWalks.length} walks are still in progress - log each finish to close them out.`,
      urgency: "watch",
      entryIds: openWalks.map((entry) => entry.id ?? `${entry.type}_${entry.occurredAt}`),
    });
  }
  const walksRemaining = Math.max(status.counts.walks.target - status.counts.walks.done, 0);
  if (walksRemaining > 0) {
    needsAttention.push({
      kind: "walk",
      label: walksRemaining === 1 ? "Walk remaining" : "Walks remaining",
      detail: `${walksRemaining} more walk${walksRemaining === 1 ? "" : "s"} to log today.`,
      urgency: "watch",
      entryIds: [],
    });
  }

  const caregiverLoad = caregivers
    .map((caregiver) => {
      // Entries only store caregiver display names (there is no caregiver id
      // in the care doc), so match names case/whitespace-insensitively.
      const key = caregiverKey(caregiver.name);
      const caregiverEntries = todays
        .filter((entry) => key !== "" && caregiverKey(entry.caregiver) === key)
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

  // Name-string attribution goes stale after a caregiver rename: today's logs
  // keep the old name, so the renamed caregiver would truthfully-but-uselessly
  // read "logged 0 items today". When no listed caregiver matches any of
  // today's logs, credit the household with the real count instead.
  const topCaregiver = caregiverLoad[0];
  const message =
    topCaregiver && topCaregiver.todayLogs > 0
      ? `${topCaregiver.name} logged ${topCaregiver.todayLogs} ${topCaregiver.todayLogs === 1 ? "item" : "items"} today.`
      : todays.length > 0
        ? `The household logged ${todays.length} ${todays.length === 1 ? "item" : "items"} today.`
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
