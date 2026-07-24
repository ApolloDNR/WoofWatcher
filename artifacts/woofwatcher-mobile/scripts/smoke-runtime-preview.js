const fs = require("fs");
const http = require("http");
const net = require("net");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const {
  createSmokeSourceFingerprint,
  validateSmokeSourceProvenance,
} = require("./smoke-source-provenance");

const projectRoot = path.resolve(__dirname, "..");
const root = path.resolve(projectRoot, ".expo-smoke");
const provenancePath = path.join(root, "smoke-source-provenance.json");

const MOBILE_RUNTIME_SMOKE_ROUTES = [
  "/",
  "/sign-in",
  "/setup",
  "/fastlog",
  "/log",
  "/calendar",
  "/health",
  "/records",
  "/more",
  "/care-twin-qa",
  "/woofguide",
  "/premium",
  "/privacy",
  "/portrait",
];

const ROUTE_CONTENT_EXPECTATIONS = {
  "/": ["WELCOME TO WOOFWATCHER"],
  "/sign-in": ["Accounts are not connected in this preview build."],
  "/setup": ["Set up WoofWatcher"],
  "/log": ["Log History"],
  "/fastlog": ["What would you like"],
  "/calendar": ["MISSION SCHEDULE"],
  "/health": ["Owner notes. No diagnosis."],
  "/records": ["Vault Command"],
  "/more": ["Command Directory"],
  "/care-twin-qa": ["Care Twin State Lab", "QA cockpit unavailable"],
  "/woofguide": ["WOOFGUIDE CONSOLE"],
  "/premium": ["PLUS VALUE CONSOLE", "WoofWatcher Plus preview unavailable"],
  "/privacy": ["Your data, your rules"],
  "/portrait": ["Choose a pixel twin, then customize."],
};

const ACCESSIBILITY_LAYOUT_PROOF_SCALES = [1, 1.4, 2];
const ACCESSIBILITY_LAYOUT_PROOF_SURFACES = [
  {
    id: "today",
    route: "/",
    marker: "qa-layout-today",
    kind: "quick-grid",
  },
  {
    id: "plan",
    route: "/calendar",
    marker: "qa-layout-plan",
    kind: "plan-mission",
  },
  {
    id: "fast-log",
    route: "/fastlog",
    marker: "qa-layout-fast-log",
    kind: "quick-grid",
  },
  {
    id: "health",
    route: "/health",
    marker: "qa-layout-health",
    kind: "health-summary",
  },
  {
    id: "more",
    route: "/more",
    marker: "qa-layout-more",
    kind: "more-directory",
  },
];

function expectedAccessibilityLayout(scale) {
  const reflows = scale >= 1.4;
  return {
    reflows,
    quickActionColumns: reflows ? 2 : 3,
    controlMinHeight: Math.round(48 + (scale - 1) * 16),
  };
}

function isRectContainedByRoute(rect, routeRect, tolerance = 1) {
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.left >= routeRect.left - tolerance &&
    rect.right <= routeRect.right + tolerance &&
    rect.top >= routeRect.top - tolerance &&
    rect.bottom <= routeRect.bottom + tolerance
  );
}

