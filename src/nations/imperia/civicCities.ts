import type { Miniature } from "../../scene/miniature";
import { brass, brick, cobalt, copper, ink, ivory, masonry, terracotta } from "../../scene/architecturalPalette";
import { cityStreetDatum as ground, facade, masonryCourse } from "../_shared/danubian/cityMasonry";
import { glazedEaves, parapet, pitchedRoof } from "../_shared/danubian/civicDistricts";

type Roof = "gable" | "mansard" | "steps" | "pediment" | "vault" | "cupola" | "imperial" | "setback";
type Lot = [roof: Roof, x: number, z: number, width: number, depth: number, height: number, wall: string, tiles: string];
type Point = [number, number, number];

const cream = "#e7bf87";
const clay = "#cd8a6f";
const sandstone = "#ba8563";
const slate = "#40526b";
const shale = "#684d66";
const glass = "#86bac2";

function dormerRoof(m: Miniature, x: number, y: number, z: number, w: number, d: number,
  wall: string, tiles: string) {
  const slope = [[0.53, 0], [0.36, 0.038], [0, 0.060], [-0.36, 0.038], [-0.53, 0]];
  const left = slope.map(([side, height]): Point => [x - w * 0.53, y + height, z + side * d]);
  const right = slope.map(([side, height]): Point => [x + w * 0.53, y + height, z + side * d]);
  for (let i = 1; i < slope.length; i++) {
    m.face(tiles, [left[i - 1], right[i - 1], right[i], left[i]]);
  }
  m.face(wall, left);
  m.face(wall, right.reverse());
  const dormer = w * 0.22;
  for (const offset of [-0.24, 0.24]) {
    const dx = x + offset * w, front = z + d * 0.41;
    m.box(wall, dx, y + 0.032, front, dormer, 0.040, d * 0.19);
    m.box(ink, dx, y + 0.037, front + d * 0.10, dormer * 0.49, 0.022, 0.004);
    pitchedRoof(m, dx, y + 0.050, front, dormer * 1.09, d * 0.22, 0.017, tiles, ivory);
  }
}

function exchangeRoof(m: Miniature, x: number, y: number, z: number, w: number, d: number, tiles: string) {
  const arch = (side: number, panel: number): Point => {
    const angle = panel * Math.PI / 8;
    return [x + side * w * 0.52, y + Math.sin(angle) * d * 0.36, z + Math.cos(angle) * d * 0.52];
  };
  for (let i = 1; i <= 8; i++) {
    const roof = i > 2 && i < 7 ? glass : tiles;
    m.face(roof, [arch(-1, i - 1), arch(1, i - 1), arch(1, i), arch(-1, i)]);
    for (const edge of [-1, 1]) {
      const p = arch(edge, i - 1), q = arch(edge, i);
      m.face(ink, [edge > 0 ? q : p, edge > 0 ? p : q, [x + edge * w * 0.52, y, z]]);
      m.beam(masonry, arch(edge, i - 1), arch(edge, i), 0.007);
    }
  }
  m.beam(tiles, arch(-1, 4), arch(1, 4), 0.009);
}

function civicRoof(m: Miniature, x: number, y: number, z: number, w: number, d: number,
  tiles: string, enamel: string) {
  const face = z + d / 2 + 0.004;
  m.box(tiles, x, y + 0.011, z, w * 1.02, 0.022, d * 1.01);
  for (const offset of [-0.40, -0.14, 0.14, 0.40]) {
    m.part("octagon", ivory, x + offset * w, (ground + y) / 2, face, 0.017, y - ground, 0.017);
  }
  const left = x - w * 0.48, right = x + w * 0.48, ridge = y + 0.052;
  m.face(masonry, [[left, y, face + 0.005], [right, y, face + 0.005], [x, ridge, face + 0.005]]);
  m.beam(tiles, [left, y, face + 0.008], [x, ridge, face + 0.008], 0.010);
  m.beam(tiles, [x, ridge, face + 0.008], [right, y, face + 0.008], 0.010);
  m.box(enamel, x, y - 0.024, face + 0.005, w * 0.43, 0.015, 0.008);
  m.box(ivory, x, ground + 0.005, face + 0.010, w * 0.91, 0.010, 0.035);
}

