/** Development of the sculpture only. Production and temple age use game rules. */
export type BuildingVisualTier = 1 | 2 | 3;

export function buildingVisualTier(cityLevel: number): BuildingVisualTier {
  if (cityLevel >= 5) return 3;
  if (cityLevel >= 3) return 2;
  return 1;
}

// The top surfaces meet at these local model heights before fitting the span to its banks.
export const bridgeDeckHeight = 0.162;
export const roadSurfaceHeight = 0.028;
