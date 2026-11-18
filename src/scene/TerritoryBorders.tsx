import { memo, useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Player, Tile } from "../game/types";
import { colorForOwner } from "./factionModels";
import { terrainCapOffset, terrainHeight } from "./terrainElevation";

const material = new THREE.MeshBasicMaterial({
  vertexColors: true, transparent: true, depthWrite: false, depthTest: false,
  side: THREE.DoubleSide, toneMapped: false, forceSinglePass: true,
});
const ignoreRaycast = () => {};
const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
const bands = [[-0.033, 0], [-0.019, 1], [0.019, 1], [0.033, 0]] as const;

/** A single draw for the known frontier, including the short seams at changes of elevation. */
export function makeTerritoryBorders(tiles: Tile[], players: Player[], explored: ReadonlySet<number>, size: number) {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const corners = new Map<number, { x: number; z: number; low: number; high: number; owner: number }>();
  const inks = players.map(player => new THREE.Color(colorForOwner(players, player.id)));
  const offset = (size - 1) / 2;
  function section(x: number, y: number, z: number, nx: number, nz: number, ink: THREE.Color, connect: boolean) {
    const i = positions.length / 3;
    for (const [width, alpha] of bands) {
      positions.push(x - offset + nx * width, y, z - offset + nz * width);
      colors.push(ink.r, ink.g, ink.b, alpha);
    }
    if (connect) {
      for (let k = i; k < i + bands.length - 1; k++)
        indices.push(k - 4, k, k + 1, k - 4, k + 1, k - 3);
    }
  }
  for (const id of explored) {
    const tile = tiles[id];
    if (!tile || tile.owner == null) continue;
    const { owner } = tile, ink = inks[owner];
    const y = terrainHeight(tile) + terrainCapOffset + 0.029;
    for (const [nx, nz] of directions) {
      const ax = tile.x + nx, az = tile.y + nz;
      const adjacent = az * size + ax;
      if (ax >= 0 && az >= 0 && ax < size && az < size &&
        explored.has(adjacent) && tiles[adjacent].owner === owner) continue;
      const x = tile.x + nx / 2, z = tile.y + nz / 2;
      // Each colour sits just inside its own square. Neighbouring borders meet at grid corners.
      for (const [distance, inset] of [[-0.5, 0], [-0.43, 0.049], [0.43, 0.049], [0.5, 0]] as const) {
        const cx = x - nz * distance, cz = z + nx * distance;
        section(cx - nx * inset, y, cz - nz * inset, nx, nz, ink, distance !== -0.5);
        if (inset) continue;
        const key = (owner * (size + 1) + cz + 0.5) * (size + 1) + cx + 0.5;
        const corner = corners.get(key);
        if (corner) {
          corner.low = Math.min(corner.low, y);
          corner.high = Math.max(corner.high, y);
        } else corners.set(key, { x: cx, z: cz, low: y, high: y, owner });
      }
    }
  }
  for (const { x, z, low, high, owner } of corners.values()) {
    if (low === high) continue;
    // Keep the corner stroke facing the fixed isometric camera as it climbs the step.
    section(x, low, z, Math.SQRT1_2, -Math.SQRT1_2, inks[owner], false);
    section(x, high, z, Math.SQRT1_2, -Math.SQRT1_2, inks[owner], true);
  }
  const shape = new THREE.BufferGeometry();
  shape.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  shape.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
  shape.setIndex(indices);
  return shape;
}

interface TerritoryProps {
  tiles: Tile[];
  players: Player[];
  explored: ReadonlySet<number>;
  size: number;
}

function sameBoundaries(before: TerritoryProps, after: TerritoryProps) {
  if (before.size !== after.size || before.explored.size !== after.explored.size ||
    before.players.length !== after.players.length ||
    before.players.some((player, i) => player.color !== after.players[i].color)) return false;
  if (before.tiles === after.tiles && before.explored === after.explored) return true;
  for (const id of before.explored) {
    const old = before.tiles[id], next = after.tiles[id];
    if (!after.explored.has(id) || old.owner !== next.owner ||
      (old.owner !== null && terrainHeight(old) !== terrainHeight(next))) return false;
  }
  return true;
}

export const TerritoryBorders = memo(function TerritoryBorders({ tiles, players, explored, size }: TerritoryProps) {
  const shape = useMemo(() => makeTerritoryBorders(tiles, players, explored, size), [tiles, players, explored, size]);
  useEffect(() => () => shape.dispose(), [shape]);
  return <mesh name="territory-borders" geometry={shape} material={material}
    renderOrder={1} dispose={null} raycast={ignoreRaycast} />;
}, sameBoundaries);
