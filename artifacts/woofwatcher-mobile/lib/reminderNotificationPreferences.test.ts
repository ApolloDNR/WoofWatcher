import { test } from "node:test";
import assert from "node:assert/strict";

import {
  applyReminderNotificationPreferenceDraft,
  buildReminderNotificationPreferencesForCenter,
  normalizeReminderNotificationPreferences,
} from "./reminderNotificationPreferences.ts";

const NOW = "2026-07-03T16:00:00.000Z";

test("normalizes saved reminder notification preferences from older care documents", () => {
  const defaults = normalizeReminderNotificationPreferences(null);

  assert.deepEqual(defaults, {
    pushEnabled: false,
    permissionStatus: "unknown",
    quietHoursStart: "",
    quietHoursEnd: "",
    optOut: false,
    updatedAt: undefined,
  });

  const saved = normalizeReminderNotificationPreferences({
    pushEnabled: "yes",
    permissionStatus: "granted",
    quietHoursStart: " 9:00 PM ",
    quietHoursEnd: "7:00 AM ",
    optOut: false,
    updatedAt: NOW,
  });

  assert.equal(saved.pushEnabled, true);
  assert.equal(saved.permissionStatus, "granted");
  assert.equal(saved.quietHoursStart, "9:00 PM");
  assert.equal(saved.quietHoursEnd, "7:00 AM");
  assert.equal(saved.optOut, false);
  assert.equal(saved.updatedAt, NOW);
});

test("applies local reminder notification preference drafts without claiming provider delivery", () => {
  const doc = {
    updatedAt: "2026-07-01T00:00:00.000Z",
    reminderNotificationPreferences: {
      pushEnabled: false,
      permissionStatus: "unknown",
      quietHoursStart: "",
      quietHoursEnd: "",
      optOut: false,
    },
    routines: [{ id: "breakfast" }],
  };

  const next = applyReminderNotificationPreferenceDraft(
    doc,
    {
      pushEnabled: true,
      permissionStatus: "unknown",
      quietHoursStart: "9:00 PM",
      quietHoursEnd: "7:00 AM",
      optOut: false,
    },
    NOW,
  );

  assert.equal(next.updatedAt, NOW);
  assert.deepEqual(next.routines, doc.routines);
  assert.deepEqual(next.reminderNotificationPreferences, {
    pushEnabled: true,
    permissionStatus: "unknown",
    quietHoursStart: "9:00 PM",
    quietHoursEnd: "7:00 AM",
    optOut: false,
    updatedAt: NOW,
  });

  const optedOut = applyReminderNotificationPreferenceDraft(next, { optOut: true }, NOW);
  assert.equal(optedOut.reminderNotificationPreferences.pushEnabled, false);
  assert.equal(optedOut.reminderNotificationPreferences.optOut, true);
});

test("keeps Reminder Center provider-backed status gated by provider approval", () => {
  const preferences = {
    pushEnabled: true,
    permissionStatus: "granted" as const,
    quietHoursStart: "9:00 PM",
    quietHoursEnd: "7:00 AM",
    optOut: false,
  };

  const ownerReviewed = buildReminderNotificationPreferencesForCenter(
    { pushNotificationsConfigured: true, providerStatus: "owner-reviewed" },
    preferences,
  );
  const providerApproved = buildReminderNotificationPreferencesForCenter(
    { pushNotificationsConfigured: true, providerStatus: "provider-approved" },
    preferences,
  );

  assert.equal(ownerReviewed.providerConfigured, false);
  assert.equal(providerApproved.providerConfigured, true);
  assert.equal(providerApproved.pushEnabled, true);
  assert.equal(providerApproved.permissionStatus, "granted");
  assert.equal(providerApproved.quietHoursStart, "9:00 PM");
  assert.equal(providerApproved.quietHoursEnd, "7:00 AM");
  assert.equal(providerApproved.optOut, false);
});
