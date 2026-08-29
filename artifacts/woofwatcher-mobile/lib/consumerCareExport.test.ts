import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import test from "node:test";

const MODULE_PATH = join(
  process.cwd(),
  "artifacts",
  "woofwatcher-mobile",
  "lib",
  "consumerCareExport.ts",
);

test("consumer care export includes care data without owner launch profiles", async () => {
  assert.ok(
    existsSync(MODULE_PATH),
    "consumer care export boundary must exist",
  );
  const { buildConsumerCareExport, serializeConsumerCareExport } = await import(
    pathToFileURL(MODULE_PATH).href
  );
  const bundle = buildConsumerCareExport(
    {
      dataVersion: 7,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      activePetId: "dog-1",
      profile: { name: "Mochi", breed: "Shiba Inu" },
      pets: [{ id: "dog-1", name: "Mochi" }],
      caregivers: [{ id: "caregiver-1", name: "Sam" }],
      householdSetup: { completedAt: "2026-01-01T00:00:00.000Z" },
      reminderNotificationPreferences: { enabled: true },
      dietProfile: { primaryFood: "Kibble" },
      routines: [{ id: "routine-1", title: "Breakfast" }],
      goals: [{ id: "goal-1", title: "Walk" }],
      records: [{ id: "record-1", title: "Rabies" }],
      accessPasses: [{ id: "pass-1" }],
      adventureMemories: [{ id: "memory-1", title: "Park" }],
      reportArtifacts: [{ id: "report-1", title: "Vet summary" }],
      calendarEvents: [{ id: "event-1", title: "Vet" }],
      entries: [{ id: "entry-1", title: "Breakfast" }],
      launchSupportProfile: { secret: "owner support plan" },
      launchProviderProfile: { secret: "owner provider setup" },
    },
    1_786_000_000_000,
  );

  assert.deepEqual(bundle.counts, {
    caregivers: 1,
    pets: 1,
    accessPasses: 1,
    adventureMemories: 1,
    routines: 1,
    entries: 1,
    records: 1,
    reportArtifacts: 1,
    calendarEvents: 1,
  });
  assert.deepEqual(Object.keys(bundle.care), [
    "dataVersion",
    "createdAt",
    "updatedAt",
    "activePetId",
    "profile",
    "pets",
    "caregivers",
    "householdSetup",
    "reminderNotificationPreferences",
    "dietProfile",
    "routines",
    "goals",
    "records",
    "accessPasses",
    "adventureMemories",
    "reportArtifacts",
    "calendarEvents",
    "entries",
  ]);
  const serialized = serializeConsumerCareExport(bundle);
  assert.match(serialized, /"dogName": "Mochi"/);
  assert.doesNotMatch(
    serialized,
    /launchSupportProfile|launchProviderProfile|owner support plan|owner provider setup/,
  );
});
