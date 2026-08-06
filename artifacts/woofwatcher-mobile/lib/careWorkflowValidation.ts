import { parseClockTime, parseStrictNonNegativeDecimal } from "./inputValidation.ts";
import { parseLocalDateKey } from "./localCalendar.ts";

export type CareDraftValidation<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      field: "label" | "title" | "time" | "date" | "due" | "weight";
      message: string;
    };

export interface RoutineDraftInput {
  label: string;
  type: string;
  time: string;
  owner?: string;
  note?: string;
}

export interface CanonicalRoutineDraft {
  label: string;
  type: string;
  time: string;
  owner: string;
  note: string;
}

export interface CalendarEventDraftInput {
  title: string;
  type: string;
  date: string;
  time?: string;
  location?: string;
  note?: string;
  source: "manual" | "woofguide";
}

export interface CanonicalCalendarEventDraft {
  title: string;
  type: string;
  date: string;
  time?: string;
  location?: string;
  note?: string;
  source: "manual" | "woofguide";
}

export interface CareCorrectionPresentation {
  label: "Needs correction";
  preservedValue: string;
}

export interface CalendarEventScheduleValue {
  date: string;
  time?: string;
}

export interface ValidatedRecordEditDraft {
  type: string;
  title: string;
  due: string;
  note: string;
  attachmentUri?: string;
  attachmentName?: string;
}

