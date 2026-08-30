import { normalizeCareEventType, type CareEventDetails } from "./events.ts";
import { isHouseholdVisibleCareEvidence } from "./shared-evidence.ts";

export type AloneTimeStatus = "needs-log" | "steady" | "watch" | "needs-support";
export type AloneTimeOutcome = "calm" | "settled" | "anxious" | "distressed";

export interface AloneTimeEntry {
  id?: string;
  type?: string | null;
  title?: string | null;
  caregiver?: string | null;
  occurredAt?: string | null;
  durationMinutes?: number | null;
  mood?: string | null;
  severity?: string | null;
  note?: string | null;
  details?: CareEventDetails;
}

export interface AloneTimeInput {
  entries: readonly AloneTimeEntry[];
  now?: number;
  lookbackDays?: number;
  limit?: number;
}

export interface AloneTimeItem {
  id: string;
  label: string;
  caregiver: string;
  occurredAt: string;
  durationMinutes: number;
  outcome: AloneTimeOutcome;
  trigger: string;
  calmingSupport: string;
  recoveryMinutes: number;
  note: string;
}

export interface AloneTimeSummary {
  items: AloneTimeItem[];
  totalSessions: number;
  totalMinutes: number;
  calmCount: number;
  anxiousCount: number;
  distressedCount: number;
  averageRecoveryMinutes: number;
  triggers: string[];
  supports: string[];
  caregivers: string[];
  status: AloneTimeStatus;
  summary: string;
  nextStep: string;
  latest: AloneTimeItem | null;
}

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

function isVisible(entry: AloneTimeEntry): boolean {
  return isHouseholdVisibleCareEvidence(entry);
}

function isInLookback(iso: string | null | undefined, now: number, lookbackDays: number): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time) || time > now) return false;
  return now - time <= lookbackDays * 86400000;
}

function isAloneEntry(entry: AloneTimeEntry): boolean {
  const details = asObject(entry.details);
  const type = normalizeCareEventType(entry.type, details);
  if (type === "alone") return true;
  const mood = clean(entry.mood ?? details.mood).toLowerCase();
  return type === "mood" && ["anxious", "anxiety"].includes(mood) && Boolean(clean(details.aloneContext));
}

function aloneOutcome(entry: AloneTimeEntry): AloneTimeOutcome {
  const details = asObject(entry.details);
  const value = clean(details.aloneOutcome ?? details.outcome ?? details.status ?? entry.mood).toLowerCase();
  if (["distressed", "panic", "panicked", "destructive", "barking", "howling"].includes(value)) return "distressed";
  if (["anxious", "anxiety", "nervous", "paced", "restless", "watch"].includes(value)) return "anxious";
  if (["settled", "slept", "rested"].includes(value)) return "settled";
  return "calm";
}

function countLabel(value: number, noun: string): string {
  return `${value} ${noun}${value === 1 ? "" : "s"}`;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(clean).filter(Boolean)));
}

function statusFor(total: number, anxiousCount: number, distressedCount: number): AloneTimeStatus {
  if (total === 0) return "needs-log";
  if (distressedCount > 0 || anxiousCount >= 2) return "needs-support";
  if (anxiousCount > 0) return "watch";
  return "steady";
}

function nextStepFor(status: AloneTimeStatus): string {
  if (status === "needs-log") {
    return "Log the next departure with duration, return mood, trigger, calming support, and recovery time so the household can learn what helps.";
  }
  if (status === "needs-support") {
    return "Review trigger and recovery notes, keep departures predictable, and share the pattern with a trainer or vet if distress keeps repeating.";
  }
  if (status === "watch") {
    return "Repeat the strongest calming support, shorten the next alone interval if needed, and log recovery after return.";
  }
  return "Keep logging departures, returns, and calming supports so the household can keep the routine predictable.";
}

export function deriveAloneTime(input: AloneTimeInput): AloneTimeSummary {
  const now = input.now ?? Date.now();
  const lookbackDays = input.lookbackDays ?? 30;
  const limit = input.limit ?? 6;
  const items = input.entries
    .filter(isAloneEntry)
    .filter(isVisible)
    .filter((entry) => isInLookback(entry.occurredAt, now, lookbackDays))
    .map((entry, index): AloneTimeItem => {
      const details = asObject(entry.details);
      return {
        id: clean(entry.id) || `alone_${index}`,
        label: clean(entry.title) || "Alone time",
        caregiver: clean(entry.caregiver) || "Household",
        occurredAt: clean(entry.occurredAt),
        durationMinutes: Math.max(0, Math.round(asNumber(entry.durationMinutes ?? details.durationMinutes))),
        outcome: aloneOutcome(entry),
        trigger: clean(details.aloneTrigger ?? details.trigger ?? details.context ?? details.aloneContext),
        calmingSupport: clean(details.calmingSupport ?? details.support ?? details.enrichment),
        recoveryMinutes: Math.max(0, Math.round(asNumber(details.recoveryMinutes ?? details.recoveryTime))),
        note: clean(details.note) || clean(entry.note),
      };
    })
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  const totalSessions = items.length;
  const totalMinutes = items.reduce((sum, item) => sum + item.durationMinutes, 0);
  const calmCount = items.filter((item) => item.outcome === "calm" || item.outcome === "settled").length;
  const anxiousCount = items.filter((item) => item.outcome === "anxious").length;
  const distressedCount = items.filter((item) => item.outcome === "distressed").length;
  const averageRecoveryMinutes = totalSessions
    ? Math.round(items.reduce((sum, item) => sum + item.recoveryMinutes, 0) / totalSessions)
    : 0;
  const triggers = unique(items.map((item) => item.trigger));
  const supports = unique(items.map((item) => item.calmingSupport));
  const caregivers = unique(items.map((item) => item.caregiver));
  const status = statusFor(totalSessions, anxiousCount, distressedCount);
  const latest = items[0] ?? null;

  return {
    items: items.slice(0, Math.max(0, limit)),
    totalSessions,
    totalMinutes,
    calmCount,
    anxiousCount,
    distressedCount,
    averageRecoveryMinutes,
    triggers,
    supports,
    caregivers,
    status,
    summary:
      totalSessions === 0
        ? `No shared alone-time logs in the last ${lookbackDays} days`
        : `${countLabel(totalSessions, "alone-time log")} in the last ${lookbackDays} days - ${countLabel(totalMinutes, "minute")} tracked, ${countLabel(anxiousCount + distressedCount, "watch return")}.`,
    nextStep: nextStepFor(status),
    latest,
  };
}
