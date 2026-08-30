import assert from "node:assert/strict";
import { test } from "node:test";

test("reset recovery reserves a bounded card at compact height and large text", async () => {
  const layoutModule = await import("./localDataResetShieldLayout.ts").catch(
    () => null,
  );
  assert.ok(
    layoutModule && "getLocalDataResetShieldLayout" in layoutModule,
    "the reset shield needs a pure compact-height layout contract",
  );
  const getLayout = layoutModule.getLocalDataResetShieldLayout as (input: {
    viewportHeight: number;
    fontScale: number;
  }) => { outerPaddingVertical: number; maxCardHeight: number };

  assert.deepEqual(getLayout({ viewportHeight: 320, fontScale: 1.6 }), {
    outerPaddingVertical: 12,
    maxCardHeight: 296,
  });
  assert.deepEqual(getLayout({ viewportHeight: 667, fontScale: 1.5 }), {
    outerPaddingVertical: 12,
    maxCardHeight: 643,
  });
  assert.deepEqual(getLayout({ viewportHeight: 844, fontScale: 1 }), {
    outerPaddingVertical: 24,
    maxCardHeight: 796,
  });
});
