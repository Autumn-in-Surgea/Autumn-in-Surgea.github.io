import { describe, expect, it } from "vitest";
import {
  applyAction,
  DEFAULT_OPTIONS,
  getCityUnitCount,
  getTrainingRounds,
  runAiTurnDetailed,
  tileAt,
  UNITS,
  type Action,
  type GameState,
} from "../../src/game";
import { observedActionTile } from "../../src/store/actionPlayback";
import { deserializeGame, serializeGame } from "../../src/store/save";
import { addUnit, battlefield, newGame } from "./helpers";

const END: Action = { type: "END_TURN" };

function apply(game: GameState, action: Action): GameState {
  const result = applyAction(game, action);
  expect(result.ok, result.error).toBe(true);
  return result.state;
}

function train(game: GameState): Action {
  return { type: "TRAIN", cityId: game.cities[game.currentPlayer].id, unitType: "warrior" };
}

describe("training speed rules", () => {
  it("trains immediately by default in every scenario and interprets old saves the same way", () => {
    for (const scenario of ["fair", "story", "free"] as const)
      expect(newGame({ scenario }).options.quickMode).toBe(true);
    expect(DEFAULT_OPTIONS.quickMode).toBe(true);
    const game = battlefield();
    delete game.options.quickMode;
    const loaded = deserializeGame(serializeGame(game));
    expect(getTrainingRounds(loaded, loaded.cities[0], "warrior")).toBe(0);
    const after = apply(loaded, train(loaded));
    expect(after.cities[0].training).toBeUndefined();
    expect(after.units[0]).toMatchObject({ moved: true, attacked: true });
  });

  it("charges once, persists exactly one order, and delivers at the owner's next turn", () => {
    const game = battlefield();
    game.options.quickMode = false;
    const city = game.cities[0];
    addUnit(game, 0, "giant", 3, 3).independent = true;
    expect(getCityUnitCount(game, city)).toBe(0);
    expect(getTrainingRounds(game, city, "warrior")).toBe(1);
    const ordered = apply(game, train(game));
    expect(ordered.players[0].resources).toBe(100 - UNITS.warrior.cost);
    expect(ordered.cities[0].training).toEqual({ unitType: "warrior", readyRound: 2 });
    expect(ordered.units.some((u) => u.type === "warrior")).toBe(false);
    expect(applyAction(ordered, train(ordered)).ok).toBe(false);
    const opponentTurn = apply(ordered, END);
    expect(opponentTurn.cities[0].training).toBeDefined();
    const saved = deserializeGame(serializeGame(opponentTurn));
    expect(saved).toEqual(opponentTurn);
    const ownTurn = apply(saved, END);
    expect(ownTurn.cities[0].training).toBeUndefined();
    expect(ownTurn.players[0].resources).toBe(100 - UNITS.warrior.cost + 2);
    expect(ownTurn.units.find((u) => u.type === "warrior")).toMatchObject({
      owner: 0, homeCityId: city.id, x: city.x, y: city.y, moved: false, attacked: false,
    });
    expect(getCityUnitCount(ownTurn, city)).toBe(1);
    expect(apply(apply(ownTurn, END), END).units.filter((u) => u.type === "warrior")).toHaveLength(1);
  });

  it("holds a completed order across turns until the city center is clear", () => {
    const game = battlefield();
    game.options.quickMode = false;
    const city = game.cities[0];
    const guard = addUnit(game, 0, "defender", city.x, city.y);
    const ordered = apply(game, train(game));
    const blocked = apply(apply(ordered, END), END);
    expect(blocked.round).toBe(2);
    expect(blocked.cities[0].training?.readyRound).toBe(2);
    expect(blocked.units).toHaveLength(1);
    const cleared = apply(blocked, { type: "MOVE", unitId: guard.id, to: blocked.options.size * 2 + 2 });
    expect(cleared.units).toHaveLength(1);
    const delivered = apply(apply(cleared, END), END);
    expect(delivered.cities[0].training).toBeUndefined();
    expect(delivered.units).toHaveLength(2);
  });

  it("rejects training while an enemy occupies the city and cancels an existing order on capture", () => {
    const game = battlefield();
    game.options.quickMode = false;
    const opponentTurn = apply(game, END);
    const ordered = apply(opponentTurn, train(opponentTurn));
    const city = ordered.cities[1];
    const occupier = addUnit(ordered, 0, "warrior", city.x, city.y);
    occupier.capturedTurn = ordered.round;
    const enemyTurnWithNoOrder = structuredClone(ordered);
    delete enemyTurnWithNoOrder.cities[1].training;
    expect(applyAction(enemyTurnWithNoOrder, train(enemyTurnWithNoOrder)).ok).toBe(false);
    const captured = apply(apply(ordered, END), { type: "CAPTURE", unitId: occupier.id });
    expect(captured.cities[1].owner).toBe(0);
    expect(captured.cities[1].training).toBeUndefined();
    expect(captured.units).toHaveLength(1);
  });

  it("rejects malformed options and impossible training orders on import", () => {
    const game = battlefield();
    game.options.quickMode = false;
    const ordered = apply(game, train(game));
    const invalid = JSON.parse(serializeGame(ordered));
    invalid.game.options.quickMode = "false";
    expect(() => deserializeGame(JSON.stringify(invalid))).toThrow("快速模式");
    invalid.game.options.quickMode = true;
    expect(() => deserializeGame(JSON.stringify(invalid))).toThrow("城市训练");
    invalid.game.options.quickMode = false;
    invalid.game.cities[0].training.unitType = "giant";
    expect(() => deserializeGame(JSON.stringify(invalid))).toThrow("城市训练");
  });

  it("lets the AI order troops with the same actions and receive them on its next turn", () => {
    const game = battlefield();
    game.options.quickMode = false;
    game.players[1].resources = UNITS.warrior.cost;
    game.players[1].technologies = [];
    const opponentTurn = apply(game, END);
    const ai = runAiTurnDetailed(opponentTurn);
    expect(ai.actions.filter((action) => action.type === "TRAIN")).toHaveLength(1);
    expect(ai.state.cities[1].training).toEqual({ unitType: "warrior", readyRound: 2 });
    expect(ai.state.units).toHaveLength(0);
    const replayed = ai.actions.reduce(apply, opponentTurn);
    expect(replayed).toEqual(ai.state);
    const nextOpponentTurn = apply(replayed, END);
    expect(nextOpponentTurn.cities[1].training).toBeUndefined();
    expect(nextOpponentTurn.units[0]).toMatchObject({ owner: 1, moved: false, attacked: false });
  });

  it("marks an opponent recruit for serial playback only when currently visible", () => {
    const game = battlefield();
    game.options.quickMode = false;
    game.players[0].explored = [];
    game.players[0].visible = [];
    game.players[0].technologies = [];
    const opponentTurn = apply(game, END);
    const ordered = apply(opponentTurn, train(opponentTurn));
    const before = apply(ordered, END);
    const after = apply(before, END);
    const center = tileAt(after, after.cities[1]).id;
    expect(after.players[0].visible).not.toContain(center);
    expect(observedActionTile(before, after, END, [])).toBeNull();
    after.players[0].explored.push(center);
    expect(observedActionTile(before, after, END, [])).toBeNull();
    after.players[0].visible.push(center);
    expect(observedActionTile(before, after, END, [])).toBe(center);
  });
});
