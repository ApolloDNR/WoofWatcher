export interface PrivacyConfirmationLayoutInput {
  viewportHeight: number;
  topInset: number;
  fontScale: number;
}

export interface PrivacyConfirmationLayout {
  maxHeight: number;
  stackActions: boolean;
}

export function derivePrivacyConfirmationLayout({
  viewportHeight,
  topInset,
  fontScale,
}: PrivacyConfirmationLayoutInput): PrivacyConfirmationLayout {
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return { maxHeight: 280, stackActions: false };
  }

  const normalizedInset = Number.isFinite(topInset)
    ? Math.max(0, topInset)
    : 0;
  const normalizedFontScale = Number.isFinite(fontScale) && fontScale > 0
    ? fontScale
    : 1;
  const stackActions = normalizedFontScale >= 1.4;
  const safeHeight = Math.max(0, viewportHeight - Math.max(12, normalizedInset));
  const viewportRatio = stackActions ? 0.94 : 0.9;

  return {
    maxHeight: Math.floor(Math.min(safeHeight, viewportHeight * viewportRatio)),
    stackActions,
  };
}
