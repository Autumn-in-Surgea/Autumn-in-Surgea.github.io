/** Development of the sculpture only. Production and temple age use game rules. */
export type BuildingVisualTier = 1 | 2 | 3;

export function buildingVisualTier(cityLevel: number): BuildingVisualTier {
  if (cityLevel >= 5) return 3;
  if (cityLevel >= 3) return 2;
  return 1;
}

// A starter works and a mature works have different footprints. The third
// stage adds a specialised district to the mature footprint.
export function facilityLayoutTier(tier: BuildingVisualTier): 1 | 3 {
  return tier === 1 ? 1 : 3;
}

// The top surfaces meet at these local model heights before fitting the span to its banks.
export const bridgeDeckHeight = 0.162;
export const roadSurfaceHeight = 0.009;

// Port gangways meet the fixed wharf deck. Bridge footings align with the outer stringers.
export const mooringDeck = 0.141;
export const bridgePierOffset = (tier: BuildingVisualTier) => (0.245 + 0.038 * facilityLayoutTier(tier)) / 2 + 0.006;
