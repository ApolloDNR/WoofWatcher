const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const root = path.resolve(__dirname, "..");
const PNG_SIGNATURE = "89504e470d0a1a0a";

const CRC_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function usage() {
  console.log(`Usage:
node scripts/build-pixellab-sprite-strip.js \\
  --url-template "https://.../{i}.png" \\
  --indexes 0,1,2,3,4,5,6,7 \\
  --out assets/avatar/phoenix/idle-breathe-strip.png

Options:
  --url-template <url>   PixelLab frame URL with {i} placeholder.
  --indexes <csv>        Source frame indexes to use, in output order.
  --out <file>           Output PNG path relative to artifacts/woofwatcher-mobile.
  --frame-width <px>     Slot width. Default: 256.
  --frame-height <px>    Slot height. Default: 256.
`);
}

function parseArgs(argv) {
  const args = {
    frameWidth: 256,
    frameHeight: 256,
    indexes: [],
    out: "",
    urlTemplate: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1] ?? "";
    if (arg === "--url-template") {
      args.urlTemplate = next;
      index += 1;
      continue;
    }
    if (arg === "--indexes") {
      args.indexes = next
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value >= 0);
      index += 1;
      continue;
    }
    if (arg === "--out") {
      args.out = next;
      index += 1;
      continue;
    }
    if (arg === "--frame-width") {
      args.frameWidth = Number(next);
      index += 1;
      continue;
    }
    if (arg === "--frame-height") {
      args.frameHeight = Number(next);
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }

  return args;
}

