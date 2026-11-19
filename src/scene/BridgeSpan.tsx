import { useMemo, type ReactNode } from "react";
import { Matrix4 } from "three";
import { bridgeAxes, bridgeAxisSteps, bridgeBanksAt, type BridgeAxis } from "../game/map/bridgeBanks";
import { isWater } from "../game/map/generate";
import type { Tile } from "../game/types";
import { terrainHeight } from "./terrainElevation";
import { useTerritoryMaterial } from "./territoryMaterials";
import { Miniature } from "./miniature";
import { bridgeDeckHeight, bridgePierOffset, roadSurfaceHeight, type BuildingVisualTier } from "./buildingVisualTier";

interface SpanProps {
  tile: Tile;
  tiles: readonly Tile[];
  size: number;
  explored: ReadonlySet<number>;
}

export function bridgeBanks({ tile, tiles, size, explored }: SpanProps) {
  // Uncharted shores use a flat approach until their elevations are known.
  const describeBank = (neighbor: Tile | undefined) => {
    if (!neighbor) return { score: -3, height: 0 };
    if (!explored.has(neighbor.id)) return { score: 0, height: terrainHeight({ terrain: "plain" }) };
    return { score: isWater(neighbor) ? -3 : 1, height: terrainHeight(neighbor) };
  };
  const pair = (axis: BridgeAxis) => bridgeBanksAt(tiles, size, tile, axis).map(describeBank);
  const score = (axis: BridgeAxis) => pair(axis).reduce((sum, bank) => sum + bank.score, 0);
  // Infer the direction from known shores for bridges built before axes were saved.
  const axis = tile.bridgeAxis ?? bridgeAxes.reduce((best, candidate) =>
    score(candidate) > score(best) ? candidate : best);
  const [nearBank, farBank] = pair(axis);
  const [dx, dz] = bridgeAxisSteps[axis];
  const approach = (height: number) => height - terrainHeight(tile) + roadSurfaceHeight;
  return {
    rotation: Math.atan2(dx, dz),
    length: Math.hypot(dx, dz),
    nearDeck: approach(nearBank.height),
    farDeck: approach(farBank.height),
  };
}

const pier = new Miniature();
pier.part("bevel", "#898572", 0, 0.5, 0, 1, 1, 1);
const pierGeometry = pier.finish();

/** Keeps both ends flush with their banks and extends the footings into the water. */
export function BridgeSpan({ children, tier, ...props }: SpanProps & { children: ReactNode; tier: BuildingVisualTier }) {
  const { rotation, length, nearDeck, farDeck } = bridgeBanks(props);
  const material = useTerritoryMaterial();
  const slope = farDeck - nearDeck;
  const center = (nearDeck + farDeck) / 2 - bridgeDeckHeight;
  const alignment = useMemo(() => new Matrix4().set(
    1, 0, 0, 0,
    0, 1, slope, center,
    0, 0, length, 0,
    0, 0, 0, 1,
  ), [slope, center, length]);
  const edge = bridgePierOffset(tier);
  return (
    <group rotation={[0, rotation, 0]}>
      <group matrix={alignment} matrixAutoUpdate={false}>
        {children}
      </group>
      {[-0.376, 0.376].map((z) => {
        const height = center + slope * z;
        if (height <= 0) return null;
        return [-edge, edge].map((x) => (
          <mesh
            key={`${x}/${z}`}
            geometry={pierGeometry}
            material={material}
            position={[x, 0, z * length]}
            scale={[0.06, height + 0.008, 0.106]}
            receiveShadow
            dispose={null}
          />
        ));
      })}
    </group>
  );
}
