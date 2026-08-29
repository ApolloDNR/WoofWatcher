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
  migrateItem: (item: Record<string, unknown>) => Record<string, unknown>,
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
      items.push(migrateItem(rawValue));
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
    ...(records.items ? { records: records.items } : {}),
    ...(calendarEvents.items ? { calendarEvents: calendarEvents.items } : {}),
    ...(migrationQuarantine.length > 0 ? { migrationQuarantine } : {}),
  } as T & { dataVersion: number };
}
