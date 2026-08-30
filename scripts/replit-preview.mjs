#!/usr/bin/env node
/**
 * Managed-host preview entry (Replit, container previews, any PaaS).
 *
 * Serves the WoofWatcher mobile app's static Expo web export so it can be
 * previewed in a browser and hosted without any native tooling, secrets, or
 * backend. On first run it builds the export (a few minutes); after that it
 * reuses it for fast restarts. The server binds 0.0.0.0 and honors $PORT so
 * the platform proxy can reach it.
 *
 * Manual equivalent (run from the repo root):
 *   pnpm --filter @workspace/woofwatcher-mobile run smoke:web   # build once
 *   PORT=8080 pnpm --filter @workspace/woofwatcher-mobile run preview:web
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { constants } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolvePreviewBuildCommand,
  resolvePreviewRuntime,
  resolvePreviewServerCommand,
  startPreviewServer,
} from "./preview-runtime.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const exportIndex = join(
  repoRoot,
  "artifacts",
  "woofwatcher-mobile",
  ".expo-smoke",
  "index.html",
);

function run(cmd, args, env = process.env) {
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    cwd: repoRoot,
    env,
  });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

const rebuild = process.argv.includes("--rebuild");
const previewRuntime = resolvePreviewRuntime(
  process.argv.slice(2),
  process.env,
);

if (rebuild || !existsSync(exportIndex)) {
  console.log(
    "[replit-preview] Building the web export (one-time, a few minutes)...",
  );
  const previewBuild = resolvePreviewBuildCommand();
  run(previewBuild.command, previewBuild.args);
} else {
  console.log(
    "[replit-preview] Reusing existing web export (pass --rebuild to force).",
  );
}

console.log(
  `[replit-preview] Serving on ${previewRuntime.host}:${previewRuntime.port} ...`,
);
const previewServer = resolvePreviewServerCommand({
  repoRoot,
  execPath: process.execPath,
  runtime: previewRuntime,
  env: process.env,
});
try {
  const result = await startPreviewServer({
    ...previewServer,
    cwd: repoRoot,
  });
  const signalNumber = result.signal
    ? constants.signals[result.signal]
    : undefined;
  process.exitCode =
    result.code ?? (signalNumber == null ? 1 : 128 + signalNumber);
} catch (error) {
  console.error(
    `[replit-preview] Preview server failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
