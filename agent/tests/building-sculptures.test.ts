import { describe, expect, it } from "vitest";
import { BUILDINGS } from "../../src/game/data/config";
import { bridgeBanks } from "../../src/scene/BridgeSpan";
import type { Tile } from "../../src/game/types";
import { buildingVisualTier, roadSurfaceHeight } from "../../src/scene/buildingVisualTier";
import { MODEL_SETS } from "../../src/scene/factionModels";
import { roadGeometry } from "../../src/scene/RoadInlay";
import { terrainHeight } from "../../src/scene/terrainElevation";
import { battlefield } from "./helpers";
import { DEFAULT_TERRAIN_VARIANT } from "../../src/nations/registry";

describe("city improvement sculptures", () => {
  it("advances once per two city levels and caps at the third appearance", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 100].map(buildingVisualTier)).toEqual([1, 1, 1, 2, 2, 3, 3, 3]);
  });

  it.each(Object.values(BUILDINGS).map((b) => b.id))("gives %s three distinct silhouettes inside one tile", (type) => {
    let previousHeight = 0;
    let previousVertexCount = 0;
    for (const tier of [1, 2, 3] as const) {
      const mesh = MODEL_SETS.danubian.building(type, "#38635b", tier);
      mesh.computeBoundingBox();
      const { min, max } = mesh.boundingBox!;
      expect(Math.max(-min.x, -min.z, max.x, max.z)).toBeLessThanOrEqual(0.5);
      // The natural iron outcrops keep their original slightly buried rock feet.
      expect(min.y).toBeGreaterThanOrEqual(type === "mine" ? -.005 : -.002);
      expect(max.y).toBeGreaterThan(previousHeight + 0.009);
      const vertices = mesh.getAttribute("position").count;
      expect(vertices).toBeGreaterThan(previousVertexCount);
      expect(mesh.getAttribute("color").count).toBe(vertices);
      expect(mesh.index!.count / 3).toBeLessThan(4000);
      const captured = MODEL_SETS.danubian.building(type, "#aa5249", tier);
      const originalColors = mesh.getAttribute("color").array;
      expect(captured.getAttribute("color").array.some((value, i) => value !== originalColors[i])).toBe(true);
      captured.dispose();
      previousHeight = max.y;
      previousVertexCount = vertices;
      mesh.dispose();
    }
  });

  it("keeps the full-size suburban facilities below the skyline of the city they serve", () => {
    for (const tier of [1, 2, 3] as const) {
      const city = MODEL_SETS.imperia.city("#94735b", 2 * tier - 1, false, false, 0);
      city.computeBoundingBox();
      const skyline = city.boundingBox!.max.y;
      for (const { id } of Object.values(BUILDINGS)) {
        const site = MODEL_SETS.imperia.building(id, "#94735b", tier);
        site.computeBoundingBox();
        expect(site.boundingBox!.max.y, id).toBeLessThan(skyline);
        site.dispose();
      }
      city.dispose();
    }
  });

  it("orients a bridge along revealed land banks and meets their paving at both ends", () => {
    const tiles: Tile[] = Array.from({ length: 9 }, (_, id) => ({
      id,
      x: id % 3,
      y: Math.floor(id / 3),
      terrain: "shallow",
      terrainVariant: DEFAULT_TERRAIN_VARIANT,
      owner: null,
      cityId: null,
      building: null,
      resource: null,
      road: false,
      ruin: false,
    }));
    tiles[3].terrain = "plain";
    tiles[5].terrain = "mountain";
    const props = { tile: tiles[4], tiles, size: 3, explored: new Set(tiles.map((t) => t.id)) };
    const span = bridgeBanks(props);
    expect(span.rotation).toBe(Math.PI / 2);
    expect(span.nearDeck).toBeCloseTo(terrainHeight(tiles[3]) - terrainHeight(tiles[4]) + roadSurfaceHeight);
    expect(span.farDeck).toBeCloseTo(terrainHeight(tiles[5]) - terrainHeight(tiles[4]) + roadSurfaceHeight);
    props.explored.delete(5);
    const partial = bridgeBanks(props);
    tiles[5].terrain = "deep";
    expect(bridgeBanks(props)).toEqual(partial);
    expect(partial.farDeck).toBe(partial.nearDeck);
  });

  it("keeps a placed diagonal bridge on its axis and fits both diagonal banks", () => {
    const game = battlefield();
    const size = game.options.size;
    const tile = game.tiles[size + 1];
    tile.terrain = "deep";
    tile.bridgeAxis = "northeastSouthwest";
    game.tiles[2].terrain = "forest";
    game.tiles[2 * size].terrain = "mountain";
    const explored = new Set(game.players[0].explored);
    const props = { tile, tiles: game.tiles, size, explored };
    const diagonal = bridgeBanks(props);
    expect(diagonal.rotation).toBeCloseTo(-Math.PI / 4);
    expect(diagonal.length).toBeCloseTo(Math.SQRT2);
    expect(diagonal.nearDeck).toBeCloseTo(terrainHeight(game.tiles[2]) - terrainHeight(tile) + roadSurfaceHeight);
    expect(diagonal.farDeck).toBeCloseTo(terrainHeight(game.tiles[2 * size]) - terrainHeight(tile) + roadSurfaceHeight);
    explored.delete(2 * size);
    const hiddenMountain = bridgeBanks(props);
    expect(hiddenMountain.rotation).toBe(diagonal.rotation);
    expect(hiddenMountain.farDeck).toBe(hiddenMountain.nearDeck);
  });

  it("brings the low road half up to the high road along the edge", () => {
    const rise = terrainHeight({ terrain: "mountain" }) - terrainHeight({ terrain: "plain" });
    const low = roadGeometry(4, [0, 0, rise, 0, 0, 0, 0, 0], 2);
    const high = roadGeometry(64, Array(8).fill(0), 2);
    const seam = (mesh: typeof low, x: number) => {
      const p = mesh.getAttribute("position");
      const ys = Array.from({ length: p.count }, (_, i) => (Math.abs(p.getX(i) - x) < 0.001 ? p.getY(i) : -Infinity));
      return Math.max(...ys);
    };
    expect(seam(low, 0.5)).toBeCloseTo(seam(high, -0.5) + rise);
    low.dispose();
    high.dispose();
  });
});
