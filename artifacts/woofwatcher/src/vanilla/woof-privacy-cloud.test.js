import test from "node:test";
import assert from "node:assert/strict";

import { getDefaultState } from "./woof-core.js";
import {
  CAREGIVER_ROLES,
  buildCaregiverAccessModel,
  buildScopedCarePass,
} from "./woof-privacy-cloud.js";

test("keeps the exported caregiver-role catalog dog-neutral", () => {
  const serializedCatalog = JSON.stringify(CAREGIVER_ROLES);

  assert.doesNotMatch(serializedCatalog, /Phoenix|My Dog/);
  assert.match(CAREGIVER_ROLES[0].description, /local state/);
});

test("keeps Care Pass and household access copy behind the Dog Profile identity boundary", () => {
  const now = "2026-11-16T18:00:00.000Z";
  const state = {
    ...getDefaultState(now),
    profile: { name: "  Mochi  " },
  };

  const carePass = buildScopedCarePass(state, { audience: "sitter" }, now);
  const accessModel = buildCaregiverAccessModel(state, now);
  const generatedCopy = JSON.stringify({
    carePassPrivacy: carePass.privacy,
    accessRoles: accessModel.roles,
    accessBoundary: accessModel.privacyBoundary,
  });

  assert.equal(carePass.petName, "Mochi");
  assert.match(carePass.privacy.privateData, /Mochi care context/);
  assert.match(accessModel.roles[0].description, /Mochi's local state/);
  assert.doesNotMatch(generatedCopy, /Phoenix|My Dog/);
});
