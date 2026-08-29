import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const MOBILE_ROOT = join(process.cwd(), "artifacts", "woofwatcher-mobile");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts")
      ? [path]
      : [];
  });
}

test("loads only the font weights and icon families used by the app", () => {
  const rootLayout = readFileSync(
    join(MOBILE_ROOT, "app", "_layout.tsx"),
    "utf8",
  );
  assert.doesNotMatch(
    rootLayout,
    /from "@expo-google-fonts\/(?:inter|fredoka|fraunces)"/,
  );
  assert.match(rootLayout, /@expo-google-fonts\/inter\/400Regular/);
  assert.match(rootLayout, /@expo-google-fonts\/fredoka\/700Bold/);
  assert.match(rootLayout, /@expo-google-fonts\/fraunces\/700Bold/);

  const barrelImports = sourceFiles(MOBILE_ROOT).filter((path) =>
    readFileSync(path, "utf8").includes('from "@expo/vector-icons"'),
  );
  assert.deepEqual(barrelImports, []);
});

test("replaces the owner QA implementation with a lightweight route in consumer bundles", () => {
  const metroConfigPath = join(MOBILE_ROOT, "metro.config.js");
  const moduleName = "@/components/owner/CareTwinQaScreen";
  const probe = [
    `const config = require(${JSON.stringify(metroConfigPath)});`,
    `const result = config.resolver.resolveRequest({ resolveRequest(_context, requested) { return { requested }; } }, ${JSON.stringify(moduleName)}, "web");`,
    "process.stdout.write(result.requested);",
  ].join("\n");

  const resolveFor = (profile: string) =>
    spawnSync(process.execPath, ["-e", probe], {
      cwd: MOBILE_ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        EXPO_PUBLIC_BUILD_PROFILE: profile,
        EXPO_PUBLIC_CONSUMER_PREVIEW: "0",
      },
    });

  const internal = resolveFor("internal");
  assert.equal(internal.status, 0, internal.stderr);
  assert.equal(internal.stdout, moduleName);

  const production = resolveFor("production");
  assert.equal(production.status, 0, production.stderr);
  assert.match(
    production.stdout,
    /components[\\/]owner[\\/]OwnerOpsUnavailableRoute\.tsx$/,
  );

  const route = readFileSync(
    join(MOBILE_ROOT, "app", "care-twin-qa.tsx"),
    "utf8",
  );
  assert.match(route, /CareTwinQaScreen/);
  assert.doesNotMatch(route, /mobileReleaseQa|mobileQaSession|launchReadiness/);
});

test("replaces the owner More route only in consumer bundle profiles", () => {
  const metroConfigPath = join(MOBILE_ROOT, "metro.config.js");
  const routeRequests = [
    "./(tabs)/more.tsx",
    join(MOBILE_ROOT, "app", "(tabs)", "more.tsx"),
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

  for (const moduleName of routeRequests) {
    for (const platform of ["web", "ios", "android"]) {
      for (const profile of ["internal", "development"]) {
        const result = resolveFor(profile, moduleName, platform);
        assert.equal(result.status, 0, result.stderr);
        assert.equal(
          result.stdout,
          moduleName,
          `${profile}/${platform} must preserve the owner-capable More route`,
        );
      }

      for (const profile of ["candidate", "production", "store"]) {
        const result = resolveFor(profile, moduleName, platform);
        assert.equal(result.status, 0, result.stderr);
        assert.match(
          result.stdout,
          /components[\\/]more[\\/]ConsumerMoreScreen\.tsx$/,
          `${profile}/${platform} must resolve the compact consumer More screen`,
        );
      }

      const consumerPreview = resolveFor("internal", moduleName, platform, "1");
      assert.equal(consumerPreview.status, 0, consumerPreview.stderr);
      assert.match(
        consumerPreview.stdout,
        /components[\\/]more[\\/]ConsumerMoreScreen\.tsx$/,
        `consumer preview/${platform} must resolve the compact consumer More screen`,
      );
    }
  }
});

test("replaces Avatar Studio sprite production tooling at the actual module boundary", () => {
  const metroConfigPath = join(MOBILE_ROOT, "metro.config.js");
  const moduleRequests = [
    "@/components/owner/AvatarSpriteProductionPanel",
    join(MOBILE_ROOT, "components", "owner", "AvatarSpriteProductionPanel"),
    join(MOBILE_ROOT, "components", "owner", "AvatarSpriteProductionPanel.tsx"),
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
      for (const profile of ["internal", "development"]) {
        const result = resolveFor(profile, moduleName, platform);
        assert.equal(result.status, 0, result.stderr);
        assert.equal(
          result.stdout,
          moduleName,
          `${profile}/${platform} must preserve Avatar sprite owner tooling`,
        );
      }

      for (const profile of ["candidate", "production", "store"]) {
        const result = resolveFor(profile, moduleName, platform);
        assert.equal(result.status, 0, result.stderr);
        assert.match(
          result.stdout,
          /components[\\/]owner[\\/]AvatarSpriteProductionPanelUnavailable\.tsx$/,
          `${profile}/${platform} must use the null consumer panel`,
        );
      }

      const consumerPreview = resolveFor("internal", moduleName, platform, "1");
      assert.equal(consumerPreview.status, 0, consumerPreview.stderr);
      assert.match(
        consumerPreview.stdout,
        /components[\\/]owner[\\/]AvatarSpriteProductionPanelUnavailable\.tsx$/,
        `consumer preview/${platform} must use the null consumer panel`,
      );
    }
  }
});

test("keeps Avatar Studio consumer source free of sprite production QA implementation", () => {
  const avatarStudio = readFileSync(
    join(MOBILE_ROOT, "components", "more", "AvatarStudioScreen.tsx"),
    "utf8",
  );
  const ownerPanel = readFileSync(
    join(MOBILE_ROOT, "components", "owner", "AvatarSpriteProductionPanel.tsx"),
    "utf8",
  );
  const consumerPanel = readFileSync(
    join(
      MOBILE_ROOT,
      "components",
      "owner",
      "AvatarSpriteProductionPanelUnavailable.tsx",
    ),
    "utf8",
  );

  assert.match(
    avatarStudio,
    /import AvatarSpriteProductionPanel from "@\/components\/owner\/AvatarSpriteProductionPanel"/,
  );
  assert.match(avatarStudio, /<AvatarSpriteProductionPanel/);
  assert.doesNotMatch(
    avatarStudio,
    /avatarSpriteProductionQa|buildAvatarSpriteProduction|Sprite production review|Open sprite QA cockpit|avatar-sprite-production-review/,
  );

  assert.match(ownerPanel, /avatarSpriteProductionQa/);
  assert.match(ownerPanel, /Sprite production review/);
  assert.match(ownerPanel, /Open sprite QA cockpit/);
  assert.match(ownerPanel, /if \(!isOwnerOpsBuild\(\)\) return null/);

  assert.ok(
    consumerPanel.length < 500,
    `consumer Avatar sprite panel must stay lightweight, received ${consumerPanel.length} chars`,
  );
  assert.doesNotMatch(
    consumerPanel,
    /avatarSpriteProductionQa|Open sprite QA cockpit|avatar-sprite-production-review/,
  );
});
