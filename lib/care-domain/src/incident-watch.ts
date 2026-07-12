import { normalizeCareEventType, type CareEventDetails } from "./events.ts";
import { resolvePetName } from "./pet-identity.ts";

export type IncidentWatchStatus = "clear" | "watch" | "review";
export type IncidentWatchTrendDirection = "clear" | "improving" | "steady" | "rising";
export type IncidentFollowUpTone = "steady" | "watch" | "review";

export interface IncidentWatchEntry {
  id?: string;
  type?: string | null;
  title?: string | null;
  caregiver?: string | null;
  occurredAt?: string | null;
  severity?: string | null;
  note?: string | null;
  details?: CareEventDetails;
}

export interface IncidentWatchInput {
  entries: readonly IncidentWatchEntry[];
  now?: number;
  lookbackDays?: number;
  limit?: number;
  /** Display name for owner-facing copy; resolved via resolvePetName so renamed dogs never read "Phoenix". */
  petName?: string | null;
}

export interface IncidentWatchItem {
  id: string;
  label: string;
  caregiver: string;
  occurredAt: string;
  kind: string;
  severity: "watch" | "alert";
  trigger: string;
  exposure: string;
  injuryLevel: string;
  actionTaken: string;
  followUp: string;
  note: string;
  needsFollowUp: boolean;
}

export interface IncidentTrendWindow {
  label: string;
  days: number;
  count: number;
  alertCount: number;
  followUpCount: number;
}

export interface IncidentWatchTrend {
  direction: IncidentWatchTrendDirection;
  label: string;
  detail: string;
  windows: IncidentTrendWindow[];
}

export interface IncidentFollowUpTask {
  id: string;
  label: string;
  detail: string;
  tone: IncidentFollowUpTone;
  priority: number;
  route: "log-incident" | "review-latest" | "trainer-care-pass";
}

export interface IncidentTrainerGoal {
  id: string;
  label: string;
  detail: string;
  evidence: string;
  status: "suggested" | "review";
}

export interface IncidentWatch {
  items: IncidentWatchItem[];
  totalIncidents: number;
  watchCount: number;
  alertCount: number;
  followUpCount: number;
  dogExposureCount: number;
  injuryCount: number;
  triggers: string[];
  exposures: string[];
  status: IncidentWatchStatus;
  summary: string;
  nextStep: string;
  latest: IncidentWatchItem | null;
  trend: IncidentWatchTrend;
  followUpTasks: IncidentFollowUpTask[];
  trainerGoals: IncidentTrainerGoal[];
}

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function lower(value: unknown): string {
  return clean(value).toLowerCase();
}

function asObject(value: CareEventDetails): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isVisible(entry: IncidentWatchEntry): boolean {
  return asObject(entry.details).householdVisible !== false;
}

function isInLookback(iso: string | null | undefined, now: number, lookbackDays: number): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time) || time > now) return false;
  return now - time <= lookbackDays * 86400000;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(clean).filter(Boolean)));
}

function countLabel(value: number, noun: string): string {
  return `${value} ${noun}${value === 1 ? "" : "s"}`;
}

function daysAgo(iso: string, now: number): number {
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return Number.POSITIVE_INFINITY;
  return (now - time) / 86400000;
}

function itemsInWindow(items: readonly IncidentWatchItem[], now: number, days: number): IncidentWatchItem[] {
  return items.filter((item) => daysAgo(item.occurredAt, now) <= days);
}

function itemsBetween(items: readonly IncidentWatchItem[], now: number, minDays: number, maxDays: number): IncidentWatchItem[] {
  return items.filter((item) => {
    const age = daysAgo(item.occurredAt, now);
    return age > minDays && age <= maxDays;
  });
}

function itemKind(entry: IncidentWatchEntry): string {
  const details = asObject(entry.details);
  return (
    clean(details.incidentType) ||
    clean(details.kind) ||
    clean(details.what) ||
    clean(entry.title) ||
    "Incident"
  );
}

