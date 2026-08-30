import { normalizeCareEventType, type CareEventDetails } from "./events.ts";
import { isHouseholdVisibleCareEvidence } from "./shared-evidence.ts";

export type TrainingProgressStatus = "needs-log" | "building" | "steady" | "needs-practice";
export type TrainingOutcome = "win" | "practice" | "struggle";

export interface TrainingProgressEntry {
  id?: string;
  type?: string | null;
  title?: string | null;
  caregiver?: string | null;
  occurredAt?: string | null;
  durationMinutes?: number | null;
  dogInteractions?: number | null;
  note?: string | null;
  details?: CareEventDetails;
}

export interface TrainingProgressInput {
  entries: readonly TrainingProgressEntry[];
  now?: number;
  lookbackDays?: number;
  limit?: number;
}

export interface TrainingProgressItem {
  id: string;
  label: string;
  caregiver: string;
  occurredAt: string;
  durationMinutes: number;
  skill: string;
  cue: string;
  outcome: TrainingOutcome;
  trigger: string;
  nextPractice: string;
  dogInteractions: number;
  note: string;
}

export interface TrainingProgress {
  items: TrainingProgressItem[];
  totalSessions: number;
  totalMinutes: number;
  winCount: number;
  practiceCount: number;
  struggleCount: number;
  dogInteractions: number;
  skillCount: number;
  focusSkills: string[];
  caregivers: string[];
  status: TrainingProgressStatus;
  summary: string;
  nextStep: string;
  latest: TrainingProgressItem | null;
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

function isVisible(entry: TrainingProgressEntry): boolean {
  return isHouseholdVisibleCareEvidence(entry);
}

function isInLookback(iso: string | null | undefined, now: number, lookbackDays: number): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time) || time > now) return false;
  return now - time <= lookbackDays * 86400000;
}

function trainingSkill(entry: TrainingProgressEntry): string {
  const details = asObject(entry.details);
  return (
    clean(details.trainingSkill) ||
    clean(details.skill) ||
    clean(details.focus) ||
    clean(details.cue) ||
    clean(entry.title) ||
    "Training"
  );
}

function trainingOutcome(entry: TrainingProgressEntry): TrainingOutcome {
  const details = asObject(entry.details);
  const value = clean(details.trainingOutcome ?? details.outcome ?? details.status).toLowerCase();
  if (["win", "success", "successful", "nailed-it", "nailed it", "done"].includes(value)) return "win";
  if (["struggle", "struggled", "hard", "challenge", "challenging", "setback"].includes(value)) return "struggle";
  return "practice";
}

function countLabel(value: number, noun: string): string {
  return `${value} ${noun}${value === 1 ? "" : "s"}`;
}

function statusFor(total: number, winCount: number, struggleCount: number): TrainingProgressStatus {
  if (total === 0) return "needs-log";
  if (struggleCount > 0) return "needs-practice";
  if (winCount > 0 || total >= 2) return "steady";
  return "building";
}

function nextStepFor(status: TrainingProgressStatus, latest: TrainingProgressItem | null): string {
  if (status === "needs-log") {
    return "Log the next short training session with skill, outcome, trigger, and next-practice notes so the household can keep progress consistent.";
  }
  if (status === "needs-practice") {
    return "Review the struggle notes, keep sessions short, and share this context before the next trainer or caregiver session.";
  }
  if (latest?.nextPractice) {
    return `Next practice: ${latest.nextPractice}`;
  }
  if (status === "steady") {
    return "Keep sessions short, repeat the strongest cues, and log the next practice note so progress stays visible.";
  }
  return "Pick one skill for the next session and log whether it was a win, practice, or struggle.";
}

export function deriveTrainingProgress(input: TrainingProgressInput): TrainingProgress {
  const now = input.now ?? Date.now();
  const lookbackDays = input.lookbackDays ?? 30;
  const limit = input.limit ?? 6;
  const items = input.entries
    .filter((entry) => normalizeCareEventType(entry.type, entry.details) === "training")
    .filter(isVisible)
    .filter((entry) => isInLookback(entry.occurredAt, now, lookbackDays))
    .map((entry, index): TrainingProgressItem => {
      const details = asObject(entry.details);
      return {
        id: clean(entry.id) || `training_${index}`,
        label: clean(entry.title) || trainingSkill(entry),
        caregiver: clean(entry.caregiver) || "Household",
        occurredAt: clean(entry.occurredAt),
        durationMinutes: Math.max(0, Math.round(asNumber(entry.durationMinutes ?? details.durationMinutes))),
        skill: trainingSkill(entry),
        cue: clean(details.cue),
        outcome: trainingOutcome(entry),
        trigger: clean(details.trigger ?? details.context),
        nextPractice: clean(details.nextPractice ?? details.nextStep),
        dogInteractions: Math.max(0, Math.round(asNumber(entry.dogInteractions ?? details.dogInteractions))),
        note: clean(details.note) || clean(entry.note),
      };
    })
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  const totalSessions = items.length;
  const totalMinutes = items.reduce((sum, item) => sum + item.durationMinutes, 0);
  const winCount = items.filter((item) => item.outcome === "win").length;
  const practiceCount = items.filter((item) => item.outcome === "practice").length;
  const struggleCount = items.filter((item) => item.outcome === "struggle").length;
  const dogInteractions = items.reduce((sum, item) => sum + item.dogInteractions, 0);
  const focusSkills = Array.from(new Set(items.map((item) => item.skill).filter(Boolean)));
  const caregivers = Array.from(new Set(items.map((item) => item.caregiver).filter(Boolean)));
  const status = statusFor(totalSessions, winCount, struggleCount);
  const latest = items[0] ?? null;

  return {
    items: items.slice(0, Math.max(0, limit)),
    totalSessions,
    totalMinutes,
    winCount,
    practiceCount,
    struggleCount,
    dogInteractions,
    skillCount: focusSkills.length,
    focusSkills,
    caregivers,
    status,
    summary:
      totalSessions === 0
        ? `No shared training sessions logged in the last ${lookbackDays} days`
        : `${countLabel(totalSessions, "training session")} in the last ${lookbackDays} days - ${countLabel(totalMinutes, "practice minute")}, ${countLabel(focusSkills.length, "skill")}, ${countLabel(winCount, "win")}.`,
    nextStep: nextStepFor(status, latest),
    latest,
  };
}
