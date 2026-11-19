import { memo } from "react";
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import type { UnitType } from "../game/types";
import { miniatureMaterial, setMiniatureColor } from "./miniature";
import { foreignTerritoryBrightness } from "./territoryMaterials";

const glazes = new Map<string, THREE.MeshStandardMaterial>();
const spentBrightness = 0.40;
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

type UnitGeometry = { body: THREE.BufferGeometry; enamel: THREE.BufferGeometry };

const outlines = new WeakMap<UnitGeometry, THREE.InstancedBufferGeometry>();
const outlineViewport = new THREE.Vector2(1, 1);
const outlineFrames = new WeakMap<THREE.WebGLRenderer, number>();
// Each shell pairs a radius in CSS pixels with an opacity. Draw the rim and its
// softer falloff together, without a fullscreen glow pass or extra draw calls.
const glowLayers = new THREE.InstancedBufferAttribute(new Float32Array([
  2.9, 0.08,
  2.2, 0.15,
  1.55, 0.91,
]), 2);
const outlineMaterial = new THREE.ShaderMaterial({
  uniforms: { viewport: { value: outlineViewport } },
  vertexShader: `
    uniform vec2 viewport;
    attribute vec2 glowLayer;
    varying float glowOpacity;
    void main() {
      vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      vec2 direction = (projectionMatrix * vec4(normalMatrix * normal, 0.0)).xy * viewport;
      direction /= max(length(direction), 0.0001);
      clip.xy += (2.0 * glowLayer.x) * direction / viewport * clip.w;
      clip.z += 0.0003 * clip.w;
      glowOpacity = glowLayer.y;
      gl_Position = clip;
    }
  `,
  fragmentShader: `
    varying float glowOpacity;
    void main() {
      gl_FragColor = vec4(vec3(1.0), glowOpacity);
      #include <colorspace_fragment>
    }
  `,
  side: THREE.BackSide,
  transparent: true,
  depthWrite: false,
  toneMapped: false,
});

function outlineGeometry(geometry: UnitGeometry) {
  let shell = outlines.get(geometry);
  if (!shell) {
    const parts = [geometry.body, geometry.enamel].map((part) =>
      new THREE.BufferGeometry()
        .setAttribute("position", part.getAttribute("position"))
        .setIndex(part.getIndex()),
    );
    // Weld flat-shaded corners for the shell only, so the silhouette has no seams.
    const silhouette = mergeVertices(mergeGeometries(parts));
    silhouette.computeVertexNormals();
    shell = new THREE.InstancedBufferGeometry()
      .setAttribute("position", silhouette.getAttribute("position"))
      .setAttribute("normal", silhouette.getAttribute("normal"))
      .setAttribute("glowLayer", glowLayers)
      .setIndex(silhouette.getIndex());
    shell.instanceCount = glowLayers.count;
    outlines.set(geometry, shell);
  }
  return shell;
}

const outlineProps = {
  renderOrder: BOARD_UNIT_RENDER_ORDER + 1,
  material: outlineMaterial,
  raycast: () => {},
  onBeforeRender(renderer: THREE.WebGLRenderer) {
    const frame = renderer.info.render.frame;
    if (outlineFrames.get(renderer) === frame) return;
    renderer.getSize(outlineViewport);
    outlineFrames.set(renderer, frame);
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
