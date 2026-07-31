import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const runtimePlaywright = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ? path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, ".pnpm/node_modules/playwright-core")
  : null;
const playwrightCore = process.env.PLAYWRIGHT_CORE_PATH
  || (runtimePlaywright && fs.existsSync(runtimePlaywright) ? runtimePlaywright : null)
  || (new URL("../../..", import.meta.url).pathname) + "artifacts/woofwatcher-mobile/node_modules/playwright-core";
const { chromium } = require(playwrightCore);

// Run from the repo root after building the web export:
//   pnpm --filter @workspace/woofwatcher-mobile run smoke:web
//   node docs/release/tools/store-pack.mjs
// Requires playwright-core (resolved from the mobile package) and a Chromium
// binary (CHROME_BIN env var, or the Playwright-managed default below).
const REPO = new URL("../../..", import.meta.url).pathname.replace(/\/$/, "");
const ROOT = `${REPO}/artifacts/woofwatcher-mobile/.expo-smoke`;
const CHROME = process.env.CHROME_BIN || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const CHROME_ARGS = process.env.CHROME_ARGS_JSON
  ? JSON.parse(process.env.CHROME_ARGS_JSON)
  : [];
const BASE_DIR = process.env.STORE_PACK_TMP || "/tmp/store-pack";
const RAW_IOS = path.join(BASE_DIR, "store-raw/ios-6.9");
const RAW_PLAY = path.join(BASE_DIR, "store-raw/play-phone");
const OUT_IOS = path.join(BASE_DIR, "store-out/ios-6.9");
const OUT_PLAY = path.join(BASE_DIR, "store-out/play-phone");
const OUT_FEATURE = path.join(BASE_DIR, "store-out");
const REUSE_RAW = process.env.STORE_PACK_REUSE_RAW === "1";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".ttf": "font/ttf", ".ico": "image/x-icon", ".map": "application/json" };

for (const dir of [RAW_IOS, RAW_PLAY, OUT_IOS, OUT_PLAY]) {
  if (REUSE_RAW && (dir === RAW_IOS || dir === RAW_PLAY)) continue;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  let fp = path.join(ROOT, urlPath);
  let ok = false; try { ok = fs.statSync(fp).isFile(); } catch {}
  if (!ok) fp = path.join(ROOT, "index.html");
  fs.readFile(fp, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": MIME[path.extname(fp)] || "application/octet-stream",
    });
    res.end(d);
  });
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const FRAUNCES = `${base}/assets/__node_modules/.pnpm/@expo-google-fonts+fraunces@0.4.1/node_modules/@expo-google-fonts/fraunces/700Bold/Fraunces_700Bold.0c859ce19af0584bccfc6941addedf34.ttf`;
const FREDOKA = `${base}/assets/__node_modules/.pnpm/@expo-google-fonts+fredoka@0.4.1/node_modules/@expo-google-fonts/fredoka/600SemiBold/Fredoka_600SemiBold.89a2d8224922009e6f9b96181093b634.ttf`;

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: CHROME_ARGS,
});

// ---- 1) Capture raw shots at Apple 6.9" (430x932 @3x = 1290x2796), daytime clock ----
if (!REUSE_RAW) {
const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, colorScheme: "light" });
// Shift the app clock to 10:00 local today so rooms and the Day Trail render daylight.
const nowReal = new Date();
const target = new Date(nowReal); target.setHours(10, 0, 0, 0);
const offset = target.getTime() - nowReal.getTime();
await ctx.addInitScript(`(() => {
  const RealDate = Date; const offset = ${offset};
  class ShiftedDate extends RealDate {
    constructor(...args) { if (args.length === 0) { super(RealDate.now() + offset); } else { super(...args); } }
    static now() { return RealDate.now() + offset; }
  }
  ShiftedDate.parse = RealDate.parse; ShiftedDate.UTC = RealDate.UTC;
  // eslint-disable-next-line no-global-assign
  Date = ShiftedDate;
})();`);
const page = await ctx.newPage();
page.on("dialog", (d) => d.accept());
page.on("pageerror", (error) => console.error("page error", error.message));
const externalRequests = new Set();
page.on("request", (request) => {
  const url = request.url();
  if (!/^https?:/i.test(url)) return;
  if (new URL(url).origin !== new URL(base).origin) externalRequests.add(url);
});

