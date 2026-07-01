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
  todayCommandPeekPx: number;
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

function estimateTodayCommandPeek(input: {
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
}): number {
  const contentWidth = Math.max(288, input.width - 32);
  const appHeaderBlock = 58;
  const heroStageHeight = contentWidth / input.heroAspectRatio;
  const heroBlock = input.heroHeaderMinHeight + heroStageHeight;
  const presenceBlock =
    Math.max(0, input.presencePanelMinHeight - input.presencePanelOverlap) +
    input.presencePanelMarginBottom;
  const careStatusHeader = 42;
  const careStatusPadding = 28;
  const careStatusBlock =
    careStatusHeader + input.statusTileMinHeight + careStatusPadding;
  const todayCommandTop =
    input.topPadding +
    appHeaderBlock +
    heroBlock +
    presenceBlock +
    careStatusBlock;
  const bottomChromeTop = input.height - input.bottomChromeClearance;

  return Math.max(0, Math.round(bottomChromeTop - todayCommandTop));
}

export function getHomeFirstScreenLayout(input: HomeFirstScreenLayoutInput): HomeFirstScreenLayout {
  const width = normalizeDimension(input.width, 390);
  const height = normalizeDimension(input.height, 844);
  const shortScreen = height < 820;
  const narrow = width < 390;
  const showcase = width >= 414 && height >= 880;
  const density: HomeFirstScreenDensity = narrow || shortScreen ? "compact" : showcase ? "showcase" : "balanced";

  const heroAspectRatio = density === "compact" ? 1.58 : density === "showcase" ? 1.44 : 1.52;
  const heroHeaderMinHeight = density === "showcase" ? 52 : 50;
  const heroHeaderVerticalPadding = 8;
  const heroStudioButtonWidth = density === "compact" ? 98 : density === "showcase" ? 108 : 104;
  const heroStudioButtonMinHeight = 48;
  const presencePanelMinHeight = 48;
  const presencePanelOverlap = density === "compact" ? 18 : density === "showcase" ? 22 : 20;
  const presencePanelMarginBottom = 8;
  const statusTileMinHeight = density === "compact" ? 58 : density === "showcase" ? 66 : 62;
  const statusTileIconBoxSize = density === "compact" ? 28 : 30;
  const statusTileIconSize = density === "compact" ? 21 : 22;
  const statusTileGap = density === "compact" ? 6 : 8;
  const statusTileMarginBottom = 8;
  const todayCommandPeekPx = estimateTodayCommandPeek({
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
  });
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
    todayCommandPeekPx,
    firstMissionPeekPx,
    qaLabel: `${density} mockup-accurate Phoenix Home; Today Command peek ${todayCommandPeekPx}px; mission peek ${firstMissionPeekPx}px`,
  };
}
