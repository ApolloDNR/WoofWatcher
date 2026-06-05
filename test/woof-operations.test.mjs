import assert from "node:assert/strict";
import test from "node:test";

import { createEntry, getDefaultState } from "../src/woof-core.js";
import {
  buildHostedNudgePlan,
  buildReportArtifact,
  buildTalkToLogDraft,
  createAuditEvent
} from "../src/woof-operations.js";

const NOW = "2026-06-05T09:45:00.000";

test("creates audit events while redacting token-like metadata", () => {
  const event = createAuditEvent(
    {
      action: "export",
      resourceType: "care_pass",
      resourceId: "care_pass_vet_001",
      actor: "Apollo",
      summary: "Downloaded vet Care Pass",
      metadata: {
        audience: "vet",
        inviteToken: "secret-token",
        apiKey: "sk-secret"
      }
    },
    NOW
  );

  assert.match(event.id, /^audit_/);
  assert.equal(event.action, "export");
  assert.equal(event.resourceType, "care_pass");
  assert.equal(event.actor, "Apollo");
  assert.equal(event.metadata.audience, "vet");
  assert.equal(event.metadata.inviteToken, "[redacted]");
  assert.equal(event.metadata.apiKey, "[redacted]");
  assert.equal(event.privacyLevel, "household_private");
});

test("builds talk-to-log drafts for bile incidents without auto-saving", () => {
  const draft = buildTalkToLogDraft(
    "Phoenix threw up yellow bile before breakfast but had normal energy after.",
    { caregiver: "Apollo" },
    NOW
  );

  assert.equal(draft.packageType, "woofwatcher.talk-to-log-draft");
  assert.equal(draft.autoSave, false);
  assert.equal(draft.entryDraft.type, "vomit");
  assert.equal(draft.entryDraft.caregiver, "Apollo");
  assert.equal(draft.entryDraft.requiresFollowUp, true);
  assert.match(draft.entryDraft.note, /yellow bile/);
  assert.match(draft.reviewPrompt, /review before saving/i);
  assert.match(draft.boundary, /not a diagnosis/i);
});

test("plans hosted nudge jobs with quiet boundaries and daily budget", () => {
  const state = getDefaultState(NOW);
  const plan = buildHostedNudgePlan(
    state,
    {
      backendConfigured: true,
      householdId: "household_phoenix",
      pushProviderConfigured: true,
      maxDailyNudges: 2,
      nudgesSentToday: 1
    },
    NOW
  );

  assert.equal(plan.packageType, "woofwatcher.hosted-nudge-plan");
  assert.equal(plan.status, "ready_to_schedule");
  assert.equal(plan.budget.remainingToday, 1);
  assert.equal(plan.jobs.length, 1);
  assert.equal(plan.jobs[0].type, "care_reminder");
  assert.equal(plan.jobs[0].auditEvent.action, "notification_schedule");
  assert.ok(plan.jobs[0].message.includes("Phoenix"));
  assert.match(plan.deliveryBoundary, /closed-app push/i);
});

test("packages monthly report artifacts with export audit proof", () => {
  const state = {
    ...getDefaultState(NOW),
    entries: [
      createEntry({ type: "meal", title: "Breakfast", caregiver: "Apollo", occurredAt: "2026-06-05T07:40:00.000" }),
      createEntry({ type: "walk", title: "Morning walk", caregiver: "Apollo", durationMinutes: 22, occurredAt: "2026-06-05T08:30:00.000" })
    ]
  };
  const artifact = buildReportArtifact(state, { format: "text" }, NOW);

  assert.equal(artifact.packageType, "woofwatcher.report-artifact");
  assert.equal(artifact.format, "text");
  assert.equal(artifact.mimeType, "text/plain;charset=utf-8");
  assert.match(artifact.filename, /^woofwatcher-phoenix-report-2026-06-05/);
  assert.match(artifact.content, /Phoenix Care Report/);
  assert.equal(artifact.auditEvent.action, "export");
  assert.equal(artifact.privacy.includesRawState, false);
});
