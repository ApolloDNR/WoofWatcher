import { test } from "node:test";
import assert from "node:assert/strict";

test("defines the push notifications proof packet before reminder delivery can be claimed", async () => {
  const mod = await import("./pushNotificationsProof.ts").catch(() => null);
  assert.ok(mod, "pushNotificationsProof module should exist");

  assert.match(mod.PUSH_NOTIFICATIONS_PROOF_SUMMARY, /Push notifications proof packet/);
  assert.match(mod.PUSH_NOTIFICATIONS_PROOF_SUMMARY, /Expo push project config/);
  assert.match(mod.PUSH_NOTIFICATIONS_PROOF_SUMMARY, /APNs credentials/);
  assert.match(mod.PUSH_NOTIFICATIONS_PROOF_SUMMARY, /Firebase\/FCM credentials/);
  assert.match(mod.PUSH_NOTIFICATIONS_PROOF_SUMMARY, /permission prompt copy/);
  assert.match(mod.PUSH_NOTIFICATIONS_PROOF_SUMMARY, /quiet hours/);
  assert.match(mod.PUSH_NOTIFICATIONS_PROOF_SUMMARY, /opt-out behavior/);
  assert.match(mod.PUSH_NOTIFICATIONS_PROOF_SUMMARY, /delivery QA/);

  const items = mod.PUSH_NOTIFICATIONS_PROOF_ITEMS;
  assert.ok(Array.isArray(items));
  assert.deepEqual(
    items.map((item) => item.label),
    [
      "Expo push project config",
      "Apple APNs credentials",
      "Firebase and FCM credentials",
      "Permission prompt and preference copy",
      "Quiet hours and opt-out behavior",
      "Reminder delivery QA and fallback",
    ],
  );

  assert.ok(
    items.some(
      (item) =>
        item.label === "Expo push project config" &&
        /Expo push project id/i.test(item.requiredEvidence) &&
        /push token registration/i.test(item.requiredEvidence),
    ),
  );
  assert.ok(
    items.some(
      (item) =>
        item.label === "Apple APNs credentials" &&
        /APNs credentials/i.test(item.requiredEvidence) &&
        /iOS device token/i.test(item.requiredEvidence),
    ),
  );
  assert.ok(
    items.some(
      (item) =>
        item.label === "Firebase and FCM credentials" &&
        /Firebase\/FCM credentials/i.test(item.requiredEvidence) &&
        /Android delivery/i.test(item.requiredEvidence),
    ),
  );
  assert.ok(
    items.some(
      (item) =>
        item.label === "Permission prompt and preference copy" &&
        /permission prompt copy/i.test(item.requiredEvidence) &&
        /notification preferences/i.test(item.requiredEvidence),
    ),
  );
  assert.ok(
    items.some(
      (item) =>
        item.label === "Quiet hours and opt-out behavior" &&
        /quiet hours/i.test(item.requiredEvidence) &&
        /opt-out behavior/i.test(item.requiredEvidence),
    ),
  );
  assert.ok(
    items.some(
      (item) =>
        item.label === "Reminder delivery QA and fallback" &&
        /delivery QA/i.test(item.requiredEvidence) &&
        /missed notification fallback/i.test(item.requiredEvidence),
    ),
  );
});

test("builds a blocked push notifications proof manifest before reminder delivery can be claimed", async () => {
  const mod = await import("./pushNotificationsProof.ts").catch(() => null);
  assert.ok(mod, "pushNotificationsProof module should exist");

  const manifest = mod.buildPushNotificationsProofManifest({});

  assert.equal(manifest.title, "Push notifications proof manifest");
  assert.equal(manifest.status, "blocked");
  assert.equal(manifest.statusLabel, "Reminder delivery blocked");
  assert.equal(manifest.reminderDeliveryAllowed, false);
  assert.equal(manifest.readyCount, 0);
  assert.equal(manifest.openCount, 6);
  assert.match(manifest.summary, /Reminder Center must stay local/);
  assert.match(manifest.summary, /Expo\/APNs\/FCM/);
  assert.ok(manifest.items.every((item) => item.status === "blocked"));
  assert.ok(manifest.blockers.some((blocker) => /Expo push project id/.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /APNs credentials/.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /Firebase\/FCM credentials/.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /quiet hours/.test(blocker)));
  assert.ok(manifest.blockers.some((blocker) => /missed notification fallback/.test(blocker)));
});