function validateAccessibilityLayoutSnapshot(snapshot, surface, scale) {
  const errors = [];
  const expected = expectedAccessibilityLayout(scale);
  const marker = snapshot && snapshot.marker ? snapshot.marker : {};
  const prefix = `${surface.id}@${scale}`;

  if (!snapshot || snapshot.pathname !== surface.route) {
    errors.push(`${prefix} pathname did not remain ${surface.route}`);
  }
  if (!snapshot || snapshot.searchScale !== String(scale)) {
    errors.push(`${prefix} did not retain qaFontScale=${scale}`);
  }
  if (Number(marker.fontScale) !== scale) {
    errors.push(`${prefix} marker did not resolve font scale ${scale}`);
  }
  if (marker.stackStatusRows !== expected.reflows) {
    errors.push(`${prefix} stackStatusRows used the wrong branch`);
  }
  if (Number(marker.quickActionColumns) !== expected.quickActionColumns) {
    errors.push(`${prefix} marker exposed the wrong quick-action column count`);
  }
  if (Number(marker.controlMinHeight) !== expected.controlMinHeight) {
    errors.push(`${prefix} marker exposed the wrong control height`);
  }
  if (!snapshot || snapshot.targetCount < 1) {
    errors.push(`${prefix} did not render a real proof control`);
  }
  if (
    !snapshot ||
    !Number.isFinite(snapshot.targetMinHeight) ||
    snapshot.targetMinHeight + 0.5 < expected.controlMinHeight
  ) {
    errors.push(`${prefix} rendered a control below the minimum target height`);
  }
  if (!snapshot || snapshot.insideRouteBounds !== true) {
    errors.push(`${prefix} rendered proof controls outside the route bounds`);
  }

  if (
    surface.kind === "quick-grid" &&
    snapshot &&
    snapshot.actualColumns !== expected.quickActionColumns
  ) {
    errors.push(`${prefix} quick actions did not reflow into real DOM columns`);
  }
  if (
    surface.kind === "plan-mission" &&
    snapshot &&
    snapshot.actionNested !== expected.reflows
  ) {
    errors.push(`${prefix} Plan action used the wrong mission-row branch`);
  }
  if (
    surface.kind === "health-summary" &&
    snapshot &&
    snapshot.contentFlexDirection !==
      (expected.reflows ? "column" : "row")
  ) {
    errors.push(`${prefix} Health summary used the wrong content direction`);
  }
  if (surface.kind === "more-directory" && snapshot) {
    const expectedDirection = expected.reflows ? "column" : "row";
    if (snapshot.rowFlexDirection !== expectedDirection) {
      errors.push(`${prefix} More directory used the wrong row direction`);
    }
    if (
      !Number.isFinite(snapshot.actionWidthRatio) ||
      (expected.reflows
        ? snapshot.actionWidthRatio < 0.85
        : snapshot.actionWidthRatio >= 0.75)
    ) {
      errors.push(`${prefix} More action used the wrong width branch`);
    }
  }

  return errors;
}

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

function resolveFile(urlPath, previewRoot = root) {
  const decodedPath = decodeURIComponent(urlPath.split("?")[0] || "/");
  const requestedPath = decodedPath === "/" ? "/index.html" : decodedPath;
  const normalized = path.normalize(requestedPath).replace(/^([/\\])+/, "");
  const file = path.resolve(previewRoot, normalized);
  const relative = path.relative(previewRoot, file);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return { forbidden: true, file: null };
  }

  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    return { forbidden: false, file };
  }

  return { forbidden: false, file: path.join(previewRoot, "index.html") };
}

function createPreviewServer(previewRoot = root) {
  return http.createServer((req, res) => {
    const { file, forbidden } = resolveFile(req.url || "/", previewRoot);

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

function resolveChromiumExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM,
    "/tmp/chromium",
    "/opt/pw-browsers/chromium",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function terminateBrowser(browser, options = {}) {
  if (!browser || browser.exitCode !== null) return;

  const timeoutMs = options.timeoutMs ?? 3000;
  const waitForExit = () =>
    new Promise((resolve) => {
      browser.once("exit", () => resolve(true));
    });

  const gracefulExit = waitForExit();
  browser.kill("SIGTERM");
  const exitedGracefully = await Promise.race([
    gracefulExit,
    delay(timeoutMs).then(() => false),
  ]);

  if (
    !exitedGracefully &&
    browser.exitCode === null &&
    browser.signalCode === null
  ) {
    const forcedExit = waitForExit();
    browser.kill("SIGKILL");
    await Promise.race([forcedExit, delay(timeoutMs)]);
  }
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => {
        if (error) reject(error);
        else if (!port) reject(new Error("Could not reserve Chromium debugging port"));
        else resolve(port);
      });
    });
  });
}

async function waitForDevTools(port, browser, stderrLines) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (browser.exitCode !== null) {
      throw new Error(
        `Chromium exited before route smoke started: ${stderrLines
          .join(" ")
          .slice(-500)}`,
      );
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find(
          (target) =>
            target.type === "page" &&
            typeof target.webSocketDebuggerUrl === "string",
        );
        if (page) return page.webSocketDebuggerUrl;
      }
    } catch {
      // Chromium needs a short boot window before the DevTools endpoint exists.
    }
    await delay(100);
  }
  throw new Error(
    `Timed out waiting for Chromium DevTools: ${stderrLines
      .join(" ")
      .slice(-500)}`,
  );
}

