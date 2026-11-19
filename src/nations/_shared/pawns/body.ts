import * as THREE from "three";
import type { PawnProfile, HandPose } from "./roles";

const finishes = new Map<string, THREE.MeshStandardMaterial>();
function finish(color: string, gloss = 0.52, metalness = 0) {
  const key = [color, gloss, metalness].join("/");
  if (!finishes.has(key)) {
    const material = new THREE.MeshStandardMaterial({ color, roughness: gloss, metalness });
    material.name = "Satin " + color;
    finishes.set(key, material);
  }
  return finishes.get(key)!;
}

function mount(
  parent: THREE.Group,
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// Closed lathe profiles preserve the silhouette from every nation-facing angle.
const turnedShapes = new Map<string, THREE.BufferGeometry>();
const latheSides = 48;
const coatDepth = 0.88;
const coatProfile = [
  [0, 0.132],
  [0.341, 0.132],
  [0.365, 0.15],
  [0.382, 0.187],
  [0.385, 0.224],
  [0.38, 0.27],
  [0.365, 0.317],
  [0.339, 0.367],
  [0.295, 0.433],
  [0.247, 0.504],
  [0.21, 0.574],
  [0.198, 0.625],
  [0.202, 0.685],
  [0.222, 0.73],
  [0.254, 0.775],
  [0.268, 0.813],
  [0.254, 0.847],
  [0.201, 0.878],
  [0.132, 0.908],
  [0, 0.908],
];

function turned(
  parent: THREE.Group,
  name: string,
  profile: number[][],
  depth: number,
  material: THREE.Material,
) {
  let geometry = turnedShapes.get(name);
  if (!geometry) {
    geometry = new THREE.LatheGeometry(
      profile.map(([r, y]) => new THREE.Vector2(r, y)),
      latheSides,
    );
    turnedShapes.set(name, geometry);
  }
  const mesh = mount(parent, name, geometry, material);
  mesh.scale.z = depth;
  return mesh;
}

let capeShape: THREE.BufferGeometry | undefined;
function cowl(parent: THREE.Group, cloth: THREE.Material, binding: THREE.Material) {
  if (capeShape) return mount(parent, "Pointed shoulder cape", capeShape, [cloth, binding]);
  const rings = [
    // front drop gives the cape a single cut and an unbroken, lighter shoulder line
    [0.133, 0.931, 0.005],
    [0.232, 0.893, 0.015],
    [0.302, 0.846, 0.062],
    [0.3, 0.822, 0.108],
    [0.285, 0.822, 0.107],
  ];
  const points = [],
    faces = [];
  const sides = 48;
  for (const [r, y, drop] of rings) {
    for (let i = 0; i < sides; i++) {
      const angle = (2 * Math.PI * i) / sides;
      const wave = Math.max(0, Math.cos(angle + 0.44)) ** 5;
      points.push(r * Math.sin(angle), y - drop * wave, r * 0.89 * Math.cos(angle));
    }
  }
  const geometry = new THREE.BufferGeometry();
  for (let band = 0; band < rings.length - 1; band++) {
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const a = band * sides + i,
        b = band * sides + j;
      faces.push(a, a + sides, b, b, a + sides, b + sides);
    }
    geometry.addGroup(band * sides * 6, sides * 6, band === 2 ? 1 : 0);
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  geometry.setIndex(faces);
  geometry.computeVertexNormals();
  capeShape = geometry;
  return mount(parent, "Pointed shoulder cape", geometry, [cloth, binding]);
}

const mittenShape = new THREE.SphereGeometry(1, 18, 12);
function mittenSleeve(
  parent: THREE.Group,
  side: number,
  grip: number[],
  cloth: THREE.Material,
  wood: THREE.Material,
) {
  const target = new THREE.Vector3(...grip);
  const shoulder = new THREE.Vector3(side * 0.21, 0.804, 0.018);
  const bend = shoulder.clone().lerp(target, 0.53);
  bend.x += side * 0.048;
  bend.y -= 0.032;
  bend.z -= 0.017;
  const curve = new THREE.QuadraticBezierCurve3(shoulder, bend, target);
  const stations = [
    [0, 0.051],
    [0.11, 0.102],
    [0.27, 0.122],
    [0.56, 0.109],
    [0.78, 0.092],
    [0.91, 0.081],
    [0.96, 0.079],
  ];
  const vertices = [],
    indices = [];
  const segments = 16;
  for (const [t, r] of stations) {
    const center = curve.getPoint(t),
      tangent = curve.getTangent(t);
    const across = new THREE.Vector3(0, 0, 1).cross(tangent).normalize();
    const fore = tangent.clone().cross(across).normalize();
    for (let i = 0; i < segments; i++) {
      const angle = (2 * Math.PI * i) / segments;
      const point = center
        .clone()
        .addScaledVector(across, r * Math.cos(angle))
        .addScaledVector(fore, r * 0.9 * Math.sin(angle));
      vertices.push(...point.toArray());
    }
  }
  for (let j = 0; j < stations.length - 1; j++) {
    for (let i = 0; i < segments; i++) {
      const a = j * segments + i,
        b = j * segments + ((i + 1) % segments);
      indices.push(a, b, a + segments, b, b + segments, a + segments);
    }
  }
  const tube = new THREE.BufferGeometry();
  tube.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  tube.setIndex(indices);
  tube.computeVertexNormals();
  const sideName = side < 0 ? "Left" : "Right";
  mount(parent, sideName + " sleeve", tube, cloth);
  const hand = mount(parent, sideName + " mitten grip", mittenShape, wood);
  hand.position.copy(target);
  hand.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), curve.getTangent(0.94));
  hand.scale.set(0.086, 0.108, 0.092);
}

