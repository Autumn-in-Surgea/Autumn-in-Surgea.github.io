import * as THREE from "three";
import { lighthouseModel, ruinModel } from "../../scene/architecture";
import { tileCap, tilePlinth } from "../../scene/BoardFrame";
import { developedLandscape, grove, mineSeams, mountain, resourceModel } from "../../scene/landscape";
import type { TerrainAssets } from "../terrainAssets";

type Point = [number, number, number];

function makeRelief(positions: number[]) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function grassSprig() {
  const positions: number[] = [];
  function blade(x: number, z: number, lean: number, height: number, width: number) {
    const foot: Point = [x, 0, z], tip: Point = [x + lean, height, z - 0.02];
    const fold: Point = [x + lean*0.22, height*0.51, z + 0.008];
    const left: Point = [fold[0] - width, fold[1], z];
    const right: Point = [fold[0] + width, fold[1], z];
    positions.push(...foot,...fold,...left, ...foot,...right,...fold, ...left,...fold,...tip, ...fold,...right,...tip);
  }
  blade(0, 0, -0.065, 0.075, 0.010);
  blade(0.004, -0.003, 0.018, 0.106, 0.011);
  blade(0.007, 0, 0.066, 0.059, 0.010);
  blade(0.078, -0.035, 0.025, 0.053, 0.008);
  return makeRelief(positions);
}

function ripplePair() {
  const positions: number[] = [];
  // Taper both ends of the strokes; each crest covers just a fraction of one square.
  function stroke(x: number, z: number, length: number, bend: number, halfWidth: number) {
    const left: Point[] = [], right: Point[] = [];
    for (let i = 0; i <= 6; i++) {
      const u = i / 6, arch = Math.sin(u * Math.PI);
      const a = x + length * (u - 0.5), b = z - bend*arch;
      left.push([a, 0.001 + 0.004*arch, b - halfWidth*arch]);
      right.push([a, 0.001, b + halfWidth*arch]);
      if (i > 0) {
        if (i > 1) positions.push(...left[i-1], ...right[i-1], ...left[i]);
        if (i < 6) positions.push(...right[i-1], ...right[i], ...left[i]);
      }
    }
  }
  stroke(0, 0, 0.31, 0.032, 0.011);
  stroke(0.045, 0.063, 0.185, 0.024, 0.009);
  return makeRelief(positions);
}

const grass = grassSprig(), ripples = ripplePair();
const shell = { cap: tileCap, plinth: tilePlinth, plinthColor: "#a98a60" };

export const imperialTerrain = {
  shells: {
    plain: { ...shell, color: "#a9c65c" },
    forest: { ...shell, color: "#74b35a" },
    mountain: { ...shell, color: "#d4b184" },
    shallow: { ...shell, color: "#48c8b7" },
    deep: { ...shell, color: "#306f96" },
  },
  details: { forest: grove, mountain },
  developed: developedLandscape,
  resource: resourceModel,
  mineSeams,
  ruin: ruinModel,
  lighthouse: lighthouseModel,
  inlays: {
    plain: { geometry: grass, color: "#88af48" },
    shallow: { geometry: ripples, color: "#80d7c9" },
    deep: { geometry: ripples, color: "#528dad" },
  },
} satisfies TerrainAssets;
