import assert from "node:assert/strict";
import { test } from "node:test";

import { parseClockTime } from "../src/clock-time.ts";

test("parses complete 24-hour and 12-hour clock values into one canonical shape", () => {
  assert.deepEqual(parseClockTime("07:05"), {
    minutesSinceMidnight: 425,
    canonical24Hour: "07:05",
    display12Hour: "7:05 AM",
  });
  assert.deepEqual(parseClockTime("12:00 AM"), {
    minutesSinceMidnight: 0,
    canonical24Hour: "00:00",
    display12Hour: "12:00 AM",
  });
  assert.deepEqual(parseClockTime("7:30 PM"), {
    minutesSinceMidnight: 1170,
    canonical24Hour: "19:30",
    display12Hour: "7:30 PM",
  });
});

test("rejects incomplete, out-of-range, prefixed, and trailing clock values", () => {
  for (const value of ["7:99 PM", "7x:30 PM", "24:00", "7", "7:30 PM now", " 7:30 PM"]) {
    assert.equal(parseClockTime(value), null, value);
  }
});

test("rejects non-string runtime values instead of scheduling their string coercion", () => {
  for (const value of [null, 1300, ["1:00 PM"], { toString: () => "1:00 PM" }]) {
    assert.equal(parseClockTime(value as never), null);
  }
});
