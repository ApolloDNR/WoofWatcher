export type CareAuditAction = "created" | "updated" | "sticky-note-added" | "deleted";

export interface CareAuditEvent {
  id: string;
  action: CareAuditAction;
  caregiver: string;
  occurredAt: string;
  summary: string;
  changes?: string[];
  entryId?: string;
  entryTitle?: string;
  entryType?: string;
  entryOccurredAt?: string;
}

export interface CareAuditEventInput {
  id?: string;
  action: CareAuditAction | string;
  caregiver?: string;
  occurredAt?: string;
  summary: string;
  changes?: unknown;
  entryId?: string;
  entryTitle?: string;
  entryType?: string;
  entryOccurredAt?: string;
}

export interface CareLogAuditSubject {
  id: string;
  type: string;
  title: string;
  caregiver?: string;
  occurredAt: string;
  note?: string;
  details?: Record<string, unknown>;
}

export interface CareLogDeletionAuditInput {
  id?: string;
  caregiver?: string;
  occurredAt?: string;
  entry: CareLogAuditSubject;
}

export interface CareLogDeletionAuditEntry {
  type: "note";
  title: string;
  caregiver: string;
  occurredAt: string;
  note: string;
  details: {
    auditAction: "deleted";
    auditSubjectId: string;
    householdVisible: true;
    deletedEntrySnapshot: {
      id: string;
      type: string;
      title: string;
      caregiver?: string;
      occurredAt: string;
      note?: string;
    };
    auditTrail: CareAuditEvent[];
  };
}

const AUDIT_ACTIONS = new Set<CareAuditAction>(["created", "updated", "sticky-note-added", "deleted"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanAuditId(id: unknown): string {
  const cleaned = cleanString(id);
  return cleaned || `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function cleanActor(value: unknown): string {
  return cleanString(value) || "Care team";
}

function cleanOccurredAt(value: unknown): string {
  return cleanString(value) || new Date().toISOString();
}

function cleanChanges(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const changes = value.flatMap((item) => {
    const cleaned = cleanString(item);
    return cleaned ? [cleaned] : [];
  });
  return changes.length ? changes : undefined;
}

function cleanAuditEvent(value: unknown): CareAuditEvent | null {
  if (!isRecord(value)) return null;
  const action = cleanString(value.action) as CareAuditAction;
  const summary = cleanString(value.summary);
  if (!AUDIT_ACTIONS.has(action) || !summary) return null;

  const event: CareAuditEvent = {
    id: cleanAuditId(value.id),
    action,
    caregiver: cleanActor(value.caregiver),
    occurredAt: cleanOccurredAt(value.occurredAt),
    summary,
  };

  const changes = cleanChanges(value.changes);
  if (changes) event.changes = changes;

  const entryId = cleanString(value.entryId);
  if (entryId) event.entryId = entryId;

  const entryTitle = cleanString(value.entryTitle);
  if (entryTitle) event.entryTitle = entryTitle;

  const entryType = cleanString(value.entryType);
  if (entryType) event.entryType = entryType;

  const entryOccurredAt = cleanString(value.entryOccurredAt);
  if (entryOccurredAt) event.entryOccurredAt = entryOccurredAt;

  return event;
}

export function getCareAuditTrail(details: unknown): CareAuditEvent[] {
  if (!isRecord(details) || !Array.isArray(details.auditTrail)) return [];
  return details.auditTrail.flatMap((event) => {
    const cleaned = cleanAuditEvent(event);
    return cleaned ? [cleaned] : [];
  });
}

export function appendCareAuditEvent<T extends Record<string, unknown>>(
  details: T | null | undefined,
  event: CareAuditEventInput,
): T & { auditTrail?: CareAuditEvent[] } {
  const cleaned = cleanAuditEvent(event);
  if (!cleaned) return (details ?? {}) as T & { auditTrail?: CareAuditEvent[] };

  return {
    ...(details ?? ({} as T)),
    auditTrail: [...getCareAuditTrail(details), cleaned],
  };
}

export function buildCareLogDeletionAuditEntry(input: CareLogDeletionAuditInput): CareLogDeletionAuditEntry {
  const caregiver = cleanActor(input.caregiver);
  const occurredAt = cleanOccurredAt(input.occurredAt);
  const entryTitle = cleanString(input.entry.title) || "Care log";
  const entryType = cleanString(input.entry.type) || "note";
  const entryId = cleanString(input.entry.id) || "unknown";
  const entryOccurredAt = cleanOccurredAt(input.entry.occurredAt);
  const summary = `${caregiver} deleted "${entryTitle}" from the shared care log.`;

  const event: CareAuditEvent = {
    id: cleanAuditId(input.id),
    action: "deleted",
    caregiver,
    occurredAt,
    summary,
    entryId,
    entryTitle,
    entryType,
    entryOccurredAt,
  };

  const snapshot: CareLogDeletionAuditEntry["details"]["deletedEntrySnapshot"] = {
    id: entryId,
    type: entryType,
    title: entryTitle,
    occurredAt: entryOccurredAt,
  };
  const entryCaregiver = cleanString(input.entry.caregiver);
  if (entryCaregiver) snapshot.caregiver = entryCaregiver;
  const entryNote = cleanString(input.entry.note);
  if (entryNote) snapshot.note = entryNote;

  return {
    type: "note",
    title: `Deleted log - ${entryTitle}`,
    caregiver,
    occurredAt,
    note: summary,
    details: {
      auditAction: "deleted",
      auditSubjectId: entryId,
      householdVisible: true,
      deletedEntrySnapshot: snapshot,
      auditTrail: [event],
    },
  };
}
