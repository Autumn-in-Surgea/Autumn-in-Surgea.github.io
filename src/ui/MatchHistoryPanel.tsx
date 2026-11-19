import { useRef, useState } from "react";
import { Check, ChevronDown, Copy, Download, Save, Upload } from "lucide-react";
import { OPENING_PROFILES } from "../game";
import type { GameOptions } from "../game/types";
import { getNation } from "../nations/registry";
import { hasSavedGame, useGameStore } from "../store/gameStore";
import { Modal } from "./Common";
import { mapLabels, scenarioLabels } from "./Menu";
import "./match-history.css";

const timestamp = new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" });
const spawnLabels = { balanced: "均匀分布", random: "随机", custom: "手动设置" };
const percent = (value: number) => `${Math.round(value * 1000) / 10}%`;

async function copySeed(seed: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(seed);
      return true;
    }
  } catch {
    // Clipboard access can be denied by the browser or embedding context.
  }
  const field = document.createElement("textarea");
  const previousFocus = document.activeElement;
  field.value = seed;
  field.readOnly = true;
  field.inputMode = "none";
  field.className = "match-history-clipboard";
  document.body.append(field);
  field.focus({ preventScroll: true });
  field.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
    if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
  }
}

function FreeSettings({ options }: { options: GameOptions }) {
  const map = options.mapSettings;
  const generation = [
    ["陆地比例", percent(map.landRatio)],
    ["森林比例", percent(map.forestRatio)],
    ["山地比例", percent(map.mountainRatio)],
    ["非矿资源密度", percent(map.resourceDensity)],
    ["村庄密度", percent(map.villageDensity)],
    ["噪声频率", map.noiseScale],
    ["出生点", spawnLabels[map.spawnMode]],
  ] as const;

  return (
    <details className="match-history-details">
      <summary><ChevronDown size={16} aria-hidden="true" />地图与阵营设置</summary>
      <dl>
        {generation.map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
      <ul className="match-history-factions">
        {Array.from({ length: options.aiCount + 1 }, (_, index) => {
          const nation = index === 0 ? getNation(options.civilization) : undefined;
          const profile = OPENING_PROFILES.find(({ id }) => id === options.startingProfiles[index]);
          const spawn = map.spawnMode === "custom" ? map.customSpawns[index] : undefined;
          return (
            <li key={index}>
              <strong>{index ? `AI ${index}` : "玩家"}</strong>
              <span>{(nation?.name ?? options.factionNames[index]) || "随机阵营"}</span>
              {!nation && <span>{profile?.name || "随机开局"}</span>}
              {spawn && <code>({spawn.x + 1}, {spawn.y + 1})</code>}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

export function MatchHistoryPanel({ onClose }: { onClose: () => void }) {
  const history = useGameStore(state => state.matchHistory);
  const hasGame = useGameStore(state => !!state.game);
  const busy = useGameStore(state => state.busy || !!state.playbackStep);
  const [reading, setReading] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [copied, setCopied] = useState<{ index: number; ok: boolean }>();
  const file = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const unavailable = busy || reading;
  const hasSave = hasGame || hasSavedGame();

  function close() {
    request.current++;
    onClose();
  }

  function takeNotice(fallback: string) {
    const { notice, setNotice } = useGameStore.getState();
    setSaveStatus(notice || fallback);
    if (notice) setNotice("");
  }

  function saveGame() {
    const saved = useGameStore.getState().save();
    takeNotice(saved ? "已保存存档。" : "保存失败。");
  }

  function exportFile() {
    const { exportSave, game } = useGameStore.getState();
    const raw = exportSave();
    if (!raw) {
      setSaveStatus("没有可导出的存档。");
      return;
    }
    const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    const seed = game?.options.seed.replace(/[\\/:*?"<>|]/g, "-");
    link.download = game ? `game-${seed}-turn${game.round}.json` : "game-save.json";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setSaveStatus("正在导出存档。");
  }

  async function importFile(selected: File) {
    if (selected.size > 8_000_000) {
      setSaveStatus("存档不能超过 8 MB。");
      return;
    }
    const id = ++request.current;
    setReading(true);
    setSaveStatus("");
    try {
      const raw = await selected.text();
      if (id !== request.current) return;
      if (useGameStore.getState().importSave(raw)) close();
      else takeNotice("存档读取失败。");
    } catch {
      if (id === request.current) setSaveStatus("存档读取失败。");
    } finally {
      if (id === request.current) setReading(false);
    }
  }

  return (
    <Modal title="对局历史" onClose={close} menuSurface>
      <section className="match-history-save" aria-label="存档">
        <div className="match-history-actions">
          <button className="secondary" type="button" disabled={unavailable || !hasSave} onClick={saveGame}>
            <Save size={16} aria-hidden="true" />保存
          </button>
          <button className="secondary" type="button" disabled={unavailable || !hasSave} onClick={exportFile}>
            <Download size={16} aria-hidden="true" />导出存档
          </button>
          <button className="secondary" type="button" disabled={unavailable} onClick={() => file.current?.click()}>
            <Upload size={16} aria-hidden="true" />导入存档
          </button>
        </div>
        <input type="file" accept=".json,application/json" ref={file} hidden
          onChange={event => {
            const selected = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (selected && !unavailable) void importFile(selected);
          }} />
        <p className="match-history-status" role="status">{reading ? "正在导入存档…" : saveStatus}</p>
      </section>
      {history.length ? (
        <ol className="match-history-list" aria-label="最近对局">
          {history.map(({ startedAt, options }, index) => {
            const nation = getNation(options.civilization)?.name;
            const faction = nation ?? options.factionNames[0] ?? "";
            const copy = copied?.index === index ? copied : undefined;
            return (
              <li className="match-history-entry" key={`${startedAt}-${index}`}>
                <header>
                  <h3>{scenarioLabels[options.scenario]}<span>{faction || "随机阵营"}</span></h3>
                  <time dateTime={new Date(startedAt).toISOString()}>{timestamp.format(startedAt)}</time>
                </header>
                <p className="match-history-settings">
                  <span>{mapLabels[options.mapType]} {options.size} × {options.size}</span>
                  <span>{options.aiCount} 个 AI · {options.difficulty === "easy" ? "简单" : "普通"}</span>
                  <span>{options.mode === "score" ? `完美 · ${options.maxRounds} 回合` : "统治"}</span>
                  <span>快速模式 {options.quickMode === false ? "关" : "开"}</span>
                </p>
                <div className="match-history-seed">
                  <span>种子</span>
                  <code>{options.seed}</code>
                  <button className="secondary" type="button" aria-label={`复制种子 ${options.seed}`}
                    onClick={async () => setCopied({ index, ok: await copySeed(options.seed) })}>
                    {copy?.ok ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                    <span aria-live="polite">{copy ? (copy.ok ? "已复制" : "复制失败") : "复制"}</span>
                  </button>
                </div>
                {options.scenario === "free" && <FreeSettings options={options} />}
              </li>
            );
          })}
        </ol>
      ) : <p className="match-history-empty">暂无对局记录。</p>}
    </Modal>
  );
}
