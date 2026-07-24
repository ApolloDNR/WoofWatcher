const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const SMOKE_SOURCE_PROVENANCE_SCHEMA_VERSION = 1;
const IGNORED_DIRECTORY_NAMES = new Set([
  ".expo",
  ".expo-smoke",
  ".git",
  "dist",
  "node_modules",
  "tmp",
]);

function collectFiles(root) {
  if (!fs.existsSync(root)) return [];
  const stat = fs.statSync(root);
  if (stat.isFile()) return [root];
  if (!stat.isDirectory()) return [];

  return fs
    .readdirSync(root, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      if (entry.isDirectory() && IGNORED_DIRECTORY_NAMES.has(entry.name)) {
        return [];
      }
      if (entry.isFile() && entry.name.endsWith(".tsbuildinfo")) {
        return [];
      }
      const target = path.join(root, entry.name);
      if (entry.isDirectory()) return collectFiles(target);
      return entry.isFile() ? [target] : [];
    });
}

function resolveSourceInputs(projectRoot) {
  const workspaceRoot = path.resolve(projectRoot, "..", "..");
  const candidates = [
    { label: "mobile", target: projectRoot },
    {
      label: "workspace/api-client-react",
      target: path.join(workspaceRoot, "lib", "api-client-react"),
    },
    {
      label: "workspace/care-domain",
      target: path.join(workspaceRoot, "lib", "care-domain"),
    },
    {
      label: "workspace/package.json",
      target: path.join(workspaceRoot, "package.json"),
    },
    {
      label: "workspace/pnpm-lock.yaml",
      target: path.join(workspaceRoot, "pnpm-lock.yaml"),
    },
  ];

  return candidates.filter(({ target }) => fs.existsSync(target));
}

function createSmokeSourceFingerprint(projectRoot) {
  const hash = crypto.createHash("sha256");

  for (const { label, target } of resolveSourceInputs(projectRoot)) {
    const stat = fs.statSync(target);
    const files = stat.isFile() ? [target] : collectFiles(target);
    for (const file of files) {
      const relative = stat.isFile()
        ? path.basename(file)
        : path.relative(target, file);
      hash.update(`${label}/${relative.split(path.sep).join("/")}\0`);
      hash.update(fs.readFileSync(file));
      hash.update("\0");
    }
  }

  return hash.digest("hex");
}

function createSmokeSourceProvenance(sourceFingerprint) {
  return {
    schemaVersion: SMOKE_SOURCE_PROVENANCE_SCHEMA_VERSION,
    sourceFingerprint,
  };
}

function validateSmokeSourceProvenance(provenance, currentFingerprint) {
  if (
    !provenance ||
    typeof provenance !== "object" ||
    provenance.schemaVersion !== SMOKE_SOURCE_PROVENANCE_SCHEMA_VERSION ||
    typeof provenance.sourceFingerprint !== "string"
  ) {
    throw new Error(
      "Missing Expo smoke source provenance. Run pnpm --filter @workspace/woofwatcher-mobile run smoke:web before smoke:runtime.",
    );
  }

  if (provenance.sourceFingerprint !== currentFingerprint) {
    throw new Error(
      "Stale Expo smoke export detected. Run pnpm --filter @workspace/woofwatcher-mobile run smoke:web before smoke:runtime.",
    );
  }
}

module.exports = {
  SMOKE_SOURCE_PROVENANCE_SCHEMA_VERSION,
  createSmokeSourceFingerprint,
  createSmokeSourceProvenance,
  validateSmokeSourceProvenance,
};
