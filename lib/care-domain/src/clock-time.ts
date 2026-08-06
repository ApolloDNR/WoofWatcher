export interface ParsedClockTime {
  minutesSinceMidnight: number;
  canonical24Hour: string;
  display12Hour: string;
}

function formatClockTime(hour24: number, minute: number): ParsedClockTime {
  const suffix = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 || 12;
  return {
    minutesSinceMidnight: hour24 * 60 + minute,
    canonical24Hour: `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    display12Hour: `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`,
  };
}

export function parseClockTime(value: unknown): ParsedClockTime | null {
  if (typeof value !== "string") return null;

  const twentyFourHour = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (twentyFourHour) {
    return formatClockTime(Number(twentyFourHour[1]), Number(twentyFourHour[2]));
  }

  const twelveHour = /^([1-9]|1[0-2]):([0-5]\d) (AM|PM)$/.exec(value);
  if (!twelveHour) return null;

  const hour12 = Number(twelveHour[1]);
  const hour24 = (hour12 % 12) + (twelveHour[3] === "PM" ? 12 : 0);
  return formatClockTime(hour24, Number(twelveHour[2]));
}
