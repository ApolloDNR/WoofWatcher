// Pure month-grid + day-bucketing math for the Calendar month screen.
//
// Everything here is deterministic and side-effect free so the zero-dep
// `node --experimental-strip-types --test` runner can exercise it without a
// clock. Callers pass the visible `year`/`month` and a `todayKey` explicitly -
// this module never reads `Date.now()` or constructs an argless `new Date()`.
// Grid geometry (weekday of the 1st, days in month) is computed with plain
// integer arithmetic so it does not depend on the host time zone at all; the
// only `new Date(...)` calls parse the caller-supplied ISO timestamps of real
// care entries, which are then bucketed through the canonical local calendar.

import {
  localDateKey,
  localDateKeyFromParts,
  parseLocalDateKey,
} from "./localCalendar.ts";

/** Anything with an ISO `occurredAt` can be bucketed onto a calendar day. */
export interface DatedItem {
  occurredAt: string;
}

/** One square in the month grid. Blank pad cells carry `day: null`. */
export interface MonthDayCell {
  /** 1-based day of month, or null for a leading/trailing pad cell. */
  day: number | null;
  /** Canonical local day key (`YYYY-MM-DD`), or null for pad cells. */
  dateKey: string | null;
  /** True for real days of the visible month, false for pad cells. */
  inMonth: boolean;
  /** True when this cell's key equals the caller-supplied `todayKey`. */
  isToday: boolean;
  /** True when at least one real entry falls on this day. */
  hasEntries: boolean;
  /** Number of real entries that fall on this day. */
  entryCount: number;
}

export interface MonthView {
  /** Full calendar year, e.g. 2025. */
  year: number;
  /** 0-indexed month (0 = January), matching `Date.prototype.getMonth`. */
  month: number;
  /** Display title, e.g. "May 2025". */
  title: string;
  /** Sunday-first weeks; every week has exactly 7 cells. */
  weeks: MonthDayCell[][];
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const WEEKDAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Number of days in a 0-indexed month of a given year. */
export function daysInMonth(year: number, month: number): number {
  const lengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return lengths[((month % 12) + 12) % 12];
}

/**
 * Weekday (0 = Sunday ... 6 = Saturday) of the 1st of a 0-indexed month,
 * via Sakamoto's algorithm. Pure integer math, so it is time-zone agnostic
 * and safe to run inside the deterministic test harness.
 */
export function weekdayOfFirst(year: number, month: number): number {
  const m1 = (((month % 12) + 12) % 12) + 1; // 1-indexed month for the table
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const y = m1 < 3 ? year - 1 : year;
  return (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[m1 - 1] + 1) % 7;
}

/** Canonical local day key for a Date. */
export function dateKeyOf(date: Date): string {
  return localDateKey(date);
}

/** Local day key from explicit calendar parts (month is 0-indexed). */
export function dateKeyForYmd(year: number, month: number, day: number): string {
  return localDateKeyFromParts({ year, month: month + 1, day });
}

/** Parse a canonical key back into zero-indexed month parts, or null. */
export function parseDateKey(key: string): { year: number; month: number; day: number } | null {
  const parts = parseLocalDateKey(key);
  return parts ? { year: parts.year, month: parts.month - 1, day: parts.day } : null;
}

/** A sortable integer stamp for a day key (year*10000 + month*100 + day). */
export function dateKeyStamp(key: string): number {
  const parts = parseDateKey(key);
  if (!parts) return Number.NaN;
  return parts.year * 10000 + (parts.month + 1) * 100 + parts.day;
}

export function formatMonthTitle(year: number, month: number): string {
  return `${MONTH_NAMES[((month % 12) + 12) % 12]} ${year}`;
}

/** Move a 0-indexed year/month by `delta` months, rolling the year over. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

/** Count real entries per local day key, skipping unparseable timestamps. */
export function entryCountsByDay<T extends DatedItem>(entries: readonly T[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const date = new Date(entry.occurredAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = dateKeyOf(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** Set of local day keys that have at least one real entry. */
export function daysWithEntries<T extends DatedItem>(entries: readonly T[]): Set<string> {
  return new Set(entryCountsByDay(entries).keys());
}

/**
 * Real entries that fall on a given local day key, sorted ascending by their
 * timestamp - the exact order the day's timeline should render.
 */
export function entriesForDayKey<T extends DatedItem>(entries: readonly T[], dateKey: string): T[] {
  return entries
    .filter((entry) => {
      const date = new Date(entry.occurredAt);
      return !Number.isNaN(date.getTime()) && dateKeyOf(date) === dateKey;
    })
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
}

function blankCell(): MonthDayCell {
  return { day: null, dateKey: null, inMonth: false, isToday: false, hasEntries: false, entryCount: 0 };
}

/**
 * Build the Sunday-first month grid for the visible month, with leading and
 * trailing blank pad cells so every week has exactly 7 cells. Each in-month
 * cell is annotated with whether it is today and how many real entries land
 * on it, so the screen can draw day dots straight from the returned view.
 */
export function buildMonthView<T extends DatedItem>(params: {
  year: number;
  month: number;
  todayKey: string;
  entries: readonly T[];
}): MonthView {
  const { year, month, todayKey, entries } = params;
  const counts = entryCountsByDay(entries);
  const leading = weekdayOfFirst(year, month);
  const total = daysInMonth(year, month);

  const cells: MonthDayCell[] = [];
  for (let i = 0; i < leading; i += 1) cells.push(blankCell());
  for (let day = 1; day <= total; day += 1) {
    const dateKey = dateKeyForYmd(year, month, day);
    const entryCount = counts.get(dateKey) ?? 0;
    cells.push({
      day,
      dateKey,
      inMonth: true,
      isToday: dateKey === todayKey,
      hasEntries: entryCount > 0,
      entryCount,
    });
  }
  while (cells.length % 7 !== 0) cells.push(blankCell());

  const weeks: MonthDayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return { year, month, title: formatMonthTitle(year, month), weeks };
}
