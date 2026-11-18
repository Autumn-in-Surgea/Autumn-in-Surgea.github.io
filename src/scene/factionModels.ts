import type { City, Player } from "../game/types";
import { factionForOwner } from "../nations/registry";

export { MODEL_SETS } from "../nations/models";
export { buildingVisualTier } from "./buildingVisualTier";

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
