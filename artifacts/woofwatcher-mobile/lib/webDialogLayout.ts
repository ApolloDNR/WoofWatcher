const WEB_DIALOG_VIEWPORT_GUTTER = 24;
const WEB_DIALOG_MOBILE_WIDTH = 390;
const WEB_DIALOG_LARGE_TEXT_SCALE = 1.2;

export interface WebDialogViewport {
  width: number;
  height: number;
  fontScale: number;
}

export interface WebDialogLayout {
  maxCardHeight: number;
  stackActions: boolean;
}

export function deriveWebDialogLayout({
  width,
  height,
  fontScale,
}: WebDialogViewport): WebDialogLayout {
  const viewportWidth = Number.isFinite(width) ? Math.max(0, width) : 0;
  const viewportHeight = Number.isFinite(height) ? Math.max(0, height) : 0;
  const textScale = Number.isFinite(fontScale) ? Math.max(1, fontScale) : 1;

  return {
    maxCardHeight: Math.max(
      0,
      viewportHeight - WEB_DIALOG_VIEWPORT_GUTTER * 2,
    ),
    stackActions:
      viewportWidth <= WEB_DIALOG_MOBILE_WIDTH ||
      textScale >= WEB_DIALOG_LARGE_TEXT_SCALE,
  };
}
