import { normalizeCareEventType, type CareEventDetails, type CareEventType } from "./events.ts";
import { deriveRoutineBoard, type RoutineBoardCaregiver, type RoutineBoardRoutine } from "./routine-board.ts";
import { deriveCareDayStatus } from "./status.ts";

export type CareIntelligenceStatus = "excellent" | "steady" | "building" | "needs-attention";
export type CareIntelligenceTone = "good" | "watch" | "neutral" | "attention";

export interface CareIntelligenceEntry {
  id?: string;
  type: string;
  title?: string | null;
  caregiver?: string | null;
  occurredAt: string;
  durationMinutes?: number | null;
  amount?: string | number | null;
  mood?: string | null;
  severity?: string | null;
  note?: string | null;
  details?: CareEventDetails;
  syncStatus?: "local" | "pending" | "synced" | "failed" | string;
  syncError?: string | null;
}

export interface CareIntelligenceInput {
  entries: readonly CareIntelligenceEntry[];
  routines?: readonly RoutineBoardRoutine[];
  caregivers?: readonly RoutineBoardCaregiver[];
  now?: number;
}

export interface CareIntelligenceMetric {
  label: string;
  value: string;
  detail: string;
  tone: CareIntelligenceTone;
}

export interface CareIntelligenceOpenLoop {
  id: string;
  kind:
    | "failed-sync"
    | "pending-meal"
    | "overdue-routine"
    | "due-routine"
    | "low-confidence"
    | "missing-care";
  label: string;
  detail: string;
  priority: "high" | "medium" | "low";
}

export interface CareIntelligenceNextAction {
  kind:
    | "retry-sync"
    | "update-meal-outcome"
    | "handle-routine"
    | "add-log-detail"
    | "log-core-care"
    | "review-day";
  label: string;
  detail: string;
  priority: "high" | "medium" | "low";
}

export interface CareIntelligence {
  score: number;
  status: CareIntelligenceStatus;
  title: string;
  subtitle: string;
  coreProgress: number;
  routineProgress: number;
  confidenceScore: number;
  syncScore: number;
  visibleLogCount: number;
  structuredLogCount: number;
  pendingOutcomeCount: number;
  openLoopCount: number;
  metrics: CareIntelligenceMetric[];
  openLoops: CareIntelligenceOpenLoop[];
  nextAction: CareIntelligenceNextAction;
}

const FIELD_GROUPS: Record<CareEventType, readonly (readonly string[])[]> = {
  meal: [
    ["mealCompletion", "completion", "outcome"],
    ["servedAmount", "servingAmount", "portion", "amount", "$amount"],
    ["eatenAmount", "mealLifecycle", "outcomeAt"],
    ["food", "primaryFood"],
    ["routineId"],
  ],
  treat: [["treatType", "treat"], ["amount", "servingAmount", "$amount"], ["reason", "trainingSkill"]],
  water: [["servingAmount", "amount", "$amount"], ["bowlStatus", "refill", "waterState"], ["hydration"]],
  walk: [["duration", "$duration"], ["distance", "walkDistance"], ["route", "routeName", "walkRouteName"], ["dogInteractions", "walkSocialOutcome", "socialOutcome"]],
  potty: [["pottyKind", "pottyOutcome", "what"], ["stoolCondition", "condition"], ["stoolColor"], ["pottyContext", "where"]],
  play: [["duration", "$duration"], ["playType", "toy"], ["mood", "$mood"]],
  training: [["trainingSkill", "skill", "cue"], ["trainingOutcome", "outcome"], ["nextPractice"], ["duration", "$duration"]],
  mood: [["mood", "$mood"], ["energy"], ["trigger"], ["support"]],
  medication: [["routineId"], ["medicationDose", "dose"], ["medicationOutcome", "taken"], ["medicationName", "name"]],
  weight: [["weight", "value", "amount", "$amount"], ["unit"], ["bodyCondition"]],
  vomit: [["what", "kind", "color"], ["severity", "$severity"], ["timeSinceFood", "foodGap"], ["appetiteAfter"], ["energyAfter"]],
  symptom: [["what", "kind"], ["severity", "$severity"], ["duration", "$duration"], ["notes"]],
  incident: [["incidentType", "kind"], ["incidentTrigger", "trigger", "context"], ["incidentExposure", "exposure", "involved"], ["incidentInjury", "injury"], ["incidentFollowUp", "followUp"]],
  grooming: [["groomingCondition", "condition"], ["groomingProducts", "products"], ["groomingNextDue", "nextDue"], ["coatNotes"]],
  alone: [["aloneOutcome", "returnState", "outcome"], ["aloneTrigger", "trigger"], ["calmingSupport", "support"], ["recoveryMinutes", "$duration"]],
  note: [["note", "$note"], ["stickyNotes"], ["tag"]],
};

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function lower(value: unknown): string {
  return clean(value).toLowerCase();
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value);
}