async function go(route, settle = 4500) {
  await page.goto(base + route, {
    waitUntil: "domcontentloaded",
    timeout: 20000,
  });
  await page.waitForFunction(
    () => (document.body?.innerText.trim().length ?? 0) > 20,
    { timeout: 10000 },
  );
  await page.waitForTimeout(settle);
}
async function shot(dir, name) {
  await page.screenshot({ path: `${dir}/${name}.png` });
  console.log("shot", path.relative(BASE_DIR, `${dir}/${name}.png`));
}
async function tapText(label) {
  try { await page.getByText(label, { exact: false }).first().click({ timeout: 4000 }); console.log("tapped", label); return true; }
  catch { console.log("MISS", label); return false; }
}
async function quickLog(label) {
  const recentRows = page.getByLabel(/^Open recent log:/i);
  const before = await recentRows.count();
  await page.getByLabel(`Log ${label}`, { exact: true }).click({ timeout: 8000 });
  await page.waitForTimeout(1000);
  const after = await recentRows.count();
  if (after <= before) {
    await page.screenshot({ path: path.join(BASE_DIR, `quick-log-${label}-failure.png`) });
    console.error((await page.locator("body").innerText()).slice(0, 4000));
    throw new Error(`Quick Log ${label} did not add a recent care row`);
  }
}
async function addRoutine({ label, type, time }) {
  const firstRoutine = page.getByText("Add your first routine", { exact: true });
  const addRoutineButton = (await firstRoutine.count()) > 0
    ? firstRoutine.last()
    : page.getByText("Add routine", { exact: true }).last();
  await addRoutineButton.click({ timeout: 8000 });
  await page.getByText("New Routine", { exact: true }).waitFor({ timeout: 8000 });
  await page.getByPlaceholder("Morning walk").fill(label);
  await page.getByText(type, { exact: true }).last().click();
  await page.getByPlaceholder("7:00 AM").fill(time);
  await page.getByPlaceholder("Apollo, Maya...").fill("Apollo");
  await page.getByText("Add Routine", { exact: true }).last().click();
  await page.waitForTimeout(700);
}
async function openSitterCarePass() {
  await page.getByLabel(/Preview the Sitter Care Pass/i).click({ timeout: 10000 });
  await page.getByText(/Sitter Care Pass/i).first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(700);
}
async function captureSet(rawDir) {
  await go("/", 1500); await shot(rawDir, "01-today");
  await go("/fastlog", 1500); await shot(rawDir, "02-fastlog");
  await go("/calendar", 1500); await shot(rawDir, "03-plan");
  await go("/story", 1500); await shot(rawDir, "04-story");
  await go("/pack", 1500); await shot(rawDir, "05-pack");
  await go("/records", 2500); await openSitterCarePass(); await shot(rawDir, "06-carepass");
}

// Boot and dismiss welcome.
await go("/");
await tapText("Explore first"); await page.waitForTimeout(1200);

// Refuse to create store art from an internal/owner-ops bundle. The Access
// segment is intentionally absent from the free production build.
await go("/pack", 1200);
if ((await page.getByText("Access", { exact: true }).count()) > 0) {
  throw new Error(
    "Store capture requires EXPO_PUBLIC_BUILD_PROFILE=production; owner-only Pack Access is visible.",
  );
}

// Save real routines through the production routine editor. Store art must
// never show the fresh-install "sample day" or placeholder command metrics.
await go("/calendar");
await addRoutine({ label: "Breakfast", type: "Meal", time: "9:00 AM" });
await addRoutine({ label: "Potty break", type: "Potty", time: "9:15 AM" });
await addRoutine({ label: "Morning walk", type: "Walk", time: "10:00 AM" });
await addRoutine({ label: "Training session", type: "Training", time: "11:00 AM" });
await addRoutine({ label: "Evening medication", type: "Check-in", time: "6:00 PM" });

