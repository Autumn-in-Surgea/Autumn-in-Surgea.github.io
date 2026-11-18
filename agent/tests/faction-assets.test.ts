import { describe, expect, it } from "vitest";
import { CIVILIZATIONS, factionForOwner, getFactionPack } from "../../src/factions/registry";
import { applyAction } from "../../src/game";
import { MODEL_SETS } from "../../src/scene/factionModels";
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
