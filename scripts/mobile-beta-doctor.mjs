#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const mobileRoot = join(root, "artifacts", "woofwatcher-mobile");
const expectedPnpmVersion = "10.24.0";
const expectedPackageManager = `pnpm@${expectedPnpmVersion}`;
const jsonMode = process.argv.includes("--json");
const checks = [];
const issues = [];
const warnings = [];

function check(label, ok, detail, severity = "issue") {
  const status = ok ? "PASS" : severity === "warning" ? "WARN" : "BLOCKED";
  checks.push({ label, status, detail: detail ?? "", severity });
  if (!jsonMode) console.log(`[${status}] ${label}${detail ? ` - ${detail}` : ""}`);
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

const doctorName = "WoofWatcher mobile beta doctor";
const doctorPurpose = "confirm the two-day beta export path before device QA.";
const proofCommands = [
  "corepack prepare pnpm@10.24.0 --activate",
  "pnpm install",
  "pnpm run doctor:mobile-beta",
  "pnpm run doctor:mobile-beta:json",
  "pnpm --filter @workspace/woofwatcher-mobile run smoke:web",
];
const handoffProofSections = [
  "Dependency proof commands",
  "Required beta proof after export",
  "Provider proof needed",
  "Truth boundaries",
];
const nextActions = [
  "Run pnpm --filter @workspace/woofwatcher-mobile run smoke:web.",
  "Open /care-twin-qa on a real device or simulator.",
  "Attach iOS Quick Log/Log proof and Android Launch Readiness proof.",
  "Save the required Mission note before marking Owner Preview Core Loop as Pass.",
  "Check GitHub Actions after billing/runner access is restored; zero-step failures are not app proof.",
];

if (!jsonMode) {
  console.log(doctorName);
  console.log(`Purpose: ${doctorPurpose}\n`);
}

const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
check(
  "Node 24 runtime",
  nodeMajor >= 24,
  nodeMajor >= 24 ? `node ${process.versions.node}` : `node ${process.versions.node}; install Node 24 before mobile beta export`,
);

const pnpm = runFirstAvailable(process.platform === "win32" ? ["pnpm.cmd", "pnpm"] : ["pnpm"], ["--version"]);
const corepack = runFirstAvailable(process.platform === "win32" ? ["corepack.cmd", "corepack"] : ["corepack"], ["--version"]);
check(
  "Corepack available for pnpm bootstrap",
  corepack.status === 0,
  corepack.status === 0
    ? `${corepack.stdout.trim()} available; run corepack prepare pnpm@10.24.0 --activate if pnpm is missing`
    : "Corepack is not on PATH; install pnpm 10.24.0 directly or use Replit/WSL",
  "warning",
);
check(
  "pnpm available",
  pnpm.status === 0,
  pnpm.status === 0
    ? pnpm.stdout.trim()
    : "install pnpm 10.24.0 directly, or run Corepack bootstrap: corepack prepare pnpm@10.24.0 --activate",
);
if (pnpm.status === 0) {
  check(
    "pnpm CLI matches pinned version",
    pnpm.stdout.trim() === expectedPnpmVersion,
    `${pnpm.stdout.trim()} detected; expected ${expectedPnpmVersion}`,
  );
}

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

const easJsonPath = join(mobileRoot, "eas.json");
const easJson = existsSync(easJsonPath) ? readJson(easJsonPath) : {};
const easBuildProfiles = easJson.build ?? {};
const hasIosAndAndroidBuildProfiles = Boolean(easBuildProfiles.preview?.ios)
  && Boolean(easBuildProfiles.preview?.android)
  && Boolean(easBuildProfiles.production?.ios)
  && Boolean(easBuildProfiles.production?.android);
check(
  "EAS build profiles include iOS and Android",
  existsSync(easJsonPath) && hasIosAndAndroidBuildProfiles,
  existsSync(easJsonPath) ? "preview and production profiles cover iOS/Android" : "missing artifacts/woofwatcher-mobile/eas.json",
);

const mobileExpoPackage = join(mobileRoot, "node_modules", "expo", "package.json");
check(
  "mobile package can resolve expo",
  existsSync(mobileExpoPackage),
  existsSync(mobileExpoPackage) ? "expo dependency present" : "run pnpm install so smoke:web can resolve the Expo SDK",
);

const pixellabVerifier = join(mobileRoot, "scripts", "verify-pixellab-assets.js");
check("PixelLab verifier exists", existsSync(pixellabVerifier), "run pnpm --filter @workspace/woofwatcher-mobile run verify:pixellab-assets");

if (!jsonMode) {
  console.log("\nDependency proof commands:");
  for (const command of proofCommands) console.log(`- ${command}`);
  console.log("\nRequired beta proof after export:");
  for (const action of nextActions) console.log(`- ${action}`);
  console.log("\n48-hour beta handoff must include:");
  for (const section of handoffProofSections) console.log(`- ${section}`);
}

if (issues.length > 0) {
  if (jsonMode) {
    console.log(JSON.stringify({
      name: doctorName,
      purpose: doctorPurpose,
      result: "BLOCKED",
      checks,
      issues,
      warnings,
      proofCommands,
      handoffProofSections,
      nextActions,
    }, null, 2));
  } else {
    console.log(`\nMobile beta doctor result: BLOCKED (${issues.length} issue${issues.length === 1 ? "" : "s"})`);
  }
  process.exitCode = 1;
} else {
  const suffix = warnings.length > 0 ? ` with ${warnings.length} warning${warnings.length === 1 ? "" : "s"}` : "";
  if (jsonMode) {
    console.log(JSON.stringify({
      name: doctorName,
      purpose: doctorPurpose,
      result: "READY_FOR_EXPORT",
      checks,
      issues,
      warnings,
      proofCommands,
      handoffProofSections,
      nextActions,
    }, null, 2));
  } else {
    console.log(`\nMobile beta doctor result: READY FOR EXPORT${suffix}`);
  }
}