function isSameLocalDay(iso: string, now: number): boolean {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return false;
  const n = new Date(now);
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function asObject(details: CareEventDetails): Record<string, unknown> {
  return details != null && typeof details === "object" && !Array.isArray(details)
    ? (details as Record<string, unknown>)
    : {};
}

function hasValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return false;
}

function detailValue(entry: CareIntelligenceEntry, key: string): unknown {
  const details = asObject(entry.details);
  if (key === "$amount") return entry.amount;
  if (key === "$duration") return entry.durationMinutes;
  if (key === "$mood") return entry.mood;
  if (key === "$severity") return entry.severity;
  if (key === "$note") return entry.note;
  return details[key];
}

function hasAnyField(entry: CareIntelligenceEntry, keys: readonly string[]): boolean {
  return keys.some((key) => hasValue(detailValue(entry, key)));
}

function isHouseholdVisible(entry: CareIntelligenceEntry): boolean {
  return asObject(entry.details).householdVisible !== false;
}

function isPendingMeal(entry: CareIntelligenceEntry): boolean {
  if (normalizeCareEventType(entry.type, entry.details) !== "meal") return false;
  const details = asObject(entry.details);
  const completion = lower(details.mealCompletion ?? details.completion ?? details.outcome);
  const lifecycle = lower(details.mealLifecycle);
  return ["served", "pending", "outcome-pending", "still grazing", "grazing"].includes(completion) ||
    ["served", "pending", "outcome-pending", "still grazing", "grazing"].includes(lifecycle);
}

function mealCarePoint(entry: CareIntelligenceEntry): number {
  const details = asObject(entry.details);
  const completion = lower(details.mealCompletion ?? details.completion ?? details.outcome ?? details.portion);
  if (isPendingMeal(entry)) return 0.25;
  if (["skipped", "refused", "none", "no"].includes(completion)) return 0;
  if (["partial", "ate some", "some", "half", "light"].includes(completion)) return 0.55;
  if (["ate most", "most"].includes(completion)) return 0.8;
  return 1;
}

function syncPenalty(entry: CareIntelligenceEntry): number {
  if (entry.syncStatus === "failed") return 0.82;
  if (entry.syncStatus === "local") return 0.9;
  if (entry.syncStatus === "pending") return 0.95;
  return 1;
}

function entryConfidence(entry: CareIntelligenceEntry): number {
  const normalized = normalizeCareEventType(entry.type, entry.details);
  const groups = FIELD_GROUPS[normalized] ?? [];
  const covered = groups.filter((keys) => hasAnyField(entry, keys)).length;
  const structuredCredit = groups.length ? (covered / groups.length) * 0.36 : 0;
  const details = asObject(entry.details);
  const noteCredit =
    clean(entry.note).length > 0 || Array.isArray(details.stickyNotes) || Array.isArray(details.auditTrail)
      ? 0.12
      : 0;
  const base =
    0.25 +
    (clean(entry.title).length > 0 ? 0.07 : 0) +
    (clean(entry.caregiver).length > 0 ? 0.1 : 0) +
    (hasValue(details.routineId) ? 0.1 : 0) +
    noteCredit +
    structuredCredit;
  return clamp(round(base * syncPenalty(entry) * 100), 0, 100);
}

function ratioPercent(done: number, target: number): number {
  if (target <= 0) return 100;
  return clamp(round((done / target) * 100));
}

function firstOpenRoutineLabel(open: { label: string; minutesFromNow: number; status: string } | null): string {
  if (!open) return "No open routines";
  if (open.status === "overdue") return `${open.label} is overdue`;
  if (open.status === "due") return `${open.label} is due now`;
  const minutes = Math.max(0, open.minutesFromNow);
  if (minutes < 60) return `${open.label} in ${minutes}m`;
  return `${open.label} later today`;
}

function toneForPercent(value: number): CareIntelligenceTone {
  if (value >= 80) return "good";
  if (value >= 55) return "watch";
  return "attention";
}

