import { describe, expect, it } from "vitest";
import { applyAction } from "../../src/game";
import { portRoutes } from "../../src/game/rules/waterConnections";
import { roadSurfaceHeight } from "../../src/scene/buildingVisualTier";
import { roadGeometry } from "../../src/scene/RoadInlay";
import { knownShippingRoutes } from "../../src/scene/ShippingLanes";
import { addCity, battlefield } from "./helpers";

const at = (x: number, y: number) => y * 12 + x;

function strait() {
  const game = battlefield(), otherCity = addCity(game, 8, 1, 0);
  game.cities[0].level = otherCity.level = 3;
  const channel = Array.from({ length: 6 }, (_, i) => at(i + 2, 1));
  for (const id of channel) game.tiles[id].terrain = "shallow";
  const first = game.tiles[channel[0]], last = game.tiles[channel[5]];
  first.building = last.building = "port";
  return { game, channel, first, last, otherCity };
}

describe("transport presentation", () => {
  it("keeps curved road surfaces low and their ends aligned through different paving stages", () => {
    const corner = (1 << 0) | (1 << 2);
    const country = roadGeometry(corner, [], 1), paved = roadGeometry(corner, [], 3);
    try {
      for (const geometry of [country, paved]) {
        geometry.computeBoundingBox();
        expect(geometry.boundingBox!.max.y).toBeLessThan(0.012);
        expect(geometry.boundingBox!.min.z).toBeCloseTo(-0.5, 3);
        expect(geometry.boundingBox!.max.x).toBeCloseTo(0.5, 3);
      }
      const seam = (geometry: typeof country) => {
        const position = geometry.getAttribute("position"), z: number[] = [];
        for (let index = 0; index < position.count; index++) {
          if (position.getX(index) > 0.499 && Math.abs(position.getY(index) - roadSurfaceHeight) < 0.00001)
            z.push(position.getZ(index));
        }
        return Math.max(...z) - Math.min(...z);
      };
      expect(seam(country)).toBeCloseTo(seam(paved), 5);
      const rise = roadGeometry(1 << 2, [0, 0, 0.12], 2);
      try {
        rise.computeBoundingBox();
        expect(rise.boundingBox!.max.y).toBeCloseTo(0.12 + roadSurfaceHeight);
      } finally {
        rise.dispose();
      }
    } finally {
      country.dispose();
      paved.dispose();
    }
  });

  it("shows the same port link that transfers population between cities", () => {
    const { game, channel, otherCity } = strait();
    expect(knownShippingRoutes(game, new Set(game.players[0].explored))).toEqual([channel]);
    const next = applyAction(game, { type: "END_TURN" });
    expect(next.ok).toBe(true);
    expect(next.state.cities.find(city => city.id === otherCity.id)?.connected).toBe(true);
    expect(next.state.cities[0].population).toBe(1);
  });

  it("routes around land, and respects unexplored, blocked and deep sea tiles", () => {
    const { game, channel, first } = strait();
    const player = game.players[0], explored = new Set(player.explored);
    const pinchPoint = game.tiles[channel[2]], bypass = game.tiles[at(4, 2)];
    pinchPoint.terrain = "plain";
    const routes = () => portRoutes(game, first, player, explored);
    expect(routes()).toEqual([]);
    bypass.terrain = "shallow";
    expect(routes()).toEqual([[...channel.slice(0, 2), bypass.id, ...channel.slice(3)]]);
    explored.delete(bypass.id);
    expect(routes()).toEqual([]);
    explored.add(bypass.id);
    bypass.owner = 1;
    expect(routes()).toEqual([]);
    player.peaceWith.push(1);
    expect(routes()).toHaveLength(1);
    bypass.terrain = "deep";
    player.technologies = player.technologies.filter(tech => tech !== "sailing");
    expect(routes()).toEqual([]);
    player.technologies.push("sailing");
    expect(routes()).toHaveLength(1);
  });

  it("limits leg length, omits unseen harbors, and draws a single backbone for neighboring ports", () => {
    const { game, first, last, channel } = strait();
    const player = game.players[0], explored = new Set(player.explored);
    const tooFar = game.tiles[at(8, 1)];
    tooFar.terrain = "shallow";
    tooFar.building = "port";
    expect(portRoutes(game, first, player, explored)).toEqual([channel]);
    explored.delete(last.id);
    expect(knownShippingRoutes(game, explored)).toEqual([]);
    explored.add(last.id);
    const port = game.tiles[channel[2]];
    port.building = "port";
    port.owner = 0;
    expect(knownShippingRoutes(game, explored)).toEqual([
      [last.id, tooFar.id], channel.slice(0, 3), channel.slice(2),
    ]);
  });
});
