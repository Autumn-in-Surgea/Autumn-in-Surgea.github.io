import { describe, expect, it } from "vitest";
import {
  applyAction,
  canCancelNavalUpgrade,
  canCancelTraining,
  canEditNavalUpgrade,
  canEditTraining,
  DEFAULT_OPTIONS,
  getCityUnitCount,
  getNavalUpgradeOrderCost,
  getNavalUpgradeRefund,
  getReachableTiles,
  getTrainingOrderCost,
  getTrainingRefund,
  getTrainingRounds,
  getUnitTrainingRounds,
  previewCombat,
  runAiTurnDetailed,
  tileAt,
  UNITS,
  type Action,
  type GameState,
  type UnitType,
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

function train(game: GameState, unitType: UnitType = "archer"): Action {
  return { type: "TRAIN", cityId: game.cities[game.currentPlayer].id, unitType };
}

describe("training speed rules", () => {
  it("defaults to tiered training in every scenario and honors explicit quick mode", () => {
    expect(DEFAULT_OPTIONS.quickMode).toBe(false);
    for (const scenario of ["fair", "story", "free"] as const) {
      expect(newGame({ scenario }).options.quickMode).toBe(false);
      expect(newGame({ scenario, quickMode: true }).options.quickMode).toBe(true);
    }
  });

  it("still trains immediately in saves created before the quick mode setting", () => {
    const game = battlefield();
    delete game.options.quickMode;
    const loaded = deserializeGame(serializeGame(game));
    expect(getTrainingRounds(loaded, loaded.cities[0], "rider")).toBe(0);
    const after = apply(loaded, train(loaded, "rider"));
    expect(after.cities[0].training).toBeUndefined();
    expect(after.units[0]).toMatchObject({ moved: true, attacked: true, escapeUsed: true });
    expect(getReachableTiles(after, after.units[0].id)).toEqual([]);
  });

  it("uses tech tiers for standard recruits and refits, and creates a slow-mode warrior immediately", () => {
    const game = battlefield();
    game.options.quickMode = false;
    expect(["warrior", "rider", "archer", "swordsman", "scout", "rammer", "bomber", "giant", "raft"]
      .map(unitType => getUnitTrainingRounds(game, unitType as UnitType)))
      .toEqual([0, 1, 2, 3, 2, 2, 3, 0, 0]);
    const enemy = addUnit(game, 1, "warrior", 1, 2);
    const after = apply(game, train(game, "warrior"));
    expect(after.cities[0].training).toBeUndefined();
    const recruit = after.units.find((unit) => unit.owner === 0)!;
    expect(recruit).toMatchObject({ type: "warrior", x: 1, y: 1, moved: true, attacked: true });
    expect(getReachableTiles(after, recruit.id)).toEqual([]);
    const enemyTurn = apply(after, END);
    expect(previewCombat(enemyTurn, enemy.id, recruit.id).canAttack).toBe(true);
  });

  it("charges once, locks the order at end of turn, and delivers after two owning turns", () => {
    const game = battlefield();
    game.options.quickMode = false;
    const city = game.cities[0];
    addUnit(game, 0, "giant", 3, 3).independent = true;
    expect(getCityUnitCount(game, city)).toBe(0);
    expect(getTrainingRounds(game, city, "archer")).toBe(2);
    const ordered = apply(game, train(game));
    expect(ordered.players[0].resources).toBe(100 - UNITS.archer.cost);
    expect(ordered.cities[0].training).toEqual({
      unitType: "archer", readyRound: 3, orderedRound: 1, paidStars: UNITS.archer.cost,
    });
    expect(canEditTraining(ordered, ordered.cities[0])).toBe(true);
    expect(ordered.units.some((u) => u.type === "archer")).toBe(false);
    expect(applyAction(ordered, train(ordered)).ok).toBe(false);
    const opponentTurn = apply(ordered, END);
    expect(opponentTurn.cities[0].training).toBeDefined();
    expect(canEditTraining(opponentTurn, opponentTurn.cities[0])).toBe(false);
    expect(applyAction(opponentTurn, { type: "CANCEL_TRAINING", cityId: city.id }).ok).toBe(false);
    const saved = deserializeGame(serializeGame(opponentTurn));
    expect(saved).toEqual(opponentTurn);
    const firstOwnTurn = apply(saved, END);
    expect(firstOwnTurn.round).toBe(2);
    expect(firstOwnTurn.cities[0].training?.readyRound).toBe(3);
    expect(firstOwnTurn.units.some((u) => u.type === "archer")).toBe(false);
    expect(canCancelTraining(firstOwnTurn, firstOwnTurn.cities[0])).toBe(true);
    expect(applyAction(firstOwnTurn, { type: "TRAIN", cityId: city.id, unitType: "rider" }).ok).toBe(false);
    const ownTurn = apply(apply(firstOwnTurn, END), END);
    expect(ownTurn.cities[0].training).toBeUndefined();
    expect(ownTurn.players[0].resources).toBe(100 - UNITS.archer.cost + 2 * 2);
    const recruit = ownTurn.units.find((unit) => unit.type === "archer")!;
    expect(recruit).toMatchObject({
      owner: 0, homeCityId: city.id, x: city.x, y: city.y, moved: false, attacked: false,
    });
    expect(getReachableTiles(ownTurn, recruit.id).length).toBeGreaterThan(0);
    expect(getCityUnitCount(ownTurn, city)).toBe(1);
    expect(apply(apply(ownTurn, END), END).units.filter((u) => u.type === "archer")).toHaveLength(1);
  });

  it("applies only the cost difference on replacement and refunds cancellation before the turn ends", () => {
    const game = battlefield();
    game.options.quickMode = false;
    game.players[0].resources = UNITS.swordsman.cost;
    const city = game.cities[0];
    const switchTo: Action = { type: "TRAIN", cityId: city.id, unitType: "swordsman" };
    const cancel: Action = { type: "CANCEL_TRAINING", cityId: city.id };
    const ordered = deserializeGame(serializeGame(apply(game, train(game, "rider"))));
    expect(getTrainingOrderCost(ordered, ordered.cities[0], "swordsman")).toBe(2);
    expect(applyAction(ordered, { ...switchTo, unitType: "knight" })).toMatchObject({ ok: false, state: ordered });
    const changed = apply(ordered, switchTo);
    expect(changed.players[0].resources).toBe(0);
    expect(changed.cities[0].training).toMatchObject({ unitType: "swordsman", readyRound: 4 });
    expect(getTrainingRefund(changed, changed.cities[0])).toBe(UNITS.swordsman.cost);

    const lower = apply(changed, train(changed));
    expect(lower.players[0].resources).toBe(2);
    expect(lower.cities[0].training).toMatchObject({ unitType: "archer", readyRound: 3 });
    const cancelled = apply(lower, cancel);
    expect(cancelled.players[0].resources).toBe(UNITS.swordsman.cost);
    expect(cancelled.cities[0].training).toBeUndefined();
    expect(applyAction(cancelled, cancel).ok).toBe(false);
    expect(apply(cancelled, switchTo).cities[0].training?.unitType).toBe("swordsman");
    expect(Array.from({ length: 4 }).reduce<GameState>(state => apply(state, END), cancelled).units).toHaveLength(0);
  });

  it("rounds remaining training refunds down and releases the city after cancellation", () => {
    const game = battlefield();
    game.options.quickMode = false;
    const cityId = game.cities[0].id;
    const ordered = apply(game, train(game, "swordsman"));
    const roundTwo = apply(apply(ordered, END), END);
    const roundThree = apply(apply(roundTwo, END), END);

    for (const [state, refund] of [[roundTwo, 3], [roundThree, 1]] as const) {
      expect(getTrainingRefund(state, state.cities[0])).toBe(refund);
      const cancelled = apply(state, { type: "CANCEL_TRAINING", cityId });
      expect(cancelled.players[0].resources).toBe(state.players[0].resources + refund);
      expect(cancelled.cities[0].training).toBeUndefined();
      expect(apply(cancelled, train(cancelled, "rider")).cities[0].training?.unitType).toBe("rider");
      expect(Array.from({ length: 4 }).reduce<GameState>(s => apply(s, END), cancelled).units).toHaveLength(0);
    }
  });

  it("retains an imported one-round order's delivery but applies the new duration if replanned", () => {
    const game = battlefield();
    game.options.quickMode = false;
    game.cities[0].training = { unitType: "warrior", readyRound: 2 };
    game.players[0].resources -= UNITS.warrior.cost;
    const restored = deserializeGame(serializeGame(game));
    expect(canEditTraining(restored, restored.cities[0])).toBe(true);
    expect(getTrainingRefund(restored, restored.cities[0])).toBe(UNITS.warrior.cost);
    const replanned = apply(restored, train(restored));
    expect(replanned.cities[0].training?.readyRound).toBe(3);
    expect(apply(apply(restored, END), END).units[0]).toMatchObject({ owner: 0, type: "warrior" });
  });

  it("uses an imported order's original duration and price after balance changes", () => {
    const game = battlefield();
    game.options.quickMode = false;
    game.round = 2;
    const city = game.cities[0];
    city.training = { unitType: "swordsman", orderedRound: 1, readyRound: 3, paidStars: 7 };
    const restored = deserializeGame(serializeGame(game));
    const cancelled = apply(restored, { type: "CANCEL_TRAINING", cityId: city.id });
    expect(cancelled.players[0].resources).toBe(restored.players[0].resources + 3);
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
    const cancelled = apply(blocked, { type: "CANCEL_TRAINING", cityId: city.id });
    expect(cancelled.players[0].resources).toBe(blocked.players[0].resources);
    expect(cancelled.cities[0].training).toBeUndefined();
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
    invalid.game.cities[0].training.unitType = "archer";
    invalid.game.cities[0].training.orderedRound = 2;
    expect(() => deserializeGame(JSON.stringify(invalid))).toThrow("城市训练");
    invalid.game.cities[0].training.orderedRound = 1;
    invalid.game.cities[0].training.paidStars = -1;
    expect(() => deserializeGame(JSON.stringify(invalid))).toThrow("城市训练");
  });

  it("lets the AI order a rider and act with it at its next owning turn", () => {
    const game = battlefield();
    game.options.quickMode = false;
    game.players[1].resources = UNITS.rider.cost;
    game.players[1].technologies = ["riding"];
    const opponentTurn = apply(game, END);
    const ai = runAiTurnDetailed(opponentTurn);
    expect(ai.actions.filter((action) => action.type === "TRAIN")).toHaveLength(1);
    expect(ai.state.cities[1].training).toEqual({
      unitType: "rider", readyRound: 2, orderedRound: 1, paidStars: UNITS.rider.cost,
    });
    expect(ai.state.units).toHaveLength(0);
    const replayed = ai.actions.reduce(apply, opponentTurn);
    expect(replayed).toEqual(ai.state);
    const delivered = apply(replayed, END);
    expect(delivered.cities[1].training).toBeUndefined();
    expect(delivered.units[0]).toMatchObject({ owner: 1, moved: false, attacked: false });
    expect(getReachableTiles(delivered, delivered.units[0].id).length).toBeGreaterThan(0);
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

  it("keeps a refitting raft targetable and restores a ready ship after its own due turn", () => {
    const game = battlefield();
    game.options.quickMode = false;
    const raft = addUnit(game, 0, "raft", 2, 1);
    raft.hp = 7;
    raft.carried = { type: "warrior", maxHp: 10, veteran: false, kills: 0 };
    const enemy = addUnit(game, 1, "warrior", 3, 1);
    tileAt(game, raft).terrain = "shallow";
    tileAt(game, { x: 2, y: 0 }).terrain = "shallow";
    const order: Action = { type: "UPGRADE_NAVAL", unitId: raft.id, unitType: "scout" };
    const ordered = apply(game, order);
    expect(ordered.players[0].resources).toBe(100 - UNITS.scout.cost);
    expect(ordered.units[0]).toMatchObject({ type: "raft", navalTraining: { unitType: "scout", readyRound: 3 } });
    expect(canEditNavalUpgrade(ordered, ordered.units[0])).toBe(true);
    expect(getReachableTiles(ordered, raft.id)).toEqual([]);

    const opponentTurn = deserializeGame(serializeGame(apply(ordered, END)));
    expect(previewCombat(opponentTurn, enemy.id, raft.id).canAttack).toBe(true);
    expect(applyAction(opponentTurn, { type: "CANCEL_NAVAL_UPGRADE", unitId: raft.id }).ok).toBe(false);
    const pending = apply(opponentTurn, END);
    expect(pending.round).toBe(2);
    expect(canEditNavalUpgrade(pending, pending.units[0])).toBe(false);
    expect(canCancelNavalUpgrade(pending, pending.units[0])).toBe(true);
    expect(applyAction(pending, { ...order, unitType: "bomber" }).ok).toBe(false);

    const refund = getNavalUpgradeRefund(pending, pending.units[0]);
    expect(refund).toBe(2);
    const cancelled = apply(pending, { type: "CANCEL_NAVAL_UPGRADE", unitId: raft.id });
    expect(cancelled.players[0].resources).toBe(pending.players[0].resources + refund);
    expect(cancelled.units[0]).toMatchObject({ id: raft.id, type: "raft", carried: raft.carried, hp: 7 });
    expect(cancelled.units[0].navalTraining).toBeUndefined();
    expect(getReachableTiles(cancelled, raft.id)).toContain(tileAt(game, { x: 2, y: 0 }).id);

    const finished = apply(apply(pending, END), END);
    expect(finished.units[0]).toMatchObject({
      id: raft.id, type: "scout", x: 2, y: 1, carried: raft.carried, hp: 7, moved: false, attacked: false,
    });
    expect(finished.units[0].navalTraining).toBeUndefined();
    expect(getReachableTiles(finished, raft.id)).toContain(tileAt(game, { x: 2, y: 0 }).id);
  });

  it("charges the naval replacement difference and refunds an unstarted refit", () => {
    const game = battlefield();
    game.options.quickMode = false;
    const raft = addUnit(game, 0, "raft", 2, 1);
    raft.moved = true;
    raft.attacked = true;
    tileAt(game, raft).terrain = "shallow";
    const order: Action = { type: "UPGRADE_NAVAL", unitId: raft.id, unitType: "scout" };
    const ordered = apply(game, order);
    expect(getNavalUpgradeOrderCost(ordered, ordered.units[0], "bomber")).toBe(10);
    const amended = apply(ordered, { ...order, unitType: "bomber" });
    expect(amended.players[0].resources).toBe(100 - UNITS.bomber.cost);
    expect(amended.units[0].navalTraining).toEqual({
      unitType: "bomber", readyRound: 4, orderedRound: 1, paidStars: UNITS.bomber.cost,
    });
    const cancelled = apply(amended, { type: "CANCEL_NAVAL_UPGRADE", unitId: raft.id });
    expect(cancelled.players[0].resources).toBe(100);
    expect(cancelled.units[0].navalTraining).toBeUndefined();
    expect(cancelled.units[0]).toMatchObject({ type: "raft", moved: true, attacked: true });
  });
});
