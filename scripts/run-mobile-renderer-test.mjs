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
const entries = [
  {
    source: path.join(
      mobileRoot,
      "lib",
      "queryCacheLocalDataReset.renderer.test.tsx",
    ),
    output: "query-cache-reset-renderer.test.mjs",
    alias: baseAlias,
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
