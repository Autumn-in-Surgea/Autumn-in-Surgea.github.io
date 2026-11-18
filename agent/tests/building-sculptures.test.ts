import { describe, expect, it } from "vitest";
import { BUILDINGS } from "../../src/game/data/config";
import { bridgeBanks } from "../../src/scene/BridgeSpan";
import type { Tile } from "../../src/game/types";
import { buildingVisualTier, roadSurfaceHeight } from "../../src/scene/buildingVisualTier";
import { MODEL_SETS } from "../../src/scene/factionModels";
import { roadGeometry } from "../../src/scene/RoadInlay";
import { terrainHeight } from "../../src/scene/terrainElevation";

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
      expect(min.y).toBeGreaterThanOrEqual(-0.002);
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

  it("orients a bridge along revealed land banks and meets their paving at both ends", () => {
    const tiles: Tile[] = Array.from({ length: 9 }, (_, id) => ({
      id,
      x: id % 3,
      y: Math.floor(id / 3),
      terrain: "shallow",
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