function clean(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function validateRoutineDraft(
  input: RoutineDraftInput,
): CareDraftValidation<CanonicalRoutineDraft> {
  const label = clean(input.label);
  if (!label) {
    return { ok: false, field: "label", message: "Enter a routine name." };
  }
  const time = parseClockTime(input.time);
  if (!time) {
    return {
      ok: false,
      field: "time",
      message: "Enter an exact time (for example, 7:00 AM).",
    };
  }
  return {
    ok: true,
    value: {
      label,
      type: clean(input.type),
      time: time.display12Hour,
      owner: clean(input.owner),
      note: clean(input.note),
    },
  };
}

export function validateCalendarEventDraft(
  input: CalendarEventDraftInput,
): CareDraftValidation<CanonicalCalendarEventDraft> {
  const title = clean(input.title);
  if (!title) {
    return { ok: false, field: "title", message: "Enter an event title." };
  }
  if (!parseLocalDateKey(input.date)) {
    return {
      ok: false,
      field: "date",
      message: "Enter a valid date (YYYY-MM-DD).",
    };
  }
  const rawTime = input.time ?? "";
  const parsedTime = rawTime === "" ? null : parseClockTime(rawTime);
  if (rawTime !== "" && !parsedTime) {
    return {
      ok: false,
      field: "time",
      message: "Enter an exact time (for example, 9:00 AM), or leave it blank.",
    };
  }

  const location = clean(input.location);
  const note = clean(input.note);
  return {
    ok: true,
    value: {
      title,
      type: clean(input.type),
      date: input.date,
      ...(parsedTime ? { time: parsedTime.display12Hour } : {}),
      ...(location ? { location } : {}),
      ...(note ? { note } : {}),
      source: input.source,
    },
  };
}

export function validateProfileWeightDraft(
  input: string,
): CareDraftValidation<number | null> {
  if (input.trim() === "") return { ok: true, value: null };
  const value = parseStrictNonNegativeDecimal(input);
  if (value === null || value <= 0) {
    return { ok: false, field: "weight", message: "Enter a positive weight." };
  }
  return { ok: true, value };
}

export function validateRecordDueDraft(
  input: string,
): CareDraftValidation<string> {
  if (input.trim() === "") return { ok: true, value: "" };
  if (!parseLocalDateKey(input)) {
    return {
      ok: false,
      field: "due",
      message: "Enter a valid date (YYYY-MM-DD), or leave it blank.",
    };
  }
  return { ok: true, value: input };
}

export function mergeValidatedRoutineEdit<T extends object>(
  existing: T,
  draft: CanonicalRoutineDraft,
): T & CanonicalRoutineDraft {
  return { ...existing, ...draft };
}

export function mergeValidatedCalendarEventEdit<T extends object>(
  existing: T,
  draft: CanonicalCalendarEventDraft,
): T & CanonicalCalendarEventDraft {
  const {
    source: _submittedSource,
    note: _unownedNote,
    time,
    location,
    ...ownedDraft
  } = draft;
  const current = existing as T & {
    source?: CanonicalCalendarEventDraft["source"];
  };
  const merged: Record<string, unknown> = {
    ...existing,
    ...ownedDraft,
    source: current.source ?? draft.source,
  };

  if (time === undefined) delete merged.time;
  else merged.time = time;
  if (location === undefined) delete merged.location;
  else merged.location = location;

  return merged as T & CanonicalCalendarEventDraft;
}

export function mergeValidatedRecordEdit<T extends object>(
  existing: T,
  draft: ValidatedRecordEditDraft,
): T & ValidatedRecordEditDraft {
  const current = existing as T & {
    attachmentUri?: unknown;
    attachmentName?: unknown;
  };
  const merged: Record<string, unknown> = {
    ...existing,
    type: draft.type,
    title: draft.title,
    due: draft.due,
    note: draft.note,
  };
  const existingUri =
    typeof current.attachmentUri === "string" && current.attachmentUri
      ? current.attachmentUri
      : undefined;

  if (draft.attachmentUri && draft.attachmentUri !== existingUri) {
    merged.attachmentUri = draft.attachmentUri;
    if (draft.attachmentName) merged.attachmentName = draft.attachmentName;
    else delete merged.attachmentName;
  } else if (existingUri) {
    merged.attachmentUri = existingUri;
    if (current.attachmentName !== undefined) {
      merged.attachmentName = current.attachmentName;
    }
  } else if (draft.attachmentUri) {
    merged.attachmentUri = draft.attachmentUri;
    if (draft.attachmentName) merged.attachmentName = draft.attachmentName;
  } else {
    delete merged.attachmentUri;
    delete merged.attachmentName;
  }

  return merged as T & ValidatedRecordEditDraft;
}

function calendarEventMinutes(time: string | undefined): number {
  if (time === undefined || time === "") return -1;
  return parseClockTime(time)?.minutesSinceMidnight ?? Number.POSITIVE_INFINITY;
}

export function compareCalendarEventsBySchedule(
  left: CalendarEventScheduleValue,
  right: CalendarEventScheduleValue,
): number {
  const dateOrder = left.date.localeCompare(right.date);
  if (dateOrder !== 0) return dateOrder;
  return calendarEventMinutes(left.time) - calendarEventMinutes(right.time);
}

export function orderCareItemsCorrectionsLast<T>(
  items: readonly T[],
  isCorrection: (item: T) => boolean,
  compareValid?: (left: T, right: T) => number,
): T[] {
  const valid: T[] = [];
  const corrections: T[] = [];
  for (const item of items) {
    (isCorrection(item) ? corrections : valid).push(item);
  }
  return [
    ...(compareValid ? valid.sort(compareValid) : valid),
    ...corrections,
  ];
}

function preservedValueLabel(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "(missing)";
  if (value === null) return "null";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function getCareCorrectionPresentation(
  item: unknown,
  field: "time" | "date" | "due",
): CareCorrectionPresentation | null {
  if (typeof item !== "object" || item === null) return null;
  const issues = (item as { correctionIssues?: unknown }).correctionIssues;
  if (!Array.isArray(issues)) return null;
  const issue = issues.find(
    (candidate) =>
      typeof candidate === "object" &&
      candidate !== null &&
      (candidate as { field?: unknown }).field === field,
  ) as { rawValue?: unknown } | undefined;
  if (!issue) return null;
  return {
    label: "Needs correction",
    preservedValue: preservedValueLabel(issue.rawValue),
  };
}