// Seed one coherent care state through the app's own Fast Log flow.
await go("/fastlog");
await quickLog("Meal");
await quickLog("Potty");
await quickLog("Water");
await quickLog("Walk");

// Close the pending meal loop so Today, Fast Log, Story, and Care Pass agree.
await page.getByLabel(/^Open recent log: .*Served/i).first().click({ timeout: 8000 });
await page.getByLabel("Update meal outcome: Ate all").click({ timeout: 8000 });
await page.waitForTimeout(1000);

// Apple accepts 1290x2796 in the current 6.9" screenshot slot.
await captureSet(RAW_IOS);

// Google Play's recommendation surface requires true 9:16 phone art. Capture
// the real app at that viewport rather than stretching the Apple frames.
await page.setViewportSize({ width: 360, height: 640 });
await page.waitForTimeout(500);
await captureSet(RAW_PLAY);

if (externalRequests.size > 0) {
  throw new Error(
    `Store capture made unexpected remote requests:\n${[...externalRequests].sort().join("\n")}`,
  );
}
} else {
  for (const dir of [RAW_IOS, RAW_PLAY]) {
    for (const [name] of [
      ["01-today"],
      ["02-fastlog"],
      ["03-plan"],
      ["04-story"],
      ["05-pack"],
      ["06-carepass"],
    ]) {
      if (!fs.existsSync(path.join(dir, `${name}.png`))) {
        throw new Error(`Cannot reuse missing raw capture: ${path.join(dir, `${name}.png`)}`);
      }
    }
  }
  console.log("reusing validated raw captures");
}

// ---- 2) Compose caption panels in-browser with the real brand serif ----
const PANELS = [
  ["01-today", "Your dog's day,", "brought to life."],
  ["02-fastlog", "Log care", "in two taps."],
  ["03-plan", "See what's done,", "and what's next."],
  ["04-story", "Real care becomes", "a living story."],
  ["05-pack", "Keep essentials", "ready to go."],
  ["06-carepass", "Care handoffs,", "clear and ready."],
];

