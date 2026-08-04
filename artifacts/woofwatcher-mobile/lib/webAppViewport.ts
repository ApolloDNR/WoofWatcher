export interface WebAppViewportInput {
  width: number;
  height: number;
}

export interface WebAppViewport {
  width: number;
  height: number;
  framed: boolean;
}

const PHONE_FRAME_WIDTH = 390;
const PHONE_FRAME_MAX_HEIGHT = 932;
const COMPACT_PREVIEW_MAX_WIDTH = 520;

function positiveDimension(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function resolveWebAppViewport(
  input: WebAppViewportInput,
): WebAppViewport {
  const width = positiveDimension(input.width, PHONE_FRAME_WIDTH);
  const height = positiveDimension(input.height, 844);

  if (width > COMPACT_PREVIEW_MAX_WIDTH) {
    return {
      width: Math.min(width, PHONE_FRAME_WIDTH),
      height: Math.min(height, PHONE_FRAME_MAX_HEIGHT),
      framed: true,
    };
  }

  return { width, height, framed: false };
}
