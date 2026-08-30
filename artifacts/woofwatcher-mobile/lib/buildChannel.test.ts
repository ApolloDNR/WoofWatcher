import assert from "node:assert/strict";
import test from "node:test";

import {
  describeBuildChannel,
  isOwnerOpsChannel,
  resolveBuildChannel,
} from "./buildChannel.ts";

test("development keeps every surface unless consumer preview is explicit", () => {
  assert.equal(
    resolveBuildChannel({ isDev: true, buildProfile: "production" }),
    "development",
  );
  assert.equal(resolveBuildChannel({ isDev: true }), "development");
  assert.equal(
    resolveBuildChannel({ isDev: true, consumerPreview: true }),
    "production",
  );
});

test("production requires the explicit store profile label", () => {
  assert.equal(
    resolveBuildChannel({ isDev: false, buildProfile: "production" }),
    "production",
  );
  assert.equal(
    resolveBuildChannel({ isDev: false, buildProfile: " Production " }),
    "production",
    "profile label should be case/whitespace tolerant",
  );
  assert.equal(
    resolveBuildChannel({ isDev: false, buildProfile: "store" }),
    "production",
  );
  assert.equal(
    resolveBuildChannel({ isDev: false, buildProfile: "candidate" }),
    "production",
    "release candidates must fail closed to the consumer surface",
  );
});

test("unlabeled release builds stay internal so owner tooling survives", () => {
  assert.equal(resolveBuildChannel({ isDev: false }), "internal");
  assert.equal(
    resolveBuildChannel({ isDev: false, buildProfile: "" }),
    "internal",
  );
  assert.equal(
    resolveBuildChannel({ isDev: false, buildProfile: "preview" }),
    "internal",
  );
});

test("owner-ops tooling renders everywhere except store production", () => {
  assert.equal(isOwnerOpsChannel("development"), true);
  assert.equal(isOwnerOpsChannel("internal"), true);
  assert.equal(isOwnerOpsChannel("production"), false);
});

test("channel descriptions state the review boundary", () => {
  assert.match(
    describeBuildChannel("production"),
    /consumer care surfaces only/,
  );
  assert.match(describeBuildChannel("internal"), /owner launch tooling/);
  assert.match(describeBuildChannel("development"), /QA cockpits/);
});
