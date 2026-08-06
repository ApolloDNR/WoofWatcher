import { normalizeCareEventType, type CareEventDetails } from "./events.ts";
import { parseClockTime } from "./clock-time.ts";
import { getRecordDueStatus, type CareRecord } from "./record-vault.ts";

export type MedicationAdherenceStatus = "taken" | "missed" | "due" | "upcoming";
export type MedicationFollowUpKind = "missed" | "due" | "refill";
export type MedicationFollowUpUrgency = "alert" | "watch" | "info";
export type MedicationHistoryOutcome = "taken" | "skipped" | "missed" | "logged";
export type MedicationHistoryOutcomeFilter = MedicationHistoryOutcome | "attention" | "all";

export interface MedicationRoutine {
  id?: string;
  label: string;
  type: string;
  time: string;
  owner?: string | null;
  note?: string | null;
  dose?: string | null;
}

export interface MedicationEntry {
  id?: string;
  type: string;
  title?: string | null;
  caregiver?: string | null;
  occurredAt: string;
  note?: string | null;
  details?: CareEventDetails;
}

export interface MedicationAdherenceInput {
  routines: readonly MedicationRoutine[];
  entries: readonly MedicationEntry[];
  now?: number;
}

export interface MedicationFollowUpInput extends MedicationAdherenceInput {
  records?: readonly MedicationRecord[];
  refillDueSoonDays?: number;
}

export interface MedicationHistoryInput {
  entries: readonly MedicationEntry[];
  now?: number;
  days?: number;
  limit?: number;
  query?: string | null;
  outcome?: MedicationHistoryOutcomeFilter | null;
}

export interface MedicationAdherenceItem {
  id: string;
  label: string;
  time: string;
  owner: string;
  dose: string;
  status: MedicationAdherenceStatus;
  minutesFromNow: number;
  takenBy: string | null;
  takenAt: string | null;
  entryId: string | null;
}

export interface MedicationAdherence {
  items: MedicationAdherenceItem[];
  total: number;
  takenCount: number;
  missedCount: number;
  dueCount: number;
  upcomingCount: number;
  adherencePercent: number;
  next: MedicationAdherenceItem | null;
  summary: string;
}

export type MedicationRecord = Pick<
  CareRecord,
  "id" | "type" | "title" | "due" | "note" | "correctionIssues"
>;

export interface MedicationFollowUp {
  id: string;
  kind: MedicationFollowUpKind;
  label: string;
  detail: string;
  urgency: MedicationFollowUpUrgency;
  action: string;
  notificationRule: string;
  routineId?: string;
  recordId?: string;
  daysUntil?: number;
  dueDate?: string;
}

export interface MedicationHistoryItem {
  id: string;
  label: string;
  outcome: MedicationHistoryOutcome;
  statusLabel: string;
  dose: string;
  caregiver: string;
  occurredAt: string;
  routineId: string;
  note: string;
}

