import { memo } from "react";
import * as THREE from "three";
import type { UnitType } from "../game/types";
import { miniatureMaterial, setMiniatureColor } from "./miniature";
import { foreignTerritoryBrightness } from "./territoryMaterials";

const glazes = new Map<string, THREE.MeshStandardMaterial>();
const spentBrightness = 0.52;
const foregroundMaterial = miniatureMaterial.clone();
// Draw all pieces after board overlays, keeping depth testing between pieces.
foregroundMaterial.transparent = true;
foregroundMaterial.blending = THREE.NoBlending;

const spentMaterial = foregroundMaterial.clone();
const foreignMaterial = foregroundMaterial.clone();
spentMaterial.color.multiplyScalar(spentBrightness);
foreignMaterial.color.multiplyScalar(foreignTerritoryBrightness);

export const BOARD_UNIT_RENDER_ORDER = 5;
const clearedFrame = new WeakMap<THREE.WebGLRenderer, number>();
const foregroundProps = {
  renderOrder: BOARD_UNIT_RENDER_ORDER,
  onBeforeRender(renderer: THREE.WebGLRenderer) {
    const frame = renderer.info.render.frame;
    if (clearedFrame.get(renderer) === frame) return;
    // The board fog and water can leave depth writes disabled.
    renderer.state.buffers.depth.setMask(true);
    renderer.clearDepth();
    clearedFrame.set(renderer, frame);
  },
};

function getGlaze(color: string, brightness: number) {
  const key = `${color}:${brightness}`;
  let glaze = glazes.get(key);
  if (!glaze) {
    glaze = foregroundMaterial.clone();
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
  getGeometry,
}: {
  type: UnitType;
  color: string;
  actionsSpent?: boolean;
  foreignTerritory?: boolean;
  getGeometry: (type: UnitType) => { body: THREE.BufferGeometry; enamel: THREE.BufferGeometry };
}) {
  const geometry = getGeometry(type);
  // Use the stronger of the two darkening treatments on a spent unit in foreign territory.
  const body = actionsSpent ? spentMaterial : foreignTerritory ? foreignMaterial : foregroundMaterial;
  const brightness = actionsSpent ? spentBrightness : foreignTerritory ? foreignTerritoryBrightness : 1;
  return (
    <group dispose={null}>
      <mesh {...foregroundProps} geometry={geometry.body} material={body} castShadow receiveShadow />
      <mesh {...foregroundProps} geometry={geometry.enamel} material={getGlaze(color, brightness)} castShadow receiveShadow />
    </group>
  );
});
