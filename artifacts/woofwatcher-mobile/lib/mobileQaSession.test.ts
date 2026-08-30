import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildMobileQaSessionProofManifest,
  buildMobileQaSessionProofManifestShareText,
  buildPersistedMobileQaSessionSnapshot,
  buildMobileQaSessionSnapshot,
  createEmptyMobileQaSessionState,
  createMobileQaSessionSaveQueue,
  createMobileQaSessionPersistenceGate,
  MOBILE_QA_SESSION_STORAGE_KEY,
  parseMobileQaSessionSnapshot,
  type MobileQaSessionInput,
  type MobileQaSessionState,
} from "./mobileQaSession.ts";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function qaInput(state: MobileQaSessionState): MobileQaSessionInput {
  return {
    careTwinStatusById: state.careTwinStatusById,
    careTwinNotes: state.careTwinNotes,
    careTwinEvidenceById: state.careTwinEvidenceById,
    surfaceStatusById: state.surfaceStatusById,
    surfaceNotes: state.surfaceNotes,
    surfaceEvidenceById: state.surfaceEvidenceById,
  };
}

test("builds a compact local mobile QA snapshot", () => {
  const snapshot = buildMobileQaSessionSnapshot(
    {
      careTwinStatusById: {
        happy: "pass",
        sleep: "unreviewed",
      },
      careTwinNotes: {
        sleep: "Needs iPhone SE crop check.",
        blank: "   ",
      },
      careTwinEvidenceById: {
        happy: [
          {
            uri: "file:///qa/ios-happy-idle.png",
            fileName: "ios-happy-idle.png",
            source: "library",
            targetPlatform: "ios",
            capturedAtIso: "2026-06-20T13:00:05.000Z",
          },
        ],
      },
      surfaceStatusById: {
        "phoenix-home": "pass",
      },
      surfaceNotes: {
        "records-incident-watch": "Follow-up row needs touch review.",
      },
      surfaceEvidenceById: {
        "phoenix-home": [
          {
            uri: "file:///qa/ios-home.png",
            fileName: "ios-home.png",
            source: "library",
            targetPlatform: "ios",
            capturedAtIso: "2026-06-20T13:00:10.000Z",
          },
        ],
      },
    },
    "2026-06-20T13:00:00.000Z",
  );

  assert.equal(MOBILE_QA_SESSION_STORAGE_KEY, "woofwatcher.mobileReleaseQaSession.v1");
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.savedAtIso, "2026-06-20T13:00:00.000Z");
  assert.deepEqual(snapshot.careTwinReviews, [
    {
      scenarioId: "happy",
      status: "pass",
      note: undefined,
      screenshotEvidence: [
        {
          uri: "file:///qa/ios-happy-idle.png",
          fileName: "ios-happy-idle.png",
          source: "library",
          targetPlatform: "ios",
          capturedAtIso: "2026-06-20T13:00:05.000Z",
          verification: "manual-self-attested",
        },
      ],
    },
    { scenarioId: "sleep", status: "unreviewed", note: "Needs iPhone SE crop check." },
  ]);
  assert.deepEqual(snapshot.releaseReviews, [
    {
      surfaceId: "phoenix-home",
      status: "pass",
      note: undefined,
      screenshotEvidence: [
        {
          uri: "file:///qa/ios-home.png",
          fileName: "ios-home.png",
          source: "library",
          targetPlatform: "ios",
          capturedAtIso: "2026-06-20T13:00:10.000Z",
          verification: "manual-self-attested",
        },
      ],
    },
    {
      surfaceId: "records-incident-watch",
      status: "unreviewed",
      note: "Follow-up row needs touch review.",
    },
  ]);
});

test("a proof snapshot exists only for an exact durable saved timestamp", () => {
  const input = qaInput(createEmptyMobileQaSessionState());

  assert.equal(buildPersistedMobileQaSessionSnapshot(input, undefined), null);
  assert.equal(buildPersistedMobileQaSessionSnapshot(input, "Saved locally"), null);
  assert.equal(
    buildPersistedMobileQaSessionSnapshot(
      input,
      "2026-08-23T21:04:05.000Z",
    )?.savedAtIso,
    "2026-08-23T21:04:05.000Z",
  );
});

