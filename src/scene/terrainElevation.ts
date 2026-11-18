import type { Terrain } from "../game/types";

// Heights are measured in tile widths, from the board's common origin.
export const terrainCapOffset = 0.015;
export const landHeight = 0.075;
const seaHeight = landHeight - 0.105;
const mountainHeight = landHeight + 0.12;
const elevations: Record<Terrain, number> = {
  shallow: seaHeight,
  deep: seaHeight,
  forest: landHeight,
  plain: landHeight,
  mountain: mountainHeight,
};

export function terrainHeight(tile: { terrain: Terrain }) {
  return elevations[tile.terrain];
}

export function knownTerrainHeight(tile: { terrain: Terrain }, explored: boolean) {
  return explored ? terrainHeight(tile) : landHeight;
}
