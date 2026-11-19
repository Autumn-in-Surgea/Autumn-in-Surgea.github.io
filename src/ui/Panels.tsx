import { useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  LockKeyhole,
  Volume2,
  Activity,
  HelpCircle,
  Download,
  Upload,
  Save,
  Home,
  ScanLine,
  Building2,
  Gem,
  Palette,
  X,
} from "lucide-react";
import {
  TECHNOLOGIES,
  getActiveUpkeep,
  getIncome,
  getSpendableStars,
  getTechCost,
  getScore,
  validateAction,
  getEmbassyCost,
} from "../game";
import type { Action, GameState, TechDefinition } from "../game/types";
import { useGameStore } from "../store/gameStore";
import { Modal, Cost, ResourceIcon } from "./Common";
import { TechTreeViewport } from "./TechTreeViewport";
import { scenarioLabels } from "./Menu";
import { getNation } from "../nations/registry";
import { NationEmblem } from "./NationEmblem";
import { PwaControls } from "../pwa/PwaControls";

export function StarBudgetPanel({ game, busy, onClose, onCommand }: {
  game: GameState;
  busy: boolean;
  onClose: () => void;
  onCommand: (action: Action) => void;
}) {
  const player = game.players[0];
  const income = getIncome(game, 0);
  const upkeep = getActiveUpkeep(game, 0);
  const spendable = getSpendableStars(game, 0);
  const overspending = !!player.allowOverspend;
  const toggle: Action = { type: "SET_OVERSPEND", enabled: !overspending };
  const netIncome = income - upkeep;
  return (
    <Modal title="星星" onClose={onClose} menuSurface>
      <dl className="star-budget">
        <div className="setting-row"><dt>星星余额</dt><dd>{player.resources}</dd></div>
        <div className="setting-row"><dt>每回合收入</dt><dd>+{income}</dd></div>
        <div className="setting-row"><dt>下次维护费</dt><dd>−{upkeep}</dd></div>
        <div className="setting-row"><dt>净收入</dt><dd>{netIncome < 0 ? `−${-netIncome}` : `+${netIncome}`}</dd></div>
        <div className="setting-row"><dt><strong>可支配星星</strong></dt><dd><strong>{spendable}</strong></dd></div>
      </dl>
      <button type="button" className="setting-row" role="switch" aria-checked={overspending}
        aria-labelledby="overspend-label" aria-describedby="overspend-help"
        disabled={busy || game.currentPlayer !== 0 || !!validateAction(game, toggle)}
        onClick={() => onCommand(toggle)}>
        <Gem size={20} aria-hidden="true" />
        <span><strong id="overspend-label">超支</strong></span>
        <small id="overspend-help">允许动用维护费</small>
        <i className={`toggle ${overspending ? "on" : ""}`} aria-hidden="true" />
      </button>
    </Modal>
  );
}

