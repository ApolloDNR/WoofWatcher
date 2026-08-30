import manifestData from "./universalNavigationManifest.json" with { type: "json" };

import type {
  HealthSection,
  MoreSection,
  PrimaryTab,
} from "./navigationOwnership.ts";

export type UniversalPrimaryTabManifest = readonly [
  Readonly<{ name: "index"; label: "Home"; parent: "home"; route: "/" }>,
  Readonly<{ name: "log"; label: "Log"; parent: "log"; route: "/log" }>,
  Readonly<{ name: "calendar"; label: "Plans"; parent: "plans"; route: "/calendar" }>,
  Readonly<{ name: "health"; label: "Health"; parent: "health"; route: "/health" }>,
  Readonly<{ name: "more"; label: "More"; parent: "more"; route: "/more" }>,
];

export interface UniversalCanonicalChild {
  readonly parent: "health" | "more";
  readonly section: HealthSection | Exclude<MoreSection, "root">;
  readonly label: string;
  readonly route: string;
}

export interface UniversalLegacyRedirect {
  readonly route: string;
  readonly canonicalRoute: string;
  readonly parent: PrimaryTab;
  readonly required: boolean;
}

export interface UniversalLegacyAlias {
  readonly route: string;
  readonly canonicalRoute: string;
  readonly parent: PrimaryTab;
}

export interface UniversalNavigationManifest {
  readonly version: 1;
  readonly primaryTabs: UniversalPrimaryTabManifest;
  readonly canonicalChildren: readonly UniversalCanonicalChild[];
  readonly legacyRedirects: readonly UniversalLegacyRedirect[];
  readonly legacyAliases: readonly UniversalLegacyAlias[];
  readonly runtimeSupplementalRoutes: readonly string[];
  readonly livePreviewSupplementalRoutes: readonly string[];
}

export const UNIVERSAL_NAVIGATION_MANIFEST =
  manifestData as unknown as UniversalNavigationManifest;

export const UNIVERSAL_PRIMARY_TAB_MODELS =
  UNIVERSAL_NAVIGATION_MANIFEST.primaryTabs.map(({ name, label, parent }) => ({
    name,
    label,
    parent,
  })) as unknown as readonly [
    Readonly<{ name: "index"; label: "Home"; parent: "home" }>,
    Readonly<{ name: "log"; label: "Log"; parent: "log" }>,
    Readonly<{ name: "calendar"; label: "Plans"; parent: "plans" }>,
    Readonly<{ name: "health"; label: "Health"; parent: "health" }>,
    Readonly<{ name: "more"; label: "More"; parent: "more" }>,
  ];

export function findUniversalPrimaryTab(
  name: UniversalPrimaryTabManifest[number]["name"],
): UniversalPrimaryTabManifest[number] {
  const tab = UNIVERSAL_NAVIGATION_MANIFEST.primaryTabs.find(
    (item) => item.name === name,
  );
  if (!tab) {
    throw new Error(`Missing universal navigation tab: ${name}`);
  }
  return tab;
}

export function findUniversalCanonicalChild(
  parent: "health" | "more",
  section: HealthSection | Exclude<MoreSection, "root">,
): UniversalCanonicalChild {
  const child = UNIVERSAL_NAVIGATION_MANIFEST.canonicalChildren.find(
    (item) => item.parent === parent && item.section === section,
  );
  if (!child) {
    throw new Error(`Missing universal navigation child: ${parent}/${section}`);
  }
  return child;
}
