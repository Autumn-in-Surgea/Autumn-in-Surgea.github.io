import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

export const unitSilhouetteMask = 1;
export const resourceSilhouetteMask = 2;

const viewport = new THREE.Vector2(1, 1);
const viewportFrames = new WeakMap<THREE.WebGLRenderer, number>();
const edgeColor = new THREE.Color("#ffed9d");
// Each instance contributes a rim or falloff band at a radius in CSS pixels.
const layers = new THREE.InstancedBufferAttribute(new Float32Array([
  2.9, 0.08,
  2.2, 0.15,
  1.55, 0.91,
]), 2);

export function writeSilhouette(material: THREE.MeshStandardMaterial, mask: number) {
  material.stencilWrite = true;
  material.stencilWriteMask = mask;
  material.stencilRef = mask;
  material.stencilFuncMask = mask;
  material.stencilFunc = THREE.AlwaysStencilFunc;
  material.stencilZPass = THREE.ReplaceStencilOp;
  return material;
}

export function makeGlowGeometry(...parts: THREE.BufferGeometry[]) {
  const positionOnly = parts.map(part => new THREE.BufferGeometry()
    .setAttribute("position", part.getAttribute("position"))
    .setIndex(part.getIndex()));
  // Rejoin flat-shaded edges for a continuous expanded silhouette.
  const silhouette = mergeVertices(positionOnly.length === 1 ? positionOnly[0] : mergeGeometries(positionOnly));
  silhouette.computeVertexNormals();
  const geometry = new THREE.InstancedBufferGeometry()
    .setAttribute("position", silhouette.getAttribute("position"))
    .setAttribute("normal", silhouette.getAttribute("normal"))
    .setAttribute("glowLayer", layers.clone())
    .setIndex(silhouette.getIndex());
  geometry.instanceCount = layers.count;
  return geometry;
}

export function silhouetteGlowProps(mask: number, renderOrder: number) {
  const material = new THREE.ShaderMaterial({
    uniforms: { viewport: { value: viewport }, edgeColor: { value: edgeColor } },
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
      uniform vec3 edgeColor;
      varying float glowOpacity;
      void main() {
        gl_FragColor = vec4(edgeColor, glowOpacity);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    // Reject every pixel covered by the painted figures, including overlapping parts.
    stencilWrite: true,
    stencilWriteMask: 0,
    stencilRef: mask,
    stencilFuncMask: mask,
    stencilFunc: THREE.NotEqualStencilFunc,
  });
  return {
    material,
    renderOrder,
    raycast: () => {},
    onBeforeRender(renderer: THREE.WebGLRenderer) {
      const frame = renderer.info.render.frame;
      if (viewportFrames.get(renderer) === frame) return;
      renderer.getSize(viewport);
      viewportFrames.set(renderer, frame);
    },
  };
}