function scoreStatus(score: number, hasAttentionLoop: boolean): CareIntelligenceStatus {
  if (hasAttentionLoop) return "needs-attention";
  if (score >= 86) return "excellent";
  if (score >= 68) return "steady";
  return "building";
}

function titleFor(status: CareIntelligenceStatus): string {
  if (status === "excellent") return "Care engine humming";
  if (status === "steady") return "Care rhythm is steady";
  if (status === "needs-attention") return "A few care loops need review";
  return "Care record is building";
}

function subtitleFor(status: CareIntelligenceStatus, nextAction: CareIntelligenceNextAction): string {
  if (status === "excellent") return "Routines, logs, and proof are lining up today.";
  if (status === "steady") return "Phoenix has a strong record today; keep closing the open loops.";
  if (status === "needs-attention") return nextAction.detail;
  return "Log the next real care moment and the day will sharpen fast.";
}

function nextActionFromLoops(
  loops: readonly CareIntelligenceOpenLoop[],
  coreProgress: number,
): CareIntelligenceNextAction {
  const failed = loops.find((loop) => loop.kind === "failed-sync");
  if (failed) {
    return {
      kind: "retry-sync",
      label: "Retry household sync",
      detail: failed.detail,
      priority: "high",
    };
  }
  const pendingMeal = loops.find((loop) => loop.kind === "pending-meal");
  if (pendingMeal) {
    return {
      kind: "update-meal-outcome",
      label: "Update meal outcome",
      detail: pendingMeal.detail,
      priority: pendingMeal.priority,
    };
  }
  const routine = loops.find((loop) => loop.kind === "overdue-routine" || loop.kind === "due-routine");
  if (routine) {
    return {
      kind: "handle-routine",
      label: routine.label,
      detail: routine.detail,
      priority: routine.priority,
    };
  }
  const sparse = loops.find((loop) => loop.kind === "low-confidence");
  if (sparse) {
    return {
      kind: "add-log-detail",
      label: "Add detail to logs",
      detail: sparse.detail,
      priority: "low",
    };
  }
  if (coreProgress < 70) {
    return {
      kind: "log-core-care",
      label: "Log the next care beat",
      detail: "Meals, walks, and potty logs power the clearest daily read.",
      priority: "medium",
    };
  }
  return {
    kind: "review-day",
    label: "Review the day",
    detail: "Care, routines, and household proof are in a good place.",
    priority: "low",
  };
}

