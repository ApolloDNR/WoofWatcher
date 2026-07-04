import { test } from "node:test";
import assert from "node:assert/strict";

import {
  applyReminderNotificationPreferenceDraft,
  buildReminderNotificationPreferencesForCenter,
  normalizeReminderNotificationPreferences,
} from "./reminderNotificationPreferences.ts";
import type { PushNotificationsProofEvidence } from "./pushNotificationsProof.ts";

const NOW = "2026-07-03T16:00:00.000Z";

function completePushNotificationsProofEvidence(): PushNotificationsProofEvidence {
  return {
    expoPushProjectConfig: "Expo push project config proof: production project id, channel, token registration, local preview boundary.",
    appleApnsCredentials: "Apple APNs credentials proof: production entitlement, device token, and APNs delivery evidence.",
    firebaseFcmCredentials: "Firebase and FCM credentials proof: google-services config, sender ownership, Android channel behavior.",
    permissionPromptPreferenceCopy: "Permission prompt and preference copy proof: consent language, denied fallback, and caregiver copy.",
    quietHoursOptOutBehavior: "Quiet hours and opt-out behavior proof: disabled reminders stay off and quiet hours mute non-urgent reminders.",
    reminderDeliveryQaFallback: "Reminder delivery QA and fallback proof: iOS and Android delivered reminders plus fallback recovery.",
    nativeDeliveryEvidence: [
      {
        platform: "ios",
        provider: "apns",
        fileName: "ios-apns-reminder-delivery-proof.png",
        mimeType: "image/png",
        byteSize: 320000,
        pushTokenRegistered: true,
        reminderDelivered: true,
        capturesPermissionPreference: true,
        capturesQuietHoursOrOptOut: true,
        capturesFallbackPath: true,
      },
      {
        platform: "android",
        provider: "fcm",
        fileName: "android-fcm-reminder-delivery-proof.png",
        mimeType: "image/png",
        byteSize: 300000,
        pushTokenRegistered: true,
        reminderDelivered: true,
        capturesPermissionPreference: true,
        capturesQuietHoursOrOptOut: true,
        capturesFallbackPath: true,
      },
    ],
  };
}

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

test("keeps Reminder Center provider-backed status gated by provider approval and structured push proof", () => {
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
  const providerApprovedWithProof = buildReminderNotificationPreferencesForCenter(
    {
      pushNotificationsConfigured: true,
      providerStatus: "provider-approved",
      pushNotificationsProofEvidence: completePushNotificationsProofEvidence(),
    },
    preferences,
  );

  assert.equal(ownerReviewed.providerConfigured, false);
  assert.equal(providerApproved.providerConfigured, false);
  assert.equal(providerApproved.providerStaged, true);
  assert.equal(providerApproved.providerProofReady, false);
  assert.equal(providerApprovedWithProof.providerConfigured, true);
  assert.equal(providerApprovedWithProof.providerProofReady, true);
  assert.equal(providerApprovedWithProof.pushEnabled, true);
  assert.equal(providerApprovedWithProof.permissionStatus, "granted");
  assert.equal(providerApprovedWithProof.quietHoursStart, "9:00 PM");
  assert.equal(providerApprovedWithProof.quietHoursEnd, "7:00 AM");
  assert.equal(providerApprovedWithProof.optOut, false);
});
