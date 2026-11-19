import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { landHeight } from "./terrainElevation";

const halfBand = 0.09;
const edges = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
const ignoreRaycast = () => {};

const dashedHalo = new THREE.ShaderMaterial({
  uniforms: {
    silver: { value: new THREE.Color("#d9dde2") },
    graphite: { value: new THREE.Color("#4c5159") },
    haze: { value: new THREE.Color("#aeb7c1") },
  },
  transparent: true,
  depthWrite: false,
  depthTest: false,
  toneMapped: false,
  vertexShader: `
    varying vec2 stroke;
    void main() {
      stroke = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 silver;
    uniform vec3 graphite;
    uniform vec3 haze;
    varying vec2 stroke;
    void main() {
      float along = abs(mod(stroke.x, 0.25) - 0.125);
      float distanceToDash = length(vec2(max(0.0, along - 0.053), stroke.y));
      float aa = clamp(fwidth(distanceToDash) * 0.65, 0.002, 0.035);
      float core = 1.0 - smoothstep(0.016, 0.016 + aa, distanceToDash);
      float rim = 1.0 - smoothstep(0.034, 0.034 + aa, distanceToDash);
      float halo = 1.0 - smoothstep(0.036, 0.09, distanceToDash);
      float alpha = max(rim * 0.86, halo * halo * 0.32);
      if (alpha < 0.004) discard;
      gl_FragColor = vec4(mix(mix(haze, graphite, rim), silver, core), alpha);
      #include <colorspace_fragment>
    }
  `,
});

interface Props {
  territory: readonly number[];
  explored: ReadonlySet<number>;
  size: number;
}

export function makeCityTerritoryOutline({ territory, explored, size }: Props) {
  const known = new Set(territory.filter(id => explored.has(id)));
  const offset = (size - 1) / 2;
  const positions: number[] = [], coordinates: number[] = [], faces: number[] = [];
  const corners = [[0, -halfBand], [1, -halfBand], [1, halfBand], [0, halfBand]] as const;
  for (const id of known) {
    const x = id % size, z = Math.floor(id / size);
    for (const [nx, nz] of edges) {
      const neighborX = x + nx, neighborZ = z + nz;
      if (neighborX >= 0 && neighborX < size && neighborZ >= 0 && neighborZ < size &&
        known.has(neighborZ * size + neighborX)) continue;

      const first = positions.length / 3;
      for (const [along, width] of corners) {
        const normal = 0.5 + width, tangent = along - 0.5;
        positions.push(x - offset + nx * normal - nz * tangent, landHeight + 0.06,
          z - offset + nz * normal + nx * tangent);
        coordinates.push(along, width);
      }
      faces.push(first, first + 1, first + 2, first, first + 2, first + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(coordinates, 2));
  geometry.setIndex(faces);
  return geometry;
}

export function CityTerritoryOutline({ territory, explored, size }: Props) {
  const shape = useMemo(() => makeCityTerritoryOutline({ territory, explored, size }), [territory, explored, size]);
  useEffect(() => () => shape.dispose(), [shape]);
  if (!shape.index?.count) return null;
  return <mesh name="city-territory-outline" geometry={shape} material={dashedHalo}
    renderOrder={2} raycast={ignoreRaycast} dispose={null} />;
}
