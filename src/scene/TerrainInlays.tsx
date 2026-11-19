import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { GameState, Tile } from "../game/types";
import { getVisibleResource } from "../game/rules/engine";
import { getTerrainAssets } from "../nations/models";
import { terrainCapOffset, terrainHeight } from "./terrainElevation";
import { foreignTerritoryBrightness, isForeignTerritory } from "./territoryMaterials";

const ignoreRaycast = () => {};
const material = new THREE.MeshStandardMaterial({
  color: "#ffffff", roughness: 0.86, metalness: 0.03, side: THREE.DoubleSide, flatShading: true,
});

export function terrainInlay(game: GameState, tile: Tile) {
  if (!(tile.terrain === "plain" || tile.terrain === "shallow" || tile.terrain === "deep") ||
    tile.cityId || tile.road || tile.lighthouse || tile.ruin || getVisibleResource(game, tile, 0)) return null;
  if (tile.building) {
    // The ground still shows outside the production footprint. Keep the same
    // native grass/ripple sculpture along an unbuilt corner of the square.
    return { terrain: tile.terrain, x: .296, z: .335, turn: tile.terrain === "plain" ? .3 : .72 };
  }
  return {
    terrain: tile.terrain,
    x: -0.12,
    z: tile.terrain === "plain" ? -0.14 : 0.055,
    turn: tile.terrain === "plain" ? 0.3 : 0.72,
  };
}

type Placement = NonNullable<ReturnType<typeof terrainInlay>> & { tile: Tile; color: string };

function InlayBatch({ geometry, placements, offset }: {
  geometry: THREE.BufferGeometry; placements: Placement[]; offset: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const capacity = 2 ** Math.ceil(Math.log2(placements.length));
  useLayoutEffect(() => {
    const batch = ref.current;
    if (!batch) return;
    const transform = new THREE.Object3D(), color = new THREE.Color();
    batch.count = placements.length;
    placements.forEach(({ tile, x, z, turn, color: ink }, i) => {
      transform.position.set(tile.x - offset + x, terrainHeight(tile) + terrainCapOffset + 0.002, tile.y - offset + z);
      transform.rotation.y = turn;
      transform.updateMatrix();
      batch.setMatrixAt(i, transform.matrix);
      color.set(ink);
      if (isForeignTerritory(tile.owner)) color.multiplyScalar(foreignTerritoryBrightness);
      batch.setColorAt(i, color);
    });
    batch.instanceMatrix.needsUpdate = true;
    if (batch.instanceColor) batch.instanceColor.needsUpdate = true;
    batch.computeBoundingSphere();
  }, [placements, offset]);
  const name = placements[0].terrain === "plain" ? "plain-grass-inlays" : "water-ripple-inlays";
  return <instancedMesh name={name} ref={ref} args={[geometry, material, capacity]} raycast={ignoreRaycast} receiveShadow />;
}

/** One near-field mesh per distinct inlay geometry. */
export function TerrainInlays({ game, tileIds, visible }: {
  game: GameState; tileIds: readonly number[]; visible: ReadonlySet<number>;
}) {
  const batches = useMemo(() => {
    const byGeometry = new Map<THREE.BufferGeometry, Placement[]>();
    for (const id of tileIds) {
      if (!visible.has(id)) continue;
      const tile = game.tiles[id], mark = terrainInlay(game, tile);
      if (!mark) continue;
      const asset = getTerrainAssets(tile.terrainVariant).inlays[mark.terrain];
      if (!asset) continue;
      const placement = { ...mark, tile, color: asset.color };
      const list = byGeometry.get(asset.geometry);
      if (list) list.push(placement);
      else byGeometry.set(asset.geometry, [placement]);
    }
    return [...byGeometry];
  }, [game, tileIds, visible]);
  const offset = (game.options.size - 1) / 2;
  return <>{batches.map(([geometry, placements]) => (
    <InlayBatch key={geometry.id} geometry={geometry} placements={placements} offset={offset} />
  ))}</>;
}
