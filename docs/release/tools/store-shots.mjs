import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://127.0.0.1:4194";
const OUT = "/tmp/claude-0/-home-user-WoofWatcher/6498e107-6f19-5566-8220-6259157a1ec2/scratchpad/storeshots";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
// 430x932 @3x = 1290x2796, exactly Apple's 6.7" requirement.
const page = await browser.newPage({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 3,
  colorScheme: "light",
});
page.on("dialog", (d) => d.accept());

async function go(route, settle = 4200) {
  await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(settle);
}
async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log("shot", name);
}

// Seed a couple of real care moments so recency chips and lists are alive.
await go("/");
try {
  await page.locator('[aria-label="Log Meal"]').first().click({ timeout: 8000 });
  await page.waitForTimeout(1500);
  await page.locator('[aria-label="Log Potty"]').first().click({ timeout: 8000 });
  await page.waitForTimeout(1500);
  await page.locator('[aria-label="Log Water"]').first().click({ timeout: 8000 });
  await page.waitForTimeout(1500);
} catch (e) {
  console.log("seed partial:", String(e).slice(0, 80));
}

await go("/");
await shot("01-today");
await go("/fastlog");
await shot("02-fastlog");
await go("/calendar");
await shot("03-plan");
await go("/story");
await shot("04-story");
await go("/pack");
await shot("05-pack");
await go("/health");
await shot("06-health");

await browser.close();
console.log("done");
