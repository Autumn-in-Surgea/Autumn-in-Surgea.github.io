import { useEffect, useMemo } from "react";
import type { BufferGeometry } from "three";
import { isWater } from "../game/map/generate";
import type { Tile } from "../game/types";
import { hasRoadModel } from "../store/structurePlayback";
import { roadSurfaceHeight, type BuildingVisualTier } from "./buildingVisualTier";
import { Miniature } from "./miniature";
import { terrainHeight } from "./terrainElevation";
import { useTerritoryMaterial } from "./territoryMaterials";

const directions = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
const flatRoads = new Map<number, BufferGeometry>();
const seamWidth = 0.092;
const roadTints = {
  1: { width: 0.091, shoulder: "#8a6d4f", paving: "#bd9a70", seam: "#a8845f" },
  2: { width: 0.108, shoulder: "#8a7964", paving: "#b8aa93", seam: "#9d907b" },
  3: { width: 0.126, shoulder: "#806f62", paving: "#c7b7a0", seam: "#a99883" },
};
type RoadFinish = typeof roadTints[BuildingVisualTier];
type Point = [number, number, number];
interface End {
  position: Point;
  width: number;
}

function roadStroke(m: Miniature, a: End, b: End, finish: RoadFinish, tier: BuildingVisualTier) {
  const start = a.position, end = b.position;
  // Bend through the tile's interior with perpendicular joins at tile seams.
  const controlA = start.map((value, axis) => axis === 1 ? 0 : value * 0.43);
  const controlB = end.map((value, axis) => axis === 1 ? 0 : value * 0.43);
  function center(t: number): Point {
    const u = 1 - t;
    return [0, 1, 2].map(i => u ** 3 * start[i] + 3 * u ** 2 * t * controlA[i] +
      3 * u * t ** 2 * controlB[i] + t ** 3 * end[i]) as Point;
  }
  function edge(t: number, side: number, lift: number): Point {
    const [x, y, z] = center(t);
    const before = center(Math.max(0, t - 0.005)), after = center(Math.min(1, t + 0.005));
    const dx = after[0] - before[0], dz = after[2] - before[2], length = Math.hypot(dx, dz) || 1;
    const widen = Math.sin(t * Math.PI) * 0.72;
    const width = (a.width * (1 - t) + b.width * t) * (1 - widen) + finish.width * widen;
    const offset = side * width / (2 * length);
    return [x + dz * offset, y + lift, z - dx * offset];
  }
  function strip(t: number, next: number, width: number, lift: number, color: string) {
    m.face(color, [edge(t, -width, lift), edge(next, -width, lift),
      edge(next, width, lift), edge(t, width, lift)]);
  }
  const segments = 8;
  for (let i = 0; i < segments; i++) {
    const t = i / segments, next = (i + 1) / segments;
    strip(t, next, 1, 0.004, finish.shoulder);
    strip(t, next, 0.74, roadSurfaceHeight, finish.paving);
    for (const side of [-1, 1]) {
      const outer = edge(t, side, 0.004), outerNext = edge(next, side, 0.004);
      m.face(finish.shoulder, side < 0
        ? [outer, outerNext, edge(next, side * 0.74, roadSurfaceHeight), edge(t, side * 0.74, roadSurfaceHeight)]
        : [edge(t, side * 0.74, roadSurfaceHeight), edge(next, side * 0.74, roadSurfaceHeight), outerNext, outer]);
      if (outer[1] <= 0.0041 && outerNext[1] <= 0.0041) continue;
      const footing: Point[] = [[outer[0], 0.001, outer[2]], [outerNext[0], 0.001, outerNext[2]], outerNext, outer];
      m.face(finish.shoulder, side < 0 ? footing.reverse() : footing);
    }
  }
  // Tiny surface joints read as gravel or paving and add no raised details.
  const joints = tier === 1 ? [0.34, 0.71] : [0.18, 0.39, 0.59, 0.8];
  for (const [index, t] of joints.entries()) {
    const width = tier === 1 ? 0.30 : index % 2 ? 0.60 : 0.71;
    strip(t, t + 0.011, width, roadSurfaceHeight + 0.001, finish.seam);
  }
}

export function roadGeometry(mask: number, rises: number[], tier: BuildingVisualTier) {
  const m = new Miniature(), finish = roadTints[tier];
  const ends = directions.flatMap(([dx, dz], i): End[] =>
    mask & (1 << i) ? [{ position: [dx / 2, rises[i] || 0, dz / 2], width: seamWidth }] : []);
  const center: End = { position: [0, 0, 0], width: finish.width };
  if (ends.length === 2) {
    roadStroke(m, ends[0], ends[1], finish, tier);
  } else if (ends.length === 1) {
    roadStroke(m, { ...center, width: 0.025 }, ends[0], finish, tier);
  } else if (ends.length) {
    for (const end of ends) roadStroke(m, center, end, finish, tier);
    m.part("disc", finish.paving, 0, roadSurfaceHeight, 0, finish.width * 0.81, 0.001, finish.width * 0.81);
  } else {
    roadStroke(m, { position: [-0.23, 0, -0.16], width: 0.018 },
      { position: [0.22, 0, 0.22], width: 0.024 }, finish, tier);
  }
  return m.finish();
}

export function RoadInlay({ tile, tiles, size, explored, tier }: {
  tile: Tile;
  tiles: Tile[];
  size: number;
  explored: ReadonlySet<number>;
  tier: BuildingVisualTier;
}) {
  const material = useTerritoryMaterial();
  const sea = isWater(tile);
  let mask = 0;
  const rises = Array<number>(8).fill(0);
  const knownRoad = (neighbor: Tile) => explored.has(neighbor.id) && hasRoadModel(neighbor);
  for (const [i, [dx, dz]] of directions.entries()) {
    const x = tile.x + dx, y = tile.y + dz;
    if (x < 0 || y < 0 || x >= size || y >= size) continue;
    const next = tiles[y * size + x];
    if (!knownRoad(next) || (sea && isWater(next))) continue;
    if (dx && dz) {
      const cornerTiles = [tiles[tile.y * size + x], tiles[y * size + tile.x]];
      // Leave square junctions clear when two road surfaces already join at a corner.
      if (cornerTiles.some(corner => knownRoad(corner) &&
        !(isWater(corner) && (sea || isWater(next))))) continue;
    }
    mask |= 1 << i;
    rises[i] = Math.max(0, terrainHeight(next) - terrainHeight(tile));
  }
  const slopeKey = rises.join(",");
  const sloped = rises.some((rise) => rise > 0);
  const geometry = useMemo(() => {
    if (!mask && !tile.road) return null;
    if (sloped) return roadGeometry(mask, slopeKey.split(",").map(Number), tier);
    const key = mask * 3 + tier - 1;
    let cached = flatRoads.get(key);
    if (!cached) {
      cached = roadGeometry(mask, [], tier);
      flatRoads.set(key, cached);
    }
    return cached;
  }, [mask, tile.road, tier, slopeKey, sloped]);
  useEffect(() => () => { if (sloped) geometry?.dispose(); }, [geometry, sloped]);
  return geometry && <mesh name="road-inlay" geometry={geometry} material={material} receiveShadow dispose={null} />;
}
