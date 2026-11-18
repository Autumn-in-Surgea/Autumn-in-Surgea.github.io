import { create } from "zustand";
import { applyAction, createGame, getUnitsWithAvailableActions, tileAt } from "../game";
import type { Action, EventNotice, GameOptions, GameState } from "../game/types";
import { getNation } from "../nations/registry";
import { deserializeGame, serializeGame } from "./save";
import { aiWorker } from "../workers/aiClient";
import { freshCombatEvents, rememberCombatEvents } from "../workers/combatEvents";
import { observeMoves } from "../workers/visibleMove";
import { observedActionTile, type PlaybackStep } from "./actionPlayback";
import { planStructurePlayback } from "./structurePlayback";
export { deserializeGame, serializeGame } from "./save";

const SAVE_KEY = "four-shades-of-autumn.save.v2";
const SETTINGS_KEY = "four-shades-of-autumn.settings.v1";
export interface Settings {
  sound: boolean;
  reducedMotion: boolean;
  showHints: boolean;
  showResources: boolean;
  cityDetails: "map" | "panel";
}
const defaultSettings: Settings = {
  sound: true,
  reducedMotion: false,
  showHints: false,
  showResources: true,
  cityDetails: "map",
};
function readSettings(): Settings {
  try {
    const saved = JSON.parse(
      localStorage.getItem(SETTINGS_KEY) || "{}",
    ) as Partial<Settings>;
    return {
      sound: saved.sound ?? defaultSettings.sound,
      reducedMotion: saved.reducedMotion ?? defaultSettings.reducedMotion,
      showHints: saved.showHints ?? defaultSettings.showHints,
      showResources: typeof saved.showResources === "boolean" ? saved.showResources : defaultSettings.showResources,
      cityDetails: saved.cityDetails === "panel" ? "panel" : defaultSettings.cityDetails,
    };
  } catch {
    return defaultSettings;
  }
}
export function hasSavedGame(): boolean {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}
function persist(game: GameState, notices: readonly EventNotice[]) {
  try {
    localStorage.setItem(SAVE_KEY, serializeGame(game, notices));
    return true;
  } catch {
    return false;
  }
}
let generation = 0;

function savedNotices(raw: string): EventNotice[] {
  const { pendingNotices } = JSON.parse(raw);
  if (!Array.isArray(pendingNotices)) return [];
  return pendingNotices.slice(0, 250).filter((notice): notice is EventNotice =>
    notice && typeof notice.title === "string" && typeof notice.message === "string" &&
    notice.title.length > 0 && notice.message.length > 0,
  ).map(({ title, message, nationId }: EventNotice) => ({
    title, message,
    ...(nationId && getNation(nationId) ? { nationId } : {}),
  }));
}

