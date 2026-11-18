import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Miniature, miniatureMaterial } from "./miniature";

// A polished face, two light-catching bevels and a rebated plinth. Each profile is
// one instanced mesh, including on empty plains and open sea.
type MouldingRing = readonly [height: number, halfWidth: number, cornerCut: number];

function mouldedSquare(profile: readonly MouldingRing[]) {
  const rings = profile.map(([y, r, cut]) => [
    [-r+cut,y,-r], [r-cut,y,-r], [r,y,-r+cut], [r,y,r-cut],
    [r-cut,y,r], [-r+cut,y,r], [-r,y,r-cut], [-r,y,-r+cut],
  ]);
  const positions: number[] = [];
  const indices: number[] = [];
  function polygon(points: number[][]) {
    const first = positions.length / 3;
    for (const point of points) positions.push(...point);
    for (let i = 1; i < points.length - 1; i++) indices.push(first, first+i, first+i+1);
  }
  polygon(rings[0]);
  for (let i = 1; i < rings.length; i++) {
    const low = rings[i-1], high = rings[i];
    for (let side = 0; side < high.length; side++) {
      const next = (side+1) % high.length;
      polygon([low[side], high[side], high[next], low[next]]);
    }
  }
  polygon(rings[rings.length - 1].slice().reverse());
  const mesh = new THREE.BufferGeometry();
  mesh.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  mesh.setIndex(indices);
  mesh.computeVertexNormals();
  return mesh;
}
export const tileCap = mouldedSquare([
  [-0.036, 0.477, 0.026], [-0.027, 0.494, 0.030], [-0.007, 0.494, 0.030],
  [0.007, 0.487, 0.028], [0.015, 0.472, 0.025],
]);
export const tilePlinth = mouldedSquare([
  [-0.50, 0.484, 0.032], [-0.42, 0.500, 0.034], [-0.29, 0.500, 0.034],
  [-0.19, 0.484, 0.030], [0.50, 0.484, 0.030],
]);
function makeFrame(size: number) {
  const frame = new Miniature();
  function block(x: number, y: number, z: number, w: number, h: number, d: number, color: string, turn = 0) {
    frame.box(color, x, y, z, w, h, d, 0, turn);
  }
  const edge = size / 2;
  block(0, -0.30, 0, size + 0.68, 0.17, size + 0.68, "#413832");

  // The top rails sit outside the water surface and never cover a playable tile.
  function rail(offset: number, y: number, length: number, height: number, width: number, color: string) {
    for (const sign of [-1, 1]) {
      block(0, y, sign * offset, length, height, width, color);
      block(sign * offset, y, 0, width, height, length - width * 2, color);
    }
  }
  rail(edge + 0.18, -0.202, size + 0.72, 0.045, 0.36, "#ba9e62");
  rail(edge + 0.1925, -0.155, size + 0.77, 0.075, 0.385, "#614d3d");
  rail(edge + 0.17, -0.073, size + 0.68, 0.11, 0.34, "#725943");
  rail(edge + 0.065, -0.013, size + 0.15, 0.012, 0.022, "#c3a671");
  rail(edge + 0.29, -0.013, size + 0.6, 0.012, 0.019, "#bba36a");
  for (let i = 0; i <= size; i += 2) {
    const at = i - edge, length = i % 4 === 0 ? 0.135 : 0.066;
    for (const sign of [-1, 1]) {
      block(at, -0.009, sign * (edge + 0.17), 0.024, 0.012, length, "#c8b281");
      block(sign * (edge + 0.17), -0.009, at, length, 0.012, 0.024, "#c8b281");
    }
  }
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    block(x * (edge + 0.17), 0, z * (edge + 0.17), 0.13, 0.028, 0.13, "#d2b777", Math.PI / 4);
  }
  return frame.finish();
}

export function BoardFrame({ size }: { size: number }) {
  const shape = useMemo(() => makeFrame(size), [size]);
  useEffect(() => () => shape.dispose(), [shape]);
  return <mesh geometry={shape} material={miniatureMaterial} receiveShadow dispose={null} />;
}
