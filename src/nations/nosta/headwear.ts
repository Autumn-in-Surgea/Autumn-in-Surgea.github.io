import * as THREE from "three";
import { toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";

const paints = new Map<string, THREE.MeshStandardMaterial>();
function finish(color: string, metal = 0) {
  const key = color + "/" + metal;
  if (!paints.has(key))
    paints.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        metalness: metal,
        roughness: metal ? 0.43 : 0.73,
        name: color,
      }),
    );
  return paints.get(key)!;
}
function part(
  parent: THREE.Group,
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[],
) {
  const obj = new THREE.Mesh(geometry, material);
  obj.name = name;
  obj.castShadow = obj.receiveShadow = true;
  parent.add(obj);
  return obj;
}
const v = (...p: number[]) => new THREE.Vector3(p[0], p[1], p[2]);

// End caps and band surfaces have hard bevels, with optional sculpted radial pleats.
interface WallOptions {
  sides?: number;
  phase?: number;
  metal?: number;
  shape?: (point: number[], angle: number, level: number, index: number) => number[];
}
function turned(
  parent: THREE.Group,
  name: string,
  stations: number[][],
  colors: string[],
  { sides = 20, phase = Math.PI / sides, shape, metal = 0 }: WallOptions = {},
) {
  const vertices: number[] = [],
    groups: [number, number, number][] = [];
  const rings = stations.map(([y, width, depth, xOffset = 0, zOffset = 0, slope = 0], level) =>
    Array.from({ length: sides }, (_, i) => {
      const angle = phase + (i * Math.PI * 2) / sides;
      const x = Math.sin(angle) * width,
        z = Math.cos(angle) * depth;
      const p = [x + xOffset, y + slope * x, z + zOffset];
      return shape ? shape(p, angle, level, i) : p;
    }),
  );
  function tri(a: number[], b: number[], c: number[]) {
    vertices.push(...a, ...b, ...c);
  }
  for (let level = 1; level < rings.length; level++) {
    const start = vertices.length / 3;
    const lo = rings[level - 1],
      hi = rings[level];
    for (let j = 0; j < sides; j++) {
      const k = (j + 1) % sides;
      tri(lo[j], lo[k], hi[k]);
      tri(lo[j], hi[k], hi[j]);
    }
    groups.push([start, vertices.length / 3 - start, Math.min(level - 1, colors.length - 1)]);
  }
  for (const top of [false, true]) {
    const ring = rings[top ? rings.length - 1 : 0];
    const center = ring
      .reduce((sum, p) => sum.add(v(...p)), v(0, 0, 0))
      .divideScalar(sides)
      .toArray();
    const start = vertices.length / 3;
    for (let j = 0; j < sides; j++) {
      const k = (j + 1) % sides;
      if (top) tri(center, ring[j], ring[k]);
      else tri(center, ring[k], ring[j]);
    }
    groups.push([start, vertices.length / 3 - start, top ? colors.length - 1 : 0]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  for (const group of groups) geometry.addGroup(...group);
  return part(
    parent,
    name,
    geometry,
    colors.map((color) => finish(color, metal)),
  );
}
function edge(
  parent: THREE.Group,
  name: string,
  points: number[][],
  radius: number,
  color: string,
  metal = 0,
) {
  const obj = new THREE.Group();
  obj.name = name;
  parent.add(obj);
  for (let i = 1; i < points.length; i++) {
    const a = v(...points[i - 1]),
      b = v(...points[i]);
    const delta = b.clone().sub(a);
    const tube = part(
      obj,
      name,
      new THREE.CylinderGeometry(radius, radius, delta.length(), 7),
      finish(color, metal),
    );
    tube.position.copy(a).lerp(b, 0.5);
    tube.quaternion.setFromUnitVectors(v(0, 1, 0), delta.normalize());
  }
  return obj;
}
function bandCord(
  parent: THREE.Group,
  name: string,
  rx: number,
  rz: number,
  left: number,
  right: number,
  y: number,
  sag: number,
  shade: string,
) {
  const points = Array.from({ length: 13 }, (_, index) => {
    const p = index / 12;
    const angle = left + (right - left) * p;
    return [Math.sin(angle) * rx, y - Math.sin(p * Math.PI) * sag, Math.cos(angle) * rz];
  });
  return edge(parent, name, points, 0.011, shade, 0.36);
}

const crownSlope = 0.045;

function sculpt(h: THREE.Group) {
  turned(
    h,
    "Gold cloth foundation",
    [
      [-0.02, 0.329, 0.241],
      [0.027, 0.343, 0.251],
      [0.083, 0.324, 0.241],
    ],
    ["#7f602e", "#b9974d"],
  );
  // The last two rings round the fur edge gently into the single sloped top.
  // Nap belongs on the wall, fading out before it reaches the cut edge.
  const wallRelief = [0, 0.65, 1, 1, 0.32, 0, 0];
  turned(
    h,
    "Tall cylindrical lambswool crown",
    [
      [0.013, 0.343, 0.254],
      [0.059, 0.36, 0.27],
      [0.178, 0.366, 0.276],
      [0.329, 0.354, 0.267, 0, -0.012],
      [0.409, 0.342, 0.255, 0, -0.027],
      [0.454, 0.334, 0.246, 0, -0.027],
      [0.463, 0.326, 0.238, 0, -0.027],
    ],
    ["#5e4736", "#7c6247", "#876c4c", "#836b4b", "#987c52", "#8e6e4e", "#82644d"],
    {
      sides: 40,
      shape: (p, a, l, i) => {
        const weight = wallRelief[l];
        const nap =
          ((i % 2 === 0 ? 1 : -1) * 0.006 + 0.006 * Math.sin(a * 7 + l * 1.25)) * Math.min(l + 1, 2) * weight;
        const x = p[0] + Math.sin(a) * nap;
        return [x, p[1] + crownSlope * x + weight * 0.012 * Math.cos(a * 5 + l), p[2] + Math.cos(a) * nap];
      },
    },
  );
  bandCord(h, "Gold ceremonial cord", 0.372, 0.287, -1.34, 1.33, 0.157, 0.089, "#dbac5b");
  bandCord(h, "Twinned cord", 0.373, 0.288, -1.34, 1.33, 0.138, 0.09, "#c49853");
  const cockade = part(
    h,
    "Woven rosette",
    new THREE.CylinderGeometry(0.052, 0.052, 0.018, 9),
    finish("#d3b06c", 0.17),
  );
  cockade.rotation.z = -Math.PI / 2;
  cockade.position.set(0.354, 0.165, 0.058);
  edge(
    h,
    "Hanging tassel",
    [
      [0.357, 0.135, 0.059],
      [0.376, 0.056, 0.04],
      [0.373, 0.007, 0.036],
    ],
    0.018,
    "#c9a158",
  );
}

// The turned wood body uses a rubbed lacquer finish and softened panel edges.
const lacquer = new WeakMap<THREE.MeshStandardMaterial, THREE.MeshStandardMaterial>();
function satinLacquer(material: THREE.MeshStandardMaterial) {
  if (!lacquer.has(material)) {
    const finish = material.clone();
    finish.name = material.name + " satin";
    finish.roughness = Math.max(0.31, material.roughness - 0.2);
    finish.metalness = material.metalness * 0.78;
    lacquer.set(material, finish);
  }
  return lacquer.get(material)!;
}
export function nosta() {
  const group = new THREE.Group();
  group.name = "Headwear_nosta";
  group.userData = { nation: "nosta" };
  sculpt(group);
  group.traverse((piece) => {
    if (!(piece instanceof THREE.Mesh)) return;
    if (Array.isArray(piece.material)) {
      piece.material = piece.material.map(satinLacquer);
      const old = piece.geometry;
      piece.geometry = toCreasedNormals(old, Math.PI / 5);
      if (old !== piece.geometry) old.dispose();
      if (piece.name === "Tall cylindrical lambswool crown") {
        // Give every top vertex the normal of the cut plane, including the
        // perimeter shared with the gently bevelled wool wall.
        const g = piece.geometry;
        const cap = g.groups.at(-1);
        const n = v(-crownSlope, 1, 0).normalize();
        for (let i = cap.start; i < cap.start + cap.count; i++) g.attributes.normal.setXYZ(i, n.x, n.y, n.z);
      }
    } else {
      piece.material = satinLacquer(piece.material);
    }
  });
  return group;
}
