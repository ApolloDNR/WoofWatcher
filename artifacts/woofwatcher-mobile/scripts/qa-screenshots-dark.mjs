#!/usr/bin/env node
/**
 * Dark-mode QA sweep: captures every executable consumer route represented by
 * the navigation manifest, plus standalone fast-log/month-calendar screens, at
 * iPhone 390x844 with prefers-color-scheme: dark emulated.
 *
 * The consumer candidate export MUST be built so the web build follows the
 * system scheme and owner-only tooling remains outside this sweep:
 *   EXPO_PUBLIC_WEB_COLOR_SCHEME=auto node scripts/smoke-web-export.js --candidate
 *   node scripts/serve-smoke-preview.js 4194 &
 *   node scripts/qa-screenshots-dark.mjs [outDir]
 */
import { chromium } from "playwright";
import fs from "node:fs";
import {
  QA_SCREENSHOT_ROUTES,
  assertConsumerCandidatePreview,
  browserErrorCount,
  createPageDiagnostics,
  normalizeBaseUrl,
  printBrowserErrors,
  routeUrl,
  screenshotSweepFailed,
  scrollToReviewTail,
  waitForStablePage,
} from "./qa-browser-harness.mjs";

const BASE = normalizeBaseUrl(process.env.BASE_URL ?? "http://127.0.0.1:4194");
const OUT = process.argv[2] ?? "/tmp/qa-shots-dark";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  colorScheme: "dark",
});
const diagnostics = createPageDiagnostics(page);
const misses = [];
await assertConsumerCandidatePreview(page, BASE);

for (const { name, route, settle } of QA_SCREENSHOT_ROUTES) {
  diagnostics.setStep(name);
  try {
    await page.goto(routeUrl(BASE, route), {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await waitForStablePage(page, settle);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    const scrolled = await scrollToReviewTail(page);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${name}-2.png` });
    console.log("SHOT", name, scrolled ? "(scrolled)" : "");
  } catch (e) {
    const detail = String(e).slice(0, 300);
    misses.push({ name, route, detail });
    diagnostics.record(`MISS ${route}: ${detail}`, name);
    console.error("MISS", name, detail);
  }
}
await browser.close();
fs.writeFileSync(
  `${OUT}/errors.json`,
  JSON.stringify(diagnostics.errors, null, 2),
);
printBrowserErrors(diagnostics.errors);
console.log(
  `done -> ${OUT} (${QA_SCREENSHOT_ROUTES.length - misses.length}/${QA_SCREENSHOT_ROUTES.length} routes; ${browserErrorCount(diagnostics.errors)} errors)`,
);
if (screenshotSweepFailed({ errors: diagnostics.errors, misses })) {
  process.exitCode = 1;
}
