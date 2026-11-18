import { memo } from "react";
import * as THREE from "three";
import { danubianUnit } from "../factions/danubian/units";
import type { UnitType } from "../game/types";
import { miniatureMaterial } from "./miniature";

const glazes = new Map<string, THREE.MeshStandardMaterial>();
const restingGlaze = new THREE.Color("#9a9b89");
const foregroundMaterial = miniatureMaterial.clone();
// Queue opaque-looking troops after the translucent board, with depth testing
// still enabled so armour, weapons and overlapping pieces sort correctly.
foregroundMaterial.transparent = true;
foregroundMaterial.blending = THREE.NoBlending;

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

function getGlaze(color: string, exhausted: boolean, foreground: boolean) {
  const key = `${color}:${exhausted}:${foreground}`;
  let glaze = glazes.get(key);
  if (!glaze) {
    glaze = (foreground ? foregroundMaterial : miniatureMaterial).clone();
    glaze.color.set(color);
    if (exhausted) glaze.color.lerp(restingGlaze, .32);
    glazes.set(key, glaze);
  }
  return glaze;
}

export const UnitModel = memo(function UnitModel({
  type,
  color,
  exhausted = false,
  foreground = false,
  getGeometry = danubianUnit,
}: {
  type: UnitType;
  color: string;
  exhausted?: boolean;
  foreground?: boolean;
  getGeometry?: typeof danubianUnit;
}) {
  const geometry = getGeometry(type);
  const layer = foreground ? foregroundProps : undefined;
  return (
    <group dispose={null}>
      <mesh {...layer} geometry={geometry.body} material={foreground ? foregroundMaterial : miniatureMaterial} castShadow receiveShadow />
      <mesh {...layer} geometry={geometry.enamel} material={getGlaze(color, exhausted, foreground)} castShadow receiveShadow />
    </group>
  );
});
