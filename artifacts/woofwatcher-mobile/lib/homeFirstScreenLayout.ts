export type HomeFirstScreenDensity = "compact" | "balanced" | "showcase";

export interface HomeFirstScreenLayoutInput {
  width: number;
  height: number;
  topPadding?: number;
  bottomChromeClearance?: number;
}

export interface HomeFirstScreenLayout {
  density: HomeFirstScreenDensity;
  heroAspectRatio: number;
  heroHeaderMinHeight: number;
  heroHeaderVerticalPadding: number;
  heroStudioButtonWidth: number;
  heroStudioButtonMinHeight: number;
  presencePanelWidthPercent: number;
  presencePanelMinHeight: number;
  presencePanelOverlap: number;
  presencePanelMarginBottom: number;
  statusTileMinHeight: number;
  statusTileIconBoxSize: number;
  statusTileIconSize: number;
  statusTileGap: number;
  statusTileMarginBottom: number;
  firstMissionPeekPx: number;
  qaLabel: string;
}

function normalizeDimension(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function estimateFirstMissionPeek(input: {
  width: number;
  height: number;
  topPadding: number;
  bottomChromeClearance: number;
  heroAspectRatio: number;
  heroHeaderMinHeight: number;
  presencePanelMinHeight: number;
  presencePanelOverlap: number;
  presencePanelMarginBottom: number;
  statusTileMinHeight: number;
  statusTileMarginBottom: number;
}): number {
  const contentWidth = Math.max(288, input.width - 32);
  const appHeaderBlock = 58;
  const heroStageHeight = contentWidth / input.heroAspectRatio;
  const heroBlock = input.heroHeaderMinHeight + heroStageHeight;
  const presenceBlock =
    Math.max(0, input.presencePanelMinHeight - input.presencePanelOverlap) +
    input.presencePanelMarginBottom;
  const statusBlock = input.statusTileMinHeight + input.statusTileMarginBottom;
  const missionTop =
    input.topPadding + appHeaderBlock + heroBlock + presenceBlock + statusBlock;
  const bottomChromeTop = input.height - input.bottomChromeClearance;

  return Math.max(0, Math.round(bottomChromeTop - missionTop));
}

export function getHomeFirstScreenLayout(input: HomeFirstScreenLayoutInput): HomeFirstScreenLayout {
  const width = normalizeDimension(input.width, 390);
  const height = normalizeDimension(input.height, 844);
  const shortScreen = height < 820;
  const narrow = width < 390;
  const showcase = width >= 414 && height >= 880;
  const density: HomeFirstScreenDensity = narrow || shortScreen ? "compact" : showcase ? "showcase" : "balanced";

  const heroAspectRatio = density === "compact" ? 1.32 : density === "showcase" ? 1.2 : 1.24;
  const heroHeaderMinHeight = density === "compact" ? 52 : 54;
  const heroHeaderVerticalPadding = density === "compact" ? 8 : 9;
  const heroStudioButtonWidth = density === "compact" ? 104 : 110;
  const heroStudioButtonMinHeight = 48;
  const presencePanelMinHeight = 48;
  const presencePanelOverlap = density === "compact" ? 24 : 28;
  const presencePanelMarginBottom = density === "compact" ? 8 : 10;
  const statusTileMinHeight = density === "compact" ? 74 : 84;
  const statusTileIconBoxSize = density === "compact" ? 34 : 36;
  const statusTileIconSize = density === "compact" ? 24 : 26;
  const statusTileGap = density === "compact" ? 6 : 8;
  const statusTileMarginBottom = density === "compact" ? 8 : 9;
  const firstMissionPeekPx = estimateFirstMissionPeek({
    width,
    height,
    topPadding: Math.max(0, input.topPadding ?? 32),
    bottomChromeClearance: Math.max(96, input.bottomChromeClearance ?? 102),
    heroAspectRatio,
    heroHeaderMinHeight,
    presencePanelMinHeight,
    presencePanelOverlap,
    presencePanelMarginBottom,
    statusTileMinHeight,
    statusTileMarginBottom,
  });

  return {
    density,
    heroAspectRatio,
    heroHeaderMinHeight,
    heroHeaderVerticalPadding,
    heroStudioButtonWidth,
    heroStudioButtonMinHeight,
    presencePanelWidthPercent: density === "compact" ? 90 : 86,
    presencePanelMinHeight,
    presencePanelOverlap,
    presencePanelMarginBottom,
    statusTileMinHeight,
    statusTileIconBoxSize,
    statusTileIconSize,
    statusTileGap,
    statusTileMarginBottom,
    firstMissionPeekPx,
    qaLabel: `${density} mockup-accurate Phoenix Home; mission peek ${firstMissionPeekPx}px`,
  };
}
