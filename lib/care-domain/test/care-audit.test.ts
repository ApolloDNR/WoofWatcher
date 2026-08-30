import { test } from "node:test";
import assert from "node:assert/strict";

import {
  appendCareAuditEvent,
  getCareAuditTrail,
} from "../src/index.ts";

test("appends sanitized audit events while preserving existing details", () => {
  const details = appendCareAuditEvent(
    {
      mealCompletion: "partial",
      auditTrail: [
        {
          id: "audit_1",
          action: "created",
          caregiver: "Emma",
          occurredAt: "2026-06-11T07:30:00.000Z",
          summary: "Emma created this log.",
        },
      ],
    },
    {
      id: "audit_2",
      action: "updated",
      caregiver: "Apollo",
      occurredAt: "2026-06-11T07:45:00.000Z",
      summary: "  Apollo updated the note.  ",
      changes: ["note", " ", "title"],
    },
  );

  const trail = getCareAuditTrail(details);

  assert.equal(details.mealCompletion, "partial");
  assert.equal(trail.length, 2);
  assert.deepEqual(trail[1], {
    id: "audit_2",
    action: "updated",
    caregiver: "Apollo",
    occurredAt: "2026-06-11T07:45:00.000Z",
    summary: "Apollo updated the note.",
    changes: ["note", "title"],
  });
});

test("ignores malformed audit events", () => {
  const trail = getCareAuditTrail({
    auditTrail: [
      {
        id: "audit_good",
        action: "sticky-note-added",
        caregiver: "Apollo",
        occurredAt: "2026-06-11T08:00:00.000Z",
        summary: "Added a sticky note.",
      },
      { id: "audit_bad", action: "unknown", summary: "Invalid action" },
      "not an audit event",
    ],
  });

  assert.deepEqual(trail, [
    {
      id: "audit_good",
      action: "sticky-note-added",
      caregiver: "Apollo",
      occurredAt: "2026-06-11T08:00:00.000Z",
      summary: "Added a sticky note.",
    },
  ]);
});