// Style A's original four octagonal sections, preserved in local head space.
const chinHeight = 0.956;
const verticalHeadScale = 1.1;
const horizontalHeadScale = 0.9;
const headSize = 0.9;

let headShape: THREE.BufferGeometry | undefined;
function carvedHeadGeometry() {
  if (headShape) return headShape;
  const sections = [
    [1.073, 0.187, 0.133, 0.064, -0.008, 0.003],
    [1.128, 0.243, 0.189, 0.067, -0.008, 0.017],
    [1.333, 0.295, 0.206, 0.078, -0.006, 0.009],
    [1.444, 0.289, 0.19, 0.068, -0.006, -0.008],
  ];
  const headSection = ([y, w, d, b, x, z]: number[]) =>
    [
      [-w + b, d],
      [w - b, d],
      [w, d - b],
      [w, -d + b],
      [w - b, -d],
      [-w + b, -d],
      [-w, -d + b],
      [-w, d - b],
    ].map(([dx, dz]) => [dx + x, y - 1.073, dz + z]);
  const ringAt = (y: number) => {
    const next = sections.findIndex((r) => r[0] >= y);
    if (next < 1) return headSection(sections[0]);
    const a = sections[next - 1],
      b = sections[next],
      t = (y - a[0]) / (b[0] - a[0]);
    return headSection(a.map((v, i) => v + (b[i] - v) * t));
  };
  // Keep the square lower face. Chamfer the upper corners inward where a
  // circular hatband seats on them, just as a carver would undercut the rim.
  const ringLimits = [
    [1.073],
    [1.128],
    [1.303],
    [1.337, 0.315, 0.274],
    [1.377, 0.289, 0.225],
    [1.444, 0.281, 0.219],
  ];
  const rings = ringLimits.map(([y, rx, rz]) =>
    ringAt(y).map(([x, h, z]) => {
      const factor = rx ? Math.max(1, Math.hypot(x / rx, (z - 0.002) / rz)) : 1;
      return [x / factor, h, 0.002 + (z - 0.002) / factor];
    }),
  );
  const points: number[] = [];
  const triangle = (a: number[], b: number[], c: number[]) => points.push(...a, ...b, ...c);
  for (let layer = 1; layer < rings.length; layer++) {
    const lo = rings[layer - 1],
      hi = rings[layer];
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      triangle(lo[i], lo[j], hi[j]);
      triangle(lo[i], hi[j], hi[i]);
    }
  }
  const lo = rings[0],
    hi = rings[rings.length - 1];
  for (let i = 1; i < 7; i++) {
    triangle(lo[0], lo[i + 1], lo[i]);
    triangle(hi[0], hi[i], hi[i + 1]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  geometry.computeVertexNormals();
  headShape = geometry;
  return geometry;
}

function squareHead(parent: THREE.Group, wood: THREE.Material) {
  const head = mount(parent, "Blank carved square head", carvedHeadGeometry(), wood);
  head.position.set(0, chinHeight, 0.012);
  head.scale.set(1.1 * horizontalHeadScale, 1.15 * verticalHeadScale, 1.13).multiplyScalar(headSize);
}

// Fit the sling directly to the coat. Its high side disappears beneath the
// overhanging cape, leaving the cape and its collar clasp uninterrupted.
let strapGeometry: THREE.BufferGeometry | undefined;
function fittedSling() {
  if (strapGeometry) return strapGeometry;

  const sections = 96,
    points = [],
    indices = [];
  const crossSection = [
    [-1, 0.003],
    [-0.87, 0.008],
    [0, 0.009],
    [0.87, 0.008],
    [1, 0.003],
    [0.94, -0.002],
    [-0.94, -0.002],
  ];
  for (let i = 0; i < sections; i++) {
    const angle = (2 * Math.PI * i) / sections;
    const slope = Math.cos(angle + 0.12);
    const height = 0.613 + 0.191 * Math.sin(angle + 0.12);
    const halfWidth = 0.034 * Math.hypot(1, slope);
    // A cross section of the turned coat is a 48-sided ellipse. Interpolate
    // its two enclosing stations, then project onto the nearest polygon side.
    const x = Math.sin(angle),
      z = Math.cos(angle);
    const step = (2 * Math.PI) / latheSides;
    const theta = Math.atan2(x, z / coatDepth);
    const across = theta - (Math.floor(theta / step) + 0.5) * step;
    const projection = Math.cos(step * 0.5) / (Math.cos(across) * Math.hypot(x, z / coatDepth));
    for (const [t, relief] of crossSection) {
      const y = height + t * halfWidth;
      const i = coatProfile.findIndex((station) => station[1] >= y);
      const [r0, y0] = coatProfile[i - 1],
        [r1, y1] = coatProfile[i];
      const radius = THREE.MathUtils.lerp(r0, r1, (y - y0) / (y1 - y0)) * projection + relief;
      points.push(x * radius, y, z * radius);
    }
  }
  const width = crossSection.length;
  for (let i = 0; i < sections; i++) {
    for (let j = 0; j < width; j++) {
      const a = i * width + j,
        b = ((i + 1) % sections) * width + j;
      const c = i * width + ((j + 1) % width),
        d = ((i + 1) % sections) * width + ((j + 1) % width);
      indices.push(a, b, d, a, d, c);
    }
  }
  strapGeometry = new THREE.BufferGeometry();
  strapGeometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  strapGeometry.setIndex(indices);
  strapGeometry.computeVertexNormals();
  return strapGeometry;
}

function dress(parent: THREE.Group, shoulder: THREE.Mesh, leather: THREE.Material, brass: THREE.Material) {
  mount(parent, "Crossbody leather strap", fittedSling(), leather);
  // Fix the single domed button to the actual face of the cape.
  const angle = 0.04,
    outward = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
  const ray = new THREE.Raycaster(
    new THREE.Vector3(0, 0.803, 0).addScaledVector(outward, 1),
    outward.clone().negate(),
  );
  const hit = ray.intersectObject(shoulder, false)[0];
  const button = turned(
    parent,
    "Single brass coat button",
    [
      [0, -0.009],
      [0.041, -0.009],
      [0.049, -0.003],
      [0.051, 0.004],
      [0.047, 0.012],
      [0.038, 0.019],
      [0.021, 0.023],
      [0, 0.024],
    ],
    1,
    brass,
  );
  button.position.copy(hit.point);
  button.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), hit.face!.normal);
}