async function createCdpClient(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  const listeners = new Map();
  let nextId = 1;

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener(
      "error",
      () => reject(new Error("Could not connect to Chromium DevTools")),
      { once: true },
    );
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (typeof message.id === "number") {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.error) {
        request.reject(
          new Error(message.error.message || "Chromium DevTools command failed"),
        );
      } else {
        request.resolve(message.result || {});
      }
      return;
    }

    const callbacks = listeners.get(message.method);
    if (!callbacks) return;
    for (const callback of callbacks) callback(message.params || {});
  });

  return {
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    on(method, callback) {
      const callbacks = listeners.get(method) || new Set();
      callbacks.add(callback);
      listeners.set(method, callbacks);
      return () => callbacks.delete(callback);
    },
    async close() {
      if (socket.readyState === WebSocket.CLOSED) return;
      await new Promise((resolve) => {
        socket.addEventListener("close", resolve, { once: true });
        socket.close();
      });
    },
  };
}

function createCdpEventWaiter(client, method, timeoutMs = 20000) {
  let removeListener = () => undefined;
  let timer = null;
  let settled = false;

  const promise = new Promise((resolve, reject) => {
    removeListener = client.on(method, (params) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      removeListener();
      resolve(params);
    });
    timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      removeListener();
      reject(new Error(`Timed out waiting for ${method}`));
    }, timeoutMs);
  });

  return {
    promise,
    cancel() {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      removeListener();
    },
  };
}

async function readRouteSnapshot(client) {
  const evaluation = await client.send("Runtime.evaluate", {
    expression:
      "({ pathname: location.pathname, body: document.body ? document.body.innerText : '' })",
    returnByValue: true,
  });
  const value = evaluation.result?.value;
  return {
    pathname:
      value && typeof value === "object"
        ? String(value.pathname || "")
        : "",
    body:
      value && typeof value === "object"
        ? String(value.body || "")
        : "",
  };
}

function matchesRouteSnapshot(snapshot, route, expected) {
  return (
    snapshot.pathname === route &&
    expected.some((value) => snapshot.body.includes(value))
  );
}

async function waitForStableRouteContent(
  client,
  route,
  expected,
  options = {},
) {
  const timeoutMs = options.timeoutMs ?? 20000;
  const pollMs = options.pollMs ?? 150;
  const settleMs = options.settleMs ?? 200;
  const now = options.now ?? Date.now;
  const delayFn = options.delayFn ?? delay;
  const deadline = now() + timeoutMs;
  let lastSnapshot = { pathname: "", body: "" };

  while (now() < deadline) {
    try {
      const candidate = await readRouteSnapshot(client);
      lastSnapshot = candidate;
      if (matchesRouteSnapshot(candidate, route, expected)) {
        await delayFn(settleMs);
        const settled = await readRouteSnapshot(client);
        lastSnapshot = settled;
        if (matchesRouteSnapshot(settled, route, expected)) {
          return { stable: true, ...settled };
        }
      }
    } catch {
      // A navigation briefly invalidates the JavaScript execution context.
    }
    await delayFn(pollMs);
  }

  return { stable: false, ...lastSnapshot };
}

