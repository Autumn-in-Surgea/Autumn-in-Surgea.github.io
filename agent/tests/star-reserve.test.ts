import { describe, expect, it } from "vitest";
import {
  applyAction,
  canBuild,
  getActiveUpkeep,
  getAvailableActions,
  getSpendableStars,
  getTechCost,
  getUnitUpkeep,
  isTerritoryResourceAvailable,
  validateAction,
} from "../../src/game";
import type { Action, GameState } from "../../src/game/types";
import { deserializeGame, serializeGame } from "../../src/store/save";
import { addUnit, battlefield } from "./helpers";

function slowBattlefield() {
  const game = battlefield();
  game.options.quickMode = false;
  return game;
}

function apply(game: GameState, action: Action) {
  const result = applyAction(game, action);
  expect(result.error).toBeUndefined();
  expect(result.ok).toBe(true);
  return result.state;
}

describe("maintenance reserve", () => {
  it("reserves the next bill from the treasury and settles it once in recruitment order after an overspend", () => {
    const game = slowBattlefield();
    const older = addUnit(game, 0, "warrior", 3, 3);
    const newer = addUnit(game, 0, "warrior", 4, 3);
    const fruit = game.tiles[14];
    fruit.resource = "fruit";
    game.tiles[25].resource = "fruit";
    game.players[0].resources = 3;
    const harvest: Action = { type: "HARVEST", tileId: fruit.id };

    expect(getActiveUpkeep(game, 0)).toBe(2);
    expect(getSpendableStars(game, 0)).toBe(1);
    expect(validateAction(game, harvest)).toContain("预留维护费");
    expect(isTerritoryResourceAvailable(game, fruit, 0)).toBe(true);
    const enabled = apply(game, { type: "SET_OVERSPEND", enabled: true });
    expect(getSpendableStars(enabled, 0)).toBe(3);
    expect(getSpendableStars(enabled, 1)).toBe(game.players[1].resources);
    const harvestResult = apply(enabled, harvest);
    expect(harvestResult.players[0].resources).toBe(1);
    expect(validateAction(harvestResult, { type: "HARVEST", tileId: 25 })).toBe("星星不足。");
    const settled = apply(harvestResult, { type: "END_TURN" });
    expect(settled.players[0].resources).toBe(0);
    expect(settled.units.find(unit => unit.id === older.id)?.upkeep).toBeUndefined();
    expect(settled.units.find(unit => unit.id === newer.id)?.upkeep).toBe("suspended");
  });

  it("applies the reserve to infrastructure, research, diplomacy and both forest purchases", () => {
    const game = slowBattlefield();
    const player = game.players[0];
    addUnit(game, 0, "warrior", 3, 3);
    game.tiles[14].resource = "crop";
    game.tiles[12].terrain = "forest";
    player.technologies = player.technologies.filter(id => id !== "riding");
    const costs: [number, Action][] = [
      [3, { type: "ROAD", tileId: 1 }],
      [5, { type: "BUILD", tileId: 14, building: "farm" }],
      [getTechCost(game, 0, "riding"), { type: "RESEARCH", techId: "riding" }],
      [5, { type: "EMBASSY", targetPlayer: 1 }],
      [3, { type: "BURN_FOREST", tileId: 12 }],
      [5, { type: "GROW_FOREST", tileId: 1 }],
    ];
    for (const [amount, action] of costs) {
      player.resources = amount;
      expect(validateAction(game, action), action.type).toContain("预留维护费");
      expect(getAvailableActions(game), action.type).not.toContainEqual(action);
      const enabled = apply(game, { type: "SET_OVERSPEND", enabled: true });
      expect(validateAction(enabled, action), action.type).toBeNull();
      expect(apply(enabled, action).players[0].resources).toBe(0);
    }
    player.resources = 5;
    expect(canBuild(game, 14, "farm")).toBe(false);
    expect(isTerritoryResourceAvailable(game, game.tiles[14], 0)).toBe(true);
  });

  it("includes the troop that will become billable in an instant recruitment or a reactivation", () => {
    const game = slowBattlefield(), player = game.players[0];
    const train: Action = { type: "TRAIN", cityId: game.cities[0].id, unitType: "warrior" };
    player.resources = 2;
    expect(validateAction(game, train)).toContain("预留维护费");
    player.resources = 3;
    expect(getSpendableStars(apply(game, train), 0)).toBe(0);

    const returning = addUnit(game, 0, "archer", 3, 3);
    returning.upkeep = "reactivation";
    const fee = getUnitUpkeep(game, returning);
    expect(fee).toBeGreaterThan(0);
    const reactivate: Action = { type: "REACTIVATE", unitId: returning.id };
    player.resources = fee * 2 - 1;
    expect(validateAction(game, reactivate)).toContain("预留维护费");
    const enabled = apply(game, { type: "SET_OVERSPEND", enabled: true });
    const activated = apply(enabled, reactivate);
    expect(activated.players[0].resources).toBe(fee - 1);
    expect(getActiveUpkeep(activated, 0)).toBe(fee);
    expect(activated.units[0].upkeep).toBeUndefined();
  });

  it("persists the opt-in and releases the reserve only while opted in", () => {
    const game = slowBattlefield();
    addUnit(game, 0, "warrior", 3, 3);
    const enabled = apply(game, { type: "SET_OVERSPEND", enabled: true });
    const loaded = deserializeGame(serializeGame(enabled));
    expect(loaded.players[0].allowOverspend).toBe(true);
    expect(getSpendableStars(loaded, 0)).toBe(loaded.players[0].resources);
    const reset = apply(loaded, { type: "SET_OVERSPEND", enabled: false });
    expect(getSpendableStars(reset, 0)).toBe(reset.players[0].resources - 1);
    const bad = JSON.parse(serializeGame(enabled));
    bad.game.players[0].allowOverspend = "true";
    expect(() => deserializeGame(JSON.stringify(bad))).toThrow();
    const quick = battlefield();
    addUnit(quick, 0, "warrior", 3, 3);
    expect(getSpendableStars(quick, 0)).toBe(quick.players[0].resources);
    expect(validateAction(quick, { type: "SET_OVERSPEND", enabled: true })).not.toBeNull();
  });
});
