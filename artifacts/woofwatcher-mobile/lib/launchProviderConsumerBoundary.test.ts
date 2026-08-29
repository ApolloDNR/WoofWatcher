import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const MOBILE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("normalizes persisted launch-provider profiles through the lightweight consumer module", async () => {
  const profileModule = await import("./launchProviderProfile.ts").catch(
    () => null,
  );
  assert.ok(profileModule, "the lightweight launch-provider profile module should exist");

  const profile = profileModule.normalizeLaunchProviderProfile({
    authConfigured: "yes",
    storageProviderEvidence: [],
    providerStatus: "not-approved",
    ownerReviewedAt: 123,
    notes: "  staged locally  ",
  });

  assert.equal(profile.authConfigured, true);
  assert.equal(profile.databaseConfigured, false);
  assert.equal(profile.storageProviderEvidence, null);
  assert.equal(profile.providerStatus, "local-draft");
  assert.equal(profile.ownerReviewedAt, undefined);
  assert.equal(profile.notes, "staged locally");
});

test("consumer persistence and Records sources do not directly import owner launch-proof modules", () => {
  const careContext = readFileSync(
    join(MOBILE_ROOT, "context", "CareContext.tsx"),
    "utf8",
  );
  const records = readFileSync(
    join(MOBILE_ROOT, "components", "health", "RecordsScreen.tsx"),
    "utf8",
  );

  assert.match(careContext, /from "@\/lib\/launchProviderProfile"/);
  assert.doesNotMatch(careContext, /from "@\/lib\/launchProviderSetup"/);
  assert.match(records, /from "@\/lib\/recordsOwnerProviderRuntime"/);
  assert.doesNotMatch(records, /from "@\/lib\/launchProviderSetup"/);
  assert.doesNotMatch(records, /from "@\/lib\/reportBinaryExportProof"/);
});

test("Records provider runtimes preserve owner proof and force consumer-local storage", async () => {
  const [ownerRuntime, consumerRuntime] = await Promise.all([
    import("./recordsOwnerProviderRuntime.ts").catch(() => null),
    import("./recordsConsumerProviderRuntime.ts").catch(() => null),
  ]);
  assert.ok(ownerRuntime, "the Records owner-provider runtime should exist");
  assert.ok(consumerRuntime, "the Records consumer-provider runtime should exist");

  const profile = {
    storageProviderConfigured: true,
    storageProviderProofReady: true,
    providerStatus: "provider-approved" as const,
  };
  const owner = ownerRuntime.deriveRecordsOwnerProviderRuntime(profile);
  const consumer = consumerRuntime.deriveRecordsOwnerProviderRuntime(profile);

  assert.equal(owner.storageProviderConfigured, true);
  assert.equal(consumer.storageProviderConfigured, false);
  assert.equal(consumer.storageProviderEvidence, null);
  assert.equal(
    consumerRuntime.buildRecordsOwnerBinaryProofManifest({
      carePassHtmlFileName: "care-pass.html",
      dogIdSvgFileName: "dog-id.svg",
    }),
    null,
  );
});

test("production resolves the Records owner-provider runtime to its consumer-safe implementation", () => {
  const metroConfigPath = join(MOBILE_ROOT, "metro.config.js");
  const moduleRequests = [
    "@/lib/recordsOwnerProviderRuntime",
    join(MOBILE_ROOT, "lib", "recordsOwnerProviderRuntime"),
    join(MOBILE_ROOT, "lib", "recordsOwnerProviderRuntime.ts"),
  ];

  const resolveFor = (
    profile: string,
    moduleName: string,
    platform: string,
    consumerPreview = "0",
  ) => {
    const probe = [
      `const config = require(${JSON.stringify(metroConfigPath)});`,
      `const result = config.resolver.resolveRequest({ resolveRequest(_context, requested) { return { requested }; } }, ${JSON.stringify(moduleName)}, ${JSON.stringify(platform)});`,
      "process.stdout.write(result.requested);",
    ].join("\n");
    return spawnSync(process.execPath, ["-e", probe], {
      cwd: MOBILE_ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        EXPO_PUBLIC_BUILD_PROFILE: profile,
        EXPO_PUBLIC_CONSUMER_PREVIEW: consumerPreview,
      },
    });
  };

  for (const moduleName of moduleRequests) {
    for (const platform of ["web", "ios", "android"]) {
      const internal = resolveFor("internal", moduleName, platform);
      assert.equal(internal.status, 0, internal.stderr);
      assert.equal(internal.stdout, moduleName);

      for (const profile of ["candidate", "production", "store"]) {
        const consumer = resolveFor(profile, moduleName, platform);
        assert.equal(consumer.status, 0, consumer.stderr);
        assert.match(
          consumer.stdout,
          /lib[\\/]recordsConsumerProviderRuntime\.ts$/,
          `${profile}/${platform} must exclude the Records owner launch-proof graph`,
        );
      }

      const consumerPreview = resolveFor(
        "internal",
        moduleName,
        platform,
        "1",
      );
      assert.equal(consumerPreview.status, 0, consumerPreview.stderr);
      assert.match(
        consumerPreview.stdout,
        /lib[\\/]recordsConsumerProviderRuntime\.ts$/,
        `consumer preview/${platform} must exclude the Records owner launch-proof graph`,
      );
    }
  }
});
