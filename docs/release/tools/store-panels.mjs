import sharp from "sharp";
import fs from "node:fs";

const SRC = "/tmp/claude-0/-home-user-WoofWatcher/6498e107-6f19-5566-8220-6259157a1ec2/scratchpad/storeshots";
const OUT_IOS = "/home/user/WoofWatcher/docs/release/store-screenshots/ios-6.7";
const OUT_PLAY = "/home/user/WoofWatcher/docs/release/store-screenshots/play-phone";
const OUT_FEATURE = "/home/user/WoofWatcher/docs/release/store-screenshots";
fs.mkdirSync(OUT_IOS, { recursive: true });
fs.mkdirSync(OUT_PLAY, { recursive: true });

const W = 1290, H = 2796;
const PANELS = [
  ["01-today", "Your dog's day,", "brought to life."],
  ["02-fastlog", "Log care", "in two taps."],
  ["03-plan", "Routines the whole", "pack can follow."],
  ["04-story", "Real care becomes", "a living story."],
  ["05-pack", "Keep the whole", "pack stocked."],
  ["06-health", "Gentle watch on", "health patterns."],
];

function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

for (const [name, line1, line2] of PANELS) {
  const src = `${SRC}/${name}.png`;
  if (!fs.existsSync(src)) { console.log("MISSING", name); continue; }
  // Caption band on parchment, then the device shot with rounded corners + soft shadow.
  const capH = 430;
  const shotW = 1130;
  const shotH = Math.round((shotW / W) * H); // preserve device aspect
  const radius = 56;
  const scaled = await sharp(src).resize(shotW, shotH).png().toBuffer();
  const roundMask = Buffer.from(
    `<svg width="${shotW}" height="${shotH}"><rect width="${shotW}" height="${shotH}" rx="${radius}"/></svg>`,
  );
  const rounded = await sharp(scaled).composite([{ input: roundMask, blend: "dest-in" }]).png().toBuffer();
  const svg = Buffer.from(`<svg width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="#F3ECDA"/>
    <text x="${W / 2}" y="200" text-anchor="middle" font-family="DejaVu Serif" font-weight="bold" font-size="104" fill="#26221C">${esc(line1)}</text>
    <text x="${W / 2}" y="330" text-anchor="middle" font-family="DejaVu Serif" font-weight="bold" font-size="104" fill="#2E5B3C">${esc(line2)}</text>
    <rect x="${(W - shotW) / 2 - 6}" y="${capH - 6}" width="${shotW + 12}" height="${shotH + 12}" rx="${radius + 6}" fill="#26221C" opacity="0.10"/>
  </svg>`);
  const panel = await sharp(svg)
    .composite([{ input: rounded, left: (W - shotW) / 2, top: capH }])
    .flatten({ background: "#F3ECDA" })
    .png({ palette: true, quality: 95, effort: 8 })
    .toBuffer();
  await sharp(panel).toFile(`${OUT_IOS}/${name}.png`);
  await sharp(panel).resize(1080, 2340, { fit: "cover" }).png({ palette: true, quality: 95 }).toFile(`${OUT_PLAY}/${name}.png`);
  console.log("panel", name);
}

// Play feature graphic 1024x500: forest field, icon art left, wordmark right.
// Text is width-constrained with textLength so the wordmark and tagline can
// never overflow the 1024px canvas (icon occupies x:52..412, text lives in the
// remaining ~572px column with a safe right margin).
const icon = await sharp("/home/user/WoofWatcher/artifacts/woofwatcher-mobile/assets/images/app-icon.png")
  .resize(360, 360).png().toBuffer();
const iconMask = Buffer.from(`<svg width="360" height="360"><rect width="360" height="360" rx="72"/></svg>`);
const iconRounded = await sharp(icon).composite([{ input: iconMask, blend: "dest-in" }]).png().toBuffer();
// Font sizes are chosen so each line's natural width clears the 1024px canvas
// (the SVG renderer here ignores textLength, so we size to fit instead of
// stretching). Text column starts at x=440, right of the 360px icon.
const TX = 440;
const fg = Buffer.from(`<svg width="1024" height="500">
  <rect width="1024" height="500" fill="#2E5B3C"/>
  <rect width="1024" height="500" fill="#26221C" opacity="0.12"/>
  <text x="${TX}" y="205" font-family="DejaVu Serif" font-weight="bold" font-size="70" fill="#F9F4E4">WoofWatcher</text>
  <text x="${TX}" y="285" font-family="DejaVu Sans" font-size="33" fill="#F6EAD1">Your dog's day, brought to life.</text>
  <text x="${TX}" y="345" font-family="DejaVu Sans" font-size="30" fill="#C9DFC0">Real care. Pixel heart.</text>
</svg>`);
await sharp(fg)
  .composite([{ input: iconRounded, left: 52, top: 70 }])
  .png({ palette: true, quality: 95 })
  .toFile(`${OUT_FEATURE}/play-feature-graphic.png`);
console.log("feature graphic done");
