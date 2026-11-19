import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import {
  getAttackTargets,
  getPendingUpgradeCity,
  getUnitsWithAvailableActions,
  isUnitVisible,
  UNITS,
  validateAction,
  getReachableTiles,
} from "./game";
import type { Action } from "./game/types";
import GameScene from "./scene/GameScene";
import { useGameStore } from "./store/gameStore";
import { MainMenu, About } from "./ui/Menu";
import { GameHUD } from "./ui/GameHUD";
import { EventNotice } from "./ui/EventNotice";
import {
  ResultsPanel,
  SettingsPanel,
  StarBudgetPanel,
  TechPanel,
  DiplomacyPanel,
} from "./ui/Panels";
import { playSound } from "./ui/sound";

type Panel = "tech" | "diplomacy" | "settings" | "stars" | "about" | null;
type TargetOrder = {
  action: Extract<Action, { type: "ATTACK" | "CONVERT" | "MOVE" }>;
  targetId: string;
  tileId: number;
};

const BoardScene = memo(GameScene);

export default function App() {
  const {
    game, screen, selectedTile, selectedUnit, select, command, busy: aiBusy,
    playbackStep, attachPlayback, completePlayback, eventNotice, acknowledgeEvent,
    notice, setNotice, resetKey, sessionId, settings,
  } = useGameStore(useShallow(state => ({
    game: state.game,
    screen: state.screen,
    selectedTile: state.selectedTile,
    selectedUnit: state.selectedUnit,
    select: state.select,
    command: state.command,
    busy: state.busy,
    playbackStep: state.playbackStep,
    attachPlayback: state.attachPlayback,
    completePlayback: state.completePlayback,
    eventNotice: state.eventNotice,
    acknowledgeEvent: state.acknowledgeEvent,
    notice: state.notice,
    setNotice: state.setNotice,
    resetKey: state.resetKey,
    sessionId: state.sessionId,
    settings: state.settings,
  })));
  const busy = aiBusy || !!playbackStep || !!eventNotice;
  const [panel, setPanel] = useState<Panel>(null),
    [aimedOrder, setAimedOrder] = useState<TargetOrder | null>(null),
    [dismissedResult, setDismissedResult] = useState<string | null>(null);
  const [presentedResult, setPresentedResult] = useState<string | null>(null);
  const [selectionRequest, setSelectionRequest] = useState(0);
  const [systemReducedMotion, setSystemReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReducedMotion(preference.matches);
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  const reducedMotion = settings.reducedMotion || systemReducedMotion;
  useEffect(() => {
    setAimedOrder(null);
  }, [sessionId]);
  const reachable = useMemo(
    () =>
      game && selectedUnit && !busy
        ? getReachableTiles(game, selectedUnit)
        : [],
    [game, selectedUnit, busy],
  );
  const targetOrders = useMemo<TargetOrder[]>(() => {
    if (screen !== "game" || game?.currentPlayer !== 0 || game.status !== "playing" || busy)
      return [];
    const actor = game.units.find((unit) => unit.id === selectedUnit);
    if (!actor || actor.owner !== 0) return [];
    const type = UNITS[actor.type].skills.includes("convert") ? "CONVERT" : "ATTACK";
    const targets = type === "CONVERT"
      ? game.units.filter((unit) =>
          !validateAction(game, { type, unitId: actor.id, targetId: unit.id }),
        )
      : getAttackTargets(game, actor.id);
    const orders: TargetOrder[] = targets.map((unit) => ({
      action: { type, unitId: actor.id, targetId: unit.id },
      targetId: unit.id,
      tileId: unit.y * game.options.size + unit.x,
    }));
    if (!reachable.length) return orders;
    const legalMoves = new Set(reachable);
    for (const ally of game.units) {
      if (ally.owner !== actor.owner) continue;
      const tileId = ally.y * game.options.size + ally.x;
      if (!legalMoves.has(tileId)) continue;
      orders.push({ action: { type: "MOVE", unitId: actor.id, to: tileId }, targetId: ally.id, tileId });
    }
    return orders;
  }, [game, screen, selectedUnit, busy, reachable]);
  const attackTargets = useMemo(
    () => targetOrders.filter(({ action }) => action.type !== "MOVE").map(({ targetId }) => targetId),
    [targetOrders],
  );
  const previewedOrder = aimedOrder && targetOrders.find(({ action, tileId, targetId }) =>
    tileId === aimedOrder.tileId &&
    action.unitId === aimedOrder.action.unitId &&
    targetId === aimedOrder.targetId &&
    action.type === aimedOrder.action.type,
  );
  useEffect(() => {
    if (aimedOrder && !previewedOrder) setAimedOrder(null);
  }, [aimedOrder, previewedOrder]);
  const target = previewedOrder?.targetId ?? null;
  const pendingUpgrade = game?.status === "playing" && game.currentPlayer === 0 && !busy
    ? getPendingUpgradeCity(game)
    : undefined;
  const openActionTile = useCallback((
    tileId: number,
    kind: "upgrade" | "capture",
    unitId?: string,
  ) => {
    if (busy) return;
    select(tileId, kind === "capture" ? unitId : null);
    setAimedOrder(null);
    setSelectionRequest((request) => request + 1);
  }, [busy, select]);
  const perform = useCallback((action: Action) => {
    if (action.type === "END_TURN" && pendingUpgrade && game) {
      openActionTile(pendingUpgrade.y * game.options.size + pendingUpgrade.x, "upgrade");
      return;
    }
    if (command(action) && settings.sound)
      playSound(
        action.type === "MOVE"
          ? "move"
          : action.type === "ATTACK"
            ? "attack"
            : action.type === "END_TURN"
              ? "turn"
              : action.type === "RESEARCH"
                ? "research"
                : "click",
      );
  }, [command, game, openActionTile, pendingUpgrade, settings.sound]);
  function nextUnit() {
    if (!game || busy || game.currentPlayer !== 0) return;
    const available = getUnitsWithAvailableActions(game);
    const units = game.units.filter((unit) => available.has(unit.id));
    if (!units.length) {
      setNotice("没有待行动的单位。");
      return;
    }
    const next =
      units[(units.findIndex((u) => u.id === selectedUnit) + 1) % units.length];
    select(next.y * game.options.size + next.x, next.id);
    setAimedOrder(null);
  }
  const clickTile = useCallback((id: number) => {
    if (screen !== "game" || !game || busy) return;
    const tile = game.tiles[id];
    const unit = game.units.find(
      (u) => u.x === tile.x && u.y === tile.y && isUnitVisible(game, u, 0),
    );
    const order = targetOrders.find(({ tileId }) => tileId === id);
    if (order) {
      if (order === previewedOrder) {
        setAimedOrder(null);
        perform(order.action);
      } else {
        setAimedOrder(order);
        if (settings.sound) playSound("click");
      }
      return;
    }
    if (
      selectedUnit &&
      reachable.includes(id) &&
      id !== selectedTile &&
      !unit
    ) {
      perform({ type: "MOVE", unitId: selectedUnit, to: id });
      setAimedOrder(null);
      return;
    }
    const selectingGround = id === selectedTile && unit?.id === selectedUnit;
    select(id, selectingGround ? null : unit?.id ?? null);
    setAimedOrder(null);
    if (settings.sound) playSound("click");
  }, [busy, game, perform, previewedOrder, reachable, screen, select, selectedTile, selectedUnit, settings.sound, targetOrders]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5500);
    return () => clearTimeout(timer);
  }, [notice, setNotice]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement)?.matches("input,select,textarea") ||
        eventNotice || panel || document.querySelector('[role="dialog"][aria-modal="true"]') ||
        screen !== "game"
      )
        return;
      if (e.key === "Escape") {
        setAimedOrder(null);
        if (!previewedOrder) select(null);
      }
      if (e.key.toLowerCase() === "t") setPanel("tech");
      if (e.key.toLowerCase() === "n") nextUnit();
      if (
        e.key === "Enter" &&
        !e.repeat &&
        !previewedOrder &&
        !(e.target as HTMLElement)?.closest("button")
      ) {
        e.preventDefault();
        perform({ type: "END_TURN" });
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const resultKey = game
    ? `${sessionId}-${game.options.seed}-${game.round}-${game.winner}`
    : "";
  const onResultReady = useCallback(() => setPresentedResult(resultKey), [resultKey]);
  return (
    <div
      className={`app ${screen === "menu" ? "is-menu" : "is-playing"} ${reducedMotion ? "reduce-motion" : ""}`}
      data-menu-theme={settings.menuTheme}
    >
      {screen === "game" && game && (
        <div className="game-scene">
          <BoardScene
            key={sessionId}
            game={game}
            selectedTile={selectedTile}
            selectedUnit={selectedUnit}
            reachable={reachable}
            attackTargets={attackTargets}
            focusedTarget={target}
            onTileClick={clickTile}
            onActionBadge={openActionTile}
            onResultReady={onResultReady}
            resetKey={resetKey}
            reducedMotion={reducedMotion}
            showCityDetails={settings.cityDetails === "map"}
            showResourceHints={settings.showResources}
            playbackStep={playbackStep}
            attachPlayback={attachPlayback}
            onPlaybackDone={completePlayback}
          />
        </div>
      )}
      {screen === "menu" ? (
        <MainMenu
          onSettings={() => setPanel("settings")}
          onAbout={() => setPanel("about")}
        />
      ) : (
        game && (
          <>
            <GameHUD
              key={sessionId}
              selectionRequest={selectionRequest}
              upgradePending={!!pendingUpgrade}
              game={game}
              onCommand={perform}
              onTech={() => setPanel("tech")}
              onDiplomacy={() => setPanel("diplomacy")}
              onSettings={() => setPanel("settings")}
              onStars={() => setPanel("stars")}
              target={target}
            />
          </>
        )
      )}
      {panel === "settings" && <SettingsPanel onClose={() => setPanel(null)} />}{" "}
      {panel === "about" && <About onClose={() => setPanel(null)} />}{" "}
      {panel === "stars" && game && (
        <StarBudgetPanel game={game} busy={busy} onClose={() => setPanel(null)} onCommand={perform} />
      )}{" "}
      {panel === "tech" && game && (
        <TechPanel
          game={game}
          onClose={() => setPanel(null)}
          onCommand={perform}
        />
      )}{" "}
      {panel === "diplomacy" && game && (
        <DiplomacyPanel
          game={game}
          onClose={() => setPanel(null)}
          onCommand={perform}
        />
      )}{" "}
      {screen === "game" &&
        game?.status === "finished" &&
        presentedResult === resultKey &&
        dismissedResult !== resultKey &&
        !busy &&
        !panel && (
          <ResultsPanel
            game={game}
            onClose={() => setDismissedResult(resultKey)}
          />
        )}{" "}
      {screen === "game" && eventNotice && (
        <EventNotice
          notice={eventNotice}
          onAcknowledge={acknowledgeEvent}
        />
      )}
      {screen === "menu" && notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} aria-label="关闭通知">
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