test("parses a saved mobile QA snapshot into screen state maps", () => {
  const snapshot = buildMobileQaSessionSnapshot(
    {
      careTwinStatusById: { happy: "pass" },
      careTwinNotes: { happy: "Looks good on iPhone." },
      careTwinEvidenceById: {
        happy: [
          {
            uri: "file:///qa/ios-happy-idle.png",
            fileName: "ios-happy-idle.png",
            source: "library",
            targetPlatform: "ios",
            capturedAtIso: "2026-06-20T13:05:05.000Z",
          },
        ],
      },
      surfaceStatusById: { "avatar-studio": "needs-review" },
      surfaceNotes: { "avatar-studio": "Bully walk loop feels stiff." },
      surfaceEvidenceById: {
        "avatar-studio": [
          {
            uri: "file:///qa/android-avatar-studio.png",
            fileName: "android-avatar-studio.png",
            source: "library",
            targetPlatform: "android",
            capturedAtIso: "2026-06-20T13:05:10.000Z",
          },
        ],
      },
    },
    "2026-06-20T13:05:00.000Z",
  );

  const parsed = parseMobileQaSessionSnapshot(JSON.stringify(snapshot));

  assert.deepEqual(parsed?.careTwinStatusById, { happy: "pass" });
  assert.deepEqual(parsed?.careTwinNotes, { happy: "Looks good on iPhone." });
  assert.equal(parsed?.careTwinEvidenceById.happy?.[0]?.fileName, "ios-happy-idle.png");
  assert.equal(parsed?.careTwinEvidenceById.happy?.[0]?.targetPlatform, "ios");
  assert.deepEqual(parsed?.surfaceStatusById, { "avatar-studio": "needs-review" });
  assert.deepEqual(parsed?.surfaceNotes, { "avatar-studio": "Bully walk loop feels stiff." });
  assert.equal(parsed?.surfaceEvidenceById["avatar-studio"]?.[0]?.fileName, "android-avatar-studio.png");
  assert.equal(parsed?.surfaceEvidenceById["avatar-studio"]?.[0]?.targetPlatform, "android");
  assert.equal(parsed?.savedAtIso, "2026-06-20T13:05:00.000Z");
});

test("ignores corrupt and invalid mobile QA session data", () => {
  assert.equal(parseMobileQaSessionSnapshot("not-json"), null);
  assert.equal(parseMobileQaSessionSnapshot(null), null);

  const parsed = parseMobileQaSessionSnapshot(
    JSON.stringify({
      savedAtIso: "2026-06-20T13:10:00.000Z",
      careTwinReviews: [
        { scenarioId: "happy", status: "ship-it", note: "bad status" },
        {
          scenarioId: "health",
          status: "needs-review",
          note: "  Crop low. ",
          screenshotEvidence: [
            { uri: "", fileName: "bad.png", source: "library", capturedAtIso: "2026-06-20T13:10:10.000Z" },
            { uri: "file:///qa/health.png", fileName: "  health.png  ", source: "camera", targetPlatform: "sideways", capturedAtIso: "bad-date" },
          ],
        },
      ],
      releaseReviews: [
        { surfaceId: "", status: "pass" },
        { surfaceId: "phoenix-home", status: "pass", note: 42 },
      ],
    }),
  );

  assert.deepEqual(parsed?.careTwinStatusById, { health: "needs-review" });
  assert.deepEqual(parsed?.careTwinNotes, { health: "Crop low." });
  assert.equal(parsed?.careTwinEvidenceById.health?.length, 1);
  assert.equal(parsed?.careTwinEvidenceById.health?.[0]?.fileName, "health.png");
  assert.equal(parsed?.careTwinEvidenceById.health?.[0]?.targetPlatform, "unknown");
  assert.deepEqual(parsed?.surfaceStatusById, { "phoenix-home": "pass" });
  assert.deepEqual(parsed?.surfaceNotes, {});
});

