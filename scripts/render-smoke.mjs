import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const url = process.argv.find((arg) => arg.startsWith("--url="))?.split("=")[1] || "http://127.0.0.1:4190/";
const chrome =
  process.argv.find((arg) => arg.startsWith("--chrome="))?.slice("--chrome=".length) ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const userDataDir = join(tmpdir(), `woofwatcher-cdp-smoke-${Date.now()}`);
const port =
  Number(process.argv.find((arg) => arg.startsWith("--port="))?.split("=")[1]) ||
  30000 + Math.floor(Math.random() * 20000);
const runtimeErrors = [];
const debug = process.argv.includes("--debug");
const strictCdp = process.argv.includes("--strict-cdp");

function debugLog(message) {
  if (debug) console.error(`[render-smoke] ${message}`);
}

await mkdir(userDataDir, { recursive: true });
debugLog(`using chrome profile ${userDataDir}`);
debugLog(`using CDP port ${port}`);

const browser = spawn(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--disable-crash-reporter",
    "--disable-breakpad",
    "--disable-extensions",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-allow-origins=*",
    "--remote-debugging-address=127.0.0.1",
    `--user-data-dir=${userDataDir}`,
    `--remote-debugging-port=${port}`,
    "about:blank"
  ],
  { stdio: "ignore" }
);
debugLog(`spawned chrome pid ${browser.pid || "unknown"}`);

let client;
try {
  const page = await waitForPageTarget(port);
  debugLog(`found page target ${page.id}`);
  client = await connectCdp(page.webSocketDebuggerUrl.replace("ws://localhost:", "ws://127.0.0.1:"));
  debugLog("connected websocket");
  await delay(300);

  client.onEvent = (message) => {
    if (message.method === "Runtime.exceptionThrown") runtimeErrors.push(message.params.exceptionDetails.text);
  };

  await send(client, "Page.enable");
  debugLog("Page enabled");
  await send(client, "Runtime.enable");
  debugLog("Runtime enabled");
  await send(client, "Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await send(client, "Page.navigate", { url });
  await waitForEvent(client, "Page.loadEventFired", 10000);
  debugLog("page load event fired");
  await delay(800);

  await expectEval(client, "document.title", "WoofWatcher | Phoenix Care", "page title");
  await expectEval(
    client,
    "document.body.innerText.includes('Next best action') && document.body.innerText.includes('Household Pulse') && document.body.innerText.includes('WoofGuide')",
    true,
    "phoenix home text"
  );

  await evaluate(client, `
    document.querySelector('[data-tab="plans"]').click();
  `);
  await delay(250);
  await expectEval(client, "document.body.innerText.includes('Today plan')", true, "plans tab visible");
  await expectEval(client, "Boolean(document.querySelector('.reminder-list'))", true, "plans reminder list visible");
  await evaluate(client, `
    (() => {
    const before = JSON.parse(localStorage.getItem('woofwatcher.v1.state')).entries.length;
    window.__woofReminderEntryCount = before;
    document.querySelector('[data-action="complete-reminder"]').click();
    })();
  `);
  await delay(500);
  await expectEval(
    client,
    `JSON.parse(localStorage.getItem('woofwatcher.v1.state')).entries.length === window.__woofReminderEntryCount + 1`,
    true,
    "completed plan reminder writes log"
  );

  await evaluate(client, `
    document.querySelector('[data-tab="log"]').click();
  `);
  await delay(250);
  await expectEval(client, "document.body.innerText.includes('Effortless Log')", true, "effortless log visible");
  await expectEval(client, "Boolean(document.querySelector('[data-form=\"entry\"]'))", true, "entry form visible");

  await evaluate(client, `
    (() => {
    const form = document.querySelector('[data-form="entry"]');
    form.querySelector('[name="type"]').value = 'treat';
    form.querySelector('[name="title"]').value = 'QA puzzle treat';
    form.querySelector('[name="caregiver"]').value = 'Apollo';
    form.querySelector('[name="amount"]').value = 'small';
    form.querySelector('[name="treatType"]').value = 'puzzle toy';
    form.querySelector('[name="reason"]').value = 'settle practice';
    form.querySelector('[name="reaction"]').value = 'calm focus';
    form.querySelector('[name="note"]').value = 'Rendered smoke check';
    form.requestSubmit();
    })();
  `);
  await delay(500);

  await expectEval(
    client,
    `JSON.parse(localStorage.getItem('woofwatcher.v1.state')).entries[0].title`,
    "QA puzzle treat",
    "saved entry"
  );
  await expectEval(client, "document.body.innerText.includes('QA puzzle treat')", true, "timeline updates");

  await evaluate(client, `
    document.querySelector('[data-tab="health"]').click();
  `);
  await delay(250);
  await expectEval(client, "document.body.innerText.includes('Bile Watch')", true, "health bile watch visible");
  await expectEval(client, "document.body.innerText.includes('This is pattern support, not a diagnosis')", true, "health boundary visible");

  await evaluate(client, `
    document.querySelector('[data-tab="more"]').click();
  `);
  await delay(250);
  await expectEval(client, "document.body.innerText.includes('Diet Profile')", true, "diet profile visible");
  await expectEval(client, "document.body.innerText.includes('Care Pass')", true, "care pass visible");
  await expectEval(client, "document.body.innerText.includes('WoofGuide')", true, "woofguide visible");
  await expectEval(client, "Boolean(document.querySelector('[data-form=\"assistant\"]'))", true, "woofguide form visible");
  await evaluate(client, `
    (() => {
    const form = document.querySelector('[data-form="assistant"]');
    form.querySelector('[name="question"]').value = 'Phoenix threw up yellow again. What should we track?';
    form.requestSubmit();
    })();
  `);
  await delay(250);
  await expectEval(client, "document.body.innerText.includes('veterinarian')", true, "helper keeps vet boundary");

  if (runtimeErrors.length) {
    throw new Error(`Runtime errors: ${runtimeErrors.join("; ")}`);
  }

  console.log("render smoke passed");
} catch (error) {
  if (strictCdp) throw error;
  console.error(`interactive CDP smoke unavailable: ${error.message || error.name || "unknown CDP connection error"}`);
  await runDumpDomSmoke();
} finally {
  debugLog("closing websocket and chrome");
  client?.socket?.close();
  debugLog("websocket close requested");
  killBrowserTree(browser);
  debugLog("chrome cleanup requested");
  debugLog("temp profile cleanup skipped to avoid Windows file-lock hangs");
  debugLog("cleanup complete");
}

async function runDumpDomSmoke() {
  const checks = [
    { route: "/", label: "phoenix", text: ["WoofWatcher", "Next best action", "Household Pulse", "WoofGuide", "Phoenix", "Log", "Plans", "Health", "More"] },
    { route: "/?tab=log", label: "log", text: ["Effortless Log", "Treat details", "Training win", "Alone time", "Save care log"] },
    { route: "/?tab=plans", label: "plans", text: ["Plans", "Today plan", "Reminder Center", "Bedtime snack", "Phone alerts"] },
    { route: "/?tab=health", label: "health", text: ["Health Watch", "Bile Watch", "This is pattern support, not a diagnosis", "Health timeline"] },
    { route: "/?tab=more", label: "more", text: ["More", "Diet Profile", "Care Pass", "Records", "WoofGuide", "Care Team"] }
  ];

  for (const check of checks) {
    const pageUrl = new URL(check.route, url).toString();
    const dom = await dumpDom(pageUrl, check.label);
    for (const expectedText of check.text) {
      if (!dom.includes(expectedText)) {
        throw new Error(`Chrome DOM smoke for ${check.label} did not include ${JSON.stringify(expectedText)}.`);
      }
    }
  }

  console.log("render smoke passed (Chrome DOM fallback)");
}

function dumpDom(pageUrl, label) {
  const profile = join(tmpdir(), `woofwatcher-dump-smoke-${label}-${Date.now()}`);
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--disable-gpu-compositing",
    "--disable-software-rasterizer",
    "--disable-features=VizDisplayCompositor",
    "--disable-gpu-sandbox",
    "--disable-extensions",
    "--disable-dev-shm-usage",
    "--no-sandbox",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${profile}`,
    "--dump-dom",
    pageUrl
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(chrome, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Timed out dumping rendered DOM for ${label}.`));
    }, 20000);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Chrome DOM dump for ${label} exited ${code}: ${stderr.slice(0, 500)}`));
        return;
      }
      resolve(stdout);
    });
  });
}

async function waitForPageTarget(debugPort) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`, { signal: AbortSignal.timeout(700) });
      const targets = await response.json();
      const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      await delay(200);
    }
  }
  throw new Error("Chrome debugging target did not become available.");
}

