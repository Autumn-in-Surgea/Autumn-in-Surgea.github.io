import { describe, expect, it } from "vitest";
import { CIVILIZATIONS, factionForOwner, getFactionPack } from "../../src/factions/registry";
import { applyAction } from "../../src/game";
import { cityAppearance, MODEL_SETS } from "../../src/scene/factionModels";
import { deserializeGame, serializeGame } from "../../src/store/save";
import { addUnit, battlefield, newGame } from "./helpers";

describe("owner-selected faction assets", () => {
  it("resolves each story owner after selection and save restore, sharing this edition's sculptures", () => {
    const currentWarrior = MODEL_SETS.danubian.unit("warrior");
    for (const selected of CIVILIZATIONS) {
      const state = deserializeGame(serializeGame(newGame({ scenario: "story", civilization: selected.id })));
      expect(factionForOwner(state.players, 0)).toBe(selected);
      for (const unit of state.units) {
        const pack = factionForOwner(state.players, unit.owner);
        expect(pack.id).toBe(state.players[unit.owner].civilization);
        expect(MODEL_SETS[pack.modelSet].unit("warrior")).toBe(currentWarrior);
      }
    }
  });

  it.each(["fair", "free"] as const)("keeps custom names independent of the story asset registry in %s", scenario => {
    const state = newGame({ scenario, factionNames: ["铃亚", "帝国"] });
    const neutral = getFactionPack("neutral");
    for (const player of state.players) expect(factionForOwner(state.players, player.id)).toBe(neutral);
    expect(factionForOwner(state.players, null)).toBe(neutral);
  });

  it("uses the new owner of a converted piece", () => {
    const game = battlefield();
    game.players[0].civilization = "ida";
    game.players[1].civilization = "rina";
    const ally = addUnit(game, 0, "mindBender", 4, 4);
    const target = addUnit(game, 1, "warrior", 5, 4);
    expect(factionForOwner(game.players, target.owner).id).toBe("rina");
    const result = applyAction(game, { type: "CONVERT", unitId: ally.id, targetId: target.id });
    expect(result.ok).toBe(true);
    const converted = result.state.units.find(unit => unit.id === target.id)!;
    expect(factionForOwner(result.state.players, converted.owner).id).toBe("ida");
  });
});

describe("Danubian cities", () => {
  it("grows a distinct single-mesh skyline at each of the six levels and keeps it inside its tile", () => {
    let previousHeight = 0;
    let previousWidth = 0;
    for (let level = 1; level <= 6; level++) {
      const geometry = MODEL_SETS.danubian.city("#705868", level, false, false);
      geometry.computeBoundingBox();
      const { min, max } = geometry.boundingBox!;
      expect(max.y).toBeGreaterThan(previousHeight + 0.05);
      expect(max.x - min.x).toBeGreaterThan(previousWidth);
      expect(Math.max(-min.x, -min.z, max.x, max.z)).toBeLessThan(0.48);
      expect(geometry.getAttribute("color").count).toBe(geometry.getAttribute("position").count);
      previousHeight = max.y;
      previousWidth = max.x - min.x;
      geometry.dispose();
    }
  });

  it("caps the sculpture and its cache variant at six without capping the city itself", () => {
    const game = battlefield();
    const city = game.cities[0];
    city.level = 6;
    const atSix = cityAppearance(game.players, city);
    city.level = 12;
    expect(cityAppearance(game.players, city)).toEqual(atSix);
    const six = MODEL_SETS.danubian.city(atSix.color, 6, true, true);
    const twelve = MODEL_SETS.danubian.city(atSix.color, 12, true, true);
    expect(twelve.getAttribute("position").array).toEqual(six.getAttribute("position").array);
    expect(city.level).toBe(12);
    six.dispose();
    twelve.dispose();
  });

  it("restyles a captured developed city using its new owner's asset pack and enamel", () => {
    const game = battlefield();
    game.players[0].civilization = "ida";
    game.players[1].civilization = "rina";
    const city = game.cities[1];
    city.level = 5;
    city.defenseBonus = 1;
    expect(cityAppearance(game.players, city).color).toBe(game.players[1].color);
    const unit = addUnit(game, 0, "warrior", city.x, city.y);
    unit.capturedTurn = game.round - 1;
    const captured = applyAction(game, { type: "CAPTURE", unitId: unit.id });
    expect(captured.ok).toBe(true);
    const changed = captured.state.cities.find(candidate => candidate.id === city.id)!;
    expect(changed.capitalOf).toBe(1);
    expect(cityAppearance(captured.state.players, changed)).toEqual({
      modelSet: getFactionPack("ida").modelSet, color: game.players[0].color,
      level: 5, capital: true, walls: true,
    });
    expect(cityAppearance(game.players, { ...city, owner: null })).toMatchObject({ level: 0, capital: false, walls: false });
  });
});