function hasInjury(injuryLevel: string, note: string): boolean {
  const value = lower(injuryLevel);
  if (!value || value === "none" || value === "no injury" || value === "not sure") return false;
  return (
    ["scratch", "scrape", "limp", "bleeding", "bite", "puncture", "injury"].some((term) => value.includes(term)) ||
    /\b(blood|bleed|limp|bite|puncture|scratch|injur|wound)\b/i.test(note)
  );
}

function itemSeverity(entry: IncidentWatchEntry, injuryLevel: string, followUp: string, note: string): "watch" | "alert" {
  const details = asObject(entry.details);
  const severity = lower(entry.severity ?? details.incidentSeverity ?? details.severity);
  const text = `${itemKind(entry)} ${injuryLevel} ${followUp} ${note}`.toLowerCase();
  if (
    severity === "alert" ||
    severity === "urgent" ||
    severity === "review" ||
    hasInjury(injuryLevel, note) ||
    /\b(bite|bit|puncture|blood|bleeding|injury|vet|emergency|escaped|missing)\b/.test(text)
  ) {
    return "alert";
  }
  return "watch";
}

function followUpNeeded(severity: "watch" | "alert", followUp: string, injuryLevel: string, note: string): boolean {
  const follow = lower(followUp);
  if (severity === "alert") return true;
  if (!follow) return false;
  return !["none", "no", "not needed", "n/a"].includes(follow) || hasInjury(injuryLevel, note);
}

function statusFor(total: number, alertCount: number, followUpCount: number): IncidentWatchStatus {
  if (total === 0) return "clear";
  if (alertCount > 0 || followUpCount > 0) return "review";
  return "watch";
}

function nextStepFor(status: IncidentWatchStatus, petName: string): string {
  if (status === "clear") {
    return "If an altercation, bite, escape, rough greeting, or unusual reaction happens, log the trigger, exposure, injury check, and follow-up so the household has a trustworthy record.";
  }
  if (status === "review") {
    return "Review the latest incident with the household, add any missing injury or trigger notes, and consider sharing the pattern with a trainer or vet when safety, injury, or repeated reactions are involved.";
  }
  return `Watch for repeated triggers, keep notes factual, and use future walks or training sessions to capture what helps ${petName} recover calmly.`;
}

function trendWindow(label: string, days: number, items: readonly IncidentWatchItem[], now: number): IncidentTrendWindow {
  const windowItems = itemsInWindow(items, now, days);
  return {
    label,
    days,
    count: windowItems.length,
    alertCount: windowItems.filter((item) => item.severity === "alert").length,
    followUpCount: windowItems.filter((item) => item.needsFollowUp).length,
  };
}

function deriveTrend(items: readonly IncidentWatchItem[], now: number, lookbackDays: number, petName: string): IncidentWatchTrend {
  const current7 = itemsInWindow(items, now, 7).length;
  const previous7 = itemsBetween(items, now, 7, 14).length;
  const current30 = itemsInWindow(items, now, 30).length;
  const previous30 = itemsBetween(items, now, 30, 60).length;

  let direction: IncidentWatchTrendDirection = "steady";
  let label = "Steady watch";
  let detail = "Recent incident volume is not clearly rising. Keep logging factual context so the household can spot changes.";

  if (items.length === 0) {
    direction = "clear";
    label = "Clear";
    detail = "No household-visible incidents are logged in this window.";
  } else if ((current7 > previous7 && current7 > 0) || (current30 >= previous30 + 2 && current30 >= 2)) {
    direction = "rising";
    label = "Rising pattern";
    detail = "More incidents are appearing in the recent window. Review triggers and consider a trainer handoff if the pattern repeats.";
  } else if ((current7 === 0 && previous7 > 0) || (current30 < previous30 && previous30 > 0)) {
    direction = "improving";
    label = "Improving";
    detail = `Recent incident volume is lower than the prior window. Keep noting what helped ${petName} recover calmly.`;
  }

  return {
    direction,
    label,
    detail,
    windows: [
      trendWindow("7 days", 7, items, now),
      trendWindow("30 days", 30, items, now),
      trendWindow(`${lookbackDays} days`, lookbackDays, items, now),
    ],
  };
}

