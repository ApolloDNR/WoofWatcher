import { existsSync, readFileSync, statSync } from "node:fs";
import { delimiter, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const isWindows = process.platform === "win32";
const checks = [];

function check(label, passed, detail, severity = "issue") {
  checks.push({
    label,
    status: passed ? "PASS" : severity === "warning" ? "WARN" : "BLOCKED",
    detail,
    severity,
  });
}

function pathExists(value) {
  if (!value) return false;
  try {
    return existsSync(value) && statSync(value).isDirectory();
  } catch {
    return false;
  }
}

function findCommand(command) {
  const dirs = (process.env.PATH || "").split(delimiter).filter(Boolean);
  const extensions = isWindows
    ? ["", ...(process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD").split(";")]
    : [""];
  const names = extname(command)
    ? [command]
    : extensions.map((extension) => `${command}${extension}`);

  for (const dir of dirs) {
    for (const name of names) {
      const candidate = join(dir, name);
      if (existsSync(candidate)) return candidate;
    }
  }

  return "";
}

function readText(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

const adbPath = findCommand("adb");
const emulatorPath = findCommand("emulator");
const javaPath = findCommand("java");
const androidHome = process.env.ANDROID_HOME || "";
const androidSdkRoot = process.env.ANDROID_SDK_ROOT || "";
const javaHome = process.env.JAVA_HOME || "";

check(
  "Android adb available",
  Boolean(adbPath),
  adbPath || "adb is not on PATH; Android device or emulator proof cannot be captured here",
);
check(
  "Android emulator available",
  Boolean(emulatorPath),
  emulatorPath || "emulator is not on PATH; Android emulator proof cannot be captured here",
);
check(
  "Java runtime available",
  Boolean(javaPath),
  javaPath || "java is not on PATH; Android build/emulator tooling cannot run here",
);
check(
  "ANDROID_HOME or ANDROID_SDK_ROOT set",
  pathExists(androidHome) || pathExists(androidSdkRoot),
  androidHome || androidSdkRoot
    ? `ANDROID_HOME=${androidHome || "unset"} ANDROID_SDK_ROOT=${androidSdkRoot || "unset"}`
    : "ANDROID_HOME and ANDROID_SDK_ROOT are unset",
);
check("JAVA_HOME set", pathExists(javaHome), javaHome || "JAVA_HOME is unset");

const appJsonSource = readText(join(root, "artifacts", "woofwatcher-mobile", "app.json"));
const easSource = readText(join(root, "artifacts", "woofwatcher-mobile", "eas.json"));
check(
  "Expo native targets configured",
  appJsonSource.includes('"ios"') &&
    appJsonSource.includes('"android"') &&
    easSource.includes('"preview"'),
  "app.json must list iOS/Android and eas.json must keep preview build profiles",
);

const releaseQaSource = readText(
  join(root, "artifacts", "woofwatcher-mobile", "lib", "mobileReleaseQa.ts"),
);
const qaRouteSource = readText(
  join(root, "artifacts", "woofwatcher-mobile", "app", "care-twin-qa.tsx"),
);
check(
  "Focused native QA targets are source-backed",
  [
    "auth-setup-onboarding-proof",
    "provider-backed auth stays blocked",
    "records-local-file-handoff",
    "report-binary-export-proof",
    "care-entry-provider-sync-proof",
    "woofguide-ai-provider-proof",
    "push-notifications-proof",
    "payments-provider-proof",
    "store-accounts-proof",
    "account-deletion-proof",
    "route-visual-consistency",
    "APNs credentials",
    "Firebase/FCM credentials",
    "OpenAI key location",
    "owner-review write gate",
    "veterinary safety boundary",
    "Plus and Family product ids",
    "paid checkout",
    "Apple Developer team id",
    "store submission",
    "self-serve deletion route",
    "destructive account deletion",
    "support-legal-readiness-proof",
    "support inbox",
    "privacy policy and terms links",
    "veterinary boundary",
    "iOS screenshot",
    "Android screenshot",
  ].every((value) => releaseQaSource.includes(value)) &&
    qaRouteSource.includes("Attach focused proof"),
  "focused /care-twin-qa targets must stay wired before native proof can be collected",
);

const nativeQaMatrix = readText(join(root, "docs", "release", "CARE_TWIN_NATIVE_QA_MATRIX.md"));
check(
  "Native QA matrix exists",
  nativeQaMatrix.includes("Care Twin") || nativeQaMatrix.includes("Native QA"),
  "docs/release/CARE_TWIN_NATIVE_QA_MATRIX.md should guide device capture",
);

const blockersSource = readText(join(root, "docs", "BLOCKERS_FOR_APOLLO.md"));
check(
  "Web preview proof boundary documented",
  blockersSource.includes("web preview evidence only") &&
    blockersSource.includes("does not replace native"),
  "web preview evidence only; does not replace native iOS/Android proof",
  "warning",
);

const issues = checks
  .filter((item) => item.status === "BLOCKED")
  .map((item) => item.label);
const warnings = checks
  .filter((item) => item.status === "WARN")
  .map((item) => item.label);
const result = issues.length === 0 ? "READY_FOR_NATIVE_QA" : "BLOCKED";

const payload = {
  name: "WoofWatcher native QA tooling doctor",
  purpose: "confirm local native proof tooling before claiming iOS or Android device evidence.",
  result,
  checks,
  issues,
  warnings,
  nativeProofTargets: [
    "/care-twin-qa?qaSurface=owner-preview-core-loop",
    "/care-twin-qa?qaSurface=auth-setup-onboarding-proof",
    "/care-twin-qa?qaSurface=records-local-file-handoff",
    "/care-twin-qa?qaSurface=report-binary-export-proof",
    "/care-twin-qa?qaSurface=care-entry-provider-sync-proof",
    "/care-twin-qa?qaSurface=woofguide-ai-provider-proof",
    "/care-twin-qa?qaSurface=push-notifications-proof",
    "/care-twin-qa?qaSurface=payments-provider-proof",
    "/care-twin-qa?qaSurface=store-accounts-proof",
    "/care-twin-qa?qaSurface=account-deletion-proof",
    "/care-twin-qa?qaSurface=support-legal-readiness-proof",
    "/care-twin-qa?qaSurface=route-visual-consistency",
  ],
  proofCommands: [
    "pnpm run doctor:native-qa",
    "pnpm run doctor:native-qa:json",
    "pnpm --filter @workspace/woofwatcher-mobile run preview:smoke",
  ],
  truthBoundaries: [
    "web preview evidence only; it does not replace native iOS/Android proof.",
    "READY_FOR_NATIVE_QA only means this machine can start native capture; it does not approve screenshots, providers, store submission, public launch, or Apollo sign-off.",
    "BLOCKED means collect native proof on a configured Mac, Android Studio machine, physical device, TestFlight build, or helper environment instead of claiming local device QA.",
  ],
  nextActions: [
    "Install or use an environment with Android SDK platform-tools, emulator, Java, ANDROID_HOME or ANDROID_SDK_ROOT, and JAVA_HOME before Android emulator proof.",
    "Use macOS, TestFlight, Expo dev client, or a physical iOS device for iOS screenshots; this Windows shell cannot produce iOS simulator proof.",
    "Open /care-twin-qa?qaSurface=route-visual-consistency and capture Home, Log, Plans, Health, Records, and More on iOS and Android with route-named evidence before claiming route visual proof.",
    "Open /care-twin-qa?qaSurface=auth-setup-onboarding-proof for Auth gateway and Setup local-preview proof, and keep provider-backed auth/household creation blocked until real provider evidence exists.",
    "Open /care-twin-qa?qaSurface=records-local-file-handoff for Records local HTML/SVG file proof and keep generated PDF/PNG readiness blocked until native share/reopen and provider evidence are attached.",
    "Open /care-twin-qa?qaSurface=report-binary-export-proof for local Care Pass PDF and Dog ID PNG artifact proof, and keep PDF/PNG readiness blocked until file name, file size, MIME, share/reopen, renderer, storage policy, and iOS/Android evidence exist.",
    "Open /care-twin-qa?qaSurface=care-entry-provider-sync-proof and use the Care-entry provider sync proof manifest for Supabase migration/backfill, active-household RLS, retention/export/deletion policy, dependency proof, and mobile full-refresh sign-off before enabling incremental care-entry sync.",
    "Open /care-twin-qa?qaSurface=woofguide-ai-provider-proof for OpenAI key location, approved model policy, source/citation rules, owner-review write gate, veterinary safety boundary, and fallback/incident handling before enabling live AI.",
    "Open /care-twin-qa?qaSurface=push-notifications-proof for Expo/APNs/Firebase delivery proof, permission copy, quiet hours, opt-out behavior, platform/provider-named iOS APNs and Android FCM delivery evidence, and missed notification fallback before claiming reminder delivery.",
    "Open /care-twin-qa?qaSurface=payments-provider-proof for Plus and Family product ids, billing path decision, sandbox receipts, restore purchases, entitlement mapping, refund/support policy, and checkout-gate proof before enabling paid checkout.",
    "Open /care-twin-qa?qaSurface=store-accounts-proof for Apple Developer team id, App Store Connect app record, Google Play package record, reviewer access, screenshots/metadata ownership, release role approval, and store submission proof before claiming App Review or Play review readiness.",
    "Open /care-twin-qa?qaSurface=account-deletion-proof for self-serve deletion route, reauthentication, export-before-delete warning, data/object deletion receipt, audit trail, support receipt, recovery-window policy, and legal/store approval before enabling destructive account deletion.",
    "Open /care-twin-qa?qaSurface=support-legal-readiness-proof for support inbox, privacy policy and terms links, refund/subscription policy, veterinary boundary, deletion escalation, incident response owner, and Apollo approval before claiming public launch readiness.",
  ],
};

function formatText(value) {
  return [
    value.name,
    `Result: ${value.result}`,
    `Purpose: ${value.purpose}`,
    "Checks:",
    ...value.checks.map((item) => `- ${item.label}: ${item.status} (${item.detail})`),
    "Native proof targets:",
    ...value.nativeProofTargets.map((target) => `- ${target}`),
    "Truth boundaries:",
    ...value.truthBoundaries.map((boundary) => `- ${boundary}`),
    "Next actions:",
    ...value.nextActions.map((action) => `- ${action}`),
  ].join("\n");
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  console.log(formatText(payload));
}

if (payload.result !== "READY_FOR_NATIVE_QA") {
  process.exitCode = 1;
}