function cupolaBlock(m: Miniature, lot: Lot) {
  const [, x, z, w, d, h, wall, tiles] = lot;
  const cut = Math.min(w, d) * 0.26;
  const left = x - w / 2, right = x + w / 2, back = z - d / 2, front = z + d / 2;
  const edge: [number, number][] = [
    [left, back], [right - cut, back], [right, back + cut], [right, front - cut],
    [right - cut, front], [left + cut, front], [left, front - cut],
  ];
  const top = ground + h;
  masonryCourse(m, edge, x, z, ground, top, 1, wall, h < 0.16 ? 2 : 3);
  masonryCourse(m, edge, x, z, top - 0.011, top + 0.010, 1.045, ivory);
  masonryCourse(m, edge, x, z, top + 0.010, top + 0.016, 0.96, slate);
  const crown = Math.min(w, d) * 0.71;
  const cx = x + w * 0.08, cz = z + d * 0.10;
  m.part("octagon", ivory, cx, top + 0.030, cz, crown * 0.9, 0.033, crown * 0.9);
  m.part("hip", tiles, cx, top + 0.062, cz, crown, 0.044, crown, 0, Math.PI / 4);
  m.part("gem", brass, cx, top + 0.088, cz, 0.012, 0.020, 0.012);
}

function companion(m: Miniature, lot: Lot, enamel: string) {
  const [roof, x, z, w, d, h, wall, tiles] = lot;
  if (roof === "cupola") {
    cupolaBlock(m, lot);
    return;
  }
  const floors = Math.max(1, Math.round(h / 0.068));
  const y = facade(m, x, z, w, d, h, wall, Math.max(2, Math.round(w / 0.059)), floors);
  switch (roof) {
    case "gable": {
      const alongX = w > d;
      pitchedRoof(m, x, y, z, (alongX ? d : w) + 0.013, (alongX ? w : d) + 0.013,
        Math.min(w, d) * 0.42, tiles, ivory, alongX);
      m.box(wall, x - w * 0.29, y + 0.052, z - d * 0.16, 0.018, 0.069, 0.021);
      break;
    }
    case "mansard":
      dormerRoof(m, x, y, z, w, d, wall, tiles);
      break;
    case "steps": {
      parapet(m, x, y, z, w + 0.006, d + 0.004, tiles);
      const edge = z + d / 2;
      for (let tier = 0; tier < 3; tier++) {
        const span = w * (0.88 - tier * 0.24);
        m.box(wall, x, y + 0.027 + tier * 0.016, edge, span, 0.021, 0.018);
        m.box(tiles, x, y + 0.038 + tier * 0.016, edge, span + 0.009, 0.007, 0.022);
      }
      break;
    }
    case "pediment":
      civicRoof(m, x, y, z, w, d, tiles, enamel);
      break;
    case "vault":
      exchangeRoof(m, x, y, z, w, d, tiles);
      break;
    case "imperial":
      m.box(ivory, x, ground + h * 0.30, z, w + 0.008, 0.010, d + 0.008);
      m.box(tiles, x, y + 0.014, z, w * 0.94, 0.029, d * 0.92);
      glazedEaves(m, x, z, y + 0.028, w * 1.06, d * 1.08, Math.min(w, d) * 0.26, 0.28);
      break;
    case "setback":
      m.box(slate, x, y + 0.006, z, w * 0.97, 0.014, d * 0.95);
      m.box(wall, x - w * 0.10, y + 0.035, z, w * 0.67, 0.065, d * 0.75);
      m.box(tiles, x - w * 0.10, y + 0.071, z, w * 0.72, 0.014, d * 0.80);
      m.box(ivory, x - w * 0.15, y + 0.097, z - d * 0.08, w * 0.42, 0.043, d * 0.49);
      m.box(tiles, x - w * 0.15, y + 0.121, z - d * 0.08, w * 0.45, 0.011, d * 0.56);
      break;
  }
}