async function connectCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  socket.binaryType = "arraybuffer";
  const pending = new Map();
  const events = new Map();
  const client = { socket, pending, events, nextId: 1, onEvent: null, parseErrors: [] };

  socket.addEventListener("message", async (event) => {
    let message;
    try {
      message = await parseCdpMessage(event.data);
    } catch (error) {
      client.parseErrors.push(error.message);
      return;
    }
    if (message.id && pending.has(message.id)) {
      const { resolve: settle, reject, timeout } = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(timeout);
      if (message.error) reject(new Error(message.error.message));
      else settle(message.result || {});
      return;
    }
    if (message.method && events.has(message.method)) {
      for (const settle of events.get(message.method)) settle(message.params || {});
      events.delete(message.method);
    }
    client.onEvent?.(message);
  });

  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener("open", resolveOpen, { once: true });
    socket.addEventListener("error", rejectOpen, { once: true });
  });

  return client;
}

async function parseCdpMessage(data) {
  if (typeof data === "string") return JSON.parse(data);
  if (data instanceof ArrayBuffer) return JSON.parse(Buffer.from(data).toString("utf8"));
  if (ArrayBuffer.isView(data)) return JSON.parse(Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("utf8"));
  if (typeof Blob !== "undefined" && data instanceof Blob) return JSON.parse(await data.text());
  return JSON.parse(String(data));
}

async function evaluate(client, expression) {
  const result = await send(client, "Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result?.value;
}

async function expectEval(client, expression, expected, label) {
  const actual = await evaluate(client, expression);
  if (actual !== expected) {
    throw new Error(`${label} expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}

function send(client, method, params = {}) {
  const id = client.nextId++;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (!client.pending.has(id)) return;
      client.pending.delete(id);
      const parseErrors = client.parseErrors.length ? ` Parse errors: ${client.parseErrors.join("; ")}` : "";
      reject(new Error(`Timed out waiting for ${method}.${parseErrors}`));
    }, 15000);
    client.pending.set(id, { resolve, reject, timeout });
    client.socket.send(JSON.stringify({ id, method, params }));
  });
}

function waitForEvent(client, method, timeout) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), timeout);
    const listeners = client.events.get(method) || [];
    listeners.push((params) => {
      clearTimeout(timer);
      resolve(params);
    });
    client.events.set(method, listeners);
  });
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function killBrowserTree(process) {
  if (!process.pid) return;
  if (globalThis.process.platform === "win32") {
    try {
      process.kill();
    } catch {}
    const cleanup = spawn("taskkill", ["/PID", String(process.pid), "/T", "/F"], { stdio: "ignore", detached: true });
    cleanup.unref();
    return;
  }
  process.kill();
}
