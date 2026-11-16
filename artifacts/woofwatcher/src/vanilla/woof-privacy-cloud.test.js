import test from "node:test";
import assert from "node:assert/strict";

import { getDefaultState } from "./woof-core.js";
import { buildCaregiverAccessModel, buildScopedCarePass } from "./woof-privacy-cloud.js";

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
