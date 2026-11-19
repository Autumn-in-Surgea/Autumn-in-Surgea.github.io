import * as THREE from "three";

export type Paint = THREE.MeshStandardMaterial;
export type Rings = number[][][];

// Indexed cross sections share normals across curved felt and metal surfaces.
export function shell(
  name: string,
  rings: Rings,
  materials: Paint | Paint[],
  bands?: number[],
  close = true,
) {
  const sides = rings[0].length;
  const vertices = rings.flat(2),
    indices: number[] = [];
  const geometry = new THREE.BufferGeometry();
  let lastMaterial = -1,
    start = 0;
  function use(material: number) {
    if (material === lastMaterial) return;
    if (lastMaterial >= 0) geometry.addGroup(start, indices.length - start, lastMaterial);
    lastMaterial = material;
    start = indices.length;
  }
  for (let j = 1; j < rings.length; j++) {
    use(bands?.[j - 1] ?? 0);
    for (let i = 0; i < sides; i++) {
      const next = (i + 1) % sides,
        a = (j - 1) * sides + i,
        b = (j - 1) * sides + next;
      indices.push(a, b, b + sides, a, b + sides, a + sides);
    }
  }
  if (close) {
    use(0);
    for (const row of [0, rings.length - 1]) {
      const center = rings[row].reduce((sum, p) => sum.map((x, i) => x + p[i] / sides), [0, 0, 0]);
      const index = vertices.length / 3;
      vertices.push(...center);
      for (let i = 0; i < sides; i++) {
        const a = row * sides + i,
          b = row * sides + ((i + 1) % sides);
        indices.push(index, row === 0 ? b : a, row === 0 ? a : b);
      }
    }
  }
  if (lastMaterial >= 0) geometry.addGroup(start, indices.length - start, lastMaterial);
  geometry.setIndex(indices);
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return part(name, geometry, materials);
}

export function part(name: string, geometry: THREE.BufferGeometry, paint: Paint | Paint[]) {
  const m = new THREE.Mesh(geometry, paint);
  m.name = name;
  m.castShadow = m.receiveShadow = true;
  return m;
}

export function ellipse(count: number, point: (angle: number) => number[]) {
  return Array.from({ length: count }, (_, i) => point((i * 2 * Math.PI) / count));
}

export function band(name: string, profile: number[][], material: Paint, count = 48) {
  return shell(
    name,
    profile.map(([y, rx, rz]) => ellipse(count, (t) => [rx * Math.sin(t), y, rz * Math.cos(t)])),
    material,
  );
}

export function circular(count: number, point: (x: number, z: number, angle: number) => number[]) {
  return ellipse(count, (a) => point(Math.sin(a), Math.cos(a), a));
}

export function solid(name: string, material: Paint, rings: Rings) {
  return shell(name, rings, material);
}

export function assemble(name: string, ...parts: THREE.Object3D[]) {
  const g = new THREE.Group();
  g.name = name;
  g.add(...parts);
  return g;
}
