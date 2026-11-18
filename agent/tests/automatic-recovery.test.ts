import { describe, expect, it } from "vitest";
import { applyAction, runAiTurnDetailed, type Action, type GameState } from "../../src/game";
import { deserializeGame, serializeGame } from "../../src/store/save";
import { addUnit, battlefield } from "./helpers";

const endTurn: Action = { type: "END_TURN" };

function apply(game: GameState, action: Action): GameState {
  const result = applyAction(game, action);
  expect(result.ok, result.error).toBe(true);
  return result.state;
}

describe("automatic end-of-turn recovery", () => {
  it("recovers only the ending player's idle wounded units, using territory and maximum health", () => {
    const game = battlefield();
    const atHome = addUnit(game, 0, "warrior", 1, 1);
    const outside = addUnit(game, 0, "warrior", 4, 4);
    const nearlyFull = addUnit(game, 0, "warrior", 2, 2);
    const healthy = addUnit(game, 0, "warrior", 2, 1);
    const opponent = addUnit(game, 1, "warrior", 10, 10);
    atHome.hp = outside.hp = opponent.hp = 1;
    nearlyFull.hp = nearlyFull.maxHp - 1;

    const next = apply(game, endTurn);

    expect(next.currentPlayer).toBe(1);
    expect(next.units).toMatchObject([
      { id: atHome.id, hp: 5, moved: true, attacked: true },
      { id: outside.id, hp: 3, moved: true, attacked: true },
      { id: nearlyFull.id, hp: nearlyFull.maxHp },
      { id: healthy.id, hp: healthy.maxHp, moved: false, attacked: false },
      { id: opponent.id, hp: 1, moved: false, attacked: false },
    ]);
    expect(game.units[0]).toMatchObject({ hp: 1, moved: false, attacked: false });
    expect(apply(next, endTurn).units).toMatchObject([
      { id: atHome.id, hp: 5, moved: false, attacked: false },
      { id: outside.id, hp: 3 },
      { id: nearlyFull.id, hp: nearlyFull.maxHp },
      { id: healthy.id, hp: healthy.maxHp },
      { id: opponent.id, hp: 5 },
    ]);
  });

  it("skips a spent unit and never repeats recovery already used manually", () => {
    const game = battlefield();
    const manual = addUnit(game, 0, "warrior", 1, 1);
    const moved = addUnit(game, 0, "warrior", 4, 4);
    const attacked = addUnit(game, 0, "warrior", 6, 6);
    manual.hp = moved.hp = attacked.hp = 1;
    attacked.attacked = true;
    const recovered = apply(game, { type: "HEAL", unitId: manual.id });
    const spent = apply(recovered, { type: "MOVE", unitId: moved.id, to: 5 * game.options.size + 5 });

    const restored = deserializeGame(serializeGame(spent));
    const next = apply(restored, endTurn);

    expect(next.units).toMatchObject([
      { id: manual.id, hp: 5 },
      { id: moved.id, hp: 1 },
      { id: attacked.id, hp: 1 },
    ]);
  });

  it("waits for mandatory upgrade choices before recovering units", () => {
    const game = battlefield();
    const city = game.cities[0];
    city.level = 2;
    city.pendingRewardLevels = [2];
    city.pendingRewards = 1;
    const unit = addUnit(game, 0, "warrior", 1, 1);
    unit.hp = 1;

    const rejected = applyAction(game, endTurn);
    expect(rejected.ok).toBe(false);
    expect(rejected.state).toBe(game);
    expect(rejected.state.units[0].hp).toBe(1);

    const rewarded = apply(game, { type: "CITY_REWARD", cityId: city.id, reward: "income" });
    expect(apply(rewarded, endTurn).units[0].hp).toBe(5);
  });

  it("recovers idle AI units at the turn boundary even when planning uses the entire action budget", () => {
    const game = battlefield();
    game.currentPlayer = 1;
    game.options.difficulty = "easy";
    game.players[1].peaceOffers = [0];
    const unit = addUnit(game, 1, "warrior", 10, 10);
    unit.hp = 1;

    const outcome = runAiTurnDetailed(game, 1);
    expect(outcome.actions).toEqual([{ type: "PEACE", targetPlayer: 0 }, endTurn]);
    expect(outcome.state.units[0].hp).toBe(5);
    expect(outcome.actions.reduce(apply, game)).toEqual(outcome.state);
  });
});
