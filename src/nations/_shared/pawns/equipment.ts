import * as THREE from "three";

const enamel = (color: string, metalness = 0.08, roughness = 0.53) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness, flatShading: true });

const walnut = enamel("#76513a");
const woodEdge = enamel("#a16d49");
const ink = enamel("#303d44", 0.19);
const steel = enamel("#819aa4", 0.29, 0.42);
const polished = enamel("#c4d1cd", 0.33, 0.38);
const bronze = enamel("#a37241", 0.28, 0.46);
const brass = enamel("#d0a364", 0.31, 0.4);
const ivory = enamel("#e6d8b1");
const cream = enamel("#fff0cf");
const carmine = enamel("#923e44");
const glass = enamel("#598e9f", 0.3, 0.28);
const glassGlint = enamel("#c2d8d0", 0.16, 0.29);

function mesh(
  parent: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
) {
  const part = new THREE.Mesh(geometry, material);
  part.position.set(x, y, z);
  parent.add(part);
  return part;
}

function trace<Path extends THREE.Path>(path: Path, points: number[][]) {
  path.moveTo(points[0][0], points[0][1]);
  for (const point of points.slice(1)) path.lineTo(point[0], point[1]);
  path.closePath();
  return path;
}

function plate(
  parent: THREE.Group,
  outline: number[][],
  material: THREE.Material,
  depth: number,
  bevel = 0.012,
  hole?: number[][],
) {
  const shape = trace(new THREE.Shape(), outline);
  if (hole) shape.holes.push(trace(new THREE.Path(), hole));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return mesh(parent, geometry, material);
}

function turned(
  parent: THREE.Group,
  material: THREE.Material,
  top: number,
  bottom: number,
  length: number,
  x: number,
  y: number,
  z: number,
  sides = 8,
) {
  return mesh(parent, new THREE.CylinderGeometry(top, bottom, length, sides), material, x, y, z);
}

function crossSection(
  parent: THREE.Group,
  material: THREE.Material,
  width: number,
  height: number,
  depth: number,
  at: THREE.Vector3Tuple,
  chamfer = 0.026,
) {
  const w = width / 2,
    h = height / 2,
    c = chamfer;
  const part = plate(
    parent,
    [
      [-w + c, -h],
      [w - c, -h],
      [w, -h + c],
      [w, h - c],
      [w - c, h],
      [-w + c, h],
      [-w, h - c],
      [-w, -h + c],
    ],
    material,
    depth,
    c * 0.5,
  );
  part.position.set(...at);
  return part;
}

function lensRim(
  parent: THREE.Group,
  material: THREE.Material,
  top: number,
  bottom: number,
  length: number,
  x: number,
  y: number,
  z: number,
  sides = 10,
) {
  const piece = turned(parent, material, top, bottom, length, x, y, z, sides);
  piece.rotation.x = Math.PI / 2;
  return piece;
}

function facets(parent: THREE.Group, material: THREE.Material, panels: number[][][]) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(panels.flat(2), 3));
  geometry.computeVertexNormals();
  return mesh(parent, geometry, material);
}

function rifle(parent: THREE.Group) {
  const stock = [
    [-0.12, -0.3],
    [0.048, -0.34],
    [0.11, -0.29],
    [0.078, -0.103],
    [0.052, 0.128],
    [0.082, 0.402],
    [0.061, 0.545],
    [-0.05, 0.545],
    [-0.066, 0.385],
    [-0.063, 0.142],
    [-0.107, -0.06],
    [-0.151, -0.215],
  ];
  plate(parent, stock, walnut, 0.105, 0.015);
  const cheek = plate(
    parent,
    [
      [-0.133, -0.217],
      [-0.079, -0.288],
      [0.035, -0.29],
      [0.062, -0.256],
      [0.033, -0.085],
      [-0.034, -0.125],
    ],
    woodEdge,
    0.02,
    0.009,
  );
  cheek.position.z = 0.057;
  const heel = plate(
    parent,
    [
      [-0.126, -0.304],
      [0.055, -0.352],
      [0.097, -0.315],
      [0.094, -0.281],
      [-0.121, -0.272],
    ],
    ink,
    0.114,
    0.009,
  );
  heel.rotation.z = -0.04;

  crossSection(parent, ink, 0.167, 0.23, 0.139, [0.004, 0.259, 0.012]);
  crossSection(parent, steel, 0.011, 0.106, 0.087, [0.093, 0.273, 0.018], 0.004);
  turned(parent, ink, 0.037, 0.051, 0.65, 0, 0.718, 0.005);
  turned(parent, steel, 0.04, 0.041, 0.234, 0, 0.867, 0.005);
  turned(parent, brass, 0.065, 0.065, 0.05, 0, 0.521, 0.005);
  turned(parent, ink, 0.05, 0.047, 0.066, 0, 1.023, 0.005);
  turned(parent, steel, 0.044, 0.046, 0.018, 0, 1.066, 0.005);
  plate(
    parent,
    [
      [0.054, 0.029],
      [0.146, 0.025],
      [0.184, 0.069],
      [0.166, 0.151],
      [0.06, 0.171],
    ],
    ink,
    0.032,
    0.008,
    [
      [0.072, 0.055],
      [0.127, 0.052],
      [0.156, 0.077],
      [0.142, 0.126],
      [0.065, 0.14],
    ],
  );
}

