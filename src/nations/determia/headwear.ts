import * as THREE from "three";
import { solid, circular, assemble } from "../_shared/pawns/millinery";

const finish = (name: string, color: string, roughness: number, metalness = 0) =>
  new THREE.MeshStandardMaterial({
    name,
    color,
    roughness,
    metalness,
  });
const steel = finish("Silver blue enamel", "#a1afb4", 0.5, 0.18);
const pressedSteel = finish("Shaded silver blue enamel", "#83949d", 0.55, 0.13);

export function determia() {
  const shellBottom = (c: number) => 0.01 - 0.015 * c * c + 0.006 * c;
  function domePoint(radius: number, longitudeX: number, longitudeZ: number) {
    const sine = Math.sqrt(Math.max(0, 1 - radius * radius));
    return [
      0.339 * longitudeX * radius,
      shellBottom(longitudeZ) * radius + 0.312 * sine,
      0.323 * longitudeZ * radius - 0.019 * (1 - radius),
    ];
  }
  const shellRings = [
    1, 0.998, 0.99, 0.977, 0.955, 0.921, 0.879, 0.829, 0.771, 0.705, 0.631, 0.548, 0.456, 0.357, 0.254, 0.148,
    0.061, 0.01,
  ].map((r) => circular(56, (x, z) => domePoint(r, x, z)));
  const dome = solid("Deep drawn oval bowl", steel, shellRings);

  // The rolled edge forms a peak at the brow and dips farther over the nape.
  const brimSections = [
    [0.309, 0.284, -0.002],
    [0.333, 0.314, -0.011],
    [0.37, 0.356, -0.023],
    [0.387, 0.383, -0.024],
    [0.391, 0.388, -0.02],
    [0.392, 0.389, -0.015],
    [0.39, 0.387, -0.011],
    [0.386, 0.384, -0.009],
    [0.379, 0.374, -0.01],
    [0.369, 0.353, -0.01],
    [0.345, 0.324, -0.002],
    [0.338, 0.316, 0.008],
    [0.337, 0.315, 0.022],
    [0.334, 0.316, 0.027],
    [0.327, 0.312, 0.031],
  ];
  const brim = solid(
    "Continuous turned brim and rolled lip",
    steel,
    brimSections.map(([w, d, y]) =>
      circular(56, (x, z) => {
        const fraction = Math.max(0, Math.min(1, (w - 0.337) / 0.053));
        const drop = (0.019 * Math.max(z, 0) ** 2 + 0.034 * Math.max(-z, 0) ** 2) * fraction;
        return [
          w * x,
          y + 0.02 * x * x - drop,
          d * z + 0.018 * Math.max(z, 0) ** 4 * fraction - 0.033 * Math.max(-z, 0) ** 4 * fraction,
        ];
      }),
    ),
  );
  // Pressed ventilation comb: a wide fillet, a rounded crest and tangential
  // ends. Each section uses the actual bowl underneath to avoid apparent gaps.
  // Intersect only the triangles below the pressed ridge, not the full dome
  // for each point along the tooling. Their winding and positions are shared.
  const surface = dome.geometry,
    position = surface.getAttribute("position"),
    index = surface.getIndex()!;
  const sliceGeometry = new THREE.BufferGeometry();
  sliceGeometry.setAttribute("position", position);
  const sliceMesh = new THREE.Mesh(sliceGeometry, steel);
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const combRings = Array.from({ length: 29 }, (_, i) => {
    const t = i / 28;
    const z = -0.309 + 0.599 * t;
    const swell = Math.sin(Math.PI * t) ** 0.6;
    const w = 0.01 + 0.042 * swell;
    const h = 0.003 + 0.067 * swell * (1 + 0.14 * Math.cos(Math.PI * t));
    const faces: number[] = [];
    for (let j = 0; j < index.count; j += 3) {
      const a = index.getX(j),
        b = index.getX(j + 1),
        c = index.getX(j + 2);
      const za = position.getZ(a),
        zb = position.getZ(b),
        zc = position.getZ(c);
      if (z < Math.min(za, zb, zc) || z > Math.max(za, zb, zc)) continue;
      const xa = position.getX(a),
        xb = position.getX(b),
        xc = position.getX(c);
      if (w < Math.min(xa, xb, xc) || -w > Math.max(xa, xb, xc)) continue;
      faces.push(a, b, c);
    }
    sliceGeometry.setIndex(faces);
    const section = [
      [-1, -0.08],
      [-0.99, 0.046],
      [-0.81, 0.109],
      [-0.64, 0.204],
      [-0.51, 0.435],
      [-0.4, 0.738],
      [-0.27, 0.915],
      [0, 1],
      [0.27, 0.915],
      [0.4, 0.738],
      [0.51, 0.435],
      [0.64, 0.204],
      [0.81, 0.109],
      [0.99, 0.046],
      [1, -0.08],
      [0, -0.1],
    ];
    return section
      .map(([u, v]) => {
        const x = u * w;
        ray.set(new THREE.Vector3(x, 0.6, z), down);
        const hit = ray.intersectObject(sliceMesh, false)[0];
        return [x, hit.point.y + v * h - 0.0015, z];
      })
      .reverse();
  });
  sliceGeometry.dispose();
  const comb = solid("Streamlined pressed comb", pressedSteel, combRings);
  return assemble("Silver engineer helmet", brim, dome, comb);
}
