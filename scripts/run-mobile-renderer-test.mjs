import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const mobileRoot = path.join(
  repositoryRoot,
  "artifacts",
  "woofwatcher-mobile",
);
const apiServerRoot = path.join(repositoryRoot, "artifacts", "api-server");
const apiServerRequire = createRequire(path.join(apiServerRoot, "package.json"));
const mobileRequire = createRequire(path.join(mobileRoot, "package.json"));
const { build } = apiServerRequire("esbuild");

const packageDirectory = (packageName) =>
  path.dirname(mobileRequire.resolve(`${packageName}/package.json`));
const supportRoot = path.join(mobileRoot, "lib", "test-support");
const baseAlias = {
  react: packageDirectory("react"),
  "react-dom": packageDirectory("react-dom"),
  "@tanstack/react-query": packageDirectory("@tanstack/react-query"),
  "react-native": path.join(
    supportRoot,
    "reactNativeLifecycleHost.test.tsx",
  ),
  "@react-native-async-storage/async-storage": path.join(
    supportRoot,
    "localDataRendererAdapters.test.ts",
  ),
  "@/lib/auth": path.join(
    supportRoot,
    "localDataRendererAdapters.test.ts",
  ),
  "@": mobileRoot,
};
const careHouseholdExpoAdapters = path.join(
  supportRoot,
  "careHouseholdExpoAdapters.test.tsx",
);
const careHouseholdAlias = {
  ...baseAlias,
  "react-native": path.join(
    supportRoot,
    "careHouseholdReactNativeHost.test.tsx",
  ),
  "react-native-reanimated": path.join(
    supportRoot,
    "careHouseholdReanimatedAdapter.test.tsx",
  ),
  "@react-native-async-storage/async-storage": path.join(
    supportRoot,
    "careHouseholdRendererAuthStorage.test.ts",
  ),
  "@workspace/api-client-react": path.join(
    supportRoot,
    "careHouseholdRendererApi.test.tsx",
  ),
  "@/lib/auth": path.join(
    supportRoot,
    "careHouseholdRendererAuthStorage.test.ts",
  ),
  "@expo/vector-icons/Feather": careHouseholdExpoAdapters,
  "@expo/vector-icons/Ionicons": careHouseholdExpoAdapters,
  "@expo/vector-icons/MaterialCommunityIcons": careHouseholdExpoAdapters,
  "@expo/vector-icons": careHouseholdExpoAdapters,
  "expo-haptics": careHouseholdExpoAdapters,
  "expo-location": careHouseholdExpoAdapters,
  "expo-router": careHouseholdExpoAdapters,
  "react-native-safe-area-context": careHouseholdExpoAdapters,
};
const entries = [
  {
    source: path.join(
      mobileRoot,
      "lib",
      "queryCacheLocalDataReset.renderer.test.tsx",
    ),
    output: "query-cache-reset-renderer.test.mjs",
    alias: {
      ...baseAlias,
      "@/context/CareContext": path.join(
        supportRoot,
        "localDataRendererAdapters.test.ts",
      ),
    },
  },
  {
    source: path.join(
      mobileRoot,
      "lib",
      "localDataResetAppShield.renderer.test.tsx",
    ),
    output: "reset-shield-accessibility-renderer.test.mjs",
    alias: {
      ...baseAlias,
      "@/context/LocalDataResetContext": path.join(
        supportRoot,
        "controlledLocalDataResetContexts.test.ts",
      ),
      "@/context/QueryCacheLocalDataResetContext": path.join(
        supportRoot,
        "controlledLocalDataResetContexts.test.ts",
      ),
    },
  },
  {
    source: path.join(
      mobileRoot,
      "lib",
      "careTeamSuppliesShipping.renderer.test.tsx",
    ),
    output: "care-team-supplies-shipping-renderer.test.mjs",
    alias: careHouseholdAlias,
  },
];
const outputDirectory = await mkdtemp(
  path.join(tmpdir(), "woofwatcher-renderer-test-"),
);

try {
  for (const entry of entries) {
    await build({
      entryPoints: [entry.source],
      outfile: path.join(outputDirectory, entry.output),
      alias: entry.alias,
      bundle: true,
      format: "esm",
      platform: "node",
      target: "node22",
      loader: { ".png": "dataurl" },
      logLevel: "warning",
    });
  }

  const result = spawnSync(
    process.execPath,
    [
      "--test",
      ...entries.map((entry) => path.join(outputDirectory, entry.output)),
    ],
    { cwd: repositoryRoot, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
} finally {
  await rm(outputDirectory, { recursive: true, force: true });
}
