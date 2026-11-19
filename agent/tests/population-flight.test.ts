import { describe, expect, it } from "vitest";
import { applyAction, hashSeed } from "../../src/game";
import type { PopulationGain } from "../../src/game/types";
import { getPopulationFlights, recordPopulationFlights } from "../../src/store/populationPlayback";
import { flightTiming, populationFlightSeconds, samplePopulationFlight } from "../../src/scene/populationFlightMotion";
import { addCity, addUnit, battlefield } from "./helpers";

describe("population flight witnesses", () => {
  it("records the consumed resource even when a harvest pushes the city to the next level", () => {
    const game = battlefield();
    const city = game.cities[0];
    const origin = game.tiles[14];
    city.population = 1;
    origin.resource = "fruit";
    const result = applyAction(game, { type: "HARVEST", tileId: origin.id });
    expect(result.ok).toBe(true);
    expect(result.state.tiles[origin.id].resource).toBeNull();
    expect(result.state.cities[0]).toMatchObject({ level: 2, population: 0 });
    expect(result.populationGains).toEqual([{
      cityId: city.id, cityTileId: 13, amount: 1, source: { kind: "resource", resource: "fruit", tileId: origin.id },
    }]);
    expect(game.tiles[origin.id].resource).toBe("fruit");
    expect(Object.hasOwn(result.state, "populationGains")).toBe(false);
  });

  it("distinguishes a new mine and the bonus from its neighboring forge", () => {
    const game = battlefield();
    const city = game.cities[0];
    const origin = game.tiles[14], forge = game.tiles[26];
    Object.assign(origin, { terrain: "mountain", resource: "ore" });
    forge.building = "forge";
    const result = applyAction(game, { type: "BUILD", tileId: origin.id, building: "mine" });
    expect(result.ok).toBe(true);
    expect(result.state.tiles[origin.id].building).toBe("mine");
    expect(result.populationGains).toEqual([
      { cityId: city.id, cityTileId: 13, amount: 2, source: { kind: "building", building: "mine", tileId: origin.id, built: true } },
      { cityId: city.id, cityTileId: 13, amount: 2, source: { kind: "building", building: "forge", tileId: forge.id } },
    ]);
    const demolished = applyAction(result.state, { type: "DESTROY", tileId: origin.id });
    expect(demolished.ok).toBe(true);
    expect(demolished.populationGains).toBeUndefined();
  });

  it("uses the completed connection for both cities and the relic for a ruin reward", () => {
    const game = battlefield();
    const capital = game.cities[0], town = addCity(game, 3, 1, 0);
    const road = applyAction(game, { type: "ROAD", tileId: 14 });
    expect(road.ok).toBe(true);
    expect(road.populationGains).toEqual([
      { cityId: town.id, cityTileId: 15, amount: 1, source: { kind: "road", tileId: 14 } },
      { cityId: capital.id, cityTileId: 13, amount: 1, source: { kind: "road", tileId: 14 } },
    ]);
    const relic = game.tiles[40];
    relic.ruin = true;
    const unit = addUnit(game, 0, "warrior", relic.x, relic.y);
    game.options.seed = Array.from({ length: 20 }, (_, id) => `relic-${id}`)
      .find(seed => hashSeed(`${seed}:ruin:${relic.id}`) % 3 === 2)!;
    const explored = applyAction(game, { type: "EXAMINE", unitId: unit.id });
    expect(explored.ok).toBe(true);
    expect(explored.populationGains).toEqual([
      { cityId: capital.id, cityTileId: 13, amount: 3, source: { kind: "ruin", tileId: relic.id } },
    ]);
  });

  it("only exposes a population flight when the viewer can see both endpoints", () => {
    const previous = battlefield(), next = structuredClone(previous);
    previous.players[0].visible = [13];
    next.players[0].visible = [13, 14];
    const first: PopulationGain = { cityId: previous.cities[0].id, cityTileId: 13, amount: 1,
      source: { kind: "lighthouse", tileId: 14 } };
    const hidden: PopulationGain = { ...first, source: { kind: "road", tileId: 44 } };
    const hiddenCity: PopulationGain = { ...first, cityTileId: 44 };
    expect(recordPopulationFlights(previous, next, [first, hidden, hiddenCity])).toEqual([first]);
    expect(getPopulationFlights(next)).toEqual([first]);
    expect(getPopulationFlights(structuredClone(next))).toEqual([]);
    expect(populationFlightSeconds(next)).toBeGreaterThan(flightTiming(next, first, 0).flight);
  });
});

it("squashes, arcs and shrinks to zero at the exact city endpoint", () => {
  const flight = 0.28, apex = 0.64;
  const prep = samplePopulationFlight(0.025, flight, apex);
  expect(prep.travel).toBe(0);
  expect(prep.width).toBeGreaterThan(1);
  expect(prep.height).toBeLessThan(1);
  const airborne = samplePopulationFlight(0.18, flight, apex);
  expect(airborne.travel).toBeGreaterThan(0.5);
  expect(airborne.travel).toBeLessThan(1);
  expect(airborne.lift).toBeGreaterThan(0.5);
  const approach = samplePopulationFlight(0.29, flight, apex);
  expect(approach.width).toBeLessThan(0.5);
  expect(approach.lift).toBeGreaterThan(0);
  const landing = samplePopulationFlight(0.33, flight, apex);
  expect(landing).toMatchObject({ travel: 1, lift: 0, width: 0, height: 0 });
  const glint = samplePopulationFlight(0.35, flight, apex);
  expect(glint.glint).toBeGreaterThan(0);
  expect(glint.width).toBe(0);
  const done = samplePopulationFlight(0.48, flight, apex);
  expect(done.width).toBe(0);
  expect(done.done).toBe(true);
});
