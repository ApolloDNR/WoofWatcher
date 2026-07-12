const fs = require("fs");
const path = require("path");

const allowMissing = process.argv.includes("--allow-missing");
const root = path.resolve(__dirname, "..");

const spriteDir = path.join(root, "assets", "avatar", "phoenix");
const roomDir = path.join(root, "assets", "avatar", "rooms");
const templateDir = path.join(root, "assets", "avatar", "templates");
const accessoryDir = path.join(root, "assets", "avatar", "accessories");

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
  ["pixellab-idle-south-strip.png", 8, 256, 256],
  ["pixellab-walk-south-strip.png", 8, 256, 256],
  ["pixellab-bark-south-strip.png", 6, 256, 256],
];

const rooms = [
  "phoenix-room-day.png",
  "phoenix-room-day-option-b.png",
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

const phoenixEmotes = [
  "happy",
  "calm",
  "excited",
  "bored",
  "hungry",
  "anxious",
  "sleepy",
  "proud",
  "home-alone",
  "not-feeling-well",
];

const crispAssets = [
  ["assets/avatar/phoenix/approved/phoenix-main-avatar-v2-crisp.png", 680, 680],
  ["assets/avatar/phoenix/approved/phoenix-main-head-v2-crisp.png", 1024, 1024],
  ["assets/avatar/templates/shepherd/base-crisp.png", 680, 680],
  ["assets/avatar/templates/shepherd/preview-crisp.png", 340, 340],
  ["assets/avatar/phoenix/candidates/option-b-seated.png", 170, 170],
  ["assets/avatar/phoenix/candidates/option-b-standing.png", 170, 170],
  ["assets/avatar/phoenix/candidates/option-b-sleep-source.png", 170, 170],
  ["assets/avatar/phoenix/candidates/option-b-idle-tail-wag-strip.png", 2048, 256],
  ["assets/avatar/phoenix/candidates/option-b-ear-perk-strip.png", 1536, 256],
  ["assets/avatar/phoenix/candidates/option-b-bark-reaction-strip.png", 1536, 256],
  ["assets/avatar/phoenix/candidates/option-b-walk-loop-strip.png", 2048, 256],
  ["assets/avatar/phoenix/candidates/option-b-eat-loop-strip.png", 2048, 256],
  ["assets/avatar/phoenix/candidates/option-b-drink-loop-strip.png", 2048, 256],
  ["assets/avatar/phoenix/candidates/option-b-sleep-loop-strip.png", 2048, 256],
  ["assets/avatar/phoenix/candidates/option-b-comfort-loop-strip.png", 2048, 256],
  ["assets/avatar/phoenix/candidates/option-b-health-watch-strip.png", 2048, 256],
  ["assets/avatar/phoenix/candidates/option-b-celebrate-hop-strip.png", 2048, 256],
];

const templateEmotes = {
  shepherd: ["happy", "calm", "excited", "bored", "hungry", "anxious", "sleepy", "proud", "home_alone", "not_feeling_well"],
  retriever: ["happy", "calm", "excited", "bored", "hungry", "anxious", "sleepy", "proud", "home-alone", "not-feeling-well"],
  husky: ["happy", "calm", "excited", "bored", "hungry", "anxious", "sleepy", "proud", "home-alone", "not-feeling-well"],
  bully: ["happy", "calm", "excited", "bored", "hungry", "anxious", "sleepy", "proud", "home-alone", "not-feeling-well"],
};

const templateAccessories = [
  ["shepherd", "forest-bandana"],
  ["shepherd", "navy-collar"],
  ["shepherd", "birthday-hat"],
  ["shepherd", "sleepy-mask"],
  ["shepherd", "training-vest"],
  ["shepherd", "cozy-bed"],
  ["shepherd", "heart-sparkles"],
];

const templateSprites = [
  ["bully", "idle-tail-wag-strip.png", 8, 256, 256],
  ["bully", "walk-loop-strip.png", 8, 256, 256],
  ["dachshund", "idle-tail-wag-strip.png", 8, 256, 256],
  ["dachshund", "walk-loop-strip.png", 8, 256, 256],
  ["doodle", "idle-tail-wag-strip.png", 8, 256, 256],
  ["doodle", "walk-loop-strip.png", 8, 256, 256],
  ["hound", "idle-tail-wag-strip.png", 8, 256, 256],
  ["hound", "walk-loop-strip.png", 8, 256, 256],
  ["husky", "idle-tail-wag-strip.png", 8, 256, 256],
  ["husky", "walk-loop-strip.png", 8, 256, 256],
  ["mixed", "idle-tail-wag-strip.png", 8, 256, 256],
  ["mixed", "walk-loop-strip.png", 8, 256, 256],
  ["retriever", "idle-tail-wag-strip.png", 8, 256, 256],
  ["retriever", "walk-loop-strip.png", 8, 256, 256],
  ["slender", "idle-tail-wag-strip.png", 8, 256, 256],
  ["slender", "walk-loop-strip.png", 8, 256, 256],
  ["spaniel", "idle-tail-wag-strip.png", 8, 256, 256],
  ["spaniel", "walk-loop-strip.png", 8, 256, 256],
  ["terrier", "idle-tail-wag-strip.png", 8, 256, 256],
  ["terrier", "walk-loop-strip.png", 8, 256, 256],
  ["toy", "idle-tail-wag-strip.png", 8, 256, 256],
  ["toy", "walk-loop-strip.png", 8, 256, 256],
];

const avatarAccessories = [
  "forest-bandana",
  "navy-collar",
  "copper-collar",
  "heart-tag",
  "trail-bandana",
  "birthday-hat",
  "sleepy-mask",
  "training-vest",
  "cozy-bed",
  "heart-sparkles",
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

function checkPhoenixEmote(emoteId) {
  const file = path.join(spriteDir, "approved", "emotes", `${emoteId}.png`);
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

function checkCrispAsset([relativePath, expectedWidth, expectedHeight]) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file)) return { type: "missing", file: path.relative(root, file) };

  const size = readPngSize(file);
  if (size.width !== expectedWidth || size.height !== expectedHeight) {
    return {
      type: "invalid",
      file: path.relative(root, file),
      message: `expected ${expectedWidth}x${expectedHeight}, got ${size.width}x${size.height}`,
    };
  }

  return { type: "ok", file: path.relative(root, file), message: `${size.width}x${size.height}` };
}

function checkTemplateEmote(templateId, emoteId) {
  const file = path.join(templateDir, templateId, "emotes", `${emoteId}.png`);
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

function checkTemplateAccessory([templateId, accessoryId]) {
  const file = path.join(templateDir, templateId, "accessories", `${accessoryId}.png`);
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

function checkTemplateSprite([templateId, fileName, frames, frameWidth, frameHeight]) {
  const file = path.join(templateDir, templateId, "sprites", fileName);
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

function checkAvatarAccessory(accessoryId) {
  const file = path.join(accessoryDir, `${accessoryId}.png`);
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

const results = [
  ...sprites.map(checkSprite),
  ...rooms.map(checkRoom),
  ...templatePreviews.map(checkTemplatePreview),
  ...templateBases.map(checkTemplateBase),
  ...phoenixEmotes.map(checkPhoenixEmote),
  ...crispAssets.map(checkCrispAsset),
  ...Object.entries(templateEmotes).flatMap(([templateId, emotes]) =>
    emotes.map((emoteId) => checkTemplateEmote(templateId, emoteId)),
  ),
  ...templateAccessories.map(checkTemplateAccessory),
  ...templateSprites.map(checkTemplateSprite),
  ...avatarAccessories.map(checkAvatarAccessory),
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
