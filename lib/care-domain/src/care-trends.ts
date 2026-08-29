import { normalizeCareEventType, type CareEventDetails } from "./events.ts";
import { isHouseholdVisibleCareEvidence } from "./shared-evidence.ts";

export type CareTrendTone = "good" | "watch" | "alert" | "info";
export type CareTrendSignalKind =
  | "care-consistency"
  | "meal-watch"
  | "activity-change"
  | "hydration-watch"
  | "potty-watch"
  | "medication-watch"
  | "health-watch";

export interface CareTrendsEntry {
  id?: string;
  type?: string | null;
  title?: string | null;
  caregiver?: string | null;
  occurredAt?: string | null;
  durationMinutes?: number | null;
  dogInteractions?: number | null;
  amount?: string | number | null;
  severity?: string | null;
  note?: string | null;
  details?: CareEventDetails;
}

export interface CareTrendsInput {
  entries: readonly CareTrendsEntry[];
  now?: number;
  windowDays?: number;
}

export interface CareTrendTopCaregiver {
  name: string;
  count: number;
}

export interface CareTrendWindow {
  totalLogs: number;
  loggedDays: number;
  caregiverCount: number;
  caregivers: string[];
  topCaregiver: CareTrendTopCaregiver | null;
  meals: {
    total: number;
    complete: number;
    partial: number;
    skipped: number;
    pending: number;
    completionPercent: number;
  };
  walks: {
    count: number;
    totalMinutes: number;
    averageMinutes: number;
    distanceMiles: number;
    dogInteractions: number;
  };
  water: {
    logs: number;
    refillEquivalent: number;
    days: number;
  };
  potty: {
    total: number;
    watchCount: number;
  };
  medication: {
    total: number;
    taken: number;
    skipped: number;
  };
  health: {
    watchCount: number;
  };
}

export interface CareTrendDeltas {
  totalLogs: number;
  walkMinutes: number;
  waterRefills: number;
  pottyWatch: number;
  mealCompletionPercent: number;
}

export interface CareTrendSignal {
  kind: CareTrendSignalKind;
  label: string;
  detail: string;
  tone: CareTrendTone;
  action: string;
}

export interface CareTrends {
  windowDays: number;
  current: CareTrendWindow;
  previous: CareTrendWindow;
  deltas: CareTrendDeltas;
  summary: string;
  highlights: string[];
  signals: CareTrendSignal[];
  nextStep: string;
}

const WATER_FACTORS: Record<string, number> = {
  sip: 0.25,
  sips: 0.25,
  drink: 0.5,
  drank: 0.5,
  half: 0.5,
  topup: 0.5,
  "top-up": 0.5,
  bowl: 1,
  full: 1,
  refill: 1,
  fresh: 1,
};

const REVIEW_STOOL_COLORS = new Set([
  "yellow",
  "red",
  "red-black",
  "red/black",
  "black",
  "black-tarry",
  "black tarry",
  "gray",
  "grey",
  "white",
]);

const REVIEW_CONTEXTS = new Set(["accident", "urgent", "straining"]);

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function asObject(value: CareEventDetails): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function roundAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatAmount(value: number): string {
  const rounded = roundAmount(value);
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, "").replace(/\.$/, "");
}

function visible(entry: CareTrendsEntry): boolean {
  return isHouseholdVisibleCareEvidence(entry);
}

function timeFor(entry: CareTrendsEntry): number {
  const time = new Date(clean(entry.occurredAt)).getTime();
  return Number.isFinite(time) ? time : Number.NaN;
}

function inWindow(entry: CareTrendsEntry, now: number, windowDays: number, offsetDays: number): boolean {
  const time = timeFor(entry);
  if (!Number.isFinite(time)) return false;
  const end = now - offsetDays * 86400000;
  const start = end - windowDays * 86400000;
  return time > start && time <= end;
}

