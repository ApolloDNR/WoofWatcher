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

// Make the web app installable. The manifest + icon ship from public/, but the
// single-output (SPA) index.html Expo generates has no <link> to them and no
// theme color (and +html.tsx only applies to Expo's `static` output, which the
// app isn't SSR-safe for). So inject the PWA head tags into the built
// index.html here. Idempotent — safe to re-run.
const indexHtmlPath = path.join(outputDir, "index.html");
if (fs.existsSync(indexHtmlPath)) {
  let html = fs.readFileSync(indexHtmlPath, "utf8");
  if (!html.includes('rel="manifest"')) {
    const pwaTags = [
      '<link rel="manifest" href="/manifest.json" />',
      '<link rel="apple-touch-icon" href="/icon.png" />',
      '<meta name="apple-mobile-web-app-capable" content="yes" />',
      '<meta name="mobile-web-app-capable" content="yes" />',
      '<meta name="apple-mobile-web-app-title" content="WoofWatcher" />',
      '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
      '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#F7F1E1" />',
      '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#081424" />',
    ].join("\n    ");
    html = html.replace("</head>", `    ${pwaTags}\n  </head>`);
    fs.writeFileSync(indexHtmlPath, html);
    console.log("[smoke-web-export] Injected PWA head tags into index.html.");
  }
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
