/**
 * Pure day-bucketing helpers for the Trends & Insights screen.
 *
 * The Trends screen re-windows real care logs into Day / Week / Month / Year
 * views. All three charts (mood line, activity bars, potty bars) share the
 * same bucket grid produced here, so the window math lives in one tested
 * place instead of being duplicated (and drifting) across three charts.
 *
 * Honesty rule: this module only *slices time* into buckets and aggregates
 * values the caller already extracted from real entries. It never fabricates
 * data - empty buckets stay empty (null average / 0 sum / 0 count).
 *
 * No React Native / care-domain imports: keep it pure so it stays unit
 * testable with `node --test` (see trendsChart.test.ts).
 */

export type TrendWindowKey = "day" | "week" | "month" | "year";

export interface TrendWindowOption {
  key: TrendWindowKey;
  label: string;
}

/** Segmented control order, matching Apollo's Trends mock (Day/Week/Month/Year). */
export const TREND_WINDOWS: readonly TrendWindowOption[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

export interface TrendBucket {
  /** Inclusive start of the bucket, ms epoch. */
  start: number;
  /** Exclusive end of the bucket, ms epoch. */
  end: number;
  /** Short axis label (e.g. "Mon", "8a", "12", "Jun"). */
  label: string;
}

export interface TrendWindow {
  key: TrendWindowKey;
  /** Inclusive window start, ms epoch. */
  start: number;
  /** Exclusive window end, ms epoch. */
  end: number;
  buckets: TrendBucket[];
  /** Human date-range subtitle, e.g. "May 2 – May 8". */
  rangeLabel: string;
  /** Render every Nth bucket label (charts thin dense axes to this stride). */
  labelStride: number;
}

/** A timestamped scalar sample fed into the aggregators. */
export interface TrendSample {
  at: number;
  value: number;
}

export interface ChartPoint {
  x: number;
  y: number;
}

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const HOUR_MS = 3_600_000;

function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function startOfMonth(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

/** Add whole calendar days to a start-of-day timestamp (DST/​month safe). */
function addDays(ms: number, days: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime();
}

/** Add whole calendar months to a start-of-month timestamp. */
function addMonths(ms: number, months: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth() + months, 1).getTime();
}

function hourLabel(hour: number): string {
  if (hour === 0) return "12a";
  if (hour === 12) return "12p";
  return hour < 12 ? `${hour}a` : `${hour - 12}p`;
}

/** "May 8" style month + day label. */
export function formatMonthDay(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

function dayBuckets(start: number, count: number, label: (start: number) => string): TrendBucket[] {
  const buckets: TrendBucket[] = [];
  for (let i = 0; i < count; i += 1) {
    const bStart = addDays(start, i);
    const bEnd = addDays(start, i + 1);
    buckets.push({ start: bStart, end: bEnd, label: label(bStart) });
  }
  return buckets;
}

/**
 * Slice the selected window into aggregation buckets against `now`.
 *
 * - Day: today, six 4-hour buckets (12a … 8p).
 * - Week: the trailing 7 calendar days, one bucket each (weekday labels).
 * - Month: the trailing 30 calendar days, one bucket each (day-of-month).
 * - Year: the trailing 12 calendar months, one bucket each (month labels).
 */
export function buildTrendWindow(key: TrendWindowKey, now: number): TrendWindow {
  if (key === "day") {
    const dayStart = startOfDay(now);
    const dayEnd = addDays(dayStart, 1);
    const buckets: TrendBucket[] = [];
    for (let i = 0; i < 6; i += 1) {
      const bStart = dayStart + i * 4 * HOUR_MS;
      const bEnd = bStart + 4 * HOUR_MS;
      buckets.push({ start: bStart, end: bEnd, label: hourLabel(new Date(bStart).getHours()) });
    }
    return {
      key,
      start: dayStart,
      end: dayEnd,
      buckets,
      rangeLabel: `${WEEKDAYS_SHORT[new Date(dayStart).getDay()]}, ${formatMonthDay(dayStart)}`,
      labelStride: 1,
    };
  }

  if (key === "year") {
    const base = startOfMonth(now);
    const start = addMonths(base, -11);
    const end = addMonths(base, 1);
    const buckets: TrendBucket[] = [];
    for (let i = 0; i < 12; i += 1) {
      const bStart = addMonths(start, i);
      const bEnd = addMonths(start, i + 1);
      buckets.push({ start: bStart, end: bEnd, label: MONTHS_SHORT[new Date(bStart).getMonth()] });
    }
    const startDate = new Date(start);
    const endDate = new Date(base);
    return {
      key,
      start,
      end,
      buckets,
      rangeLabel: `${MONTHS_SHORT[startDate.getMonth()]} ${startDate.getFullYear()} – ${MONTHS_SHORT[endDate.getMonth()]} ${endDate.getFullYear()}`,
      labelStride: 2,
    };
  }

  // week + month: trailing N calendar days, one bucket per day.
  const days = key === "week" ? 7 : 30;
  const end = addDays(startOfDay(now), 1);
  const start = addDays(end, -days);
  const buckets =
    key === "week"
      ? dayBuckets(start, days, (bStart) => WEEKDAYS_SHORT[new Date(bStart).getDay()])
      : dayBuckets(start, days, (bStart) => String(new Date(bStart).getDate()));
  return {
    key,
    start,
    end,
    buckets,
    rangeLabel: `${formatMonthDay(start)} – ${formatMonthDay(addDays(end, -1))}`,
    labelStride: key === "week" ? 1 : 5,
  };
}

/** Index of the bucket containing `at`, or -1 when outside every bucket. */
export function bucketIndexOf(buckets: readonly TrendBucket[], at: number): number {
  for (let i = 0; i < buckets.length; i += 1) {
    if (at >= buckets[i].start && at < buckets[i].end) return i;
  }
  return -1;
}

/** Mean value per bucket; null for buckets with no samples (honest gap). */
export function bucketAverages(
  samples: readonly TrendSample[],
  buckets: readonly TrendBucket[],
): (number | null)[] {
  const sums = new Array(buckets.length).fill(0);
  const counts = new Array(buckets.length).fill(0);
  for (const sample of samples) {
    const i = bucketIndexOf(buckets, sample.at);
    if (i < 0) continue;
    sums[i] += sample.value;
    counts[i] += 1;
  }
  return buckets.map((_, i) => (counts[i] > 0 ? sums[i] / counts[i] : null));
}

/** Sum of values per bucket (0 when empty). */
export function bucketSums(
  samples: readonly TrendSample[],
  buckets: readonly TrendBucket[],
): number[] {
  const sums = new Array(buckets.length).fill(0);
  for (const sample of samples) {
    const i = bucketIndexOf(buckets, sample.at);
    if (i < 0) continue;
    sums[i] += sample.value;
  }
  return sums;
}

/** Count of timestamps per bucket (0 when empty). */
export function bucketCounts(times: readonly number[], buckets: readonly TrendBucket[]): number[] {
  const counts = new Array(buckets.length).fill(0);
  for (const at of times) {
    const i = bucketIndexOf(buckets, at);
    if (i < 0) continue;
    counts[i] += 1;
  }
  return counts;
}

/** Total pixel length of a polyline, used to animate the mood line drawing in. */
export function polylineLength(points: readonly ChartPoint[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i += 1) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}
