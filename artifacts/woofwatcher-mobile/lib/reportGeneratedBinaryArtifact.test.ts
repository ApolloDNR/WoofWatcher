import assert from "node:assert/strict";
import test from "node:test";
import { inflateSync } from "node:zlib";

import {
  buildCarePassPdfArtifactSource,
  buildDogIdPngArtifactSource,
  buildGeneratedBinaryArtifactFilePlan,
  buildGeneratedBinaryArtifactShareContent,
  wrapDogIdCanvasText,
} from "./reportGeneratedBinaryArtifact.ts";

function decodePngRgba(bytes: Buffer): {
  width: number;
  height: number;
  pixels: Buffer;
} {
  assert.deepEqual(
    [...bytes.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
  );
  let offset = 8;
  let width = 0;
  let height = 0;
  let sawEnd = false;
  const imageData: Buffer[] = [];

  while (offset < bytes.length) {
    assert.ok(offset + 12 <= bytes.length, "PNG chunk header must be complete");
    const dataLength = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    assert.match(type, /^[A-Za-z]{4}$/, `invalid PNG chunk type ${JSON.stringify(type)}`);
    const chunkEnd = offset + 12 + dataLength;
    assert.ok(chunkEnd <= bytes.length, `${type} chunk must fit inside the PNG`);
    const data = bytes.subarray(offset + 8, offset + 8 + dataLength);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    } else if (type === "IDAT") {
      imageData.push(data);
    } else if (type === "IEND") {
      sawEnd = true;
      offset = chunkEnd;
      break;
    }
    offset = chunkEnd;
  }

  assert.equal(sawEnd, true, "PNG must end with IEND");
  assert.equal(offset, bytes.length, "PNG must not contain trailing bytes after IEND");
  assert.ok(width > 0 && height > 0, "PNG must declare a non-empty canvas");
  const filtered = inflateSync(Buffer.concat(imageData));
  const scanlineSize = width * 4 + 1;
  assert.equal(filtered.length, scanlineSize * height);
  const pixels = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const rowOffset = row * scanlineSize;
    assert.equal(filtered[rowOffset], 0, "Dog ID PNG must use the supported no-filter scanline");
    filtered.copy(
      pixels,
      row * width * 4,
      rowOffset + 1,
      rowOffset + scanlineSize,
    );
  }
  return { width, height, pixels };
}

function countRgbaPixels(
  decoded: ReturnType<typeof decodePngRgba>,
  color: readonly [number, number, number, number],
  startY: number,
  endY: number,
): number {
  let count = 0;
  for (let y = startY; y < Math.min(endY, decoded.height); y += 1) {
    for (let x = 0; x < decoded.width; x += 1) {
      const offset = (y * decoded.width + x) * 4;
      if (
        decoded.pixels[offset] === color[0] &&
        decoded.pixels[offset + 1] === color[1] &&
        decoded.pixels[offset + 2] === color[2] &&
        decoded.pixels[offset + 3] === color[3]
      ) {
        count += 1;
      }
    }
  }
  return count;
}

test("builds a real local Care Pass PDF source without claiming native proof", () => {
  const source = buildCarePassPdfArtifactSource({
    fileName: "Phoenix Vet Care Pass: 2026/07/03.html",
    title: "Phoenix Vet Care Pass",
    summary: "Health and care context for veterinarian review.",
    message: "Meals steady\nMedication due tonight\nNot veterinary advice.",
  });
  const bytes = Buffer.from(source.contentBase64, "base64");

  assert.equal(source.fileName, "Phoenix-Vet-Care-Pass-2026-07-03.pdf");
  assert.equal(source.mimeType, "application/pdf");
  assert.equal(source.encoding, "base64");
  assert.equal(source.formatLabel, "Generated PDF");
  assert.ok(source.byteSize > 400);
  assert.equal(source.byteSize, bytes.byteLength);
  assert.equal(bytes.subarray(0, 8).toString("ascii"), "%PDF-1.4");
  assert.match(bytes.toString("latin1"), /Phoenix Vet Care Pass/);
  assert.match(source.boundary, /stays inside WoofWatcher unless you share it/i);
  assert.match(source.boundary, /cloud backup is not included/i);
  assert.doesNotMatch(source.boundary, /proof|provider storage|unverified/i);
});

