import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseClockTime,
  parseStrictNonNegativeDecimal,
  validateMealAmounts,
} from "./inputValidation.ts";

test("parseClockTime accepts complete 24-hour clock times", () => {
  assert.deepEqual(parseClockTime("07:05"), {
    minutesSinceMidnight: 425,
    canonical24Hour: "07:05",
    display12Hour: "7:05 AM",
  });
  assert.deepEqual(parseClockTime("23:59"), {
    minutesSinceMidnight: 1439,
    canonical24Hour: "23:59",
    display12Hour: "11:59 PM",
  });
});

test("parseClockTime accepts complete 12-hour clock times", () => {
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

test("parseClockTime rejects incomplete, out-of-range, and trailing input", () => {
  for (const value of ["7:99 PM", "7x:30 PM", "24:00", "7", "7:30 PM now", " 7:30 PM"]) {
    assert.equal(parseClockTime(value), null, value);
  }
});

test("parseStrictNonNegativeDecimal accepts complete non-negative decimal values", () => {
  assert.equal(parseStrictNonNegativeDecimal("0"), 0);
  assert.equal(parseStrictNonNegativeDecimal(" 12.50 "), 12.5);
  assert.equal(parseStrictNonNegativeDecimal(".75"), 0.75);
});

test("parseStrictNonNegativeDecimal rejects signs, exponents, non-finite values, and trailing text", () => {
  for (const value of ["1abc", "-1", "+1", "1e3", "NaN", "Infinity", "1.2.3"]) {
    assert.equal(parseStrictNonNegativeDecimal(value), null, value);
  }
});

test("validateMealAmounts requires a positive served amount when a meal is completed", () => {
  assert.deepEqual(
    validateMealAmounts({ completed: true, served: "", servedUnit: "cup", eaten: "", eatenUnit: "cup" }),
    { ok: false, field: "served", message: "Enter a positive served amount." },
  );
  assert.deepEqual(
    validateMealAmounts({ completed: true, served: "0", servedUnit: "cup", eaten: "", eatenUnit: "cup" }),
    { ok: false, field: "served", message: "Enter a positive served amount." },
  );
});

test("validateMealAmounts rejects eaten amounts above served amounts in the same normalized unit", () => {
  assert.deepEqual(
    validateMealAmounts({ completed: true, served: "1", servedUnit: "CUPS", eaten: "1.1", eatenUnit: " cups " }),
    { ok: false, field: "eaten", message: "Eaten amount cannot exceed served amount in the same unit." },
  );
});

test("validateMealAmounts returns parsed optional amounts when the meal is valid", () => {
  assert.deepEqual(
    validateMealAmounts({ completed: true, served: "1.5", servedUnit: "cup", eaten: "1", eatenUnit: "cup" }),
    { ok: true, served: 1.5, eaten: 1 },
  );
  assert.deepEqual(
    validateMealAmounts({ completed: false, served: "", servedUnit: "cup", eaten: "", eatenUnit: "cup" }),
    { ok: true, served: null, eaten: null },
  );
});