function shovel(parent: THREE.Group) {
  turned(parent, walnut, 0.034, 0.042, 0.885, 0, 0.283, 0);
  turned(parent, brass, 0.051, 0.043, 0.078, 0, -0.128, 0);
  turned(parent, bronze, 0.07, 0.037, 0.141, 0, 0.678, 0);
  plate(
    parent,
    [
      [-0.046, -0.118],
      [-0.15, -0.208],
      [-0.148, -0.252],
      [-0.105, -0.287],
      [0.105, -0.287],
      [0.148, -0.252],
      [0.15, -0.208],
      [0.046, -0.118],
    ],
    bronze,
    0.062,
    0.012,
    [
      [-0.039, -0.156],
      [-0.107, -0.215],
      [-0.087, -0.248],
      [0.087, -0.248],
      [0.107, -0.215],
      [0.039, -0.156],
    ],
  );
  crossSection(parent, walnut, 0.217, 0.058, 0.074, [0, -0.266, 0], 0.015);

  const blade = [
    [-0.209, 0.662],
    [0.209, 0.662],
    [0.236, 0.71],
    [0.219, 0.84],
    [0.15, 0.954],
    [0, 1.056],
    [-0.15, 0.954],
    [-0.219, 0.84],
    [-0.236, 0.71],
  ];
  plate(parent, blade, ink, 0.055, 0.015);
  const ridge = [0, 0.787, 0.083];
  const basin = blade.map(([x, y]) => [x * 0.84, 0.813 + (y - 0.813) * 0.87, 0.046]);
  const bright: number[][][] = [],
    shaded: number[][][] = [];
  for (let i = 0; i < blade.length; i++) {
    const next = (i + 1) % blade.length;
    const a = [...blade[i], 0.027],
      b = [...blade[next], 0.027];
    bright.push([a, b, basin[next]], [a, basin[next], basin[i]]);
    const surface = i < 3 || i > 6 ? shaded : bright;
    surface.push([basin[i], basin[next], ridge]);
  }
  facets(parent, polished, bright);
  facets(parent, steel, shaded);
  crossSection(parent, bronze, 0.113, 0.179, 0.105, [0, 0.711, 0.013], 0.019);
}

function medic(parent: THREE.Group) {
  plate(
    parent,
    [
      [-0.166, -0.245],
      [-0.165, -0.08],
      [-0.11, 0.019],
      [0.11, 0.019],
      [0.165, -0.08],
      [0.166, -0.245],
    ],
    bronze,
    0.076,
    0.015,
    [
      [-0.11, -0.217],
      [-0.114, -0.095],
      [-0.074, -0.033],
      [0.074, -0.033],
      [0.114, -0.095],
      [0.11, -0.217],
    ],
  );
  crossSection(parent, walnut, 0.221, 0.066, 0.093, [0, -0.005, 0]);
  crossSection(parent, bronze, 0.644, 0.489, 0.267, [0, -0.425, 0], 0.058);
  crossSection(parent, ivory, 0.606, 0.46, 0.255, [0, -0.419, 0.017], 0.051);
  crossSection(parent, cream, 0.61, 0.118, 0.27, [0, -0.242, 0.02], 0.024);
  crossSection(parent, bronze, 0.302, 0.282, 0.028, [0, -0.436, 0.153], 0.023);
  crossSection(parent, carmine, 0.268, 0.249, 0.021, [0, -0.435, 0.173], 0.021);
  const symbol = plate(
    parent,
    [
      [-0.03, -0.083],
      [0.03, -0.083],
      [0.03, -0.029],
      [0.087, -0.029],
      [0.087, 0.029],
      [0.03, 0.029],
      [0.03, 0.083],
      [-0.03, 0.083],
      [-0.03, 0.029],
      [-0.087, 0.029],
      [-0.087, -0.029],
      [-0.03, -0.029],
    ],
    cream,
    0.011,
    0.004,
  );
  symbol.position.set(0, -0.435, 0.188);
  for (const side of [-1, 1])
    crossSection(parent, brass, 0.056, 0.108, 0.043, [side * 0.215, -0.255, 0.158], 0.008);
}