test("Care Pass PDF paginates every report line and keeps the final regression sentinel", () => {
  const details = Array.from(
    { length: 70 },
    (_, index) => `Detail ${String(index + 1).padStart(2, "0")}: owner-reviewed care context`,
  );
  const finalSentinel = "FINAL CARE PASS DETAIL MUST NOT BE TRUNCATED";
  const source = buildCarePassPdfArtifactSource({
    fileName: "complete-care-pass.html",
    title: "Complete Care Pass",
    summary: "All owner-reviewed details.",
    message: [...details, finalSentinel].join("\n"),
  });
  const pdf = Buffer.from(source.contentBase64, "base64").toString("latin1");

  assert.match(pdf, /\/Type \/Pages \/Kids \[[^\]]+\] \/Count [2-9][0-9]*/);
  assert.match(pdf, /Detail 01: owner-reviewed care context/);
  assert.match(pdf, /Detail 70: owner-reviewed care context/);
  assert.match(pdf, new RegExp(finalSentinel));
});

test("Care Pass PDF wraps unbroken title, summary, and body tokens without clipping later content", () => {
  const token = "W".repeat(205);
  const finalSentinel = "LONG TOKEN REPORT STILL REACHES THIS FINAL LINE";
  for (const testCase of [
    {
      label: "title",
      limit: 26,
      title: token,
      summary: "Owner-reviewed summary.",
      message: finalSentinel,
    },
    {
      label: "summary",
      limit: 48,
      title: "Care Pass",
      summary: token,
      message: finalSentinel,
    },
    {
      label: "body",
      limit: 48,
      title: "Care Pass",
      summary: "Owner-reviewed summary.",
      message: `${token}\n${finalSentinel}`,
    },
  ]) {
    const source = buildCarePassPdfArtifactSource({
      fileName: `long-${testCase.label}-care-pass.pdf`,
      title: testCase.title,
      summary: testCase.summary,
      message: testCase.message,
    });
    const pdf = Buffer.from(source.contentBase64, "base64").toString("latin1");
    const renderedTokenRuns = [...pdf.matchAll(/W+/g)]
      .map((match) => match[0].length)
      .filter((length) => length > 1);

    assert.equal(
      renderedTokenRuns.reduce((sum, length) => sum + length, 0),
      token.length,
      `${testCase.label} must retain every W glyph`,
    );
    assert.ok(
      renderedTokenRuns.every((length) => length <= testCase.limit),
      `${testCase.label} must fit the conservative Helvetica width`,
    );
    assert.match(pdf, new RegExp(finalSentinel));
  }
});

test("builds a real Dog ID PNG source with credential metadata and launch boundaries", () => {
  const source = buildDogIdPngArtifactSource({
    fileName: "Phoenix Dog ID.svg",
    title: "Phoenix Dog ID",
    lines: [
      "Breed: American Bully",
      "Weight: 62 lb",
      "Microchip: 981020000000000",
      "Emergency: Apollo",
    ],
  });
  const bytes = Buffer.from(source.contentBase64, "base64");

  assert.equal(source.fileName, "Phoenix-Dog-ID.png");
  assert.equal(source.mimeType, "image/png");
  assert.equal(source.encoding, "base64");
  assert.equal(source.formatLabel, "Generated PNG");
  assert.ok(source.byteSize > 1200);
  assert.equal(source.byteSize, bytes.byteLength);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.match(bytes.toString("latin1"), /Phoenix Dog ID/);
  assert.match(bytes.toString("latin1"), /Microchip: 981020000000000/);
  assert.match(source.boundary, /stays inside WoofWatcher unless you share it/i);
});

test("Dog ID PNG decodes completely and visibly renders Microchip and Insurance rows", () => {
  const source = buildDogIdPngArtifactSource({
    fileName: "complete-dog-id.png",
    title: "Your Dog ID",
    lines: [
      "",
      "",
      "",
      "",
      "",
      "Microchip: 981020000000000",
      "Insurance: WW-1042",
    ],
  });
  const decoded = decodePngRgba(Buffer.from(source.contentBase64, "base64"));
  const muted = [95, 111, 99, 255] as const;

  assert.ok(
    countRgbaPixels(decoded, muted, 247, 262) > 0,
    "Microchip must be painted into the sixth visible row",
  );
  assert.ok(
    countRgbaPixels(decoded, muted, 268, 283) > 0,
    "Insurance must be painted into the seventh visible row",
  );
});