function crc32(buffers) {
  let crc = 0xffffffff;
  for (const buffer of buffers) {
    for (const byte of buffer) {
      crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readChunks(buffer) {
  if (buffer.subarray(0, 8).toString("hex") !== PNG_SIGNATURE) {
    throw new Error("not a PNG");
  }

  const chunks = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    chunks.push({ type, data });
    offset += 12 + length;
    if (type === "IEND") break;
  }
  return chunks;
}

function unfilterScanlines(raw, width, height) {
  const stride = width * 4;
  const output = Buffer.alloc(stride * height);
  let inputOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[inputOffset];
    inputOffset += 1;
    const rowOffset = y * stride;
    const prevRowOffset = rowOffset - stride;

    for (let x = 0; x < stride; x += 1) {
      const source = raw[inputOffset + x];
      const left = x >= 4 ? output[rowOffset + x - 4] : 0;
      const up = y > 0 ? output[prevRowOffset + x] : 0;
      const upLeft = y > 0 && x >= 4 ? output[prevRowOffset + x - 4] : 0;
      let value;

      if (filter === 0) value = source;
      else if (filter === 1) value = source + left;
      else if (filter === 2) value = source + up;
      else if (filter === 3) value = source + Math.floor((left + up) / 2);
      else if (filter === 4) {
        const predictor = left + up - upLeft;
        const pa = Math.abs(predictor - left);
        const pb = Math.abs(predictor - up);
        const pc = Math.abs(predictor - upLeft);
        const paeth = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        value = source + paeth;
      } else {
        throw new Error(`unsupported PNG filter: ${filter}`);
      }

      output[rowOffset + x] = value & 0xff;
    }
    inputOffset += stride;
  }

  return output;
}

function decodePng(buffer) {
  const chunks = readChunks(buffer);
  const ihdr = chunks.find((chunk) => chunk.type === "IHDR");
  if (!ihdr) throw new Error("missing IHDR");

  const width = ihdr.data.readUInt32BE(0);
  const height = ihdr.data.readUInt32BE(4);
  const bitDepth = ihdr.data[8];
  const colorType = ihdr.data[9];
  const compression = ihdr.data[10];
  const filter = ihdr.data[11];
  const interlace = ihdr.data[12];

  if (bitDepth !== 8 || colorType !== 6 || compression !== 0 || filter !== 0 || interlace !== 0) {
    throw new Error(`unsupported PNG format: bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}`);
  }

  const idat = Buffer.concat(chunks.filter((chunk) => chunk.type === "IDAT").map((chunk) => chunk.data));
  const raw = zlib.inflateSync(idat);
  return { width, height, data: unfilterScanlines(raw, width, height) };
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32([typeBuffer, data]), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng({ width, height, data }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const sourceOffset = y * stride;
    const targetOffset = y * (stride + 1);
    raw[targetOffset] = 0;
    data.copy(raw, targetOffset + 1, sourceOffset, sourceOffset + stride);
  }

  return Buffer.concat([
    Buffer.from(PNG_SIGNATURE, "hex"),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function safeOutputPath(out) {
  if (!out || out.includes("..") || path.isAbsolute(out)) {
    throw new Error(`Unsafe output path: ${out}`);
  }
  const target = path.resolve(root, out);
  if (!target.startsWith(root)) {
    throw new Error(`Output must stay inside ${root}`);
  }
  return target;
}

async function fetchFrame(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return scrubTransparentRgb(clearNearBlackMatte(clearEdgeMatte(decodePng(Buffer.from(await response.arrayBuffer())))));
}

function pixelOffset(image, x, y) {
  return (y * image.width + x) * 4;
}

function pixelDistance(image, offset, color) {
  return (
    Math.abs(image.data[offset] - color[0]) +
    Math.abs(image.data[offset + 1] - color[1]) +
    Math.abs(image.data[offset + 2] - color[2])
  );
}

function clearEdgeMatte(image) {
  const cornerOffset = pixelOffset(image, 0, 0);
  const background = [
    image.data[cornerOffset],
    image.data[cornerOffset + 1],
    image.data[cornerOffset + 2],
    image.data[cornerOffset + 3],
  ];

  if (background[3] < 8) return image;

  const threshold = 42;
  const cleaned = { ...image, data: Buffer.from(image.data) };
  const visited = new Uint8Array(image.width * image.height);
  const stack = [];

  function enqueue(x, y) {
    if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
    const index = y * image.width + x;
    if (visited[index]) return;
    const offset = index * 4;
    if (image.data[offset + 3] < 8 || pixelDistance(image, offset, background) > threshold) return;
    visited[index] = 1;
    stack.push([x, y]);
  }

  for (let x = 0; x < image.width; x += 1) {
    enqueue(x, 0);
    enqueue(x, image.height - 1);
  }
  for (let y = 0; y < image.height; y += 1) {
    enqueue(0, y);
    enqueue(image.width - 1, y);
  }

  while (stack.length > 0) {
    const [x, y] = stack.pop();
    const offset = pixelOffset(cleaned, x, y);
    cleaned.data[offset] = 0;
    cleaned.data[offset + 1] = 0;
    cleaned.data[offset + 2] = 0;
    cleaned.data[offset + 3] = 0;

    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  return cleaned;
}

function clearNearBlackMatte(image) {
  const cleaned = { ...image, data: Buffer.from(image.data) };
  for (let offset = 0; offset < cleaned.data.length; offset += 4) {
    const red = cleaned.data[offset];
    const green = cleaned.data[offset + 1];
    const blue = cleaned.data[offset + 2];
    const alpha = cleaned.data[offset + 3];
    if (alpha > 0 && red <= 12 && green <= 18 && blue <= 28) {
      cleaned.data[offset] = 0;
      cleaned.data[offset + 1] = 0;
      cleaned.data[offset + 2] = 0;
      cleaned.data[offset + 3] = 0;
    }
  }
  return cleaned;
}

function scrubTransparentRgb(image) {
  const cleaned = { ...image, data: Buffer.from(image.data) };
  for (let offset = 0; offset < cleaned.data.length; offset += 4) {
    if (cleaned.data[offset + 3] === 0) {
      cleaned.data[offset] = 0;
      cleaned.data[offset + 1] = 0;
      cleaned.data[offset + 2] = 0;
    }
  }
  return cleaned;
}

function blitCenteredBottom(target, frame, slot, frameWidth, frameHeight) {
  const xOffset = slot * frameWidth + Math.max(0, Math.round((frameWidth - frame.width) / 2));
  const yOffset = Math.max(0, frameHeight - frame.height);
  const stripWidth = frameWidth * target.frames;

  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const targetX = xOffset + x;
      const targetY = yOffset + y;
      if (targetX < 0 || targetX >= stripWidth || targetY < 0 || targetY >= frameHeight) continue;

      const sourceOffset = (y * frame.width + x) * 4;
      const targetOffset = (targetY * stripWidth + targetX) * 4;
      frame.data.copy(target.data, targetOffset, sourceOffset, sourceOffset + 4);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.urlTemplate || !args.out || args.indexes.length === 0) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  if (!args.urlTemplate.includes("{i}")) {
    throw new Error("--url-template must include {i}");
  }

  const target = safeOutputPath(args.out);
  fs.mkdirSync(path.dirname(target), { recursive: true });

  const strip = {
    width: args.frameWidth * args.indexes.length,
    height: args.frameHeight,
    frames: args.indexes.length,
    data: Buffer.alloc(args.frameWidth * args.indexes.length * args.frameHeight * 4),
  };

  for (let slot = 0; slot < args.indexes.length; slot += 1) {
    const sourceIndex = args.indexes[slot];
    const url = args.urlTemplate.replace("{i}", String(sourceIndex));
    const frame = await fetchFrame(url);
    blitCenteredBottom(strip, frame, slot, args.frameWidth, args.frameHeight);
    console.log(`Fetched frame ${sourceIndex}: ${frame.width}x${frame.height}`);
  }

  fs.writeFileSync(target, encodePng(strip));
  console.log(`Saved ${path.relative(root, target)} ${strip.width}x${strip.height}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
