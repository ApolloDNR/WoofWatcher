export function getHomeFixedHeroTop(input: {
  topPadding: number;
  spacerY: number;
}): number {
  return Math.round(input.topPadding + input.spacerY);
}

export function getHomeFixedHeroCollapseOffset(input: {
  welcomeCardHeight: number;
  welcomeCollapse: number;
}): number {
  "worklet";
  const offset = -input.welcomeCardHeight * (1 - input.welcomeCollapse);
  return offset === 0 ? 0 : offset;
}