interface Store {
  game: GameState | null;
  screen: "menu" | "game";
  selectedTile: number | null;
  selectedUnit: string | null;
  busy: boolean;
  playbackStep: PlaybackStep | null;
  eventNotice: EventNotice | null;
  attachPlayback: () => () => void;
  completePlayback: (id: number) => void;
  acknowledgeEvent: () => void;
  aiError: string;
  notice: string;
  resetKey: number;
  sessionId: number;
  settings: Settings;
  start: (options: GameOptions) => void;
  select: (tileId: number | null, unitId?: string | null) => void;
  command: (action: Action) => boolean;
  advanceAI: () => void;
  save: () => boolean;
  exportSave: () => string | null;
  load: () => void;
  importSave: (text: string) => void;
  menu: () => void;
  resume: () => void;
  setNotice: (text: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  resetCamera: () => void;
}
export const useGameStore = create<Store>((set, get) => {
  let playbackClients = 0;
  let sequence = 0;
  let pendingPlayback: { id: number; resolve: () => void } | null = null;
  let eventWaiter: (() => void) | null = null;
  let notices: EventNotice[] = [];

  function cancel(preserveNotices = false) {
    generation++;
    aiWorker.cancel();
    pendingPlayback?.resolve();
    pendingPlayback = null;
    eventWaiter?.();
    eventWaiter = null;
    if (!preserveNotices) notices = [];
  }

  function collectNotices(game: GameState, afterId: number) {
    for (const event of game.events)
      if (event.id > afterId && event.player === 0 && event.notice)
        notices.push(event.notice);
  }

  function publish(
    before: GameState,
    next: GameState,
    action: Action,
    selection?: Pick<Store, "selectedTile" | "selectedUnit">,
  ) {
    const moves = observeMoves(before, next, action);
    const combat = freshCombatEvents(before, next);
    if (moves.length || combat.length)
      rememberCombatEvents(next, combat, moves);
    const count = notices.length;
    collectNotices(next, before.events.at(-1)?.id ?? 0);
    const structurePlan = playbackClients ? planStructurePlayback(before, next) : null;
    const focusTile = observedActionTile(before, next, action, combat) ??
      moves.find(move => move.path.length > 0)?.path[0] ??
      structurePlan?.structures.keys().next().value ?? null;
    const visible = focusTile !== null || notices.length !== count ||
      (before.currentPlayer === 0 && action.type !== "END_TURN") ||
      ("targetPlayer" in action && action.targetPlayer === 0);
    const step = structurePlan && focusTile !== null
      ? { id: ++sequence, focusTile: before.currentPlayer === 0 ? null : focusTile, ...structurePlan }
      : null;
    const finished = step
      ? new Promise<void>((resolve) => { pendingPlayback = { id: step.id, resolve }; })
      : undefined;
    const checkpoint = visible || before.currentPlayer === 0 ||
      next.currentPlayer !== before.currentPlayer || next.status === "finished";
    const saved = !checkpoint || persist(next, notices);
    set({
      ...selection,
      game: next,
      playbackStep: step,
      eventNotice: step ? null : notices[0] ?? null,
      notice: checkpoint ? (saved ? "" : "存档失败，请导出存档。") : get().notice,
    });
    return finished;
  }

  function continueIfReady() {
    const { game, playbackStep, eventNotice, screen } = get();
    if (screen === "game" && !playbackStep && !eventNotice && game?.currentPlayer !== 0)
      get().advanceAI();
  }

  return {
    game: null,
    screen: "menu",
    selectedTile: null,
    selectedUnit: null,
    busy: false,
    playbackStep: null,
    eventNotice: null,
    attachPlayback: () => {
      playbackClients++;
      return () => {
        playbackClients--;
        if (!playbackClients && pendingPlayback) get().completePlayback(pendingPlayback.id);
      };
    },
    completePlayback: (id) => {
      if (pendingPlayback?.id !== id) return;
      const { resolve } = pendingPlayback;
      pendingPlayback = null;
      set({ playbackStep: null, eventNotice: notices[0] ?? null });
      resolve();
      continueIfReady();
    },
    acknowledgeEvent: () => {
      const { game, eventNotice } = get();
      if (!eventNotice) return;
      notices.shift();
      if (game) persist(game, notices);
      set({ eventNotice: notices[0] ?? null });
      if (notices.length) return;
      eventWaiter?.();
      eventWaiter = null;
      continueIfReady();
    },
    aiError: "",
    notice: "",
    resetKey: 0,
    sessionId: 0,
    settings: readSettings(),
    start: (options) => {
      const game = createGame(options);
      cancel();
      const nation = getNation(game.players[0].civilization);
      if (nation) notices.push({ ...nation.notices.opening, nationId: nation.id });
      collectNotices(game, 0);
      const saved = persist(game, notices);
      set({
        game,
        screen: "game",
        selectedTile: null,
        selectedUnit: null,
        busy: false,
        playbackStep: null,
        eventNotice: notices[0] ?? null,
        aiError: "",
        notice: saved ? "" : "存档失败，请导出存档。",
        resetKey: get().resetKey + 1,
        sessionId: get().sessionId + 1,
      });
    },
    select: (tileId, unitId) =>
      set({ selectedTile: tileId, selectedUnit: unitId ?? null }),
    command: (action) => {
      const { game, busy, playbackStep, eventNotice, selectedTile, selectedUnit } = get();
      if (!game || busy || playbackStep || eventNotice || game.currentPlayer !== 0 || game.status !== "playing")
        return false;
      const result = applyAction(game, action);
      if (!result.ok) {
        set({ notice: result.error || "现在无法执行这个行动。" });
        return false;
      }
      const next = result.state;
      const unit = next.units.find((unit) => unit.id === selectedUnit);
      // Revealing a hidden blocker does not displace the unit or consume movement.
      const usedSelectedUnit = !!selectedUnit && (
        ("unitId" in action && action.unitId === selectedUnit &&
          (action.type !== "MOVE" || (!!unit && tileAt(next, unit).id === action.to))) ||
        (action.type === "HARVEST" && action.tileId === selectedTile && game.tiles[action.tileId].resource === "starfish")
      );
      const selectionSpent = usedSelectedUnit &&
        (!unit || !getUnitsWithAvailableActions(next, [unit]).has(unit.id));
      const clearSelection = selectionSpent || action.type === "END_TURN";
      publish(game, next, action, {
        selectedUnit: clearSelection ? null : unit?.id ?? null,
        selectedTile: clearSelection ? null : unit ? tileAt(next, unit).id : selectedTile,
      });
      continueIfReady();
      return true;
    },
    advanceAI: () => {
      if (get().busy || get().playbackStep || get().eventNotice || get().screen !== "game") return;
      const currentGeneration = generation;
      const game = get().game;
      if (!game || game.status !== "playing" || game.currentPlayer === 0) {
        set({ busy: false });
        return;
      }
      set({ busy: true, aiError: "" });
      void (async () => {
        const active = () => currentGeneration === generation && get().screen === "game";
        try {
          while (active()) {
            const live = get().game;
            if (!live || live.status !== "playing" || live.currentPlayer === 0) break;
            const orders = await aiWorker.plan(live);
            if (!active() || get().game !== live) return;
            let before = live;
            let unseenSteps = 0;
            for (const action of orders) {
              if (!active()) return;
              if (before.status !== "playing" || before.currentPlayer !== live.currentPlayer)
                throw new Error("AI 计划越过了当前回合。");
              const result = applyAction(before, action);
              if (!result.ok) throw new Error(result.error || "AI 行动重放失败。");
              const finished = publish(before, result.state, action);
              before = result.state;
              if (finished) {
                await finished;
                unseenSteps = 0;
              } else if (++unseenSteps === 8) {
                await new Promise<void>((resolve) => setTimeout(resolve, 0));
                unseenSteps = 0;
              }
              if (!active()) return;
              if (get().eventNotice)
                await new Promise<void>((resolve) => { eventWaiter = resolve; });
            }
            if (before.status === "playing" && before.currentPlayer === live.currentPlayer)
              throw new Error("AI 计划未结束回合，请重试。");
          }
          if (currentGeneration !== generation) return;
          const next = get().game;
          set({
            busy: false,
            notice: get().notice || (next?.status === "playing" ? `第 ${next.round} 回合 · 轮到你了` : ""),
          });
        } catch (error) {
          if (currentGeneration !== generation) return;
          set({
            busy: false,
            aiError: error instanceof Error ? error.message : "AI 回合处理失败。",
          });
        }
      })();
    },
    save: () => {
      const game = get().game;
      if (!game) return true;
      const saved = persist(game, notices);
      set({ notice: saved ? "对局已保存到此浏览器。" : "无法写入本地存储，请导出存档。" });
      return saved;
    },
    exportSave: () => {
      const { game } = get();
      return game ? serializeGame(game, notices) : null;
    },
    load: () => {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) {
          set({ notice: "还没有本地存档。" });
          return;
        }
        get().importSave(raw);
      } catch {
        set({ notice: "存档无法读取，请导入备份或开始新对局。" });
      }
    },
    importSave: (raw) => {
      try {
        const game = deserializeGame(raw);
        const restoredNotices = savedNotices(raw);
        cancel();
        notices = restoredNotices;
        persist(game, notices);
        set({
          game,
          screen: "game",
          busy: false,
          playbackStep: null,
          eventNotice: notices[0] ?? null,
          aiError: "",
          selectedTile: null,
          selectedUnit: null,
          notice: "已恢复对局。",
          resetKey: get().resetKey + 1,
          sessionId: get().sessionId + 1,
        });
        if (game.currentPlayer !== 0 && game.status === "playing")
          get().advanceAI();
      } catch (error) {
        set({
          notice: error instanceof Error ? error.message : "存档读取失败。",
        });
      }
    },
    menu: () => {
      cancel(true);
      const game = get().game;
      if (game) persist(game, notices);
      set({ screen: "menu", busy: false, aiError: "", playbackStep: null, eventNotice: notices[0] ?? null });
    },
    resume: () => {
      set({ screen: "game" });
      get().advanceAI();
    },
    setNotice: (notice) => set({ notice }),
    updateSettings: (patch) => {
      const settings = { ...get().settings, ...patch };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch {
        /* Settings stay valid in memory. */
      }
      set({ settings });
    },
    resetCamera: () => set({ resetKey: get().resetKey + 1 }),
  };
});
