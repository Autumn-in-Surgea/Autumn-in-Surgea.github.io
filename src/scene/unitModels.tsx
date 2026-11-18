import { memo } from "react";
import * as THREE from "three";
import { danubianUnit } from "../factions/danubian/units";
import type { UnitType } from "../game/types";
import { miniatureMaterial, setMiniatureColor } from "./miniature";
import { foreignTerritoryBrightness, foreignTerritoryMaterial } from "./territoryMaterials";

const glazes = new Map<string, THREE.MeshStandardMaterial>();
const spentBrightness = 0.52;
const foregroundMaterial = miniatureMaterial.clone();
// Queue opaque-looking troops after the translucent board, with depth testing
// still enabled so armour, weapons and overlapping pieces sort correctly.
foregroundMaterial.transparent = true;
foregroundMaterial.blending = THREE.NoBlending;

const spentMaterial = miniatureMaterial.clone();
const spentForegroundMaterial = foregroundMaterial.clone();
const foreignForegroundMaterial = foregroundMaterial.clone();
spentMaterial.color.multiplyScalar(spentBrightness);
spentForegroundMaterial.color.multiplyScalar(spentBrightness);
foreignForegroundMaterial.color.multiplyScalar(foreignTerritoryBrightness);

export const LAND_UNIT_RENDER_ORDER = 5;
const clearedFrame = new WeakMap<THREE.WebGLRenderer, number>();
const foregroundProps = {
  renderOrder: LAND_UNIT_RENDER_ORDER,
  onBeforeRender(renderer: THREE.WebGLRenderer) {
    const frame = renderer.info.render.frame;
    if (clearedFrame.get(renderer) === frame) return;
    // The board fog and water can leave depth writes disabled.
    renderer.state.buffers.depth.setMask(true);
    renderer.clearDepth();
    clearedFrame.set(renderer, frame);
  },
};

function getGlaze(color: string, brightness: number, foreground: boolean) {
  const key = `${color}:${brightness}:${foreground}`;
  let glaze = glazes.get(key);
  if (!glaze) {
    glaze = (foreground ? foregroundMaterial : miniatureMaterial).clone();
    setMiniatureColor(glaze.color, color).multiplyScalar(brightness);
    glazes.set(key, glaze);
  }
  return glaze;
}

export const UnitModel = memo(function UnitModel({
  type,
  color,
  actionsSpent = false,
  foreignTerritory = false,
  foreground = false,
  getGeometry = danubianUnit,
}: {
  type: UnitType;
  color: string;
  actionsSpent?: boolean;
  foreignTerritory?: boolean;
  foreground?: boolean;
  getGeometry?: typeof danubianUnit;
}) {
  const geometry = getGeometry(type);
  const layer = foreground ? foregroundProps : undefined;
  const activeMaterial = foreground ? foregroundMaterial : miniatureMaterial;
  const restingMaterial = foreground ? spentForegroundMaterial : spentMaterial;
  const foreignMaterial = foreground ? foreignForegroundMaterial : foreignTerritoryMaterial;
  // Use the stronger of the two darkening treatments on a spent unit in foreign territory.
  const body = actionsSpent ? restingMaterial : foreignTerritory ? foreignMaterial : activeMaterial;
  const brightness = actionsSpent ? spentBrightness : foreignTerritory ? foreignTerritoryBrightness : 1;
  return (
    <group dispose={null}>
      <mesh {...layer} geometry={geometry.body} material={body} castShadow receiveShadow />
      <mesh {...layer} geometry={geometry.enamel} material={getGlaze(color, brightness, foreground)} castShadow receiveShadow />
    </group>
  );
});
