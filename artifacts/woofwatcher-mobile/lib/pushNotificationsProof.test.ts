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
