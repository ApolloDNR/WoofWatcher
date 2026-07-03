import { test } from "node:test";
import assert from "node:assert/strict";

test("defines the WoofGuide AI provider proof packet before live AI can be enabled", async () => {
  const mod = await import("./aiProviderProof.ts").catch(() => null);
  assert.ok(mod, "aiProviderProof module should exist");

  assert.match(mod.AI_PROVIDER_PROOF_SUMMARY, /WoofGuide AI provider proof packet/);
  assert.match(mod.AI_PROVIDER_PROOF_SUMMARY, /OpenAI key location/);
  assert.match(mod.AI_PROVIDER_PROOF_SUMMARY, /approved model policy/);
  assert.match(mod.AI_PROVIDER_PROOF_SUMMARY, /source\/citation rules/);
  assert.match(mod.AI_PROVIDER_PROOF_SUMMARY, /owner-review write gate/);
  assert.match(mod.AI_PROVIDER_PROOF_SUMMARY, /veterinary safety boundary/);

  assert.deepEqual(
    mod.AI_PROVIDER_PROOF_ITEMS.map((item) => item.label),
    [
      "Provider key and secret storage",
      "Approved model policy",
      "Source and citation rules",
      "Owner-review write gate",
      "Veterinary safety boundary",
      "Fallback and incident handling",
    ],
  );
  assert.ok(
    mod.AI_PROVIDER_PROOF_ITEMS.some(
      (item) =>
        item.label === "Provider key and secret storage" &&
        /OpenAI key location/.test(item.requiredEvidence) &&
        /secret storage/.test(item.requiredEvidence),
    ),
  );
  assert.ok(
    mod.AI_PROVIDER_PROOF_ITEMS.some(
      (item) =>
        item.label === "Approved model policy" &&
        /model id/.test(item.requiredEvidence) &&
        /prompt policy/.test(item.requiredEvidence),
    ),
  );
  assert.ok(
    mod.AI_PROVIDER_PROOF_ITEMS.some(
      (item) =>
        item.label === "Source and citation rules" &&
        /source labels/.test(item.requiredEvidence) &&
        /citation/.test(item.requiredEvidence),
    ),
  );
  assert.ok(
    mod.AI_PROVIDER_PROOF_ITEMS.some(
      (item) =>
        item.label === "Owner-review write gate" &&
        /owner-reviewed/.test(item.requiredEvidence) &&
        /no automatic care-log writes/.test(item.requiredEvidence),
    ),
  );
  assert.ok(
    mod.AI_PROVIDER_PROOF_ITEMS.some(
      (item) =>
        item.label === "Veterinary safety boundary" &&
        /not veterinary advice/.test(item.requiredEvidence) &&
        /emergency escalation/.test(item.requiredEvidence),
    ),
  );
  assert.ok(
    mod.AI_PROVIDER_PROOF_ITEMS.some(
      (item) =>
        item.label === "Fallback and incident handling" &&
        /fallback copy/.test(item.requiredEvidence) &&
        /rate-limit/.test(item.requiredEvidence),
    ),
  );
});
