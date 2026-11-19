import { describe, expect, it } from "vitest";
import {
  applyAction,
  canEditTraining,
  DEFAULT_OPTIONS,
  getCityUnitCount,
  getTrainingOrderCost,
  getTrainingRefund,
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

  it("charges once, locks the order at end of turn, and delivers after two owning turns", () => {
    const game = battlefield();
    game.options.quickMode = false;
    const city = game.cities[0];
    addUnit(game, 0, "giant", 3, 3).independent = true;
    expect(getCityUnitCount(game, city)).toBe(0);
    expect(getTrainingRounds(game, city, "warrior")).toBe(2);
    const ordered = apply(game, train(game));
    expect(ordered.players[0].resources).toBe(100 - UNITS.warrior.cost);
    expect(ordered.cities[0].training).toEqual({
      unitType: "warrior", readyRound: 3, orderedRound: 1, paidStars: UNITS.warrior.cost,
    });
    expect(canEditTraining(ordered, ordered.cities[0])).toBe(true);
    expect(ordered.units.some((u) => u.type === "warrior")).toBe(false);
    expect(applyAction(ordered, train(ordered)).ok).toBe(false);
    const opponentTurn = apply(ordered, END);
    expect(opponentTurn.cities[0].training).toBeDefined();
    expect(canEditTraining(opponentTurn, opponentTurn.cities[0])).toBe(false);
    const saved = deserializeGame(serializeGame(opponentTurn));
    expect(saved).toEqual(opponentTurn);
    const firstOwnTurn = apply(saved, END);
    expect(firstOwnTurn.round).toBe(2);
    expect(firstOwnTurn.cities[0].training?.readyRound).toBe(3);
    expect(firstOwnTurn.units.some((u) => u.type === "warrior")).toBe(false);
    expect(applyAction(firstOwnTurn, { type: "CANCEL_TRAINING", cityId: city.id }).ok).toBe(false);
    expect(applyAction(firstOwnTurn, { type: "TRAIN", cityId: city.id, unitType: "rider" }).ok).toBe(false);
    const ownTurn = apply(apply(firstOwnTurn, END), END);
    expect(ownTurn.cities[0].training).toBeUndefined();
    expect(ownTurn.players[0].resources).toBe(100 - UNITS.warrior.cost - 2 * 3 + 2 * 2);
    expect(ownTurn.units.find((u) => u.type === "warrior")).toMatchObject({
      owner: 0, homeCityId: city.id, x: city.x, y: city.y, moved: false, attacked: false,
    });
    expect(getCityUnitCount(ownTurn, city)).toBe(1);
    expect(apply(apply(ownTurn, END), END).units.filter((u) => u.type === "warrior")).toHaveLength(1);
  });

  it("applies only the cost difference on replacement and refunds cancellation before the turn ends", () => {
    const game = battlefield();
    game.options.quickMode = false;
    game.players[0].resources = UNITS.rider.cost;
    const city = game.cities[0];
    const switchTo: Action = { type: "TRAIN", cityId: city.id, unitType: "rider" };
    const cancel: Action = { type: "CANCEL_TRAINING", cityId: city.id };
    const ordered = deserializeGame(serializeGame(apply(game, train(game))));
    expect(getTrainingOrderCost(ordered, ordered.cities[0], "rider")).toBe(1);
    expect(applyAction(ordered, { ...switchTo, unitType: "swordsman" })).toMatchObject({ ok: false, state: ordered });
    const changed = apply(ordered, switchTo);
    expect(changed.players[0].resources).toBe(0);
    expect(changed.cities[0].training).toMatchObject({ unitType: "rider", readyRound: 3 });
    expect(getTrainingRefund(changed, changed.cities[0])).toBe(UNITS.rider.cost);

    const lower = apply(changed, train(changed));
    expect(lower.players[0].resources).toBe(1);
    expect(lower.cities[0].training).toMatchObject({ unitType: "warrior", readyRound: 3 });
    const cancelled = apply(lower, cancel);
    expect(cancelled.players[0].resources).toBe(UNITS.rider.cost);
    expect(cancelled.cities[0].training).toBeUndefined();
    expect(applyAction(cancelled, cancel).ok).toBe(false);
    expect(apply(cancelled, switchTo).cities[0].training?.unitType).toBe("rider");
    expect(Array.from({ length: 4 }).reduce<GameState>(state => apply(state, END), cancelled).units).toHaveLength(0);
  });

  it("retains an imported one-round order's delivery but applies the new duration if replanned", () => {
    const game = battlefield();
    game.options.quickMode = false;
    game.cities[0].training = { unitType: "warrior", readyRound: 2 };
    game.players[0].resources -= UNITS.warrior.cost;
    const restored = deserializeGame(serializeGame(game));
    expect(canEditTraining(restored, restored.cities[0])).toBe(true);
    const replanned = apply(restored, { type: "TRAIN", cityId: game.cities[0].id, unitType: "rider" });
    expect(replanned.cities[0].training?.readyRound).toBe(3);
    expect(apply(apply(restored, END), END).units[0]).toMatchObject({ owner: 0, type: "warrior" });
  });

  it("holds a completed order across turns until the city center is clear", () => {
    const game = battlefield();
    game.options.quickMode = false;
    const city = game.cities[0];
    const guard = addUnit(game, 0, "defender", city.x, city.y);
    const ordered = apply(game, train(game));
    const blocked = Array.from({ length: 4 }).reduce<GameState>(state => apply(state, END), ordered);
    expect(blocked.round).toBe(3);
    expect(blocked.cities[0].training?.readyRound).toBe(3);
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
    invalid.game.cities[0].training.unitType = "warrior";
    invalid.game.cities[0].training.orderedRound = 2;
    expect(() => deserializeGame(JSON.stringify(invalid))).toThrow("城市训练");
    invalid.game.cities[0].training.orderedRound = 1;
    invalid.game.cities[0].training.paidStars = -1;
    expect(() => deserializeGame(JSON.stringify(invalid))).toThrow("城市训练");
  });

  it("lets the AI order troops with the same actions and receive them after two owning turns", () => {
    const game = battlefield();
    game.options.quickMode = false;
    game.players[1].resources = UNITS.warrior.cost;
    game.players[1].technologies = [];
    const opponentTurn = apply(game, END);
    const ai = runAiTurnDetailed(opponentTurn);
    expect(ai.actions.filter((action) => action.type === "TRAIN")).toHaveLength(1);
    expect(ai.state.cities[1].training).toEqual({
      unitType: "warrior", readyRound: 3, orderedRound: 1, paidStars: UNITS.warrior.cost,
    });
    expect(ai.state.units).toHaveLength(0);
    const replayed = ai.actions.reduce(apply, opponentTurn);
    expect(replayed).toEqual(ai.state);
    const nextOpponentTurn = apply(replayed, END);
    expect(nextOpponentTurn.cities[1].training).toBeDefined();
    expect(nextOpponentTurn.units).toHaveLength(0);
    const delivered = apply(apply(nextOpponentTurn, END), END);
    expect(delivered.cities[1].training).toBeUndefined();
    expect(delivered.units[0]).toMatchObject({ owner: 1, moved: false, attacked: false });
  });

  it("marks an opponent recruit for serial playback only when currently visible", () => {
    const game = battlefield();
    game.options.quickMode = false;
    game.players[0].explored = [];
    game.players[0].visible = [];
    game.players[0].technologies = [];
    const opponentTurn = apply(game, END);
    const ordered = apply(opponentTurn, train(opponentTurn));
    const before = apply(apply(apply(ordered, END), END), END);
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
