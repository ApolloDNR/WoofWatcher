import assert from "node:assert/strict";
import test from "node:test";

import { resolveLocalRouteSmoke } from "./localRouteSmoke.ts";

const exactSmokeInput = {
  platform: "web",
  token: "woofwatcher-local-route-smoke-v1",
  buildProfile: "local-route-smoke",
  hostname: "localhost",
} as const;

test("allows the route-content bypass only for the exact local web export", () => {
  assert.equal(resolveLocalRouteSmoke(exactSmokeInput), true);
  assert.equal(
    resolveLocalRouteSmoke({
      ...exactSmokeInput,
      token: "wrong-token",
    }),
    false,
  );
  assert.equal(
    resolveLocalRouteSmoke({
      ...exactSmokeInput,
      buildProfile: "production",
    }),
    false,
  );
  assert.equal(
    resolveLocalRouteSmoke({
      ...exactSmokeInput,
      hostname: "127.0.0.1",
    }),
    true,
  );
  assert.equal(
    resolveLocalRouteSmoke({
      ...exactSmokeInput,
      hostname: "app.woofwatcher.com",
    }),
    false,
    "the public smoke token and profile must not bypass auth on production hosting",
  );
});

test("cannot activate the local route-smoke bypass in a native release", () => {
  for (const platform of ["ios", "android"] as const) {
    assert.equal(
      resolveLocalRouteSmoke({
        ...exactSmokeInput,
        platform,
      }),
      false,
    );
  }
});
