#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { delimiter, dirname, isAbsolute, join, resolve } from "node:path";
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

function quoteWindowsArg(value) {
  const text = String(value);
  if (!/[\s&()^|<>"]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function resolvePathCommand(command) {
  if (isAbsolute(command) || command.includes("/") || command.includes("\\")) {
    return command;
  }

  const pathEntries = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  for (const entry of pathEntries) {
    const candidate = join(entry, command);
    if (existsSync(candidate)) return candidate;
  }

  return command;
}

function runCli(command, args) {
  const resolvedCommand = process.platform === "win32" ? resolvePathCommand(command) : command;
  if (process.platform === "win32") {
    const commandLine = [quoteWindowsArg(resolvedCommand), ...args.map(quoteWindowsArg)].join(" ");
    return spawnSync(commandLine, {
      encoding: "utf8",
      shell: true,
    });
  }

  return spawnSync(resolvedCommand, args, {
    encoding: "utf8",
  });
}

function runFirstAvailable(commands, args) {
  for (const command of commands) {
    const result = runCli(command, args);
    if (result.status === 0) return result;
  }
  return { status: 1, stdout: "", stderr: "" };
}

function includesAll(source, values) {
  return values.every((value) => source.includes(value));
}

const doctorName = "WoofWatcher mobile beta doctor";
const doctorPurpose = "confirm the two-day beta export path before device QA.";
const proofCommands = [
  "corepack prepare pnpm@10.24.0 --activate",
  "pnpm install",
  "pnpm run doctor:mobile-beta",
  "pnpm run doctor:mobile-beta:json",
  "pnpm --filter @workspace/woofwatcher-mobile run smoke:web",
  "pnpm --filter @workspace/woofwatcher-mobile run preview:smoke",
];
const handoffProofSections = [
  "Dependency proof commands",
  "Required beta proof after export",
  "Native QA Needs tune fix brief",
  "Provider proof needed",
  "Truth boundaries",
];
const truthBoundaries = [
  "READY_FOR_EXPORT only means dependency install and web export gates are ready to verify.",
  "READY_FOR_EXPORT does not approve App Store, Play Store, native device QA, provider sync, storage, AI, payments, legal, privacy, support, or Apollo launch sign-off.",
  "BLOCKED means do not claim beta export readiness until the listed issues are fixed and the proof commands pass.",
];
const nextActions = [
  "Run pnpm --filter @workspace/woofwatcher-mobile run smoke:web.",
  "Serve the exported beta with pnpm --filter @workspace/woofwatcher-mobile run preview:smoke, then open http://127.0.0.1:4194/.",
  "Open /care-twin-qa on a real device or simulator.",
  "Attach iOS Quick Log/Log proof and Android Launch Readiness proof.",
  "Verify Records/Care Pass Report History shows Printable HTML, file size, and PDF pending.",
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
const bundledPnpmPath = join(
  resolve(dirname(process.execPath), "..", ".."),
  "bin",
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
);
const bundledPnpmPackagePath = join(
  resolve(dirname(process.execPath), ".."),
  "node_modules",
  "pnpm",
  "package.json",
);
const bundledPnpmVersion = existsSync(bundledPnpmPackagePath)
  ? readJson(bundledPnpmPackagePath).version
  : "";
const bundledPnpmIsUnsupported = Boolean(bundledPnpmVersion && bundledPnpmVersion !== expectedPnpmVersion);
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
check(
  "unsupported bundled pnpm candidate",
  !bundledPnpmIsUnsupported,
  bundledPnpmVersion
    ? `bundled pnpm ${bundledPnpmVersion} at ${bundledPnpmPath}; beta export requires pnpm ${expectedPnpmVersion}`
    : `no bundled pnpm candidate found; beta export requires pnpm ${expectedPnpmVersion}`,
  "warning",
);

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
check("static preview command exists", mobilePackage.scripts?.["preview:smoke"] === "node scripts/serve-smoke-preview.js 4194", mobilePackage.scripts?.["preview:smoke"] ?? "missing preview:smoke");

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

const betaHandoffPacketPath = join(mobileRoot, "lib", "betaHandoffPacket.ts");
const mobileLaunchQaEvidencePath = join(mobileRoot, "lib", "mobileLaunchQaEvidence.ts");
const mobileReleaseQaPath = join(mobileRoot, "lib", "mobileReleaseQa.ts");
const careTwinQaRoutePath = join(mobileRoot, "app", "care-twin-qa.tsx");
const moreRoutePath = join(mobileRoot, "app", "(tabs)", "more.tsx");
const recordsRoutePath = join(mobileRoot, "app", "(tabs)", "records.tsx");
const carePassDomainPath = join(root, "lib", "care-domain", "src", "care-pass.ts");
const betaHandoffPacketSource = existsSync(betaHandoffPacketPath) ? readFileSync(betaHandoffPacketPath, "utf8") : "";
const mobileLaunchQaEvidenceSource = existsSync(mobileLaunchQaEvidencePath) ? readFileSync(mobileLaunchQaEvidencePath, "utf8") : "";
const mobileReleaseQaSource = existsSync(mobileReleaseQaPath) ? readFileSync(mobileReleaseQaPath, "utf8") : "";
const careTwinQaRouteSource = existsSync(careTwinQaRoutePath) ? readFileSync(careTwinQaRoutePath, "utf8") : "";
const moreRouteSource = existsSync(moreRoutePath) ? readFileSync(moreRoutePath, "utf8") : "";
const recordsRouteSource = existsSync(recordsRoutePath) ? readFileSync(recordsRoutePath, "utf8") : "";
const carePassDomainSource = existsSync(carePassDomainPath) ? readFileSync(carePassDomainPath, "utf8") : "";
const betaHandoffProofSectionsPresent = includesAll(betaHandoffPacketSource, [
  "Dependency proof commands:",
  "Dependency proof requires a real PATH pnpm at 10.24.0; do not use a bundled pnpm 11.x candidate.",
  "Required beta proof after export:",
  "Native QA Needs tune fix brief:",
  "Confirm Care Pass export manifest shows Printable HTML, file size, and PDF pending before claiming PDF readiness.",
  "Provider proof needed:",
  "Truth boundaries:",
])
  && /providerSetupPlan:\s*launchProviderSetupPlan/.test(moreRouteSource)
  && /Share Beta Handoff/.test(moreRouteSource);
check(
  "beta handoff source includes proof sections",
  betaHandoffProofSectionsPresent,
  betaHandoffProofSectionsPresent
    ? "handoff packet has dependency, device, provider, and truth-boundary sections"
    : "keep Share Beta Handoff wired to dependency, device, provider, and truth-boundary proof sections",
);

const ownerPreviewProofWiringIsSourceBacked = includesAll(mobileLaunchQaEvidenceSource, [
  "ownerPreviewProofStatus",
  "OWNER_PREVIEW_CORE_LOOP_ID",
  "Owner preview proof:",
])
  && includesAll(betaHandoffPacketSource, [
    "ownerPreviewProofStatus",
    "Owner preview proof:",
    "Owner preview missing:",
  ])
  && includesAll(moreRouteSource, [
    "ownerPreviewProofStatus",
    "Owner preview proof",
    "Finish Proof",
  ]);
check(
  "owner preview proof wiring is source-backed",
  ownerPreviewProofWiringIsSourceBacked,
  ownerPreviewProofWiringIsSourceBacked
    ? "owner-preview proof status is wired through QA plan, More, and beta handoff"
    : "keep Owner Preview Core Loop proof visible in QA plan, More, and Share Beta Handoff",
);

const careTwinQaRouteProofFlowIsSourceBacked = includesAll(careTwinQaRouteSource, [
  "Mission note",
  "Pass pending proof",
  "Attach proof",
  "care-twin-qa-stage-",
  "qaReturn=care-twin-qa",
])
  && includesAll(mobileReleaseQaSource, [
    "Owner Preview Core Loop",
    "iOS Quick Log or Log screenshot.",
    "Android Launch Readiness screenshot.",
    'route: "/care-twin-qa"',
  ]);
check(
  "care-twin QA route proof flow is source-backed",
  careTwinQaRouteProofFlowIsSourceBacked,
  careTwinQaRouteProofFlowIsSourceBacked
    ? "/care-twin-qa still carries mission note, attach-proof, owner-loop, and iOS/Android proof contracts"
    : "keep /care-twin-qa and the release QA matrix wired to owner-loop device proof",
);

const releaseQaProofGateIsSourceBacked = includesAll(mobileReleaseQaSource, [
  "mobileReleaseQaMissingEvidenceForSurface",
  "mobileReleaseQaReviewStatusLabel",
  "passedWithRequiredProof",
  "passPendingProof",
  "Pass pending proof",
  "Missing proof:",
])
  && includesAll(careTwinQaRouteSource, [
    "mobileReleaseQaMissingEvidenceForSurface(surface, review)",
    "mobileReleaseQaReviewStatusLabel(surface, review)",
    "surfacePassPendingProof",
    "Pass pending release proof",
  ]);
check(
  "release QA proof gate is source-backed",
  releaseQaProofGateIsSourceBacked,
  releaseQaProofGateIsSourceBacked
    ? "release/store QA passes remain pending until required screenshot and note proof exists"
    : "keep release/store QA pass labels gated on required screenshots and QA notes",
);

const nativeQaNeedsTuneFixBriefIsSourceBacked = includesAll(mobileLaunchQaEvidenceSource, [
  "buildMobileLaunchQaFixBriefShareText",
  "firstNeedsTuneTarget",
  "WoofWatcher Needs Tune Fix Brief",
  "No Needs tune route is currently marked.",
  "Continue with the next QA capture in /care-twin-qa",
  "After fix: return to /care-twin-qa",
])
  && includesAll(moreRouteSource, [
    "buildMobileLaunchQaFixBriefShareText",
    "nativeQaCaptureNeedsTuneTarget",
    "Share Fix Brief",
    "Share first Native QA Needs tune fix brief",
  ]);
check(
  "native QA Needs tune fix brief is source-backed",
  nativeQaNeedsTuneFixBriefIsSourceBacked,
  nativeQaNeedsTuneFixBriefIsSourceBacked
    ? "Needs tune recovery can generate a focused fix brief from More after device QA"
    : "keep the first Needs tune target, fix brief builder, and More Share Fix Brief action wired",
);

const providerAwareCarePassStorageIsSourceBacked = includesAll(carePassDomainSource, [
  "CarePassArtifactStorageOptions",
  "describeCarePassArtifactExport",
  "storageProviderConfigured?: boolean",
  "Ready to upload",
  "providerBacked: false",
])
  && /baseStatus === "local-only" && options\.storageProviderConfigured/.test(carePassDomainSource)
  && includesAll(recordsRouteSource, [
    "describeCarePassArtifactExport(artifact",
    "const storage = exportView.storage",
    "storageProviderConfigured: Boolean(state.launchProviderProfile?.storageProviderConfigured)",
    "storage.label",
    "storage.detail",
  ]);
check(
  "provider-aware Care Pass storage is source-backed",
  providerAwareCarePassStorageIsSourceBacked,
  providerAwareCarePassStorageIsSourceBacked
    ? "Records report history follows Provider Launch Setup storage readiness without claiming provider-backed upload"
    : "keep Care Pass storage status wired through Provider Launch Setup, Records, and the shared care-domain helper",
);

const ownerPreviewCarePassStorageProofIsSourceBacked = includesAll(mobileReleaseQaSource, [
  "Care Pass Report History storage status",
  "Saved on this device or Ready to upload",
  "QA note confirming Care Pass Report History storage status stayed truthful.",
  'proof: "Care Pass Report History storage status note or screenshot."',
])
  && includesAll(betaHandoffPacketSource, [
    "Confirm Care Pass Report History storage status says Saved on this device or Ready to upload.",
    "Confirm Care Pass export manifest shows Printable HTML, file size, and PDF pending before claiming PDF readiness.",
])
  && includesAll(mobileLaunchQaEvidenceSource, [
    "Route loop:",
    "routeCheck.proof",
    "Proof:",
  ])
  && includesAll(careTwinQaRouteSource, [
    "Owner route loop",
    "Proof: {routeCheck.proof}",
  ]);
check(
  "owner-preview Care Pass storage proof is source-backed",
  ownerPreviewCarePassStorageProofIsSourceBacked,
  ownerPreviewCarePassStorageProofIsSourceBacked
    ? "Owner Preview route loop carries Care Pass storage proof from QA matrix through share text and /care-twin-qa"
    : "keep Owner Preview Care Pass storage proof in release QA, share text, and /care-twin-qa route loop",
);

const betaHandoffTruthBoundariesAreSourceBacked = includesAll(betaHandoffPacketSource, [
  "Truth boundaries:",
  "No App Store or Play Store submission is approved by this packet.",
  "Provider-backed auth, database, storage, AI, push, and payments must stay gated until credentials and policies are configured.",
  "WoofGuide stays non-diagnostic and owner-reviewed.",
  "Public launch remains separate from local beta evidence.",
])
  && truthBoundaries.every((boundary) => boundary.includes("READY_FOR_EXPORT") || boundary.includes("does not approve") || boundary.includes("BLOCKED"));
check(
  "beta handoff truth boundaries are source-backed",
  betaHandoffTruthBoundariesAreSourceBacked,
  betaHandoffTruthBoundariesAreSourceBacked
    ? "Beta Handoff and JSON doctor both separate beta export proof from public launch/provider approval"
    : "keep Beta Handoff truth boundaries aligned with the JSON doctor before helpers claim readiness",
);

if (!jsonMode) {
  console.log("\nDependency proof commands:");
  for (const command of proofCommands) console.log(`- ${command}`);
  console.log("\nRequired beta proof after export:");
  for (const action of nextActions) console.log(`- ${action}`);
  console.log("\n48-hour beta handoff must include:");
  for (const section of handoffProofSections) console.log(`- ${section}`);
  console.log("\nTruth boundaries:");
  for (const boundary of truthBoundaries) console.log(`- ${boundary}`);
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
      truthBoundaries,
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
      truthBoundaries,
    }, null, 2));
  } else {
    console.log(`\nMobile beta doctor result: READY FOR EXPORT${suffix}`);
  }
}
