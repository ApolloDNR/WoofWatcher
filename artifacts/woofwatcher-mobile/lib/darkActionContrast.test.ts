import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import palette from "../constants/colors.ts";

const readMobileSource = (...parts: string[]) =>
  readFileSync(join(process.cwd(), "artifacts", "woofwatcher-mobile", ...parts), "utf8");

type Rgb = readonly [number, number, number];

function rgb(hex: string): Rgb {
  assert.match(hex, /^#[0-9A-F]{6}$/i, `expected a six-digit hex color, received ${hex}`);
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function composite(top: string, bottom: string, alpha: number): Rgb {
  const topRgb = rgb(top);
  const bottomRgb = rgb(bottom);
  return topRgb.map((channel, index) =>
    channel * alpha + bottomRgb[index] * (1 - alpha),
  ) as unknown as Rgb;
}

function relativeLuminance(color: string | Rgb): number {
  const channels = typeof color === "string" ? rgb(color) : color;
  const [red, green, blue] = channels.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrastRatio(first: string | Rgb, second: string | Rgb): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

function assertContrast(
  foreground: string | Rgb,
  background: string | Rgb,
  minimum: number,
  description: string,
): void {
  const ratio = contrastRatio(foreground, background);
  assert.ok(
    ratio >= minimum,
    `${description} is ${ratio.toFixed(3)}:1; expected at least ${minimum}:1`,
  );
}

test("Board pills keep AA text and a visible semantic border on both card surfaces", () => {
  const source = readMobileSource("components", "board", "BoardPrimitives.tsx");

  assert.match(
    source,
    /const pillForeground = active[\s\S]{0,120}pillTone === colors\.primary[\s\S]{0,100}colors\.primaryForeground[\s\S]{0,80}colors\.brandNavy[\s\S]{0,80}colors\.foreground/,
  );
  assert.match(
    source,
    /const activeBackground = colors\.isDark \? pillTone : `\$\{pillTone\}E6`/,
  );
  assert.match(
    source,
    /backgroundColor: active \? activeBackground : pillTone \+ "24"/,
  );
  assert.match(source, /borderColor: pillTone/);
  assert.match(source, /pill:\s*\{[\s\S]{0,120}borderWidth:\s*1/);
  assert.doesNotMatch(source, /const pillForeground[\s\S]{0,100}["']#000000["']/);
  assert.match(source, /color=\{pillForeground\}/);
  assert.match(source, /pillText[\s\S]{0,100}color: pillForeground/);

  for (const [themeName, theme] of [
    ["light", palette.light],
    ["dark", palette.dark],
  ] as const) {
    for (const toneName of ["sage", "copper"] as const) {
      for (const surfaceName of ["background", "card"] as const) {
        const activeSurface =
          themeName === "dark"
            ? theme[toneName]
            : composite(theme[toneName], theme[surfaceName], 0xe6 / 255);
        assertContrast(
          theme.brandNavy,
          activeSurface,
          4.5,
          `${themeName} active ${toneName} pill text on ${surfaceName}`,
        );
        assertContrast(
          theme.foreground,
          composite(theme[toneName], theme[surfaceName], 0x24 / 255),
          4.5,
          `${themeName} ${toneName} pill text on ${surfaceName}`,
        );
        assertContrast(
          theme[toneName],
          theme[surfaceName],
          3,
          `${themeName} ${toneName} pill border on ${surfaceName}`,
        );
      }
    }
    const activePrimarySurface =
      themeName === "dark"
        ? theme.primary
        : composite(theme.primary, theme.card, 0xe6 / 255);
    assertContrast(
      theme.primaryForeground,
      activePrimarySurface,
      4.5,
      `${themeName} active primary pill text`,
    );
  }
});

test("Calendar and WoofGuide normal text use the measured bright-copper/navy pair", () => {
  const calendar = readMobileSource("app", "(tabs)", "calendar.tsx");
  const guide = readMobileSource("components", "more", "WoofGuideScreen.tsx");

  assert.match(
    calendar,
    /discoverGo,[\s\S]{0,220}backgroundColor: colors\.copperBright/,
  );
  assert.match(
    calendar,
    /discoverGoText, \{ color: colors\.brandNavy/,
  );
  assert.match(
    calendar,
    /routineFeedbackButton,[\s\S]{0,320}colors\.copperBright[\s\S]{0,360}color: colors\.brandNavy/,
  );
  assert.match(
    guide,
    /s\.userBubble, \{ backgroundColor: colors\.copperBright \}/,
  );
  assert.match(
    guide,
    /item\.role === "user" \? colors\.brandNavy : colors\.foreground/,
  );

  for (const [themeName, theme] of [
    ["light", palette.light],
    ["dark", palette.dark],
  ] as const) {
    assertContrast(
      theme.brandNavy,
      theme.copperBright,
      4.5,
      `${themeName} bright-copper normal text action`,
    );
  }
});

test("WoofGuide's small labels use semantic foregrounds instead of decorative copper", () => {
  const guide = readMobileSource("components", "more", "WoofGuideScreen.tsx");

  assert.match(
    guide,
    /s\.guideKicker, \{ color: colors\.brandNavy/,
  );
  assert.match(
    guide,
    /s\.guideBoundaryLabel, \{ color: colors\.brandNavy/,
  );
  assert.match(
    guide,
    /s\.guideIntroKicker, \{ color: colors\.primary/,
  );
  assert.match(guide, /s\.gateWorksLabel, \{ color: colors\.primary/);
  assert.match(guide, /s\.reviewEyebrow, \{ color: colors\.primary/);

  for (const [themeName, theme] of [
    ["light", palette.light],
    ["dark", palette.dark],
  ] as const) {
    assertContrast(
      theme.primary,
      theme.card,
      4.5,
      `${themeName} WoofGuide small label`,
    );
    assertContrast(
      theme.brandNavy,
      theme.ivory,
      4.5,
      `${themeName} WoofGuide light speech label`,
    );
  }
});

test("Plans' unchecked completion control has a visible primary outline and glyph", () => {
  const calendar = readMobileSource("app", "(tabs)", "calendar.tsx");

  assert.match(
    calendar,
    /borderColor: done \? colors\.sage : needsCorrection \? colors\.amber : colors\.primary/,
  );
  assert.match(
    calendar,
    /name=\{done \? "checkmark" : needsCorrection \? "warning-outline" : "checkmark"\}/,
  );
  assert.match(
    calendar,
    /color=\{done \? colors\.brandNavy : needsCorrection \? colors\.amber : colors\.primary\}/,
  );

  for (const [themeName, theme] of [
    ["light", palette.light],
    ["dark", palette.dark],
  ] as const) {
    assertContrast(
      theme.primary,
      theme.card,
      3,
      `${themeName} Plans completion outline`,
    );
  }
});

test("Premium CTA and recommended price use measured AA token pairs", () => {
  const source = readMobileSource("app", "premium.tsx");

  assert.match(
    source,
    /premiumValueAction,[\s\S]{0,160}backgroundColor: colors\.primary/,
  );
  assert.match(
    source,
    /premiumValueActionText,[\s\S]{0,100}color: colors\.primaryForeground/,
  );
  assert.match(
    source,
    /name="arrow-forward"[\s\S]{0,80}color=\{colors\.primaryForeground\}/,
  );
  assert.match(
    source,
    /priceText,[\s\S]{0,100}recommended \? colors\.primaryForeground : colors\.foreground/,
  );

  for (const [themeName, theme] of [
    ["light", palette.light],
    ["dark", palette.dark],
  ] as const) {
    assertContrast(
      theme.primaryForeground,
      theme.primary,
      4.5,
      `${themeName} premium primary action and price`,
    );
  }
});

test("Privacy uses a real dark gradient and an AA rose confirmation foreground", () => {
  const source = readMobileSource("components", "more", "PrivacyDataScreen.tsx");

  assert.match(
    source,
    /colors=\{colors\.isDark\s*\?\s*\[colors\.brandNavy, colors\.shellNavy\]/,
  );
  assert.match(
    source,
    /s\.confirmPrimaryBtn[\s\S]{0,220}backgroundColor: colors\.rose/,
  );
  assert.match(
    source,
    /s\.confirmPrimaryText[\s\S]{0,180}color: colors\.brandNavy/,
  );
  assert.notEqual(
    palette.dark.brandNavy,
    palette.dark.shellNavy,
    "dark Privacy hero gradient stops must not resolve to the same color",
  );

  for (const [themeName, theme] of [
    ["light", palette.light],
    ["dark", palette.dark],
  ] as const) {
    assertContrast(
      theme.brandNavy,
      theme.rose,
      4.5,
      `${themeName} destructive confirmation`,
    );
    assertContrast("#FFFFFF", theme.brandNavy, 4.5, `${themeName} hero first stop`);
    assertContrast("#FFFFFF", theme.shellNavy, 4.5, `${themeName} hero second stop`);
  }
});

test("primary-action glyph token choices meet non-text contrast", () => {
  const privacy = readMobileSource("components", "more", "PrivacyDataScreen.tsx");
  const fastLog = readMobileSource("app", "fastlog.tsx");

  assert.match(
    privacy,
    /name="download-outline"[\s\S]{0,80}color=\{colors\.primaryForeground\}/,
  );
  assert.equal(
    [
      ...fastLog.matchAll(
        /name="checkmark"[\s\S]{0,100}?color=\{colors\.isDark \? colors\.brandNavy : "#FFFFFF"\}/g,
      ),
    ].length,
    2,
  );

  for (const [themeName, theme] of [
    ["light", palette.light],
    ["dark", palette.dark],
  ] as const) {
    assertContrast(
      theme.primaryForeground,
      theme.primary,
      3,
      `${themeName} Privacy download icon`,
    );
    assertContrast(
      themeName === "dark" ? theme.brandNavy : "#FFFFFF",
      theme.sage,
      3,
      `${themeName} Fast Log checkmark`,
    );
  }
});