function latestMissingDetails(latest: IncidentWatchItem | null): string[] {
  if (!latest) return [];
  return [
    latest.trigger ? "" : "trigger",
    latest.exposure ? "" : "exposure",
    latest.injuryLevel ? "" : "injury check",
    latest.actionTaken ? "" : "action taken",
    latest.followUp ? "" : "follow-up",
  ].filter(Boolean);
}

function deriveFollowUpTasks(input: {
  status: IncidentWatchStatus;
  latest: IncidentWatchItem | null;
  alertCount: number;
  followUpCount: number;
  dogExposureCount: number;
  injuryCount: number;
  triggers: readonly string[];
  trend: IncidentWatchTrend;
}): IncidentFollowUpTask[] {
  const tasks: IncidentFollowUpTask[] = [];
  const missing = latestMissingDetails(input.latest);

  if (missing.length > 0) {
    tasks.push({
      id: "complete-latest-incident",
      label: "Complete latest details",
      detail: `Add ${missing.slice(0, 3).join(", ")} so the household record is useful later.`,
      tone: "watch",
      priority: 1,
      route: "review-latest",
    });
  }

  if (input.alertCount > 0 || input.injuryCount > 0) {
    tasks.push({
      id: "household-safety-review",
      label: "Household safety review",
      detail: "Review what happened, check injury notes, and decide whether to share the pattern with a trainer or vet.",
      tone: "review",
      priority: 2,
      route: "trainer-care-pass",
    });
  }

  if (input.followUpCount > 0) {
    tasks.push({
      id: "close-open-follow-up",
      label: "Close open follow-up",
      detail: input.latest?.followUp
        ? `Latest follow-up: ${input.latest.followUp}`
        : "Assign the next calm practice or recovery note to a household member.",
      tone: input.status === "review" ? "review" : "watch",
      priority: 3,
      route: "log-incident",
    });
  }

  if (input.dogExposureCount >= 2 || input.trend.direction === "rising") {
    tasks.push({
      id: "trainer-pattern-handoff",
      label: "Prep trainer handoff",
      detail: "Use the trigger and exposure notes to ask a trainer for owner-reviewed practice steps.",
      tone: "watch",
      priority: 4,
      route: "trainer-care-pass",
    });
  }

  if (tasks.length === 0) {
    tasks.push({
      id: "keep-context-ready",
      label: "Keep context ready",
      detail: "If another reaction happens, log trigger, distance, body language, injury check, and recovery while it is fresh.",
      tone: "steady",
      priority: 5,
      route: "log-incident",
    });
  }

  return tasks.sort((a, b) => a.priority - b.priority).slice(0, 4);
}

function includesAny(values: readonly string[], terms: readonly string[]): boolean {
  const text = values.join(" ").toLowerCase();
  return terms.some((term) => text.includes(term));
}

function deriveTrainerGoals(input: {
  items: readonly IncidentWatchItem[];
  triggers: readonly string[];
  exposures: readonly string[];
  dogExposureCount: number;
  injuryCount: number;
  petName: string;
}): IncidentTrainerGoal[] {
  const goals: IncidentTrainerGoal[] = [];
  const evidenceBase = `${countLabel(input.items.length, "incident")} in the review window`;

  if (input.dogExposureCount > 0 || includesAny(input.exposures, ["dog", "puppy", "leash", "park"])) {
    goals.push({
      id: "calm-dog-passes",
      label: "Calm dog passes",
      detail: "Practice distance, loose-leash disengage, and recovery notes with trainer review.",
      evidence: `${input.dogExposureCount || 1} dog-exposure context${input.dogExposureCount === 1 ? "" : "s"} logged.`,
      status: "suggested",
    });
  }

  if (includesAny(input.triggers, ["gate", "fence", "door", "threshold", "window"])) {
    goals.push({
      id: "threshold-calm",
      label: "Gate and threshold calm",
      detail: "Track arrivals, exits, and fence-line moments so the household knows what setup helps.",
      evidence: `Trigger notes include ${input.triggers.slice(0, 3).join(", ")}.`,
      status: "suggested",
    });
  }

  if (includesAny([...input.triggers, ...input.exposures], ["toy", "food", "bowl", "guard", "resource"])) {
    goals.push({
      id: "resource-space",
      label: "Trade and space practice",
      detail: "Record guarding context factually and ask a trainer to review safe household setup.",
      evidence: "Resource or object context appears in incident notes.",
      status: "review",
    });
  }

  if (input.injuryCount > 0) {
    goals.push({
      id: "injury-safety-review",
      label: "Safety management review",
      detail: "Keep injury checks and separation steps visible before planning future exposure practice.",
      evidence: `${countLabel(input.injuryCount, "injury check")} noted.`,
      status: "review",
    });
  }

  if (goals.length === 0 && input.items.length > 0) {
    goals.push({
      id: "recovery-baseline",
      label: "Recovery baseline",
      detail: `Track what helped ${input.petName} settle after each reaction so the care team can repeat what works.`,
      evidence: evidenceBase,
      status: "suggested",
    });
  }

  return goals.slice(0, 4);
}

