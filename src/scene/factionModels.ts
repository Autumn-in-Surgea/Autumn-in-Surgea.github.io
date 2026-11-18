import { factionForOwner, type ModelSetId } from "../factions/registry";
import type { City, Player, UnitType } from "../game/types";
import { danubianBuilding } from "../factions/danubian/buildings";
export { buildingVisualTier } from "./buildingVisualTier";
import { resourceModel } from "./landscape";
import { danubianCity } from "../factions/danubian/cities";
import { danubianUnit } from "../factions/danubian/units";

// Anchors are part of the sculpture set so other hats and masts can use their own clearance.
const tallPieceLabels: Partial<Record<UnitType, number>> = {
  warrior: 1.01, defender: 1.01, archer: 0.99, swordsman: 1.04,
  mindBender: 1.04, rider: 1.09, knight: 1.09, giant: 1.14,
};
const danubian = {
  unit: danubianUnit,
  city: danubianCity,
  building: danubianBuilding,
  resource: resourceModel,
  labelHeight: (type: UnitType) => tallPieceLabels[type] ?? 0.84,
};
export const MODEL_SETS: Record<ModelSetId, typeof danubian> = { danubian };

export function colorForOwner(players: readonly Player[], owner: number | null) {
  return owner === null ? "#a79a7d" : (players[owner]?.color ?? "#7a9275");
}

export function cityAppearance(players: readonly Player[], city: City) {
  return {
    modelSet: factionForOwner(players, city.owner).modelSet,
    color: colorForOwner(players, city.owner),
    level: city.owner === null ? 0 : Math.min(city.level, 6),
    capital: city.owner !== null && city.capitalOf !== null,
    walls: city.owner !== null && city.defenseBonus > 0,
  };
}
