import type { MoreSection } from "./navigationOwnership.ts";
import { UNIVERSAL_PRIMARY_TAB_MODELS } from "./universalNavigationManifest.ts";

export const UNIVERSAL_PRIMARY_TABS = UNIVERSAL_PRIMARY_TAB_MODELS;

export const UNIVERSAL_COMPATIBILITY_TABS = [
  "pack",
  "story",
  "records",
] as const;

export type UniversalTabName =
  (typeof UNIVERSAL_PRIMARY_TABS)[number]["name"];

export interface UniversalTabPressInput {
  tabName: UniversalTabName;
  focused: boolean;
  pathname: string;
  moreSection: MoreSection;
}

export interface UniversalTabPressEffects {
  preventDefault: () => void;
  replace: (pathname: "/more") => void;
}

export function handleUniversalTabPress(
  input: UniversalTabPressInput,
  effects: UniversalTabPressEffects,
): boolean {
  if (
    input.tabName !== "more" ||
    !input.focused ||
    input.pathname !== "/more" ||
    input.moreSection === "root"
  ) {
    return false;
  }

  effects.preventDefault();
  effects.replace("/more");
  return true;
}