export function deriveCareIntelligence(input: CareIntelligenceInput): CareIntelligence {
  const now = input.now ?? Date.now();
  const routines = input.routines ?? [];
  const visibleToday = input.entries.filter((entry) => isSameLocalDay(entry.occurredAt, now) && isHouseholdVisible(entry));
  const status = deriveCareDayStatus(visibleToday, routines, now);
  const board = deriveRoutineBoard({
    routines,
    entries: visibleToday,
    caregivers: input.caregivers ?? [],
    now,
  });

  const mealEntries = visibleToday.filter((entry) => normalizeCareEventType(entry.type, entry.details) === "meal");
  const mealTarget = Math.max(status.counts.meals.target || 2, 1);
  const mealProgress = ratioPercent(mealEntries.reduce((sum, entry) => sum + mealCarePoint(entry), 0), mealTarget);
  const walkProgress = ratioPercent(status.counts.walks.done, Math.max(status.counts.walks.target || 2, 1));
  const pottyProgress = ratioPercent(status.counts.potty.done, Math.max(status.counts.potty.target || 3, 1));
  const coreProgress = round(mealProgress * 0.42 + walkProgress * 0.31 + pottyProgress * 0.27);
  const routineProgress = routines.length ? ratioPercent(board.doneCount, routines.length) : coreProgress;

  const confidenceScores = visibleToday.map(entryConfidence);
  const confidenceScore = confidenceScores.length
    ? round(confidenceScores.reduce((sum, value) => sum + value, 0) / confidenceScores.length)
    : 0;
  const structuredLogCount = confidenceScores.filter((score) => score >= 72).length;

  const failedSyncEntries = visibleToday.filter((entry) => entry.syncStatus === "failed");
  const pendingSyncEntries = visibleToday.filter((entry) => entry.syncStatus === "pending");
  const localEntries = visibleToday.filter((entry) => entry.syncStatus === "local");
  const syncScore = failedSyncEntries.length
    ? 55
    : pendingSyncEntries.length
      ? 82
      : localEntries.length
        ? 90
        : 100;

  const pendingMeals = mealEntries.filter(isPendingMeal);
  const overdueRoutines = board.items.filter((item) => item.status === "overdue");
  const dueRoutines = board.items.filter((item) => item.status === "due");
  const lowConfidenceCount = confidenceScores.filter((score) => score > 0 && score < 58).length;

  const loops: CareIntelligenceOpenLoop[] = [];
  for (const entry of failedSyncEntries.slice(0, 2)) {
    loops.push({
      id: `failed-sync:${entry.id ?? entry.occurredAt}`,
      kind: "failed-sync",
      label: "Sync needs retry",
      detail: entry.syncError ? clean(entry.syncError) : `${entry.title ?? "A care log"} has not reached the household yet.`,
      priority: "high",
    });
  }
  for (const entry of pendingMeals.slice(0, 3)) {
    loops.push({
      id: `pending-meal:${entry.id ?? entry.occurredAt}`,
      kind: "pending-meal",
      label: "Meal outcome pending",
      detail: `${entry.title ?? "Meal"} was served. Confirm whether Phoenix ate all, some, refused, or is still grazing.`,
      priority: "medium",
    });
  }
  for (const routine of overdueRoutines.slice(0, 2)) {
    loops.push({
      id: `overdue-routine:${routine.id}`,
      kind: "overdue-routine",
      label: `${routine.label} overdue`,
      detail: `${routine.owner || "Care team"} owns ${routine.label}. Log it, skip it, or reassign it.`,
      priority: "high",
    });
  }
  for (const routine of dueRoutines.slice(0, 2)) {
    loops.push({
      id: `due-routine:${routine.id}`,
      kind: "due-routine",
      label: `${routine.label} due now`,
      detail: `${routine.owner || "Care team"} can close this with a matching log.`,
      priority: "medium",
    });
  }
  if (lowConfidenceCount > 0) {
    loops.push({
      id: "low-confidence",
      kind: "low-confidence",
      label: "Add richer log proof",
      detail: `${lowConfidenceCount} log${lowConfidenceCount === 1 ? "" : "s"} could use amount, outcome, note, or routine detail.`,
      priority: "low",
    });
  }
  if (visibleToday.length === 0) {
    loops.push({
      id: "missing-care",
      kind: "missing-care",
      label: "Start today's record",
      detail: "No household-visible care logs yet today.",
      priority: "medium",
    });
  }

  const openLoopCount = loops.length;
  const rawScore = round(coreProgress * 0.38 + routineProgress * 0.25 + confidenceScore * 0.25 + syncScore * 0.12);
  const loopPenalty = Math.min(openLoopCount * 3, 12);
  const healthPenalty = status.healthAlert ? 8 : 0;
  const score = clamp(rawScore - loopPenalty - healthPenalty);
  const nextAction = nextActionFromLoops(loops, coreProgress);
  const hasAttentionLoop = failedSyncEntries.length > 0 || status.healthAlert || overdueRoutines.length > 1;
  const intelligenceStatus = scoreStatus(score, hasAttentionLoop);

  return {
    score,
    status: intelligenceStatus,
    title: titleFor(intelligenceStatus),
    subtitle: subtitleFor(intelligenceStatus, nextAction),
    coreProgress,
    routineProgress,
    confidenceScore,
    syncScore,
    visibleLogCount: visibleToday.length,
    structuredLogCount,
    pendingOutcomeCount: pendingMeals.length,
    openLoopCount,
    metrics: [
      {
        label: "Routine fit",
        value: routines.length ? `${board.doneCount}/${routines.length}` : `${coreProgress}%`,
        detail: routines.length ? firstOpenRoutineLabel(board.next) : "Starter care rhythm",
        tone: toneForPercent(routineProgress),
      },
      {
        label: "Log confidence",
        value: `${confidenceScore}%`,
        detail: `${structuredLogCount}/${visibleToday.length} rich logs`,
        tone: toneForPercent(confidenceScore),
      },
      {
        label: "Core care",
        value: `${coreProgress}%`,
        detail: "Meals, walks, and potty",
        tone: toneForPercent(coreProgress),
      },
      {
        label: "Open loops",
        value: String(openLoopCount),
        detail: loops[0]?.label ?? "None",
        tone: openLoopCount ? "watch" : "good",
      },
    ],
    openLoops: loops,
    nextAction,
  };
}
