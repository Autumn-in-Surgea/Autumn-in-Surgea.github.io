import { DEFAULT_TERRAIN_VARIANT, NATIONS } from "../../nations/registry";
import type { CivilizationId, Tile } from "../types";
import { hashSeed, seededRandom, valueNoise } from "./random";
import { LAND, RIDGES, RIVERS, STORY_CITIES, STORY_SIZE, WATER } from "./storyGeography";
import { assignTerrainVariants } from "./terrainVariants";

export { STORY_SIZE } from "./storyGeography";

type Point = readonly [x: number, y: number];

const capitals = new Map(STORY_CITIES.flatMap(city => city.capitalOfCivilization
  ? [[city.capitalOfCivilization, city] as const] : []));
export const STORY_NATIONS = NATIONS.filter(nation => capitals.has(nation.id));
export const STORY_FACTIONS: CivilizationId[] = STORY_NATIONS.map(nation => nation.id);

const atlasSeed = "surgea-east-atlas-v1";
const reliefSeed = hashSeed(atlasSeed);
const northwestShift = 4;
const tileId = (x: number, y: number) => y * STORY_SIZE + x;
const tileTotal = STORY_SIZE ** 2;
const atlasOffset = northwestShift * (STORY_SIZE + 1);
const isLand = (tile: Tile) => tile.terrain !== "deep" && tile.terrain !== "shallow";

function contains(x: number, y: number, polygon: readonly Point[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[j], [bx, by] = polygon[i];
    if ((ay > y) !== (by > y) && x < ax + (bx - ax) * (y - ay) / (by - ay)) inside = !inside;
  }
  return inside;
}

const ridgeSegments = RIDGES.flatMap(line => line.slice(1).map((end, i) => [line[i], end] as const));
function nearRidge(x: number, y: number, width: number) {
  return ridgeSegments.some(([[ax, ay], [bx, by]]) => {
    const dx = bx - ax, dy = by - ay;
    const distance = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    return (x - ax - dx * distance) ** 2 + (y - ay - dy * distance) ** 2 < width ** 2;
  });
}

function riverChannel(path: readonly Point[]) {
  const [x, y] = path[0];
  const channel = [tileId(Math.round(x), Math.round(y))];
  let lastX = Math.round(x), lastY = Math.round(y);
  for (let index = 1; index < path.length; index++) {
    const [ax, ay] = path[index - 1], [bx, by] = path[index];
    const steps = Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)));
    for (let step = 1; step <= steps; step++) {
      const x = Math.round(ax + (bx - ax) * step / steps);
      const y = Math.round(ay + (by - ay) * step / steps);
      // A diagonal segment crosses two tile edges. Include the bend so
      // the channel stays connected edge-to-edge rather than at corners.
      if (x !== lastX) channel.push(tileId(x, lastY));
      if (y !== lastY) channel.push(tileId(x, y));
      lastX = x;
      lastY = y;
    }
  }
  return channel;
}

const authoredRiverChannels = RIVERS.map(riverChannel);
export const STORY_RIVER_CHANNELS: readonly (readonly number[])[] = authoredRiverChannels.map(
  channel => channel.map(id => id - atlasOffset),
);

function nearby(tiles: Tile[], at: { x: number; y: number }, radius: number) {
  const found: Tile[] = [];
  for (let y = Math.max(0, at.y - radius); y < Math.min(STORY_SIZE, at.y + radius + 1); y++)
    for (let x = Math.max(0, at.x - radius); x < Math.min(STORY_SIZE, at.x + radius + 1); x++)
      found.push(tiles[tileId(x, y)]);
  return found;
}

function emptyTile(x: number, y: number, terrain: Tile["terrain"]): Tile {
  return {
    id: tileId(x, y), x, y, terrain,
    terrainVariant: DEFAULT_TERRAIN_VARIANT,
    resource: null,
    owner: null,
    cityId: null,
    building: null,
    road: false,
    ruin: false,
  };
}

function initialLandscape(): Tile[] {
  return Array.from({ length: tileTotal }, (_, id) => {
    const x = id % STORY_SIZE, y = Math.floor(id / STORY_SIZE);
    const land = LAND.some(polygon => contains(x, y, polygon)) && !WATER.some(polygon => contains(x, y, polygon));
    const u = x / STORY_SIZE, v = y / STORY_SIZE;
    const grain = valueNoise(u * 25, v * 25, reliefSeed);
    const moisture = valueNoise(u * 8, v * 8, reliefSeed + 23) * 0.72 + grain * 0.28;
    const ridgeWidth = STORY_SIZE * (0.014 + grain * 0.013 + (u < 0.30 ? 0.008 : 0));
    const forestLine = 0.55 + (u < 0.3125 ? 0.10 : 0) - v * 0.095;
    const terrain = !land ? "deep" : nearRidge(x, y, ridgeWidth) ? "mountain" : moisture > forestLine ? "forest" : "plain";
    return emptyTile(x, y, terrain);
  });
}

