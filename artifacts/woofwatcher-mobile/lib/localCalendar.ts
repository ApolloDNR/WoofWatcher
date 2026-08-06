export interface LocalCalendarParts {
  year: number;
  month: number;
  day: number;
}

export type LocalCalendarPartsResolver = (instant: Date) => LocalCalendarParts;

const localParts: LocalCalendarPartsResolver = (instant) => ({
  year: instant.getFullYear(),
  month: instant.getMonth() + 1,
  day: instant.getDate(),
});

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInGregorianMonth(year: number, month: number): number {
  const monthLengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return monthLengths[month - 1] ?? 0;
}

function isCanonicalParts(parts: unknown): parts is LocalCalendarParts {
  if (typeof parts !== "object" || parts === null) return false;
  const candidate = parts as Partial<LocalCalendarParts>;
  return (
    Number.isInteger(candidate.year) &&
    candidate.year! >= 0 &&
    candidate.year! <= 9999 &&
    Number.isInteger(candidate.month) &&
    candidate.month! >= 1 &&
    candidate.month! <= 12 &&
    Number.isInteger(candidate.day) &&
    candidate.day! >= 1 &&
    candidate.day! <= daysInGregorianMonth(candidate.year!, candidate.month!)
  );
}

function keyFromParts(parts: LocalCalendarParts): string {
  if (!isCanonicalParts(parts)) throw new RangeError("Invalid local calendar parts");

  const { year, month, day } = parts;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function localDateKeyFromParts(parts: LocalCalendarParts): string {
  return keyFromParts(parts);
}

function localNoon({ year, month, day }: LocalCalendarParts): Date {
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return date;
}

export function localDateKey(value: Date, resolveParts: LocalCalendarPartsResolver = localParts): string {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new RangeError("Invalid calendar instant");
  }
  return keyFromParts(resolveParts(value));
}

export function todayLocalDateKey(
  now: Date = new Date(),
  resolveParts: LocalCalendarPartsResolver = localParts,
): string {
  return localDateKey(now, resolveParts);
}

export function parseLocalDateKey(value: string): LocalCalendarParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  return isCanonicalParts(parts) ? parts : null;
}

export function addLocalCalendarDays(key: string, amount: number): string {
  const parts = parseLocalDateKey(key);
  if (!parts) throw new RangeError(`Invalid local date key: ${key}`);
  if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
    throw new RangeError("Calendar day offset must be a finite integer");
  }

  const date = localNoon(parts);
  date.setDate(date.getDate() + amount);
  return localDateKey(date);
}