export function makePawnBody(profile: PawnProfile, grip: HandPose) {
  const root = new THREE.Group();
  root.name = "Turned wood pawn";
  root.userData = { style: "B" };
  const paint = finish(profile.coat);
  const cape = finish(profile.fold, 0.6);
  const wood = finish("#e3ad78", 0.49);
  const walnut = finish("#53362b", 0.4);
  const shade = finish(profile.boots, 0.48);
  const inlay = finish("#c5a567", 0.36, 0.38);

  turned(
    root,
    "Turned walnut foot",
    [
      [0, 0.015],
      [0.34, 0.015],
      [0.383, 0.023],
      [0.409, 0.043],
      [0.424, 0.071],
      [0.426, 0.094],
      [0.42, 0.109],
      [0.403, 0.121],
      [0.368, 0.128],
      [0.357, 0.144],
      [0.353, 0.153],
      [0, 0.153],
    ],
    0.93,
    walnut,
  );
  turned(
    root,
    "Metal thread",
    [
      [0.424, 0.07],
      [0.427, 0.074],
      [0.427, 0.08],
      [0.425, 0.083],
    ],
    0.93,
    inlay,
  );
  turned(root, "Bell coat", coatProfile, coatDepth, paint);
  turned(
    root,
    "Inlaid coat hem",
    [
      [0.3825, 0.202],
      [0.3873, 0.21],
      [0.3873, 0.222],
      [0.3855, 0.23],
    ],
    0.88,
    shade,
  );
  turned(
    root,
    "Turned collar",
    [
      [0, 0.856],
      [0.142, 0.856],
      [0.162, 0.877],
      [0.159, 0.905],
      [0.118, 0.93],
      [0.113, 0.97],
      [0, 0.97],
    ],
    0.93,
    shade,
  );
  const shoulder = cowl(root, cape, paint);
  const darkStrap = profile.darkStrap;
  const strap = finish(darkStrap ? "#73503b" : "#ab7751", 0.77);
  dress(root, shoulder, strap, finish("#e9b96e", 0.4, 0.36));
  squareHead(root, wood);

  mittenSleeve(root, -1, grip.other ?? [-0.315, 0.549, 0.107], paint, wood);
  mittenSleeve(root, 1, grip.hand, paint, wood);
  const socket = new THREE.Group();
  socket.name = "Hat socket";
  const brimHeight = chinHeight + (1.318 - chinHeight) * verticalHeadScale * headSize;
  socket.position.set(0, brimHeight, 0.012 + (0.006 - 0.012) * headSize);
  socket.scale.set(1.095, 1.055, 1.16);
  root.add(socket);
  return root;
}
