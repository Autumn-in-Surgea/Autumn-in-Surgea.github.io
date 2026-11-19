import { describe, expect, it } from "vitest";
import { applyAction } from "../../src/game";
import { buildTileTiers, exchangeDuration, exchangePause, planStructurePlayback, roadPlaybackRate, sinkSeconds } from "../../src/store/structurePlayback";
import { exposedHeight } from "../../src/scene/structureMotion";
import { battlefield } from "./helpers";

describe("city and improvement exchanges", () => {
  it("keeps road and building tiers local to the city administering each tile", () => {
    const game = battlefield();
    const [capital, rival] = game.cities;
    capital.level = 4;
    rival.level = 6;
    const tiers = buildTileTiers(game.cities, game.tiles.length);
    expect(tiers[capital.territory[0]]).toBe(2);
    expect(tiers[rival.territory[0]]).toBe(3);
    expect(tiers[5 * 12 + 5]).toBe(1);
  });

  it("plays a farm being planted, the capital upgrade, and the neighbouring mine / road tier change on the same action", () => {
    const game = battlefield();
    const capital = game.cities[0];
    capital.level = 2;
    capital.population = 2;
    const [field, mine, road] = capital.territory.filter(id => !game.tiles[id].cityId);
    game.tiles[field].resource = "crop";
    game.tiles[mine].building = "mine";
    game.tiles[road].road = true;
    const result = applyAction(game, { type: "BUILD", tileId: field, building: "farm" });
    expect(result.ok).toBe(true);
    expect(result.state.cities[0].level).toBe(3);
    const { structures, structureDuration } = planStructurePlayback(game, result.state);
    expect(structures.get(field)).toMatchObject({ scenery: "replace", road: null });
    expect(structures.get(mine)).toMatchObject({ scenery: "replace", road: null, previousTier: 1 });
    expect(structures.get(road)).toMatchObject({ scenery: null, road: "replace" });
    expect(structures.get(12 * capital.y + capital.x)?.scenery).toBe("replace");
    expect(structureDuration).toBe(exchangeDuration("replace"));
  });

  it("animates an empty plot, demolition, and a road laid without disturbing a forest", () => {
    const game = battlefield();
    const [id, road] = game.cities[0].territory.filter(i => !game.tiles[i].cityId);
    game.tiles[road].terrain = "forest";
    const built = structuredClone(game);
    built.tiles[id].building = "temple";
    built.tiles[road].road = true;
    expect(planStructurePlayback(game, built).structures.get(id)?.scenery).toBe("rise");
    expect(planStructurePlayback(built, game).structures.get(id)?.scenery).toBe("sink");
    expect(planStructurePlayback(game, built).structures.get(road)).toMatchObject({ scenery: null, road: "rise" });
  });

  it("joins both halves of a new road while keeping the neighbouring city's buildings still", () => {
    const game = battlefield();
    const city = game.cities[0], cityTile = city.y * 12 + city.x;
    const road = cityTile + 1;
    game.tiles[road].terrain = "forest";
    const built = structuredClone(game);
    built.tiles[road].road = true;
    const plan = planStructurePlayback(game, built);
    expect(plan.structures.get(road)).toMatchObject({ road: "rise", scenery: null });
    expect(plan.structures.get(cityTile)).toMatchObject({ road: "replace", scenery: null });
    expect(plan.structureDuration).toBeCloseTo(exchangeDuration("replace") / roadPlaybackRate);
  });

  it("replaces the captured city's model while keeping its facilities and roads in place", () => {
    const game = battlefield();
    const city = game.cities[1];
    const [id] = city.territory.filter(i => !game.tiles[i].cityId);
    game.tiles[id].building = "port";
    const captured = structuredClone(game);
    captured.cities[1].owner = 0;
    for (const i of city.territory) captured.tiles[i].owner = 0;
    const plan = planStructurePlayback(game, captured);
    expect(plan.structures.get(city.x + city.y * 12)?.scenery).toBe("replace");
    expect(plan.structures.has(id)).toBe(false);
  });

  it("shows a newly discovered skyline once and never reconstructs a change hidden behind fog", () => {
    const game = battlefield();
    const city = game.cities[1], id = city.y * 12 + city.x;
    const after = structuredClone(game);
    after.cities[1].level++;
    after.players[0].visible = after.players[0].visible.filter(i => i !== id);
    expect(planStructurePlayback(game, after).structures.has(id)).toBe(false);
    const again = structuredClone(after);
    again.players[0].visible.push(id);
    expect(planStructurePlayback(after, again).structures.has(id)).toBe(false);
    after.players[0].explored = after.players[0].explored.filter(i => i !== id);
    expect(planStructurePlayback(after, again).structures.get(id)).toMatchObject({ scenery: "rise" });
    expect(planStructurePlayback(again, structuredClone(again)).structures.size).toBe(0);
  });

  it("finishes the whole outgoing silhouette before the new one clears the surface", () => {
    expect(exposedHeight("replace", false, 0)).toBe(1);
    expect(exposedHeight("replace", true, 0)).toBe(0);
    const gap = sinkSeconds + exchangePause / 2;
    expect(exposedHeight("replace", false, gap)).toBe(0);
    expect(exposedHeight("replace", true, gap)).toBe(0);
    for (let t = 0; t <= 1.1; t += 0.005)
      expect(exposedHeight("replace", false, t) * exposedHeight("replace", true, t)).toBe(0);
    expect(exposedHeight("replace", true, exchangeDuration("replace"))).toBe(1);
    expect(exposedHeight("sink", false, exchangeDuration("sink"))).toBe(0);
  });
});
