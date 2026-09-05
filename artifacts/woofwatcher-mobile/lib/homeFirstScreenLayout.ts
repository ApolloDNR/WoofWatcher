export type HomeFirstScreenDensity = "compact" | "balanced" | "showcase";

export interface HomeFirstScreenLayoutInput {
  width: number;
  height: number;
  topPadding?: number;
  bottomChromeClearance?: number;
}

export interface HomeFirstScreenLayout {
  density: HomeFirstScreenDensity;
  routeHorizontalPadding: number;
  heroStageWidth: number;
  contentMinHeight: number;
  heroAspectRatio: number;
  heroStudioButtonMinHeight: number;
  presencePanelMinHeight: number;
  qaLabel: string;
}

function normalizeDimension(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getHomeFirstScreenLayout(
  input: HomeFirstScreenLayoutInput,
): HomeFirstScreenLayout {
  const width = normalizeDimension(input.width, 390);
  const height = normalizeDimension(input.height, 844);
  const shortScreen = height < 820;
  const narrow = width < 390;
  const showcase = width >= 414 && height >= 880;
  const density: HomeFirstScreenDensity =
    narrow || shortScreen ? "compact" : showcase ? "showcase" : "balanced";
  const routeHorizontalPadding = 16;

  return {
    density,
    routeHorizontalPadding,
    heroStageWidth: Math.max(0, width - routeHorizontalPadding * 2),
    contentMinHeight: height,
    heroAspectRatio:
      density === "compact" ? 1.58 : density === "showcase" ? 1.44 : 1.52,
    heroStudioButtonMinHeight: 48,
    presencePanelMinHeight: 48,
    qaLabel: `${density} Phoenix Home room shell; runtime-measured navigation clearance required`,
  };
}