test("builds a deterministic handoff proof manifest for saved device QA", () => {
  const snapshot = buildMobileQaSessionSnapshot(
    {
      careTwinStatusById: {
        happy: "pass",
        health: "needs-review",
      },
      careTwinNotes: {
        health: "Health-watch crop needs Android retest.",
      },
      careTwinEvidenceById: {
        happy: [
          {
            uri: "file:///qa/ios-happy-idle.png",
            fileName: "ios-happy-idle.png",
            source: "library",
            targetPlatform: "ios",
            capturedAtIso: "2026-06-20T13:00:05.000Z",
          },
        ],
      },
      surfaceStatusById: {
        "owner-preview-core-loop": "pass",
        "store-home": "pass",
      },
      surfaceNotes: {
        "owner-preview-core-loop": "Log, Plan, Today, Pack, Story, Health, More, Adventure, Records, Avatar Studio, and Care Pass reached.",
      },
      surfaceEvidenceById: {
        "owner-preview-core-loop": [
          {
            uri: "file:///qa/android-launch-readiness.png",
            fileName: "android-launch-readiness.png",
            source: "library",
            targetPlatform: "android",
            capturedAtIso: "2026-06-20T13:00:10.000Z",
          },
        ],
        "store-home": [
          {
            uri: "file:///qa/store-home-web.png",
            fileName: "store-home-web.png",
            source: "library",
            targetPlatform: "web",
            capturedAtIso: "2026-06-20T13:00:15.000Z",
          },
        ],
      },
    },
    "2026-06-20T13:00:00.000Z",
  );

  const manifest = buildMobileQaSessionProofManifest(snapshot, "2026-06-20T13:05:00.000Z");
  const sameManifest = buildMobileQaSessionProofManifest(snapshot, "2026-06-20T13:10:00.000Z");
  const text = buildMobileQaSessionProofManifestShareText(manifest);

  assert.match(manifest.proofId, /^wwqa-[a-z0-9]+$/);
  assert.equal(manifest.proofId, sameManifest.proofId);
  assert.equal(manifest.savedAtIso, "2026-06-20T13:00:00.000Z");
  assert.equal(manifest.generatedAtIso, "2026-06-20T13:05:00.000Z");
  assert.deepEqual(manifest.careTwin, {
    totalReviews: 2,
    passed: 1,
    needsTune: 1,
    unreviewed: 0,
    notes: 1,
    evidenceFiles: 1,
    iosEvidence: 1,
    androidEvidence: 0,
    webEvidence: 0,
    unknownEvidence: 0,
  });
  assert.deepEqual(manifest.release, {
    totalReviews: 2,
    passed: 2,
    needsTune: 0,
    unreviewed: 0,
    notes: 1,
    evidenceFiles: 2,
    iosEvidence: 0,
    androidEvidence: 1,
    webEvidence: 1,
    unknownEvidence: 0,
  });
  assert.equal(manifest.totalEvidenceFiles, 3);
  assert.equal(manifest.platformEvidenceLabel, "manual self-attested tags: iOS 1, Android 1, Web 1, Unknown 0");
  assert.match(text, /WoofWatcher QA Evidence Manifest/);
  assert.match(text, /Manifest ID: wwqa-/);
  assert.match(text, /Care twin: 1 pass, 1 needs tune, 1 evidence file/);
  assert.match(text, /Release: 2 pass, 0 needs tune, 2 evidence files/);
  assert.match(text, /cannot close iOS\/Android release gates/);
});

