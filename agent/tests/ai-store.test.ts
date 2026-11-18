import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameState } from "../../src/game/types";
import { applyAction, DEFAULT_OPTIONS, getAttackTargets, getReachableTiles, tileAt } from "../../src/game";

const jobs = vi.hoisted(() => ({
  pending: [] as { resolve: (state: GameState) => void; reject: (error: Error) => void }[],
  run: vi.fn<(state: GameState) => Promise<GameState>>(),
  cancel: vi.fn(),
}));
vi.mock("../../src/workers/aiClient", () => ({ aiWorker: jobs }));
import { useGameStore } from "../../src/store/gameStore";
import { deserializeGame } from "../../src/store/save";
import { addUnit, battlefield } from "./helpers";

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  jobs.pending = [];
  jobs.run.mockReset();
  jobs.cancel.mockReset();
  jobs.run.mockImplementation(() => new Promise((resolve, reject) => jobs.pending.push({ resolve, reject })));
  useGameStore.getState().start({ ...structuredClone(DEFAULT_OPTIONS), size: 12, aiCount: 2 });
});

describe("worker and game session coordination", () => {
  it("advances multiple opponents asynchronously, checkpoints each turn, and returns control", async () => {
    expect(useGameStore.getState().command({ type: "END_TURN" })).toBe(true);
    expect(useGameStore.getState().busy).toBe(true);
    expect(jobs.run).toHaveBeenCalledTimes(1);
    let state = useGameStore.getState().game!;
    state = applyAction(state, { type: "END_TURN" }).state;
    jobs.pending[0].resolve(state);
    await vi.waitFor(() => expect(jobs.run).toHaveBeenCalledTimes(2));
    expect(deserializeGame(localStorage.getItem("four-shades-of-autumn.save.v2")!).currentPlayer).toBe(2);
    state = applyAction(state, { type: "END_TURN" }).state;
    jobs.pending[1].resolve(state);
    await vi.waitFor(() => expect(useGameStore.getState().busy).toBe(false));
    expect(useGameStore.getState().game?.currentPlayer).toBe(0);
    expect(useGameStore.getState().game?.round).toBe(2);
  });

  it("pauses in the menu and ignores stale completion after starting another game", async () => {
    useGameStore.getState().command({ type: "END_TURN" });
    const previous = useGameStore.getState().game!;
    useGameStore.getState().menu();
    expect(useGameStore.getState().busy).toBe(false);
    useGameStore.getState().start({ ...structuredClone(DEFAULT_OPTIONS), size: 12, aiCount: 1, seed: "replacement" });
    const fresh = useGameStore.getState().game;
    jobs.pending[0].resolve(applyAction(previous, { type: "END_TURN" }).state);
    await Promise.resolve();
    expect(useGameStore.getState().game).toBe(fresh);
    expect(useGameStore.getState().game?.options.seed).toBe("replacement");
    expect(jobs.cancel).toHaveBeenCalledTimes(3);
  });

  it("restores an AI turn from disk and retries errors without silently skipping an opponent", async () => {
    useGameStore.getState().command({ type: "END_TURN" });
    useGameStore.getState().menu();
    useGameStore.getState().load();
    expect(jobs.run).toHaveBeenCalledTimes(2);
    jobs.pending[1].reject(new Error("worker failed"));
    await vi.waitFor(() => expect(useGameStore.getState().aiError).toBe("worker failed"));
    expect(useGameStore.getState().busy).toBe(false);
    expect(useGameStore.getState().game?.currentPlayer).toBe(1);
    useGameStore.getState().advanceAI();
    expect(jobs.run).toHaveBeenCalledTimes(3);
    expect(useGameStore.getState().aiError).toBe("");
    useGameStore.getState().menu();
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
