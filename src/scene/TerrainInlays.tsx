import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import type { GameState, Tile } from "../game/types";
import { getVisibleResource } from "../game/rules/engine";
import { terrainCapOffset, terrainHeight } from "./terrainElevation";
import { foreignTerritoryBrightness, isForeignTerritory } from "./territoryMaterials";

const ignoreRaycast = () => {};
type Point = [number, number, number];

function makeRelief(positions: number[]) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function grassSprig() {
  const positions: number[] = [];
  function blade(x: number, z: number, lean: number, height: number, width: number) {
    const foot: Point = [x, 0, z], tip: Point = [x + lean, height, z - 0.02];
    const fold: Point = [x + lean*0.22, height*0.51, z + 0.008];
    const left: Point = [fold[0] - width, fold[1], z];
    const right: Point = [fold[0] + width, fold[1], z];
    positions.push(...foot,...fold,...left, ...foot,...right,...fold, ...left,...fold,...tip, ...fold,...right,...tip);
  }
  blade(0, 0, -0.065, 0.075, 0.010);
  blade(0.004, -0.003, 0.018, 0.106, 0.011);
  blade(0.007, 0, 0.066, 0.059, 0.010);
  blade(0.078, -0.035, 0.025, 0.053, 0.008);
  return makeRelief(positions);
}

function ripplePair() {
  const positions: number[] = [];
  // Taper both ends of the strokes; each crest covers just a fraction of one square.
  function stroke(x: number, z: number, length: number, bend: number, halfWidth: number) {
    const left: Point[] = [], right: Point[] = [];
    for (let i = 0; i <= 6; i++) {
      const u = i / 6, arch = Math.sin(u * Math.PI);
      const a = x + length * (u - 0.5), b = z - bend*arch;
      left.push([a, 0.001 + 0.004*arch, b - halfWidth*arch]);
      right.push([a, 0.001, b + halfWidth*arch]);
      if (i > 0) {
        if (i > 1) positions.push(...left[i-1], ...right[i-1], ...left[i]);
        if (i < 6) positions.push(...right[i-1], ...right[i], ...left[i]);
      }
    }
  }
  stroke(0, 0, 0.31, 0.032, 0.011);
  stroke(0.045, 0.063, 0.185, 0.024, 0.009);
  return makeRelief(positions);
}

const grass = grassSprig(), ripples = ripplePair();
const material = new THREE.MeshStandardMaterial({
  color: "#ffffff", roughness: 0.86, metalness: 0.03, side: THREE.DoubleSide, flatShading: true,
});
const ink = { plain: "#9aa879", shallow: "#94bbb4", deep: "#6d9ba5" } as const;

export function terrainInlay(game: GameState, tile: Tile) {
  if (!(tile.terrain === "plain" || tile.terrain === "shallow" || tile.terrain === "deep") ||
    tile.cityId || tile.building || tile.road || tile.lighthouse || tile.ruin || getVisibleResource(game, tile, 0)) return null;
  // Coordinate-only selection keeps the cuts fixed through zoom, saves and research.
  let hash = Math.imul(tile.x+1, 0x9e3779b1) ^ Math.imul(tile.y+1, 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = (hash ^ (hash >>> 13)) >>> 0;
  if (hash % 100 >= (tile.terrain === "plain" ? 40 : 32)) return null;
  return {
    terrain: tile.terrain,
    x: (((hash >>> 8) & 255) / 255 - 0.5) * 0.43,
    z: (((hash >>> 16) & 255) / 255 - 0.5) * 0.41,
    turn: (tile.terrain === "plain" ? 0.3 : 0.72) + (((hash >>> 24) / 255) - 0.5) * 0.42,
  };
}

/** Two shared near-field meshes for the visible tufts and wavelets. */
export function TerrainInlays({ game, tileIds, visible }: {
  game: GameState; tileIds: readonly number[]; visible: ReadonlySet<number>;
}) {
  const grassBatch = useRef<THREE.InstancedMesh>(null), rippleBatch = useRef<THREE.InstancedMesh>(null);
  const capacity = 2 ** Math.ceil(Math.log2(Math.max(1, tileIds.length)));
  useLayoutEffect(() => {
    const g = grassBatch.current, r = rippleBatch.current;
    if (!g || !r) return;
    g.count = r.count = 0;
    const transform = new THREE.Object3D(), color = new THREE.Color();
    const offset = (game.options.size - 1) / 2;
    for (const id of tileIds) {
      if (!visible.has(id)) continue;
      const tile = game.tiles[id], mark = terrainInlay(game, tile);
      if (!mark) continue;
      const batch = mark.terrain === "plain" ? g : r;
      transform.position.set(tile.x-offset+mark.x, terrainHeight(tile)+terrainCapOffset+0.002, tile.y-offset+mark.z);
      transform.rotation.y = mark.turn;
      transform.updateMatrix();
      const i = batch.count++;
      batch.setMatrixAt(i, transform.matrix);
      color.set(ink[mark.terrain]);
      if (isForeignTerritory(tile.owner)) color.multiplyScalar(foreignTerritoryBrightness);
      batch.setColorAt(i, color);
    }
    for (const batch of [g,r]) {
      batch.visible = batch.count > 0;
      batch.instanceMatrix.needsUpdate = true;
      if (batch.instanceColor) batch.instanceColor.needsUpdate = true;
      batch.computeBoundingSphere();
    }
  }, [game, tileIds, visible]);
  return <>
    <instancedMesh name="plain-grass-inlays" ref={grassBatch} args={[grass,material,capacity]} raycast={ignoreRaycast} receiveShadow />
    <instancedMesh name="water-ripple-inlays" ref={rippleBatch} args={[ripples,material,capacity]} raycast={ignoreRaycast} receiveShadow />
  </>;
}
