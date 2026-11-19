import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ClipboardPen, Download, Hand, Maximize, Move, Paintbrush,
  Redo2, Undo2, Upload,
} from "lucide-react";
import type { GameState, Terrain } from "../game/types";
import {
  createEditorDraft, getBrushTiles, moveEditorCity, paintEditorTiles, renameEditorCity,
} from "../game/map/editorDraft";
import { STORY_SIZE } from "../game/map/story";
import { representativeTerrain } from "../nations/models";
import GameScene from "../scene/GameScene";
import type { GameSceneProps } from "../scene/GameScene";
import { deserializeGame } from "../store/save";
import "../styles/map-editor.css";

type EditorInput = NonNullable<GameSceneProps["editor"]>;
type Tool = EditorInput["mode"];
type Stroke =
  | { kind: "paint"; before: GameState; lastTile: number }
  | { kind: "city"; source: number };

const draftKey = "surgea.map-editor.v1";
const draftFormat = "surgea-map-draft-v1";
const terrainChoices = [
  ["plain", "平原"], ["forest", "森林"], ["mountain", "山地"], ["shallow", "浅水"], ["deep", "深海"],
] satisfies [Terrain, string][];
const tools = [
  { mode: "pan", label: "平移", Icon: Hand },
  { mode: "paint", label: "笔刷", Icon: Paintbrush },
  { mode: "city", label: "移动城市", Icon: Move },
] as const;
const noOrders: string[] = [];
const ignoreBoardTap = () => {};

function serializeDraft(game: GameState) {
  return JSON.stringify({ format: draftFormat, game });
}

function deserializeDraft(raw: string) {
  if (raw.length > 8_000_000) throw new Error("地图文件过大。");
  const data = JSON.parse(raw);
  if (data?.format !== draftFormat) throw new Error("请选择地图编辑器导出的 JSON 文件。");
  const game = deserializeGame(JSON.stringify({ format: "autumn-v2", game: data.game }));
  if (game.options.scenario !== "story" || game.options.size !== STORY_SIZE || game.units.length ||
    game.cities.some(city => !city.name.trim()) ||
    new Set(game.cities.map(city => city.name)).size !== game.cities.length) {
    throw new Error("地图草稿不完整。");
  }
  return game;
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(draftKey);
    if (raw) return deserializeDraft(raw);
  } catch {
    // A damaged draft can still be replaced by a newly edited blueprint.
  }
  return createEditorDraft();
}

function sweptBrushTiles(size: number, from: number, to: number, radius: number) {
  const x = from % size, y = Math.floor(from / size);
  const dx = to % size - x, dy = Math.floor(to / size) - y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  if (steps === 0) return getBrushTiles(size, to, radius);
  const painted = new Set<number>();
  for (let step = 0; step <= steps; step++) {
    const column = Math.round(x + dx * step / steps);
    const row = Math.round(y + dy * step / steps);
    for (const tile of getBrushTiles(size, row * size + column, radius)) painted.add(tile);
  }
  return [...painted];
}

