export function getHomeFixedHeroTop(input: {
  topPadding: number;
  spacerY: number;
  welcomeCardHeight?: number;
  welcomeCollapsed?: boolean;
}): number {
  const welcomeCardHeight = Math.max(0, input.welcomeCardHeight ?? 0);

  // During a settled collapsed layout, rebuild the expanded baseline from
  // the spacer's collapsed coordinate. The UI-thread transform below remains
  // the only owner of movement during the animation itself.
  return (
    input.topPadding +
    input.spacerY +
    (input.welcomeCollapsed ? welcomeCardHeight : 0)
  );
}

export function shouldHoldHomeFixedHeroTop(input: {
  welcomeWasShown: boolean;
  welcomeShouldShow: boolean;
  welcomeCollapsed: boolean;
}): boolean {
  return (
    input.welcomeWasShown &&
    !input.welcomeShouldShow &&
    !input.welcomeCollapsed
  );
}

export function getHomeFixedHeroCollapseOffset(input: {
  welcomeCardHeight: number;
  welcomeCollapse: number;
}): number {
  "worklet";
  const welcomeCardHeight = Math.max(0, input.welcomeCardHeight);
  const welcomeCollapse = Math.max(0, Math.min(1, input.welcomeCollapse));
  const offset = -welcomeCardHeight * (1 - welcomeCollapse);
  // Normalize -0 so geometry assertions and DOM measurements stay stable.
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
