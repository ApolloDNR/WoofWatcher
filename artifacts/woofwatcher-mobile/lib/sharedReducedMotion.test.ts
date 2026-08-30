import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import test from "node:test";

const board = readFileSync(
  new URL("../components/board/BoardPrimitives.tsx", import.meta.url),
  "utf8",
);
const home = readFileSync(
  new URL("../app/(tabs)/index.tsx", import.meta.url),
  "utf8",
);

const MOBILE_ROOT = new URL("../", import.meta.url);

function productionTsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionTsxFiles(path);
    return extname(entry.name) === ".tsx" ? [path] : [];
  });
}

test("shared BoardCard entrances and direct Home entrances honor reduced motion", () => {
  const boardCard = board.match(
    /export function BoardCard\([\s\S]*?\n}\n\nexport function BoardSectionHeader/,
  )?.[0];
  assert.ok(boardCard, "BoardCard must remain statically inspectable");
  assert.match(boardCard, /const reducedMotion = useReducedMotion\(\)/);
  assert.match(
    boardCard,
    /entering=\{reducedMotion \? undefined : enterUp\(enter\)\}/,
  );

  assert.equal(
    [...home.matchAll(/entering=\{reducedMotion \? undefined : enterUp\((?:0|1)\)\}/g)]
      .length,
    2,
    "both direct Home entrance wrappers must become static under reduced motion",
  );
  assert.doesNotMatch(home, /entering=\{enterUp\((?:0|1)\)\}/);
});

test("no production screen bypasses Reduce Motion with a direct enterUp transition", () => {
  const mobileRootPath = MOBILE_ROOT.pathname;
  const unguardedEntrances = ["app", "components"]
    .flatMap((directory) => productionTsxFiles(join(mobileRootPath, directory)))
    .flatMap((path) => {
      const source = readFileSync(path, "utf8");
      return Array.from(
        source.matchAll(/entering=\{enterUp\(/g),
        (match) => `${relative(mobileRootPath, path)}:${source.slice(0, match.index).split("\n").length}`,
      );
    });

  assert.deepEqual(
    unguardedEntrances,
    [],
    "direct enterUp transitions must be disabled when Reduce Motion is enabled",
  );
});

test("every production Modal with a visible transition honors Reduce Motion", () => {
  const mobileRootPath = MOBILE_ROOT.pathname;
  const hardcodedTransitions = ["app", "components"]
    .flatMap((directory) => productionTsxFiles(join(mobileRootPath, directory)))
    .flatMap((path) => {
      const source = readFileSync(path, "utf8");
      return Array.from(
        source.matchAll(/animationType\s*=\s*["'](?:slide|fade)["']/g),
        (match) => `${relative(mobileRootPath, path)}:${source.slice(0, match.index).split("\n").length}`,
      );
    });

  assert.deepEqual(
    hardcodedTransitions,
    [],
    "visible Modal transitions must resolve to none when Reduce Motion is enabled",
  );
});
