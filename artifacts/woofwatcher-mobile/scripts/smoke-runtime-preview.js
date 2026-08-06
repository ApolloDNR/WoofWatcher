const fs = require("fs");
const http = require("http");
const path = require("path");
const {
  UNIVERSAL_NAVIGATION_MANIFEST,
  UNIVERSAL_NAVIGATION_QA_ROUTES,
  buildUniversalNavigationQaRoutes,
} = require("./universal-navigation-manifest.js");

const projectRoot = path.resolve(__dirname, "..");
const root = path.resolve(projectRoot, ".expo-smoke");

const MOBILE_RUNTIME_SMOKE_ROUTES = buildUniversalNavigationQaRoutes(
  UNIVERSAL_NAVIGATION_MANIFEST.runtimeSupplementalRoutes,
);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function resolveFile(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split("?")[0] || "/");
  const requestedPath = decodedPath === "/" ? "/index.html" : decodedPath;
  const normalized = path.normalize(requestedPath).replace(/^([/\\])+/, "");
  const file = path.resolve(root, normalized);
  const relative = path.relative(root, file);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return { forbidden: true, file: null };
  }

  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    return { forbidden: false, file };
  }

  return { forbidden: false, file: path.join(root, "index.html") };
}

function createPreviewServer() {
  return http.createServer((req, res) => {
    const { file, forbidden } = resolveFile(req.url || "/");

    if (forbidden || !file) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      "cache-control": "no-store",
      "content-type": types[ext] || "application/octet-stream",
    });
    fs.createReadStream(file).pipe(res);
  });
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
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

function requestRoute(port, route) {
  return new Promise((resolve, reject) => {
    const request = http.get(
      {
        hostname: "127.0.0.1",
        port,
        path: route,
        timeout: 8000,
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          resolve({
            body,
            contentType: response.headers["content-type"] || "",
            statusCode: response.statusCode || 0,
          });
        });
      },
    );

    request.on("timeout", () => {
      request.destroy(new Error(`Timed out while requesting ${route}`));
    });
    request.on("error", reject);
  });
}

async function runRuntimeSmoke() {
  if (!fs.existsSync(path.join(root, "index.html"))) {
    fail("Missing .expo-smoke/index.html. Run pnpm --filter @workspace/woofwatcher-mobile run smoke:web first.");
    return;
  }

  const server = createPreviewServer();
  const address = await listen(server);
  const port = address.port;
  const failures = [];

  try {
    for (const route of MOBILE_RUNTIME_SMOKE_ROUTES) {
      const response = await requestRoute(port, route);
      if (response.statusCode !== 200) {
        failures.push(`${route} returned ${response.statusCode}`);
        continue;
      }
      if (!String(response.contentType).startsWith("text/html")) {
        failures.push(`${route} returned ${response.contentType || "missing content-type"}`);
        continue;
      }
      if (!response.body.includes("_expo/static/js/web/entry")) {
        failures.push(`${route} did not include the Expo web entry bundle`);
      }
    }
  } finally {
    await close(server);
  }

  if (failures.length) {
    fail(`WoofWatcher mobile runtime smoke failed:\n- ${failures.join("\n- ")}`);
    return;
  }

  console.log(`WoofWatcher mobile runtime smoke passed for ${MOBILE_RUNTIME_SMOKE_ROUTES.length} route(s): ${MOBILE_RUNTIME_SMOKE_ROUTES.join(", ")}`);
}

if (process.argv.includes("--list-routes")) {
  console.log(JSON.stringify(MOBILE_RUNTIME_SMOKE_ROUTES, null, 2));
} else if (require.main === module) {
  runRuntimeSmoke().catch((error) => {
    fail(error instanceof Error ? error.message : String(error));
  });
}

module.exports = {
  MOBILE_RUNTIME_SMOKE_ROUTES,
  UNIVERSAL_NAVIGATION_MANIFEST,
  UNIVERSAL_NAVIGATION_QA_ROUTES,
  createPreviewServer,
  requestRoute,
};
