import * as THREE from "three";
import { Miniature, miniatureMaterial } from "./miniature";
import type { Tile } from "../game/types";

// From each known node draw only its half of a connection. The mask is bounded
// to eight neighbours and never includes a tile behind unexplored fog.
const directions = [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
const variants = new Map<number, THREE.BufferGeometry>();
export function RoadInlay({ tile, tiles, size, explored }: {
  tile: Tile; tiles: Tile[]; size: number; explored: ReadonlySet<number>;
}) {
  let mask = 0;
  for (const [i, [dx, dz]] of directions.entries()) {
    const x = tile.x + dx, y = tile.y + dz;
    if (x < 0 || y < 0 || x >= size || y >= size) continue;
    const next = tiles[y * size + x];
    if (explored.has(next.id) && (next.road || next.cityId || next.building === "bridge" || next.building === "port")) {
      mask |= 1 << i;
    }
  }
  let geometry = variants.get(mask);
  if (!geometry) {
    const model = new Miniature();
    model.part("octagon", "#806c56", 0, 0.014, 0, 0.17, 0.027, 0.17);
    model.part("octagon", "#dbca9c", 0, 0.031, 0, 0.13, 0.012, 0.13);
    directions.forEach(([dx, dz], i) => {
      if (!(mask & (1 << i))) return;
      const angle = Math.atan2(dx, dz);
      const length = Math.hypot(dx, dz) / 2;
      model.box("#907a59", dx / 4, 0.012, dz / 4, .135, .024, length, 0, angle);
      model.box("#d5c6a0", dx / 4, .026, dz / 4, .105, .009, length, 0, angle);
    });
    geometry = model.finish();
    variants.set(mask, geometry);
  }
  return <mesh geometry={geometry} material={miniatureMaterial} receiveShadow dispose={null} />;
}
