export const CALENDAR_MONTH_COLUMN_COUNT = 7;
export const CALENDAR_MONTH_DAY_TARGET = 48;

const MIN_SUPPORTED_VIEWPORT = 320;
const DEFAULT_VIEWPORT = 390;
const DEFAULT_PAGE_GUTTER = 16;
const MIN_PAGE_GUTTER = 4;
const DEFAULT_GRID_INSET = 8;
const MIN_GRID_INSET = 1;
const CARD_BORDER_WIDTH = 1;
const MAX_DAY_CELL_SIZE = 52;

export interface CalendarMonthGridLayout {
  viewportWidth: number;
  pageGutter: number;
  gridInset: number;
  cardContentWidth: number;
  cellSize: number;
  gridWidth: number;
  requiresHorizontalScroll: boolean;
}

function normalizeViewportWidth(viewportWidth: number): number {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) {
    return DEFAULT_VIEWPORT;
  }
  return Math.max(MIN_SUPPORTED_VIEWPORT, viewportWidth);
}

/**
 * Preserves seven distinct 48-point day controls. The normal 16-point route
 * gutter and 8-point card inset stay intact on modern phones; compact screens
 * spend decorative space first, then scroll the grid instead of shrinking or
 * overlapping interaction targets.
 */
export function getCalendarMonthGridLayout(
  viewportWidth: number,
): CalendarMonthGridLayout {
  const width = normalizeViewportWidth(viewportWidth);
  const targetGridWidth =
    CALENDAR_MONTH_COLUMN_COUNT * CALENDAR_MONTH_DAY_TARGET;
  const chromeBudget = width - CARD_BORDER_WIDTH * 2 - targetGridWidth;
  const pageGutter = Math.min(
    DEFAULT_PAGE_GUTTER,
    Math.max(
      MIN_PAGE_GUTTER,
      Math.floor((chromeBudget - MIN_GRID_INSET * 2) / 2),
    ),
  );
  const remainingGridInset =
    (width -
      pageGutter * 2 -
      CARD_BORDER_WIDTH * 2 -
      targetGridWidth) /
    2;
  const gridInset = Math.min(
    DEFAULT_GRID_INSET,
    Math.max(MIN_GRID_INSET, remainingGridInset),
  );
  const cardContentWidth =
    width -
    pageGutter * 2 -
    CARD_BORDER_WIDTH * 2 -
    gridInset * 2;
  const cellSize = Math.max(
    CALENDAR_MONTH_DAY_TARGET,
    Math.min(
      MAX_DAY_CELL_SIZE,
      cardContentWidth / CALENDAR_MONTH_COLUMN_COUNT,
    ),
  );
  const gridWidth = cellSize * CALENDAR_MONTH_COLUMN_COUNT;

  return {
    viewportWidth: width,
    pageGutter,
    gridInset,
    cardContentWidth,
    cellSize,
    gridWidth,
    requiresHorizontalScroll: gridWidth - cardContentWidth > 0.01,
  };
}
