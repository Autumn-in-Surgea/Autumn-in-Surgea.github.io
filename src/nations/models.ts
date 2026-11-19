import { danubianModels } from "./_shared/danubian";
import { models as imperia, terrain as imperiaTerrain } from "./imperia/models";
import { models as determia, terrain as determiaTerrain } from "./determia/models";
import { models as nosta, terrain as nostaTerrain } from "./nosta/models";
import { models as ida, terrain as idaTerrain } from "./ida/models";
import { models as rina, terrain as rinaTerrain } from "./rina/models";
import type { NationId } from "./registry";
import type { TerrainAssets } from "./terrainAssets";
import { DEFAULT_TERRAIN_VARIANT } from "./types";
import { seededRandom } from "../game/map/random";
import type { BuildingId, Position } from "../game/types";
import type { BuildingVisualTier } from "../scene/buildingVisualTier";

export interface NationModels {
  unit: typeof danubianModels.unit;
  weaponMuzzles?: typeof danubianModels.weaponMuzzles;
  labelHeight: typeof danubianModels.labelHeight;
  city: (color: string, level: number, capital: boolean, walls: boolean, variant?: number) => ReturnType<typeof danubianModels.city>;
  building: (type: BuildingId, color: string, tier: BuildingVisualTier) => ReturnType<typeof danubianModels.building>;
  structureVariantCount?: number;
}
export const MODEL_SETS = {
  // Free-mode custom countries borrow the imperial sculpt and paint their own enamel.
  danubian: { ...danubianModels, unit: imperia.unit, weaponMuzzles: imperia.weaponMuzzles, labelHeight: imperia.labelHeight },
  imperia,
  determia,
  nosta,
  ida,
  rina,
} satisfies Record<string, NationModels>;

export type ModelSetId = keyof typeof MODEL_SETS;

export function structureVariant(models: NationModels, seed: string, { x, y }: Position) {
  const count = models.structureVariantCount;
  if (!count) return undefined;
  // Coordinates remain stable through upgrades, replay, and both old and new saves.
  return Math.floor(seededRandom(`${seed}:sculpture:${x}:${y}`)() * count);
}

export const TERRAIN_ASSETS: Record<NationId, TerrainAssets> = {
  imperia: imperiaTerrain,
  determia: determiaTerrain,
  nosta: nostaTerrain,
  ida: idaTerrain,
  rina: rinaTerrain,
};
export const representativeTerrain = TERRAIN_ASSETS[DEFAULT_TERRAIN_VARIANT];

export function getTerrainAssets(variant: NationId): TerrainAssets {
  return TERRAIN_ASSETS[variant] ?? representativeTerrain;
}
