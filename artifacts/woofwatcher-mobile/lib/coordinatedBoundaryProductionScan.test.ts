import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

const mobileRoot = join(process.cwd(), "artifacts", "woofwatcher-mobile");

function productionFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return productionFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) &&
      !/\.test\.(?:ts|tsx)$/.test(entry.name)
      ? [path]
      : [];
  });
}

test("production screens and contexts have no coordinated-boundary bypasses", () => {
  const files = ["app", "components", "context"].flatMap((directory) =>
    productionFiles(join(mobileRoot, directory)),
  );
  const forbidden =
    /FileSystem\.(?:makeDirectoryAsync|writeAsStringAsync|getContentUriAsync|deleteAsync)|Share\.share|\beraseAllLocalData\b|persistPickedMedia\(\s*\{[\s\S]{0,500}?fileSystem:\s*FileSystem|Promise\.all\(\[[^\]]*(?:clearAvatarSet|resetAvatarConfig)/;
  const matches = files.flatMap((path) => {
    const source = readFileSync(path, "utf8");
    return forbidden.test(source)
      ? [relative(mobileRoot, path).replaceAll("\\", "/")]
      : [];
  });
  assert.deepEqual(matches, []);
});

test("Privacy uses root operations and Avatar Studio keeps its legitimate config reset", () => {
  const privacy = readFileSync(
    join(mobileRoot, "components", "more", "PrivacyDataScreen.tsx"),
    "utf8",
  );
  const studio = readFileSync(
    join(mobileRoot, "components", "more", "AvatarStudioScreen.tsx"),
    "utf8",
  );
  assert.match(privacy, /useLocalDataReset\(\)/);
  assert.match(privacy, /runPrivacyCareDataExport\(/);
  assert.match(privacy, /runPrivacyLocalDataReset\(runReset\)/);
  assert.doesNotMatch(
    privacy,
    /clearAvatarSet|resetAvatarConfig|eraseAllLocalData/,
  );
  assert.match(studio, /resetAvatarConfig/);
});
