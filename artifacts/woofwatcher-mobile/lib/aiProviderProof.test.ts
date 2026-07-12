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

test("builds a blocked WoofGuide AI provider proof manifest before live AI can be enabled", async () => {
  const mod = await import("./aiProviderProof.ts").catch(() => null);
  assert.ok(mod, "aiProviderProof module should exist");

  const manifest = mod.buildAiProviderProofManifest({});

  assert.equal(manifest.title, "WoofGuide AI provider proof manifest");
  assert.equal(manifest.status, "blocked");
  assert.equal(manifest.statusLabel, "Live AI blocked");
  assert.equal(manifest.liveAiAllowed, false);
  assert.equal(manifest.readyCount, 0);
  assert.equal(manifest.openCount, 6);
  assert.match(manifest.summary, /deterministic/);
  assert.match(manifest.summary, /owner-reviewed/);
  assert.ok(manifest.items.every((item) => item.status === "blocked"));
  assert.ok(manifest.blockers.some((blocker) => /OpenAI key location/.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /not veterinary advice/.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /no automatic care-log writes/.test(blocker)));
});

test("keeps WoofGuide AI provider proof blocked when generic approvals lack structured proof files", async () => {
  const mod = await import("./aiProviderProof.ts").catch(() => null);
  assert.ok(mod, "aiProviderProof module should exist");

  const genericManifest = mod.buildAiProviderProofManifest({
    providerKeyStorage: "OpenAI key storage approved",
    approvedModelPolicy: "Model policy approved",
    sourceCitationRules: "Source and citation rules approved",
    ownerReviewWriteGate: "Owner review write gate approved",
    veterinarySafetyBoundary: "Veterinary safety approved",
    fallbackIncidentHandling: "Fallback handling approved",
  });

  assert.equal(genericManifest.status, "blocked");
  assert.equal(genericManifest.liveAiAllowed, false);
  assert.equal(genericManifest.readyCount, 0);
  assert.equal(genericManifest.openCount, 6);
  assert.ok(
    genericManifest.blockers.some((blocker) =>
      /OpenAI key location, secret storage, environment scope/.test(blocker),
    ),
  );

  const structuredManifest = mod.buildAiProviderProofManifest({
    providerKeyStorage: "OpenAI key storage approved",
    approvedModelPolicy: "Model policy approved",
    sourceCitationRules: "Source and citation rules approved",
    ownerReviewWriteGate: "Owner review write gate approved",
    veterinarySafetyBoundary: "Veterinary safety approved",
    fallbackIncidentHandling: "Fallback handling approved",
    aiProviderEvidence: [
      {
        kind: "provider-key-storage",
        fileName: "openai-secret-storage-proof.json",
        mimeType: "application/json",
        byteSize: 1200,
        openAiKeyLocation: "server environment secret store",
        secretStorage: "production secret manager",
        environmentScope: "production and preview",
        rotationOwner: "Apollo",
        localPlaceholdersExcluded: true,
      },
      {
        kind: "model-policy",
        fileName: "woofguide-model-policy-proof.md",
        mimeType: "text/markdown",
        byteSize: 1300,
        approvedModelId: "gpt-approved-woofguide",
        promptPolicy: "bounded care assistant prompts",
        systemInstructions: "no diagnosis, owner-reviewed actions",
        dataRetentionStance: "approved retention stance",
        allowedTasks: "summaries, notes, handoffs",
        safetyReviewed: true,
      },
      {
        kind: "source-citation-rules",
        fileName: "woofguide-source-citation-proof.json",
        mimeType: "application/json",
        byteSize: 1400,
        sourceLabels: "care logs, records, reports",
        citationBehavior: "visible source labels",
        sourceFreshnessRules: "stale source warnings",
        localCareLogBoundary: "local logs named as local",
        visibleBoundaryApproved: true,
      },
      {
        kind: "owner-review-write-gate",
        fileName: "woofguide-owner-review-write-gate-proof.json",
        mimeType: "application/json",
        byteSize: 1500,
        ownerReviewedDraftFlow: "draft, review, approve",
        auditCopy: "reviewed by owner",
        noAutomaticCareLogWrites: true,
        noDirectRecordMutation: true,
      },
      {
        kind: "veterinary-safety-boundary",
        fileName: "woofguide-veterinary-safety-proof.md",
        mimeType: "text/markdown",
        byteSize: 1600,
        notVeterinaryAdviceCopy: "not veterinary advice",
        emergencyEscalationLanguage: "contact a vet for urgent signs",
        diagnosisTreatmentRefusalExamples: "refuses diagnosis and treatment plans",
        vetContactGuidance: "share records with a veterinarian",
        safetyApproved: true,
      },
      {
        kind: "fallback-incident-handling",
        fileName: "woofguide-fallback-incident-proof.json",
        mimeType: "application/json",
        byteSize: 1700,
        fallbackCopy: "AI unavailable; use deterministic WoofGuide",
        incidentLogging: "unsafe output incident log",
        rollbackPlan: "disable live AI provider",
        supportHandoff: "support inbox escalation",
        rateLimitBehaviorApproved: true,
        providerErrorBehaviorApproved: true,
      },
    ],
  });

  assert.equal(structuredManifest.status, "ready-for-review");
  assert.equal(structuredManifest.liveAiAllowed, true);
  assert.equal(structuredManifest.readyCount, 6);
  assert.equal(structuredManifest.openCount, 0);
  assert.ok(
    structuredManifest.items.some((item) =>
      item.evidenceAttached.includes("WoofGuide owner-review write gate proof ready"),
    ),
  );
});