function isLighthouseCorner(x: number, y: number) {
  return Math.min(x, STORY_SIZE - 1 - x) <= 1 && Math.min(y, STORY_SIZE - 1 - y) <= 1;
}

function placeAtlas(tiles: Tile[]) {
  // Lighthouse islands stay at the board corners. The fully generated
  // landscape moves as one so its coastline and seeded details stay intact.
  return tiles.map(tile => {
    const { id, x, y } = tile;
    if (isLighthouseCorner(x, y)) return tile;
    const atlasX = x + northwestShift, atlasY = y + northwestShift;
    if (atlasX >= STORY_SIZE || atlasY >= STORY_SIZE || isLighthouseCorner(atlasX, atlasY))
      return emptyTile(x, y, "deep");
    return { ...tiles[tileId(atlasX, atlasY)], id, x, y };
  });
}

/** The author fixes geography and urban centres. A private seed fills woods,
 * resources and ruins without changing the atlas when players change sides. */
export function createStoryMap(civilization: CivilizationId) {
  const tiles = initialLandscape();
  const cityDistance = new Uint8Array(tileTotal).fill(255);
  for (const city of STORY_CITIES)
    for (const tile of nearby(tiles, city, 2))
      cityDistance[tile.id] = Math.min(cityDistance[tile.id], Math.max(Math.abs(city.x - tile.x), Math.abs(city.y - tile.y)));

  for (const channel of authoredRiverChannels) {
    for (const id of channel) {
      if (cityDistance[id] === 0) throw new Error("Story city blocks a river channel.");
      if (isLand(tiles[id])) tiles[id].terrain = "shallow";
    }
  }

  // Place settlements in usable valleys without tearing new holes in the coast.
  for (const city of STORY_CITIES) {
    tiles[tileId(city.x, city.y)].terrain = "plain";
    for (const tile of nearby(tiles, city, 1)) {
      if (tile.terrain === "mountain" && (tile.x === city.x || tile.y === city.y)) tile.terrain = "plain";
    }
  }
  for (const id of [0, STORY_SIZE - 1, tileTotal - STORY_SIZE, tileTotal - 1]) {
    tiles[id].lighthouse = true;
    tiles[id].terrain = "plain";
  }
  for (const tile of tiles)
    if (tile.terrain === "deep" && nearby(tiles, tile, 1).some(isLand)) tile.terrain = "shallow";

  const random = seededRandom(atlasSeed + ":stock");
  for (const tile of tiles) {
    const distance = cityDistance[tile.id];
    if (tile.lighthouse || distance === 0) continue;
    const roll = random();
    if (tile.terrain === "plain" && roll < (distance <= 2 ? 0.35 : 0.10))
      tile.resource = random() < 0.48 ? "fruit" : "crop";
    else if (tile.terrain === "forest" && roll < (distance <= 2 ? 0.32 : 0.16)) tile.resource = "animal";
    else if (tile.terrain === "mountain" && roll < 0.70) tile.resource = "ore";
    else if (tile.terrain === "shallow" && roll < (distance <= 2 ? 0.27 : 0.09)) tile.resource = "fish";
    else if (tile.terrain === "deep" && roll < 0.016) tile.resource = "starfish";
    else if (distance > 1 && (tile.terrain === "plain" || tile.terrain === "forest") && roll > 0.991) tile.ruin = true;
  }

  for (const [nationId, city] of capitals) {
    const outskirts = nearby(tiles, city, 1).filter(tile => cityDistance[tile.id] !== 0);
    const land = outskirts.filter(isLand);
    // Keep the local economic openings of the former story atlas.
    land.slice(0, 3).forEach((tile, index) => {
      tile.terrain = "plain";
      tile.resource = index < 2 ? "fruit" : "crop";
    });
    if (nationId === "ida") {
      const woods = land.find(tile => tile.terrain === "forest") ?? land[3];
      if (woods) {
        woods.terrain = "forest";
        woods.resource = "animal";
      }
    }
    if (nationId === "rina") {
      for (const tile of outskirts.filter(tile => tile.terrain === "shallow").slice(0, 2)) tile.resource = "fish";
    }
  }

  const selected = STORY_NATIONS.find(nation => nation.id === civilization) ?? STORY_NATIONS[0];
  const order = [selected, ...STORY_NATIONS.filter(nation => nation !== selected)];
  const cityTile = (city: { x: number; y: number }) => tileId(city.x, city.y) - atlasOffset;
  const anchors = STORY_NATIONS.map(nation => ({
    tileId: cityTile(capitals.get(nation.id)!),
    terrainVariant: nation.terrainVariant,
  }));
  return {
    tiles: assignTerrainVariants(placeAtlas(tiles), anchors),
    starts: order.map(nation => cityTile(capitals.get(nation.id)!)),
    villages: STORY_CITIES.filter(city => !city.capitalOfCivilization).map(cityTile),
    storyCities: STORY_CITIES.map(city => ({
      tileId: cityTile(city), name: city.name, capitalOfCivilization: city.capitalOfCivilization,
    })),
  };
}
