import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require((new URL("../../..", import.meta.url).pathname) + "artifacts/woofwatcher-mobile/node_modules/playwright-core");

// Run from the repo root after building the web export:
//   pnpm --filter @workspace/woofwatcher-mobile run smoke:web
//   node docs/release/tools/store-pack.mjs
// Requires playwright-core (resolved from the mobile package) and a Chromium
// binary (CHROME_BIN env var, or the Playwright-managed default below).
const REPO = new URL("../../..", import.meta.url).pathname.replace(/\/$/, "");
const ROOT = `${REPO}/artifacts/woofwatcher-mobile/.expo-smoke`;
const CHROME = process.env.CHROME_BIN || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE_DIR = process.env.STORE_PACK_TMP || "/tmp/store-pack";
const RAW = path.join(BASE_DIR, "store-raw");
const OUT_IOS = path.join(BASE_DIR, "store-out/ios-6.7");
const OUT_PLAY = path.join(BASE_DIR, "store-out/play-phone");
const OUT_FEATURE = path.join(BASE_DIR, "store-out");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".ttf": "font/ttf", ".ico": "image/x-icon", ".map": "application/json" };

for (const dir of [RAW, OUT_IOS, OUT_PLAY]) { fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true }); }

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  let fp = path.join(ROOT, urlPath);
  let ok = false; try { ok = fs.statSync(fp).isFile(); } catch {}
  if (!ok) fp = path.join(ROOT, "index.html");
  fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { "Content-Type": MIME[path.extname(fp)] || "application/octet-stream" }); res.end(d); });
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const FRAUNCES = `${base}/assets/__node_modules/.pnpm/@expo-google-fonts+fraunces@0.4.1/node_modules/@expo-google-fonts/fraunces/700Bold/Fraunces_700Bold.0c859ce19af0584bccfc6941addedf34.ttf`;
const FREDOKA = `${base}/assets/__node_modules/.pnpm/@expo-google-fonts+fredoka@0.4.1/node_modules/@expo-google-fonts/fredoka/600SemiBold/Fredoka_600SemiBold.89a2d8224922009e6f9b96181093b634.ttf`;

const browser = await chromium.launch({ executablePath: CHROME, headless: true });

// ---- 1) Capture raw shots at Apple 6.7" (430x932 @3x = 1290x2796), daytime clock ----
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

async function go(route, settle = 4500) {
  await page.goto(base + route, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(settle);
}
async function shot(name) { await page.screenshot({ path: `${RAW}/${name}.png` }); console.log("shot", name); }
async function tapText(label) {
  try { await page.getByText(label, { exact: false }).first().click({ timeout: 4000 }); console.log("tapped", label); return true; }
  catch { console.log("MISS", label); return false; }
}

// Boot, dismiss welcome, then seed real care through the app's own tiles.
await go("/");
await tapText("Explore first"); await page.waitForTimeout(1200);
await go("/fastlog");
await tapText("Meal"); await page.waitForTimeout(1400);
await tapText("Potty"); await page.waitForTimeout(1400);
await tapText("Water"); await page.waitForTimeout(1400);
await tapText("Walk"); await page.waitForTimeout(1400);

await go("/"); await shot("01-today");
await go("/fastlog"); await shot("02-fastlog");
await go("/calendar"); await shot("03-plan");
await go("/story"); await shot("04-story");
await go("/pack"); await shot("05-pack");
await go("/health"); await shot("06-health");
await ctx.close();

// ---- 2) Compose caption panels in-browser with the real brand serif ----
const PANELS = [
  ["01-today", "Your dog's day,", "brought to life."],
  ["02-fastlog", "Log care", "in two taps."],
  ["03-plan", "Routines the whole", "pack can follow."],
  ["04-story", "Real care becomes", "a living story."],
  ["05-pack", "Keep the whole", "pack stocked."],
  ["06-health", "Gentle watch on", "health patterns."],
];

function panelHtml({ W, H, line1, line2, imgB64 }) {
  const capH = Math.round(H * 0.1537); // 430/2796 of height
  const shotW = Math.round(W * 0.876); // 1130/1290 of width
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

for (const [W, H, outDir] of [[1290, 2796, OUT_IOS], [1080, 2340, OUT_PLAY]]) {
  const pctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const ppage = await pctx.newPage();
  for (const [name, line1, line2] of PANELS) {
    const imgB64 = fs.readFileSync(`${RAW}/${name}.png`).toString("base64");
    await ppage.setContent(panelHtml({ W, H, line1, line2, imgB64 }), { waitUntil: "networkidle" });
    await ppage.waitForTimeout(400);
    await ppage.screenshot({ path: `${outDir}/${name}.png` });
    console.log("panel", W + "x" + H, name);
  }
  await pctx.close();
}

// ---- 3) Play feature graphic 1024x500 with the real brand fonts ----
const iconB64 = fs.readFileSync(`${REPO}/artifacts/woofwatcher-mobile/assets/images/app-icon.png`).toString("base64");
const fctx = await browser.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
const fpage = await fctx.newPage();
await fpage.setContent(`<!doctype html><html><head><style>
  @font-face { font-family: Fraunces; src: url("${FRAUNCES}") format("truetype"); }
  @font-face { font-family: Fredoka; src: url("${FREDOKA}") format("truetype"); }
  * { margin: 0; padding: 0; }
  html, body { width: 1024px; height: 500px; overflow: hidden; }
  body { background: #2E5B3C; display: flex; align-items: center; gap: 64px; padding-left: 52px; box-sizing: border-box; }
  .shade { position: absolute; inset: 0; background: rgba(38, 34, 28, 0.12); }
  img { width: 360px; height: 360px; border-radius: 72px; position: relative; box-shadow: 0 16px 40px rgba(0,0,0,0.3); }
  .txt { position: relative; }
  h1 { font-family: Fraunces, Georgia, serif; font-size: 72px; color: #F9F4E4; }
  .t1 { font-family: Fredoka, system-ui, sans-serif; font-size: 33px; color: #F6EAD1; margin-top: 16px; }
  .t2 { font-family: Fredoka, system-ui, sans-serif; font-size: 27px; color: #C9DFC0; margin-top: 12px; letter-spacing: 2px; text-transform: uppercase; }
</style></head><body>
  <div class="shade"></div>
  <img src="data:image/png;base64,${iconB64}" />
  <div class="txt"><h1>WoofWatcher</h1><div class="t1">Your dog's day, brought to life.</div><div class="t2">Real care. Pixel heart.</div></div>
</body></html>`, { waitUntil: "networkidle" });
await fpage.waitForTimeout(500);
await fpage.screenshot({ path: `${OUT_FEATURE}/play-feature-graphic.png` });
console.log("feature graphic done");
await fctx.close();

await browser.close();
server.close();
console.log("ALL DONE");
