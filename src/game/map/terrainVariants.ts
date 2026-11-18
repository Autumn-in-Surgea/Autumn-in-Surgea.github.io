import { DEFAULT_TERRAIN_VARIANT, type NationId } from "../../nations/registry";
import type { Tile } from "../types";

interface TerrainAnchor {
  tileId: number;
  terrainVariant: NationId;
}

/** Bind the generated coordinates to their nearest original capital. */
export function assignTerrainVariants(tiles: Tile[], anchors: readonly TerrainAnchor[]): Tile[] {
  if (!anchors.length) return tiles;
  const origins = anchors.map(({ tileId, terrainVariant }) => {
    const { x, y } = tiles[tileId];
    return { tileId, x, y, terrainVariant };
  });
  return tiles.map(tile => {
    let terrainVariant: NationId = DEFAULT_TERRAIN_VARIANT;
    let nearestDistance = Infinity;
    let nearestId = Infinity;
    for (const origin of origins) {
      const distance = (tile.x - origin.x) ** 2 + (tile.y - origin.y) ** 2;
      // Resolve borders by original map coordinate, independent of player order.
      if (distance > nearestDistance || (distance === nearestDistance && origin.tileId >= nearestId)) continue;
      terrainVariant = origin.terrainVariant;
      nearestDistance = distance;
      nearestId = origin.tileId;
    }
    return tile.terrainVariant === terrainVariant ? tile : { ...tile, terrainVariant };
  });
}
