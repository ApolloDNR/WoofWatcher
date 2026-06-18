const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function usage() {
  console.log(`Usage:
node scripts/fetch-pixellab-output.js --out assets/avatar/phoenix/candidates --file candidate-a.png=https://...

Options:
  --out <dir>        Output directory relative to artifacts/woofwatcher-mobile.
  --file <name=url>  Download one file. Repeat for multiple files.
`);
}

function parseArgs(argv) {
  const result = { out: "", files: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--out") {
      result.out = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (arg === "--file") {
      result.files.push(argv[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    }
  }

  return result;
}

function sanitizeFileName(fileName) {
  if (!fileName || fileName.includes("..") || path.isAbsolute(fileName)) {
    throw new Error(`Unsafe file name: ${fileName}`);
  }
  return fileName.replace(/[\\/:*?"<>|]/g, "-");
}

async function download(fileName, url, outDir) {
  const safeName = sanitizeFileName(fileName);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${safeName}: ${response.status} ${response.statusText}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const target = path.join(outDir, safeName);
  fs.writeFileSync(target, bytes);
  console.log(`Saved ${path.relative(root, target)} (${bytes.length} bytes)`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.out || args.files.length === 0) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  const outDir = path.resolve(root, args.out);
  if (!outDir.startsWith(root)) {
    throw new Error(`Output must stay inside ${root}`);
  }
  fs.mkdirSync(outDir, { recursive: true });

  for (const pair of args.files) {
    const separator = pair.indexOf("=");
    if (separator === -1) throw new Error(`Expected --file name=url, got: ${pair}`);

    const fileName = pair.slice(0, separator);
    const url = pair.slice(separator + 1);
    await download(fileName, url, outDir);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
