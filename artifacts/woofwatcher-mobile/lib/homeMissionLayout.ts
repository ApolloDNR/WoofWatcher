export type HomeMissionDeckDensity = "compact" | "regular";

export interface HomeMissionDeckLayoutInput {
  width: number;
  missionCount?: number;
}

export interface HomeMissionDeckLayout {
  density: HomeMissionDeckDensity;
  showBadge: boolean;
  deckPadding: number;
  headerGap: number;
  rowGap: number;
  rowMinHeight: number;
  rowPaddingHorizontal: number;
  rowPaddingVertical: number;
  iconBoxSize: number;
  iconSize: number;
  detailLines: number;
  ctaMinHeight: number;
  ctaMaxWidth: number;
  ctaTextMaxWidth: number;
  estimatedDeckHeight: number;
  qaLabel: string;
}

function normalizeWidth(width: number): number {
  return Number.isFinite(width) && width > 0 ? width : 390;
}

export function getHomeMissionDeckLayout(input: HomeMissionDeckLayoutInput): HomeMissionDeckLayout {
  const width = normalizeWidth(input.width);
  const missionCount = Math.max(0, Math.round(input.missionCount ?? 4));
  const compact = width < 390;
  const deckPadding = compact ? 10 : 12;
  const headerHeight = compact ? 40 : 44;
  const headerGap = compact ? 8 : 10;
  const rowGap = compact ? 6 : 8;
  const rowMinHeight = compact ? 58 : 72;
  const estimatedDeckHeight =
    deckPadding * 2 +
    headerHeight +
    headerGap +
    missionCount * rowMinHeight +
    Math.max(0, missionCount - 1) * rowGap;

  return {
    density: compact ? "compact" : "regular",
    showBadge: !compact,
    deckPadding,
    headerGap,
    rowGap,
    rowMinHeight,
    rowPaddingHorizontal: compact ? 8 : 10,
    rowPaddingVertical: compact ? 7 : 9,
    iconBoxSize: compact ? 36 : 40,
    iconSize: compact ? 22 : 25,
    detailLines: compact ? 1 : 2,
    ctaMinHeight: compact ? 32 : 34,
    ctaMaxWidth: compact ? 72 : 82,
    ctaTextMaxWidth: compact ? 48 : 58,
    estimatedDeckHeight,
    qaLabel: compact
      ? `Small-phone compact mission deck, estimated ${estimatedDeckHeight}px`
      : `regular mission deck, estimated ${estimatedDeckHeight}px`,
  };
}