export function deriveIncidentWatch(input: IncidentWatchInput): IncidentWatch {
  const now = input.now ?? Date.now();
  const lookbackDays = input.lookbackDays ?? 90;
  const limit = input.limit ?? 6;
  const petName = resolvePetName(input.petName);
  const allItems = input.entries
    .filter((entry) => normalizeCareEventType(entry.type, entry.details) === "incident")
    .filter(isVisible)
    .filter((entry) => isInLookback(entry.occurredAt, now, lookbackDays))
    .map((entry, index): IncidentWatchItem => {
      const details = asObject(entry.details);
      const note = clean(details.note) || clean(entry.note);
      const injuryLevel = clean(details.incidentInjury ?? details.injuryLevel ?? details.injury);
      const followUp = clean(details.incidentFollowUp ?? details.followUp ?? details.nextStep);
      const severity = itemSeverity(entry, injuryLevel, followUp, note);
      return {
        id: clean(entry.id) || `incident_${index}`,
        label: clean(entry.title) || itemKind(entry),
        caregiver: clean(entry.caregiver) || "Household",
        occurredAt: clean(entry.occurredAt),
        kind: itemKind(entry),
        severity,
        trigger: clean(details.incidentTrigger ?? details.trigger ?? details.context),
        exposure: clean(details.incidentExposure ?? details.exposure ?? details.involved ?? details.dogExposure),
        injuryLevel,
        actionTaken: clean(details.incidentAction ?? details.actionTaken ?? details.response),
        followUp,
        note,
        needsFollowUp: followUpNeeded(severity, followUp, injuryLevel, note),
      };
    })
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  const totalIncidents = allItems.length;
  const alertCount = allItems.filter((item) => item.severity === "alert").length;
  const followUpCount = allItems.filter((item) => item.needsFollowUp).length;
  const dogExposureCount = allItems.filter((item) => /dog|puppy|leash|park|gate/i.test(item.exposure)).length;
  const injuryCount = allItems.filter((item) => hasInjury(item.injuryLevel, item.note)).length;
  const status = statusFor(totalIncidents, alertCount, followUpCount);
  const triggers = unique(allItems.map((item) => item.trigger));
  const exposures = unique(allItems.map((item) => item.exposure));
  const trend = deriveTrend(allItems, now, lookbackDays, petName);
  const latest = allItems[0] ?? null;

  return {
    items: allItems.slice(0, Math.max(0, limit)),
    totalIncidents,
    watchCount: Math.max(0, totalIncidents - alertCount),
    alertCount,
    followUpCount,
    dogExposureCount,
    injuryCount,
    triggers,
    exposures,
    status,
    summary:
      totalIncidents === 0
        ? `No household-visible incidents logged in the last ${lookbackDays} days.`
        : `${countLabel(totalIncidents, "incident")} in the last ${lookbackDays} days - ${countLabel(alertCount, "review alert")}, ${countLabel(followUpCount, "follow-up")}.`,
    nextStep: nextStepFor(status, petName),
    latest,
    trend,
    followUpTasks: deriveFollowUpTasks({ status, latest, alertCount, followUpCount, dogExposureCount, injuryCount, triggers, trend }),
    trainerGoals: deriveTrainerGoals({ items: allItems, triggers, exposures, dogExposureCount, injuryCount, petName }),
  };
}
