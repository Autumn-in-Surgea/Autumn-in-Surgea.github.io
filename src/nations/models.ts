import { danubianModels } from "./_shared/danubian";
import { models as imperia, terrain as imperiaTerrain } from "./imperia/models";
import { models as determia, terrain as determiaTerrain } from "./determia/models";
import { models as nosta, terrain as nostaTerrain } from "./nosta/models";
import { models as ida, terrain as idaTerrain } from "./ida/models";
import { models as rina, terrain as rinaTerrain } from "./rina/models";
import type { NationId } from "./registry";
import type { TerrainAssets } from "./terrainAssets";
import { DEFAULT_TERRAIN_VARIANT } from "./types";

export type NationModels = typeof danubianModels;
export const MODEL_SETS = {
  danubian: danubianModels,
  imperia,
  determia,
  nosta,
  ida,
  rina,
} satisfies Record<string, NationModels>;

export type ModelSetId = keyof typeof MODEL_SETS;

export const TERRAIN_ASSETS: Record<NationId, TerrainAssets> = {
  imperia: imperiaTerrain,
  determia: determiaTerrain,
  nosta: nostaTerrain,
  ida: idaTerrain,
  rina: rinaTerrain,
};

export function getTerrainAssets(variant: NationId): TerrainAssets {
  return TERRAIN_ASSETS[variant] ?? TERRAIN_ASSETS[DEFAULT_TERRAIN_VARIANT];
}
