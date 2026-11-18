import { useLayoutEffect, useMemo, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { ArrowUp, BookOpen, Building2, Check, Handshake, Settings2, Trophy, UsersRound, X } from "lucide-react";
import { getActiveUpkeep, getIncome, getScore } from "../game";
import type { Action, GameState } from "../game/types";
import { useGameStore } from "../store/gameStore";
import { ResourceIcon } from "./Common";
import { HudAction, SelectionControls } from "./SelectionControls";
import "../styles/game-hud.css";

interface Props {
  selectionRequest: number;
  upgradePending: boolean;
  game: GameState;
  onCommand: (action: Action) => void;
  onTech: () => void;
  onDiplomacy: () => void;
  onSettings: () => void;
  target: string | null;
}

export function GameHUD({
  selectionRequest, upgradePending, game, onCommand, onTech, onDiplomacy,
  onSettings, target,
}: Props) {
  const {
    selectedTile, selectedUnit, busy, playbackStep, eventNotice, aiError,
    advanceAI, select, showHints, cityDetails, updateSettings, notice, setNotice,
  } = useGameStore(useShallow(state => ({
    selectedTile: state.selectedTile,
    selectedUnit: state.selectedUnit,
    busy: state.busy,
    playbackStep: state.playbackStep,
    eventNotice: state.eventNotice,
    aiError: state.aiError,
    advanceAI: state.advanceAI,
    select: state.select,
    showHints: state.settings.showHints,
    cityDetails: state.settings.cityDetails,
    updateSettings: state.updateSettings,
    notice: state.notice,
    setNotice: state.setNotice,
  })));

  const currentSelection = useMemo(() => {
    if (selectedTile === null) return null;
    const cityId = game.tiles[selectedTile]?.cityId;
    return {
      game, tileId: selectedTile, request: selectionRequest,
      unit: game.units.find(unit => unit.id === selectedUnit),
      city: cityId ? game.cities.find(city => city.id === cityId) : undefined,
      target: target === null ? undefined : game.units.find(unit => unit.id === target),
    };
  }, [game, selectedTile, selectedUnit, selectionRequest, target]);
  // Keep the outgoing snapshot through the CSS exit, with native input disabled immediately.
  const lastSelection = useRef(currentSelection);
  useLayoutEffect(() => {
    if (currentSelection) lastSelection.current = currentSelection;
  }, [currentSelection]);
  const selection = currentSelection ?? lastSelection.current;
  const active = currentSelection !== null;
  const { income, upkeep, cities, units, score } = useMemo(() => ({
    income: getIncome(game, 0),
    upkeep: getActiveUpkeep(game, 0),
    cities: game.cities.filter(city => city.owner === 0).length,
    units: game.units.filter(unit => unit.owner === 0).length,
    score: getScore(game, 0),
  }), [game]);
  const locked = busy || !!playbackStep || !!eventNotice;
  const canEndTurn = !locked && game.status === "playing" && game.currentPlayer === 0;
  const hint = showHints && !active && !notice && !aiError;
  const feedback = aiError || notice || (hint ? "点击单位，再点击高亮地块移动。" : "");
  const turnHint = busy ? "等待对手" : playbackStep ? "正在播放行动" : upgradePending ? "选择升级奖励" : undefined;

  return (
    <>
      <header className="hud-statbar" aria-label="对局统计">
        <div className="hud-statbar-inner">
          <div className="hud-stat hud-round" aria-label={`第 ${game.round} 回合`}>
            <span>回合</span>
            <div className="hud-round-value">
              <strong>{game.round}</strong>
              {game.options.mode === "score" && <span>/{game.options.maxRounds}</span>}
            </div>
          </div>
          <div className="hud-stat hud-stars" aria-label={`${game.players[0].resources} 星星，每回合收入 ${income}${upkeep ? `，回合结束维护费 ${upkeep}` : ""}`}>
            <ResourceIcon size={18} />
            <strong data-wide-count={game.players[0].resources >= 10000}>{game.players[0].resources}</strong>
            <span className="hud-yield">
              <span>+{income}</span>
              {upkeep > 0 && <span className="hud-upkeep" title={`回合结束维护费 ${upkeep} 星`}>−{upkeep}</span>}
            </span>
          </div>
          <div className="hud-stat" aria-label={`${cities} 座城市`}>
            <Building2 size={17} aria-hidden="true" /><strong data-wide-count={cities >= 100}>{cities}</strong>
          </div>
          <div className="hud-stat" aria-label={`${units} 个单位`}>
            <UsersRound size={17} aria-hidden="true" /><strong data-wide-count={units >= 100}>{units}</strong>
          </div>
          <div className="hud-stat" aria-label={`分数 ${score}`}>
            <Trophy size={17} aria-hidden="true" /><strong data-wide-count={score >= 10000}>{score}</strong>
          </div>
        </div>
      </header>
      <footer className="hud-command-bar" aria-label="对局操作">
        <div className="hud-drawer-stack">
          {feedback && (
            <div className="hud-feedback" role={aiError ? "alert" : "status"}>
              <span>{feedback}</span>
              {aiError
                ? <button type="button" onClick={advanceAI}>重试 AI 回合</button>
                : <button type="button" aria-label={hint ? "隐藏提示" : "关闭通知"}
                    onClick={() => hint ? updateSettings({ showHints: false }) : setNotice("")}
                  ><X size={16} /></button>}
            </div>
          )}
          <section className="hud-selection" aria-label="所选对象" data-open={active} inert={!active}>
            <div className="hud-selection-inner">
              {selection && (
                <SelectionControls key={`${selection.tileId}-${selection.unit?.id}-${selection.request}`}
                  game={selection.game}
                  tileId={selection.tileId}
                  unit={selection.unit}
                  city={selection.city}
                  showCityStats={cityDetails === "panel"}
                  target={selection.target}
                  busy={locked || !active}
                  onCommand={onCommand}
                />
              )}
              <button type="button" className="hud-selection-close" aria-label="取消选择" onClick={() => select(null)}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          </section>
        </div>
        <nav className="hud-command-inner" aria-label="对局菜单">
          <HudAction icon={Settings2} label="设置" onClick={onSettings} />
          <HudAction icon={Handshake} label="外交" onClick={onDiplomacy} />
          <HudAction icon={BookOpen} label="科技" title="科技树 (T)" onClick={onTech} />
          <button type="button" className="hud-end-turn" data-upgrade={upgradePending}
            title={turnHint} aria-description={turnHint} disabled={!canEndTurn}
            onClick={() => onCommand({ type: "END_TURN" })}
          >
            {busy || playbackStep
              ? <span className="spinner" aria-hidden="true" />
              : upgradePending ? <ArrowUp size={21} aria-hidden="true" /> : <Check size={21} aria-hidden="true" />}
            <strong>结束回合</strong>
          </button>
        </nav>
      </footer>
    </>
  );
}
