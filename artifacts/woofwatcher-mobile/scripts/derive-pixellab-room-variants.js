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

const variants = {
  "phoenix-room-night.png": {
    tint: [10, 28, 56],
    mix: 0.48,
    brightness: 0.58,
    vignette: 0.34,
  },
  "phoenix-room-bedtime.png": {
    tint: [72, 42, 62],
    mix: 0.35,
    brightness: 0.68,
    vignette: 0.26,
  },
  "phoenix-room-health-watch.png": {
    tint: [54, 90, 76],
    mix: 0.26,
    brightness: 0.82,
    vignette: 0.16,
  },
  "phoenix-room-home-alone.png": {
    tint: [22, 48, 82],
    mix: 0.38,
    brightness: 0.64,
    vignette: 0.3,
  },
};

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
  const interlace = ihdr.data[12];
  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error(`unsupported PNG format: bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}`);
  }

  const idat = Buffer.concat(chunks.filter((chunk) => chunk.type === "IDAT").map((chunk) => chunk.data));
  return { width, height, data: unfilterScanlines(zlib.inflateSync(idat), width, height) };
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

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    data.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  return Buffer.concat([
    Buffer.from(PNG_SIGNATURE, "hex"),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function deriveVariant(source, options) {
  const output = Buffer.from(source.data);
  const centerX = source.width / 2;
  const centerY = source.height / 2;
  const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const offset = (y * source.width + x) * 4;
      const alpha = output[offset + 3];
      if (alpha === 0) continue;

      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy) / maxDistance;
      const shade = 1 - distance * options.vignette;

      output[offset] = clamp((output[offset] * (1 - options.mix) + options.tint[0] * options.mix) * options.brightness * shade);
      output[offset + 1] = clamp((output[offset + 1] * (1 - options.mix) + options.tint[1] * options.mix) * options.brightness * shade);
      output[offset + 2] = clamp((output[offset + 2] * (1 - options.mix) + options.tint[2] * options.mix) * options.brightness * shade);
    }
  }

  return { width: source.width, height: source.height, data: output };
}

function main() {
  const roomDir = path.join(root, "assets", "avatar", "rooms");
  const sourcePath = path.join(roomDir, "phoenix-room-day.png");
  const source = decodePng(fs.readFileSync(sourcePath));

  for (const [fileName, options] of Object.entries(variants)) {
    const target = path.join(roomDir, fileName);
    fs.writeFileSync(target, encodePng(deriveVariant(source, options)));
    console.log(`Saved ${path.relative(root, target)} ${source.width}x${source.height}`);
  }
}

main();
