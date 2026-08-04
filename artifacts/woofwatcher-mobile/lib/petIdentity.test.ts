import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAuthAccountIdentityCopy,
  buildAuthGatewayIdentityCopy,
  buildNotFoundIdentityCopy,
} from "./petIdentity.ts";

test("routes a missing screen back to the active dog's room", () => {
  assert.equal(
    buildNotFoundIdentityCopy("  Mochi  "),
    "The screen you were looking for is not here. Head back to Mochi's room and pick up the day from there.",
  );
  assert.match(buildNotFoundIdentityCopy("My Dog"), /Phoenix's room/);
});

test("names the active dog throughout the account gateway", () => {
  assert.deepEqual(buildAuthGatewayIdentityCopy("  Luna  "), {
    setupDetail: "Set up Luna, then invite your household when providers are live.",
    stageLabel: "Luna care starts here",
  });
});

test("uses the starter identity before a dog is named", () => {
  assert.deepEqual(buildAuthGatewayIdentityCopy("My Dog"), {
    setupDetail: "Set up Phoenix, then invite your household when providers are live.",
    stageLabel: "Phoenix care starts here",
  });
  assert.deepEqual(buildAuthGatewayIdentityCopy("   "), {
    setupDetail: "Set up Phoenix, then invite your household when providers are live.",
    stageLabel: "Phoenix care starts here",
  });
});

test("names the active dog throughout sign-in and sign-up guidance", () => {
  assert.deepEqual(buildAuthAccountIdentityCopy("  Luna  "), {
    previewSignIn:
      "Accounts are not connected in this preview build. Review Luna's care space in local-only mode and sign in once production auth is configured.",
    signIn:
      "Return to your household care space, review Luna's open loops, and keep the account layer ready for shared sync.",
    signUp:
      "Create the account layer for Luna's care twin. Care data stays local-first until production sync providers are configured.",
  });
});

test("keeps the starter dog identity in account guidance before naming", () => {
  assert.deepEqual(
    buildAuthAccountIdentityCopy("My Dog"),
    buildAuthAccountIdentityCopy("   "),
  );
  assert.match(buildAuthAccountIdentityCopy("My Dog").signIn, /Phoenix's open loops/);
});