function accessibilityLayoutSnapshotExpression(surface) {
  const serializedSurface = JSON.stringify(surface);
  return `(() => {
    const surface = ${serializedSurface};
    const root = document.querySelector('[data-testid="' + surface.marker + '"]');
    const empty = {
      pathname: location.pathname,
      searchScale: new URLSearchParams(location.search).get('qaFontScale') || '',
      marker: {
        fontScale: Number.NaN,
        stackStatusRows: false,
        quickActionColumns: Number.NaN,
        controlMinHeight: Number.NaN
      },
      targetCount: 0,
      targetMinHeight: 0,
      insideRouteBounds: false
    };
    if (!root) return empty;

    const routeRect = root.getBoundingClientRect();
    const markerValues = Object.fromEntries(
      String(root.id || '')
        .split(';')
        .map((part) => part.split('='))
        .filter(([key, value]) => key && value !== undefined)
    );
    const round = (value) => Math.round(value * 10) / 10;
    const rectContainedByRoute = ${isRectContainedByRoute.toString()};
    const isInsideRoute = (rect) =>
      rectContainedByRoute(rect, routeRect);
    const result = {
      ...empty,
      marker: {
        fontScale: Number(markerValues.fontScale),
        stackStatusRows: markerValues.stackStatusRows === 'true',
        quickActionColumns: Number(markerValues.quickActionColumns),
        controlMinHeight: Number(markerValues.controlMinHeight)
      }
    };

    if (surface.kind === 'quick-grid') {
      const targets = Array.from(
        root.querySelectorAll('[data-testid^="quick-log-action-"]')
      );
      const rects = targets.map((target) => target.getBoundingClientRect());
      const firstTop = rects[0] ? rects[0].top : 0;
      result.targetCount = rects.length;
      result.targetMinHeight = rects.length
        ? round(Math.min(...rects.map((rect) => rect.height)))
        : 0;
      result.insideRouteBounds =
        rects.length > 0 && rects.every(isInsideRoute);
      result.actualColumns = rects.filter(
        (rect) => Math.abs(rect.top - firstTop) <= 2
      ).length;
      return result;
    }

    if (surface.kind === 'plan-mission') {
      const row = root.querySelector('[data-testid="plan-mission-row"]');
      const action = row
        ? row.querySelector('[data-testid="plan-mission-action"]')
        : null;
      const rowRect = row ? row.getBoundingClientRect() : null;
      const actionRect = action ? action.getBoundingClientRect() : null;
      result.targetCount = row && action ? 1 : 0;
      result.targetMinHeight = rowRect ? round(rowRect.height) : 0;
      result.insideRouteBounds =
        Boolean(rowRect && actionRect) &&
        isInsideRoute(rowRect) &&
        isInsideRoute(actionRect);
      result.actionNested = Boolean(
        row && action && action.parentElement !== row
      );
      return result;
    }

    if (surface.kind === 'health-summary') {
      const row = root.querySelector('[data-testid="health-summary-row"]');
      const value = row
        ? row.querySelector('[data-testid="health-summary-value"]')
        : null;
      const content = value?.parentElement?.parentElement || null;
      const rowRect = row ? row.getBoundingClientRect() : null;
      const valueRect = value ? value.getBoundingClientRect() : null;
      result.targetCount = row && value && content ? 1 : 0;
      result.targetMinHeight = rowRect ? round(rowRect.height) : 0;
      result.insideRouteBounds =
        Boolean(rowRect && valueRect) &&
        isInsideRoute(rowRect) &&
        isInsideRoute(valueRect);
      result.contentFlexDirection = content
        ? getComputedStyle(content).flexDirection
        : '';
      return result;
    }

    if (surface.kind === 'more-directory') {
      const row = root.querySelector('[data-testid="more-directory-row"]');
      const action = row
        ? row.querySelector('[data-testid="more-directory-action"]')
        : null;
      const rowRect = row ? row.getBoundingClientRect() : null;
      const actionRect = action ? action.getBoundingClientRect() : null;
      result.targetCount = row && action ? 1 : 0;
      result.targetMinHeight = actionRect ? round(actionRect.height) : 0;
      result.insideRouteBounds =
        Boolean(rowRect && actionRect) &&
        isInsideRoute(rowRect) &&
        isInsideRoute(actionRect);
      result.rowFlexDirection = row
        ? getComputedStyle(row).flexDirection
        : '';
      result.actionWidthRatio =
        rowRect && actionRect && rowRect.width > 0
          ? round(actionRect.width / rowRect.width)
          : 0;
      return result;
    }

    return result;
  })()`;
}

async function readAccessibilityLayoutSnapshot(client, surface) {
  const evaluation = await client.send("Runtime.evaluate", {
    expression: accessibilityLayoutSnapshotExpression(surface),
    returnByValue: true,
  });
  return evaluation.result?.value || null;
}

async function scrollAccessibilityProofTarget(client, surface) {
  const selectorByKind = {
    "quick-grid": '[data-testid^="quick-log-action-"]',
    "plan-mission": '[data-testid="plan-mission-row"]',
    "health-summary": '[data-testid="health-summary-row"]',
    "more-directory": '[data-testid="more-directory-row"]',
  };
  const selector = selectorByKind[surface.kind];
  await client.send("Runtime.evaluate", {
    expression: `(() => {
      const target = document
        .querySelector('[data-testid="${surface.marker}"]')
        ?.querySelector(${JSON.stringify(selector)});
      if (!target) return false;
      target.scrollIntoView({ block: 'center', inline: 'nearest' });
      return true;
    })()`,
    returnByValue: true,
  });
}

