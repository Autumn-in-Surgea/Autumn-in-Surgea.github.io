import { DEFAULT_OPTIONS } from "../data/config";
import { createGame } from "../rules/engine";
import type { GameState, Resource, Terrain } from "../types";

const previewMoves = [
  { name: "孤泉", x: 12, y: 15 },
  { name: "嘉原", x: 18, y: 16 },
  { name: "辽汀", x: 26, y: 11 },
  { name: "丹阳", x: 25, y: 15 },
  { name: "岑阳", x: 16, y: 52 },
  { name: "岚港", x: 25, y: 50 },
] as const;

const resourceTerrain: Record<Resource, Terrain> = {
  fruit: "plain",
  crop: "plain",
  animal: "forest",
  ore: "mountain",
  fish: "shallow",
  starfish: "deep",
};

export function createEditorDraft(): GameState {
  let draft = createGame({ ...DEFAULT_OPTIONS, scenario: "story" });
  const { size } = draft.options;
  draft.units = [];
  draft.events = [];
  for (const tile of draft.tiles) {
    if (!tile.cityId) tile.owner = null;
  }
  // Capital centers retain their owners so the board can use each nation's model.
  for (const city of draft.cities) {
    if (city.owner !== null) city.territory = [city.y * size + city.x];
  }
  for (const { name, x, y } of previewMoves) {
    const city = draft.cities.find(candidate => candidate.name === name);
    if (city) draft = moveEditorCity(draft, city.y * size + city.x, y * size + x);
  }
  return draft;
}

export function getBrushTiles(size: number, center: number, radius: number): number[] {
  if (!Number.isInteger(size) || size <= 0 ||
      !Number.isInteger(center) || center < 0 || center >= size ** 2 ||
      !Number.isInteger(radius) || radius < 0) return [];
  const centerX = center % size, centerY = Math.floor(center / size);
  const result: number[] = [];
  for (let y = Math.max(0, centerY - radius); y <= Math.min(size - 1, centerY + radius); y++) {
    for (let x = Math.max(0, centerX - radius); x <= Math.min(size - 1, centerX + radius); x++) {
      if ((x - centerX) ** 2 + (y - centerY) ** 2 <= radius ** 2)
        result.push(y * size + x);
    }
  }
  return result;
}

export function paintEditorTiles(draft: GameState, tileIds: readonly number[], terrain: Terrain): GameState {
  let tiles: GameState["tiles"] | undefined;
  for (const id of tileIds) {
    const tile = (tiles ?? draft.tiles)[id];
    if (!tile || tile.terrain === terrain || tile.cityId || tile.lighthouse) continue;
    tiles ??= draft.tiles.slice();
    tiles[id] = {
      ...tile,
      terrain,
      resource: tile.resource && resourceTerrain[tile.resource] === terrain ? tile.resource : null,
      ruin: tile.ruin && (terrain === "plain" || terrain === "forest"),
    };
  }
  return tiles ? { ...draft, tiles } : draft;
}

export function moveEditorCity(draft: GameState, from: number, to: number): GameState {
  const source = draft.tiles[from], destination = draft.tiles[to];
  if (!source?.cityId || !destination || destination.cityId || destination.lighthouse ||
      destination.terrain === "deep" || destination.terrain === "shallow") return draft;
  const index = draft.cities.findIndex(city => city.id === source.cityId);
  if (index < 0) return draft;
  const city = draft.cities[index];
  const cities = draft.cities.slice();
  const tiles = draft.tiles.slice();
  cities[index] = {
    ...city,
    x: destination.x,
    y: destination.y,
    territory: city.owner === null ? [] : [to],
  };
  tiles[from] = { ...source, cityId: null, owner: null };
  tiles[to] = {
    ...destination,
    terrain: "plain",
    resource: null,
    ruin: false,
    cityId: city.id,
    owner: city.owner,
  };
  return { ...draft, cities, tiles };
}

export function renameEditorCity(draft: GameState, cityId: string, name: string): GameState {
  const title = name.trim();
  if (!title || draft.cities.some(city => city.name === title)) return draft;
  const index = draft.cities.findIndex(city => city.id === cityId);
  if (index < 0) return draft;
  const cities = draft.cities.slice();
  cities[index] = { ...cities[index], name: title };
  return { ...draft, cities };
}
