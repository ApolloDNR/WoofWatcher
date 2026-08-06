import { localDateKey, parseLocalDateKey, todayLocalDateKey } from "./localCalendar.ts";

export function relativeTime(iso: string, now: number): string {
  const mins = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function dayKey(iso: string): string {
  return localDateKey(new Date(iso));
}

export function dayLabel(iso: string, now: number): string {
  const d = new Date(iso);
  const today = new Date(now);
  const yest = new Date(now - 86400000);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (same(d, today)) return "Today";
  if (same(d, yest)) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

/** ISO date string YYYY-MM-DD for today in local time. */
export function todayISO(): string {
  return todayLocalDateKey();
}

/** Validate a YYYY-MM-DD string and return a Date, or null if invalid. */
export function parseLocalDate(s: string): Date | null {
  const parts = parseLocalDateKey(s);
  if (!parts) return null;

  const date = new Date(0);
  date.setFullYear(parts.year, parts.month - 1, parts.day);
  date.setHours(12, 0, 0, 0);
  return date;
}
