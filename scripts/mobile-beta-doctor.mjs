#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const mobileRoot = join(root, "artifacts", "woofwatcher-mobile");
const expectedPackageManager = "pnpm@10.24.0";
const issues = [];
const warnings = [];

function check(label, ok, detail, severity = "issue") {
  const status = ok ? "PASS" : severity === "warning" ? "WARN" : "BLOCKED";
  console.log(`[${status}] ${label}${detail ? ` - ${detail}` : ""}`);
  if (!ok && severity === "warning") warnings.push(label);
  if (!ok && severity !== "warning") issues.push(label);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function runFirstAvailable(commands, args) {
  for (const command of commands) {
    const result = spawnSync(command, args, { encoding: "utf8" });
    if (result.status === 0) return result;
  }
  return { status: 1, stdout: "", stderr: "" };
}

console.log("WoofWatcher mobile beta doctor");
console.log("Purpose: confirm the two-day beta export path before device QA.\n");

const pnpm = runFirstAvailable(process.platform === "win32" ? ["pnpm.cmd", "pnpm"] : ["pnpm"], ["--version"]);
check("pnpm available", pnpm.status === 0, pnpm.status === 0 ? pnpm.stdout.trim() : "install pnpm or run from Replit/WSL/Git Bash with pnpm");

const rootPackage = readJson(join(root, "package.json"));
const verifyWorkflow = readFileSync(join(root, ".github", "workflows", "verify.yml"), "utf8");
check(
  "packageManager matches CI pnpm",
  rootPackage.packageManager === expectedPackageManager && /version:\s*10\.24\.0/.test(verifyWorkflow),
  rootPackage.packageManager ? `${rootPackage.packageManager} pinned` : "missing packageManager",
);
check(
  "root install guard is Windows-friendly",
  rootPackage.scripts?.preinstall === "node scripts/enforce-pnpm-install.mjs",
  rootPackage.scripts?.preinstall ?? "missing preinstall",
);
check(
  "doctor command is wired",
  rootPackage.scripts?.["doctor:mobile-beta"] === "node scripts/mobile-beta-doctor.mjs",
  rootPackage.scripts?.["doctor:mobile-beta"] ?? "missing doctor:mobile-beta",
);

const mobilePackagePath = join(mobileRoot, "package.json");
const mobilePackage = readJson(mobilePackagePath);
check("mobile package exists", existsSync(mobilePackagePath), mobilePackage.name);
check("smoke:web export command exists", mobilePackage.scripts?.["smoke:web"] === "node scripts/smoke-web-export.js", mobilePackage.scripts?.["smoke:web"] ?? "missing smoke:web");

const appJson = readJson(join(mobileRoot, "app.json")).expo;
check("Expo platforms include iOS, Android, and web", JSON.stringify(appJson.platforms) === JSON.stringify(["ios", "android", "web"]), JSON.stringify(appJson.platforms));
check("Expo web export uses Metro", appJson.web?.bundler === "metro", appJson.web?.bundler ?? "missing expo.web.bundler");

const mobileExpoPackage = join(mobileRoot, "node_modules", "expo", "package.json");
check(
  "mobile package can resolve expo",
  existsSync(mobileExpoPackage),
  existsSync(mobileExpoPackage) ? "expo dependency present" : "run pnpm install so smoke:web can resolve the Expo SDK",
);

const pixellabVerifier = join(mobileRoot, "scripts", "verify-pixellab-assets.js");
check("PixelLab verifier exists", existsSync(pixellabVerifier), "run pnpm --filter @workspace/woofwatcher-mobile run verify:pixellab-assets");

console.log("\nRequired beta proof after export:");
console.log("- Run pnpm --filter @workspace/woofwatcher-mobile run smoke:web.");
console.log("- Open /care-twin-qa on a real device or simulator.");
console.log("- Attach iOS Quick Log/Log proof and Android Launch Readiness proof.");
console.log("- Save the required Mission note before marking Owner Preview Core Loop as Pass.");
console.log("- Check GitHub Actions after billing/runner access is restored; zero-step failures are not app proof.");

if (issues.length > 0) {
  console.log(`\nMobile beta doctor result: BLOCKED (${issues.length} issue${issues.length === 1 ? "" : "s"})`);
  process.exitCode = 1;
} else {
  const suffix = warnings.length > 0 ? ` with ${warnings.length} warning${warnings.length === 1 ? "" : "s"}` : "";
  console.log(`\nMobile beta doctor result: READY FOR EXPORT${suffix}`);
}
