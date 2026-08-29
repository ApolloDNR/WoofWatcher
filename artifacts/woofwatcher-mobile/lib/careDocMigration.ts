import { parseClockTime } from "./inputValidation.ts";
import { parseLocalDateKey } from "./localCalendar.ts";

export const CURRENT_CARE_DOC_DATA_VERSION = 1;

export type CareCorrectionField = "time" | "date" | "due";

export interface CareCorrectionIssue {
  field: CareCorrectionField;
  rawValue: unknown;
  message: string;
  [key: string]: unknown;
}

export type CareDocMigratableCollection = "routines" | "records" | "calendarEvents";

export interface CareDocMigrationQuarantineItem {
  collection: CareDocMigratableCollection;
  index: number;
  rawValue: unknown;
  message: string;
}

export interface MigratableCareDoc {
  dataVersion?: number;
  routines?: Array<Record<string, unknown>>;
  records?: Array<Record<string, unknown>>;
  calendarEvents?: Array<Record<string, unknown>>;
  migrationQuarantine?: unknown[];
}

type CorrectionIssueCarrier = {
  correctionIssues?: unknown;
};

function isCorrectionField(value: unknown): value is CareCorrectionField {
  return value === "time" || value === "date" || value === "due";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function correctionIssues(item: CorrectionIssueCarrier): unknown[] {
  if (!Array.isArray(item.correctionIssues)) return [];
  return [...item.correctionIssues];
}

function issueField(issue: unknown): unknown {
  return isRecord(issue) ? issue.field : undefined;
}

export function hasCorrectionIssue(
  item: CorrectionIssueCarrier,
  field: CareCorrectionField,
): boolean {
  return correctionIssues(item).some((issue) => issueField(issue) === field);
}

export function isSchedulableRoutine(item: CorrectionIssueCarrier & { time?: unknown }): boolean {
  return (
    !hasCorrectionIssue(item, "time") &&
    typeof item.time === "string" &&
    parseClockTime(item.time) !== null
  );
}

function withFieldIssue(
  item: Record<string, unknown>,
  field: CareCorrectionField,
  invalid: boolean,
  message: string,
): Record<string, unknown> {
  const currentIssues = correctionIssues(item);
  const ownedIssue = currentIssues.find((issue) => issueField(issue) === field);
  const nextIssues = currentIssues.filter((issue) => issueField(issue) !== field);
  if (invalid) {
    nextIssues.push({
      ...(isRecord(ownedIssue) ? ownedIssue : {}),
      field,
      rawValue: item[field],
      message,
    });
  }

  const { correctionIssues: _previousIssues, ...unchanged } = item;
  return nextIssues.length > 0 ? { ...unchanged, correctionIssues: nextIssues } : unchanged;
}

export function isFutureCareDocDataVersion(
  value: unknown,
): value is Record<string, unknown> & { dataVersion: number } {
  if (!isRecord(value)) return false;
  return (
    typeof value.dataVersion === "number" &&
    value.dataVersion > CURRENT_CARE_DOC_DATA_VERSION
  );
}

function quarantineMessage(collection: CareDocMigratableCollection): string {
  if (collection === "routines") return "Invalid routine item preserved outside active data.";
  if (collection === "records") return "Invalid record item preserved outside active data.";
  return "Invalid calendar event item preserved outside active data.";
}

function migrateCollection(
  value: unknown,
  collection: CareDocMigratableCollection,
  migrateItem: (item: Record<string, unknown>, index: number) => Record<string, unknown>,
): { items?: Array<Record<string, unknown>>; quarantined: CareDocMigrationQuarantineItem[] } {
  if (value === undefined) return { quarantined: [] };
  if (!Array.isArray(value)) {
    return {
      items: [],
      quarantined: [{ collection, index: -1, rawValue: value, message: quarantineMessage(collection) }],
    };
  }

  const items: Array<Record<string, unknown>> = [];
  const quarantined: CareDocMigrationQuarantineItem[] = [];
  value.forEach((rawValue, index) => {
    if (isRecord(rawValue)) {
      items.push(migrateItem(rawValue, index));
    } else {
      quarantined.push({ collection, index, rawValue, message: quarantineMessage(collection) });
    }
  });
  return { items, quarantined };
}

function migrateRoutine(item: Record<string, unknown>): Record<string, unknown> {
  return withFieldIssue(
    item,
    "time",
    typeof item.time !== "string" || parseClockTime(item.time) === null,
    "Enter a valid routine time.",
  );
}

function migrateRecord(item: Record<string, unknown>): Record<string, unknown> {
  const dueIsAbsent = item.due === undefined || item.due === null || item.due === "";
  return withFieldIssue(
    item,
    "due",
    !dueIsAbsent && (typeof item.due !== "string" || parseLocalDateKey(item.due) === null),
    "Enter a valid due date.",
  );
}

function hasUsableId(item: Record<string, unknown>): item is Record<string, unknown> & { id: string } {
  return typeof item.id === "string" && item.id.trim().length > 0;
}

function repairMissingRecordIds(
  records: Array<Record<string, unknown>> | undefined,
): Array<Record<string, unknown>> | undefined {
  if (!records) return undefined;
  const reservedIds = new Set(
    records.filter(hasUsableId).map((record) => record.id),
  );

  return records.map((record, index) => {
    if (hasUsableId(record)) return record;
    const base = `record_migrated_${index + 1}`;
    let id = base;
    let suffix = 2;
    while (reservedIds.has(id)) {
      id = `${base}_${suffix}`;
      suffix += 1;
    }
    reservedIds.add(id);
    return { ...record, id };
  });
}

const DEVICE_ONLY_RECORD_ATTACHMENT_FIELDS = [
  "attachmentUri",
  "attachmentName",
  "attachmentMimeType",
] as const;

function withoutDeviceOnlyRecordAttachment(
  record: Record<string, unknown>,
): Record<string, unknown> {
  if (
    !DEVICE_ONLY_RECORD_ATTACHMENT_FIELDS.some((field) =>
      Object.prototype.hasOwnProperty.call(record, field),
    )
  ) {
    return record;
  }
  const {
    attachmentUri: _attachmentUri,
    attachmentName: _attachmentName,
    attachmentMimeType: _attachmentMimeType,
    ...shareable
  } = record;
  return shareable;
}

/**
 * Provider state must never carry a device's private file URI or imply that
 * another device has the same app-owned attachment. The record itself still
 * syncs; its local attachment metadata does not.
 */
export function sanitizeCareDocForProviderSync<T extends object>(doc: T): T {
  const records = (doc as { records?: unknown }).records;
  if (!Array.isArray(records)) return doc;
  let changed = false;
  const shareableRecords = records.map((record) => {
    if (!isRecord(record)) return record;
    const shareable = withoutDeviceOnlyRecordAttachment(record);
    if (shareable !== record) changed = true;
    return shareable;
  });
  return changed ? ({ ...doc, records: shareableRecords } as T) : doc;
}

function localAttachmentFields(
  record: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  if (
    !record ||
    typeof record.attachmentUri !== "string" ||
    record.attachmentUri.trim().length === 0
  ) {
    return null;
  }
  return {
    attachmentUri: record.attachmentUri,
    ...(typeof record.attachmentName === "string" && record.attachmentName.trim()
      ? { attachmentName: record.attachmentName }
      : {}),
    ...(typeof record.attachmentMimeType === "string" && record.attachmentMimeType.trim()
      ? { attachmentMimeType: record.attachmentMimeType }
      : {}),
  };
}

/**
 * Drops any URI received from a provider, then overlays only the attachment
 * owned by this exact device when record identity matches.
 */
export function restoreDeviceOnlyRecordAttachments<
  TProvider extends object,
  TLocal extends object,
>(providerDoc: TProvider, localDoc: TLocal): TProvider {
  const providerRecords = (providerDoc as { records?: unknown }).records;
  if (!Array.isArray(providerRecords)) return providerDoc;
  const localRecords = (localDoc as { records?: unknown }).records;
  const localById = new Map<string, Record<string, unknown>>();
  if (Array.isArray(localRecords)) {
    for (const record of localRecords) {
      if (isRecord(record) && hasUsableId(record)) {
        localById.set(record.id, record);
      }
    }
  }

  let changed = false;
  const restoredRecords = providerRecords.map((record) => {
    if (!isRecord(record)) return record;
    const shareable = withoutDeviceOnlyRecordAttachment(record);
    const local = hasUsableId(record) ? localById.get(record.id) : undefined;
    const attachment = localAttachmentFields(local);
    const restored = attachment ? { ...shareable, ...attachment } : shareable;
    if (restored !== record) changed = true;
    return restored;
  });
  return changed ? ({ ...providerDoc, records: restoredRecords } as TProvider) : providerDoc;
}

function migrateCalendarEvent(item: Record<string, unknown>): Record<string, unknown> {
  const withDateIssue = withFieldIssue(
    item,
    "date",
    typeof item.date !== "string" || parseLocalDateKey(item.date) === null,
    "Enter a valid event date.",
  );
  const timeIsAbsent = item.time === undefined || item.time === null || item.time === "";
  return withFieldIssue(
    withDateIssue,
    "time",
    !timeIsAbsent && (typeof item.time !== "string" || parseClockTime(item.time) === null),
    "Enter a valid event time.",
  );
}

export function migrateCareDoc<T extends object>(
  doc: T,
): T & { dataVersion: number } {
  if (isFutureCareDocDataVersion(doc)) return doc as T & { dataVersion: number };

  const migratable = doc as T & MigratableCareDoc;
  const routines = migrateCollection(migratable.routines, "routines", migrateRoutine);
  const records = migrateCollection(migratable.records, "records", migrateRecord);
  const repairedRecords = repairMissingRecordIds(records.items);
  const calendarEvents = migrateCollection(
    migratable.calendarEvents,
    "calendarEvents",
    migrateCalendarEvent,
  );
  const newQuarantine = [
    ...routines.quarantined,
    ...records.quarantined,
    ...calendarEvents.quarantined,
  ];
  const existingQuarantine = Array.isArray(migratable.migrationQuarantine)
    ? [...migratable.migrationQuarantine]
    : [];
  const migrationQuarantine = [...existingQuarantine, ...newQuarantine];

  return {
    ...doc,
    dataVersion: CURRENT_CARE_DOC_DATA_VERSION,
    ...(routines.items ? { routines: routines.items } : {}),
    ...(repairedRecords ? { records: repairedRecords } : {}),
    ...(calendarEvents.items ? { calendarEvents: calendarEvents.items } : {}),
    ...(migrationQuarantine.length > 0 ? { migrationQuarantine } : {}),
  } as T & { dataVersion: number };
}
