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
  "pnpm --filter @workspace/woofwatcher-mobile run smoke:runtime",
  "pnpm --filter @workspace/woofwatcher-mobile run proof:live-preview",
  "pnpm --filter @workspace/woofwatcher-mobile run preview:smoke",
];
const handoffProofSections = [
  "Release smoke checklist",
  "Dependency proof commands",
  "Dependency-complete CI proof",
  "Live preview handoff proof",
  "Recorded live preview proof",
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
  "Run the Release smoke checklist from Share Beta Handoff before claiming beta proof.",
  "Run pnpm --filter @workspace/woofwatcher-mobile run smoke:web.",
  "Run pnpm --filter @workspace/woofwatcher-mobile run smoke:runtime to verify exported mobile routes return 200 from the static runtime.",
  "Run pnpm --filter @workspace/woofwatcher-mobile run proof:live-preview and attach the JSON route proof without claiming native QA.",
  "Serve the exported beta with pnpm --filter @workspace/woofwatcher-mobile run preview:smoke, then open http://127.0.0.1:4194/.",
  "Attach JSON doctor output, branch CI proof, smoke:web and smoke:runtime output, and the preview:smoke URL to the handoff without claiming native QA.",
  "Run pnpm run doctor:native-qa:json before attempting native iOS or Android proof; beta export proof still does not replace native QA.",
  "Open /care-twin-qa on a real device or simulator.",
  "Attach iOS Quick Log/Log proof and Android Launch Readiness proof.",
  "Verify Records/Care Pass Report History shows Printable HTML local file, file size, and PDF pending.",
  "Verify Records Dog ID shares a local HTML credential file and SVG image source; PNG/PDF export stays pending.",
  "Open /care-twin-qa?qaSurface=auth-setup-onboarding-proof and capture Auth gateway plus Setup local-preview proof while provider-backed auth and household creation stay blocked.",
  "Open /care-twin-qa?qaSurface=records-local-file-handoff and capture Records share sheet behavior, Android content URI, and fallback copy.",
  "Open /care-twin-qa?qaSurface=report-binary-export-proof and capture Care Pass PDF generator, Dog ID PNG renderer, provider storage policy, and iOS/Android artifact proof before claiming PDF/PNG readiness.",
  "Open /care-twin-qa?qaSurface=care-entry-provider-sync-proof and capture Supabase migration/backfill, active-household RLS, retention/export/deletion policy, and mobile full-refresh sign-off before enabling incremental sync.",
  "Open /care-twin-qa?qaSurface=woofguide-ai-provider-proof and capture OpenAI key location, approved model policy, source/citation rules, owner-review write gate, veterinary safety boundary, and fallback/incident handling before enabling live AI.",
  "Open /care-twin-qa?qaSurface=push-notifications-proof and capture Expo push project config, APNs credentials, Firebase/FCM credentials, permission prompt copy, quiet hours, opt-out behavior, delivery QA, and missed notification fallback before claiming reminder delivery.",
  "Open /care-twin-qa?qaSurface=payments-provider-proof and capture Plus and Family product ids, billing path decision, sandbox receipts, restore purchases, entitlement mapping, refund/support policy, and checkout-gate proof before enabling paid checkout.",
  "Open /care-twin-qa?qaSurface=store-accounts-proof and capture Apple Developer team id, App Store Connect app record, Google Play package record, reviewer access, screenshots/metadata ownership, release role approval, and store submission proof before claiming App Review or Play review readiness.",
  "Open /care-twin-qa?qaSurface=account-deletion-proof and capture self-serve deletion route, reauthentication, export-before-delete warning, data/object deletion receipt, audit trail, support receipt, recovery-window policy, and legal/store approval before enabling destructive account deletion.",
  "Open /care-twin-qa?qaSurface=support-legal-readiness-proof and capture support inbox, privacy policy and terms links, refund/subscription policy, veterinary boundary, deletion escalation, incident response owner, and Apollo approval before public launch.",
  "Open /care-twin-qa?qaSurface=route-visual-consistency and capture Home, Log, Plans, Health, Records, and More on iOS and Android before claiming route visual proof.",
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
check(
  "native QA tooling doctor command is wired",
  rootPackage.scripts?.["doctor:native-qa"] === "node scripts/native-qa-tooling-doctor.mjs"
    && rootPackage.scripts?.["doctor:native-qa:json"] === "node scripts/native-qa-tooling-doctor.mjs --json",
  rootPackage.scripts?.["doctor:native-qa"] ?? "missing doctor:native-qa",
);

const mobilePackagePath = join(mobileRoot, "package.json");
const mobilePackage = readJson(mobilePackagePath);
check("mobile package exists", existsSync(mobilePackagePath), mobilePackage.name);
check("smoke:web export command exists", mobilePackage.scripts?.["smoke:web"] === "node scripts/smoke-web-export.js", mobilePackage.scripts?.["smoke:web"] ?? "missing smoke:web");
check("smoke:runtime route command exists", mobilePackage.scripts?.["smoke:runtime"] === "node scripts/smoke-runtime-preview.js", mobilePackage.scripts?.["smoke:runtime"] ?? "missing smoke:runtime");
check("proof:live-preview command exists", mobilePackage.scripts?.["proof:live-preview"] === "node scripts/live-preview-handoff-proof.js --json", mobilePackage.scripts?.["proof:live-preview"] ?? "missing proof:live-preview");
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
const mobileReleaseSmokeChecklistPath = join(mobileRoot, "lib", "mobileReleaseSmokeChecklist.ts");
const runtimeSmokePreviewPath = join(mobileRoot, "scripts", "smoke-runtime-preview.js");
const livePreviewHandoffProofPath = join(mobileRoot, "scripts", "live-preview-handoff-proof.js");
const avatarSpriteProductionQaPath = join(mobileRoot, "lib", "avatarSpriteProductionQa.ts");
const launchProviderSetupPath = join(mobileRoot, "lib", "launchProviderSetup.ts");
const authProviderProofPath = join(mobileRoot, "lib", "authProviderProof.ts");
const authUiPath = join(mobileRoot, "components", "auth-ui.tsx");
const aiProviderProofPath = join(mobileRoot, "lib", "aiProviderProof.ts");
const accountDeletionProofPath = join(mobileRoot, "lib", "accountDeletionProof.ts");
const storeAccountsProofPath = join(mobileRoot, "lib", "storeAccountsProof.ts");
const pushNotificationsProofPath = join(mobileRoot, "lib", "pushNotificationsProof.ts");
const paymentsProviderProofPath = join(mobileRoot, "lib", "paymentsProviderProof.ts");
const careEntryProviderSyncProofPath = join(mobileRoot, "lib", "careEntryProviderSyncProof.ts");
const reportBinaryExportProofPath = join(mobileRoot, "lib", "reportBinaryExportProof.ts");
const careTwinQaRoutePath = join(mobileRoot, "app", "care-twin-qa.tsx");
const setupRoutePath = join(mobileRoot, "app", "setup.tsx");
const moreRoutePath = join(mobileRoot, "app", "(tabs)", "more.tsx");
const premiumRoutePath = join(mobileRoot, "app", "premium.tsx");
const privacyRoutePath = join(mobileRoot, "app", "privacy.tsx");
const recordsRoutePath = join(mobileRoot, "app", "(tabs)", "records.tsx");
const carePassDomainPath = join(root, "lib", "care-domain", "src", "care-pass.ts");
const betaHandoffPacketSource = existsSync(betaHandoffPacketPath) ? readFileSync(betaHandoffPacketPath, "utf8") : "";
const mobileLaunchQaEvidenceSource = existsSync(mobileLaunchQaEvidencePath) ? readFileSync(mobileLaunchQaEvidencePath, "utf8") : "";
const mobileReleaseQaSource = existsSync(mobileReleaseQaPath) ? readFileSync(mobileReleaseQaPath, "utf8") : "";
const mobileReleaseSmokeChecklistSource = existsSync(mobileReleaseSmokeChecklistPath) ? readFileSync(mobileReleaseSmokeChecklistPath, "utf8") : "";
const runtimeSmokePreviewSource = existsSync(runtimeSmokePreviewPath) ? readFileSync(runtimeSmokePreviewPath, "utf8") : "";
const livePreviewHandoffProofSource = existsSync(livePreviewHandoffProofPath) ? readFileSync(livePreviewHandoffProofPath, "utf8") : "";
const avatarSpriteProductionQaSource = existsSync(avatarSpriteProductionQaPath) ? readFileSync(avatarSpriteProductionQaPath, "utf8") : "";
const launchProviderSetupSource = existsSync(launchProviderSetupPath) ? readFileSync(launchProviderSetupPath, "utf8") : "";
const authProviderProofSource = existsSync(authProviderProofPath) ? readFileSync(authProviderProofPath, "utf8") : "";
const authUiSource = existsSync(authUiPath) ? readFileSync(authUiPath, "utf8") : "";
const aiProviderProofSource = existsSync(aiProviderProofPath) ? readFileSync(aiProviderProofPath, "utf8") : "";
const accountDeletionProofSource = existsSync(accountDeletionProofPath) ? readFileSync(accountDeletionProofPath, "utf8") : "";
const storeAccountsProofSource = existsSync(storeAccountsProofPath) ? readFileSync(storeAccountsProofPath, "utf8") : "";
const pushNotificationsProofSource = existsSync(pushNotificationsProofPath) ? readFileSync(pushNotificationsProofPath, "utf8") : "";
const paymentsProviderProofSource = existsSync(paymentsProviderProofPath) ? readFileSync(paymentsProviderProofPath, "utf8") : "";
const careEntryProviderSyncProofSource = existsSync(careEntryProviderSyncProofPath) ? readFileSync(careEntryProviderSyncProofPath, "utf8") : "";
const reportBinaryExportProofSource = existsSync(reportBinaryExportProofPath) ? readFileSync(reportBinaryExportProofPath, "utf8") : "";
const careTwinQaRouteSource = existsSync(careTwinQaRoutePath) ? readFileSync(careTwinQaRoutePath, "utf8") : "";
const setupRouteSource = existsSync(setupRoutePath) ? readFileSync(setupRoutePath, "utf8") : "";
const moreRouteSource = existsSync(moreRoutePath) ? readFileSync(moreRoutePath, "utf8") : "";
const premiumRouteSource = existsSync(premiumRoutePath) ? readFileSync(premiumRoutePath, "utf8") : "";
const privacyRouteSource = existsSync(privacyRoutePath) ? readFileSync(privacyRoutePath, "utf8") : "";
const recordsRouteSource = existsSync(recordsRoutePath) ? readFileSync(recordsRoutePath, "utf8") : "";
const carePassDomainSource = existsSync(carePassDomainPath) ? readFileSync(carePassDomainPath, "utf8") : "";
const betaHandoffProofSectionsPresent = includesAll(betaHandoffPacketSource, [
  "Release smoke checklist:",
  "buildMobileReleaseSmokeChecklistShareText",
  "Dependency proof commands:",
  "Dependency-complete CI proof:",
  "Recorded live preview proof:",
  "Dependency proof requires a real PATH pnpm at 10.24.0; do not use a bundled pnpm 11.x candidate.",
  "CI proof does not approve native screenshots, provider setup, store approval, or Apollo sign-off.",
  "Required beta proof after export:",
  "Native QA Needs tune fix brief:",
  "Confirm Care Pass export manifest shows Printable HTML local file, file size, and PDF pending before claiming PDF readiness.",
  "Confirm Records Dog ID shares a local HTML credential file and SVG image source; PNG/PDF export stays pending.",
  "Open focused auth/setup target: /care-twin-qa?qaSurface=auth-setup-onboarding-proof.",
  "Capture Auth gateway and Setup local-preview proof while provider-backed auth and household creation stay blocked.",
  "Open focused Records handoff target: /care-twin-qa?qaSurface=records-local-file-handoff.",
  "Capture Care Pass Report History local HTML, Dog ID local HTML, Dog ID SVG, share sheet behavior, Android content URI, and fallback copy.",
  "Open focused care-entry provider sync target: /care-twin-qa?qaSurface=care-entry-provider-sync-proof.",
  "Open focused WoofGuide AI provider target: /care-twin-qa?qaSurface=woofguide-ai-provider-proof.",
  "Open focused push notifications target: /care-twin-qa?qaSurface=push-notifications-proof.",
  "Open focused payments provider target: /care-twin-qa?qaSurface=payments-provider-proof.",
  "Open focused store accounts target: /care-twin-qa?qaSurface=store-accounts-proof.",
  "Open focused account deletion target: /care-twin-qa?qaSurface=account-deletion-proof.",
  "Open focused support legal readiness target: /care-twin-qa?qaSurface=support-legal-readiness-proof.",
  "Attach support inbox, privacy policy and terms links, refund/subscription policy, veterinary boundary, deletion escalation, incident response owner, and Apollo approval before public launch.",
  "Provider proof needed:",
  "Truth boundaries:",
])
  && mobileReleaseSmokeChecklistSource.includes("pnpm --filter @workspace/woofwatcher-mobile run preview:smoke")
  && /RECORDED_MOBILE_BETA_CI_PROOF/.test(moreRouteSource)
  && /ciProof:\s*RECORDED_MOBILE_BETA_CI_PROOF/.test(moreRouteSource)
  && /RECORDED_LIVE_PREVIEW_HANDOFF_PROOF/.test(moreRouteSource)
  && /livePreviewProof:\s*RECORDED_LIVE_PREVIEW_HANDOFF_PROOF/.test(moreRouteSource)
  && /providerSetupPlan:\s*launchProviderSetupPlan/.test(moreRouteSource)
  && /Share Beta Handoff/.test(moreRouteSource);
check(
  "beta handoff source includes proof sections",
  betaHandoffProofSectionsPresent,
  betaHandoffProofSectionsPresent
    ? "handoff packet has CI, dependency, device, provider, and truth-boundary sections"
    : "keep Share Beta Handoff wired to CI, dependency, device, provider, and truth-boundary proof sections",
);

const releaseSmokeChecklistIsSourceBacked = includesAll(mobileReleaseSmokeChecklistSource, [
  "WoofWatcher Release Smoke Checklist",
  "MOBILE_RELEASE_SMOKE_DEPENDENCY_COMMANDS",
  "Dependency and export proof",
  "Route rehearsal",
  "Records and export truth",
  "Provider proof gates",
  "Native and store proof",
  "WoofWatcherReports",
  "WoofWatcherCredentials",
  "Focused Records handoff target",
  "/care-twin-qa?qaSurface=records-local-file-handoff",
  "Focused care-entry provider sync proof target",
  "/care-twin-qa?qaSurface=care-entry-provider-sync-proof",
  "Focused WoofGuide AI provider proof target",
  "/care-twin-qa?qaSurface=woofguide-ai-provider-proof",
  "Focused push notifications proof target",
  "/care-twin-qa?qaSurface=push-notifications-proof",
  "Focused payments provider proof target",
  "/care-twin-qa?qaSurface=payments-provider-proof",
  "Focused store accounts proof target",
  "/care-twin-qa?qaSurface=store-accounts-proof",
  "Focused account deletion proof target",
  "/care-twin-qa?qaSurface=account-deletion-proof",
  "Focused support legal readiness proof target",
  "/care-twin-qa?qaSurface=support-legal-readiness-proof",
  "Android content URI",
  "fallback copy",
  "pnpm --filter @workspace/woofwatcher-mobile run smoke:runtime",
  "Generated PDF and credential PNG/PDF export stay pending",
  "pnpm --filter @workspace/woofwatcher-mobile run proof:live-preview",
])
  && includesAll(betaHandoffPacketSource, [
    "buildMobileReleaseSmokeChecklist",
    "buildMobileReleaseSmokeChecklistShareText",
    "Release smoke checklist:",
  ])
  && handoffProofSections.includes("Release smoke checklist");
check(
  "release smoke checklist is source-backed",
  releaseSmokeChecklistIsSourceBacked,
  releaseSmokeChecklistIsSourceBacked
    ? "Share Beta Handoff carries the dependency, route, Records export, provider, native/store, and truth-boundary smoke checklist"
    : "keep Release smoke checklist wired through mobileReleaseSmokeChecklist.ts and Share Beta Handoff",
);

const livePreviewHandoffProofIsSourceBacked = includesAll(mobileReleaseSmokeChecklistSource, [
  "Live preview handoff proof",
  "Dependency-complete branch CI",
  "Preview server handoff",
  "Live preview handoff verifier",
  "proof:live-preview",
  "preview:smoke terminal output",
  "http://127.0.0.1:4194/",
  "live preview proof does not replace native iOS/Android proof",
])
  && includesAll(betaHandoffPacketSource, [
    "buildMobileReleaseSmokeChecklist",
    "buildMobileReleaseSmokeChecklistShareText",
    "Release smoke checklist:",
  ])
  && handoffProofSections.includes("Live preview handoff proof");
check(
  "live preview handoff proof is source-backed",
  livePreviewHandoffProofIsSourceBacked,
  livePreviewHandoffProofIsSourceBacked
    ? "Live preview handoff proof requires branch CI, JSON doctor/export/runtime proof, preview URL, and native-proof boundaries"
    : "keep live preview proof wired through the release smoke checklist, Share Beta Handoff, and doctor next actions",
);

const livePreviewHandoffVerifierIsSourceBacked = mobilePackage.scripts?.["proof:live-preview"] === "node scripts/live-preview-handoff-proof.js --json"
  && includesAll(livePreviewHandoffProofSource, [
    "LIVE_PREVIEW_HANDOFF_ROUTES",
    '"/sign-in"',
    '"/setup"',
    "auth-setup-onboarding-proof",
    "records-local-file-handoff",
    "report-binary-export-proof",
    "care-entry-provider-sync-proof",
    "woofguide-ai-provider-proof",
    "payments-provider-proof",
    "store-accounts-proof",
    "account-deletion-proof",
    "support-legal-readiness-proof",
    "route-visual-consistency",
    "WoofWatcher Live Preview Handoff Proof",
    "web preview only",
    "does not replace native iOS/Android proof",
    "Attach this JSON",
  ])
  && includesAll(mobileReleaseSmokeChecklistSource, [
    "Live preview handoff verifier",
    "pnpm --filter @workspace/woofwatcher-mobile run proof:live-preview",
  ])
  && proofCommands.includes("pnpm --filter @workspace/woofwatcher-mobile run proof:live-preview");
check(
  "live preview handoff verifier is source-backed",
  livePreviewHandoffVerifierIsSourceBacked,
  livePreviewHandoffVerifierIsSourceBacked
    ? "Live preview proof can emit JSON route evidence with preview-only boundaries"
    : "keep proof:live-preview wired through the mobile script, release smoke checklist, and doctor proof commands",
);

const authSetupRuntimeSmokeProofIsSourceBacked = includesAll(runtimeSmokePreviewSource, [
  "MOBILE_RUNTIME_SMOKE_ROUTES",
  '"/sign-in"',
  '"/setup"',
  "WoofWatcher mobile runtime smoke passed",
])
  && includesAll(livePreviewHandoffProofSource, [
    "LIVE_PREVIEW_HANDOFF_ROUTES",
    '"/sign-in"',
    '"/setup"',
  ])
  && includesAll(mobileReleaseSmokeChecklistSource, [
    "Auth and setup route smoke",
    "/sign-in",
    "/setup",
    "does not prove provider-backed auth or household creation",
  ]);
check(
  "auth/setup runtime smoke proof is source-backed",
  authSetupRuntimeSmokeProofIsSourceBacked,
  authSetupRuntimeSmokeProofIsSourceBacked
    ? "smoke:runtime and proof:live-preview include sign-in and setup without claiming provider-backed auth"
    : "keep /sign-in and /setup covered by smoke:runtime, proof:live-preview, and the release smoke checklist",
);

const authSetupNativeQaTargetIsSourceBacked = includesAll(mobileReleaseQaSource, [
  "auth-setup-onboarding-proof",
  "Auth And Setup Onboarding Proof",
  "provider-backed auth stays blocked",
  "Clerk production credentials are not configured",
  "Local preview household setup",
  "provider-backed auth and household creation stay blocked",
])
  && includesAll(betaHandoffPacketSource, [
    "Open focused auth/setup target: /care-twin-qa?qaSurface=auth-setup-onboarding-proof.",
    "Capture Auth gateway and Setup local-preview proof while provider-backed auth and household creation stay blocked.",
  ])
  && includesAll(mobileReleaseSmokeChecklistSource, [
    "Focused auth/setup onboarding proof target",
    "/care-twin-qa?qaSurface=auth-setup-onboarding-proof",
    "provider-backed auth and household creation stay blocked",
  ])
  && includesAll(livePreviewHandoffProofSource, [
    "auth-setup-onboarding-proof",
  ]);
check(
  "auth/setup native QA target is source-backed",
  authSetupNativeQaTargetIsSourceBacked,
  authSetupNativeQaTargetIsSourceBacked
    ? "Auth/setup native proof has a focused QA target, beta handoff instruction, smoke checklist item, live-preview route, and doctor next action"
    : "keep auth/setup onboarding proof wired through release QA, Share Beta Handoff, smoke checklist, live-preview proof, and doctor next actions",
);

const authProviderProofPacketIsSourceBacked = includesAll(authProviderProofSource, [
  "AUTH_PROVIDER_PROOF_SUMMARY",
  "AUTH_PROVIDER_PROOF_ITEMS",
  "Production auth provider proof packet",
  "Clerk production app id",
  "redirect/deep-link URL list",
  "OAuth sign-in test",
  "session policy",
  "household membership policy",
])
  && includesAll(launchProviderSetupSource, [
    "AUTH_PROVIDER_PROOF_SUMMARY",
    "AUTH_PROVIDER_PROOF_ITEMS",
    "Production auth",
    "authConfigured",
  ])
  && includesAll(betaHandoffPacketSource, [
    "Provider proof needed:",
    "formatProviderProof",
  ]);
check(
  "auth provider proof packet is source-backed",
  authProviderProofPacketIsSourceBacked,
  authProviderProofPacketIsSourceBacked
    ? "Production auth readiness requires the Clerk/OAuth/deep-link/session/household proof packet through Provider Launch Setup and Share Beta Handoff"
    : "keep auth provider proof modeled in authProviderProof.ts and wired through Provider Launch Setup plus Share Beta Handoff",
);

const authSetupProofManifestIsSourceBacked = includesAll(authProviderProofSource, [
  "buildAuthSetupProofManifest",
  "Clerk production app",
  "Redirect and deep links",
  "Native auth screenshots",
  "Setup local-preview proof",
  "Native proof blocked",
  "Apollo approval",
])
  && includesAll(authUiSource, [
    "buildAuthSetupProofManifest",
    "const authSetupProofManifest = buildAuthSetupProofManifest",
    "Auth/Setup proof manifest",
    "authSetupProofManifest.rows.map",
    "authSetupProofManifest.blockers.map",
    "Native proof blocked",
  ])
  && includesAll(setupRouteSource, [
    "buildAuthSetupProofManifest",
    "const authSetupProofManifest = buildAuthSetupProofManifest",
    "Auth/Setup proof manifest",
    "authSetupProofManifest.rows.map",
    "authSetupProofManifest.blockers.map",
    "Native proof blocked",
  ]);
check(
  "auth/setup proof manifest is source-backed",
  authSetupProofManifestIsSourceBacked,
  authSetupProofManifestIsSourceBacked
    ? "Auth gateway and Setup show Clerk, redirect, native screenshot, local-preview setup, household sync, and launch blockers before native auth/setup proof can be claimed"
    : "keep Auth gateway and Setup wired to buildAuthSetupProofManifest before claiming native auth/setup proof",
);

const paymentsProviderProofPacketIsSourceBacked = includesAll(paymentsProviderProofSource, [
  "PAYMENTS_PROVIDER_PROOF_SUMMARY",
  "PAYMENTS_PROVIDER_PROOF_ITEMS",
  "WoofWatcher Plus payments proof packet",
  "Plus and Family product ids",
  "billing path decision",
  "sandbox receipt test",
  "entitlement mapping",
  "refund and support policy",
])
  && includesAll(launchProviderSetupSource, [
    "PAYMENTS_PROVIDER_PROOF_SUMMARY",
    "PAYMENTS_PROVIDER_PROOF_ITEMS",
    "WoofWatcher Plus payments",
    "paymentsEnabled",
  ])
  && includesAll(betaHandoffPacketSource, [
    "Provider proof needed:",
    "formatProviderProof",
  ]);
check(
  "payments provider proof packet is source-backed",
  paymentsProviderProofPacketIsSourceBacked,
  paymentsProviderProofPacketIsSourceBacked
    ? "Payments readiness requires product ids, billing path, sandbox receipts, entitlements, refund/support policy, and checkout gate proof through Provider Launch Setup and Share Beta Handoff"
    : "keep payments proof modeled in paymentsProviderProof.ts and wired through Provider Launch Setup plus Share Beta Handoff",
);

const premiumPaymentsProofManifestIsSourceBacked = includesAll(paymentsProviderProofSource, [
  "buildPaymentsProviderProofManifest",
  "Product catalog",
  "Sandbox receipts",
  "Entitlements and restore",
  "Checkout disabled",
  "restore purchases",
  "Apollo approval",
])
  && includesAll(premiumRouteSource, [
    "buildPaymentsProviderProofManifest",
    "const paymentsProofManifest = buildPaymentsProviderProofManifest",
    "Payments proof manifest",
    "paymentsProofManifest.rows.map",
    "paymentsProofManifest.blockers.map",
    "Checkout disabled",
  ]);
check(
  "premium payments proof manifest is source-backed",
  premiumPaymentsProofManifestIsSourceBacked,
  premiumPaymentsProofManifestIsSourceBacked
    ? "Premium shows product catalog, billing path, sandbox receipt, restore purchase, refund/support, and checkout blockers before paid checkout can be enabled"
    : "keep Premium wired to buildPaymentsProviderProofManifest so checkout stays blocked until real billing proof is attached",
);

const aiProviderProofPacketIsSourceBacked = includesAll(aiProviderProofSource, [
  "AI_PROVIDER_PROOF_SUMMARY",
  "AI_PROVIDER_PROOF_ITEMS",
  "WoofGuide AI provider proof packet",
  "OpenAI key location",
  "approved model policy",
  "source/citation rules",
  "owner-review write gate",
  "veterinary safety boundary",
])
  && includesAll(launchProviderSetupSource, [
    "AI_PROVIDER_PROOF_SUMMARY",
    "AI_PROVIDER_PROOF_ITEMS",
    "WoofGuide AI",
    "aiProviderConfigured",
  ])
  && includesAll(betaHandoffPacketSource, [
    "Provider proof needed:",
    "formatProviderProof",
  ]);
check(
  "ai provider proof packet is source-backed",
  aiProviderProofPacketIsSourceBacked,
  aiProviderProofPacketIsSourceBacked
    ? "WoofGuide AI readiness requires key storage, model policy, source/citation rules, owner-review write gates, veterinary boundaries, and fallback proof through Provider Launch Setup and Share Beta Handoff"
    : "keep AI proof modeled in aiProviderProof.ts and wired through Provider Launch Setup plus Share Beta Handoff",
);

const accountDeletionProofPacketIsSourceBacked = includesAll(accountDeletionProofSource, [
  "ACCOUNT_DELETION_PROOF_SUMMARY",
  "ACCOUNT_DELETION_PROOF_ITEMS",
  "Self-serve account deletion proof packet",
  "self-serve deletion route",
  "export-before-delete warning",
  "data/object deletion receipt",
  "audit trail",
  "recovery-window policy",
  "legal/store approval",
])
  && includesAll(launchProviderSetupSource, [
    "ACCOUNT_DELETION_PROOF_SUMMARY",
    "ACCOUNT_DELETION_PROOF_ITEMS",
    "Self-serve account deletion",
    "accountDeletionEnabled",
  ])
  && includesAll(betaHandoffPacketSource, [
    "Provider proof needed:",
    "formatProviderProof",
  ]);
check(
  "account deletion proof packet is source-backed",
  accountDeletionProofPacketIsSourceBacked,
  accountDeletionProofPacketIsSourceBacked
    ? "Self-serve account deletion readiness requires deletion route, export-before-delete, data/object deletion receipt, audit trail, recovery window, and legal/store proof through Provider Launch Setup and Share Beta Handoff"
    : "keep account deletion proof modeled in accountDeletionProof.ts and wired through Provider Launch Setup plus Share Beta Handoff",
);

const storeAccountsProofPacketIsSourceBacked = includesAll(storeAccountsProofSource, [
  "STORE_ACCOUNTS_PROOF_SUMMARY",
  "STORE_ACCOUNTS_PROOF_ITEMS",
  "Apple and Google store accounts proof packet",
  "Apple Developer team id",
  "App Store Connect app record",
  "Google Play package record",
  "bundle ids",
  "reviewer access notes",
  "release role approval",
])
  && includesAll(launchProviderSetupSource, [
    "STORE_ACCOUNTS_PROOF_SUMMARY",
    "STORE_ACCOUNTS_PROOF_ITEMS",
    "Apple and Google store accounts",
    "appStoreAccountsReady",
  ])
  && includesAll(betaHandoffPacketSource, [
    "Provider proof needed:",
    "formatProviderProof",
  ]);
check(
  "store accounts proof packet is source-backed",
  storeAccountsProofPacketIsSourceBacked,
  storeAccountsProofPacketIsSourceBacked
    ? "Store submission readiness requires Apple Developer, App Store Connect, Google Play, bundle id, reviewer access, metadata, and release role proof through Provider Launch Setup and Share Beta Handoff"
    : "keep store account proof modeled in storeAccountsProof.ts and wired through Provider Launch Setup plus Share Beta Handoff",
);

const pushNotificationsProofPacketIsSourceBacked = includesAll(pushNotificationsProofSource, [
  "PUSH_NOTIFICATIONS_PROOF_SUMMARY",
  "PUSH_NOTIFICATIONS_PROOF_ITEMS",
  "Push notifications proof packet",
  "Expo push project config",
  "APNs credentials",
  "Firebase/FCM credentials",
  "permission prompt copy",
  "quiet hours",
  "opt-out behavior",
  "delivery QA",
])
  && includesAll(launchProviderSetupSource, [
    "PUSH_NOTIFICATIONS_PROOF_SUMMARY",
    "PUSH_NOTIFICATIONS_PROOF_ITEMS",
    "Push notifications",
    "pushNotificationsConfigured",
  ])
  && includesAll(betaHandoffPacketSource, [
    "Provider proof needed:",
    "formatProviderProof",
  ]);
check(
  "push notifications proof packet is source-backed",
  pushNotificationsProofPacketIsSourceBacked,
  pushNotificationsProofPacketIsSourceBacked
    ? "Push readiness requires Expo, APNs, FCM, permission copy, quiet hours, opt-out, and delivery QA proof through Provider Launch Setup and Share Beta Handoff"
    : "keep push notification proof modeled in pushNotificationsProof.ts and wired through Provider Launch Setup plus Share Beta Handoff",
);

const recordedCiProofFreshnessBoundaryIsSourceBacked = includesAll(betaHandoffPacketSource, [
  "RECORDED_MOBILE_BETA_CI_PROOF",
  'runId: "28684865218"',
  'jobId: "85075545003"',
  'commit: "5c0a11f"',
  "auth/setup smoke proof",
  "auth/setup native QA target",
  "auth provider proof packet",
  "provider staged-row truth boundary",
  "support legal readiness proof target",
  "provider-approved support/legal launch-readiness wiring",
  "Plus checkout approval truth boundary",
  "Records storage provider-approval clamp",
  "Records binary proof manifest",
  "Premium payments proof manifest",
  "Auth/Setup proof manifest",
  "Recorded branch CI proof:",
  "Rerun WoofWatcher Verify after any new commit before treating dependency proof as current.",
  "CI proof does not approve native screenshots, provider setup, store approval, or Apollo sign-off.",
]);
check(
  "recorded CI proof freshness boundary is source-backed",
  recordedCiProofFreshnessBoundaryIsSourceBacked,
  recordedCiProofFreshnessBoundaryIsSourceBacked
    ? "Recorded CI proof names run 28684865218 on commit 5c0a11f while requiring a rerun after new commits"
    : "keep recorded CI proof labeled as historical branch evidence with a rerun-after-new-commit boundary",
);

const recordedLivePreviewProofAttachmentIsSourceBacked = includesAll(betaHandoffPacketSource, [
  "RECORDED_LIVE_PREVIEW_HANDOFF_PROOF",
  'title: "WoofWatcher Live Preview Handoff Proof"',
  'commit: "5c0a11f"',
  "auth-setup-onboarding-proof",
  "care-entry-provider-sync-proof",
  "woofguide-ai-provider-proof",
  "payments-provider-proof",
  "store-accounts-proof",
  "account-deletion-proof",
  "support-legal-readiness-proof",
  "Recorded live preview proof:",
  "Routes: ${passCount}/${totalCount} web-preview shell checks passed.",
  "Attach proof: JSON route proof plus preview:smoke URL/output before claiming preview handoff.",
  "Rerun proof:live-preview after any new commit or export before treating preview proof as current.",
  "Live preview proof does not replace native iOS/Android proof.",
])
  && /RECORDED_LIVE_PREVIEW_HANDOFF_PROOF/.test(moreRouteSource)
  && /livePreviewProof:\s*RECORDED_LIVE_PREVIEW_HANDOFF_PROOF/.test(moreRouteSource)
  && handoffProofSections.includes("Recorded live preview proof");
check(
  "recorded live preview proof attachment is source-backed",
  recordedLivePreviewProofAttachmentIsSourceBacked,
  recordedLivePreviewProofAttachmentIsSourceBacked
    ? "Share Beta Handoff carries recorded live preview route proof with a rerun-after-new-commit boundary"
    : "keep recorded live preview proof wired through betaHandoffPacket.ts, More, and the doctor handoff sections",
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
  "buildMobileLaunchQaReturnRoute",
])
  && includesAll(mobileLaunchQaEvidenceSource, [
    "buildMobileLaunchQaReturnRoute",
    "qaReturn=care-twin-qa",
    "qaSurface=${encodeURIComponent(surfaceId)}",
    "qaTitle=${encodeURIComponent(title)}",
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

const avatarSpriteProductionReviewIsSourceBacked = includesAll(avatarSpriteProductionQaSource, [
  "buildAvatarSpriteProductionQaSummary",
  "AVATAR_SPRITE_PRODUCTION_REQUIRED_CHECKS",
  "Local sprite metadata only",
  "iOS and Android screenshots",
  "bottom-center anchor",
  "walk gait feels like a video-game loop",
])
  && includesAll(mobileReleaseQaSource, [
    "avatar-sprite-production-review",
    "Avatar Sprite Production Review",
    "Pass pending proof",
    "gait/crop note",
  ])
  && includesAll(careTwinQaRouteSource, [
    "focusedQaTarget",
    "Attach focused QA proof",
    "Pass pending release proof",
  ]);
check(
  "avatar sprite production review is source-backed",
  avatarSpriteProductionReviewIsSourceBacked,
  avatarSpriteProductionReviewIsSourceBacked
    ? "PixelLab live template sprite/gait review is wired through the release QA cockpit"
    : "keep Avatar Sprite Production Review wired to sprite registry, proof gating, and focused /care-twin-qa capture",
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
    "deriveLaunchProviderSetup",
    "describeCarePassArtifactExport(artifact",
    "const storage = exportView.storage",
    "storageProviderConfigured: launchProviderSetupPlan.providerInput.storageProviderConfigured",
    "storage.label",
    "storage.detail",
  ]);
check(
  "provider-aware Care Pass storage is source-backed",
  providerAwareCarePassStorageIsSourceBacked,
  providerAwareCarePassStorageIsSourceBacked
    ? "Records report history follows provider-approved Provider Launch Setup storage readiness without claiming provider-backed upload"
    : "keep Care Pass storage status wired through Provider Launch Setup, Records, and the shared care-domain helper",
);

const ownerPreviewCarePassStorageProofIsSourceBacked = includesAll(mobileReleaseQaSource, [
  "Care Pass Report History storage status",
  "Saved on this device, or Ready to upload only after provider-approved storage",
  "QA note confirming Care Pass Report History storage status stayed truthful.",
  'proof: "Care Pass Report History storage status note or screenshot."',
])
  && includesAll(betaHandoffPacketSource, [
    "Confirm Care Pass Report History storage status says Saved on this device, or Ready to upload only after provider-approved storage.",
    "Confirm Care Pass export manifest shows Printable HTML local file, file size, and PDF pending before claiming PDF readiness.",
    "Confirm Records Dog ID shares a local HTML credential file and SVG image source; PNG/PDF export stays pending.",
])
  && includesAll(mobileLaunchQaEvidenceSource, [
    "Route loop:",
    "mobileReleaseQaRouteProofLabel",
    "Proof:",
  ])
  && includesAll(careTwinQaRouteSource, [
    "Owner route loop",
    "mobileReleaseQaRouteProofLabel(routeCheck)",
  ]);
check(
  "owner-preview Care Pass storage proof is source-backed",
  ownerPreviewCarePassStorageProofIsSourceBacked,
  ownerPreviewCarePassStorageProofIsSourceBacked
    ? "Owner Preview route loop carries Care Pass storage proof from QA matrix through share text and /care-twin-qa"
    : "keep Owner Preview Care Pass storage proof in release QA, share text, and /care-twin-qa route loop",
);

const recordsLocalFileHandoffProofIsSourceBacked = includesAll(mobileReleaseQaSource, [
  "records-local-file-handoff",
  "Records Local File Handoff",
  "Care Pass Report History local HTML",
  "Dog ID local HTML and SVG",
  "WoofWatcherReports",
  "WoofWatcherCredentials",
  "Android content URI",
  "fallback copy",
  "PNG/PDF export stays pending",
])
  && includesAll(betaHandoffPacketSource, [
    "Open focused Records handoff target: /care-twin-qa?qaSurface=records-local-file-handoff.",
    "Capture Care Pass Report History local HTML, Dog ID local HTML, Dog ID SVG, share sheet behavior, Android content URI, and fallback copy.",
  ])
  && includesAll(mobileReleaseSmokeChecklistSource, [
    "Focused Records handoff target",
    "/care-twin-qa?qaSurface=records-local-file-handoff",
    "Android content URI",
    "fallback copy",
  ]);
check(
  "records local file handoff proof is source-backed",
  recordsLocalFileHandoffProofIsSourceBacked,
  recordsLocalFileHandoffProofIsSourceBacked
    ? "Records local HTML/SVG proof has a focused QA target, beta handoff instruction, smoke checklist item, and doctor next action"
    : "keep Records local file handoff proof wired through release QA, Share Beta Handoff, smoke checklist, and doctor next actions",
);

const reportBinaryExportProofPacketIsSourceBacked = includesAll(reportBinaryExportProofSource, [
  "REPORT_BINARY_EXPORT_PROOF_SUMMARY",
  "REPORT_BINARY_EXPORT_PROOF_ITEMS",
  "Report binary export proof packet",
  "Care Pass PDF",
  "Dog ID PNG",
  "expo-print",
  "react-native-view-shot",
  "server renderer",
  "iOS and Android",
])
  && includesAll(launchProviderSetupSource, [
    "REPORT_BINARY_EXPORT_PROOF_SUMMARY",
    "REPORT_BINARY_EXPORT_PROOF_ITEMS",
    "Records and media storage",
    "storageProviderConfigured",
  ])
  && includesAll(mobileReleaseSmokeChecklistSource, [
    "Provider proof gates",
    "proofChecklist",
  ]);
check(
  "report binary export proof packet is source-backed",
  reportBinaryExportProofPacketIsSourceBacked,
  reportBinaryExportProofPacketIsSourceBacked
    ? "PDF/PNG readiness requires the binary export proof packet through Provider Launch Setup and the beta smoke checklist"
    : "keep binary PDF/PNG export proof modeled in reportBinaryExportProof.ts and wired through Provider Launch Setup",
);

const recordsBinaryExportProofManifestIsSourceBacked = includesAll(reportBinaryExportProofSource, [
  "buildReportBinaryExportProofManifest",
  "carePassHtmlFileName",
  "dogIdSvgFileName",
  "application/pdf",
  "image/png",
  "Provider storage pending",
  "iOS/Android proof pending",
])
  && includesAll(recordsRouteSource, [
    "buildReportBinaryExportProofManifest",
    "Binary proof manifest",
    "const binaryProofManifest = buildReportBinaryExportProofManifest",
    "carePassHtmlFileName: exportView.fileName",
    "dogIdSvgFileName: credentialImageView.fileName",
    "storageProviderConfigured: launchProviderSetupPlan.providerInput.storageProviderConfigured",
    "binaryProofManifest.rows.map",
    "binaryProofManifest.blockers.map",
  ]);
check(
  "records binary export proof manifest is source-backed",
  recordsBinaryExportProofManifestIsSourceBacked,
  recordsBinaryExportProofManifestIsSourceBacked
    ? "Records shows artifact-specific PDF/PNG proof status from local Care Pass HTML, Dog ID SVG, provider storage approval, and native evidence blockers"
    : "keep Records Report History wired to the binary export proof manifest before claiming generated PDF/PNG readiness",
);

const reportBinaryExportProofTargetIsSourceBacked = includesAll(mobileReleaseQaSource, [
  "report-binary-export-proof",
  "Report Binary Export Proof",
  "Care Pass PDF generator",
  "Dog ID PNG renderer",
  "Provider Launch Setup",
  "file name, file size, MIME proof",
  "HTML-only fallback",
])
  && includesAll(betaHandoffPacketSource, [
    "Open focused binary export proof target: /care-twin-qa?qaSurface=report-binary-export-proof.",
    "Approve Care Pass PDF generator, Dog ID PNG renderer, provider storage policy, and iOS/Android artifact proof before claiming PDF/PNG readiness.",
  ])
  && includesAll(mobileReleaseSmokeChecklistSource, [
    "Focused binary export proof target",
    "/care-twin-qa?qaSurface=report-binary-export-proof",
    "approved Care Pass PDF generator",
    "approved Dog ID PNG renderer",
  ]);
check(
  "report binary export proof target is source-backed",
  reportBinaryExportProofTargetIsSourceBacked,
  reportBinaryExportProofTargetIsSourceBacked
    ? "Binary export proof has a focused QA target, beta handoff instruction, smoke checklist item, and doctor next action"
    : "keep binary export proof wired through release QA, Share Beta Handoff, smoke checklist, and doctor next actions",
);

const careEntryProviderSyncProofTargetIsSourceBacked = includesAll(careEntryProviderSyncProofSource, [
  "CARE_ENTRY_PROVIDER_SYNC_PROOF_SUMMARY",
  "CARE_ENTRY_PROVIDER_SYNC_PROOF_ITEMS",
  "care_entries.updated_at",
  "care_entry_tombstones",
  "/care-entries?updatedSince=",
  "/care-entries/tombstones?updatedSince=",
  "mobile full-refresh sign-off",
])
  && includesAll(mobileReleaseQaSource, [
    "care-entry-provider-sync-proof",
    "Care-entry Provider Sync Proof",
    "Supabase migration",
    "active-household RLS",
    "retention/export/deletion",
    "incremental sync stays blocked",
  ])
  && includesAll(betaHandoffPacketSource, [
    "Open focused care-entry provider sync target: /care-twin-qa?qaSurface=care-entry-provider-sync-proof.",
    "Attach Supabase project id, migration/backfill for care_entries.updated_at and care_entry_tombstones",
  ])
  && includesAll(mobileReleaseSmokeChecklistSource, [
    "Focused care-entry provider sync proof target",
    "/care-twin-qa?qaSurface=care-entry-provider-sync-proof",
    "Supabase migration/backfill",
    "active-household RLS",
  ])
  && includesAll(livePreviewHandoffProofSource, [
    "care-entry-provider-sync-proof",
  ]);
check(
  "care-entry provider sync proof target is source-backed",
  careEntryProviderSyncProofTargetIsSourceBacked,
  careEntryProviderSyncProofTargetIsSourceBacked
    ? "Care-entry provider sync proof has a focused QA target, beta handoff instruction, smoke checklist item, live-preview route, and doctor next action"
    : "keep care-entry provider sync proof wired through release QA, Share Beta Handoff, smoke checklist, live-preview proof, and doctor next actions",
);

const woofGuideAiProviderProofTargetIsSourceBacked = includesAll(aiProviderProofSource, [
  "AI_PROVIDER_PROOF_SUMMARY",
  "AI_PROVIDER_PROOF_ITEMS",
  "WoofGuide AI provider proof packet",
  "OpenAI key location",
  "approved model policy",
  "source/citation rules",
  "owner-review write gate",
  "veterinary safety boundary",
  "Fallback and incident handling",
])
  && includesAll(mobileReleaseQaSource, [
    "woofguide-ai-provider-proof",
    "WoofGuide AI Provider Proof",
    "OpenAI key location",
    "approved model policy",
    "source/citation rules",
    "owner-review write gate",
    "veterinary safety boundary",
    "live AI stays blocked",
  ])
  && includesAll(betaHandoffPacketSource, [
    "Open focused WoofGuide AI provider target: /care-twin-qa?qaSurface=woofguide-ai-provider-proof.",
    "Attach OpenAI key location, approved model policy, source/citation rules, and owner-review write gate",
  ])
  && includesAll(mobileReleaseSmokeChecklistSource, [
    "Focused WoofGuide AI provider proof target",
    "/care-twin-qa?qaSurface=woofguide-ai-provider-proof",
    "OpenAI key location",
    "approved model policy",
    "owner-review write gate",
    "veterinary safety boundary",
  ])
  && includesAll(livePreviewHandoffProofSource, [
    "woofguide-ai-provider-proof",
  ])
  && includesAll(moreRouteSource, [
    "woofguide-ai-provider-proof",
    "WoofGuide AI Provider Proof",
  ]);
check(
  "woofguide ai provider proof target is source-backed",
  woofGuideAiProviderProofTargetIsSourceBacked,
  woofGuideAiProviderProofTargetIsSourceBacked
    ? "WoofGuide AI proof has a focused QA target, beta handoff instruction, smoke checklist item, live-preview route, and provider-row shortcut"
    : "keep WoofGuide AI proof wired through release QA, Share Beta Handoff, smoke checklist, live-preview proof, doctor next actions, and More provider setup",
);

const pushNotificationsProofTargetIsSourceBacked = includesAll(pushNotificationsProofSource, [
  "PUSH_NOTIFICATIONS_PROOF_SUMMARY",
  "PUSH_NOTIFICATIONS_PROOF_ITEMS",
  "Expo push project config",
  "APNs credentials",
  "Firebase/FCM credentials",
  "permission prompt copy",
  "quiet hours",
  "opt-out behavior",
  "delivery QA",
])
  && includesAll(mobileReleaseQaSource, [
    "push-notifications-proof",
    "Push Notifications Proof",
    "Expo push project config",
    "APNs credentials",
    "Firebase/FCM credentials",
    "reminder delivery stays blocked",
    "missed notification fallback",
  ])
  && includesAll(betaHandoffPacketSource, [
    "Open focused push notifications target: /care-twin-qa?qaSurface=push-notifications-proof.",
    "Attach Expo push project id, APNs credentials, Firebase/FCM credentials",
  ])
  && includesAll(mobileReleaseSmokeChecklistSource, [
    "Focused push notifications proof target",
    "/care-twin-qa?qaSurface=push-notifications-proof",
    "Expo push project config",
    "APNs credentials",
    "Firebase/FCM credentials",
  ])
  && includesAll(livePreviewHandoffProofSource, [
    "push-notifications-proof",
  ]);
check(
  "push notifications proof target is source-backed",
  pushNotificationsProofTargetIsSourceBacked,
  pushNotificationsProofTargetIsSourceBacked
    ? "Push notifications proof has a focused QA target, beta handoff instruction, smoke checklist item, live-preview route, and doctor next action"
    : "keep push notifications proof wired through release QA, Share Beta Handoff, smoke checklist, live-preview proof, and doctor next actions",
);

const paymentsProviderProofTargetIsSourceBacked = includesAll(paymentsProviderProofSource, [
  "PAYMENTS_PROVIDER_PROOF_SUMMARY",
  "PAYMENTS_PROVIDER_PROOF_ITEMS",
  "WoofWatcher Plus payments proof packet",
  "Plus and Family product ids",
  "billing path decision",
  "Sandbox receipt test",
  "Entitlement mapping",
  "Refund and support policy",
])
  && includesAll(mobileReleaseQaSource, [
    "payments-provider-proof",
    "Payments Provider Proof",
    "Plus and Family product ids",
    "sandbox receipt",
    "paid checkout stays blocked",
    "restore purchases",
    "money movement",
  ])
  && includesAll(betaHandoffPacketSource, [
    "Open focused payments provider target: /care-twin-qa?qaSurface=payments-provider-proof.",
    "Attach Plus and Family product ids, billing path decision, sandbox purchase/renewal/cancel/refund/expired receipt proof",
  ])
  && includesAll(mobileReleaseSmokeChecklistSource, [
    "Focused payments provider proof target",
    "/care-twin-qa?qaSurface=payments-provider-proof",
    "Plus and Family product ids",
    "checkout stays disabled",
  ])
  && includesAll(livePreviewHandoffProofSource, [
    "payments-provider-proof",
  ])
  && includesAll(moreRouteSource, [
    "payments-provider-proof",
    "Payments Provider Proof",
  ]);
check(
  "payments provider proof target is source-backed",
  paymentsProviderProofTargetIsSourceBacked,
  paymentsProviderProofTargetIsSourceBacked
    ? "Payments proof has a focused QA target, beta handoff instruction, smoke checklist item, live-preview route, and provider-row shortcut"
    : "keep payments proof wired through release QA, Share Beta Handoff, smoke checklist, live-preview proof, doctor next actions, and More provider setup",
);

const storeAccountsProofTargetIsSourceBacked = includesAll(storeAccountsProofSource, [
  "STORE_ACCOUNTS_PROOF_SUMMARY",
  "STORE_ACCOUNTS_PROOF_ITEMS",
  "Apple and Google store accounts proof packet",
  "Apple Developer team id",
  "App Store Connect app record",
  "Google Play package record",
  "reviewer access notes",
  "release role approval",
])
  && includesAll(mobileReleaseQaSource, [
    "store-accounts-proof",
    "Store Accounts Proof",
    "Apple Developer team id",
    "App Store Connect app record",
    "Google Play package record",
    "store submission stays blocked",
    "screenshots/metadata ownership",
  ])
  && includesAll(betaHandoffPacketSource, [
    "Open focused store accounts target: /care-twin-qa?qaSurface=store-accounts-proof.",
    "Attach Apple Developer team id, App Store Connect app record, Google Play package record",
  ])
  && includesAll(mobileReleaseSmokeChecklistSource, [
    "Focused store accounts proof target",
    "/care-twin-qa?qaSurface=store-accounts-proof",
    "Apple Developer team id",
    "store submission stays blocked",
  ])
  && includesAll(livePreviewHandoffProofSource, [
    "store-accounts-proof",
  ])
  && includesAll(moreRouteSource, [
    "store-accounts-proof",
    "Store Accounts Proof",
  ]);
check(
  "store accounts proof target is source-backed",
  storeAccountsProofTargetIsSourceBacked,
  storeAccountsProofTargetIsSourceBacked
    ? "Store accounts proof has a focused QA target, beta handoff instruction, smoke checklist item, live-preview route, and provider-row shortcut"
    : "keep store accounts proof wired through release QA, Share Beta Handoff, smoke checklist, live-preview proof, doctor next actions, and More provider setup",
);

const accountDeletionProofTargetIsSourceBacked = includesAll(accountDeletionProofSource, [
  "ACCOUNT_DELETION_PROOF_SUMMARY",
  "ACCOUNT_DELETION_PROOF_ITEMS",
  "Self-serve account deletion proof packet",
  "self-serve deletion route",
  "export-before-delete warning",
  "data/object deletion receipt",
  "audit trail",
  "recovery-window policy",
  "legal/store approval",
])
  && includesAll(mobileReleaseQaSource, [
    "account-deletion-proof",
    "Account Deletion Proof",
    "self-serve deletion route",
    "destructive deletion stays blocked",
    "data/object deletion receipt",
    "legal/store approval",
  ])
  && includesAll(betaHandoffPacketSource, [
    "Open focused account deletion target: /care-twin-qa?qaSurface=account-deletion-proof.",
    "Attach self-serve deletion route, reauthentication requirement, export-before-delete warning",
  ])
  && includesAll(mobileReleaseSmokeChecklistSource, [
    "Focused account deletion proof target",
    "/care-twin-qa?qaSurface=account-deletion-proof",
    "self-serve deletion route",
    "destructive deletion stays blocked",
  ])
  && includesAll(livePreviewHandoffProofSource, [
    "account-deletion-proof",
  ])
  && includesAll(moreRouteSource, [
    "account-deletion-proof",
    "Account Deletion Proof",
  ]);
check(
  "account deletion proof target is source-backed",
  accountDeletionProofTargetIsSourceBacked,
  accountDeletionProofTargetIsSourceBacked
    ? "Account deletion proof has a focused QA target, beta handoff instruction, smoke checklist item, live-preview route, and provider-row shortcut"
    : "keep account deletion proof wired through release QA, Share Beta Handoff, smoke checklist, live-preview proof, doctor next actions, and More provider setup",
);

const supportLegalReadinessProofTargetIsSourceBacked = includesAll(mobileReleaseQaSource, [
  "support-legal-readiness-proof",
  "Support Legal Readiness Proof",
  "support inbox",
  "privacy policy and terms links",
  "refund and subscription policy",
  "veterinary and emergency boundary",
  "public launch stays blocked",
])
  && includesAll(betaHandoffPacketSource, [
    "Open focused support legal readiness target: /care-twin-qa?qaSurface=support-legal-readiness-proof.",
    "Attach support inbox, privacy policy and terms links, refund/subscription policy, veterinary boundary",
  ])
  && includesAll(mobileReleaseSmokeChecklistSource, [
    "Focused support legal readiness proof target",
    "/care-twin-qa?qaSurface=support-legal-readiness-proof",
    "support inbox",
    "public launch stays blocked",
  ])
  && includesAll(livePreviewHandoffProofSource, [
    "support-legal-readiness-proof",
  ])
  && includesAll(privacyRouteSource, [
    "openSupportLegalProofMission",
    "support-legal-readiness-proof",
    "Share support runbook",
  ]);
check(
  "support legal readiness proof target is source-backed",
  supportLegalReadinessProofTargetIsSourceBacked,
  supportLegalReadinessProofTargetIsSourceBacked
    ? "Support legal readiness proof has a focused QA target, beta handoff instruction, smoke checklist item, live-preview route, and Privacy shortcut"
    : "keep support/legal readiness proof wired through release QA, Share Beta Handoff, smoke checklist, live-preview proof, doctor next actions, and Privacy & Safety",
);

const routeVisualProofTargetIsSourceBacked = includesAll(mobileReleaseQaSource, [
  "route-visual-consistency",
  "Route Visual Consistency",
  "Home",
  "Log",
  "Plans",
  "Health",
  "Records",
  "More",
  "iOS screenshot of Home route top.",
  "Android screenshot of Home route top.",
  'requiredNativePlatforms: ["ios", "android"]',
])
  && includesAll(betaHandoffPacketSource, [
    "Open focused route visual target: /care-twin-qa?qaSurface=route-visual-consistency.",
    "Capture Home, Log, Plans, Health, Records, and More on iOS and Android before claiming route visual proof.",
  ])
  && includesAll(mobileReleaseSmokeChecklistSource, [
    "Focused route visual consistency target",
    "/care-twin-qa?qaSurface=route-visual-consistency",
    "Home, Log, Plans, Health, Records, and More",
    "web preview screenshots do not replace native proof",
  ]);
check(
  "route visual proof target is source-backed",
  routeVisualProofTargetIsSourceBacked,
  routeVisualProofTargetIsSourceBacked
    ? "Route Visual Consistency has a focused QA target, beta handoff instruction, smoke checklist item, and doctor next action"
    : "keep Route Visual Consistency wired through release QA, Share Beta Handoff, smoke checklist, and doctor next actions",
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