export function MapEditor({ onClose }: { onClose: () => void }) {
  const [draft, setDraft] = useState(loadDraft);
  const current = useRef(draft);
  const gesture = useRef<Stroke | null>(null);
  const [mode, setMode] = useState<Tool>("pan");
  const [terrain, setTerrain] = useState<Terrain>("plain");
  const [radius, setRadius] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [cityId, setCityId] = useState("");
  const [name, setName] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [undo, setUndo] = useState<GameState[]>([]);
  const [redo, setRedo] = useState<GameState[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const selectedCity = draft.cities.find(city => city.id === cityId);
  const size = draft.options.size;
  const cityOptions = useMemo(() => [...draft.cities].sort((a, b) => a.name.localeCompare(b.name, "zh-Hans")), [draft.cities]);

  const publish = useCallback((next: GameState) => {
    if (next === current.current) return;
    current.current = next;
    setDraft(next);
  }, []);

  const save = useCallback((next: GameState, message = "") => {
    try {
      localStorage.setItem(draftKey, serializeDraft(next));
      setFeedback(message);
    } catch {
      setFeedback("本机保存失败，可导出地图文件。");
    }
  }, []);

  const commit = useCallback((before: GameState, next: GameState, message?: string) => {
    if (before === next) return;
    publish(next);
    setUndo(entries => [...entries.slice(-29), before]);
    setRedo([]);
    save(next, message);
  }, [publish, save]);

  const cancel = useCallback(() => {
    const active = gesture.current;
    gesture.current = null;
    setHover(null);
    if (active?.kind === "paint") publish(active.before);
  }, [publish]);

  const selectCity = useCallback((id: string) => {
    setCityId(id);
    setName(current.current.cities.find(city => city.id === id)?.name ?? "");
  }, []);

  const onPointer = useCallback<EditorInput["onPointer"]>((phase, tileId) => {
    if (phase === "cancel") {
      cancel();
      return;
    }
    if (mode === "pan") return;
    setHover(tileId);
    if (mode === "paint") {
      if (phase === "start" && tileId !== null) {
        gesture.current = { kind: "paint", before: current.current, lastTile: tileId };
        publish(paintEditorTiles(current.current, getBrushTiles(size, tileId, radius), terrain));
        return;
      }
      const active = gesture.current;
      if (active?.kind !== "paint") return;
      if (tileId !== null && active.lastTile !== tileId) {
        const area = sweptBrushTiles(size, active.lastTile, tileId, radius);
        publish(paintEditorTiles(current.current, area, terrain));
        active.lastTile = tileId;
      }
      if (phase === "end") {
        gesture.current = null;
        commit(active.before, current.current);
      }
      return;
    }
    if (phase === "start") {
      const id = tileId === null ? null : current.current.tiles[tileId]?.cityId;
      if (!id || tileId === null) return;
      selectCity(id);
      gesture.current = { kind: "city", source: tileId };
      setFeedback("");
      return;
    }
    const active = gesture.current;
    if (active?.kind !== "city") return;
    if (phase === "end") {
      gesture.current = null;
      setHover(null);
      const before = current.current;
      if (tileId === null || active.source === tileId) return;
      const next = moveEditorCity(before, active.source, tileId);
      if (next === before) setFeedback("请选择未被占用的陆地。");
      else commit(before, next);
    }
  }, [cancel, commit, mode, publish, radius, selectCity, size, terrain]);

  const editor = useMemo<EditorInput>(() => ({ mode, onPointer }), [mode, onPointer]);
  const highlights = useMemo(() => {
    if (hover === null) return [];
    if (mode === "paint") return getBrushTiles(size, hover, radius).filter(id =>
      !draft.tiles[id].cityId && !draft.tiles[id].lighthouse,
    );
    if (mode === "city" && gesture.current?.kind === "city") return [hover];
    return [];
  }, [draft.tiles, hover, mode, radius, size]);

  const restore = useCallback((direction: "undo" | "redo") => {
    const stack = direction === "undo" ? undo : redo;
    const next = stack.at(-1);
    if (!next) return;
    cancel();
    const before = current.current;
    if (direction === "undo") {
      setUndo(undo.slice(0, -1));
      setRedo([...redo, before]);
    } else {
      setRedo(redo.slice(0, -1));
      setUndo([...undo, before]);
    }
    publish(next);
    selectCity(cityId);
    save(next);
  }, [cancel, cityId, publish, redo, save, selectCity, undo]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z" ||
        (event.target instanceof Element && event.target.closest("input,select,textarea"))) return;
      event.preventDefault();
      restore(event.shiftKey ? "redo" : "undo");
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [restore]);

  function changeTool(tool: Tool) {
    cancel();
    setMode(tool);
    setFeedback("");
  }

  function rename() {
    const before = current.current;
    const next = renameEditorCity(before, cityId, name);
    if (next === before) {
      if (name.trim() !== selectedCity?.name) setFeedback("请输入有效且未使用的城名。");
      return;
    }
    commit(before, next);
    selectCity(cityId);
  }

  function exportFile() {
    const url = URL.createObjectURL(new Blob([serializeDraft(current.current)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "surgea-story-map.json";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importFile(file: File) {
    try {
      if (file.size > 8_000_000) throw new Error("地图文件过大。");
      const imported = deserializeDraft(await file.text());
      cancel();
      commit(current.current, imported, "地图已载入。");
      selectCity("");
      setResetKey(value => value + 1);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "地图无法载入。");
    }
  }

  return (
    <main className="map-editor" aria-label="地图编辑器">
      <header className="map-editor-header">
        <div className="map-editor-heading">
          <button type="button" className="map-editor-back" aria-label="返回主菜单" onClick={onClose}>
            <ArrowLeft aria-hidden size={20} />
          </button>
          <h1>地图编辑器</h1>
          <span className="map-editor-count">{size} × {size} · {draft.cities.length} 城</span>
        </div>
        <div className="map-editor-files">
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={event => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void importFile(file);
            }}
          />
          <button type="button" aria-label="导入地图" onClick={() => fileInput.current?.click()}>
            <Upload aria-hidden size={17} /> <span>导入地图</span>
          </button>
          <button type="button" aria-label="导出地图" onClick={exportFile}>
            <Download aria-hidden size={17} /> <span>导出地图</span>
          </button>
        </div>
      </header>
      <div className="map-editor-board" data-tool={mode}>
        <GameScene
          game={draft}
          preview
          editor={editor}
          selectedTile={mode === "city" && selectedCity ? selectedCity.y * size + selectedCity.x : null}
          selectedUnit={null}
          reachable={highlights}
          attackTargets={noOrders}
          onTileClick={ignoreBoardTap}
          resetKey={resetKey}
          reducedMotion
          showResourceHints={false}
        />
      </div>
      <footer className="map-editor-footer">
        <div className="map-editor-toolbar" role="toolbar" aria-label="地图工具">
          {tools.map(({ mode: tool, label, Icon }) => (
            <button type="button" key={tool} aria-pressed={mode === tool} onClick={() => changeTool(tool)}>
              <Icon aria-hidden size={19} /> {label}
            </button>
          ))}
          <div className="map-editor-history">
            <button type="button" aria-label="撤销" title="撤销" disabled={!undo.length} onClick={() => restore("undo")}><Undo2 aria-hidden size={19} /></button>
            <button type="button" aria-label="重做" title="重做" disabled={!redo.length} onClick={() => restore("redo")}><Redo2 aria-hidden size={19} /></button>
            <button type="button" aria-label="全图" title="全图" onClick={() => setResetKey(value => value + 1)}><Maximize aria-hidden size={18} /></button>
          </div>
        </div>
        <div className="map-editor-options">
          {mode === "paint" && (
            <div className="map-editor-palette" role="group" aria-label="地形">
              {terrainChoices.map(([value, label]) => (
                <button type="button" key={value} aria-pressed={terrain === value} onClick={() => setTerrain(value)}>
                  <i aria-hidden style={{ background: representativeTerrain.shells[value].color }} /> {label}
                </button>
              ))}
              <label className="map-editor-size">
                笔刷大小
                <select aria-label="笔刷大小" value={radius} onChange={event => setRadius(Number(event.target.value))}>
                  {[0, 1, 2, 3].map(value => <option key={value} value={value}>{value * 2 + 1} 格</option>)}
                </select>
              </label>
            </div>
          )}
          {mode === "city" && (
            <form className="map-editor-cities" onSubmit={event => { event.preventDefault(); rename(); }}>
              <select aria-label="选择城市" value={cityId} onChange={event => selectCity(event.target.value)}>
                <option value="">选择城市</option>
                {cityOptions.map(city => <option key={city.id} value={city.id}>{city.name}</option>)}
              </select>
              <input aria-label="城市名称" maxLength={20} placeholder="城市名称" value={name} disabled={!selectedCity} onChange={event => setName(event.target.value)} />
              <button type="submit" disabled={!selectedCity || !name.trim() || name.trim() === selectedCity.name}>
                <ClipboardPen aria-hidden size={17} /> 改名
              </button>
            </form>
          )}
          <p className="map-editor-feedback" role="status">{feedback ||
            (mode === "paint" ? "拖动涂刷地形" : mode === "city" ? "拖动城市调整位置" : "拖动平移 · 滚轮或双指缩放")}</p>
        </div>
      </footer>
    </main>
  );
}
