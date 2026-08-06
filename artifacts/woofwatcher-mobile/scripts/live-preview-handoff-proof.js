const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  createPreviewServer,
  requestRoute,
} = require("./smoke-runtime-preview.js");
const {
  UNIVERSAL_NAVIGATION_MANIFEST,
  UNIVERSAL_NAVIGATION_QA_ROUTES,
  buildUniversalNavigationQaRoutes,
} = require("./universal-navigation-manifest.js");

const projectRoot = path.resolve(__dirname, "..");
const exportRoot = path.resolve(projectRoot, ".expo-smoke");
const exportIndexPath = path.join(exportRoot, "index.html");

const LIVE_PREVIEW_HANDOFF_ROUTES = buildUniversalNavigationQaRoutes(
  UNIVERSAL_NAVIGATION_MANIFEST.livePreviewSupplementalRoutes,
);

function normalizeBaseUrl(baseUrl) {
  const value = String(baseUrl || "").trim();
  return value.endsWith("/") ? value : `${value}/`;
}

function routeStatus(result) {
  if (result.statusCode !== 200) return "BLOCKED";
  if (!String(result.contentType || "").startsWith("text/html")) return "BLOCKED";
  if (!result.includesExpoEntry) return "BLOCKED";
  return "PASS";
}

function routeDetail(result) {
  const contentType = result.contentType || "missing content-type";
  const shell = result.includesExpoEntry ? "Expo web entry present" : "Expo web entry missing";
  return `${result.statusCode} ${contentType}; ${shell}`;
}

function buildLivePreviewHandoffProof(input) {
  const routeResults = input.routeResults || [];
  const routeChecks = routeResults.map((result) => ({
    route: result.route,
    status: routeStatus(result),
    detail: routeDetail(result),
  }));
  const result = routeChecks.length > 0 && routeChecks.every((check) => check.status === "PASS")
    ? "PASS"
    : "BLOCKED";

  return {
    title: "WoofWatcher Live Preview Handoff Proof",
    generatedAtIso: input.generatedAtIso || new Date().toISOString(),
    result,
    baseUrl: normalizeBaseUrl(input.baseUrl),
    commit: input.commit || "unknown",
    exportIndexMtimeIso: input.exportIndexMtimeIso || "missing .expo-smoke/index.html",
    routes: routeResults.map((route) => route.route),
    routeChecks,
    truthBoundaries: [
      "Live preview proof is web preview only and does not replace native iOS/Android proof.",
      "Static HTTP success proves shell availability only; rendered redirect, selected-tab, re-tap, Back, and history behavior require the separate navigation gate.",
      "Live preview proof does not approve provider-backed storage, sync, AI, payments, push, store approval, public launch, or Apollo sign-off.",
      ".expo-smoke metadata does not prove the export was produced from the current commit; keep branch CI and export logs attached.",
    ],
    nextActions: [
      "Attach this JSON, the preview URL, and the preview:smoke terminal output to Share Beta Handoff without claiming native QA.",
      "Run WoofWatcher Verify after each new commit before treating dependency proof as current.",
      "Run native iOS/Android proof targets separately for Records local files, care-entry provider sync, push notifications, route visual consistency, and generated PDF/PNG artifacts.",
    ],
  };
}

function formatLivePreviewHandoffProofText(proof) {
  return [
    proof.title,
    `Generated: ${proof.generatedAtIso}`,
    `Result: ${proof.result}`,
    `URL: ${proof.baseUrl}`,
    `Commit: ${proof.commit}`,
    `Export index mtime: ${proof.exportIndexMtimeIso}`,
    "Routes:",
    ...proof.routeChecks.map((check) => `- ${check.route}: ${check.status} (${check.detail})`),
    "Truth boundaries:",
    ...proof.truthBoundaries.map((boundary) => `- ${boundary}`),
    "Next actions:",
    ...proof.nextActions.map((action) => `- ${action}`),
  ].join("\n");
}

function getCurrentCommit() {
  const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: path.resolve(projectRoot, "..", ".."),
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : "unknown";
}

function exportIndexMtimeIso() {
  if (!fs.existsSync(exportIndexPath)) return "";
  return fs.statSync(exportIndexPath).mtime.toISOString();
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server.address());
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function collectLivePreviewHandoffProof(options = {}) {
  const generatedAtIso = options.generatedAtIso || new Date().toISOString();
  const commit = options.commit || getCurrentCommit();
  const exportMtime = exportIndexMtimeIso();

  if (!exportMtime) {
    return {
      ...buildLivePreviewHandoffProof({
        baseUrl: "http://127.0.0.1:0/",
        commit,
        exportIndexMtimeIso: "",
        generatedAtIso,
        routeResults: [],
      }),
      routeChecks: [
        {
          route: ".expo-smoke/index.html",
          status: "BLOCKED",
          detail: "Missing .expo-smoke/index.html. Run smoke:web before live preview proof.",
        },
      ],
      routes: [],
    };
  }

  const server = createPreviewServer();
  const address = await listen(server, options.port || 0);
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}/`;
  const routeResults = [];

  try {
    for (const route of LIVE_PREVIEW_HANDOFF_ROUTES) {
      const response = await requestRoute(port, route);
      routeResults.push({
        route,
        statusCode: response.statusCode,
        contentType: response.contentType,
        includesExpoEntry: response.body.includes("_expo/static/js/web/entry"),
      });
    }
  } finally {
    await close(server);
  }

  return buildLivePreviewHandoffProof({
    baseUrl,
    commit,
    exportIndexMtimeIso: exportMtime,
    generatedAtIso,
    routeResults,
  });
}

function parsePort(argv) {
  const index = argv.indexOf("--port");
  if (index === -1) return 0;
  const value = Number(argv[index + 1]);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

async function main() {
  const jsonMode = process.argv.includes("--json");
  const proof = await collectLivePreviewHandoffProof({ port: parsePort(process.argv) });
  if (jsonMode) {
    console.log(JSON.stringify(proof, null, 2));
  } else {
    console.log(formatLivePreviewHandoffProofText(proof));
  }
  if (proof.result !== "PASS") process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  LIVE_PREVIEW_HANDOFF_ROUTES,
  UNIVERSAL_NAVIGATION_MANIFEST,
  UNIVERSAL_NAVIGATION_QA_ROUTES,
  buildLivePreviewHandoffProof,
  collectLivePreviewHandoffProof,
  formatLivePreviewHandoffProofText,
};
