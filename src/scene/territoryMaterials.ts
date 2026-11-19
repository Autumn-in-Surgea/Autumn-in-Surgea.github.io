import { createContext, useContext } from "react";
import { MeshStandardMaterial, Plane, Vector3 } from "three";
import { miniatureMaterial } from "./miniature";

export const foreignTerritoryBrightness = 0.82;
export const isForeignTerritory = (owner: number | null) => owner !== null && owner !== 0;
export const ForeignTerritory = createContext(false);
export const foreignTerritoryMaterial = miniatureMaterial.clone();
foreignTerritoryMaterial.color.multiplyScalar(foreignTerritoryBrightness);
export const CityUnderSiege = createContext(false);
const besiegedCityMaterial = miniatureMaterial.clone();
besiegedCityMaterial.color.multiplyScalar(0.48);

// Only exchanging models use a clipping plane. The board has three fixed
// elevations per base material.
export const StructureClipHeight = createContext<number | null>(null);
const clippedMaterials = new Map<MeshStandardMaterial, Map<number, MeshStandardMaterial>>();
export function useTerritoryMaterial() {
  const foreign = useContext(ForeignTerritory);
  const besieged = useContext(CityUnderSiege);
  const base = besieged ? besiegedCityMaterial : foreign ? foreignTerritoryMaterial : miniatureMaterial;
  const height = useContext(StructureClipHeight);
  if (height === null) return base;
  let byHeight = clippedMaterials.get(base);
  if (!byHeight) {
    byHeight = new Map();
    clippedMaterials.set(base, byHeight);
  }
  let clipped = byHeight.get(height);
  if (!clipped) {
    clipped = base.clone();
    clipped.clippingPlanes = [new Plane(new Vector3(0, 1, 0), -height)];
    clipped.clipShadows = true;
    byHeight.set(height, clipped);
  }
  return clipped;
}
