#!/usr/bin/env node
/**
 * Populated-account QA: seeds ~14 days of realistic care entries into the web
 * export's local cache, then screenshots the data-driven screens so the charts,
 * timelines, meters, and adventure derivations can be reviewed with real data
 * (the fresh-account sweep only exercises the honest empty states). Closes the
 * handoff's "re-check on a populated account" item.
 *
 *   node scripts/smoke-web-export.js
 *   node scripts/serve-smoke-preview.js 4194 &
 *   node scripts/qa-seed-populated.mjs [outDir]
 *
 * Entry shapes here mirror what the app writes (CareContext STORAGE_KEY
 * "woofwatcher.v2.state" = { doc, entries, serverVersion }); only `entries` is
 * seeded so the default profile/routines stay intact. Types come from
 * care-domain CARE_EVENT_TYPES; mood keys from MOOD_META
 * (happy/excited/calm/anxious/unwell).
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:4194";
const OUT = process.argv[2] ?? "/tmp/qa-seed-populated";
fs.mkdirSync(OUT, { recursive: true });

const now = Date.now();
const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString();
const care = ["Alex", "Sam", "Jordan"];
const moods = ["happy", "excited", "calm", "happy", "calm", "anxious", "happy"];
let n = 0;
const id = () => `seed_${(n++).toString(36)}`;
const entries = [];
for (let d = 13; d >= 0; d--) {
  const base = now - d * DAY;
  const at = (h, m = 0) => iso(base - (base % DAY) + h * 3600000 + m * 60000);
  const cg = care[d % care.length];
  entries.push({ id: id(), type: "meal", title: "Breakfast", caregiver: cg, occurredAt: at(7, 30), amount: "1 cup", food: "Kibble + topper" });
  entries.push({ id: id(), type: "meal", title: "Dinner", caregiver: cg, occurredAt: at(18, 15), amount: "1 cup", food: "Kibble" });
  for (const h of [7, 12, 17, 21]) if ((h + d) % 5 !== 0) entries.push({ id: id(), type: "potty", title: "Potty", caregiver: cg, occurredAt: at(h, 5), details: { outcome: h % 2 ? "pee" : "poop" } });
  entries.push({ id: id(), type: "water", title: "Water refill", caregiver: cg, occurredAt: at(8) });
  if (d % 7 !== 3) entries.push({ id: id(), type: "walk", title: "Morning walk", caregiver: cg, occurredAt: at(8, 10), durationMinutes: 20 + (d % 4) * 8, details: { place: "River Loop" } });
  if (d % 2 === 0) entries.push({ id: id(), type: "walk", title: "Evening walk", caregiver: cg, occurredAt: at(19), durationMinutes: 15 + (d % 3) * 6, details: { place: "Neighborhood" } });
  if (d % 3 === 0) entries.push({ id: id(), type: "play", title: "Fetch", caregiver: cg, occurredAt: at(16), durationMinutes: 12 + (d % 3) * 4 });
  if (d % 4 === 1) entries.push({ id: id(), type: "training", title: "Sit & stay", caregiver: cg, occurredAt: at(11), durationMinutes: 10 + (d % 2) * 5 });
  entries.push({ id: id(), type: "mood", title: "Mood check", caregiver: cg, occurredAt: at(20), mood: moods[d % moods.length], details: { energyLevel: d % 3 === 0 ? "high" : "steady" } });
  if (d % 4 === 0) entries.push({ id: id(), type: "weight", title: "Weigh-in", caregiver: cg, occurredAt: at(9), amount: `${(28.5 - d * 0.05).toFixed(1)} lb`, details: { value: 28.5 - d * 0.05, unit: "lb" } });
}

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium",
  args: ["--no-sandbox"],
});
const scheme = process.env.QA_COLOR_SCHEME === "dark" ? "dark" : "light";
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: scheme });
const errors = {};
let current = "boot";
page.on("pageerror", (e) => (errors[current] ??= []).push(String(e).slice(0, 300)));
page.on("console", (m) => { if (m.type() === "error") (errors[current] ??= []).push(m.text().slice(0, 300)); });

await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.evaluate((seed) => {
  localStorage.setItem("woofwatcher.v2.state", JSON.stringify({ entries: seed }));
  localStorage.setItem("woofwatcher.homeWelcomeDismissed.v1", "true");
}, entries);
console.log(`seeded ${entries.length} entries across 14 days (${scheme})`);

const shoot = async (name, route, settle = 3500) => {
  current = name;
  try {
    await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(settle);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    const scrolled = await page.evaluate(() => {
      const el = [...document.querySelectorAll("*")].find((x) => x.scrollHeight > x.clientHeight + 300 && x.clientHeight > 400);
      if (el) { el.scrollTop = el.scrollHeight; return true; }
      window.scrollTo(0, document.body.scrollHeight); return false;
    });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${name}-2.png` });
    console.log("SHOT", name, scrolled ? "(scrolled)" : "");
  } catch (e) { console.log("MISS", name, String(e).slice(0, 140)); }
};

for (const [name, route, settle] of [
  ["home", "/", 4500],
  ["trends", "/trends", 4000],
  ["calendar-month", "/calendar-month", 3500],
  ["plan-calendar", "/calendar", 3500],
  ["health", "/health", 3800],
  ["records", "/records", 3500],
  ["log", "/log", 3500],
  ["story", "/story", 3800],
  ["reminders", "/reminders", 3500],
]) {
  await shoot(name, route, settle);
}

fs.writeFileSync(`${OUT}/errors.json`, JSON.stringify(errors, null, 2));
console.log("done ->", OUT);
await browser.close();
