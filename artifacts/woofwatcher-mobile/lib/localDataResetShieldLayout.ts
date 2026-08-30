const DEFAULT_VIEWPORT_HEIGHT = 667;
const COMPACT_VIEWPORT_HEIGHT = 600;
const LARGE_TEXT_SCALE = 1.3;
const COMPACT_VERTICAL_GUTTER = 12;
const REGULAR_VERTICAL_GUTTER = 24;

export interface LocalDataResetShieldLayoutInput {
  viewportHeight: number;
  fontScale: number;
}

export interface LocalDataResetShieldLayout {
  outerPaddingVertical: number;
  maxCardHeight: number;
}

function normalizedPositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getLocalDataResetShieldLayout(
  input: LocalDataResetShieldLayoutInput,
): LocalDataResetShieldLayout {
  const viewportHeight = normalizedPositive(
    input.viewportHeight,
    DEFAULT_VIEWPORT_HEIGHT,
  );
  const fontScale = normalizedPositive(input.fontScale, 1);
  const compact =
    viewportHeight < COMPACT_VIEWPORT_HEIGHT || fontScale >= LARGE_TEXT_SCALE;
  const outerPaddingVertical = compact
    ? COMPACT_VERTICAL_GUTTER
    : REGULAR_VERTICAL_GUTTER;

  return {
    outerPaddingVertical,
    maxCardHeight: Math.max(0, viewportHeight - outerPaddingVertical * 2),
  };
}
