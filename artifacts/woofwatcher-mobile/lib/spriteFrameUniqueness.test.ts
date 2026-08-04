import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { inflateSync } from "node:zlib";

const PNG_SIGNATURE = "89504e470d0a1a0a";
const BYTES_PER_PIXEL = 4;

function paethPredictor(left: number, above: number, upperLeft: number): number {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function decodeEightBitRgbaPng(file: URL): {
  width: number;
  height: number;
  pixels: Buffer;
} {
  const png = readFileSync(file);
  assert.equal(png.subarray(0, 8).toString("hex"), PNG_SIGNATURE);

  let offset = 8;
  let width = 0;
  let height = 0;
  const idatChunks: Buffer[] = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString("ascii");
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.equal(data[8], 8, "gait strip must use 8-bit channels");
      assert.equal(data[9], 6, "gait strip must use RGBA pixels");
      assert.equal(data[12], 0, "gait strip must not be interlaced");
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += length + 12;
  }

  const scanlines = inflateSync(Buffer.concat(idatChunks));
  const stride = width * BYTES_PER_PIXEL;
  const pixels = Buffer.alloc(stride * height);
  let sourceOffset = 0;
  for (let row = 0; row < height; row += 1) {
    const filter = scanlines[sourceOffset];
    sourceOffset += 1;
    for (let column = 0; column < stride; column += 1) {
      const raw = scanlines[sourceOffset + column];
      const target = row * stride + column;
      const left = column >= BYTES_PER_PIXEL ? pixels[target - BYTES_PER_PIXEL] : 0;
      const above = row > 0 ? pixels[target - stride] : 0;
      const upperLeft =
        row > 0 && column >= BYTES_PER_PIXEL
          ? pixels[target - stride - BYTES_PER_PIXEL]
          : 0;
      const predictor =
        filter === 0
          ? 0
          : filter === 1
            ? left
            : filter === 2
              ? above
              : filter === 3
                ? Math.floor((left + above) / 2)
                : paethPredictor(left, above, upperLeft);
      assert.ok(filter >= 0 && filter <= 4, `unsupported PNG filter ${filter}`);
      pixels[target] = (raw + predictor) & 0xff;
    }
    sourceOffset += stride;
  }

  return { width, height, pixels };
}

test("the production Phoenix gait contains eight genuinely distinct RGBA frames", () => {
  const asset = new URL(
    "../assets/avatar/phoenix/storybook/storybook-walk-loop-v2-strip.png",
    import.meta.url,
  );
  const decoded = decodeEightBitRgbaPng(asset);
  assert.equal(decoded.width, 2048);
  assert.equal(decoded.height, 256);

  const frameWidth = 256;
  const hashes = new Set<string>();
  for (let frame = 0; frame < 8; frame += 1) {
    const hash = createHash("sha256");
    for (let row = 0; row < decoded.height; row += 1) {
      const rowStart = row * decoded.width * BYTES_PER_PIXEL;
      const frameStart = rowStart + frame * frameWidth * BYTES_PER_PIXEL;
      hash.update(
        decoded.pixels.subarray(
          frameStart,
          frameStart + frameWidth * BYTES_PER_PIXEL,
        ),
      );
    }
    hashes.add(hash.digest("hex"));
  }

  assert.equal(hashes.size, 8);
});
