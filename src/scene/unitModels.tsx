import { memo } from "react";
import * as THREE from "three";
import type { UnitType } from "../game/types";
import { miniatureMaterial, setMiniatureColor } from "./miniature";
import { foreignTerritoryBrightness } from "./territoryMaterials";
import { makeGlowGeometry, silhouetteGlowProps, unitSilhouetteMask, writeSilhouette } from "./silhouetteGlow";

const glazes = new Map<string, THREE.MeshStandardMaterial>();
const spentBrightness = 0.40;
// Both painted meshes of every unit make one shared screen-space occupancy mask.
const foregroundMaterial = writeSilhouette(miniatureMaterial.clone(), unitSilhouetteMask);
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
    renderer.clear(false, true, true);
    clearedFrame.set(renderer, frame);
  },
};

type UnitGeometry = { body: THREE.BufferGeometry; enamel: THREE.BufferGeometry };

const outlines = new WeakMap<UnitGeometry, THREE.InstancedBufferGeometry>();
const outlineProps = silhouetteGlowProps(unitSilhouetteMask, BOARD_UNIT_RENDER_ORDER + 1);

function outlineGeometry(geometry: UnitGeometry) {
  let shell = outlines.get(geometry);
  if (!shell) {
    shell = makeGlowGeometry(geometry.body, geometry.enamel);
    outlines.set(geometry, shell);
  }
  return shell;
}

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
  playerOwned,
  actionsSpent = false,
  foreignTerritory = false,
  getGeometry,
}: {
  type: UnitType;
  color: string;
  playerOwned: boolean;
  actionsSpent?: boolean;
  foreignTerritory?: boolean;
  getGeometry: (type: UnitType) => UnitGeometry;
}) {
  const geometry = getGeometry(type);
  const spent = playerOwned && actionsSpent;
  const onForeignGround = playerOwned && foreignTerritory;
  // Use the stronger of the two darkening treatments on a spent unit in foreign territory.
  const body = spent ? spentMaterial : onForeignGround ? foreignMaterial : foregroundMaterial;
  const brightness = spent ? spentBrightness : onForeignGround ? foreignTerritoryBrightness : 1;
  return (
    <group dispose={null}>
      <mesh {...foregroundProps} geometry={geometry.body} material={body} castShadow receiveShadow />
      <mesh {...foregroundProps} geometry={geometry.enamel} material={getGlaze(color, brightness)} castShadow receiveShadow />
      {playerOwned && !spent && <mesh {...outlineProps} name="unit-outline-glow" geometry={outlineGeometry(geometry)} />}
    </group>
  );
});
