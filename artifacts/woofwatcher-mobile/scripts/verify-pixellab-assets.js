const fs = require("fs");
const path = require("path");

const allowMissing = process.argv.includes("--allow-missing");
const root = path.resolve(__dirname, "..");

const spriteDir = path.join(root, "assets", "avatar", "phoenix");
const roomDir = path.join(root, "assets", "avatar", "rooms");
const templateDir = path.join(root, "assets", "avatar", "templates");

const sprites = [
  ["idle-breathe-strip.png", 8, 256, 256],
  ["tail-wag-strip.png", 8, 256, 256],
  ["ear-perk-strip.png", 6, 256, 256],
  ["walk-loop-strip.png", 10, 256, 256],
  ["eat-loop-strip.png", 8, 256, 256],
  ["drink-loop-strip.png", 8, 256, 256],
  ["sleep-loop-strip.png", 8, 256, 256],
  ["comfort-loop-strip.png", 8, 256, 256],
  ["celebrate-hop-strip.png", 8, 256, 256],
  ["health-watch-strip.png", 8, 256, 256],
];

const rooms = [
  "phoenix-room-day.png",
  "phoenix-room-night.png",
  "phoenix-room-bedtime.png",
  "phoenix-room-health-watch.png",
  "phoenix-room-home-alone.png",
];

const templatePreviews = [
  "shepherd",
  "retriever",
  "husky",
  "bully",
  "doodle",
  "terrier",
  "hound",
  "dachshund",
  "spaniel",
  "toy",
  "slender",
  "mixed",
];

const templateBases = [
  "shepherd",
  "retriever",
  "husky",
  "doodle",
];

function readPngSize(file) {
  const buffer = fs.readFileSync(file);
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") {
    throw new Error("not a PNG");
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function checkSprite([fileName, frames, frameWidth, frameHeight]) {
  const file = path.join(spriteDir, fileName);
  if (!fs.existsSync(file)) return { type: "missing", file: path.relative(root, file) };

  const size = readPngSize(file);
  const expectedWidth = frames * frameWidth;
  const expectedHeight = frameHeight;
  if (size.width !== expectedWidth || size.height !== expectedHeight) {
    return {
      type: "invalid",
      file: path.relative(root, file),
      message: `expected ${expectedWidth}x${expectedHeight}, got ${size.width}x${size.height}`,
    };
  }

  return { type: "ok", file: path.relative(root, file), message: `${size.width}x${size.height}` };
}

function checkRoom(fileName) {
  const file = path.join(roomDir, fileName);
  if (!fs.existsSync(file)) return { type: "missing", file: path.relative(root, file) };

  const size = readPngSize(file);
  if (size.width < 800 || size.height < 600) {
    return {
      type: "invalid",
      file: path.relative(root, file),
      message: `room is small at ${size.width}x${size.height}`,
    };
  }

  return { type: "ok", file: path.relative(root, file), message: `${size.width}x${size.height}` };
}

function checkTemplatePreview(templateId) {
  const file = path.join(templateDir, templateId, "preview.png");
  if (!fs.existsSync(file)) return { type: "missing", file: path.relative(root, file) };

  const size = readPngSize(file);
  if (size.width !== 85 || size.height !== 85) {
    return {
      type: "invalid",
      file: path.relative(root, file),
      message: `expected 85x85, got ${size.width}x${size.height}`,
    };
  }

  return { type: "ok", file: path.relative(root, file), message: `${size.width}x${size.height}` };
}

function checkTemplateBase(templateId) {
  const file = path.join(templateDir, templateId, "base.png");
  if (!fs.existsSync(file)) return { type: "missing", file: path.relative(root, file) };

  const size = readPngSize(file);
  if (size.width !== 170 || size.height !== 170) {
    return {
      type: "invalid",
      file: path.relative(root, file),
      message: `expected 170x170, got ${size.width}x${size.height}`,
    };
  }

  return { type: "ok", file: path.relative(root, file), message: `${size.width}x${size.height}` };
}

const results = [
  ...sprites.map(checkSprite),
  ...rooms.map(checkRoom),
  ...templatePreviews.map(checkTemplatePreview),
  ...templateBases.map(checkTemplateBase),
];
const missing = results.filter((result) => result.type === "missing");
const invalid = results.filter((result) => result.type === "invalid");
const ok = results.filter((result) => result.type === "ok");

for (const result of ok) {
  console.log(`OK ${result.file} ${result.message}`);
}

for (const result of missing) {
  console.log(`MISSING ${result.file}`);
}

for (const result of invalid) {
  console.error(`INVALID ${result.file}: ${result.message}`);
}

if (invalid.length > 0) process.exit(1);
if (missing.length > 0 && !allowMissing) process.exit(1);

console.log(
  `PixelLab asset check complete: ok=${ok.length} missing=${missing.length} invalid=${invalid.length}`,
);