test("generated PDF and PNG transliterate common care names without dropping letters", () => {
  const pdfSource = buildCarePassPdfArtifactSource({
    fileName: "José-care-pass.pdf",
    title: "José’s Care Pass",
    summary: "Zoë – owner",
    message: "Señor: 5 mg • café / Björn",
  });
  const pdf = Buffer.from(pdfSource.contentBase64, "base64").toString("latin1");

  assert.equal(pdfSource.fileName, "Jose-care-pass.pdf");
  assert.match(pdf, /Jose's Care Pass/);
  assert.match(pdf, /Zoe - owner/);
  assert.match(pdf, /Senor: 5 mg - cafe \/ Bjorn/);

  const pngSource = buildDogIdPngArtifactSource({
    fileName: "Björn-dog-id.png",
    title: "José’s ID",
    lines: [
      "Owner: Zoë",
      "Vet: Señor García",
      "Emergency: +1 (555) 0100",
      "Insurance: Björn",
    ],
  });
  const png = Buffer.from(pngSource.contentBase64, "base64").toString("latin1");

  assert.equal(pngSource.fileName, "Bjorn-dog-id.png");
  assert.match(png, /Jose's ID/);
  assert.match(png, /Owner: Zoe \| Vet: Senor Garcia/);
  assert.match(png, /Insurance: Bjorn/);
  assert.doesNotMatch(png, /Jos s|Se or|Bj rn/);
});

test("Dog ID canvas visibly renders apostrophe, plus, and phone parentheses", () => {
  const source = buildDogIdPngArtifactSource({
    fileName: "punctuation-dog-id.png",
    title: "Your Dog's ID",
    lines: ["Emergency: +1 (555) 0100"],
  });
  const decoded = decodePngRgba(Buffer.from(source.contentBase64, "base64"));
  const white = [255, 255, 255, 255] as const;
  const ink = [26, 35, 50, 255] as const;

  assert.ok(
    countRgbaPixels(decoded, white, 42, 63) > 0,
    "title sanity check must find visible white glyphs",
  );
  let apostrophePixels = 0;
  for (let y = 42; y < 63; y += 1) {
    for (let x = 186; x < 204; x += 1) {
      const offset = (y * decoded.width + x) * 4;
      if (
        decoded.pixels[offset] === white[0] &&
        decoded.pixels[offset + 1] === white[1] &&
        decoded.pixels[offset + 2] === white[2] &&
        decoded.pixels[offset + 3] === white[3]
      ) apostrophePixels += 1;
    }
  }
  assert.ok(apostrophePixels > 0, "apostrophe must be painted in the title glyph cell");

  const punctuationCells = [
    [174, 186, "plus"],
    [210, 222, "opening parenthesis"],
    [258, 270, "closing parenthesis"],
  ] as const;
  for (const [startX, endX, label] of punctuationCells) {
    let pixels = 0;
    for (let y = 142; y < 156; y += 1) {
      for (let x = startX; x < endX; x += 1) {
        const offset = (y * decoded.width + x) * 4;
        if (
          decoded.pixels[offset] === ink[0] &&
          decoded.pixels[offset + 1] === ink[1] &&
          decoded.pixels[offset + 2] === ink[2] &&
          decoded.pixels[offset + 3] === ink[3]
        ) pixels += 1;
      }
    }
    assert.ok(pixels > 0, `${label} must be painted in its body glyph cell`);
  }
});

test("Dog ID canvas wraps every long title and care-field glyph onto a visible row", () => {
  const edgeLine = "W".repeat(82);
  const title = "T".repeat(50);
  assert.equal(wrapDogIdCanvasText(edgeLine, 39).join(""), edgeLine);
  assert.equal(wrapDogIdCanvasText(title, 24).join(""), title);

  const source = buildDogIdPngArtifactSource({
    fileName: "edge-dog-id.png",
    title,
    lines: Array.from({ length: 7 }, (_, index) => `Field ${index + 1}: ${edgeLine}`),
  });
  const bytes = Buffer.from(source.contentBase64, "base64");
  const png = bytes.toString("latin1");
  const decoded = decodePngRgba(bytes);
  const muted = [95, 111, 99, 255] as const;

  assert.match(
    png,
    new RegExp(edgeLine),
    "the full value remains embedded as PNG metadata",
  );
  assert.ok(decoded.height > 300, "the canvas must grow instead of clipping wrapped care fields");
  assert.ok(
    countRgbaPixels(decoded, muted, decoded.height - 50, decoded.height - 12) > 0,
    "the final wrapped care-field tail must be painted near the bottom of the expanded canvas",
  );
});

test("Dog ID canvas bounds pathological input with an explicit tail-preserving omission", () => {
  const enormousValue = `START-${"W".repeat(10_000)}-DECISIVE-TAIL`;
  const wrapped = wrapDogIdCanvasText(enormousValue, 39, 6);

  assert.equal(wrapped.length, 6);
  assert.ok(wrapped.every((line) => line.length <= 39));
  assert.match(wrapped[5], /^\.\.\. /);
  assert.match(wrapped[5], /DECISIVE-TAIL$/);

  const source = buildDogIdPngArtifactSource({
    fileName: "bounded-dog-id.png",
    title: "T".repeat(10_000),
    lines: Array.from({ length: 100 }, (_, index) =>
      `Field ${index + 1}: ${"W".repeat(1_000)}-TAIL-${index + 1}`,
    ),
  });
  const bytes = Buffer.from(source.contentBase64, "base64");
  const decoded = decodePngRgba(bytes);

  assert.ok(decoded.height < 1_800, "pathological input must keep the RGBA allocation bounded");
  assert.match(bytes.toString("latin1"), /TAIL-100/);
});

test("generated artifacts bound hostile text, metadata, and file names before rendering", () => {
  const enormous = `START-${"W".repeat(1_000_000)}-DECISIVE-TAIL`;
  const pdf = buildCarePassPdfArtifactSource({
    fileName: `${enormous}.html`,
    title: enormous,
    summary: enormous,
    message: enormous,
  });
  const png = buildDogIdPngArtifactSource({
    fileName: `${enormous}.svg`,
    title: enormous,
    lines: [
      `${enormous}-FIELD-1`,
      ...Array.from({ length: 98 }, (_, index) => `Field ${index + 2}`),
      "DECISIVE-FIELD-100",
    ],
  });
  const pngBytes = Buffer.from(png.contentBase64, "base64");

  assert.ok(pdf.fileName.length <= 96);
  assert.ok(png.fileName.length <= 96);
  assert.ok(pdf.byteSize < 500_000, "PDF generation must cap hostile report text");
  assert.ok(png.byteSize < 4_000_000, "PNG pixels and metadata must stay bounded");
  assert.match(Buffer.from(pdf.contentBase64, "base64").toString("latin1"), /DECISIVE-TAIL/);
  assert.match(pngBytes.toString("latin1"), /DECISIVE-FIELD-100/);
  assert.ok(
    !pngBytes.toString("latin1").includes("W".repeat(100_000)),
    "PNG metadata must not retain an unbounded source field",
  );
});

test("builds a local generated binary file plan for native sharing and web fallback", () => {
  const source = buildCarePassPdfArtifactSource({
    fileName: "vet-care-pass.html",
    title: "Vet Care Pass",
    summary: "Review packet.",
    message: "Review before sharing.",
  });
  const plan = buildGeneratedBinaryArtifactFilePlan(source, {
    documentDirectory: "file:///var/mobile/Documents",
    directoryName: "WoofWatcherReports",
    title: "Vet Care Pass",
  });

  assert.equal(plan.canWriteLocalFile, true);
  assert.equal(plan.directoryUri, "file:///var/mobile/Documents/WoofWatcherReports/");
  assert.equal(plan.fileUri, "file:///var/mobile/Documents/WoofWatcherReports/vet-care-pass.pdf");
  assert.equal(plan.encoding, "base64");
  assert.match(plan.message, /local generated PDF/);
  assert.match(plan.message, /saved inside WoofWatcher/i);
  assert.doesNotMatch(plan.message, /saved to your device/i);

  const shareContent = buildGeneratedBinaryArtifactShareContent(plan, {
    shareUri: "content://reports/vet-care-pass.pdf",
  });
  assert.equal(shareContent.url, "content://reports/vet-care-pass.pdf");
  assert.match(shareContent.message, /application\/pdf/);

  const fallback = buildGeneratedBinaryArtifactFilePlan(source, {
    documentDirectory: null,
    title: "Vet Care Pass",
  });
  assert.equal(fallback.canWriteLocalFile, false);
  const fallbackShare = buildGeneratedBinaryArtifactShareContent(fallback);
  assert.equal(fallbackShare.url, undefined);
  assert.match(fallbackShare.message, /local file export is unavailable/i);
  assert.match(fallbackShare.message, /could not be saved or attached/i);
  assert.doesNotMatch(fallbackShare.message, /is saved to your device/i);
});
