import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import colors from "../constants/colors.ts";

function channel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const normalized = hex.replace("#", "");
  const [red, green, blue] = [0, 2, 4].map((offset) =>
    Number.parseInt(normalized.slice(offset, offset + 2), 16),
  );
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort(
    (left, right) => right - left,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

const HOME_SOURCE = readFileSync(
  join(process.cwd(), "artifacts", "woofwatcher-mobile", "app", "(tabs)", "index.tsx"),
  "utf8",
);
const RESET_SHIELD_SOURCE = readFileSync(
  join(
    process.cwd(),
    "artifacts",
    "woofwatcher-mobile",
    "components",
    "LocalDataResetAppShield.tsx",
  ),
  "utf8",
);

test("rose badges and destructive actions use a foreground that meets AA", () => {
  for (const palette of [colors.light, colors.dark] as const) {
    assert.ok(
      contrastRatio(palette.rose, palette.brandNavy) >= 4.5,
      `${palette.rose} on ${palette.brandNavy}`,
    );
  }

  const reminderBadge = HOME_SOURCE.slice(
    HOME_SOURCE.indexOf("{watchSignalCount > 0 ? ("),
    HOME_SOURCE.indexOf("{watchSignalCount > 0 ? (") + 500,
  );
  assert.match(reminderBadge, /backgroundColor:\s*colors\.rose/);
  assert.match(reminderBadge, /color:\s*colors\.brandNavy/);

  const retryDeletion = RESET_SHIELD_SOURCE.slice(
    RESET_SHIELD_SOURCE.indexOf('accessibilityLabel="Retry deleting all local data"'),
    RESET_SHIELD_SOURCE.indexOf('accessibilityLabel="Retry deleting all local data"') + 900,
  );
  assert.match(retryDeletion, /backgroundColor:\s*colors\.rose/);
  assert.match(retryDeletion, /color:\s*colors\.brandNavy/);
});
