export function getHomeFixedHeroTop(input: {
  topPadding: number;
  spacerY: number;
  welcomeCardHeight?: number;
  welcomeCollapse?: number;
}): number {
  const welcomeCardHeight = Math.max(0, input.welcomeCardHeight ?? 0);
  const welcomeCollapse = Math.max(
    0,
    Math.min(1, input.welcomeCollapse ?? 1),
  );
  const collapsedWelcomeHeight =
    welcomeCardHeight * (1 - welcomeCollapse);

  // The spacer already moves as the welcome card folds. Store the fixed
  // layer's expanded baseline here so the animated collapse transform below
  // is the only movement that reaches the painted room.
  return input.topPadding + input.spacerY + collapsedWelcomeHeight;
}

export function getHomeFixedHeroCollapseOffset(input: {
  welcomeCardHeight: number;
  welcomeCollapse: number;
}): number {
  "worklet";
  const welcomeCardHeight = Math.max(0, input.welcomeCardHeight);
  const welcomeCollapse = Math.max(0, Math.min(1, input.welcomeCollapse));
  const offset = -welcomeCardHeight * (1 - welcomeCollapse);
  return offset === 0 ? 0 : offset;
}

export function resolveHomeWelcomeCardHeight(input: {
  currentHeight: number;
  measuredHeight: number;
  welcomeShouldShow: boolean;
}): number {
  if (
    !input.welcomeShouldShow ||
    !Number.isFinite(input.measuredHeight) ||
    input.measuredHeight <= 0
  ) {
    return input.currentHeight;
  }

  return Math.round(input.measuredHeight);
}

export function resolveHomeWelcomeCardMaxHeight(input: {
  naturalHeight: number;
  welcomeCollapse: number;
  welcomeShouldShow: boolean;
}): number | undefined {
  "worklet";
  // While fully expanded, maxHeight must stay unset. Otherwise a card that
  // grew after a responsive resize would remain trapped at its old height
  // and could never report the new natural measurement.
  if (input.welcomeShouldShow || input.naturalHeight <= 0) return undefined;

  const welcomeCollapse = Math.max(0, Math.min(1, input.welcomeCollapse));
  return input.naturalHeight * welcomeCollapse;
}
