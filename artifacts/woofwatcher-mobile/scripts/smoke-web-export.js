const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const outputDirName = ".expo-smoke";
const outputDir = path.join(projectRoot, outputDirName);

function removeOutput() {
  fs.rmSync(outputDir, { recursive: true, force: true });
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() ? [full] : [];
  });
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

removeOutput();

const env = {
  ...process.env,
  CI: "1",
  EXPO_NO_TELEMETRY: "1",
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY:
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || "pk_test_woofwatcher_smoke",
};

const result = spawnSync(
  "pnpm",
  ["exec", "expo", "export", "--platform", "web", "--output-dir", outputDirName, "--clear"],
  {
    cwd: projectRoot,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

if (result.status !== 0) {
  fail(`Expo web export smoke failed with exit code ${result.status ?? "unknown"}`);
}

const files = walk(outputDir);
const hasHtml = files.some((file) => file.endsWith(".html"));
const hasJavaScript = files.some((file) => file.endsWith(".js"));

if (!hasHtml || !hasJavaScript) {
  fail(
    `Expo web export smoke did not emit expected assets. html=${hasHtml} js=${hasJavaScript}`,
  );
}

console.log(`Expo web export smoke passed with ${files.length} file(s).`);
