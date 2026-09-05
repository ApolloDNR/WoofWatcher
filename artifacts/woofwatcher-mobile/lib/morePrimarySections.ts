export type MorePrimarySection = "career" | "directory";

const CONSUMER_PRIMARY_SECTION_ORDER = ["directory", "career"] as const;
const OWNER_PRIMARY_SECTION_ORDER = ["career", "directory"] as const;

export function getMorePrimarySectionOrder(
  ownerOps: boolean,
): readonly MorePrimarySection[] {
  return ownerOps
    ? OWNER_PRIMARY_SECTION_ORDER
    : CONSUMER_PRIMARY_SECTION_ORDER;
}
