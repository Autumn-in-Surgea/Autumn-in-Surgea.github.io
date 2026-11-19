import { representativeTerrain } from "../nations/models";
import { useDeferredValue, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Play,
  History,
  Settings2,
  Info,
  Shuffle,
  Check,
  Flag,
  Zap,
} from "lucide-react";
import { GAME_EDITION, GAME_ICON_192, GAME_NAME_EN, GAME_NAME_ZH } from "../branding";
import {
  DEFAULT_OPTIONS, MAP_SIZE_CHOICES, OPENING_PROFILES,
  TECHNOLOGIES, UNITS, opponentLimit,
} from "../game";
import { NATIONS } from "../nations/registry";
import { NationEmblem } from "./NationEmblem";
import { generateMap } from "../game/map/generate";
import { STORY_NATIONS, STORY_SIZE } from "../game/map/story";
import type { GameOptions, MapSettings, Tile } from "../game/types";
import { hasSavedGame, useGameStore } from "../store/gameStore";
import { AnimatedNumber, useNumberMotion } from "./AnimatedNumber";
import { Modal } from "./Common";
import { PwaControls } from "../pwa/PwaControls";
import "../styles/title-screen.css";

export const mapLabels: Record<GameOptions["mapType"], string> = {
  dryland: "旱地",
  lakes: "湖泊",
  continents: "大陆",
  archipelago: "群岛",
  waterworld: "水世界",
};
export const scenarioLabels = {
  fair: "公平模式",
  story: "故事模式",
  free: "自由模式",
};
const randomSeed = () => Math.random().toString(36).slice(2, 10);

export function MainMenu({
  onHistory,
  onSettings,
  onAbout,
}: {
  onHistory: () => void;
  onSettings: () => void;
  onAbout: () => void;
}) {
  const [setup, setSetup] = useState(false);
  const { game, load, resume, busy, save } = useGameStore();
  return (
    <>
      <main className="menu-shell">
        <section className="menu-copy" aria-labelledby="game-title">
          <h1 id="game-title">
            {GAME_NAME_ZH}
            <span lang="en">{GAME_NAME_EN}</span>
          </h1>
          <nav className="menu-actions" aria-label="主菜单">
            <button
              className="menu-start"
              onClick={() => setSetup(true)}
            >
              <ArrowRight aria-hidden="true" size={21} />
              <span>开始新游戏</span>
            </button>
            <button
              disabled={!game && !hasSavedGame()}
              onClick={() => (game ? resume() : load())}
            >
              <Play aria-hidden="true" size={21} />
              <span>继续游戏</span>
            </button>
            <button onClick={onHistory}>
              <History aria-hidden="true" size={21} />
              <span>对局历史</span>
            </button>
            <button onClick={onSettings}>
              <Settings2 aria-hidden="true" size={21} />
              <span>设置</span>
            </button>
            <button onClick={onAbout}>
              <Info aria-hidden="true" size={21} />
              <span>关于</span>
            </button>
          </nav>
        </section>
        <footer className="menu-footer">
          <PwaControls canUpdate={!busy} beforeUpdate={save} />
          <span className="edition">{GAME_EDITION}</span>
        </footer>
      </main>
      {setup && <NewGame onClose={() => setSetup(false)} />}
    </>
  );
}

