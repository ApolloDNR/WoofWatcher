import assert from "node:assert/strict";
import { test } from "node:test";

import {
  addLocalCalendarDays,
  localDateKey,
  parseLocalDateKey,
  todayLocalDateKey,
  type LocalCalendarPartsResolver,
} from "./localCalendar.ts";
import { dayKey, parseLocalDate } from "./time.ts";

function resolverFor(timeZone: string): LocalCalendarPartsResolver {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return (instant) => {
    const parts = formatter.formatToParts(instant);
    const part = (type: "year" | "month" | "day") =>
      Number(parts.find((value) => value.type === type)?.value);
    return { year: part("year"), month: part("month"), day: part("day") };
  };
}

test("localDateKey distinguishes instants immediately before and after local midnight", () => {
  const losAngeles = resolverFor("America/Los_Angeles");

  assert.equal(localDateKey(new Date("2026-01-15T07:59:59.999Z"), losAngeles), "2026-01-14");
  assert.equal(localDateKey(new Date("2026-01-15T08:00:00.000Z"), losAngeles), "2026-01-15");
});

test("localDateKey keeps an evening UTC rollover on the Los Angeles calendar day", () => {
  assert.equal(
    localDateKey(new Date("2026-06-01T02:30:00.000Z"), resolverFor("America/Los_Angeles")),
    "2026-05-31",
  );
});

test("localDateKey keeps an east-of-UTC instant on Tokyo's next calendar day", () => {
  assert.equal(
    localDateKey(new Date("2026-05-31T15:30:00.000Z"), resolverFor("Asia/Tokyo")),
    "2026-06-01",
  );
});

test("todayLocalDateKey uses its injected clock", () => {
  assert.equal(
    todayLocalDateKey(new Date("2026-01-01T00:30:00.000Z"), resolverFor("America/Los_Angeles")),
    "2025-12-31",
  );
});

test("addLocalCalendarDays rolls years and preserves leap days", () => {
  assert.equal(addLocalCalendarDays("2025-12-31", 1), "2026-01-01");
  assert.equal(addLocalCalendarDays("2024-02-28", 1), "2024-02-29");
  assert.equal(addLocalCalendarDays("2024-02-29", 1), "2024-03-01");
});

test("parseLocalDateKey accepts only canonical real Gregorian dates", () => {
  assert.deepEqual(parseLocalDateKey("2026-02-28"), { year: 2026, month: 2, day: 28 });
  assert.equal(parseLocalDateKey("2026-02-31"), null);
  assert.equal(parseLocalDateKey("2026-2-28"), null);
  assert.equal(parseLocalDateKey("2026-02-28 extra"), null);
});

test("calendar keys cross Los Angeles spring-forward as a 23-hour local day", () => {
  const losAngeles = resolverFor("America/Los_Angeles");
  const before = new Date("2026-03-08T08:30:00.000Z"); // Mar 8, 00:30 PST
  const after = new Date("2026-03-09T07:30:00.000Z"); // Mar 9, 00:30 PDT

  assert.equal((after.getTime() - before.getTime()) / 3_600_000, 23);
  assert.equal(localDateKey(new Date("2026-03-08T07:30:00.000Z"), losAngeles), "2026-03-07");
  const beforeKey = localDateKey(before, losAngeles);
  const afterKey = localDateKey(after, losAngeles);
  assert.equal(beforeKey, "2026-03-08");
  assert.equal(afterKey, "2026-03-09");
  assert.equal(localDateKey(new Date("2026-03-09T06:30:00.000Z"), losAngeles), "2026-03-08");
  assert.equal(addLocalCalendarDays(beforeKey, 1), afterKey);
});

test("calendar keys cross Los Angeles fall-back as a 25-hour local day", () => {
  const losAngeles = resolverFor("America/Los_Angeles");
  const before = new Date("2026-11-01T07:30:00.000Z"); // Nov 1, 00:30 PDT
  const after = new Date("2026-11-02T08:30:00.000Z"); // Nov 2, 00:30 PST

  assert.equal((after.getTime() - before.getTime()) / 3_600_000, 25);
  assert.equal(localDateKey(new Date("2026-11-01T06:30:00.000Z"), losAngeles), "2026-10-31");
  const beforeKey = localDateKey(before, losAngeles);
  const afterKey = localDateKey(after, losAngeles);
  assert.equal(beforeKey, "2026-11-01");
  assert.equal(afterKey, "2026-11-02");
  assert.equal(localDateKey(new Date("2026-11-02T07:30:00.000Z"), losAngeles), "2026-11-01");
  assert.equal(addLocalCalendarDays(beforeKey, 1), afterKey);
});

test("calendar APIs round-trip the complete four-digit Gregorian year domain", () => {
  const instant = new Date("2026-01-01T00:00:00.000Z");
  for (const parts of [
    { year: 0, month: 1, day: 1 },
    { year: 2024, month: 2, day: 29 },
    { year: 9999, month: 12, day: 31 },
  ]) {
    const key = localDateKey(instant, () => parts);
    assert.deepEqual(parseLocalDateKey(key), parts);
  }
});

test("localDateKey rejects invalid dates and non-Gregorian resolver parts", () => {
  assert.throws(() => localDateKey(new Date(Number.NaN)), RangeError);

  const instant = new Date("2026-01-01T00:00:00.000Z");
  for (const parts of [
    { year: Number.NaN, month: 1, day: 1 },
    { year: 2026.5, month: 1, day: 1 },
    { year: -1, month: 1, day: 1 },
    { year: 10_000, month: 1, day: 1 },
    { year: 2026, month: 0, day: 1 },
    { year: 2026, month: 13, day: 1 },
    { year: 2026, month: 4, day: 31 },
  ]) {
    assert.throws(() => localDateKey(instant, () => parts), RangeError);
  }
});

test("addLocalCalendarDays rejects non-integer offsets and four-digit year overflow", () => {
  for (const amount of [Number.NaN, 0.5, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.throws(() => addLocalCalendarDays("2026-01-01", amount), RangeError);
  }
  assert.throws(() => addLocalCalendarDays("9999-12-31", 1), RangeError);
  assert.throws(() => addLocalCalendarDays("0000-01-01", -1), RangeError);
});

test("time delegates date keys and parsing to the canonical local calendar behavior", () => {
  const localNoon = new Date(0);
  localNoon.setFullYear(2026, 0, 2);
  localNoon.setHours(12, 0, 0, 0);
  assert.equal(dayKey(localNoon.toISOString()), "2026-01-02");
  assert.equal(parseLocalDate("2026-02-31"), null);

  const valid = parseLocalDate("2026-02-28");
  assert.ok(valid);
  assert.equal(valid.getHours(), 12);
  assert.equal(localDateKey(valid), "2026-02-28");
});
