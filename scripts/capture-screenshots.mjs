import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const url = process.argv.find((arg) => arg.startsWith("--url="))?.split("=")[1] || "http://127.0.0.1:4190/";
const chrome =
  process.argv.find((arg) => arg.startsWith("--chrome="))?.slice("--chrome=".length) ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const outDir = join(root, "docs");
const userDataDir = join(tmpdir(), `woofwatcher-cdp-profile-${Date.now()}`);
const port = 9339 + Math.floor(Math.random() * 40);

await mkdir(outDir, { recursive: true });
await mkdir(userDataDir, { recursive: true });

const browser = spawn(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--disable-crash-reporter",
    "--disable-breakpad",
    "--disable-extensions",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${userDataDir}`,
    `--remote-debugging-port=${port}`,
    "about:blank"
  ],
  { stdio: "ignore" }
);

try {
  const page = await waitForPageTarget(port);
  const client = await connectCdp(page.webSocketDebuggerUrl);

  await send(client, "Page.enable");
  await send(client, "Runtime.enable");

  await capture(client, {
    label: "desktop",
    file: join(outDir, "woofwatcher-desktop.png"),
    width: 1440,
    height: 1100,
    mobile: false
  });

  await capture(client, {
    label: "mobile",
    file: join(outDir, "woofwatcher-mobile.png"),
    width: 390,
    height: 844,
    mobile: true
  });

  console.log("captured desktop and mobile screenshots");
} finally {
  browser.kill();
}

async function capture(client, options) {
  await send(client, "Emulation.setDeviceMetricsOverride", {
    width: options.width,
    height: options.height,
    deviceScaleFactor: 1,
    mobile: options.mobile
  });
  await send(client, "Page.navigate", { url });
  await waitForEvent(client, "Page.loadEventFired", 10000);
  await new Promise((resolve) => setTimeout(resolve, 800));
  const result = await send(client, "Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false
  });
  await writeFile(options.file, Buffer.from(result.data, "base64"));
  console.log(`${options.label}: ${options.file}`);
}

async function waitForPageTarget(debugPort) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error("Chrome debugging target did not become available.");
}

async function connectCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  const events = new Map();
  let nextId = 1;

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve: settle, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else settle(message.result || {});
      return;
    }
    if (message.method && events.has(message.method)) {
      for (const settle of events.get(message.method)) settle(message.params || {});
      events.delete(message.method);
    }
  });

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  return { socket, pending, events, nextId };
}

function send(client, method, params = {}) {
  const id = client.nextId++;
  client.socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    client.pending.set(id, { resolve, reject });
    setTimeout(() => {
      if (!client.pending.has(id)) return;
      client.pending.delete(id);
      reject(new Error(`Timed out waiting for ${method}`));
    }, 10000);
  });
}

function waitForEvent(client, method, timeout) {
  return new Promise((resolve, reject) => {
    const listeners = client.events.get(method) || [];
    listeners.push(resolve);
    client.events.set(method, listeners);
    setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), timeout);
  });
}