function panelHtml({ W, H, line1, line2, imgB64 }) {
  const capH = Math.round(H * 0.1537); // 430/2796 of height
  // 83.5% preserves the entire app viewport. The old 87.6% frame extended
  // below the panel and visibly cut off the bottom navigation.
  const shotW = Math.round(W * 0.835);
  const radius = Math.round(W * 0.0434);
  const fs1 = Math.round(W * 0.0806); // 104/1290
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /><style>
    @font-face { font-family: Fraunces; src: url("${FRAUNCES}") format("truetype"); }
    * { margin: 0; padding: 0; }
    html, body { width: ${W}px; height: ${H}px; background: #F3ECDA; overflow: hidden; }
    .cap { height: ${capH}px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding-bottom: ${Math.round(capH * 0.16)}px; }
    .cap div { font-family: Fraunces, Georgia, serif; font-size: ${fs1}px; line-height: 1.18; }
    .l1 { color: #26221C; }
    .l2 { color: #2E5B3C; }
    .shot { display: block; margin: 0 auto; width: ${shotW}px; border-radius: ${radius}px; box-shadow: 0 ${Math.round(W * 0.02)}px ${Math.round(W * 0.05)}px rgba(38, 34, 28, 0.22); }
  </style></head><body>
    <div class="cap"><div class="l1">${line1}</div><div class="l2">${line2}</div></div>
    <img class="shot" src="data:image/png;base64,${imgB64}" />
  </body></html>`;
}

for (const [W, H, outDir, rawDir] of [
  [1290, 2796, OUT_IOS, RAW_IOS],
  [1080, 1920, OUT_PLAY, RAW_PLAY],
]) {
  const pctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const ppage = await pctx.newPage();
  for (const [name, line1, line2] of PANELS) {
    const imgB64 = fs.readFileSync(`${rawDir}/${name}.png`).toString("base64");
    await ppage.setContent(panelHtml({ W, H, line1, line2, imgB64 }), { waitUntil: "networkidle" });
    await ppage.waitForTimeout(400);
    await ppage.screenshot({ path: `${outDir}/${name}.png` });
    console.log("panel", W + "x" + H, name);
  }
}

// ---- 3) Play feature graphic 1024x500 with real in-app room + Phoenix art ----
const iconPath = `${REPO}/artifacts/woofwatcher-mobile/assets/images/app-icon.png`;
const iconB64 = fs.readFileSync(iconPath).toString("base64");
const roomB64 = fs.readFileSync(`${REPO}/artifacts/woofwatcher-mobile/assets/avatar/rooms/phoenix-room-day.png`).toString("base64");
const phoenixB64 = fs.readFileSync(`${REPO}/artifacts/woofwatcher-mobile/assets/avatar/phoenix/approved/phoenix-main-avatar-v2-crisp.png`).toString("base64");
const fctx = await browser.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
const fpage = await fctx.newPage();
await fpage.setContent(`<!doctype html><html><head><style>
  @font-face { font-family: Fraunces; src: url("${FRAUNCES}") format("truetype"); }
  @font-face { font-family: Fredoka; src: url("${FREDOKA}") format("truetype"); }
  * { margin: 0; padding: 0; }
  html, body { width: 1024px; height: 500px; overflow: hidden; }
  body { background: #2E5B3C; }
  .room { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center 57%; image-rendering: pixelated; }
  .shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(29,52,38,.97) 0%, rgba(29,52,38,.91) 47%, rgba(29,52,38,.50) 68%, rgba(29,52,38,.10) 100%); }
  .phoenix { position: absolute; width: 390px; height: 390px; object-fit: contain; right: 54px; bottom: -15px; image-rendering: pixelated; filter: drop-shadow(0 18px 18px rgba(18,31,23,.42)); }
  .txt { position: absolute; left: 72px; top: 126px; width: 600px; }
  h1 { font-family: Fraunces, Georgia, serif; font-size: 76px; line-height: .98; color: #F9F4E4; text-shadow: 0 3px 12px rgba(18,31,23,.35); }
  .t1 { font-family: Fredoka, system-ui, sans-serif; font-size: 31px; color: #F6EAD1; margin-top: 22px; }
  .t2 { font-family: Fredoka, system-ui, sans-serif; font-size: 24px; color: #C9DFC0; margin-top: 13px; letter-spacing: 2px; text-transform: uppercase; }
</style></head><body>
  <img class="room" src="data:image/png;base64,${roomB64}" />
  <div class="shade"></div>
  <img class="phoenix" src="data:image/png;base64,${phoenixB64}" />
  <div class="txt"><h1>WoofWatcher</h1><div class="t1">Your dog's day, brought to life.</div><div class="t2">Real care. Pixel heart.</div></div>
</body></html>`, { waitUntil: "networkidle" });
await fpage.waitForTimeout(500);
await fpage.screenshot({ path: `${OUT_FEATURE}/play-feature-graphic.png` });
console.log("feature graphic done");

// ---- 4) Exact 512x512 Google Play high-resolution icon (opaque RGBA PNG) ----
const ictx = await browser.newContext({
  viewport: { width: 512, height: 512 },
  deviceScaleFactor: 1,
});
const ipage = await ictx.newPage();
await ipage.setContent(`<!doctype html><html><head><style>
  * { margin: 0; padding: 0; }
  html, body, img { width: 512px; height: 512px; }
  body { background: transparent; overflow: hidden; }
  img { border-radius: 1px; }
</style></head><body><img src="data:image/png;base64,${iconB64}" /></body></html>`, { waitUntil: "networkidle" });
await ipage.screenshot({
  path: `${OUT_FEATURE}/play-icon-512.png`,
  omitBackground: true,
});
console.log("play icon done", path.basename(iconPath));

await browser.close();
server.close();
console.log("ALL DONE");