test("keeps reminder delivery blocked when push proof uses generic delivery strings", async () => {
  const mod = await import("./pushNotificationsProof.ts").catch(() => null);
  assert.ok(mod, "pushNotificationsProof module should exist");

  const manifest = mod.buildPushNotificationsProofManifest({
    expoPushProjectConfig: "Expo project id, EAS linkage, and push token registration are approved.",
    appleApnsCredentials: "APNs credentials and iOS device registration are approved.",
    firebaseFcmCredentials: "Firebase/FCM credentials and Android delivery are approved.",
    permissionPromptPreferenceCopy: "Permission prompt and notification preferences approved.",
    quietHoursOptOutBehavior: "Quiet hours and opt-out behavior approved.",
    reminderDeliveryQaFallback: "iOS and Android reminders delivered with fallback.",
  });

  assert.equal(manifest.status, "blocked");
  assert.equal(manifest.reminderDeliveryAllowed, false);
  assert.equal(manifest.items[1]?.status, "blocked");
  assert.equal(manifest.items[2]?.status, "blocked");
  assert.equal(manifest.items[5]?.status, "blocked");
  assert.match(manifest.items[1]?.evidenceAttached.join("\n") ?? "", /0\/1 iOS APNs delivery proof ready/);
  assert.match(manifest.items[2]?.evidenceAttached.join("\n") ?? "", /0\/1 Android FCM delivery proof ready/);
  assert.match(manifest.items[5]?.evidenceAttached.join("\n") ?? "", /0\/2 native delivery proofs ready/);
  assert.match(manifest.blockers.join("\n"), /iOS APNs delivery proof/);
  assert.match(manifest.blockers.join("\n"), /Android FCM delivery proof/);
});

test("allows reminder delivery review only with platform-specific native delivery proof", async () => {
  const mod = await import("./pushNotificationsProof.ts").catch(() => null);
  assert.ok(mod, "pushNotificationsProof module should exist");

  const manifest = mod.buildPushNotificationsProofManifest({
    expoPushProjectConfig: "Expo project id, EAS linkage, push token registration, and production channel are approved.",
    appleApnsCredentials: "APNs credentials, production entitlement profile, and TestFlight registration are attached.",
    firebaseFcmCredentials: "Firebase project, google-services config, and production sender ownership are attached.",
    permissionPromptPreferenceCopy: "Permission prompt, denied fallback, and notification preference copy are approved.",
    quietHoursOptOutBehavior: "Quiet hours, medication exception rules, and opt-out persistence are approved.",
    reminderDeliveryQaFallback: "Missed notification fallback and Reminder Center recovery are approved.",
    nativeDeliveryEvidence: [
      {
        platform: "ios",
        provider: "apns",
        fileName: "ios-apns-reminder-delivered.png",
        uri: "file:///qa/ios-apns-reminder-delivered.png",
        mimeType: "image/png",
        byteSize: 18432,
        pushTokenRegistered: true,
        reminderDelivered: true,
        capturesPermissionPreference: true,
        capturesQuietHoursOrOptOut: true,
        capturesFallbackPath: true,
      },
      {
        platform: "android",
        provider: "fcm",
        fileName: "android-fcm-reminder-delivered.png",
        uri: "file:///qa/android-fcm-reminder-delivered.png",
        mimeType: "image/png",
        byteSize: 19640,
        pushTokenRegistered: true,
        reminderDelivered: true,
        capturesPermissionPreference: true,
        capturesQuietHoursOrOptOut: true,
        capturesFallbackPath: true,
      },
    ],
  });

  assert.equal(manifest.status, "ready-for-review");
  assert.equal(manifest.reminderDeliveryAllowed, true);
  assert.equal(manifest.readyCount, 6);
  assert.equal(manifest.openCount, 0);
  assert.match(manifest.items[1]?.evidenceAttached.join("\n") ?? "", /1\/1 iOS APNs delivery proof ready/);
  assert.match(manifest.items[2]?.evidenceAttached.join("\n") ?? "", /1\/1 Android FCM delivery proof ready/);
  assert.match(manifest.items[5]?.evidenceAttached.join("\n") ?? "", /2\/2 native delivery proofs ready/);
  assert.deepEqual(manifest.blockers, []);
});
