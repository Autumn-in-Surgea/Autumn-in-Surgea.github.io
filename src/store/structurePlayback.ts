import { getVisibleResource } from "../game/rules/engine";
import type { City, GameState, Tile } from "../game/types";
import { buildingVisualTier, type BuildingVisualTier } from "../scene/buildingVisualTier";

export function buildTileTiers(cities: readonly City[], tileCount: number): Uint8Array {
  const tiers = new Uint8Array(tileCount).fill(1);
  for (const city of cities) {
    const tier = buildingVisualTier(city.level);
    for (const id of city.territory) tiers[id] = tier;
  }
  return tiers;
}

export const hasRoadModel = (tile: Tile) => !!(tile.road || tile.cityId || tile.building === "port" || tile.building === "bridge");
const hasStructure = (tile: Tile) => !!(tile.cityId || tile.building);

export type ModelExchange = "rise" | "sink" | "replace";
export interface StructureChange {
  scenery: ModelExchange | null;
  road: ModelExchange | null;
  previousGame: GameState;
  previousCity?: City;
  previousTier: BuildingVisualTier;
  previousExplored: ReadonlySet<number>;
  delay: number;
}

// Seconds on the board clock. Lowering and raising never overlap.
export const sinkSeconds = 0.36;
export const riseSeconds = 0.54;
export const exchangePause = 0.065;
export function exchangeDuration(exchange: ModelExchange | null) {
  if (exchange === "replace") return sinkSeconds + exchangePause + riseSeconds;
  if (exchange === "rise") return riseSeconds;
  if (exchange === "sink") return sinkSeconds;
  return 0;
}

function exchange(before: boolean, after: boolean): ModelExchange | null {
  if (before) return after ? "replace" : "sink";
  return after ? "rise" : null;
}

function hasScenery(game: GameState, tile: Tile) {
  return hasStructure(tile) || tile.ruin || tile.terrain === "forest" ||
    tile.terrain === "mountain" || !!getVisibleResource(game, tile, 0);
}

function sameCityModel(a: City | undefined, b: City | undefined) {
  return a?.id === b?.id && a?.owner === b?.owner && a?.level === b?.level &&
    a?.capitalOf === b?.capitalOf && !!a?.defenseBonus === !!b?.defenseBonus;
}

/** Diff only the structures the viewer could witness. Reading a save has no action step. */
export function planStructurePlayback(before: GameState, after: GameState) {
  const structures = new Map<number, StructureChange>();
  let structureDuration = 0;
  if (before === after) return { structures, structureDuration };
  const wasVisible = new Set(before.players[0].visible);
  const wasExplored = new Set(before.players[0].explored);
  const oldTiers = buildTileTiers(before.cities, before.tiles.length);
  const newTiers = buildTileTiers(after.cities, after.tiles.length);
  const oldCities = new Map(before.cities.map(city => [city.id, city]));
  const newCities = new Map(after.cities.map(city => [city.id, city]));

  // Each road draws half of every visible connection. Adding or losing a node
  // also changes the silhouette of roads on the eight neighbouring squares.
  const changedConnections = new Set<number>();
  const size = after.options.size;
  for (const id of after.players[0].visible) {
    const wasKnown = wasExplored.has(id);
    if (wasKnown && !wasVisible.has(id)) continue;
    const tile = after.tiles[id];
    if ((wasKnown && hasRoadModel(before.tiles[id])) === hasRoadModel(tile)) continue;
    for (let y = Math.max(0, tile.y - 1); y <= Math.min(size - 1, tile.y + 1); y++)
      for (let x = Math.max(0, tile.x - 1); x <= Math.min(size - 1, tile.x + 1); x++)
        changedConnections.add(y * size + x);
  }

  for (const id of after.players[0].visible) {
    const old = before.tiles[id], tile = after.tiles[id];
    const discovered = !wasExplored.has(id);
    if (!wasVisible.has(id) && !discovered) continue;
    if (!hasRoadModel(tile) && !hasRoadModel(old) && !tile.building && !old.building) continue;
    const oldCity = old.cityId ? oldCities.get(old.cityId) : undefined;
    const newCity = tile.cityId ? newCities.get(tile.cityId) : undefined;
    const tierChanged = oldTiers[id] !== newTiers[id];
    const ownerChanged = old.owner !== tile.owner;
    const sceneryChanged = discovered ? hasStructure(tile) : old.building !== tile.building ||
      !sameCityModel(oldCity, newCity) || (!!tile.building && (tierChanged || ownerChanged));
    const roadChanged = discovered ? hasRoadModel(tile) : hasRoadModel(old) !== hasRoadModel(tile) ||
      (hasRoadModel(tile) && (tierChanged || ownerChanged || changedConnections.has(id)));
    if (!sceneryChanged && !roadChanged) continue;

    const scenery = sceneryChanged ? exchange(!discovered && hasScenery(before, old), !!hasScenery(after, tile)) : null;
    const road = roadChanged ? exchange(!discovered && hasRoadModel(old), hasRoadModel(tile)) : null;
    // Let the revealing fog start to lift before a newly discovered skyline comes up.
    const delay = discovered ? 0.19 : 0;
    structures.set(id, { scenery, road, previousGame: before, previousCity: oldCity,
      previousTier: oldTiers[id] as BuildingVisualTier, previousExplored: wasExplored, delay });
    structureDuration = Math.max(structureDuration, delay + Math.max(exchangeDuration(scenery), exchangeDuration(road)));
  }
  return { structures, structureDuration };
}
