import { describe, expect, it } from "vitest";
import { TECHNOLOGIES, UNITS } from "../../src/game";
import { MODEL_SETS } from "../../src/nations/models";
import { NATIONS, getNation } from "../../src/nations/registry";
import { boardColorForOwner } from "../../src/scene/factionModels";
import { battlefield } from "./helpers";

describe("nation resource packs", () => {
  it("gives each selectable nation its own emblem, board color and first-contact copy", () => {
    expect(new Set(NATIONS.map(nation => nation.images.emblem)).size).toBe(NATIONS.length);
    expect(new Set(NATIONS.map(nation => nation.boardColor)).size).toBe(NATIONS.length);
    expect(new Set(NATIONS.map(nation => nation.notices.firstContact.message)).size).toBe(NATIONS.length);
    expect(getNation("neutral")).toBeUndefined();
  });

  it("uses the nation's bright board accent even when an older save holds the original body color", () => {
    const game = battlefield();
    for (const nation of NATIONS) {
      game.players[0].civilization = nation.id;
      game.players[0].color = nation.color;
      expect(boardColorForOwner(game.players, 0)).toBe(nation.boardColor);
    }
    game.players[0].civilization = "neutral";
    expect(boardColorForOwner(game.players, 0)).not.toBe(game.players[0].color);
  });

  it.each(NATIONS)("registers offline assets and a valid opening for $name", nation => {
    expect(getNation(nation.id)).toBe(nation);
    expect(nation.images.emblem).toMatch(new RegExp(`/nations/${nation.id}/logo\\.png$`));
    for (const technology of nation.opening.technologies)
      expect(TECHNOLOGIES.some(entry => entry.id === technology)).toBe(true);
    expect(UNITS[nation.opening.unit]).toBeDefined();
    const models = MODEL_SETS[nation.modelSet];
    expect(models.unit).toBeTypeOf("function");
    expect(models.city).toBeTypeOf("function");
    expect(models.building).toBeTypeOf("function");
  });
});
