import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DEFAULT_OPTIONS } from "../../src/game/data/config";
import type { GameOptions } from "../../src/game/types";

const historyKey = "four-shades-of-autumn.match-history.v1";
const saveKey = "four-shades-of-autumn.save.v2";
const storage = new Map<string, string>();
let historyWritable: boolean;

function opening(seed: string): GameOptions {
  return {
    ...structuredClone(DEFAULT_OPTIONS),
    scenario: "free",
    civilization: "neutral",
    size: 12,
    aiCount: 1,
    mapType: "dryland",
    quickMode: false,
    seed,
  };
}

async function openStore() {
  vi.resetModules();
  return (await import("../../src/store/gameStore")).useGameStore;
}

beforeEach(() => {
  storage.clear();
  historyWritable = true;
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (key === historyKey && !historyWritable) throw new Error("Storage is full");
      storage.set(key, value);
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

it("persists the latest ten successful starts newest first, including deliberate repeat starts", async () => {
  const initial = await openStore();
  for (let i = 0; i < 9; i++) initial.getState().start(opening(`seed-${i}`));

  const options = { ...opening("  repeat  "), civilization: "rina" as const };
  options.mapSettings = {
    ...options.mapSettings,
    landRatio: 1,
    mountainRatio: 0,
    spawnMode: "custom",
    customSpawns: [{ x: 1, y: 1 }, { x: 10, y: 10 }],
  };
  initial.getState().start(options);
  initial.getState().start(options);
  options.mapSettings.customSpawns[0].x = 8;

  const history = initial.getState().matchHistory;
  expect(history.map(entry => entry.options.seed)).toEqual([
    "repeat", "repeat", "seed-8", "seed-7", "seed-6", "seed-5", "seed-4", "seed-3", "seed-2", "seed-1",
  ]);
  expect(history[0].options).toMatchObject({
    civilization: "rina",
    quickMode: false,
    mapSettings: { spawnMode: "custom", customSpawns: [{ x: 1, y: 1 }, { x: 10, y: 10 }] },
  });
  expect((await openStore()).getState().matchHistory).toEqual(history);
});

it("records no entries for resume, saving, importing, loading, or failed generation", async () => {
  const store = await openStore();
  store.getState().start(opening("current"));
  const history = store.getState().matchHistory;
  store.getState().menu();
  store.getState().resume();
  expect(store.getState().save()).toBe(true);
  expect(store.getState().importSave(store.getState().exportSave()!)).toBe(true);
  expect(store.getState().importSave("invalid")).toBe(false);
  store.getState().menu();
  store.getState().load();
  const invalid = opening("invalid-start");
  invalid.mapSettings.spawnMode = "custom";
  expect(() => store.getState().start(invalid)).toThrow();
  expect(store.getState().matchHistory).toBe(history);

  const reopened = await openStore();
  expect(reopened.getState().game).toBeNull();
  expect(reopened.getState().exportSave()).toBe(storage.get(saveKey));
  expect(reopened.getState().save()).toBe(true);
  expect(reopened.getState().notice).toBe("对局已保存到此浏览器。");
  expect(reopened.getState().matchHistory).toEqual(history);
});

it("ignores malformed entries and dates that cannot be formatted", async () => {
  const valid = { startedAt: 1, options: opening("valid") };
  storage.set(historyKey, JSON.stringify([
    { ...valid, startedAt: 9e15 },
    { ...valid, options: { seed: "incomplete" } },
    null,
    valid,
  ]));
  expect((await openStore()).getState().matchHistory).toEqual([valid]);
  storage.set(historyKey, "broken JSON");
  expect((await openStore()).getState().matchHistory).toEqual([]);
});

it("retains starts in memory and persists them with the next successful storage write", async () => {
  const store = await openStore();
  store.getState().start(opening("saved"));
  historyWritable = false;
  store.getState().start(opening("memory"));
  expect(store.getState().matchHistory.map(entry => entry.options.seed)).toEqual(["memory", "saved"]);
  historyWritable = true;
  store.getState().start(opening("recovered"));
  expect((await openStore()).getState().matchHistory.map(entry => entry.options.seed)).toEqual([
    "recovered", "memory", "saved",
  ]);
});

it("keeps starts from other windows when this window had already loaded its history", async () => {
  const first = await openStore();
  const second = await openStore();
  first.getState().start(opening("first window"));
  second.getState().start(opening("second window"));
  first.getState().start(opening("first window again"));
  expect((await openStore()).getState().matchHistory.map(entry => entry.options.seed)).toEqual([
    "first window again", "second window", "first window",
  ]);
});
