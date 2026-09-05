import assert from "node:assert/strict";
import test from "node:test";

import {
  INITIAL_SETUP_DRAFT_READINESS,
  isSetupInteractive,
  reduceSetupDraftReadiness,
} from "./setupHydration.ts";

test("a dirty Setup draft stays sealed across a care-scope reload", () => {
  let readiness = reduceSetupDraftReadiness(INITIAL_SETUP_DRAFT_READINESS, {
    type: "draft-bound",
    careScopeRevision: 0,
    activePetId: "primary",
    careSourceFingerprint: "care-0",
  });
  readiness = reduceSetupDraftReadiness(readiness, { type: "edited" });

  assert.equal(
    isSetupInteractive({
      avatarHydrationStatus: "ready",
      careHydrationStatus: "ready",
      careScopeRevision: 0,
      activePetId: "primary",
      careSourceFingerprint: "care-0",
      draftReadiness: readiness,
    }),
    true,
  );

  readiness = reduceSetupDraftReadiness(readiness, {
    type: "care-unavailable",
  });
  assert.deepEqual(readiness, INITIAL_SETUP_DRAFT_READINESS);
  assert.equal(
    isSetupInteractive({
      avatarHydrationStatus: "ready",
      careHydrationStatus: "ready",
      careScopeRevision: 1,
      activePetId: "primary",
      careSourceFingerprint: "care-1",
      draftReadiness: readiness,
    }),
    false,
    "a later ready signal must not revive the previous household's dirty draft",
  );

  readiness = reduceSetupDraftReadiness(readiness, {
    type: "draft-bound",
    careScopeRevision: 1,
    activePetId: "primary",
    careSourceFingerprint: "care-1",
  });
  assert.equal(readiness.dirty, false);
  assert.equal(
    isSetupInteractive({
      avatarHydrationStatus: "ready",
      careHydrationStatus: "ready",
      careScopeRevision: 1,
      activePetId: "primary",
      careSourceFingerprint: "care-1",
      draftReadiness: readiness,
    }),
    true,
    "the replacement scope becomes interactive only after its own draft is bound",
  );
});

test("Setup only becomes interactive after successful Care and Avatar hydration", () => {
  const draftReadiness = reduceSetupDraftReadiness(
    INITIAL_SETUP_DRAFT_READINESS,
    {
      type: "draft-bound",
      careScopeRevision: 3,
      activePetId: "primary",
      careSourceFingerprint: "care-3",
    },
  );

  for (const careHydrationStatus of ["loading", "failed"] as const) {
    assert.equal(
      isSetupInteractive({
        avatarHydrationStatus: "ready",
        careHydrationStatus,
        careScopeRevision: 3,
        activePetId: "primary",
        careSourceFingerprint: "care-3",
        draftReadiness,
      }),
      false,
    );
  }
  for (const avatarHydrationStatus of ["loading", "failed"] as const) {
    assert.equal(
      isSetupInteractive({
        avatarHydrationStatus,
        careHydrationStatus: "ready",
        careScopeRevision: 3,
        activePetId: "primary",
        careSourceFingerprint: "care-3",
        draftReadiness,
      }),
      false,
    );
  }
});

test("an active-pet switch seals a dirty Setup draft until the new pet is bound", () => {
  let readiness = reduceSetupDraftReadiness(INITIAL_SETUP_DRAFT_READINESS, {
    type: "draft-bound",
    careScopeRevision: 9,
    activePetId: " dog-a ",
    careSourceFingerprint: "care-dog-a",
  });
  readiness = reduceSetupDraftReadiness(readiness, { type: "edited" });

  assert.equal(
    isSetupInteractive({
      avatarHydrationStatus: "ready",
      careHydrationStatus: "ready",
      careScopeRevision: 9,
      activePetId: "dog-a",
      careSourceFingerprint: "care-dog-a",
      draftReadiness: readiness,
    }),
    true,
  );

  assert.equal(
    isSetupInteractive({
      avatarHydrationStatus: "loading",
      careHydrationStatus: "ready",
      careScopeRevision: 9,
      activePetId: "dog-b",
      careSourceFingerprint: "care-dog-b",
      draftReadiness: readiness,
    }),
    false,
  );
  assert.equal(
    isSetupInteractive({
      avatarHydrationStatus: "ready",
      careHydrationStatus: "ready",
      careScopeRevision: 9,
      activePetId: "dog-b",
      careSourceFingerprint: "care-dog-b",
      draftReadiness: readiness,
    }),
    false,
    "Avatar readiness alone must not revive pet A's draft for pet B",
  );

  readiness = reduceSetupDraftReadiness(readiness, {
    type: "draft-bound",
    careScopeRevision: 9,
    activePetId: "dog-b",
    careSourceFingerprint: "care-dog-b",
  });
  assert.deepEqual(readiness, {
    boundCareScopeRevision: 9,
    boundActivePetId: "dog-b",
    boundCareSourceFingerprint: "care-dog-b",
    dirty: false,
  });
  assert.equal(
    isSetupInteractive({
      avatarHydrationStatus: "ready",
      careHydrationStatus: "ready",
      careScopeRevision: 9,
      activePetId: " dog-b ",
      careSourceFingerprint: "care-dog-b",
      draftReadiness: readiness,
    }),
    true,
  );
});

test("a same-pet Care fingerprint change seals the draft until it is rebased", () => {
  let readiness = reduceSetupDraftReadiness(INITIAL_SETUP_DRAFT_READINESS, {
    type: "draft-bound",
    careScopeRevision: 12,
    activePetId: "dog-a",
    careSourceFingerprint: "care-before",
  });
  readiness = reduceSetupDraftReadiness(readiness, { type: "edited" });

  assert.equal(
    isSetupInteractive({
      avatarHydrationStatus: "ready",
      careHydrationStatus: "ready",
      careScopeRevision: 12,
      activePetId: "dog-a",
      careSourceFingerprint: "care-after",
      draftReadiness: readiness,
    }),
    false,
  );

  readiness = reduceSetupDraftReadiness(readiness, {
    type: "draft-rebased",
    careSourceFingerprint: "care-after",
    dirty: true,
  });
  assert.equal(readiness.dirty, true);
  assert.equal(readiness.boundCareSourceFingerprint, "care-after");
  assert.equal(
    isSetupInteractive({
      avatarHydrationStatus: "ready",
      careHydrationStatus: "ready",
      careScopeRevision: 12,
      activePetId: "dog-a",
      careSourceFingerprint: "care-after",
      draftReadiness: readiness,
    }),
    true,
  );
});
