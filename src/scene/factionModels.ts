import { Color, SRGBColorSpace } from "three";
import type { City, Player, Tile } from "../game/types";
import { factionForOwner, getFactionPack, getNation } from "../nations/registry";

export { MODEL_SETS } from "../nations/models";
export { buildingVisualTier } from "./buildingVisualTier";

export function colorForOwner(players: readonly Player[], owner: number | null) {
  return owner === null ? "#a79a7d" : (players[owner]?.color ?? "#7a9275");
}

const customBoardColors = new Map<string, string>();
export function boardColorForOwner(players: readonly Player[], owner: number) {
  const player = players[owner];
  const nation = player && getNation(player.civilization);
  if (nation) return nation.boardColor;
  const value = colorForOwner(players, owner);
  let accent = customBoardColors.get(value);
  if (!accent) {
    const color = new Color(value);
    const { h, s, l } = color.getHSL({ h: 0, s: 0, l: 0 }, SRGBColorSpace);
    color.setHSL(h, Math.min(0.88, s * 1.35 + 0.13), Math.min(0.82, l + 0.12), SRGBColorSpace);
    accent = `#${color.getHexString()}`;
    customBoardColors.set(value, accent);
  }
  return accent;
}

export function cityAppearance(players: readonly Player[], city: City, terrainVariant?: Tile["terrainVariant"]) {
  const faction = city.owner === null && terrainVariant
    ? getFactionPack(terrainVariant)
    : factionForOwner(players, city.owner);
  return {
    modelSet: faction.modelSet,
    color: colorForOwner(players, city.owner),
    level: city.owner === null ? 0 : Math.min(city.level, 6),
    capital: city.owner !== null && city.capitalOf !== null,
    walls: city.owner !== null && city.defenseBonus > 0,
  };
}
