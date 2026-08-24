export type GeneratedBinaryArtifactMimeType = "application/pdf" | "image/png";
export type GeneratedBinaryArtifactEncoding = "base64";

export interface GeneratedBinaryArtifactSource {
  fileName: string;
  mimeType: GeneratedBinaryArtifactMimeType;
  formatLabel: "Generated PDF" | "Generated PNG";
  encoding: GeneratedBinaryArtifactEncoding;
  contentBase64: string;
  byteSize: number;
  boundary: string;
}

export interface CarePassPdfArtifactInput {
  fileName: string;
  title: string;
  summary?: string;
  message: string;
}

export interface DogIdPngArtifactInput {
  fileName: string;
  title: string;
  lines: readonly string[];
}

export interface GeneratedBinaryArtifactFileOptions {
  directoryName?: string;
  documentDirectory?: string | null;
  title: string;
}

export interface GeneratedBinaryArtifactFilePlan {
  directoryUri: string | null;
  fileName: string;
  fileUri: string | null;
  mimeType: GeneratedBinaryArtifactMimeType;
  formatLabel: GeneratedBinaryArtifactSource["formatLabel"];
  encoding: GeneratedBinaryArtifactEncoding;
  contentBase64: string;
  byteSize: number;
  shareTitle: string;
  message: string;
  canWriteLocalFile: boolean;
  fallbackReason: string | null;
}

export interface GeneratedBinaryArtifactShareContent {
  title: string;
  message: string;
  url?: string;
}

const REPORT_EXPORT_DIRECTORY_NAME = "WoofWatcherReports";
const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const PDF_BOUNDARY =
  "This PDF stays inside WoofWatcher unless you share it. WoofWatcher cloud backup is not included.";
const PNG_BOUNDARY =
  "This PNG stays inside WoofWatcher unless you share it. WoofWatcher cloud backup is not included.";
const GENERATED_ARTIFACT_FILE_NAME_MAX_CHARS = 96;
const PDF_TITLE_MAX_CHARS = 512;
const PDF_SUMMARY_MAX_CHARS = 2_048;
const PDF_MESSAGE_MAX_CHARS = 32_768;
const DOG_ID_FIELD_MAX_CHARS = 4_096;
const DOG_ID_METADATA_FIELD_MAX_CHARS = 512;
const DOG_ID_METADATA_MAX_FIELDS = 24;
const TRUNCATION_MARKER = " ... [content shortened] ... ";

function boundTextPreservingEnds(value: unknown, maxChars: number): string {
  const text = String(value ?? "");
  if (text.length <= maxChars) return text;
  if (maxChars <= TRUNCATION_MARKER.length) return text.slice(0, maxChars);
  const remaining = maxChars - TRUNCATION_MARKER.length;
  const headLength = Math.ceil(remaining * 0.6);
  const tailLength = remaining - headLength;
  return `${text.slice(0, headLength)}${TRUNCATION_MARKER}${text.slice(-tailLength)}`;
}

function capFileStem(stem: string, extension: ".pdf" | ".png"): string {
  const maxStemChars = GENERATED_ARTIFACT_FILE_NAME_MAX_CHARS - extension.length;
  if (stem.length <= maxStemChars) return stem;
  const marker = "---";
  const remaining = maxStemChars - marker.length;
  const headLength = Math.ceil(remaining * 0.65);
  return `${stem.slice(0, headLength)}${marker}${stem.slice(-(remaining - headLength))}`;
}

function clean(value: unknown, fallback = ""): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length ? text : fallback;
}

