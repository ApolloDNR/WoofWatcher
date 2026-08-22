import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

const mobileRoot = join(process.cwd(), "artifacts", "woofwatcher-mobile");

function productionTypeScriptFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "node_modules" ? [] : productionTypeScriptFiles(path);
    }
    return /\.(?:ts|tsx)$/.test(entry.name) && !/\.test\.(?:ts|tsx)$/.test(entry.name)
      ? [path]
      : [];
  });
}

function importedHookBindings(source: string): string[] {
  const hooks = new Set<string>();
  const imports = source.matchAll(
    /import\s*\{([^}]*)\}\s*from\s*["'](?:@tanstack\/react-query|@workspace\/api-client-react)["']/g,
  );
  for (const imported of imports) {
    for (const rawBinding of imported[1]!.split(",")) {
      const binding = rawBinding
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)
        .at(-1);
      if (!binding || binding === "useQueryClient" || !/^use[A-Z]/.test(binding)) {
        continue;
      }
      if (new RegExp(`\\b${binding}\\s*\\(`).test(source.slice(imported.index! + imported[0].length))) {
        hooks.add(binding);
      }
    }
  }
  return [...hooks].sort();
}

test("personal API query hooks stay inside AppFrame screen content", () => {
  const locations = productionTypeScriptFiles(mobileRoot)
    .flatMap((path) => {
      const hooks = importedHookBindings(readFileSync(path, "utf8"));
      return hooks.map((hook) => ({
        path: relative(mobileRoot, path).replaceAll("\\", "/"),
        hook,
      }));
    })
    .sort((left, right) =>
      `${left.path}:${left.hook}`.localeCompare(`${right.path}:${right.hook}`),
    );

  assert.deepEqual(locations, [
    { path: "app/(tabs)/log.tsx", hook: "useGetMe" },
    { path: "app/(tabs)/more.tsx", hook: "useGetMe" },
    {
      path: "components/more/CareTeamSuppliesScreen.tsx",
      hook: "useGetMe",
    },
    {
      path: "components/more/CareTeamSuppliesScreen.tsx",
      hook: "useJoinHousehold",
    },
    {
      path: "components/more/CareTeamSuppliesScreen.tsx",
      hook: "useUpdateHousehold",
    },
    {
      path: "components/more/CareTeamSuppliesScreen.tsx",
      hook: "useUpdateMe",
    },
    { path: "components/more/PrivacyDataScreen.tsx", hook: "useGetMe" },
  ]);
  assert.ok(
    locations.every(
      ({ path }) => path.startsWith("app/") || path.startsWith("components/"),
    ),
    "personal query consumers must remain below the shipping AppFrame shield",
  );
});
