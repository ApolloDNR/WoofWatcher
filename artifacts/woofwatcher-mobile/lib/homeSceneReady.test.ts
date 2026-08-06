import assert from "node:assert/strict";
import test from "node:test";

import { isHomeSceneReady } from "./homeSceneReady.ts";

test("Home waits for care data and the persisted welcome choice before measuring the fixed scene", () => {
  assert.equal(isHomeSceneReady(false, null), false);
  assert.equal(isHomeSceneReady(true, null), false);
  assert.equal(isHomeSceneReady(false, false), false);
  assert.equal(isHomeSceneReady(true, false), true);
  assert.equal(isHomeSceneReady(true, true), true);
});

test("Home renders after a storage read failure once the welcome choice is hydrated", () => {
  assert.equal(isHomeSceneReady(false, false, "read-failed"), true);
});
