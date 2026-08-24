import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  buildMockupManifestEntries,
  generateMockupManifestSource,
} from "../../mockup-sandbox/mockupManifest.ts";

const sandboxRoot = join(process.cwd(), "artifacts", "mockup-sandbox");
const mockupsRoot = join(sandboxRoot, "src", "components", "mockups");

function discoverMockupFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) return discoverMockupFiles(absolutePath);
    if (!entry.isFile() || !entry.name.endsWith(".tsx")) return [];
    const relativePath = relative(sandboxRoot, absolutePath).split(sep).join("/");
    return relativePath.split("/").some((segment) => segment.startsWith("_"))
      ? []
      : [relativePath];
  });
}

test("mockup manifest generation is byte-stable across discovery order", () => {
  const discovered = discoverMockupFiles(mockupsRoot);
  const reverseDiscoveryOrder = [...discovered].reverse();
  const entries = buildMockupManifestEntries(discovered);

  const expected = generateMockupManifestSource(entries);
  const fromReverseOrder = generateMockupManifestSource(
    buildMockupManifestEntries(reverseDiscoveryOrder),
  );

  assert.equal(fromReverseOrder, expected);
  assert.deepEqual(
    reverseDiscoveryOrder,
    [...discovered].reverse(),
    "sorting the manifest must not mutate the discovery result",
  );
  assert.equal(
    readFileSync(
      join(sandboxRoot, "src", ".generated", "mockup-components.ts"),
      "utf8",
    ),
    expected,
    "the committed generated module must match deterministic generation",
  );
  assert.equal(
    readFileSync(join(sandboxRoot, "mockupPreviewPlugin.ts"), "utf8").includes(
      "return buildMockupManifestEntries(files);",
    ),
    true,
    "the build plugin must route arbitrary fast-glob order through the sorter",
  );
});