export function TechPanel({
  game,
  onClose,
  onCommand,
}: {
  game: GameState;
  onClose: () => void;
  onCommand: (a: Action) => void;
}) {
  const player = game.players[0];
  const busy = useGameStore(state => state.busy || !!state.playbackStep || !!state.eventNotice);
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const inspectedButton = useRef<HTMLButtonElement>(null);
  const roots = TECHNOLOGIES.filter((t) => !t.prerequisites.length);
  const nodes: {
    tech: TechDefinition;
    x: number;
    y: number;
    parent?: string;
  }[] = [];
  const point = (angle: number, r: number) => ({
    x: 50 + Math.cos(angle) * r,
    y: 50 + Math.sin(angle) * r,
  });
  roots.forEach((root, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    nodes.push({ tech: root, ...point(angle, 16) });
    const branches = TECHNOLOGIES
      .filter(tech => tech.prerequisites.includes(root.id))
      .map((tech, index) => ({ tech, angle: angle + (index === 0 ? -0.29 : 0.29) }));
    for (const branch of branches)
      nodes.push({ tech: branch.tech, ...point(branch.angle, 30), parent: root.id });
    for (const branch of branches) {
      for (const leaf of TECHNOLOGIES.filter(tech => tech.prerequisites.includes(branch.tech.id))) {
        nodes.push({ tech: leaf, ...point(branch.angle, 43), parent: branch.tech.id });
      }
    }
  });
  const inspected = TECHNOLOGIES.find(tech => tech.id === inspectedId);
  const researched = !!inspected && player.technologies.includes(inspected.id);
  const connected = (tech: TechDefinition) => tech.tier === 1 ||
    tech.prerequisites.some(id => player.technologies.includes(id)) ||
    TECHNOLOGIES.some(child => child.prerequisites.includes(tech.id) && player.technologies.includes(child.id));
  const cannotResearch = !inspected || researched ? null
    : busy || game.currentPlayer !== 0 ? "等待本方行动"
    : validateAction(game, { type: "RESEARCH", techId: inspected.id });
  const prerequisites = inspected?.prerequisites
    .map(id => TECHNOLOGIES.find(tech => tech.id === id)?.name)
    .filter(Boolean)
    .join("、");
  const inspectedHint = researched ? "已研究"
    : inspected && !connected(inspected) && prerequisites ? `先研究${prerequisites}`
    : cannotResearch ?? "再点一次研究";

  return (
    <Modal title="科技树" onClose={onClose} wide menuSurface>
      <TechTreeViewport balance={<>
        <span className="resource-pill">
          <ResourceIcon />
          {getSpendableStars(game, 0)}
        </span>
        <span>
          {player.technologies.length} / {TECHNOLOGIES.length}
        </span>
      </>}>
        <svg
          viewBox="0 0 100 100"
          className="tech-connections"
          aria-hidden="true"
        >
          {nodes.map((n) => {
            const p = n.parent
              ? nodes.find((a) => a.tech.id === n.parent)
              : { x: 50, y: 50 };
            return (
              p && (
                <line
                  key={n.tech.id}
                  x1={p.x}
                  y1={p.y}
                  x2={n.x}
                  y2={n.y}
                  className={
                    player.technologies.includes(n.tech.id) ? "complete" : ""
                  }
                />
              )
            );
          })}
        </svg>
        <div className="tech-center" style={{ borderColor: player.color }}>
          <strong>{player.name}</strong>
          <span>科技</span>
        </div>
        {nodes.map(({ tech, x, y }) => {
          const done = player.technologies.includes(tech.id);
          const ready = connected(tech);
          const selected = inspectedId === tech.id;
          return (
            <button
              type="button"
              key={tech.id}
              data-tier={tech.tier}
              className={`radial-tech ${done ? "researched" : ready ? "researchable" : "locked"}`}
              style={{ left: `${x}%`, top: `${y}%` }}
              aria-pressed={selected}
              aria-controls={selected ? "tech-details" : undefined}
              onKeyDown={event => {
                if (event.repeat && event.key === "Enter") event.preventDefault();
              }}
              onClick={event => {
                if (selected && !done && !cannotResearch) {
                  onCommand({ type: "RESEARCH", techId: tech.id });
                  return;
                }
                inspectedButton.current = event.currentTarget;
                setInspectedId(tech.id);
              }}
            >
              <strong>{tech.name}</strong>
              <span>
                {done ? (
                  <Check size={15} />
                ) : !ready ? (
                  <LockKeyhole size={14} />
                ) : (
                  <Cost value={getTechCost(game, 0, tech.id)} />
                )}
              </span>
            </button>
          );
        })}
      </TechTreeViewport>
      <div className="tech-information">
        {inspected ? (
          <section className="tech-details" id="tech-details" aria-labelledby="tech-details-title" aria-live="polite">
            <h3 id="tech-details-title">{inspected.name}</h3>
            {!researched && <Cost value={getTechCost(game, 0, inspected.id)} />}
            <button type="button" className="tech-details-close" aria-label="关闭科技简介" onClick={() => {
              setInspectedId(null);
              inspectedButton.current?.focus({ preventScroll: true });
            }}><X size={18} aria-hidden="true" /></button>
            <p className="tech-details-description">{inspected.description}</p>
            <p className="tech-details-hint">{inspectedHint}</p>
          </section>
        ) : (
          <div className="tech-legend">
            <span><i className="researched-dot" />已研究</span>
            <span><i className="researchable-dot" />可研究</span>
            <span><LockKeyhole size={12} />未解锁</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function DiplomacyPanel({
  game,
  onClose,
  onCommand,
}: {
  game: GameState;
  onClose: () => void;
  onCommand: (a: Action) => void;
}) {
  const player = game.players[0];
  const others = game.players.filter(
    (p) => p.id !== 0 && player.metPlayers.includes(p.id),
  );
  const button = (action: Action, label: string, cost?: number) => {
    const reason = validateAction(game, action);
    return (
      <button
        className="secondary"
        disabled={!!reason || game.currentPlayer !== 0}
        title={reason || label}
        onClick={() => onCommand(action)}
      >
        {label}
        {cost !== undefined && <Cost value={cost} />}
      </button>
    );
  };
  return (
    <Modal title="外交" onClose={onClose} menuSurface>
      <div className="diplomacy-body">
        {others.length ? (
          others.map((p) => {
            const nation = getNation(p.civilization);
            return (
              <article className="diplomacy-row" key={p.id}>
                <header>
                  {nation ? <NationEmblem nation={nation} /> : <i style={{ background: p.color }} />}
                  <h3 className="nation-name">
                    {p.name}
                    {nation && <small lang="en">{nation.english}</small>}
                  </h3>
                  <span>
                    {p.eliminated
                      ? "已消灭"
                      : player.peaceWith.includes(p.id)
                        ? "和平"
                        : "战争"}
                  </span>
                </header>
                {!p.eliminated && (
                  <div>
                    {player.peaceWith.includes(p.id)
                      ? button(
                          { type: "BREAK_PEACE", targetPlayer: p.id },
                          "解除和平",
                        )
                      : button(
                          { type: "PEACE", targetPlayer: p.id },
                          player.peaceOffers.includes(p.id)
                            ? "接受和平"
                            : p.peaceOffers.includes(0)
                              ? "已提议和平"
                              : "提议和平",
                        )}
                    {player.embassies.includes(p.id) ? (
                      <span className="embassy-label">
                        <Building2 size={15} />
                        已建大使馆
                      </span>
                    ) : (
                      button(
                        { type: "EMBASSY", targetPlayer: p.id },
                        "大使馆",
                        getEmbassyCost(game, 0),
                      )
                    )}
                  </div>
                )}
              </article>
            );
          })
        ) : (
          <p>尚未发现其他阵营。</p>
        )}
      </div>
    </Modal>
  );
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { game, screen, settings, updateSettings, save, exportSave, menu, importSave, busy, playbackStep, eventNotice, resetCamera } =
    useGameStore();
  const file = useRef<HTMLInputElement>(null);
  const exportFile = () => {
    if (!game) return;
    const raw = exportSave();
    if (!raw) return;
    const url = URL.createObjectURL(
      new Blob([raw], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `game-${game.options.seed}-turn${game.round}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <Modal title="设置" onClose={onClose} menuSurface>
      <div className="settings-body">
        <PwaControls canUpdate={!busy && !playbackStep && !eventNotice} beforeUpdate={save} />
        <div className="setting-row menu-theme-setting">
          <Palette size={20} aria-hidden="true" />
          <span><strong id="menu-theme-label">界面主题</strong></span>
          <div className="menu-theme-options" role="group" aria-labelledby="menu-theme-label">
            {([
              ["system", "跟随系统"],
              ["light", "浅色"],
              ["dark", "深色"],
            ] as const).map(([menuTheme, label]) => (
              <button type="button" key={menuTheme}
                aria-pressed={settings.menuTheme === menuTheme}
                onClick={() => updateSettings({ menuTheme })}
              >{label}</button>
            ))}
          </div>
        </div>
        {(
          [
            { key: "showResources", icon: Gem, title: "资源显示" },
            { key: "sound", icon: Volume2, title: "音效" },
            { key: "reducedMotion", icon: Activity, title: "减少动画" },
            { key: "showHints", icon: HelpCircle, title: "操作提示" },
          ] as const
        ).map(({ key, icon: Icon, title }) => (
          <button
            key={key}
            className="setting-row"
            role="switch"
            aria-checked={settings[key]}
            onClick={() => updateSettings({ [key]: !settings[key] })}
          >
            <Icon size={20} aria-hidden="true" />
            <span>
              <strong>{title}</strong>
            </span>
            <i className={`toggle ${settings[key] ? "on" : ""}`} aria-hidden="true" />
          </button>
        ))}
        <label className="setting-row">
          <Building2 size={20} aria-hidden="true" />
          <span><strong id="city-details-label">详细信息</strong></span>
          <select
            aria-labelledby="city-details-label"
            value={settings.cityDetails}
            onChange={(e) => updateSettings({ cityDetails: e.target.value === "panel" ? "panel" : "map" })}
          >
            <option value="map">地图标签</option>
            <option value="panel">选择面板</option>
          </select>
        </label>
        {game && (
          <div className="save-actions">
            <button
              className="secondary"
              onClick={() => {
                save();
                onClose();
              }}
            >
              <Save size={16} />
              保存
            </button>
            <button className="secondary" onClick={exportFile}>
              <Download size={16} />
              导出存档
            </button>
          </div>
        )}
        <input
          type="file"
          accept=".json,application/json"
          hidden
          ref={file}
          onChange={async (e) => {
            const selected = e.target.files?.[0];
            if (selected) {
              if (selected.size > 8_000_000) {
                useGameStore.getState().setNotice("存档不能超过 8 MB。");
                return;
              }
              importSave(await selected.text());
              onClose();
            }
          }}
        />
        <button className="text-action" onClick={() => file.current?.click()}>
          <Upload size={16} />
          导入存档
        </button>
        {game && (
          <>
            <div className="settings-game">
              <span>{scenarioLabels[game.options.scenario]}</span>
              <code>{game.options.seed}</code>
              <span>
                {game.options.size} × {game.options.size} ·{" "}
                {game.options.mode === "conquest" ? "统治" : "完美"}
              </span>
            </div>
            <button
              className="secondary full"
              onClick={() => {
                menu();
                onClose();
              }}
            >
              <Home size={17} />
              返回主菜单
            </button>
            {screen === "game" && (
              <button
                className="text-action"
                onClick={() => {
                  resetCamera();
                  onClose();
                }}
              >
                <ScanLine size={16} />
                重置视角
              </button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

export function ResultsPanel({
  game,
  onClose,
}: {
  game: GameState;
  onClose: () => void;
}) {
  const menu = useGameStore((s) => s.menu),
    win = game.winner === 0;
  return (
    <Modal
      title={win ? "胜利" : game.winner === null ? "对局结束" : "失败"}
      onClose={onClose}
      menuSurface
    >
      <div className="results-content">
        <p>
          {game.winner !== null
            ? `${game.players[game.winner]?.name} 获胜`
            : ""}
        </p>
        <div className="result-stats">
          <div>
            <strong>{game.round}</strong>
            <span>回合</span>
          </div>
          <div>
            <strong>{getScore(game, 0)}</strong>
            <span>分数</span>
          </div>
          <div>
            <strong>{game.players[0].stats.kills}</strong>
            <span>击败单位</span>
          </div>
        </div>
        <div className="ranking">
          {[...game.players]
            .sort((a, b) => getScore(game, b.id) - getScore(game, a.id))
            .map((p, i) => (
              <div key={p.id}>
                <span>{i + 1}</span>
                <i style={{ background: p.color }} />
                <strong>
                  {p.name}
                  {p.id === 0 ? " · 你" : ""}
                </strong>
                <span>{getScore(game, p.id)}</span>
              </div>
            ))}
        </div>
        <button className="primary full" onClick={menu}>
          返回主菜单
          <ArrowRight size={18} />
        </button>
        <button className="text-action" onClick={onClose}>
          返回棋盘
        </button>
      </div>
    </Modal>
  );
}