export interface MedicationHistory {
  items: MedicationHistoryItem[];
  total: number;
  unfilteredTotal: number;
  takenCount: number;
  skippedCount: number;
  missedCount: number;
  query: string;
  outcome: MedicationHistoryOutcomeFilter;
  hasActiveFilters: boolean;
  summary: string;
  emptyMessage: string;
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

function scheduledMs(routine: MedicationRoutine, now: number): number | null {
  const parsed = parseClockTime(routine.time);
  if (!parsed) return null;
  const d = new Date(now);
  d.setHours(0, parsed.minutesSinceMidnight, 0, 0);
  return d.getTime();
}

function entryRoutineId(entry: MedicationEntry): string {
  const id = entry.details?.routineId;
  return typeof id === "string" ? clean(id) : "";
}

function entryVisible(entry: MedicationEntry): boolean {
  return entry.details?.householdVisible !== false;
}

function entryDose(entry: MedicationEntry): string {
  const detailDose = entry.details?.dose ?? entry.details?.doseText ?? entry.details?.amount;
  return typeof detailDose === "string" ? clean(detailDose) : "";
}

function routineDose(routine: MedicationRoutine): string {
  return clean(routine.dose) || clean(routine.note) || "Dose not set";
}

function titleMatches(entry: MedicationEntry, routine: MedicationRoutine): boolean {
  const title = clean(entry.title).toLowerCase();
  const label = clean(routine.label).toLowerCase();
  return Boolean(title && label && (title.includes(label) || label.includes(title)));
}

function entryTaken(entry: MedicationEntry): boolean {
  const outcome = clean(entry.details?.medicationOutcome ?? entry.details?.outcome ?? entry.details?.status).toLowerCase();
  return !["skip", "skipped", "missed", "not taken", "held"].includes(outcome);
}

function entryOutcome(entry: MedicationEntry): MedicationHistoryOutcome {
  const outcome = clean(entry.details?.medicationOutcome ?? entry.details?.outcome ?? entry.details?.status).toLowerCase();
  if (["missed"].includes(outcome)) return "missed";
  if (["skip", "skipped", "not taken", "held"].includes(outcome)) return "skipped";
  if (outcome === "logged") return "logged";
  if (["", "taken", "complete", "completed"].includes(outcome)) return entryTaken(entry) ? "taken" : "logged";
  return "logged";
}

function statusLabel(outcome: MedicationHistoryOutcome): string {
  if (outcome === "taken") return "Taken";
  if (outcome === "skipped") return "Skipped";
  if (outcome === "missed") return "Missed";
  return "Logged";
}

function normalizeMedicationHistoryOutcomeFilter(value: unknown): MedicationHistoryOutcomeFilter {
  const normalized = clean(value).toLowerCase();
  if (normalized === "taken" || normalized === "skipped" || normalized === "missed" || normalized === "logged" || normalized === "attention") {
    return normalized;
  }
  return "all";
}

function medicationHistoryMatchesOutcome(item: MedicationHistoryItem, outcome: MedicationHistoryOutcomeFilter): boolean {
  if (outcome === "all") return true;
  if (outcome === "attention") return item.outcome === "skipped" || item.outcome === "missed";
  return item.outcome === outcome;
}

function medicationHistorySearchText(item: MedicationHistoryItem): string {
  return [
    item.label,
    item.outcome,
    item.statusLabel,
    item.dose,
    item.caregiver,
    item.occurredAt,
    item.routineId,
    item.note,
  ].join(" ").toLowerCase();
}

function entryNote(entry: MedicationEntry): string {
  const detailNote = entry.details?.note ?? entry.details?.notes ?? entry.details?.stickyNote;
  return clean(detailNote) || clean(entry.note);
}

function medicationRecord(record: MedicationRecord): boolean {
  const type = clean(record.type).toLowerCase();
  const title = clean(record.title).toLowerCase();
  return (
    normalizeCareEventType(type) === "medication" ||
    type.includes("med") ||
    title.includes("med") ||
    title.includes("refill") ||
    title.includes("prescription") ||
    title.includes("rx")
  );
}

function refillLabelBase(title: string): string {
  const cleaned = clean(title) || "Medication";
  return /\brefill\b/i.test(cleaned) ? cleaned : `${cleaned} refill`;
}

function statusFor(minutesFromNow: number, taken: boolean, skipped: boolean): MedicationAdherenceStatus {
  if (taken) return "taken";
  if (skipped) return "missed";
  if (minutesFromNow < -DUE_WINDOW_MINUTES) return "missed";
  if (Math.abs(minutesFromNow) <= DUE_WINDOW_MINUTES) return "due";
  return "upcoming";
}

export function deriveMedicationAdherence(input: MedicationAdherenceInput): MedicationAdherence {
  const now = input.now ?? Date.now();
  const routines = input.routines
    .filter((routine) => normalizeCareEventType(routine.type) === "medication")
    .map((routine) => ({ routine, routineMs: scheduledMs(routine, now) }))
    .filter((candidate): candidate is { routine: MedicationRoutine; routineMs: number } =>
      candidate.routineMs != null)
    .sort((a, b) => a.routineMs - b.routineMs);

  const candidates = input.entries
    .filter((entry) => isSameLocalDay(entry.occurredAt, now))
    .filter(entryVisible)
    .map((entry, index) => ({
      entry,
      key: entry.id ? `id:${entry.id}` : `index:${index}`,
      ms: new Date(entry.occurredAt).getTime(),
      normalizedType: normalizeCareEventType(entry.type, entry.details),
    }))
    .filter((candidate) => candidate.normalizedType === "medication")
    .sort((a, b) => a.ms - b.ms);

  const used = new Set<string>();
  const items = routines.map(({ routine, routineMs }, index): MedicationAdherenceItem => {
    const id = clean(routine.id) || `medication_${index}`;
    const exact = candidates.find(
      (candidate) => !used.has(candidate.key) && entryRoutineId(candidate.entry) === id,
    );
    const fuzzy =
      exact ??
      candidates.find((candidate) => {
        if (used.has(candidate.key)) return false;
        const linkedRoutineId = entryRoutineId(candidate.entry);
        if (linkedRoutineId && linkedRoutineId !== id) return false;
        const minutes = (candidate.ms - routineMs) / 60000;
        return minutes >= -DUE_WINDOW_MINUTES && minutes <= FUZZY_MATCH_WINDOW_MINUTES;
      }) ??
      candidates.find((candidate) => {
        if (used.has(candidate.key)) return false;
        const linkedRoutineId = entryRoutineId(candidate.entry);
        if (linkedRoutineId && linkedRoutineId !== id) return false;
        return titleMatches(candidate.entry, routine);
      });

    if (fuzzy) used.add(fuzzy.key);

    const minutesFromNow = Math.round((routineMs - now) / 60000);
    const taken = fuzzy ? entryTaken(fuzzy.entry) : false;
    const skipped = Boolean(fuzzy && !taken);
    const dose = fuzzy ? entryDose(fuzzy.entry) || routineDose(routine) : routineDose(routine);
    return {
      id,
      label: clean(routine.label) || "Medication",
      time: clean(routine.time) || "Time not set",
      owner: clean(routine.owner),
      dose,
      status: statusFor(minutesFromNow, taken, skipped),
      minutesFromNow,
      takenBy: fuzzy ? clean(fuzzy.entry.caregiver) || null : null,
      takenAt: fuzzy?.entry.occurredAt ?? null,
      entryId: fuzzy?.entry.id ?? null,
    };
  });

  const takenCount = items.filter((item) => item.status === "taken").length;
  const missedCount = items.filter((item) => item.status === "missed").length;
  const dueCount = items.filter((item) => item.status === "due").length;
  const upcomingCount = items.filter((item) => item.status === "upcoming").length;
  const total = items.length;

  return {
    items,
    total,
    takenCount,
    missedCount,
    dueCount,
    upcomingCount,
    adherencePercent: total > 0 ? Math.round((takenCount / total) * 100) : 100,
    next:
      items.find((item) => item.status === "missed") ??
      items.find((item) => item.status === "due") ??
      items.find((item) => item.status === "upcoming") ??
      null,
    summary: `${takenCount}/${total} medication doses logged today`,
  };
}

export function deriveMedicationFollowUps(input: MedicationFollowUpInput): MedicationFollowUp[] {
  const now = input.now ?? Date.now();
  const adherence = deriveMedicationAdherence({ ...input, now });
  const refillDueSoonDays = input.refillDueSoonDays ?? 14;

  const missed = adherence.items
    .filter((item) => item.status === "missed")
    .map((item): MedicationFollowUp => ({
      id: `routine_${item.id}_missed`,
      kind: "missed",
      label: `${item.label} missed`,
      detail: `${item.label} was not logged as taken for ${item.time}${item.owner ? ` by ${item.owner}` : ""}.`,
      urgency: "alert",
      action: "Confirm whether it was taken, skipped, or needs an owner follow-up note.",
      notificationRule: "Medication reminder candidate: missed dose follow-up after the routine window.",
      routineId: item.id,
    }));

  const due = adherence.items
    .filter((item) => item.status === "due")
    .map((item): MedicationFollowUp => ({
      id: `routine_${item.id}_due`,
      kind: "due",
      label: `${item.label} due now`,
      detail: `${item.label} is due at ${item.time}${item.owner ? ` with ${item.owner}` : ""}.`,
      urgency: "watch",
      action: "Log taken, partial, or skipped from the medication composer.",
      notificationRule: "Medication reminder candidate: due-time nudge at the routine time.",
      routineId: item.id,
    }));

  const refills = (input.records ?? [])
    .filter(medicationRecord)
    .flatMap((record): MedicationFollowUp[] => {
      const status = getRecordDueStatus(record, now, refillDueSoonDays);
      const title = clean(record.title) || "Medication";
      const refillTitle = refillLabelBase(title);
      if (status.status === "expired") {
        return [
          {
            id: `record_${record.id ?? title}_refill_overdue`,
            kind: "refill",
            label: `${refillTitle} overdue`,
            detail: status.date ? `${refillTitle} was due on ${status.date}.` : `${refillTitle} is overdue.`,
            urgency: "alert",
            action: "Request the refill and update the medication record when complete.",
            notificationRule: "Medication reminder candidate: overdue refill follow-up until the record is updated.",
            recordId: record.id,
            daysUntil: status.daysUntil,
            dueDate: status.date,
          },
        ];
      }
      if (status.status === "due_soon") {
        const days = status.daysUntil ?? 0;
        return [
          {
            id: `record_${record.id ?? title}_refill_due`,
            kind: "refill",
            label: `${refillTitle} due soon`,
            detail: status.date ? `${refillTitle} is due in ${days} days (${status.date}).` : `${refillTitle} is due soon.`,
            urgency: "watch",
            action: "Request or schedule the refill before it runs out.",
            notificationRule: "Medication reminder candidate: refill follow-up before the due date.",
            recordId: record.id,
            daysUntil: status.daysUntil,
            dueDate: status.date,
          },
        ];
      }
      return [];
    });

  const kindRank: Record<MedicationFollowUpKind, number> = { missed: 0, due: 1, refill: 2 };
  const urgencyRank: Record<MedicationFollowUpUrgency, number> = { alert: 0, watch: 1, info: 2 };
  return [...missed, ...due, ...refills].sort(
    (a, b) =>
      kindRank[a.kind] - kindRank[b.kind] ||
      urgencyRank[a.urgency] - urgencyRank[b.urgency] ||
      (a.daysUntil ?? 9999) - (b.daysUntil ?? 9999) ||
      a.label.localeCompare(b.label),
  );
}

export function deriveMedicationHistory(input: MedicationHistoryInput): MedicationHistory {
  const now = input.now ?? Date.now();
  const days = input.days ?? 30;
  const limit = input.limit ?? 6;
  const query = clean(input.query).toLowerCase();
  const queryTerms = query.split(/\s+/).filter(Boolean);
  const outcome = normalizeMedicationHistoryOutcomeFilter(input.outcome);
  const hasActiveFilters = Boolean(query || outcome !== "all");
  const allItems = input.entries
    .filter(entryVisible)
    .map((entry, index) => ({
      entry,
      id: clean(entry.id) || `medication_history_${index}`,
      ms: new Date(entry.occurredAt).getTime(),
      normalizedType: normalizeCareEventType(entry.type, entry.details),
    }))
    .filter((candidate) => candidate.normalizedType === "medication")
    .filter((candidate) => Number.isFinite(candidate.ms))
    .filter((candidate) => {
      const ageDays = (now - candidate.ms) / 86400000;
      return ageDays >= 0 && ageDays <= days;
    })
    .sort((a, b) => b.ms - a.ms)
    .map((candidate): MedicationHistoryItem => {
      const outcome = entryOutcome(candidate.entry);
      return {
        id: candidate.id,
        label: clean(candidate.entry.title) || "Medication",
        outcome,
        statusLabel: statusLabel(outcome),
        dose: entryDose(candidate.entry) || "Dose not set",
        caregiver: clean(candidate.entry.caregiver) || "Household",
        occurredAt: candidate.entry.occurredAt,
        routineId: entryRoutineId(candidate.entry),
        note: entryNote(candidate.entry),
      };
    });

  const filtered = allItems.filter((item) => {
    if (!medicationHistoryMatchesOutcome(item, outcome)) return false;
    if (!queryTerms.length) return true;
    const haystack = medicationHistorySearchText(item);
    return queryTerms.every((term) => haystack.includes(term));
  });
  const limited = filtered.slice(0, limit);
  const takenCount = filtered.filter((entry) => entry.outcome === "taken").length;
  const skippedCount = filtered.filter((entry) => entry.outcome === "skipped").length;
  const missedCount = filtered.filter((entry) => entry.outcome === "missed").length;
  const total = filtered.length;
  const logNoun = total === 1 ? "log" : "logs";

  return {
    items: limited,
    total,
    unfilteredTotal: allItems.length,
    takenCount,
    skippedCount,
    missedCount,
    query,
    outcome,
    hasActiveFilters,
    summary: hasActiveFilters
      ? total
        ? `${total} matching medication ${logNoun}`
        : "No matching medication logs"
      : `${total} visible medication ${logNoun} in ${days} days`,
    emptyMessage: hasActiveFilters
      ? "No medication logs match these filters. Clear medication search or switch the outcome filter."
      : "Visible medication logs will appear here with dose, outcome, caregiver, and notes.",
  };
}
