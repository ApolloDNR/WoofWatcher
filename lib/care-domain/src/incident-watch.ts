import { normalizeCareEventType, type CareEventDetails } from "./events.ts";

export type IncidentWatchStatus = "clear" | "watch" | "review";

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

function nextStepFor(status: IncidentWatchStatus): string {
  if (status === "clear") {
    return "If an altercation, bite, escape, rough greeting, or unusual reaction happens, log the trigger, exposure, injury check, and follow-up so the household has a trustworthy record.";
  }
  if (status === "review") {
    return "Review the latest incident with the household, add any missing injury or trigger notes, and consider sharing the pattern with a trainer or vet when safety, injury, or repeated reactions are involved.";
  }
  return "Watch for repeated triggers, keep notes factual, and use future walks or training sessions to capture what helps Phoenix recover calmly.";
}

export function deriveIncidentWatch(input: IncidentWatchInput): IncidentWatch {
  const now = input.now ?? Date.now();
  const lookbackDays = input.lookbackDays ?? 90;
  const limit = input.limit ?? 6;
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

  return {
    items: allItems.slice(0, Math.max(0, limit)),
    totalIncidents,
    watchCount: Math.max(0, totalIncidents - alertCount),
    alertCount,
    followUpCount,
    dogExposureCount,
    injuryCount,
    triggers: unique(allItems.map((item) => item.trigger)),
    exposures: unique(allItems.map((item) => item.exposure)),
    status,
    summary:
      totalIncidents === 0
        ? `No household-visible incidents logged in the last ${lookbackDays} days.`
        : `${countLabel(totalIncidents, "incident")} in the last ${lookbackDays} days - ${countLabel(alertCount, "review alert")}, ${countLabel(followUpCount, "follow-up")}.`,
    nextStep: nextStepFor(status),
    latest: allItems[0] ?? null,
  };
}
