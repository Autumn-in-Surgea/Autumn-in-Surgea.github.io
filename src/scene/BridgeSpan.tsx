import { useMemo, type ReactNode } from "react";
import { Matrix4 } from "three";
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
  // Use the same two opposite bank pairs as construction. A hidden tile can
  // neither choose the direction nor disclose the height of its approach.
  const bank = (dx: number, dz: number) => {
    const x = tile.x + dx,
      z = tile.y + dz;
    if (x < 0 || x >= size || z < 0 || z >= size) return { score: -3, height: 0 };
    const neighbor = tiles[z * size + x];
    if (!explored.has(neighbor.id)) return { score: 0, height: terrainHeight({ terrain: "plain" }) };
    const water = neighbor.terrain === "shallow" || neighbor.terrain === "deep";
    return { score: water ? -3 : 1, height: terrainHeight(neighbor) };
  };
  const ns = [bank(0, -1), bank(0, 1)],
    ew = [bank(-1, 0), bank(1, 0)];
  const eastWest = ew[0].score + ew[1].score > ns[0].score + ns[1].score;
  const banks = eastWest ? ew : ns;
  const approach = (height: number) => height - terrainHeight(tile) + roadSurfaceHeight;
  return { rotation: eastWest ? Math.PI / 2 : 0, nearDeck: approach(banks[0].height), farDeck: approach(banks[1].height) };
}

const pier = new Miniature();
pier.part("bevel", "#898572", 0, 0.5, 0, 1, 1, 1);
const pierGeometry = pier.finish();

/** Keeps both ends flush with their banks and extends the footings into the water. */
export function BridgeSpan({ children, tier, ...props }: SpanProps & { children: ReactNode; tier: BuildingVisualTier }) {
  const { rotation, nearDeck, farDeck } = bridgeBanks(props);
  const material = useTerritoryMaterial();
  const slope = farDeck - nearDeck;
  const center = (nearDeck + farDeck) / 2 - bridgeDeckHeight;
  const alignment = useMemo(() => new Matrix4().set(1, 0, 0, 0, 0, 1, slope, center, 0, 0, 1, 0, 0, 0, 0, 1), [slope, center]);
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
            position={[x, 0, z]}
            scale={[0.06, height + 0.008, 0.106]}
            receiveShadow
            dispose={null}
          />
        ));
      })}
    </group>
  );
}