function dayKey(entry: CareTrendsEntry): string {
  const time = timeFor(entry);
  if (!Number.isFinite(time)) return "";
  const date = new Date(time);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function waterKind(entry: CareTrendsEntry): string {
  const details = asObject(entry.details);
  const explicit = clean(details.waterAmount ?? details.amount ?? entry.amount).toLowerCase();
  if (explicit) return explicit.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const title = clean(entry.title).toLowerCase();
  if (title.includes("sip")) return "sip";
  if (title.includes("refill") || title.includes("fresh")) return "refill";
  if (title.includes("bowl")) return "bowl";
  return "logged";
}

function waterRefillEquivalent(entry: CareTrendsEntry): number {
  return WATER_FACTORS[waterKind(entry)] ?? 0.5;
}

function mealOutcome(entry: CareTrendsEntry): "complete" | "partial" | "skipped" | "pending" | "logged" {
  const details = asObject(entry.details);
  const outcome = clean(details.mealCompletion ?? details.completion ?? details.outcome ?? details.status).toLowerCase();
  const lifecycle = clean(details.mealLifecycle).toLowerCase();
  const portion = clean(details.portion).toLowerCase();
  if (
    ["served", "pending", "outcome-pending", "still grazing", "grazing"].includes(outcome) ||
    ["served", "pending", "outcome-pending", "still grazing", "grazing"].includes(lifecycle)
  ) {
    return "pending";
  }
  if (["skip", "skipped", "missed", "refused"].includes(outcome) || portion === "skipped") return "skipped";
  if (["partial", "some", "half", "ate some"].includes(outcome)) return "partial";
  if (["complete", "completed", "full", "ate it", "ate all", "ate most", "most", "done"].includes(outcome) || portion === "full") return "complete";
  return "logged";
}

function medicationSkipped(entry: CareTrendsEntry): boolean {
  const details = asObject(entry.details);
  const outcome = clean(details.medicationOutcome ?? details.outcome ?? details.status).toLowerCase();
  return ["skip", "skipped", "missed", "not taken", "held"].includes(outcome);
}

function pottyNeedsReview(entry: CareTrendsEntry): boolean {
  const details = asObject(entry.details);
  const severity = clean(entry.severity).toLowerCase();
  const condition = clean(details.condition ?? details.stoolCondition).toLowerCase();
  const stoolColor = clean(details.stoolColor ?? details.color).toLowerCase();
  const context = clean(details.pottyContext ?? details.context).toLowerCase();
  if (["alert", "urgent", "watch"].includes(severity)) return true;
  if (REVIEW_STOOL_COLORS.has(stoolColor)) return true;
  if (REVIEW_CONTEXTS.has(context)) return true;
  return Boolean(condition && !["normal", "not logged", "not-logged"].includes(condition));
}

function isHealthWatch(entry: CareTrendsEntry): boolean {
  const type = normalizeCareEventType(entry.type, entry.details);
  const severity = clean(entry.severity).toLowerCase();
  return type === "vomit" || type === "symptom" || ["watch", "alert", "urgent"].includes(severity);
}

function emptyWindow(): CareTrendWindow {
  return {
    totalLogs: 0,
    loggedDays: 0,
    caregiverCount: 0,
    caregivers: [],
    topCaregiver: null,
    meals: { total: 0, complete: 0, partial: 0, skipped: 0, pending: 0, completionPercent: 0 },
    walks: { count: 0, totalMinutes: 0, averageMinutes: 0, distanceMiles: 0, dogInteractions: 0 },
    water: { logs: 0, refillEquivalent: 0, days: 0 },
    potty: { total: 0, watchCount: 0 },
    medication: { total: 0, taken: 0, skipped: 0 },
    health: { watchCount: 0 },
  };
}

function summarizeWindow(entries: readonly CareTrendsEntry[]): CareTrendWindow {
  const result = emptyWindow();
  const days = new Set<string>();
  const waterDays = new Set<string>();
  const caregiverCounts = new Map<string, number>();

  for (const entry of entries) {
    const type = normalizeCareEventType(entry.type, entry.details);
    const caregiver = clean(entry.caregiver) || "Household";
    const key = dayKey(entry);
    result.totalLogs += 1;
    if (key) days.add(key);
    if (!result.caregivers.includes(caregiver)) result.caregivers.push(caregiver);
    caregiverCounts.set(caregiver, (caregiverCounts.get(caregiver) ?? 0) + 1);

    if (type === "meal") {
      result.meals.total += 1;
      const outcome = mealOutcome(entry);
      if (outcome === "complete") result.meals.complete += 1;
      if (outcome === "partial") result.meals.partial += 1;
      if (outcome === "skipped") result.meals.skipped += 1;
      if (outcome === "pending") result.meals.pending += 1;
    }

    if (type === "walk") {
      const details = asObject(entry.details);
      result.walks.count += 1;
      result.walks.totalMinutes += Math.max(0, Math.round(asNumber(entry.durationMinutes ?? details.durationMinutes)));
      result.walks.distanceMiles = roundAmount(result.walks.distanceMiles + Math.max(0, asNumber(details.distanceMiles ?? details.distance ?? details.miles)));
      result.walks.dogInteractions += Math.max(0, Math.round(asNumber(entry.dogInteractions ?? details.dogInteractions)));
    }

    if (type === "water") {
      result.water.logs += 1;
      result.water.refillEquivalent = roundAmount(result.water.refillEquivalent + waterRefillEquivalent(entry));
      if (key) waterDays.add(key);
    }

    if (type === "potty") {
      result.potty.total += 1;
      if (pottyNeedsReview(entry)) result.potty.watchCount += 1;
    }

    if (type === "medication") {
      result.medication.total += 1;
      if (medicationSkipped(entry)) result.medication.skipped += 1;
      else result.medication.taken += 1;
    }

    if (isHealthWatch(entry)) result.health.watchCount += 1;
  }

  result.loggedDays = days.size;
  result.caregiverCount = result.caregivers.length;
  result.water.days = waterDays.size;
  result.walks.averageMinutes = result.walks.count > 0 ? Math.round(result.walks.totalMinutes / result.walks.count) : 0;
  result.meals.completionPercent = result.meals.total > 0 ? Math.round((result.meals.complete / result.meals.total) * 100) : 0;
  const top = Array.from(caregiverCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  result.topCaregiver = top ? { name: top[0], count: top[1] } : null;
  return result;
}

function plural(value: number, noun: string): string {
  return `${value} ${noun}${value === 1 ? "" : "s"}`;
}

function buildHighlights(current: CareTrendWindow, deltas: CareTrendDeltas): string[] {
  if (current.totalLogs === 0) return [];
  const highlights = [
    `${current.totalLogs} visible care logs over ${current.loggedDays} ${current.loggedDays === 1 ? "day" : "days"}`,
  ];
  if (current.walks.totalMinutes > 0) {
    const delta = deltas.walkMinutes === 0 ? "" : ` (${deltas.walkMinutes > 0 ? "+" : ""}${deltas.walkMinutes} vs prior window)`;
    highlights.push(`${current.walks.totalMinutes} walk minutes this week${delta}`);
  }
  if (current.meals.total > 0) {
    const pending = current.meals.pending
      ? `, ${current.meals.pending} pending outcome${current.meals.pending === 1 ? "" : "s"}`
      : "";
    highlights.push(`Meals: ${current.meals.complete} complete, ${current.meals.partial} partial, ${current.meals.skipped} skipped${pending}`);
  }
  if (current.water.logs > 0) {
    highlights.push(`${formatAmount(current.water.refillEquivalent)} bowl ${current.water.refillEquivalent === 1 ? "refill" : "refills"} tracked`);
  }
  return highlights;
}

function buildSignals(current: CareTrendWindow, deltas: CareTrendDeltas): CareTrendSignal[] {
  const signals: CareTrendSignal[] = [];
  const mealWatch = current.meals.partial + current.meals.skipped + current.meals.pending;
  if (mealWatch > 0) {
    const pendingLabel = `${current.meals.pending} outcome${current.meals.pending === 1 ? "" : "s"} pending`;
    signals.push({
      kind: "meal-watch",
      label: "Meal follow-up",
      detail: `${current.meals.partial} partial, ${current.meals.skipped} skipped, and ${pendingLabel} this week.`,
      tone: "watch",
      action: "Keep logging served and eaten amounts; update served meal outcomes before treating the week as resolved.",
    });
  }
  if (current.potty.watchCount > 0) {
    signals.push({
      kind: "potty-watch",
      label: "Potty watch",
      detail: `${plural(current.potty.watchCount, "potty log")} ${current.potty.watchCount === 1 ? "needs" : "need"} stool review this week.`,
      tone: "watch",
      action: "Capture stool detail, color, food changes, hydration, and energy for review.",
    });
  }
  if (current.medication.skipped > 0) {
    signals.push({
      kind: "medication-watch",
      label: "Medication watch",
      detail: `${plural(current.medication.skipped, "skipped medication log")} this week.`,
      tone: "watch",
      action: "Confirm whether the dose was intentionally held and leave a household note.",
    });
  }
  if (current.health.watchCount > 0) {
    signals.push({
      kind: "health-watch",
      label: "Health watch",
      detail: `${plural(current.health.watchCount, "health watch log")} this week.`,
      tone: "watch",
      action: "Use this as owner-reported context and contact a vet for red flags or repeated symptoms.",
    });
  }
  if (current.walks.totalMinutes > 0 && deltas.walkMinutes <= -20) {
    signals.push({
      kind: "activity-change",
      label: "Activity dip",
      detail: `${Math.abs(deltas.walkMinutes)} fewer walk minutes than the prior window.`,
      tone: "info",
      action: "Check schedule, weather, energy, and any recovery notes before changing activity.",
    });
  }
  if (current.totalLogs > 0 && signals.length === 0) {
    signals.push({
      kind: "care-consistency",
      label: "Care consistency",
      detail: `${current.totalLogs} shared logs with no active watch signals in this window.`,
      tone: "good",
      action: "Keep logging the core routine so future changes are easier to spot.",
    });
  }
  return signals;
}

export function deriveCareTrends(input: CareTrendsInput): CareTrends {
  const now = input.now ?? Date.now();
  const windowDays = input.windowDays ?? 7;
  const visibleEntries = input.entries.filter(visible);
  const currentEntries = visibleEntries.filter((entry) => inWindow(entry, now, windowDays, 0));
  const previousEntries = visibleEntries.filter((entry) => inWindow(entry, now, windowDays, windowDays));
  const current = summarizeWindow(currentEntries);
  const previous = summarizeWindow(previousEntries);
  const deltas: CareTrendDeltas = {
    totalLogs: current.totalLogs - previous.totalLogs,
    walkMinutes: current.walks.totalMinutes - previous.walks.totalMinutes,
    waterRefills: roundAmount(current.water.refillEquivalent - previous.water.refillEquivalent),
    pottyWatch: current.potty.watchCount - previous.potty.watchCount,
    mealCompletionPercent: current.meals.completionPercent - previous.meals.completionPercent,
  };
  const highlights = buildHighlights(current, deltas);
  const signals = buildSignals(current, deltas);

  return {
    windowDays,
    current,
    previous,
    deltas,
    summary:
      current.totalLogs === 0
        ? `No shared care logs in the last ${windowDays} days`
        : `${current.totalLogs} visible care logs over ${current.loggedDays} ${current.loggedDays === 1 ? "day" : "days"} - ${current.caregiverCount} ${current.caregiverCount === 1 ? "caregiver" : "caregivers"}, ${current.walks.totalMinutes} walk minutes, ${current.meals.completionPercent}% meal completion${current.meals.pending ? `, ${current.meals.pending} outcome${current.meals.pending === 1 ? "" : "s"} pending` : ""}.`,
    highlights,
    signals,
    nextStep:
      current.totalLogs === 0
        ? "Start with meals, water, walks, potty, and medication logs so WoofWatcher can build a trustworthy trend baseline."
        : signals.some((signal) => signal.tone === "watch" || signal.tone === "alert")
          ? "Review watch signals, add missing context, and share a Care Pass if a sitter, trainer, or vet needs the pattern."
          : "Keep logging the core care loop so household patterns stay easy to review.",
  };
}
