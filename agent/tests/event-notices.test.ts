import { describe, expect, it } from "vitest";
import { applyAction, hashSeed } from "../../src/game";
import { deserializeGame, serializeGame } from "../../src/store/save";
import { addUnit, battlefield, newGame } from "./helpers";

describe("player event notices", () => {
  it("announces each player’s first contact reward once", () => {
    const game = battlefield();
    const unit = addUnit(game, 0, "warrior", 1, 1);
    addUnit(game, 1, "warrior", 10, 10);
    for (const player of game.players) player.metPlayers = [];
    const result = applyAction(game, { type: "MOVE", unitId: unit.id, to: 14 });
    expect(result.ok).toBe(true);
    const discovered = result.state;
    const notices = discovered.events.filter((entry) => entry.notice);
    expect(discovered.players[0].metPlayers).toEqual([1]);
    expect(notices.map((entry) => entry.player)).toEqual([0, 1]);
    const reward = discovered.players[0].resources - game.players[0].resources;
    expect(reward).toBeGreaterThan(0);
    expect(notices[0].notice).toEqual({
      title: "初次接触",
      message: `初次接触${game.players[1].name}，获得 ${reward} 星。`,
    });
    const next = applyAction(discovered, { type: "END_TURN" });
    expect(next.ok).toBe(true);
    expect(next.state.events.filter((entry) => entry.notice)).toEqual(notices);
  });

  it.each([
    [0, "10 星"],
    [1, "老兵部队"],
    [2, "获得科技"],
    [3, "3 人口"],
    [4, "探索者"],
  ])("announces ruin outcome %d (%s) once the reward is granted", (reward, wording) => {
    const game = battlefield();
    const tile = game.tiles[5 * 12 + 5];
    const unit = addUnit(game, 0, "warrior", tile.x, tile.y);
    tile.ruin = true;
    game.players[0].technologies = [];
    game.players[0].explored = game.players[0].explored.filter((id) => id !== tile.id + 2);
    for (let seed = 0; seed < 100; seed++) {
      if (hashSeed(`ruin-notice-${seed}:ruin:${tile.id}`) % 5 === reward) {
        game.options.seed = `ruin-notice-${seed}`;
        break;
      }
    }

    const order = { type: "EXAMINE", unitId: unit.id } as const;
    const result = applyAction(game, order);
    expect(result.ok).toBe(true);
    const notices = result.state.events.filter((entry) => entry.notice);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      player: 0,
      at: { x: tile.x, y: tile.y },
      notice: { title: "遗迹奖励", message: expect.stringContaining(wording) },
    });
    expect(result.state.tiles[tile.id].ruin).toBe(false);
    expect(applyAction(result.state, order).ok).toBe(false);
  });

  it("round-trips optional announcements and rejects malformed fields without dropping legacy saves", () => {
    const game = newGame();
    const legacy = game.events.at(-1)!;
    expect(deserializeGame(serializeGame(game)).events.at(-1)).toEqual(legacy);
    legacy.notice = { title: "任务完成", message: "守住首都。" };
    expect(deserializeGame(serializeGame(game)).events.at(-1)).toEqual(legacy);
    legacy.notice.message = "";
    expect(() => deserializeGame(serializeGame(game))).toThrow(/事件提示/);
  });
});
