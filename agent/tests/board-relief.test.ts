import { describe, expect, it } from "vitest";
import { makeTerritoryBorders } from "../../src/scene/TerritoryBorders";
import { knownTerrainHeight, terrainCapOffset, terrainHeight } from "../../src/scene/terrainElevation";
import { battlefield } from "./helpers";

describe("board relief", () => {
  it("uses three shelves, with the same height for both water depths and for forest and plain", () => {
    const h = (terrain: Parameters<typeof terrainHeight>[0]["terrain"]) => terrainHeight({ terrain });
    expect(h("shallow")).toBe(h("deep"));
    expect(h("plain")).toBe(h("forest"));
    expect(h("mountain") - h("plain")).toBeCloseTo(0.12);
    expect(h("plain") - h("deep")).toBeCloseTo(0.105);
    expect(knownTerrainHeight({ terrain: "mountain" }, false)).toBe(knownTerrainHeight({ terrain: "deep" }, false));
  });

  it("joins the visible border along the cliff between two neighbouring heights", () => {
    const game = battlefield();
    const [sea, ground] = game.tiles;
    sea.terrain = "shallow";
    ground.terrain = "plain";
    sea.owner = ground.owner = 0;
    const shape = makeTerritoryBorders(game.tiles, game.players, new Set([sea.id, ground.id]), game.options.size);
    const coords = shape.getAttribute("position"), indices = shape.index!;
    const heights = [sea, ground].map(tile => terrainHeight(tile) + terrainCapOffset + 0.029);
    let verticalTriangles = 0;
    for (let i = 0; i < indices.count; i += 3) {
      const y = [0, 1, 2].map(k => coords.getY(indices.getX(i + k)));
      if (Math.max(...y) - Math.min(...y) < 0.01) continue;
      verticalTriangles++;
      expect(Math.min(...y)).toBeCloseTo(heights[0]);
      expect(Math.max(...y)).toBeCloseTo(heights[1]);
    }
    expect(verticalTriangles).toBeGreaterThan(0);
    shape.dispose();
  });

  it("keeps the drawn border identical when the terrain or ownership of an unknown neighbour changes", () => {
    const game = battlefield(), explored = new Set([0]);
    const border = () => makeTerritoryBorders(game.tiles, game.players, explored, game.options.size);
    const initial = border();
    game.tiles[1].owner = 1;
    game.tiles[1].terrain = "mountain";
    const next = border();
    expect(initial.getAttribute("position").array).toEqual(next.getAttribute("position").array);
    expect(initial.getAttribute("color").array).toEqual(next.getAttribute("color").array);
    initial.dispose();
    next.dispose();
  });
});
