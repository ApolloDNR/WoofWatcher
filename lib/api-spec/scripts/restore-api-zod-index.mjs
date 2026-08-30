import { copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.resolve(
  scriptDir,
  "..",
  "templates",
  "api-zod-index.ts",
);
const publicIndexPath = path.resolve(
  scriptDir,
  "..",
  "..",
  "api-zod",
  "src",
  "index.ts",
);

await copyFile(templatePath, publicIndexPath);
