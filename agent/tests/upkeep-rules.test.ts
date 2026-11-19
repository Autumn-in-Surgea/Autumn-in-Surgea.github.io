import { describe, expect, it } from "vitest";
import {
  applyAction,
  getActiveUpkeep,
  getAttackTargets,
  getAvailableActions,
  getCityUnitCount,
  getReachableTiles,
  getUnitUpkeep,
  getUnitsWithAvailableActions,
  previewCombat,
  tileAt,
  type Action,
  type GameState,
  type UnitType,
} from "../../src/game";
import { deserializeGame, serializeGame } from "../../src/store/save";
import { addUnit, battlefield } from "./helpers";

const END: Action = { type: "END_TURN" };

function apply(game: GameState, action: Action): GameState {
  const result = applyAction(game, action);
  expect(result.ok, result.error).toBe(true);
  return result.state;
}

function upkeepBattlefield(): GameState {
  const game = battlefield();
  game.options.quickMode = false;
  return game;
}

describe("unit upkeep", () => {
  it("uses the unit's unlock tier, charging nothing in quick mode and old saves", () => {
    const game = upkeepBattlefield();
    const fees: Record<UnitType, number> = {
      warrior: 1,
      rider: 1,
      defender: 2,
      archer: 2,
      swordsman: 3,
      catapult: 3,
      knight: 3,
      mindBender: 3,
      cloak: 3,
      dagger: 0,
      giant: 0,
      raft: 0,
      scout: 2,
      rammer: 2,
      bomber: 3,
      juggernaut: 0,
      dinghy: 0,
      pirate: 0,
    };
    for (const type of Object.keys(fees) as UnitType[]) {
      expect(getUnitUpkeep(game, { type }), type).toBe(fees[type]);
    }
    const knight = addUnit(game, 0, "knight", 4, 4);
    game.players[0].resources = 0;
    for (const quickMode of [true, undefined]) {
      game.options.quickMode = quickMode;
      expect(getUnitUpkeep(game, knight)).toBe(0);
      expect(getActiveUpkeep(game, 0)).toBe(0);
      expect(apply(game, END).units[0].upkeep).toBeUndefined();
    }
  });

  it("pays affordable fees in numeric recruitment order regardless of roster order", () => {
    const game = upkeepBattlefield();
    game.nextId = 8;
    const knight = addUnit(game, 0, "knight", 3, 3);
    const archer = addUnit(game, 0, "archer", 4, 4);
    const rider = addUnit(game, 0, "rider", 5, 5);
    const warrior = addUnit(game, 0, "warrior", 6, 6);
    const opponent = addUnit(game, 1, "bomber", 10, 10);
    game.units.reverse();
    game.players[0].resources = 2;
    game.players[1].resources = 1;
    expect(getActiveUpkeep(game, 0)).toBe(7);

    const next = apply(game, END);
    expect(next.players[0].resources).toBe(0);
    expect(next.players[1].resources).toBe(1);
    expect(next.units.filter((unit) => unit.upkeep === "suspended").map((unit) => unit.id))
      .toEqual([warrior.id, rider.id, knight.id]);
    for (const unit of [archer, opponent]) {
      expect(next.units.find((candidate) => candidate.id === unit.id)?.upkeep).toBeUndefined();
    }
    expect(getActiveUpkeep(next, 0)).toBe(2);
    expect(getActiveUpkeep(next, 1)).toBe(3);
  });

  it("keeps the original recruitment priority after a unit changes owner", () => {
    const game = upkeepBattlefield();
    const older = addUnit(game, 1, "rider", 4, 4);
    const newer = addUnit(game, 0, "rider", 5, 5);
    const converter = addUnit(game, 0, "mindBender", 4, 3);
    game.units.reverse();
    game.players[0].resources = 1;

    const converted = apply(game, { type: "CONVERT", unitId: converter.id, targetId: older.id });
    const settled = apply(deserializeGame(serializeGame(converted)), END);
    expect(settled.units.find(unit => unit.id === older.id)).toMatchObject({ owner: 0 });
    expect(settled.units.find(unit => unit.id === older.id)?.upkeep).toBeUndefined();
    expect(settled.units.find(unit => unit.id === newer.id)?.upkeep).toBe("suspended");
    expect(settled.players[0].resources).toBe(0);
  });

  it("blocks the next owning turn, then charges separately for reactivation and current upkeep", () => {
    const game = upkeepBattlefield();
    const archer = addUnit(game, 0, "archer", 3, 3);
    archer.hp = 6;
    archer.moved = true;
    game.players[0].resources = 0;
    const reactivate: Action = { type: "REACTIVATE", unitId: archer.id };

    const suspended = apply(apply(game, END), END);
    expect(suspended.round).toBe(2);
    expect(suspended.units[0]).toMatchObject({ upkeep: "suspended", hp: 6, moved: false });
    expect(getUnitsWithAvailableActions(suspended).has(archer.id)).toBe(false);
    expect(getReachableTiles(suspended, archer.id)).toEqual([]);
    expect(applyAction(suspended, reactivate).ok).toBe(false);
    expect(applyAction(suspended, { type: "HEAL", unitId: archer.id }).ok).toBe(false);

    const opponentTurn = apply(suspended, END);
    expect(opponentTurn.players[0].resources).toBe(suspended.players[0].resources);
    expect(opponentTurn.units[0]).toMatchObject({ upkeep: "reactivation", hp: 6 });
    const pending = apply(opponentTurn, END);
    expect(pending.round).toBe(3);
    expect(getAvailableActions(pending).filter((action) => "unitId" in action && action.unitId === archer.id))
      .toEqual([reactivate]);
    pending.players[0].resources = 1;
    expect(applyAction(pending, reactivate).ok).toBe(false);
    expect(getUnitsWithAvailableActions(pending).has(archer.id)).toBe(false);
    pending.players[0].resources = 4;
    const reactivated = apply(pending, reactivate);
    expect(reactivated.units[0].upkeep).toBeUndefined();
    expect(reactivated.players[0].resources).toBe(2);
    expect(getReachableTiles(reactivated, archer.id).length).toBeGreaterThan(0);
    expect(applyAction(reactivated, reactivate).ok).toBe(false);

    const settled = apply(reactivated, END);
    expect(settled.players[0].resources).toBe(0);
    expect(settled.units[0]).toMatchObject({ id: archer.id, hp: 8 });
    expect(settled.units[0].upkeep).toBeUndefined();
  });

  it("removes a troop that goes unpaid through reactivation without refunding or consuming capacity", () => {
    const game = upkeepBattlefield();
    const defender = addUnit(game, 0, "defender", 3, 3);
    game.players[0].resources = 0;
    let next = game;
    for (let i = 0; i < 4; i++) next = apply(next, END);
    expect(next.currentPlayer).toBe(0);
    expect(next.units[0]).toMatchObject({ id: defender.id, upkeep: "reactivation" });
    expect(getCityUnitCount(next, next.cities[0])).toBe(1);
    const stars = next.players[0].resources;
    next = apply(next, END);
    expect(next.units).toEqual([]);
    expect(next.players[0].resources).toBe(stars);
    expect(getCityUnitCount(next, next.cities[0])).toBe(0);
    expect(next.players[1].stats.kills).toBe(0);
  });

  it("blocks inactive escape, swaps, attacks, special actions, and harvesting with a ship", () => {
    const game = upkeepBattlefield();
    const friendly = addUnit(game, 0, "warrior", 3, 4);
    const rider = addUnit(game, 0, "rider", 4, 4);
    const ship = addUnit(game, 0, "juggernaut", 7, 7);
    addUnit(game, 1, "warrior", 5, 4);
    rider.attacked = true;
    const riderTile = tileAt(game, rider);
    const friendlyTile = tileAt(game, friendly);
    const sea = tileAt(game, ship);
    Object.assign(sea, { terrain: "deep", resource: "starfish" });
    const seaDestination = tileAt(game, { x: 8, y: 7 });
    seaDestination.terrain = "deep";
    addUnit(game, 1, "warrior", 9, 7);
    const navalMove: Action = { type: "MOVE", unitId: ship.id, to: seaDestination.id };
    const harvest: Action = { type: "HARVEST", tileId: sea.id };
    expect(getReachableTiles(game, rider.id)).toContain(friendlyTile.id);
    expect(getReachableTiles(game, friendly.id)).toContain(riderTile.id);
    expect(applyAction(game, harvest).ok).toBe(true);
    expect(apply(game, navalMove).events.some((entry) => entry.combat?.kind === "stomp")).toBe(true);

    rider.upkeep = "suspended";
    ship.upkeep = "reactivation";
    expect(getReachableTiles(game, rider.id)).toEqual([]);
    expect(getReachableTiles(game, friendly.id)).not.toContain(riderTile.id);
    expect(applyAction(game, { type: "MOVE", unitId: friendly.id, to: riderTile.id }).ok).toBe(false);
    rider.attacked = false;
    expect(getAttackTargets(game, rider.id)).toEqual([]);
    expect(applyAction(game, { type: "DISBAND", unitId: rider.id }).ok).toBe(false);
    expect(applyAction(game, harvest).ok).toBe(false);
    expect(applyAction(game, navalMove)).toMatchObject({ ok: false, state: game });
  });

  it("keeps normal defense but prevents counterattacks and respects suspension after conversion", () => {
    const game = upkeepBattlefield();
    const warrior = addUnit(game, 0, "warrior", 4, 3);
    const converter = addUnit(game, 0, "mindBender", 3, 4);
    const enemy = addUnit(game, 1, "swordsman", 4, 4);
    const baseline = previewCombat(game, warrior.id, enemy.id);
    expect(baseline.retaliation).toBeGreaterThan(0);
    enemy.upkeep = "suspended";
    expect(previewCombat(game, warrior.id, enemy.id)).toEqual({ ...baseline, retaliation: 0 });
    const afterAttack = apply(game, { type: "ATTACK", unitId: warrior.id, targetId: enemy.id });
    expect(afterAttack.units.find((unit) => unit.id === warrior.id)?.hp).toBe(warrior.hp);
    expect(afterAttack.events.some((entry) => entry.combat?.kind === "counter")).toBe(false);

    const converted = apply(afterAttack, { type: "CONVERT", unitId: converter.id, targetId: enemy.id });
    expect(converted.units.find((unit) => unit.id === enemy.id)).toMatchObject({ owner: 0, upkeep: "suspended" });
    expect(applyAction(converted, { type: "REACTIVATE", unitId: enemy.id }).ok).toBe(false);
    expect(getActiveUpkeep(converted, 0)).toBe(4);
  });

  it("holds a converted troop inactive until it finishes a full turn with its new owner", () => {
    const game = upkeepBattlefield();
    const rider = addUnit(game, 0, "rider", 4, 4);
    const converter = addUnit(game, 1, "mindBender", 5, 4);
    game.players[0].resources = 0;
    const converted = apply(apply(game, END), { type: "CONVERT", unitId: converter.id, targetId: rider.id });
    const restored = deserializeGame(serializeGame(converted));
    expect(restored.units[0]).toMatchObject({ owner: 1, upkeep: "suspended", upkeepTransferRound: 1 });
    const malformed = structuredClone(restored);
    malformed.units[0].upkeepTransferRound = 2;
    expect(() => deserializeGame(serializeGame(malformed))).toThrow("部队维护状态");

    const nextOwnerTurn = apply(apply(restored, END), END);
    expect(nextOwnerTurn).toMatchObject({ round: 2, currentPlayer: 1 });
    expect(nextOwnerTurn.units[0].upkeep).toBe("suspended");
    expect(applyAction(nextOwnerTurn, { type: "REACTIVATE", unitId: rider.id }).ok).toBe(false);
    const eligible = apply(nextOwnerTurn, END);
    expect(eligible.units[0].upkeep).toBe("reactivation");
    expect(eligible.units[0].upkeepTransferRound).toBeUndefined();
  });
});