test("creates six fresh non-aliased QA content maps", () => {
  const first = createEmptyMobileQaSessionState();
  const second = createEmptyMobileQaSessionState();
  const firstMaps = [
    first.careTwinStatusById,
    first.careTwinNotes,
    first.careTwinEvidenceById,
    first.surfaceStatusById,
    first.surfaceNotes,
    first.surfaceEvidenceById,
  ];
  const secondMaps = [
    second.careTwinStatusById,
    second.careTwinNotes,
    second.careTwinEvidenceById,
    second.surfaceStatusById,
    second.surfaceNotes,
    second.surfaceEvidenceById,
  ];

  for (let index = 0; index < firstMaps.length; index += 1) {
    assert.notEqual(firstMaps[index], secondMaps[index]);
    for (let peer = index + 1; peer < firstMaps.length; peer += 1) {
      assert.notEqual(firstMaps[index], firstMaps[peer]);
    }
  }
  first.careTwinNotes.happy = "local edit";
  assert.deepEqual(first.surfaceNotes, {});
  assert.deepEqual(second.careTwinNotes, {});
});

test("hydration deep-copies six maps, preserves savedAtIso, and suppresses one matching autosave", () => {
  const gate = createMobileQaSessionPersistenceGate();
  const source: MobileQaSessionState = {
    careTwinStatusById: { happy: "pass" },
    careTwinNotes: { happy: "Looks good" },
    careTwinEvidenceById: {
      happy: [
        {
          uri: "file:///qa/happy.png",
          fileName: "happy.png",
          source: "library",
          targetPlatform: "ios",
          capturedAtIso: "2026-08-13T10:00:00.000Z",
        },
      ],
    },
    surfaceStatusById: { home: "needs-review" },
    surfaceNotes: { home: "Retest crop" },
    surfaceEvidenceById: {
      home: [
        {
          uri: "file:///qa/home.png",
          fileName: "home.png",
          source: "library",
          targetPlatform: "android",
          capturedAtIso: "2026-08-13T10:01:00.000Z",
        },
      ],
    },
    savedAtIso: "2026-08-13T10:02:00.000Z",
  };
  const ticket = gate.beginHydration();
  let applied: MobileQaSessionState | undefined;

  assert.equal(
    gate.applyHydrationIfCurrent(ticket, source, (state) => {
      applied = state;
    }),
    "applied",
  );
  assert.ok(applied);
  assert.equal(applied.savedAtIso, source.savedAtIso);
  assert.notEqual(applied.careTwinStatusById, source.careTwinStatusById);
  assert.notEqual(applied.careTwinNotes, source.careTwinNotes);
  assert.notEqual(applied.careTwinEvidenceById, source.careTwinEvidenceById);
  assert.notEqual(applied.careTwinEvidenceById.happy, source.careTwinEvidenceById.happy);
  assert.notEqual(applied.careTwinEvidenceById.happy[0], source.careTwinEvidenceById.happy[0]);
  assert.notEqual(applied.surfaceStatusById, source.surfaceStatusById);
  assert.notEqual(applied.surfaceNotes, source.surfaceNotes);
  assert.notEqual(applied.surfaceEvidenceById, source.surfaceEvidenceById);
  assert.notEqual(applied.surfaceEvidenceById.home, source.surfaceEvidenceById.home);
  assert.notEqual(applied.surfaceEvidenceById.home[0], source.surfaceEvidenceById.home[0]);

  source.careTwinNotes.happy = "mutated source";
  source.careTwinEvidenceById.happy[0].fileName = "mutated.png";
  assert.equal(applied.careTwinNotes.happy, "Looks good");
  assert.equal(applied.careTwinEvidenceById.happy[0].fileName, "happy.png");
  assert.equal(gate.consumeAutosaveDecision(qaInput(applied)), "suppress-hydration");
  assert.equal(gate.consumeAutosaveDecision(qaInput(applied)), "save");
});

test("a mismatched autosave is never suppressed and consumes the hydration marker", () => {
  const gate = createMobileQaSessionPersistenceGate();
  const hydrated = createEmptyMobileQaSessionState();
  hydrated.careTwinNotes.happy = "hydrated";
  const ticket = gate.beginHydration();
  assert.equal(gate.applyHydrationIfCurrent(ticket, hydrated, () => {}), "applied");

  const changed = createEmptyMobileQaSessionState();
  changed.careTwinNotes.happy = "real edit that bypassed mark";
  assert.equal(gate.consumeAutosaveDecision(qaInput(changed)), "save");
  assert.equal(gate.consumeAutosaveDecision(qaInput(hydrated)), "save");
});