function optics(parent: THREE.Group) {
  crossSection(parent, bronze, 0.224, 0.107, 0.222, [0, 0, -0.01]);
  turned(parent, brass, 0.057, 0.058, 0.124, 0, 0.059, -0.011);
  for (const x of [-0.164, 0.164]) {
    lensRim(parent, ink, 0.122, 0.083, 0.294, x, 0, 0.025, 10);
    lensRim(parent, walnut, 0.103, 0.093, 0.149, x, 0, -0.079, 10);
    lensRim(parent, bronze, 0.141, 0.131, 0.065, x, 0, 0.176, 10);
    lensRim(parent, ink, 0.12, 0.123, 0.015, x, 0, 0.212, 10);
    lensRim(parent, glass, 0.104, 0.107, 0.013, x, 0, 0.221, 12);
    lensRim(parent, ink, 0.093, 0.094, 0.056, x, 0, -0.153, 10);
    lensRim(parent, glass, 0.065, 0.065, 0.016, x, 0, -0.187, 10);
    facets(parent, glassGlint, [
      [
        [x + 0.024, 0.069, 0.23],
        [x - 0.024, 0.076, 0.23],
        [x - 0.072, 0.027, 0.23],
      ],
    ]);
  }
}

function saber(parent: THREE.Group) {
  const curve = [
    [-0.062, 0.153],
    [-0.064, 0.359],
    [-0.053, 0.595],
    [-0.01, 0.804],
    [0.084, 0.977],
    [0.339, 1.162],
    [0.286, 0.976],
    [0.233, 0.785],
    [0.187, 0.571],
    [0.14, 0.343],
    [0.093, 0.153],
  ];
  plate(parent, curve, polished, 0.037, 0.008);
  const bright = plate(
    parent,
    [
      [0.014, 0.154],
      [0.026, 0.355],
      [0.034, 0.587],
      [0.072, 0.8],
      [0.152, 0.972],
      [0.333, 1.154],
      [0.2, 0.975],
      [0.144, 0.797],
      [0.109, 0.583],
      [0.076, 0.352],
      [0.057, 0.154],
    ],
    steel,
    0.015,
    0.004,
  );
  bright.position.z = 0.026;
  turned(parent, walnut, 0.04, 0.046, 0.212, 0, -0.008, 0, 7);
  turned(parent, brass, 0.073, 0.061, 0.055, 0, -0.121, 0);
  turned(parent, bronze, 0.05, 0.05, 0.05, 0, 0.08, 0);
  plate(
    parent,
    [
      [-0.154, 0.115],
      [0.132, 0.106],
      [0.181, 0.128],
      [0.19, 0.165],
      [0.153, 0.169],
      [0.104, 0.146],
      [-0.142, 0.15],
      [-0.177, 0.168],
      [-0.191, 0.143],
    ],
    brass,
    0.084,
    0.011,
  );
  plate(
    parent,
    [
      [-0.039, -0.132],
      [0.093, -0.133],
      [0.151, -0.073],
      [0.179, 0.08],
      [0.156, 0.129],
      [0.114, 0.126],
      [0.132, 0.069],
      [0.12, -0.03],
      [0.072, -0.098],
      [-0.035, -0.096],
    ],
    bronze,
    0.057,
    0.009,
  );
}

export type Tool = "rifle" | "scope" | "bayonet" | "carbine" | "shovel" | "medic" | "optics" | "saber";
export function makeTool(kind: Tool) {
  const group = new THREE.Group();
  if (kind === "shovel") shovel(group);
  else if (kind === "medic") medic(group);
  else if (kind === "optics") optics(group);
  else if (kind === "saber") saber(group);
  else {
    rifle(group);
    if (kind === "scope") {
      const rifleSteel = enamel("#2c3d43", 0.24, 0.36),
        scopeTrim = enamel("#baa16d", 0.38, 0.32);
      const mount = mesh(group, new THREE.BoxGeometry(0.082, 0.22, 0.058), rifleSteel, -0.056, 0.363, 0.015);
      mount.name = "Scope bridge";
      turned(group, rifleSteel, 0.053, 0.043, 0.48, -0.127, 0.425, 0.02, 12);
      for (const [y, r] of [
        [0.196, 0.052],
        [0.654, 0.064],
      ])
        turned(group, scopeTrim, r, r, 0.06, -0.127, y, 0.02, 12);
    }
    if (kind === "bayonet") {
      const tip = [0.115, 1.41, 0.005];
      const root = [0.115, 0.99, 0.005];
      const blade = [
        [0.054, 1.03, 0.005],
        [0.115, 1.04, 0.028],
        [0.17, 1.03, 0.005],
        [0.115, 1.04, -0.018],
      ];
      for (let i = 0; i < blade.length; i++) {
        const edge = blade[(i + 1) % blade.length];
        facets(group, i < 2 ? polished : steel, [
          [blade[i], edge, tip],
          [root, edge, blade[i]],
        ]);
      }
      crossSection(group, ink, 0.172, 0.041, 0.049, [0.06, 1.019, 0.005], 0.007);
    }
    const muzzle = new THREE.Object3D();
    muzzle.name = "Rifle muzzle";
    muzzle.position.set(0, 1.075, 0.005);
    group.add(muzzle);
  }
  return group;
}
