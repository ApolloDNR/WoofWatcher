import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const appEntry = readFileSync(join(here, "app-entry.js"), "utf8");
const productViewModel = readFileSync(join(here, "woof-product-view-model.js"), "utf8");
const core = readFileSync(join(here, "woof-core.js"), "utf8");

function extractConstArray(source, name) {
  const match = source.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
  assert.ok(match, `${name} array should exist`);
  return match[1];
}

test("keeps the PWA shell aligned with v1.5 navigation", () => {
  assert.match(appEntry, /const THEME_KEY = "woofwatcher\.v1\.theme"/);
  assert.match(appEntry, /function renderDesktopSidebar/);
  assert.match(appEntry, /Care & Wellbeing/);
  assert.match(appEntry, /More Tools/);
  assert.match(appEntry, /Avatar Studio/);
  assert.match(appEntry, /data-action="toggle-theme"/);
  assert.match(appEntry, /data-form="top-search"/);
  assert.match(
    appEntry,
    /renderNavButton\("phoenix", "Home"\)[\s\S]*renderNavButton\("log", "Log"\)[\s\S]*renderNavButton\("plans", "Plans"\)[\s\S]*renderNavButton\("health", "Health"\)[\s\S]*renderNavButton\("more", "More"\)/,
  );
});

test("keeps Potty as the PWA quick-log parent action", () => {
  const entryOptions = extractConstArray(appEntry, "ENTRY_SELECT_OPTIONS");
  assert.match(entryOptions, /"potty"/);
  assert.doesNotMatch(entryOptions, /"pee"/);
  assert.doesNotMatch(entryOptions, /"poop"/);

  assert.match(productViewModel, /key: "potty"/);
  assert.match(productViewModel, /detailLevel: "outcome-flow"/);
  assert.doesNotMatch(productViewModel, /key: "pee"/);
  assert.doesNotMatch(productViewModel, /key: "poop"/);
  assert.match(productViewModel, /"pottyLocation"/);
  assert.match(productViewModel, /"pottyOutcome"/);
});

test("preserves the PWA meal served-to-outcome lifecycle contract", () => {
  assert.match(productViewModel, /"mealType"/);
  assert.match(productViewModel, /"servedAt"/);
  assert.match(productViewModel, /"servedBy"/);
  assert.match(productViewModel, /"portionOffered"/);
  assert.match(productViewModel, /"portionEaten"/);
  assert.match(productViewModel, /"outcomeAt"/);
  assert.match(productViewModel, /"outcomeBy"/);
  assert.match(core, /mealType: cleanText\(input\.mealType\)/);
  assert.match(core, /servedAt: input\.servedAt \? normalizeDate\(input\.servedAt\) : ""/);
  assert.match(core, /outcomeAt: input\.outcomeAt \? normalizeDate\(input\.outcomeAt\) : ""/);
});

test("keeps Phoenix Home wired to open meal outcome tasks", () => {
  assert.match(appEntry, /function renderPhoenixStatusCard/);
  assert.match(appEntry, /function getOpenMealOutcomeTask/);
  assert.match(appEntry, /data-action="meal-outcome"/);
  assert.match(appEntry, /Meal outcome updated:/);
  assert.match(appEntry, /No open meal outcomes\. Care proof is current\./);
});

test("keeps Quick Log v2 wired to dedicated meal and potty flows", () => {
  assert.match(appEntry, /let activeQuickFlow/);
  assert.match(appEntry, /function renderQuickLogFlowPanel/);
  assert.match(appEntry, /function renderMealLifecycleFlow/);
  assert.match(appEntry, /data-form="meal-lifecycle"/);
  assert.match(appEntry, /Serve meal/);
  assert.match(appEntry, /Update open meal/);
  assert.match(appEntry, /function renderPottyOutcomeFlow/);
  assert.match(appEntry, /data-form="potty-outcome"/);
  assert.match(appEntry, /What happened\?/);
  assert.match(appEntry, /Tried, nothing/);
});
