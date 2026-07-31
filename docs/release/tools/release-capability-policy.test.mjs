import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  STORE_CAPABILITY_ENV,
  validateProductionPrivacyCapabilities,
} from "./release-capability-policy.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function fixture() {
  return {
    eas: JSON.parse(
      fs.readFileSync(path.join(REPO, "artifacts/woofwatcher-mobile/eas.json"), "utf8"),
    ),
    metadata: JSON.parse(
      fs.readFileSync(path.join(REPO, "docs/release/APP_STORE_CONNECT_METADATA.json"), "utf8"),
    ),
  };
}

test("accepts DATA_NOT_COLLECTED only with both store capabilities disabled", () => {
  assert.deepEqual(validateProductionPrivacyCapabilities(fixture()), []);
});

test("rejects DATA_NOT_COLLECTED when production push-token registration is enabled", () => {
  const input = fixture();
  input.eas.build.production.env[STORE_CAPABILITY_ENV.pushTokenRegistration] = "enabled";
  assert.ok(
    validateProductionPrivacyCapabilities(input).some((issue) =>
      issue.includes(STORE_CAPABILITY_ENV.pushTokenRegistration),
    ),
  );
});

test("rejects DATA_NOT_COLLECTED when production cloud document upload is enabled", () => {
  const input = fixture();
  input.eas.build.production.env[STORE_CAPABILITY_ENV.cloudDocumentUpload] = "enabled";
  assert.ok(
    validateProductionPrivacyCapabilities(input).some((issue) =>
      issue.includes(STORE_CAPABILITY_ENV.cloudDocumentUpload),
    ),
  );
});

test("fails closed when either production capability declaration is missing", () => {
  for (const envName of Object.values(STORE_CAPABILITY_ENV)) {
    const input = fixture();
    delete input.eas.build.production.env[envName];
    assert.ok(
      validateProductionPrivacyCapabilities(input).some((issue) => issue.includes(envName)),
    );
  }
});
