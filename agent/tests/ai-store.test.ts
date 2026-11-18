import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Action, GameState } from "../../src/game/types";
import { applyAction, DEFAULT_OPTIONS, getAttackTargets, getReachableTiles, tileAt } from "../../src/game";

const jobs = vi.hoisted(() => ({
  pending: [] as { resolve: (actions: Action[]) => void; reject: (error: Error) => void }[],
  plan: vi.fn<(state: GameState) => Promise<Action[]>>(),
  cancel: vi.fn(),
}));
vi.mock("../../src/workers/aiClient", () => ({ aiWorker: jobs }));
import { useGameStore } from "../../src/store/gameStore";
import { deserializeGame, serializeGame } from "../../src/store/save";
import { addUnit, battlefield } from "./helpers";

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  jobs.pending = [];
  jobs.plan.mockReset();
  jobs.cancel.mockReset();
  jobs.plan.mockImplementation(() => new Promise((resolve, reject) => jobs.pending.push({ resolve, reject })));
  useGameStore.getState().start({ ...structuredClone(DEFAULT_OPTIONS), size: 12, aiCount: 2 });
});

describe("worker and game session coordination", () => {
  it("restores unread reward notices and removes them from the save after acknowledgement", () => {
    const game = battlefield();
    const notice = { title: "探索遗迹", message: "获得 10 星。" };
    const get = useGameStore.getState;
    get().importSave(serializeGame(game, [notice]));
    expect(get().eventNotice).toEqual(notice);
    expect(get().command({ type: "END_TURN" })).toBe(false);
    get().acknowledgeEvent();
    get().load();
    expect(get().eventNotice).toBeNull();
    expect(deserializeGame(get().exportSave()!)).toEqual(game);
  });

  it("advances multiple opponents asynchronously, checkpoints each turn, and returns control", async () => {
    expect(useGameStore.getState().command({ type: "END_TURN" })).toBe(true);
    expect(useGameStore.getState().busy).toBe(true);
    expect(jobs.plan).toHaveBeenCalledTimes(1);
    jobs.pending[0].resolve([{ type: "END_TURN" }]);
    await vi.waitFor(() => expect(jobs.plan).toHaveBeenCalledTimes(2));
    expect(deserializeGame(localStorage.getItem("four-shades-of-autumn.save.v2")!).currentPlayer).toBe(2);
    jobs.pending[1].resolve([{ type: "END_TURN" }]);
    await vi.waitFor(() => expect(useGameStore.getState().busy).toBe(false));
    expect(useGameStore.getState().game?.currentPlayer).toBe(0);
    expect(useGameStore.getState().game?.round).toBe(2);
  });

  it("pauses in the menu and ignores stale completion after starting another game", async () => {
    useGameStore.getState().command({ type: "END_TURN" });
    useGameStore.getState().menu();
    expect(useGameStore.getState().busy).toBe(false);
    useGameStore.getState().start({ ...structuredClone(DEFAULT_OPTIONS), size: 12, aiCount: 1, seed: "replacement" });
    const fresh = useGameStore.getState().game;
    jobs.pending[0].resolve([{ type: "END_TURN" }]);
    await Promise.resolve();
    expect(useGameStore.getState().game).toBe(fresh);
    expect(useGameStore.getState().game?.options.seed).toBe("replacement");
    expect(jobs.cancel).toHaveBeenCalledTimes(3);
  });

  it("restores an AI turn from disk and retries errors without silently skipping an opponent", async () => {
    useGameStore.getState().command({ type: "END_TURN" });
    useGameStore.getState().menu();
    useGameStore.getState().load();
    expect(jobs.plan).toHaveBeenCalledTimes(2);
    jobs.pending[1].reject(new Error("worker failed"));
    await vi.waitFor(() => expect(useGameStore.getState().aiError).toBe("worker failed"));
    expect(useGameStore.getState().busy).toBe(false);
    expect(useGameStore.getState().game?.currentPlayer).toBe(1);
    useGameStore.getState().advanceAI();
    expect(jobs.plan).toHaveBeenCalledTimes(3);
    expect(useGameStore.getState().aiError).toBe("");
    useGameStore.getState().menu();
  });

  it("keeps AI actions and turn hand-off behind the scene's per-action acknowledgement", async () => {
    const game = battlefield();
    const first = addUnit(game, 1, "warrior", 4, 4);
    const second = addUnit(game, 1, "warrior", 6, 6);
    const actions: Action[] = [
      { type: "MOVE", unitId: first.id, to: 4 * 12 + 5 },
      { type: "MOVE", unitId: second.id, to: 6 * 12 + 7 },
      { type: "END_TURN" },
    ];
    useGameStore.setState({ game });
    const get = useGameStore.getState;
    const detach = get().attachPlayback();
    try {
      expect(get().command({ type: "END_TURN" })).toBe(true);
      jobs.pending[0].resolve(actions);
      await vi.waitFor(() => expect(get().playbackStep).not.toBeNull());
      const firstStep = get().playbackStep!;
      const stateAfterFirst = get().game;
      expect(stateAfterFirst?.units.find((unit) => unit.id === first.id)?.x).toBe(5);
      expect(stateAfterFirst?.units.find((unit) => unit.id === second.id)?.x).toBe(6);
      expect(get().command({ type: "END_TURN" })).toBe(false);
      get().completePlayback(firstStep.id + 1);
      await Promise.resolve();
      expect(get().game).toBe(stateAfterFirst);
      expect(get().busy).toBe(true);

      get().completePlayback(firstStep.id);
      await vi.waitFor(() => expect(get().playbackStep?.id).toBe(firstStep.id + 1));
      expect(get().game?.units.find((unit) => unit.id === second.id)?.x).toBe(7);
      expect(get().game?.currentPlayer).toBe(1);
      get().completePlayback(get().playbackStep!.id);
      await vi.waitFor(() => expect(get().busy).toBe(false));
      const expected = actions.reduce((state, action) => applyAction(state, action).state,
        applyAction(game, { type: "END_TURN" }).state);
      expect(get().game).toEqual(expected);
    } finally {
      get().menu();
      detach();
    }
  });

  it("waits for a rewarded discovery to be acknowledged before starting the opposing turn", () => {
    const game = battlefield();
    game.players[0].metPlayers = [];
    addUnit(game, 1, "warrior", 2, 2);
    useGameStore.setState({ game });
    const get = useGameStore.getState;
    const detach = get().attachPlayback();
    try {
      expect(get().command({ type: "END_TURN" })).toBe(true);
      expect(get().eventNotice).toBeNull();
      expect(get().playbackStep).not.toBeNull();
      expect(jobs.plan).not.toHaveBeenCalled();
      get().completePlayback(get().playbackStep!.id);
      expect(get().eventNotice?.title).toBe("初次接触");
      expect(get().game?.players[0].resources).toBeGreaterThan(game.players[0].resources);
      expect(jobs.plan).not.toHaveBeenCalled();
      get().acknowledgeEvent();
      expect(get().eventNotice).toBeNull();
      expect(jobs.plan).toHaveBeenCalledOnce();
    } finally {
      get().menu();
      detach();
    }
  });

  it("holds the remaining planned actions while a discovery from an opponent's move is open", async () => {
    const game = battlefield();
    game.currentPlayer = 1;
    game.players[0].metPlayers = [];
    game.players[0].visible = game.players[0].explored = game.tiles
      .filter((tile) => tile.x <= 4 && tile.y <= 5)
      .map((tile) => tile.id);
    const first = addUnit(game, 1, "warrior", 5, 3);
    const second = addUnit(game, 1, "warrior", 5, 5);
    useGameStore.setState({ game });
    const get = useGameStore.getState;
    const detach = get().attachPlayback();
    try {
      get().advanceAI();
      jobs.pending[0].resolve([
        { type: "MOVE", unitId: first.id, to: 3 * 12 + 4 },
        { type: "MOVE", unitId: second.id, to: 5 * 12 + 4 },
        { type: "END_TURN" },
      ]);
      await vi.waitFor(() => expect(get().playbackStep).not.toBeNull());
      expect(get().eventNotice).toBeNull();
      get().completePlayback(get().playbackStep!.id);
      await vi.waitFor(() => expect(get().eventNotice?.title).toBe("初次接触"));
      expect(get().busy).toBe(true);
      expect(get().game?.units.find((unit) => unit.id === second.id)?.x).toBe(5);

      get().acknowledgeEvent();
      await vi.waitFor(() => expect(get().playbackStep).not.toBeNull());
      expect(get().game?.units.find((unit) => unit.id === second.id)?.x).toBe(4);
      get().completePlayback(get().playbackStep!.id);
      await vi.waitFor(() => expect(get().busy).toBe(false));
      expect(get().game?.currentPlayer).toBe(0);
      expect(get().eventNotice).toBeNull();
    } finally {
      get().menu();
      detach();
    }
  });
});

