import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MOBILE_ROOT = join(
  process.cwd(),
  "artifacts",
  "woofwatcher-mobile",
);
const MORE_ROUTE_PATH = join(MOBILE_ROOT, "app", "(tabs)", "more.tsx");
const DIET_SCREEN_PATH = join(
  MOBILE_ROOT,
  "components",
  "health",
  "DietScreen.tsx",
);
const HEALTH_SECTION_ROUTER_PATH = join(
  MOBILE_ROOT,
  "components",
  "health",
  "HealthSectionRouter.tsx",
);

function readDietScreen(): string {
  assert.ok(
    existsSync(DIET_SCREEN_PATH),
    "Health must own the substantive Diet screen before More can delegate it",
  );
  return readFileSync(DIET_SCREEN_PATH, "utf8");
}

test("moves the one Diet workflow from More to the canonical Health owner", () => {
  const more = readFileSync(MORE_ROUTE_PATH, "utf8");
  const diet = readDietScreen();
  assert.ok(
    existsSync(HEALTH_SECTION_ROUTER_PATH),
    "HealthSectionRouter must own the extracted Diet screen",
  );
  const healthRouter = readFileSync(HEALTH_SECTION_ROUTER_PATH, "utf8");

  assert.doesNotMatch(more, /import DietScreen from "@\/components\/health\/DietScreen";/);
  assert.equal((more.match(/<DietScreen\b/g) ?? []).length, 0);
  assert.match(healthRouter, /import DietScreen from "@\/components\/health\/DietScreen";/);
  assert.equal((healthRouter.match(/<DietScreen\b/g) ?? []).length, 1);
  assert.match(healthRouter, /<DietScreen openDetails/);

  for (const staleOwner of [
    /const \[dietOpen, setDietOpen\]/,
    /const \[dietEditOpen, setDietEditOpen\]/,
    /const \[dPrimaryFood, setDPrimaryFood\]/,
    /const openDietEdit =/,
    /const saveDiet =/,
    /title="Diet Profile"/,
  ]) {
    assert.doesNotMatch(more, staleOwner);
  }

  assert.match(
    diet,
    /export default function DietScreen\(\{\s*openDetails = false,\s*\}: DietScreenProps\)/,
  );
  assert.match(diet, /if \(openDetails\) setDietOpen\(true\);/);
  assert.match(diet, /title="Diet Profile"/);
  assert.match(diet, /No diet set yet/);
  assert.match(diet, /Add food and portions with Edit\./);
  assert.match(diet, /\{[A-Za-z]+\.value \|\| "Not set"\}/);
});

test("preserves every Diet field and gates its only write before success feedback", () => {
  const diet = readDietScreen();

  const fields = [
    ["PRIMARY FOOD", "e.g. Royal Canin GI dry kibble"],
    ["NORMAL PORTION", "e.g. 1¼ cups twice daily"],
    ["MEAL SCHEDULE", "e.g. 7 AM and 6 PM"],
    ["TOPPERS", "e.g. Bone broth, low-sodium"],
    ["SUPPLEMENTS", "e.g. Probiotic daily"],
    ["BEDTIME SNACK", "e.g. ½ cup kibble at 10 PM"],
    ["TREATS ALLOWED", "e.g. Zuke's minis, max 3/day"],
    ["AVOID", "e.g. Grains, chicken, rawhide"],
    ["SENSITIVITIES", "e.g. Chicken allergy confirmed"],
    ["APPETITE QUIRKS", "e.g. Eats slowly, dislikes change"],
    ["VET NOTES", "e.g. Low-fat diet per Dr. Kim"],
  ] as const;
  for (const [label, placeholder] of fields) {
    assert.ok(diet.includes(`label: "${label}"`), `${label} must remain editable`);
    assert.ok(diet.includes(`placeholder: "${placeholder}"`), `${label} must keep its help text`);
  }

  for (const label of [
    "Food",
    "Portion",
    "Schedule",
    "Toppers",
    "Bedtime snack",
    "Treats",
    "Avoid",
  ]) {
    assert.ok(diet.includes(`label: "${label}"`), `${label} must remain in the Diet summary`);
  }

  const persistedDrafts = [
    ["primaryFood", "dPrimaryFood"],
    ["normalPortion", "dNormalPortion"],
    ["mealSchedule", "dMealSchedule"],
    ["toppers", "dToppers"],
    ["supplements", "dSupplements"],
    ["bedtimeSnack", "dBedtimeSnack"],
    ["treatsAllowed", "dTreatsAllowed"],
    ["avoid", "dAvoid"],
    ["sensitivities", "dSensitivities"],
    ["appetiteQuirks", "dAppetiteQuirks"],
    ["vetNotes", "dVetNotes"],
  ] as const;
  for (const [property, draft] of persistedDrafts) {
    assert.match(
      diet,
      new RegExp(`${property}: ${draft}\\.trim\\(\\)`),
      `${property} must be trimmed and persisted`,
    );
  }

  assert.equal((diet.match(/\bupdateCareDoc\(/g) ?? []).length, 1);
  assert.equal((diet.match(/\brunAcceptedCareMutation\(/g) ?? []).length, 1);
  const blockedIndex = diet.indexOf("if (careMutationsBlocked)");
  const writeIndex = diet.indexOf("const updated = updateCareDoc(");
  const acceptedIndex = diet.indexOf("const accepted = runAcceptedCareMutation(");
  const rejectedIndex = diet.indexOf("if (!accepted) showCareReadOnly();");
  assert.ok(blockedIndex >= 0 && blockedIndex < writeIndex);
  assert.ok(writeIndex < acceptedIndex && acceptedIndex < rejectedIndex);
  assert.match(
    diet.slice(acceptedIndex, rejectedIndex),
    /Haptics\.impactAsync\(Haptics\.ImpactFeedbackStyle\.Light\);[\s\S]*setDietEditOpen\(false\);/,
  );
  assert.match(diet, /notifyDialog\("Update WoofWatcher", CARE_READ_ONLY_MESSAGE\)/);
  assert.match(diet, /MOBILE_INLINE_HIT_SLOP/);
  assert.match(diet, /profSaveBtn:[\s\S]{0,180}MIN_MOBILE_TOUCH_TARGET/);
});
