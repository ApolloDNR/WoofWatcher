const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const outputDirName = ".expo-smoke";
const outputDir = path.join(projectRoot, outputDirName);
const candidateBuild = process.argv.includes("--candidate");
const requestedBuildProfile = (process.env.EXPO_PUBLIC_BUILD_PROFILE || "")
  .trim()
  .toLowerCase();
const consumerBuild =
  candidateBuild ||
  process.env.EXPO_PUBLIC_CONSUMER_PREVIEW === "1" ||
  ["candidate", "production", "store"].includes(requestedBuildProfile);

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

function readGitIdentity(revision) {
  const result = spawnSync("git", ["rev-parse", revision], {
    cwd: projectRoot,
    encoding: "utf8",
  });
  if (result.status !== 0 || !result.stdout.trim()) {
    fail(`Could not resolve candidate source identity for ${revision}.`);
  }
  return result.stdout.trim();
}

function assertCleanCandidateWorktree() {
  const result = spawnSync(
    "git",
    ["status", "--porcelain", "--untracked-files=all"],
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  );
  if (result.status !== 0) {
    fail("Could not verify that the candidate source worktree is clean.");
  }
  const dirtyEntries = result.stdout.trim();
  if (dirtyEntries) {
    console.error("[smoke-web-export] Dirty candidate source entries:");
    console.error(dirtyEntries);
    fail(
      "Candidate source worktree is dirty. Commit the exact candidate source before building so its recorded commit and tree cannot mislabel uncommitted code.",
    );
  }
}

if (candidateBuild) {
  assertCleanCandidateWorktree();
}

removeOutput();

const env = {
  ...process.env,
  CI: "1",
  EXPO_NO_TELEMETRY: "1",
  ...(candidateBuild ? { EXPO_PUBLIC_BUILD_PROFILE: "production" } : {}),
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY:
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    "pk_test_woofwatcher_smoke",
};

if (candidateBuild) {
  console.log(
    "[smoke-web-export] Building the consumer candidate profile; owner and QA tooling stays hidden.",
  );
}

const result = spawnSync(
  "pnpm",
  [
    "exec",
    "expo",
    "export",
    "--platform",
    "web",
    "--output-dir",
    outputDirName,
    "--clear",
  ],
  {
    cwd: projectRoot,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

if (result.status !== 0) {
  fail(
    `Expo web export smoke failed with exit code ${result.status ?? "unknown"}`,
  );
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
  // Register the offline service worker (public/sw.js ships with the export).
  // The app is local-first, so a cached shell makes the installed PWA fully
  // usable offline. Registered after load so it never competes with boot.
  if (!html.includes("serviceWorker.register")) {
    const swScript =
      '<script>if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("/sw.js").catch(function(){})})}</script>';
    html = html.replace("</body>", `  ${swScript}\n</body>`);
    fs.writeFileSync(indexHtmlPath, html);
    console.log("[smoke-web-export] Injected service worker registration.");
  }
  // Bake the real hashed bundle paths into the service worker's precache list
  // and version the cache by the entry bundle's content hash, so every deploy
  // invalidates cleanly and offline never relies on the HTTP cache.
  const swPath = path.join(outputDir, "sw.js");
  if (fs.existsSync(swPath)) {
    const bundlePaths = Array.from(
      new Set(html.match(/\/_expo\/static\/js\/web\/[^"']+\.js/g) ?? []),
    );
    const hashMatch = bundlePaths[0]?.match(/-([0-9a-f]{8,})\.js$/);
    const buildVersion = hashMatch
      ? hashMatch[1].slice(0, 12)
      : String(Date.now());
    let sw = fs.readFileSync(swPath, "utf8");
    sw = sw.replace(
      'const SHELL_VERSION = "__BUILD__";',
      `const SHELL_VERSION = "${buildVersion}";`,
    );
    sw = sw.replace(
      "const EXTRA_SHELL_URLS = [];",
      `const EXTRA_SHELL_URLS = ${JSON.stringify(bundlePaths)};`,
    );
    fs.writeFileSync(swPath, sw);
    console.log(
      `[smoke-web-export] Service worker precaches ${bundlePaths.length} bundle(s), cache version ${buildVersion}.`,
    );
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

if (consumerBuild) {
  const emittedJavaScript = files
    .filter((file) => file.endsWith(".js"))
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
  const consumerMoreMarker = "Search More destinations";
  if (!emittedJavaScript.includes(consumerMoreMarker)) {
    fail(
      `Consumer bundle is missing the compact More implementation marker: ${consumerMoreMarker}`,
    );
  }
  for (const ownerOnlyMarker of [
    "deriveLaunchProviderSetup",
    "deriveSupportRunbookPlan",
    "Launch Workflow QA",
    "Device Review Matrix",
    "Launch Command Hub",
    "Native QA Next Captures",
    "Open sprite QA cockpit",
    "Open QA Cockpit",
    "Store Submission Packet",
    "avatar-sprite-production-review",
  ]) {
    if (emittedJavaScript.includes(ownerOnlyMarker)) {
      fail(
        `Consumer bundle contains owner-only QA implementation marker: ${ownerOnlyMarker}`,
      );
    }
  }
  console.log(
    "[smoke-web-export] Consumer bundle excludes owner-only QA and launch command implementations.",
  );
}

if (candidateBuild) {
  const checkedOutCommit = readGitIdentity("HEAD");
  const expectedCommit = process.env.WOOFWATCHER_SOURCE_SHA?.trim();
  if (expectedCommit && expectedCommit !== checkedOutCommit) {
    fail(
      `Candidate source mismatch: expected ${expectedCommit}, checked out ${checkedOutCommit}.`,
    );
  }
  const identity = {
    kind: "woofwatcher-web-candidate",
    sourceCommit: checkedOutCommit,
    sourceTree: readGitIdentity("HEAD^{tree}"),
    buildProfile: "production",
    ownerOpsVisible: false,
  };
  fs.writeFileSync(
    path.join(outputDir, "candidate-identity.json"),
    `${JSON.stringify(identity, null, 2)}\n`,
  );
}

console.log(`Expo web export smoke passed with ${files.length} file(s).`);
