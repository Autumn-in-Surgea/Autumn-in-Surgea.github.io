import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Miniature, miniatureMaterial } from "./miniature";

// A narrow bevel catches the light around each square. All tiles share this mesh.
function makeTileCap() {
  const outline = new THREE.Shape();
  const r = 0.483, cut = 0.023;
  const corners = [[-r + cut,-r],[r-cut,-r],[r,-r+cut],[r,r-cut],
    [r-cut,r],[-r+cut,r],[-r,r-cut],[-r,-r+cut]];
  corners.forEach(([x, y], i) => i ? outline.lineTo(x, y) : outline.moveTo(x, y));
  outline.closePath();
  const mesh = new THREE.ExtrudeGeometry(outline, {
    depth: 0.026, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.009, bevelSegments: 1,
  });
  mesh.rotateX(-Math.PI / 2);
  mesh.translate(0, -0.02, 0);
  return mesh;
}
export const tileCap = makeTileCap();
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
