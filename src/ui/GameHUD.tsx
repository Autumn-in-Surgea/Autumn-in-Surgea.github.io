import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp, BrainCircuit, Building2, Check, Flag, Handshake, LocateFixed,
  Map, Settings2, Trophy, UsersRound, X,
} from "lucide-react";
import { getIncome, getScore, isUnitVisible } from "../game";
import type { Action, GameState } from "../game/types";
import { useGameStore } from "../store/gameStore";
import { Modal, ResourceIcon } from "./Common";
import { mapLabels } from "./Menu";
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
  nextUnit: () => void;
  target: string | null;
}

export function GameHUD({
  selectionRequest, upgradePending, game, onCommand, onTech, onDiplomacy,
  onSettings, nextUnit, target,
}: Props) {
  const {
    selectedTile, selectedUnit, busy, aiError, advanceAI, resetCamera, select,
    settings, updateSettings, notice, setNotice,
  } = useGameStore();
  const [mapOpen, setMapOpen] = useState(false);
  const [lastSelection, setLastSelection] = useState<{ tile: number; unit: string | null } | null>(null);
  const contextActions = useRef<HTMLDivElement>(null);
  const resetContextScroll = useCallback(() => {
    contextActions.current?.scrollTo(0, 0);
  }, []);

  // Retain the outgoing controls for the fade. Inactive content is inert.
  useEffect(() => {
    if (selectedTile !== null) {
      setLastSelection({ tile: selectedTile, unit: selectedUnit });
      return;
    }
    const timer = window.setTimeout(() => setLastSelection(null), 160);
    return () => window.clearTimeout(timer);
  }, [selectedTile, selectedUnit]);

  const active = selectedTile !== null;
  const contextTile = selectedTile ?? lastSelection?.tile ?? null;
  const contextUnit = active ? selectedUnit : lastSelection?.unit;
  const unit = game.units.find(candidate =>
    candidate.id === contextUnit && isUnitVisible(game, candidate, 0),
  );
  const city = contextTile === null ? undefined : game.cities.find(candidate =>
    candidate.id === game.tiles[contextTile].cityId,
  );
  const attackTarget = game.units.find(candidate =>
    candidate.id === target && isUnitVisible(game, candidate, 0),
  );
  const income = getIncome(game, 0);
  const cities = game.cities.filter(city => city.owner === 0).length;
  const units = game.units.filter(unit => unit.owner === 0).length;
  const score = getScore(game, 0);
  const turnLabel = busy ? "等待对手" : upgradePending ? "选择升级奖励" : "结束回合";
  const canEndTurn = !busy && game.status === "playing" && game.currentPlayer === 0;
  const showHint = settings.showHints && !active && !notice && !aiError;

  function closeSelection() {
    select(null);
  }

  return (
    <>
      <header className="hud-statbar" aria-label="对局统计">
        <div className="hud-statbar-inner">
          <div className="hud-stat hud-round" aria-label={`第 ${game.round} 回合`}>
            <span>回合</span><strong>{game.round}</strong>
            {game.options.mode === "score" && <span>/30</span>}
          </div>
          <div className="hud-stat hud-stars" aria-label={`${game.players[0].resources} 星星，每回合收入 ${income}`}>
            <ResourceIcon size={18} /><strong>{game.players[0].resources}</strong>
            <span className="hud-yield">+{income}</span>
          </div>
          <div className="hud-stat" aria-label={`${cities} 座城市`}>
            <Building2 size={17} aria-hidden="true" />
            <strong>{cities}</strong>
          </div>
          <div className="hud-stat" aria-label={`${units} 个单位`}>
            <UsersRound size={17} aria-hidden="true" />
            <strong>{units}</strong>
          </div>
          <div className="hud-stat" aria-label={`分数 ${score}`}>
            <Trophy size={17} aria-hidden="true" /><strong>{score}</strong>
          </div>
        </div>
      </header>
      <footer className="hud-command-bar" aria-label="对局操作">
        <div className="hud-command-inner">
          {(aiError || notice || showHint) && (
            <div className="hud-feedback" role={aiError ? "alert" : "status"}>
              <span title={aiError || notice || undefined}>{aiError || notice || "点击单位，再点击高亮地块移动。"}</span>
              {aiError ? (
                <button type="button" onClick={advanceAI}>重试 AI 回合</button>
              ) : (
                <button type="button"
                  aria-label={showHint ? "隐藏提示" : "关闭通知"}
                  onClick={() => showHint ? updateSettings({ showHints: false }) : setNotice("")}
                ><X size={16} /></button>
              )}
            </div>
          )}
          <div className="hud-command-lanes">
            <nav className="hud-command-lane hud-main-actions" aria-label="对局菜单"
              data-active={!active} inert={active} aria-hidden={active}>
              <HudAction icon={BrainCircuit} label="科技" title="科技树 (T)" onClick={onTech} />
              <HudAction icon={Flag} label="单位" title="下一单位 (N)" onClick={nextUnit} />
              <HudAction icon={Handshake} label="外交" onClick={onDiplomacy} />
              <HudAction icon={Map} label="地图" onClick={() => setMapOpen(true)} />
              <HudAction icon={Settings2} label="设置" onClick={onSettings} />
            </nav>
            <div ref={contextActions} className="hud-command-lane hud-context-actions" role="group" aria-label="所选对象操作"
              data-active={active} inert={!active} aria-hidden={!active}>
              {contextTile !== null && (
                <SelectionControls
                  key={`${contextTile}-${contextUnit}-${selectionRequest}`}
                  game={game}
                  busy={busy}
                  tileId={contextTile}
                  unit={unit}
                  city={city}
                  target={attackTarget}
                  selectionRequest={selectionRequest}
                  resetScroll={resetContextScroll}
                  onClose={closeSelection}
                  onCommand={onCommand}
                />
              )}
            </div>
          </div>
          <button type="button"
            className="hud-end-turn"
            data-upgrade={upgradePending}
            disabled={!canEndTurn}
            onClick={() => {
              if (!upgradePending) closeSelection();
              onCommand({ type: "END_TURN" });
            }}
          >
            {busy ? <span className="spinner" aria-hidden="true" /> : upgradePending ? <ArrowUp size={22} /> : <Check size={22} />}
            <strong>{turnLabel}</strong>
          </button>
        </div>
      </footer>
      {mapOpen && (
        <Modal title="地图" onClose={() => setMapOpen(false)}>
          <div className="hud-map-page">
            <MiniMap game={game} onChoose={id => {
              select(id, null);
              setMapOpen(false);
            }} />
            <div className="hud-map-commands">
              <span>{mapLabels[game.options.mapType]} · {game.options.size} × {game.options.size}</span>
              <button type="button" className="secondary" onClick={() => {
                closeSelection();
                resetCamera();
                setMapOpen(false);
              }}>
                <LocateFixed size={19} />重置视角
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

const mapPixels = 384;
function MiniMap({ game, onChoose }: { game: GameState; onChoose: (id: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const size = game.options.size;
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const explored = new Set(game.players[0].explored);
    const cell = mapPixels / size;
    for (const tile of game.tiles) {
      ctx.fillStyle = !explored.has(tile.id) ? "#d6dace"
        : tile.cityId ? tile.owner === null ? "#f7f0dc" : game.players[tile.owner].color
        : tile.terrain === "shallow" ? "#88a8a0"
        : tile.terrain === "deep" ? "#527f86"
        : tile.terrain === "mountain" ? "#929989"
        : tile.terrain === "forest" ? "#869d80" : "#b5bb94";
      ctx.fillRect(tile.x * cell, tile.y * cell, Math.ceil(cell), Math.ceil(cell));
    }
  }, [game, size]);
  return (
    <canvas ref={ref} className="hud-map-preview" aria-label="小地图"
      width={mapPixels} height={mapPixels}
      onClick={event => {
        const { left, top, width, height } = event.currentTarget.getBoundingClientRect();
        const x = Math.min(size - 1, Math.floor((event.clientX - left) / width * size));
        const y = Math.min(size - 1, Math.floor((event.clientY - top) / height * size));
        onChoose(y * size + x);
      }}
    />
  );
}
