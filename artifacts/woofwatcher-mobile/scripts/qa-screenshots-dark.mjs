#!/usr/bin/env node
/**
 * Dark-mode QA sweep: captures every primary route of the served web export at
 * iPhone 390x844 with prefers-color-scheme: dark emulated, for auditing the
 * dark theme against Apollo's mock boards (handoff docs §4-B). Mirrors
 * qa-screenshots.mjs but forces the dark scheme and adds the four standalone
 * board screens (Trends / Profile / Reminders / month Calendar).
 *
 * The export MUST be built so the web build follows the system scheme:
 *   EXPO_PUBLIC_WEB_COLOR_SCHEME=auto node scripts/smoke-web-export.js
 *   node scripts/serve-smoke-preview.js 4194 &
 *   node scripts/qa-screenshots-dark.mjs [outDir]
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:4194";
const OUT = process.argv[2] ?? "/tmp/qa-shots-dark";
fs.mkdirSync(OUT, { recursive: true });

const ROUTES = [
  ["home", "/", 4500],
  ["log", "/log", 3500],
  ["plan-calendar", "/calendar", 3500],
  ["health", "/health", 3500],
  ["records", "/records", 3500],
  ["pack", "/pack", 3500],
  ["story", "/story", 3500],
  ["more", "/more", 3500],
  ["fastlog", "/fastlog", 3000],
  ["portrait", "/portrait", 4000],
  ["trends", "/trends", 3800],
  ["profile", "/profile", 3500],
  ["reminders", "/reminders", 3500],
  ["calendar-month", "/calendar-month", 3500],
  ["adventure", "/adventure", 3500],
  ["woofguide", "/woofguide", 3000],
];

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  colorScheme: "dark",
});
const errors = {};
let current = "boot";
page.on("pageerror", (err) => {
  (errors[current] ??= []).push(String(err).slice(0, 300));
});
page.on("console", (msg) => {
  if (msg.type() === "error") (errors[current] ??= []).push(msg.text().slice(0, 300));
});

for (const [name, route, settle] of ROUTES) {
  current = name;
  try {
    await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(settle);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    const scrolled = await page.evaluate(() => {
      const el = [...document.querySelectorAll("*")].find(
        (n) => n.scrollHeight > n.clientHeight + 300 && n.clientHeight > 400,
      );
      if (el) {
        el.scrollTop = el.scrollHeight;
        return true;
      }
      window.scrollTo(0, document.body.scrollHeight);
      return false;
    });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${name}-2.png` });
    console.log("SHOT", name, scrolled ? "(scrolled)" : "");
  } catch (e) {
    console.log("MISS", name, String(e).slice(0, 160));
  }
}
fs.writeFileSync(`${OUT}/errors.json`, JSON.stringify(errors, null, 2));
console.log("done ->", OUT);
await browser.close();
