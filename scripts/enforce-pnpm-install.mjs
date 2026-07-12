#!/usr/bin/env node

import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const forbiddenLockfiles = ["package-lock.json", "yarn.lock"];

for (const file of forbiddenLockfiles) {
  try {
    rmSync(join(repoRoot, file), { force: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(`Could not remove ${file}: ${detail}`);
  }
}

const userAgent = process.env.npm_config_user_agent ?? "";

if (!userAgent.startsWith("pnpm/")) {
  console.error("Use pnpm instead of npm or yarn for this workspace.");
  process.exitCode = 1;
}