async function waitForStableAccessibilityLayout(
  client,
  surface,
  scale,
  options = {},
) {
  const attempts = options.attempts ?? 8;
  const settleMs = options.settleMs ?? 200;
  const delayFn = options.delayFn ?? delay;
  let previousSerialized = "";
  let lastSnapshot = null;

  await client.send("Runtime.evaluate", {
    expression:
      "document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true",
    awaitPromise: true,
    returnByValue: true,
  });

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await scrollAccessibilityProofTarget(client, surface);
    await delayFn(settleMs);
    lastSnapshot = await readAccessibilityLayoutSnapshot(client, surface);
    const serialized = JSON.stringify(lastSnapshot);
    if (serialized === previousSerialized) {
      return {
        stable: true,
        snapshot: lastSnapshot,
        errors: validateAccessibilityLayoutSnapshot(
          lastSnapshot,
          surface,
          scale,
        ),
      };
    }
    previousSerialized = serialized;
  }

  return {
    stable: false,
    snapshot: lastSnapshot,
    errors: [
      `${surface.id}@${scale} geometry did not settle across two samples`,
      ...validateAccessibilityLayoutSnapshot(lastSnapshot, surface, scale),
    ],
  };
}

async function runAccessibilityLayoutProof(client, port, failures) {
  const proofOutputDir = path.join(root, "a11y-layout-proof");
  fs.rmSync(proofOutputDir, { recursive: true, force: true });
  fs.mkdirSync(proofOutputDir, { recursive: true });
  const results = [];

  for (const surface of ACCESSIBILITY_LAYOUT_PROOF_SURFACES) {
    for (const scale of ACCESSIBILITY_LAYOUT_PROOF_SCALES) {
      const queryRoute = `${surface.route}?qaFontScale=${scale}`;
      const caseErrors = [];
      const pageErrors = [];
      const removeExceptionListener = client.on(
        "Runtime.exceptionThrown",
        ({ exceptionDetails }) => {
          pageErrors.push(
            exceptionDetails?.exception?.description ||
              exceptionDetails?.text ||
              "Uncaught page exception",
          );
        },
      );

      try {
        const loadWaiter = createCdpEventWaiter(
          client,
          "Page.loadEventFired",
        );
        let navigation;
        try {
          navigation = await client.send("Page.navigate", {
            url: `http://127.0.0.1:${port}${queryRoute}`,
          });
        } catch (error) {
          loadWaiter.cancel();
          throw error;
        }
        if (navigation.errorText) {
          loadWaiter.cancel();
          caseErrors.push(`navigation failed: ${navigation.errorText}`);
        } else {
          await loadWaiter.promise;
          const routeProof = await waitForStableRouteContent(
            client,
            surface.route,
            ROUTE_CONTENT_EXPECTATIONS[surface.route] || [],
          );
          if (!routeProof.stable) {
            caseErrors.push(
              `route content did not settle at ${surface.route}; finalPath=${
                routeProof.pathname || "(empty)"
              }`,
            );
          } else {
            const layoutProof = await waitForStableAccessibilityLayout(
              client,
              surface,
              scale,
            );
            caseErrors.push(...layoutProof.errors);
            const scaleName = String(scale).replace(".", "_");
            const screenshotName = `${surface.id}-${scaleName}.png`;
            const screenshot = await client.send("Page.captureScreenshot", {
              format: "png",
              fromSurface: true,
              captureBeyondViewport: false,
            });
            if (typeof screenshot.data === "string") {
              fs.writeFileSync(
                path.join(proofOutputDir, screenshotName),
                Buffer.from(screenshot.data, "base64"),
              );
            } else {
              caseErrors.push("Chromium did not return screenshot data");
            }
            results.push({
              surface: surface.id,
              route: surface.route,
              scale,
              screenshot: screenshotName,
              stable: layoutProof.stable,
              snapshot: layoutProof.snapshot,
              errors: caseErrors,
            });
          }
        }
        if (pageErrors.length) {
          caseErrors.push(`page error: ${pageErrors[0].slice(0, 220)}`);
        }
      } catch (error) {
        caseErrors.push(error instanceof Error ? error.message : String(error));
      } finally {
        removeExceptionListener();
      }

      if (caseErrors.length) {
        failures.push(`${surface.id}@${scale}: ${caseErrors.join("; ")}`);
      }
    }
  }

  fs.writeFileSync(
    path.join(proofOutputDir, "manifest.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        sourceFingerprint: createSmokeSourceFingerprint(projectRoot),
        viewport: { width: 390, height: 844, deviceScaleFactor: 1 },
        cases: results,
      },
      null,
      2,
    )}\n`,
  );

  if (!results.some((result) => result.errors.length)) {
    console.log(
      `Accessibility layout proof passed for 15 case(s); screenshots and manifest: ${proofOutputDir}`,
    );
  }
}

async function runRuntimeSmoke() {
  if (!fs.existsSync(path.join(root, "index.html"))) {
    fail("Missing .expo-smoke/index.html. Run pnpm --filter @workspace/woofwatcher-mobile run smoke:web first.");
    return;
  }
  if (!fs.existsSync(provenancePath)) {
    fail(
      "Missing Expo smoke source provenance. Run pnpm --filter @workspace/woofwatcher-mobile run smoke:web before smoke:runtime.",
    );
    return;
  }
  try {
    const provenance = JSON.parse(fs.readFileSync(provenancePath, "utf8"));
    validateSmokeSourceProvenance(
      provenance,
      createSmokeSourceFingerprint(projectRoot),
    );
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    return;
  }

  const server = createPreviewServer();
  const address = await listen(server);
  const port = address.port;
  const failures = [];
  let browser = null;
  let browserDataDir = null;
  let client = null;

  try {
    const executablePath = resolveChromiumExecutable();
    if (!executablePath) {
      throw new Error(
        "Chromium is required for route-content smoke. Set PLAYWRIGHT_CHROMIUM or install a Chromium browser.",
      );
    }
    const debuggingPort = await reservePort();
    browserDataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "woofwatcher-route-smoke-"),
    );
    const stderrLines = [];
    browser = spawn(
      executablePath,
      [
        "--headless=new",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-features=ServiceWorker",
        "--no-default-browser-check",
        "--no-first-run",
        `--remote-debugging-port=${debuggingPort}`,
        `--user-data-dir=${browserDataDir}`,
        "about:blank",
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    browser.stderr.setEncoding("utf8");
    browser.stderr.on("data", (chunk) => {
      stderrLines.push(String(chunk));
      if (stderrLines.length > 20) stderrLines.shift();
    });
    const webSocketUrl = await waitForDevTools(
      debuggingPort,
      browser,
      stderrLines,
    );
    client = await createCdpClient(webSocketUrl);
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await client.send("Emulation.setEmulatedMedia", {
      features: [
        { name: "prefers-reduced-motion", value: "reduce" },
        { name: "prefers-color-scheme", value: "light" },
      ],
    });

    for (const route of MOBILE_RUNTIME_SMOKE_ROUTES) {
      const pageErrors = [];
      const removeExceptionListener = client.on(
        "Runtime.exceptionThrown",
        ({ exceptionDetails }) => {
          pageErrors.push(
            exceptionDetails?.exception?.description ||
              exceptionDetails?.text ||
              "Uncaught page exception",
          );
        },
      );
      try {
        const loadWaiter = createCdpEventWaiter(
          client,
          "Page.loadEventFired",
        );
        let navigation;
        try {
          navigation = await client.send("Page.navigate", {
            url: `http://127.0.0.1:${port}${route}`,
          });
        } catch (error) {
          loadWaiter.cancel();
          throw error;
        }
        if (navigation.errorText) {
          loadWaiter.cancel();
          failures.push(`${route} failed navigation: ${navigation.errorText}`);
          continue;
        }
        await loadWaiter.promise;

        const expected = ROUTE_CONTENT_EXPECTATIONS[route] || [];
        const proof = await waitForStableRouteContent(
          client,
          route,
          expected,
        );
        if (!proof.stable) {
          failures.push(
            `${route} did not render expected route content as stable route content (${expected.join(
              " or ",
            )}); finalPath=${proof.pathname || "(empty)"}; body=${proof.body
              .replace(/\s+/g, " ")
              .slice(0, 220)}`,
          );
          continue;
        }

        const body = proof.body;
        if (body.includes("Account service unavailable")) {
          failures.push(
            `${route} rendered the release auth blocker instead of route content`,
          );
        }
        if (pageErrors.length) {
          failures.push(
            `${route} raised a page error: ${pageErrors[0].slice(0, 220)}`,
          );
        }
      } finally {
        removeExceptionListener();
      }
    }
    await runAccessibilityLayoutProof(client, port, failures);
  } finally {
    if (client) await client.close().catch(() => undefined);
    if (browser) await terminateBrowser(browser);
    if (browserDataDir) {
      fs.rmSync(browserDataDir, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 50,
      });
    }
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
  ROUTE_CONTENT_EXPECTATIONS,
  ACCESSIBILITY_LAYOUT_PROOF_SCALES,
  ACCESSIBILITY_LAYOUT_PROOF_SURFACES,
  createPreviewServer,
  requestRoute,
  resolveChromiumExecutable,
  createCdpClient,
  createSmokeSourceFingerprint,
  validateSmokeSourceProvenance,
  terminateBrowser,
  validateAccessibilityLayoutSnapshot,
  isRectContainedByRoute,
  waitForStableRouteContent,
};
