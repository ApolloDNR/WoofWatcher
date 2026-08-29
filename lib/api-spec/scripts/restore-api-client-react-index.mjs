import { copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.resolve(
  scriptDir,
  "..",
  "templates",
  "api-client-react-index.ts",
);
const publicIndexPath = path.resolve(
  scriptDir,
  "..",
  "..",
  "api-client-react",
  "src",
  "index.ts",
);

await copyFile(templatePath, publicIndexPath);