function printableAscii(
  value: unknown,
  fallback = "",
  maxChars = PDF_MESSAGE_MAX_CHARS,
): string {
  return clean(boundTextPreservingEnds(value, maxChars), fallback)
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/[•·]/g, "-")
    .replace(/…/g, "...")
    .replace(/Æ/g, "AE")
    .replace(/æ/g, "ae")
    .replace(/Œ/g, "OE")
    .replace(/œ/g, "oe")
    .replace(/Ø/g, "O")
    .replace(/ø/g, "o")
    .replace(/Ł/g, "L")
    .replace(/ł/g, "l")
    .replace(/Đ/g, "D")
    .replace(/đ/g, "d")
    .replace(/Þ/g, "Th")
    .replace(/þ/g, "th")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]+/g, "")
    .replace(/[^\x20-\x7e]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeGeneratedBinaryFileName(fileName: string, extension: ".pdf" | ".png"): string {
  const normalized = printableAscii(fileName, "woofwatcher-artifact", 512)
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[\\/:*?"<>|#%{}^[\]`]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
  return `${capFileStem(normalized || "woofwatcher-artifact", extension)}${extension}`;
}

function normalizeExportDirectoryName(directoryName: string | undefined): string {
  const normalized = printableAscii(
    directoryName ?? REPORT_EXPORT_DIRECTORY_NAME,
    REPORT_EXPORT_DIRECTORY_NAME,
    64,
  )
    .replace(/[\\/:*?"<>|#%{}^[\]`]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
  return normalized || REPORT_EXPORT_DIRECTORY_NAME;
}

function withTrailingSlash(uri: string): string {
  return uri.endsWith("/") ? uri : `${uri}/`;
}

function asciiBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index) & 0xff;
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const combined = (first << 16) | (second << 8) | third;
    output += BASE64_CHARS[(combined >> 18) & 63];
    output += BASE64_CHARS[(combined >> 12) & 63];
    output += index + 1 < bytes.length ? BASE64_CHARS[(combined >> 6) & 63] : "=";
    output += index + 2 < bytes.length ? BASE64_CHARS[combined & 63] : "=";
  }
  return output;
}

function pdfText(value: unknown): string {
  return printableAscii(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapText(value: string, width: number, maxChars: number): string[] {
  const lines: string[] = [];
  for (const rawLine of boundTextPreservingEnds(value, maxChars).split(/\r?\n/)) {
    const words = printableAscii(rawLine, "", maxChars)
      .split(/\s+/)
      .filter(Boolean)
      .flatMap((word) => {
        const chunks: string[] = [];
        for (let index = 0; index < word.length; index += width) {
          chunks.push(word.slice(index, index + width));
        }
        return chunks;
      });
    if (words.length === 0) {
      if (lines.length > 0 && lines[lines.length - 1] !== "") lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > width && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : ["No report text available."];
}

interface PdfRenderLine {
  readonly text: string;
  readonly fontSize: number;
  readonly height: number;
}

function paginatePdfLines(
  lines: readonly PdfRenderLine[],
  maxHeight: number,
): PdfRenderLine[][] {
  const pages: PdfRenderLine[][] = [];
  let page: PdfRenderLine[] = [];
  let usedHeight = 0;
  for (const line of lines) {
    if (page.length > 0 && usedHeight + line.height > maxHeight) {
      pages.push(page);
      page = [];
      usedHeight = 0;
    }
    page.push(line);
    usedHeight += line.height;
  }
  if (page.length > 0) pages.push(page);
  return pages;
}

function buildPdfBytes(input: CarePassPdfArtifactInput): Uint8Array {
  const title = printableAscii(input.title, "Care Pass", PDF_TITLE_MAX_CHARS);
  const summary = printableAscii(
    input.summary,
    "Owner-reviewed care context.",
    PDF_SUMMARY_MAX_CHARS,
  );
  const bodyLines = wrapText(input.message, 48, PDF_MESSAGE_MAX_CHARS);
  const renderLines: PdfRenderLine[] = [
    ...wrapText(title, 26, PDF_TITLE_MAX_CHARS).map((text) => ({ text, fontSize: 18, height: 24 })),
    { text: " ", fontSize: 10, height: 8 },
    ...wrapText(summary, 48, PDF_SUMMARY_MAX_CHARS).map((text) => ({ text, fontSize: 10, height: 15 })),
    { text: " ", fontSize: 10, height: 8 },
    {
      text: "WoofWatcher organizes owner-reported care context; it does not diagnose.",
      fontSize: 10,
      height: 18,
    },
    ...bodyLines.map((text) => ({
      text: text || " ",
      fontSize: 10,
      height: 15,
    })),
  ];
  const pages = paginatePdfLines(renderLines, 675);
  if (pages.length === 0) {
    pages.push([{ text: "No report text available.", fontSize: 10, height: 15 }]);
  }

  const pageObjectNumbers = pages.map((_, index) => 4 + index * 2);
  const contentObjectNumbers = pages.map((_, index) => 5 + index * 2);
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  pages.forEach((pageLines, index) => {
    const pageNumber = index + 1;
    let y = 760;
    const streamLines = [
      "BT",
      ...pageLines.flatMap((line) => {
        const commands = [
          `/F1 ${line.fontSize} Tf`,
          `1 0 0 1 72 ${y} Tm`,
          `(${pdfText(line.text)}) Tj`,
        ];
        y -= line.height;
        return commands;
      }),
      "ET",
      "BT",
      "/F1 9 Tf",
      "72 42 Td",
      `(Page ${pageNumber} of ${pages.length}) Tj`,
      "ET",
    ];
    const stream = `${streamLines.join("\n")}\n`;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectNumbers[index]} 0 R >>`,
      `<< /Length ${asciiBytes(stream).length} >>\nstream\n${stream}endstream`,
    );
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(asciiBytes(pdf).length);
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = asciiBytes(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return asciiBytes(pdf);
}

const FONT_5X7: Record<string, readonly string[]> = {
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "'": ["00100", "00100", "00000", "00000", "00000", "00000", "00000"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "-": ["00000", "00000", "00000", "11110", "00000", "00000", "00000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  "/": ["00001", "00010", "00100", "01000", "10000", "00000", "00000"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "11100"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
};

function setPixel(pixels: Uint8Array, width: number, height: number, x: number, y: number, color: readonly number[]): void {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const offset = (y * width + x) * 4;
  pixels[offset] = color[0] ?? 0;
  pixels[offset + 1] = color[1] ?? 0;
  pixels[offset + 2] = color[2] ?? 0;
  pixels[offset + 3] = color[3] ?? 255;
}

function fillRect(
  pixels: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  rectWidth: number,
  rectHeight: number,
  color: readonly number[],
): void {
  for (let row = y; row < y + rectHeight; row += 1) {
    for (let col = x; col < x + rectWidth; col += 1) {
      setPixel(pixels, width, height, col, row, color);
    }
  }
}

function drawText(
  pixels: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  text: string,
  color: readonly number[],
  scale: number,
): void {
  let cursor = x;
  for (const char of printableAscii(text).toUpperCase()) {
    const glyph = FONT_5X7[char] ?? FONT_5X7[" "];
    for (let row = 0; row < glyph.length; row += 1) {
      for (let col = 0; col < glyph[row].length; col += 1) {
        if (glyph[row][col] !== "1") continue;
        fillRect(pixels, width, height, cursor + col * scale, y + row * scale, scale, scale, color);
      }
    }
    cursor += 6 * scale;
  }
}

function pushUint32(bytes: number[], value: number): void {
  bytes.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function zlibStored(bytes: Uint8Array): Uint8Array {
  const output: number[] = [0x78, 0x01];
  for (let offset = 0; offset < bytes.length; offset += 65535) {
    const chunk = bytes.subarray(offset, Math.min(offset + 65535, bytes.length));
    const final = offset + chunk.length >= bytes.length;
    output.push(final ? 0x01 : 0x00, chunk.length & 0xff, (chunk.length >> 8) & 0xff);
    const inverse = (~chunk.length) & 0xffff;
    output.push(inverse & 0xff, (inverse >> 8) & 0xff);
    for (const byte of chunk) output.push(byte);
  }
  pushUint32(output, adler32(bytes));
  return Uint8Array.from(output);
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = asciiBytes(type);
  const crcInput = new Uint8Array(typeBytes.length + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, typeBytes.length);
  const output = new Uint8Array(12 + data.length);
  const view = new DataView(output.buffer);
  view.setUint32(0, data.length);
  output.set(typeBytes, 4);
  output.set(data, 8);
  view.setUint32(8 + data.length, crc32(crcInput));
  return output;
}

function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function textChunk(keyword: string, text: string): Uint8Array {
  return asciiBytes(
    `${printableAscii(keyword, "", 79)}\0${printableAscii(text, "", 16_384)}`,
  );
}

export const DOG_ID_BODY_CANVAS_GLYPH_LIMIT = 39;
export const DOG_ID_BODY_MAX_VISIBLE_LINES_PER_FIELD = 6;
export const DOG_ID_MAX_VISIBLE_FIELDS = 12;
export const DOG_ID_TITLE_MAX_VISIBLE_LINES = 3;

export function wrapDogIdCanvasText(
  value: string,
  glyphLimit = DOG_ID_BODY_CANVAS_GLYPH_LIMIT,
  maxVisibleLines = Number.POSITIVE_INFINITY,
): string[] {
  if (!Number.isInteger(glyphLimit) || glyphLimit < 1) {
    throw new RangeError("Dog ID canvas glyph limit must be a positive integer");
  }
  if (
    maxVisibleLines !== Number.POSITIVE_INFINITY &&
    (!Number.isInteger(maxVisibleLines) || maxVisibleLines < 1)
  ) {
    throw new RangeError("Dog ID canvas line limit must be a positive integer");
  }
  const finiteVisibleLimit = Number.isFinite(maxVisibleLines)
    ? Math.max(256, glyphLimit * maxVisibleLines * 4)
    : DOG_ID_FIELD_MAX_CHARS;
  const normalized = printableAscii(value, "", finiteVisibleLimit);
  if (!normalized) return [""];

  const words = normalized.split(" ").flatMap((word) => {
    const chunks: string[] = [];
    for (let index = 0; index < word.length; index += glyphLimit) {
      chunks.push(word.slice(index, index + glyphLimit));
    }
    return chunks;
  });
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > glyphLimit && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  const wrapped = lines.length ? lines : [""];
  if (wrapped.length <= maxVisibleLines) return wrapped;

  const omissionPrefix = glyphLimit >= 4 ? "... " : ".".repeat(glyphLimit);
  const tailCapacity = Math.max(0, glyphLimit - omissionPrefix.length);
  const tail = tailCapacity > 0 ? normalized.slice(-tailCapacity) : "";
  return [
    ...wrapped.slice(0, maxVisibleLines - 1),
    `${omissionPrefix}${tail}`,
  ];
}

function buildPngBytes(input: DogIdPngArtifactInput): Uint8Array {
  const width = 520;
  const safeTitle = printableAscii(input.title, "Dog ID", PDF_TITLE_MAX_CHARS);
  const titleLines = wrapDogIdCanvasText(safeTitle, 24, DOG_ID_TITLE_MAX_VISIBLE_LINES);
  const visibleFields = input.lines
    .slice(0, DOG_ID_MAX_VISIBLE_FIELDS)
    .map((line) => printableAscii(line, "", DOG_ID_FIELD_MAX_CHARS));
  const bodyLines = visibleFields.flatMap((line, sourceIndex) =>
    wrapDogIdCanvasText(
      line,
      DOG_ID_BODY_CANVAS_GLYPH_LIMIT,
      DOG_ID_BODY_MAX_VISIBLE_LINES_PER_FIELD,
    ).map((text) => ({ sourceIndex, text })),
  );
  if (input.lines.length > visibleFields.length) {
    bodyLines.push({
      sourceIndex: visibleFields.length,
      text: `... ${input.lines.length - visibleFields.length} MORE FIELDS IN METADATA`,
    });
  }
  const metadataSourceLines = input.lines.length <= DOG_ID_METADATA_MAX_FIELDS
    ? [...input.lines]
    : [
        ...input.lines.slice(0, DOG_ID_METADATA_MAX_FIELDS - 1),
        input.lines[input.lines.length - 1] ?? "",
      ];
  const metadataDescription = metadataSourceLines
    .map((line) => printableAscii(line, "", DOG_ID_METADATA_FIELD_MAX_CHARS))
    .join(" | ");
  const titleLineHeight = 21;
  const bodyLineHeight = 21;
  const headerExtraHeight = Math.max(0, titleLines.length - 1) * titleLineHeight;
  const bodyStartY = 142 + headerExtraHeight;
  const finalBodyGlyphBottom = bodyStartY + Math.max(0, bodyLines.length - 1) * bodyLineHeight + 14;
  const height = Math.max(300, finalBodyGlyphBottom + 18);
  const pixels = new Uint8Array(width * height * 4);
  const cream = [247, 245, 241, 255];
  const white = [255, 255, 255, 255];
  const navy = [26, 35, 50, 255];
  const copper = [200, 122, 58, 255];
  const ink = [26, 35, 50, 255];
  const muted = [95, 111, 99, 255];
  fillRect(pixels, width, height, 0, 0, width, height, cream);
  fillRect(pixels, width, height, 20, 20, width - 40, height - 40, white);
  fillRect(pixels, width, height, 20, 20, width - 40, 72 + headerExtraHeight, navy);
  fillRect(pixels, width, height, 20, 92 + headerExtraHeight, width - 40, 4, copper);
  titleLines.forEach((line, index) => {
    drawText(pixels, width, height, 42, 42 + index * titleLineHeight, line, white, 3);
  });
  drawText(pixels, width, height, 42, 118 + headerExtraHeight, "WOOFWATCHER DOG ID", copper, 2);
  bodyLines.forEach((line, index) => {
    drawText(
      pixels,
      width,
      height,
      42,
      bodyStartY + index * bodyLineHeight,
      line.text,
      line.sourceIndex === 0 ? ink : muted,
      2,
    );
  });

  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let row = 0; row < height; row += 1) {
    const rawOffset = row * (width * 4 + 1);
    raw[rawOffset] = 0;
    raw.set(pixels.subarray(row * width * 4, (row + 1) * width * 4), rawOffset + 1);
  }

  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return concatBytes([
    Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("tEXt", textChunk("Title", safeTitle)),
    pngChunk("tEXt", textChunk("Description", metadataDescription)),
    pngChunk("IDAT", zlibStored(raw)),
    pngChunk("IEND", new Uint8Array()),
  ]);
}

export function buildCarePassPdfArtifactSource(input: CarePassPdfArtifactInput): GeneratedBinaryArtifactSource {
  const bytes = buildPdfBytes(input);
  return {
    fileName: normalizeGeneratedBinaryFileName(input.fileName, ".pdf"),
    mimeType: "application/pdf",
    formatLabel: "Generated PDF",
    encoding: "base64",
    contentBase64: bytesToBase64(bytes),
    byteSize: bytes.length,
    boundary: PDF_BOUNDARY,
  };
}

export function buildDogIdPngArtifactSource(input: DogIdPngArtifactInput): GeneratedBinaryArtifactSource {
  const bytes = buildPngBytes(input);
  return {
    fileName: normalizeGeneratedBinaryFileName(input.fileName, ".png"),
    mimeType: "image/png",
    formatLabel: "Generated PNG",
    encoding: "base64",
    contentBase64: bytesToBase64(bytes),
    byteSize: bytes.length,
    boundary: PNG_BOUNDARY,
  };
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}

export function buildGeneratedBinaryArtifactFilePlan(
  source: GeneratedBinaryArtifactSource,
  options: GeneratedBinaryArtifactFileOptions,
): GeneratedBinaryArtifactFilePlan {
  const directoryName = normalizeExportDirectoryName(options.directoryName);
  const documentDirectory = typeof options.documentDirectory === "string" && options.documentDirectory.trim().length
    ? withTrailingSlash(options.documentDirectory.trim())
    : null;
  const directoryUri = documentDirectory ? `${documentDirectory}${directoryName}/` : null;
  const fileUri = directoryUri ? `${directoryUri}${source.fileName}` : null;
  const canWriteLocalFile = Boolean(directoryUri && fileUri);
  const fallbackReason = canWriteLocalFile
    ? null
    : "Local file export is unavailable because this runtime does not expose a document directory.";
  const format = source.mimeType === "application/pdf" ? "PDF" : "PNG";
  // The document directory is the app sandbox. It is not the public Files
  // surface, and Android's current text-share fallback cannot attach it.
  const savedMessage = `WoofWatcher local generated ${format} is saved inside WoofWatcher as ${source.fileName} (${source.mimeType}, ${formatBytes(source.byteSize)}). ${source.boundary}`;
  const unavailableMessage = `${fallbackReason} The generated ${format} could not be saved or attached in this runtime (${source.mimeType}, ${formatBytes(source.byteSize)}). ${source.boundary}`;

  return {
    directoryUri,
    fileName: source.fileName,
    fileUri,
    mimeType: source.mimeType,
    formatLabel: source.formatLabel,
    encoding: source.encoding,
    contentBase64: source.contentBase64,
    byteSize: source.byteSize,
    shareTitle: `${options.title} ${source.formatLabel.toLowerCase()}`,
    canWriteLocalFile,
    fallbackReason,
    message: canWriteLocalFile ? savedMessage : unavailableMessage,
  };
}

export function buildGeneratedBinaryArtifactShareContent(
  plan: GeneratedBinaryArtifactFilePlan,
  options: { shareUri?: string | null } = {},
): GeneratedBinaryArtifactShareContent {
  const shareUri = options.shareUri ?? plan.fileUri;
  if (plan.canWriteLocalFile && shareUri) {
    return {
      title: plan.shareTitle,
      message: plan.message,
      url: shareUri,
    };
  }
  return {
    title: plan.shareTitle,
    message: plan.message,
  };
}