describe("selection after moving", () => {
  it("keeps a moved archer selected for its shot and clears selection after it fires", () => {
    const game = battlefield();
    const unit = addUnit(game, 0, "archer", 4, 4);
    const enemy = addUnit(game, 1, "warrior", 7, 4);
    useGameStore.setState({ game });
    const { select, command } = useGameStore.getState();
    const destination = tileAt(game, { x: 5, y: 4 }).id;
    select(tileAt(game, unit).id, unit.id);

    expect(command({ type: "MOVE", unitId: unit.id, to: destination })).toBe(true);
    const moved = useGameStore.getState();
    expect(moved).toMatchObject({ selectedTile: destination, selectedUnit: unit.id });
    expect(getReachableTiles(moved.game!, unit.id)).toEqual([]);
    expect(getAttackTargets(moved.game!, unit.id).map((target) => target.id)).toContain(enemy.id);
    const saved = deserializeGame(localStorage.getItem("four-shades-of-autumn.save.v2")!);
    expect(saved.units.find((candidate) => candidate.id === unit.id)).toMatchObject({
      x: 5, y: 4, moved: true, attacked: false,
    });

    expect(command({ type: "ATTACK", unitId: unit.id, targetId: enemy.id })).toBe(true);
    expect(useGameStore.getState()).toMatchObject({ selectedTile: null, selectedUnit: null });
  });

  it("clears selection after movement when a unit has no legal follow-up", () => {
    const game = battlefield();
    const unit = addUnit(game, 0, "archer", 4, 4);
    addUnit(game, 1, "warrior", 8, 4);
    useGameStore.setState({ game });
    const { select, command } = useGameStore.getState();
    const destination = tileAt(game, { x: 5, y: 4 }).id;
    select(tileAt(game, unit).id, unit.id);
    expect(command({ type: "MOVE", unitId: unit.id, to: destination })).toBe(true);
    expect(useGameStore.getState()).toMatchObject({ selectedTile: null, selectedUnit: null });
  });

  it("keeps a rider selected for its escape move after attacking", () => {
    const game = battlefield();
    const rider = addUnit(game, 0, "rider", 4, 4);
    const enemy = addUnit(game, 1, "warrior", 5, 4);
    useGameStore.setState({ game });
    const { select, command } = useGameStore.getState();
    const origin = tileAt(game, rider).id;
    select(origin, rider.id);
    expect(command({ type: "ATTACK", unitId: rider.id, targetId: enemy.id })).toBe(true);
    expect(useGameStore.getState()).toMatchObject({ selectedTile: origin, selectedUnit: rider.id });
    expect(command({ type: "MOVE", unitId: rider.id, to: tileAt(game, { x: 3, y: 4 }).id })).toBe(true);
    expect(useGameStore.getState()).toMatchObject({ selectedTile: null, selectedUnit: null });
  });

  it("retains selection after a knight's first kill while another target is in range", () => {
    const game = battlefield();
    const knight = addUnit(game, 0, "knight", 4, 4);
    const first = addUnit(game, 1, "warrior", 5, 4);
    first.hp = 1;
    const second = addUnit(game, 1, "warrior", 6, 4);
    useGameStore.setState({ game });
    const { select, command } = useGameStore.getState();
    select(tileAt(game, knight).id, knight.id);
    expect(command({ type: "ATTACK", unitId: knight.id, targetId: first.id })).toBe(true);
    expect(useGameStore.getState()).toMatchObject({ selectedTile: tileAt(game, first).id, selectedUnit: knight.id });
    expect(getAttackTargets(useGameStore.getState().game!, knight.id).map((target) => target.id)).toContain(second.id);
  });

  it("keeps an exhausted unit selected until it takes its remaining promotion", () => {
    const game = battlefield();
    const unit = addUnit(game, 0, "archer", 4, 4);
    unit.kills = 3;
    useGameStore.setState({ game });
    const { select, command } = useGameStore.getState();
    const destination = tileAt(game, { x: 5, y: 4 }).id;
    select(tileAt(game, unit).id, unit.id);
    expect(command({ type: "MOVE", unitId: unit.id, to: destination })).toBe(true);
    expect(useGameStore.getState()).toMatchObject({ selectedTile: destination, selectedUnit: unit.id });
    expect(command({ type: "PROMOTE", unitId: unit.id })).toBe(true);
    expect(useGameStore.getState()).toMatchObject({ selectedTile: null, selectedUnit: null });
  });

  it("retains selection when a move fails or reveals a hidden blocker", () => {
    const game = battlefield();
    const unit = addUnit(game, 0, "warrior", 4, 4);
    const cloak = addUnit(game, 1, "cloak", 5, 4);
    cloak.hidden = true;
    useGameStore.setState({ game });
    const { select, command } = useGameStore.getState();
    const origin = tileAt(game, unit).id;
    select(origin, unit.id);

    expect(command({ type: "MOVE", unitId: unit.id, to: -1 })).toBe(false);
    expect(useGameStore.getState()).toMatchObject({ selectedTile: origin, selectedUnit: unit.id });

    expect(command({ type: "MOVE", unitId: unit.id, to: tileAt(game, cloak).id })).toBe(true);
    const revealed = useGameStore.getState();
    expect(revealed).toMatchObject({ selectedTile: origin, selectedUnit: unit.id });
    expect(revealed.game?.units.find((candidate) => candidate.id === cloak.id)?.hidden).toBe(false);
    expect(revealed.game?.units.find((candidate) => candidate.id === unit.id)).toMatchObject({
      x: 4, y: 4, moved: false,
    });
  });
});
