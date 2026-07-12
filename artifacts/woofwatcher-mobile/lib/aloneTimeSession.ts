import { appendCareAuditEvent } from "../../../lib/care-domain/src/index.ts";

export type AloneTimeReturnOutcome =
  | "calm"
  | "excited"
  | "anxious"
  | "barking-whining"
  | "accident"
  | "vomit"
  | "destructive"
  | "unknown";

export interface AloneTimeEntryLike {
  id?: string;
  type: string;
  title?: string | null;
  caregiver?: string | null;
  occurredAt: string;
  durationMinutes?: number | null;
  mood?: string | null;
  severity?: string | null;
  note?: string | null;
  details?: Record<string, unknown>;
}

export interface AloneTimeStartOptions {
  caregiver: string;
  now?: number;
}

export interface AloneTimeReturnOptions {
  caregiver: string;
  outcome: AloneTimeReturnOutcome;
  now?: number;
  recoveryMinutes?: number;
  note?: string;
}

export interface AloneTimeBuiltEntry {
  type: "alone";
  title: string;
  caregiver: string;
  occurredAt: string;
  mood: string;
  severity?: string;
  durationMinutes?: number;
  note?: string;
  details: Record<string, unknown>;
}

export interface AloneTimeEntryPatch {
  title: string;
  mood: string;
  severity?: string;
  durationMinutes: number;
  note?: string;
  details: Record<string, unknown>;
}

export interface AloneTimeReturnOption {
  id: AloneTimeReturnOutcome;
  label: string;
  mood: string;
  severity?: string;
}

const RETURN_OPTIONS: AloneTimeReturnOption[] = [
  { id: "calm", label: "Calm", mood: "calm" },
  { id: "excited", label: "Excited", mood: "happy" },
  { id: "anxious", label: "Anxious", mood: "anxious", severity: "watch" },
  { id: "barking-whining", label: "Barking/whining", mood: "anxious", severity: "watch" },
  { id: "accident", label: "Accident", mood: "anxious", severity: "watch" },
  { id: "vomit", label: "Vomit", mood: "unwell", severity: "alert" },
  { id: "destructive", label: "Destructive", mood: "anxious", severity: "alert" },
  { id: "unknown", label: "Unknown", mood: "calm" },
];

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function iso(now: number | undefined): string {
  return new Date(now ?? Date.now()).toISOString();
}

function auditId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function startTime(entry: AloneTimeEntryLike): string {
  const details = isRecord(entry.details) ? entry.details : {};
  return clean(details.aloneStartedAt) || clean(entry.occurredAt) || new Date().toISOString();
}

function durationMinutes(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 60000);
}

function optionFor(outcome: AloneTimeReturnOutcome): AloneTimeReturnOption {
  return RETURN_OPTIONS.find((option) => option.id === outcome) ?? RETURN_OPTIONS[RETURN_OPTIONS.length - 1];
}

export function getAloneTimeReturnOptions(): AloneTimeReturnOption[] {
  return RETURN_OPTIONS.map((option) => ({ ...option }));
}

export function buildAloneTimeStartEntry(options: AloneTimeStartOptions): AloneTimeBuiltEntry {
  const occurredAt = iso(options.now);
  const caregiver = clean(options.caregiver) || "Care team";
  return {
    type: "alone",
    title: "Alone Time - Phoenix home alone",
    caregiver,
    occurredAt,
    mood: "home_alone",
    details: {
      aloneLifecycle: "active",
      aloneStartedAt: occurredAt,
      leftBy: caregiver,
      presenceState: "home-alone",
      supervisedBy: null,
      householdVisible: true,
      logInteraction: "quick-tap",
      trustState: "confirmed",
      confirmationRequired: false,
    },
  };
}

export function findOpenAloneTimeSession(entries: readonly AloneTimeEntryLike[]): AloneTimeEntryLike | null {
  return (
    entries
      .filter((entry) => entry.type === "alone")
      .filter((entry) => {
        const details = isRecord(entry.details) ? entry.details : {};
        return details.householdVisible !== false && details.aloneLifecycle === "active";
      })
      .sort((a, b) => new Date(startTime(b)).getTime() - new Date(startTime(a)).getTime())[0] ?? null
  );
}

export function buildAloneTimeReturnPatch(
  entry: AloneTimeEntryLike,
  options: AloneTimeReturnOptions,
): AloneTimeEntryPatch {
  const caregiver = clean(options.caregiver) || "Care team";
  const endedAt = iso(options.now);
  const startedAt = startTime(entry);
  const outcome = optionFor(options.outcome);
  const existing = isRecord(entry.details) ? entry.details : {};
  const recoveryMinutes =
    typeof options.recoveryMinutes === "number" && Number.isFinite(options.recoveryMinutes)
      ? Math.max(0, Math.round(options.recoveryMinutes))
      : undefined;
  const note = clean(options.note);
  const details = appendCareAuditEvent(
    {
      ...existing,
      aloneLifecycle: "completed",
      aloneStartedAt: startedAt,
      aloneEndedAt: endedAt,
      aloneOutcome: outcome.id,
      returnedBy: caregiver,
      outcomeBy: caregiver,
      outcomeAt: endedAt,
      presenceState: "with-human",
      supervisedBy: caregiver,
      householdVisible: existing.householdVisible !== false,
      ...(recoveryMinutes != null ? { recoveryMinutes } : {}),
    },
    {
      id: auditId(),
      action: "updated",
      caregiver,
      occurredAt: endedAt,
      summary: `${caregiver} closed "${clean(entry.title) || "Alone Time"}" with return outcome: ${outcome.label}.`,
      changes: ["aloneLifecycle", "aloneOutcome", "aloneEndedAt", "durationMinutes"],
    },
  );

  return {
    title: `Alone Time - ${outcome.label} return`,
    mood: outcome.mood,
    ...(outcome.severity ? { severity: outcome.severity } : {}),
    durationMinutes: durationMinutes(startedAt, endedAt),
    ...(note ? { note } : {}),
    details,
  };
}
