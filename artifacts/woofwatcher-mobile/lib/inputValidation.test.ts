import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseClockTime,
  parseStrictNonNegativeDecimal,
  parseStrictNonNegativeInteger,
  parseStrictPositiveAmountWithUnit,
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

test("parseStrictNonNegativeInteger rejects fractional counts and trailing input", () => {
  assert.equal(parseStrictNonNegativeInteger("0"), 0);
  assert.equal(parseStrictNonNegativeInteger(" 12 "), 12);
  for (const value of ["1.5", "1e2", "2 dogs", "-1", ""]) {
    assert.equal(parseStrictNonNegativeInteger(value), null, value);
  }
});

test("parseStrictPositiveAmountWithUnit accepts complete decimals, fractions, and mixed fractions", () => {
  assert.deepEqual(parseStrictPositiveAmountWithUnit("1.5 cups"), { amount: 1.5, unit: "cup" });
  assert.deepEqual(parseStrictPositiveAmountWithUnit("3/4 cup"), { amount: 0.75, unit: "cup" });
  assert.deepEqual(parseStrictPositiveAmountWithUnit("1 1/2 cups"), { amount: 1.5, unit: "cup" });
  assert.deepEqual(parseStrictPositiveAmountWithUnit("2 tablespoons"), { amount: 2, unit: "tbsp" });
  assert.deepEqual(parseStrictPositiveAmountWithUnit("4 oz"), { amount: 4, unit: "oz" });
});

test("parseStrictPositiveAmountWithUnit rejects unsafe integer components", () => {
  assert.deepEqual(parseStrictPositiveAmountWithUnit("9007199254740991 cups"), {
    amount: Number.MAX_SAFE_INTEGER,
    unit: "cup",
  });

  for (const value of [
    "9007199254740992 cups",
    "9007199254740993 cups",
    "9007199254740992/9007199254740993 cups",
    "9007199254740992 1/2 cups",
    "1 9007199254740992/9007199254740993 cups",
  ]) {
    assert.equal(parseStrictPositiveAmountWithUnit(value), null, value);
  }
});

test("parseStrictPositiveAmountWithUnit rejects ambiguous, unknown, and suffix input", () => {
  for (const value of [
    "0 cups",
    "1-2 cups",
    "1 to 2 cups",
    "about 1 cup",
    "1 cup trailing",
    "1 mystery",
    "1/0 cup",
    "1 2/2 cups",
    "cups 1",
  ]) {
    assert.equal(parseStrictPositiveAmountWithUnit(value), null, value);
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
