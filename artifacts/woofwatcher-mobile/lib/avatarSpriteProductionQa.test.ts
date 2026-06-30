import { test } from "node:test";
import assert from "node:assert/strict";

import { buildAvatarSpriteProductionQaSummary } from "./avatarSpriteProductionQa.ts";

test("builds a source-backed avatar sprite production QA summary", () => {
  const summary = buildAvatarSpriteProductionQaSummary();

  assert.equal(summary.totalTemplates, 12);
  assert.equal(summary.liveTemplatePacks, 12);
  assert.equal(summary.missingTemplatePacks.length, 0);
  assert.ok(summary.totalSpriteSlots >= 24);
  assert.match(summary.nativeBoundary, /Local sprite metadata only/);
  assert.match(summary.nativeBoundary, /iOS and Android screenshots/);
  assert.match(summary.launchRisk, /gait/);
  assert.match(summary.launchRisk, /crop/);

  const labels = summary.templates.map((template) => template.label);
  assert.ok(labels.includes("Shepherd"));
  assert.ok(labels.includes("Retriever"));
  assert.ok(labels.includes("Husky / Spitz"));
  assert.ok(labels.includes("Bully"));
  assert.ok(labels.includes("Mixed Breed"));

  assert.ok(
    summary.templates.every(
      (template) =>
        template.spritePackReady &&
        template.actions.map((action) => action.action).includes("idle-tail-wag") &&
        template.actions.map((action) => action.action).includes("walk-loop"),
    ),
  );
  assert.ok(summary.templates.every((template) => template.requiredChecks.length >= 6));
  assert.ok(summary.requiredChecks.some((check) => /duplicate|second avatar/i.test(check)));
  assert.ok(summary.requiredChecks.some((check) => /bottom-center/i.test(check)));
  assert.ok(summary.requiredChecks.some((check) => /gait/i.test(check)));
  assert.ok(summary.requiredChecks.some((check) => /iOS and Android/i.test(check)));
});
