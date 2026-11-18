import { useEffect, useMemo } from "react";
import type { BufferGeometry } from "three";
import { Miniature } from "./miniature";
import { useTerritoryMaterial } from "./territoryMaterials";
import { terrainHeight } from "./terrainElevation";
import { roadSurfaceHeight, type BuildingVisualTier } from "./buildingVisualTier";
import type { Tile } from "../game/types";

const directions = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
];
// 256 flat masks per tier. Embankments are local to their mounted tile and
// released on replacement. Slope combinations never grow the shared cache.
const flatVariants = new Map<number, BufferGeometry>();
const roadTints = {
  1: { width: 0.11, footing: "#9c8262", paving: "#c9aa7d" },
  2: { width: 0.14, footing: "#868576", paving: "#d3c7ad" },
  3: { width: 0.17, footing: "#937e61", paving: "#e0d2ad" },
};

export function roadGeometry(mask: number, rises: number[], tier: BuildingVisualTier) {
  const m = new Miniature();
  const { width, footing, paving } = roadTints[tier];
  m.part("octagon", footing, 0, 0.015, 0, width * 1.45, 0.028, width * 1.45);
  m.part("octagon", paving, 0, 0.03, 0, width * 1.14, 0.012, width * 1.14);
  if (tier === 3) m.part("octagon", "#b19969", 0, 0.039, 0, 0.051, 0.008, 0.051);
  directions.forEach(([dx, dz], i) => {
    if (!(mask & (1 << i))) return;
    const rise = rises[i] || 0,
      length = Math.hypot(dx, dz);
    // The lower half reaches the upper bank at the seam. Quads follow the
    // actual heights; a vertical cut face under the path forms the embankment.
    type Point = [number, number, number];
    const point = (fraction: number, across: number, above: number): Point => [
      (dx * fraction) / 2 + (dz * across) / length,
      rise * fraction + above,
      (dz * fraction) / 2 - (dx * across) / length,
    ];
    const strip = (color: string, left: number, right: number, y: number) => {
      m.face(color, [point(0, left, y), point(1, left, y), point(1, right, y), point(0, right, y)]);
    };
    strip(footing, -width / 2, width / 2, 0.023);
    strip(paving, -width * 0.39, width * 0.39, roadSurfaceHeight);
    for (const s of [-1, 1]) {
      const t = (s * width) / 2;
      const top = point(1, t, 0.023);
      const face: Point[] = [point(0, t, 0), [top[0], 0, top[2]], top, point(0, t, 0.023)];
      m.face(footing, s < 0 ? face : face.reverse());
      if (tier === 3) strip("#b59a64", t - width * 0.033, t + width * 0.033, 0.03);
    }
    if (tier >= 2) {
      const joints = tier === 2 ? 2 : 3;
      for (let j = 1; j <= joints; j++) {
        const f = j / (joints + 1);
        m.face(footing, [
          point(f, -width * 0.39, 0.029),
          point(f + 0.012, -width * 0.39, 0.029),
          point(f + 0.012, width * 0.39, 0.029),
          point(f, width * 0.39, 0.029),
        ]);
      }
    }
  });
  return m.finish();
}

export function RoadInlay({
  tile,
  tiles,
  size,
  explored,
  tier,
}: {
  tile: Tile;
  tiles: Tile[];
  size: number;
  explored: ReadonlySet<number>;
  tier: BuildingVisualTier;
}) {
  const material = useTerritoryMaterial();
  let mask = 0;
  const rises = Array<number>(8).fill(0);
  for (const [i, [dx, dz]] of directions.entries()) {
    const x = tile.x + dx,
      y = tile.y + dz;
    if (x < 0 || y < 0 || x >= size || y >= size) continue;
    const next = tiles[y * size + x];
    if (!explored.has(next.id) || !(next.road || next.cityId || next.building === "bridge" || next.building === "port")) continue;
    mask |= 1 << i;
    rises[i] = Math.max(0, terrainHeight(next) - terrainHeight(tile));
  }
  const slopeKey = rises.join(","),
    sloped = rises.some((rise) => rise > 0);
  const geometry = useMemo(() => {
    const key = mask * 3 + tier - 1;
    let cached = !sloped && flatVariants.get(key);
    if (!cached) {
      cached = roadGeometry(mask, slopeKey.split(",").map(Number), tier);
      if (!sloped) flatVariants.set(key, cached);
    }
    return cached;
  }, [mask, tier, slopeKey, sloped]);
  useEffect(
    () => () => {
      if (sloped) geometry.dispose();
    },
    [geometry, sloped],
  );
  // An isolated endpoint has no road to draw through its courtyard or across the water.
  if (!mask && (tile.cityId || tile.building === "port" || tile.building === "bridge")) return null;
  return <mesh geometry={geometry} material={material} receiveShadow dispose={null} />;
}