test("an immediate edit in each QA map category saves after hydration", () => {
  const cases: Array<(state: MobileQaSessionState) => void> = [
    (state) => {
      state.careTwinStatusById.happy = "pass";
    },
    (state) => {
      state.careTwinNotes.happy = "Ready";
    },
    (state) => {
      state.careTwinEvidenceById.happy = [];
    },
    (state) => {
      state.surfaceStatusById.home = "needs-review";
    },
    (state) => {
      state.surfaceNotes.home = "Retest";
    },
    (state) => {
      state.surfaceEvidenceById.home = [];
    },
  ];

  for (const edit of cases) {
    const gate = createMobileQaSessionPersistenceGate();
    const hydrated = createEmptyMobileQaSessionState();
    const ticket = gate.beginHydration();
    assert.equal(gate.applyHydrationIfCurrent(ticket, hydrated, () => {}), "applied");
    gate.markRealEdit();
    edit(hydrated);
    assert.equal(gate.consumeAutosaveDecision(qaInput(hydrated)), "save");
  }
});

test("real edits and newer hydration tickets invalidate delayed QA hydration", () => {
  const gate = createMobileQaSessionPersistenceGate();
  const editedTicket = gate.beginHydration();
  let applies = 0;
  gate.markRealEdit();
  assert.equal(gate.isHydrationCurrent(editedTicket), false);
  assert.equal(
    gate.applyHydrationIfCurrent(editedTicket, createEmptyMobileQaSessionState(), () => {
      applies += 1;
    }),
    "stale",
  );

  const olderTicket = gate.beginHydration();
  const newerTicket = gate.beginHydration();
  assert.equal(olderTicket.editRevision, editedTicket.editRevision + 1);
  assert.equal(newerTicket.editRevision, olderTicket.editRevision);
  assert.equal(newerTicket.generation, olderTicket.generation + 1);
  assert.equal(gate.isHydrationCurrent(olderTicket), false);
  assert.equal(gate.isHydrationCurrent(newerTicket), true);
  assert.equal(
    gate.applyHydrationIfCurrent(olderTicket, createEmptyMobileQaSessionState(), () => {
      applies += 1;
    }),
    "stale",
  );
  assert.equal(
    gate.applyHydrationIfCurrent(newerTicket, createEmptyMobileQaSessionState(), () => {
      applies += 1;
    }),
    "applied",
  );
  assert.equal(applies, 1);
});

test("serializes QA saves so an older write cannot finish after a newer write", async () => {
  const queue = createMobileQaSessionSaveQueue();
  const first = deferred<void>();
  const second = deferred<void>();
  const started: string[] = [];

  const firstSave = queue.save("older", async (value) => {
    started.push(value);
    await first.promise;
  });
  const secondSave = queue.save("newer", async (value) => {
    started.push(value);
    await second.promise;
  });

  await Promise.resolve();
  assert.deepEqual(started, ["older"]);
  assert.equal(queue.isPending(), true);

  first.resolve();
  await firstSave;
  await Promise.resolve();
  assert.deepEqual(started, ["older", "newer"]);

  second.resolve();
  await secondSave;
  assert.equal(queue.isPending(), false);
});

test("a rejected QA save does not block a legitimate later save", async () => {
  const queue = createMobileQaSessionSaveQueue();
  const saved: string[] = [];

  await assert.rejects(
    queue.save("failed", async () => {
      throw new Error("disk unavailable");
    }),
    /disk unavailable/,
  );
  await queue.save("later", async (value) => {
    saved.push(value);
  });

  assert.deepEqual(saved, ["later"]);
  assert.equal(queue.isPending(), false);
});