// Qingdao shop rows, Hankou commercial streets and the brick civic campuses
// have separate street plans. Each row is a distinct set of building lots.
const treatyLayouts: Lot[][] = [
  [
    ["pediment", 0.200, -0.078, 0.150, 0.244, 0.138, cream, shale],
    ["mansard", -0.190, 0.211, 0.147, 0.140, 0.090, ivory, cobalt],
    ["gable", -0.011, 0.215, 0.153, 0.129, 0.111, clay, copper],
  ],
  [
    ["steps", 0.205, 0.020, 0.151, 0.344, 0.164, brick, cream],
    ["pediment", -0.110, 0.217, 0.259, 0.130, 0.122, masonry, slate],
  ],
  [
    ["mansard", 0.170, -0.155, 0.135, 0.123, 0.163, cream, terracotta],
    ["gable", -0.163, 0.197, 0.187, 0.152, 0.126, ivory, copper],
    ["cupola", 0.179, 0.195, 0.174, 0.142, 0.116, masonry, cobalt],
  ],
  [
    ["vault", -0.101, 0.215, 0.355, 0.118, 0.119, clay, copper],
    ["gable", 0.192, 0.059, 0.153, 0.145, 0.157, cream, cobalt],
    ["steps", 0.192, -0.121, 0.144, 0.125, 0.095, sandstone, slate],
  ],
];

const merchantLayouts: Lot[][] = [
  [
    ["cupola", 0.234, -0.053, 0.200, 0.285, 0.205, cream, copper],
    ["steps", -0.193, 0.229, 0.198, 0.175, 0.168, brick, ivory],
    ["mansard", 0.140, 0.258, 0.153, 0.146, 0.121, clay, cobalt],
  ],
  [
    ["pediment", 0.237, -0.109, 0.180, 0.222, 0.246, brick, terracotta],
    ["vault", -0.132, 0.202, 0.343, 0.203, 0.155, sandstone, copper],
    ["gable", 0.217, 0.220, 0.203, 0.187, 0.139, clay, terracotta],
  ],
  [
    ["cupola", 0.071, 0.229, 0.298, 0.193, 0.223, ivory, shale],
    ["gable", 0.237, -0.164, 0.167, 0.139, 0.177, clay, slate],
    ["mansard", 0.249, 0.018, 0.148, 0.130, 0.147, masonry, cobalt],
    ["gable", -0.211, 0.226, 0.143, 0.163, 0.106, cream, slate],
  ],
  [
    ["steps", 0.219, -0.120, 0.201, 0.181, 0.204, sandstone, cobalt],
    ["gable", 0.267, 0.065, 0.165, 0.130, 0.148, brick, terracotta],
    ["pediment", -0.235, 0.226, 0.194, 0.156, 0.170, ivory, copper],
    ["pediment", 0.176, 0.237, 0.198, 0.170, 0.157, masonry, copper],
  ],
];

const courtLayouts: Lot[][] = [
  [
    ["imperial", 0.234, -0.121, 0.228, 0.232, 0.266, cream, cobalt],
    ["steps", -0.302, -0.105, 0.132, 0.252, 0.197, brick, ivory],
    ["vault", -0.220, 0.225, 0.225, 0.204, 0.165, sandstone, copper],
    ["cupola", 0.219, 0.231, 0.190, 0.194, 0.193, masonry, slate],
  ],
  [
    ["setback", -0.192, 0.229, 0.310, 0.198, 0.257, clay, slate],
    ["pediment", 0.243, 0.237, 0.210, 0.168, 0.173, ivory, cobalt],
    ["cupola", 0.236, -0.133, 0.229, 0.202, 0.181, cream, copper],
    ["gable", -0.300, -0.150, 0.115, 0.200, 0.144, masonry, terracotta],
  ],
  [
    ["imperial", 0.025, 0.268, 0.565, 0.143, 0.172, sandstone, cobalt],
    ["cupola", 0.243, -0.076, 0.241, 0.310, 0.235, clay, copper],
    ["pediment", -0.302, -0.086, 0.132, 0.283, 0.222, ivory, slate],
  ],
  [
    ["steps", -0.288, -0.097, 0.136, 0.313, 0.257, brick, ivory],
    ["vault", 0.241, -0.095, 0.233, 0.264, 0.226, cream, cobalt],
    ["mansard", -0.223, 0.234, 0.209, 0.188, 0.165, clay, terracotta],
    ["setback", 0.199, 0.232, 0.269, 0.209, 0.252, masonry, shale],
  ],
];

const layouts = [treatyLayouts, merchantLayouts, courtLayouts];

export function imperialCivicCompanions(m: Miniature, stage: number, enamel: string, variant: number) {
  const district = layouts[stage - 2];
  for (const lot of district[variant] ?? district[0]) companion(m, lot, enamel);
}