function NewGame({ onClose }: { onClose: () => void }) {
  const start = useGameStore((s) => s.start);
  const [options, setOptions] = useState<GameOptions>(() => ({
    ...DEFAULT_OPTIONS,
    seed: randomSeed(),
    factionNames: [],
    startingProfiles: [],
    mapSettings: { ...DEFAULT_OPTIONS.mapSettings, customSpawns: [] },
  }));
  const [randomMapSize, setRandomMapSize] = useState(DEFAULT_OPTIONS.size);
  const [error, setError] = useState("");
  const [spawnIndex, setSpawnIndex] = useState(0);
  const sizeControl = useNumberMotion<HTMLSelectElement>(options.size);
  const countControl = useNumberMotion<HTMLSelectElement>(options.aiCount);
  const chosenSpawn = options.mapSettings.customSpawns[spawnIndex];
  const spawnControl = useNumberMotion<HTMLSelectElement>(
    chosenSpawn ? chosenSpawn.y * options.size + chosenSpawn.x + 1 : -spawnIndex,
  );
  const story = options.scenario === "story",
    free = options.scenario === "free";
  const quickMode = options.quickMode !== false;
  const roster = story ? STORY_NATIONS : NATIONS;
  const nation = free ? undefined : roster.find(item => item.id === options.civilization) ?? roster[0];
  const manualSpawns = free && options.mapSettings.spawnMode === "custom";
  const change = (patch: Partial<GameOptions>) => {
    setError("");
    setOptions((o) => ({ ...o, ...patch }));
  };
  const mapChange = (patch: Partial<MapSettings>) => {
    setError("");
    setOptions((o) => ({ ...o, mapSettings: { ...o.mapSettings, ...patch } }));
  };
  const { scenario, civilization, size, mapType, seed, aiCount } = options;
  const { landRatio, forestRatio, mountainRatio, resourceDensity, villageDensity, noiseScale } = options.mapSettings;
  const previewOptions = useMemo<GameOptions>(() => ({
    ...DEFAULT_OPTIONS,
    scenario, civilization, size, mapType, aiCount,
    seed: seed || "preview",
    mapSettings: {
      ...DEFAULT_OPTIONS.mapSettings,
      landRatio, forestRatio, mountainRatio, resourceDensity, villageDensity, noiseScale,
      spawnMode: "balanced",
    },
  }), [scenario, civilization, size, mapType, seed, aiCount, landRatio, forestRatio, mountainRatio,
    resourceDensity, villageDensity, noiseScale]);
  const displayedOptions = useDeferredValue(previewOptions);
  const preview = useMemo(() => {
    if (displayedOptions.scenario === "fair") return null;
    try {
      const map = generateMap(displayedOptions);
      return { tiles: map.tiles, starts: map.starts.map(id => map.tiles[id]) };
    } catch {
      return null;
    }
  }, [displayedOptions]);
  const previewIsCurrent = displayedOptions === previewOptions;
  const setSpawn = (x: number, y: number) => {
    const spawns = options.mapSettings.customSpawns.slice();
    spawns[spawnIndex] = { x, y };
    mapChange({ customSpawns: spawns });
    setSpawnIndex((i) => Math.min(options.aiCount, i + 1));
  };
  const switchScenario = (scenario: GameOptions["scenario"]) => {
    if (scenario === options.scenario) return;
    change({
      scenario,
      size: scenario === "story" ? STORY_SIZE : randomMapSize,
      aiCount: scenario === "story" ? opponentLimit(scenario) : Math.min(options.aiCount, opponentLimit(scenario)),
      mapType: scenario === "story" ? "continents" : options.mapType,
      mapSettings: {
        ...options.mapSettings,
        customSpawns: [],
        spawnMode: "balanced",
      },
    });
    setSpawnIndex(0);
  };
  return (
    <Modal
      title="新游戏"
      onClose={onClose}
      wide
      menuSurface
      footer={
        <>
          {error && (
            <p role="alert" className="setup-error">
              {error}
            </p>
          )}
          <div className="setup-footer">
            <span>
              {options.mode === "conquest" ? "消灭所有对手" : "30 回合后结算分数"}
            </span>
            <button
              className="primary"
              onClick={() => {
                try {
                  start({
                    ...options,
                    civilization: nation?.id ?? "neutral",
                    seed: options.seed.trim() || randomSeed(),
                    maxRounds: 30,
                  });
                  onClose();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "无法生成地图");
                }
              }}
            >
              开始游戏
              <ArrowRight size={18} />
            </button>
          </div>
        </>
      }
    >
      <div className="setup-body new-setup">
        <div className="scenario-tabs" role="group" aria-label="游戏模式">
          {(Object.keys(scenarioLabels) as GameOptions["scenario"][]).map(
            (s) => (
              <button
                key={s}
                className={options.scenario === s ? "selected" : ""}
                aria-pressed={options.scenario === s}
                onClick={() => switchScenario(s)}
              >
                {scenarioLabels[s]}
              </button>
            ),
          )}
        </div>
        {nation && (
          <section className="nation-picker" aria-label="选择国家">
            <div className="civilization-grid" role="group" aria-label="国家">
              {roster.map(c => (
                <button
                  key={c.id}
                  className={`civ-card ${nation.id === c.id ? "selected" : ""}`}
                  style={{ "--civ": c.color } as React.CSSProperties}
                  aria-pressed={nation.id === c.id}
                  onClick={() => change({ civilization: c.id })}
                >
                  <NationEmblem nation={c} className="civ-emblem" />
                  <strong>{c.name}</strong>
                  <small lang="en">{c.english}</small>
                  {nation.id === c.id && <Check className="civ-check" size={15} aria-hidden="true" />}
                </button>
              ))}
            </div>
            <dl className="nation-opening" style={{ borderInlineStartColor: nation.color }} aria-label="开局配置">
              <div>
                <dt>科技</dt>
                <dd>{nation.opening.technologies.map(id => TECHNOLOGIES.find(tech => tech.id === id)?.name ?? id).join("、") || "无"}</dd>
              </div>
              <div><dt>单位</dt><dd>{UNITS[nation.opening.unit].name}</dd></div>
              <div><dt>首都</dt><dd>{nation.capital} · <AnimatedNumber value={nation.opening.cityLevel} /> 级</dd></div>
              <div><dt>星星</dt><dd><AnimatedNumber value={nation.opening.stars} /></dd></div>
            </dl>
          </section>
        )}
        <div className="setup-grid">
          <label>
            <span>地图大小</span>
            <select
              ref={sizeControl}
              className="number-motion-control"
              aria-label="地图大小"
              disabled={story}
              value={options.size}
              onChange={(e) => {
                const size = Number(e.target.value);
                setRandomMapSize(size);
                change({ size });
                mapChange({ customSpawns: [] });
                setSpawnIndex(0);
              }}
            >
              {MAP_SIZE_CHOICES.map((n) => (
                <option key={n} value={n}>
                  {n} × {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>地图类型</span>
            <select
              aria-label="地图类型"
              disabled={story}
              value={options.mapType}
              onChange={(e) => {
                const mapType = e.target.value as GameOptions["mapType"];
                const preset = {
                  dryland: [1, 4],
                  lakes: [0.76, 6],
                  continents: [0.57, 3.2],
                  archipelago: [0.32, 8],
                  waterworld: [0.08, 10],
                }[mapType];
                if (free) setSpawnIndex(0);
                change({
                  mapType,
                  ...(free
                    ? {
                        mapSettings: {
                          ...options.mapSettings,
                          landRatio: preset[0],
                          noiseScale: preset[1],
                          customSpawns: [],
                        },
                      }
                    : {}),
                });
              }}
            >
              {Object.entries(mapLabels).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>AI 对手</span>
            <select
              ref={countControl}
              className="number-motion-control"
              aria-label="AI 对手"
              disabled={story}
              value={options.aiCount}
              onChange={(e) => {
                const aiCount = Number(e.target.value);
                change({
                  aiCount,
                  mapSettings: {
                    ...options.mapSettings,
                    customSpawns: options.mapSettings.customSpawns.slice(
                      0,
                      aiCount + 1,
                    ),
                  },
                });
                setSpawnIndex(0);
              }}
            >
              {Array.from({ length: opponentLimit(options.scenario) }, (_, i) => i + 1).map((n) => (
                <option value={n} key={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>AI 难度</span>
            <select
              value={options.difficulty}
              onChange={(e) =>
                change({
                  difficulty: e.target.value as GameOptions["difficulty"],
                })
              }
            >
              <option value="easy">简单</option>
              <option value="normal">普通</option>
            </select>
          </label>
          <label>
            <span>胜利条件</span>
            <select
              value={options.mode}
              onChange={(e) =>
                change({ mode: e.target.value as GameOptions["mode"] })
              }
            >
              <option value="conquest">统治</option>
              <option value="score">完美 · 30 回合</option>
            </select>
          </label>
          <label>
            <span>随机种子</span>
            <div className="seed-input">
              <input
                aria-label="随机种子"
                disabled={story}
                maxLength={64}
                value={options.seed}
                onChange={(e) => change({ seed: e.target.value })}
              />
              <button
                disabled={story}
                aria-label="生成随机种子"
                onClick={() => change({ seed: randomSeed() })}
              >
                <Shuffle size={16} />
              </button>
            </div>
          </label>
        </div>
        <fieldset className="setup-rules">
          <legend>游戏规则</legend>
          <button
            className="setting-row"
            type="button"
            role="switch"
            aria-labelledby="quick-mode-label"
            aria-describedby="quick-mode-duration"
            aria-checked={quickMode}
            onClick={() => change({ quickMode: !quickMode })}
          >
            <Zap size={20} aria-hidden="true" />
            <span><strong id="quick-mode-label">快速模式</strong></span>
            <small id="quick-mode-duration">{quickMode ? "即时训练" : "分级训练 · 扣维护费"}</small>
            <i className={`toggle ${quickMode ? "on" : ""}`} aria-hidden="true" />
          </button>
        </fieldset>
        {free && (
          <details className="faction-settings" open>
            <summary>
              <Flag size={16} />
              阵营名称
            </summary>
            <div className="faction-inputs">
              {Array.from({ length: options.aiCount + 1 }, (_, i) => (
                <label key={i}>
                  <span>{i === 0 ? "玩家" : `AI ${i}`}</span>
                  <input
                    aria-label={i === 0 ? "玩家阵营名称" : `AI ${i} 阵营名称`}
                    placeholder="随机"
                    maxLength={20}
                    value={options.factionNames[i] || ""}
                    onChange={(e) => {
                      const names = Array.from(
                        { length: options.aiCount + 1 },
                        (_, j) => options.factionNames[j] || "",
                      );
                      names[i] = e.target.value;
                      change({ factionNames: names });
                    }}
                  />
                  <select
                    aria-label={i === 0 ? "玩家开局" : `AI ${i} 开局`}
                    value={options.startingProfiles[i] || "random"}
                    onChange={(e) => {
                      const profiles = Array.from(
                        { length: options.aiCount + 1 },
                        (_, j) => options.startingProfiles[j] || "random",
                      );
                      profiles[i] = e.target.value;
                      change({ startingProfiles: profiles });
                    }}
                  >
                    <option value="random">随机开局</option>
                    {OPENING_PROFILES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </details>
        )}
        {(free || (story && preview)) && (
          <section className={`setup-geography${free ? " setup-geography-free" : ""}`}>
            <h3>{free ? "地图生成" : "地图预览"}</h3>
            <div className="setup-geography-body">
              {free && (
                <div className="generation-settings">
                  {(
                    [
                      ["landRatio", "陆地比例", 0.05, 1, 0.01],
                      ["forestRatio", "森林比例", 0, 0.8, 0.01],
                      ["mountainRatio", "山地比例", 0, 0.4, 0.02],
                      ["resourceDensity", "非矿资源密度", 0.1, 0.9, 0.05],
                      ["villageDensity", "村庄密度", 0.015, 0.08, 0.005],
                      ["noiseScale", "噪声频率", 2, 12, 0.1],
                    ] as const
                  ).map(([key, label, min, max, step]) => (
                    <label key={key}>
                      <span>
                        {label}
                        <b>
                          <AnimatedNumber
                            value={key === "noiseScale" ? options.mapSettings[key] : Math.round(options.mapSettings[key] * 1000) / 10}
                            suffix={key === "noiseScale" ? undefined : "%"}
                          />
                        </b>
                      </span>
                      <input
                        aria-label={label}
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={options.mapSettings[key]}
                        onChange={(e) =>
                          mapChange({ [key]: Number(e.target.value) })
                        }
                      />
                    </label>
                  ))}
                  <label className="spawn-mode">
                    <span>出生点</span>
                    <select
                      aria-label="出生点"
                      value={options.mapSettings.spawnMode}
                      onChange={(e) =>
                        mapChange({
                          spawnMode: e.target.value as MapSettings["spawnMode"],
                        })
                      }
                    >
                      <option value="balanced">均匀分布</option>
                      <option value="random">随机</option>
                      <option value="custom">手动设置</option>
                    </select>
                  </label>
                </div>
              )}
              {preview && (
                <div className="setup-map-column">
                  {manualSpawns && (
                    <div className="spawn-editor">
                      <label>
                        设置出生点
                        <select
                          ref={spawnControl}
                          className="number-motion-control"
                          aria-label="选择出生玩家"
                          value={spawnIndex}
                          onChange={(e) => setSpawnIndex(Number(e.target.value))}
                        >
                          {Array.from({ length: options.aiCount + 1 }, (_, i) => (
                            <option value={i} key={i}>
                              {i === 0 ? "玩家" : `AI ${i}`}{" "}
                              {options.mapSettings.customSpawns[i]
                                ? `(${options.mapSettings.customSpawns[i].x + 1}, ${options.mapSettings.customSpawns[i].y + 1})`
                                : "未设置"}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p>点击地图上的平原或森林。</p>
                    </div>
                  )}
                  <MapPreview
                    tiles={preview.tiles}
                    size={displayedOptions.size}
                    starts={manualSpawns && previewIsCurrent ? options.mapSettings.customSpawns : preview.starts}
                    editable={manualSpawns && previewIsCurrent}
                    onSelect={setSpawn}
                  />
                  <span className="setup-map-label">
                    {displayedOptions.scenario === "story" ? "固定地图" : mapLabels[displayedOptions.mapType]} ·{" "}
                    <AnimatedNumber value={displayedOptions.size} /> × <AnimatedNumber value={displayedOptions.size} />
                  </span>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}

function MapPreview({
  tiles,
  size,
  starts,
  editable,
  onSelect,
}: {
  tiles: Tile[];
  size: number;
  starts: { x: number; y: number }[];
  editable: boolean;
  onSelect: (x: number, y: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const w = 480 / size;
    ctx.clearRect(0, 0, 480, 480);
    for (const t of tiles) {
      ctx.fillStyle = representativeTerrain.shells[t.terrain].color;
      ctx.fillRect(t.x * w, t.y * w, Math.ceil(w), Math.ceil(w));
    }
    starts.forEach((p, i) => {
      if (!p) return;
      ctx.fillStyle = i === 0 ? "#f7f0ce" : "#343b37";
      ctx.beginPath();
      ctx.arc(
        (p.x + 0.5) * w,
        (p.y + 0.5) * w,
        Math.max(7, w * 0.48),
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.fillStyle = i === 0 ? "#343b37" : "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText(String(i + 1), (p.x + 0.5) * w, (p.y + 0.5) * w);
    });
  }, [tiles, size, starts]);
  return (
    <canvas
      className={`setup-map ${editable ? "editable" : ""}`}
      ref={ref}
      width={480}
      height={480}
      aria-label={editable ? "点击地图设置出生点" : "地图预览"}
      onClick={(e) => {
        if (!editable) return;
        const r = e.currentTarget.getBoundingClientRect();
        onSelect(
          Math.min(
            size - 1,
            Math.floor(((e.clientX - r.left) / r.width) * size),
          ),
          Math.min(
            size - 1,
            Math.floor(((e.clientY - r.top) / r.height) * size),
          ),
        );
      }}
    />
  );
}

export function About({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="关于" onClose={onClose} menuSurface>
      <div className="about-body">
        <img className="about-mark" src={`${import.meta.env.BASE_URL}${GAME_ICON_192}`} width={82} height={82} alt="" />
        <h3>
          {GAME_NAME_ZH} · <span lang="en">{GAME_NAME_EN}</span>
        </h3>
        <p>
          离线回合制策略游戏原型。标准科技、单位、城市和战斗规则参考 The Battle
          of Polytopia 的公开资料。
        </p>
        <p>
          故事模式使用固定地图和世界观名称。自由模式支持地图参数和手动出生点。公平模式使用标准地图，可选择与故事模式相同的五个国家。
        </p>
        <p>代码、界面和几何模型独立制作。此项目不是官方产品。</p>
        <a
          href="https://wiki.polytopia.com/wiki/technology"
          target="_blank"
          rel="noreferrer"
        >
          规则参考：Polytopia Wiki
        </a>
      </div>
    </Modal>
  );
}
