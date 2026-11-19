import { brick, cobalt, copper, ink, ivory, terracotta } from "../../scene/architecturalPalette";
import type { Miniature } from "../../scene/miniature";
import { cityStreetDatum as ground } from "../_shared/danubian/cityMasonry";
import { liaoTiledRoof } from "../_shared/danubian/liaoSettlements";

const stone = "#bbae9d";
const timber = "#874737";
const reed = "#c99a54";
const slateBlue = "#617894";

function wing(m: Miniature, x: number, z: number, w: number, d: number, height: number, tiles: string) {
  const eave = ground + height;
  const left = x - w / 2, right = x + w / 2, front = z + d / 2, back = z - d / 2;
  const ridge = eave + w * 0.26;
  m.part("bevel", stone, x, ground + 0.008, z, w * 0.88, 0.016, d * 0.89);
  m.box(ivory, x, (ground + eave) / 2, z, w * 0.79, height, d * 0.8);
  m.box(ink, x, eave - height * 0.36, z + d * 0.404, w * 0.28, height * 0.59, 0.006);
  for (const side of [-1, 1]) {
    m.box(timber, x + side * w * 0.36, eave - height * 0.48, z + d * 0.41, 0.009, height * 0.89, 0.009);
    m.box(timber, x + side * w * 0.401, eave - height * 0.40, z - d * 0.12, 0.005, height * 0.23, d * 0.30);
  }
  m.face(tiles, [[left,eave,back], [left,eave,front], [x,ridge,front], [x,ridge,back]]);
  m.face(tiles, [[x,ridge,back], [x,ridge,front], [right,eave,front], [right,eave,back]]);
  m.face(timber, [[left,eave,front], [right,eave,front], [x,ridge,front]]);
  m.face(timber, [[right,eave,back], [left,eave,back], [x,ridge,back]]);
  m.box(slateBlue, x, ridge, z, 0.009, 0.007, d * 1.03);
  for (const edge of [front, back]) {
    m.beam(tiles, [left,eave,edge], [x,ridge,edge], 0.006);
    m.beam(tiles, [x,ridge,edge], [right,eave,edge], 0.006);
  }
}

function canopy(m: Miniature, x: number, z: number, w: number, d: number, height: number, bays: number) {
  const count = bays + 1;
  const eave = ground + height;
  for (let i = 0; i < count; i++) {
    const px = x + w * 0.44 * (2 * i / bays - 1);
    for (const side of [-1, 1]) {
      const h = height + side * d * 0.08;
      m.box(timber, px, ground + h / 2, z + side * d * 0.37, 0.012, h, 0.012);
    }
    if (i === bays) continue;
    const center = px + w * 0.44 / bays;
    m.box(stone, center, ground + 0.010, z - d * 0.16, w * 0.61 / bays, 0.020, d * 0.43);
    m.box(i % 2 ? terracotta : brick, center, ground + 0.026, z - d * 0.16, w * 0.52 / bays, 0.015, d * 0.34);
  }
  m.box(reed, x, eave, z, w, 0.013, d, -0.20);
  for (const side of [-1, 1])
    m.box(timber, x, eave + side * d * 0.087 + 0.009, z + side * d * 0.44, w * 1.02, 0.007, 0.010, -0.20);
}

function workshop(m: Miniature, x: number, z: number, w: number, d: number, height: number, tiles: string) {
  const eave = ground + height;
  const front = z + d * 0.35;
  m.part("bevel", stone, x, ground + 0.007, z, w * 0.89, 0.014, d * 0.85);
  m.box(ivory, x, ground + height * 0.49, z - d * 0.29, w * 0.76, height * 0.86, 0.012);
  for (const side of [-1, 1]) {
    const px = x + side * w * 0.36;
    m.box(ivory, px, ground + height * 0.44, z, 0.010, height * 0.77, d * 0.66);
    m.box(timber, px, ground + height / 2, front, 0.013, height, 0.014);
    m.box(timber, x + side * w * 0.18, eave - 0.009, front, 0.041, 0.016, 0.015);
    m.box("#9e6442", x + side * w * 0.17, ground + 0.017, front + 0.009, w * 0.23, 0.027, d * 0.21);
  }
  m.box(timber, x, eave - 0.008, front, w * 0.81, 0.014, 0.013);
  m.box(timber, x, ground + height / 2, front, 0.015, height, 0.015);
  liaoTiledRoof(m, x, z, eave, w, d, height * 0.34, tiles);
}

function granary(m: Miniature, x: number, z: number, w: number, d: number, height: number, tiles: string) {
  const floor = ground + height * 0.24;
  const eave = ground + height * 0.73;
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    const px = x + a * w * 0.32, pz = z + b * d * 0.33;
    m.part("octagon", stone, px, ground + 0.005, pz, 0.023, 0.010, 0.023);
    m.box(timber, px, (ground + floor) / 2, pz, 0.013, floor - ground, 0.013);
  }
  m.box(timber, x, floor, z, w * 0.81, 0.010, d * 0.84);
  m.box("#9f6345", x, (floor + eave) / 2, z, w * 0.75, eave - floor, d * 0.74);
  m.box(ink, x, floor + height * 0.23, z + d * 0.373, w * 0.27, height * 0.33, 0.005);
  for (const fraction of [0.40, 0.60])
    m.box(timber, x, ground + height * fraction, z, w * 0.78, 0.006, d * 0.76);
  liaoTiledRoof(m, x, z, eave, w, d, height * 0.23, tiles);
}

function gate(m: Miniature, x: number, z: number, w: number, d: number, height: number, enamel: string) {
  const eave = ground + height;
  const passage = w * 0.44;
  for (const side of [-1, 1]) {
    m.part("bevel", stone, x + side * passage / 2, ground + 0.008, z, 0.045, 0.016, d * 0.70);
    for (const offset of [-1, 1]) {
      const pz = z + offset * d * 0.23;
      m.box(timber, x + side * passage / 2, (ground + eave) / 2, pz, 0.019, height, 0.019);
      m.box(brick, x + side * passage / 2, eave - 0.009, pz, 0.032, 0.022, 0.029);
    }
  }
  m.box(enamel, x, eave - 0.022, z + d * 0.24, w * 0.66, 0.016, 0.012);
  liaoTiledRoof(m, x, z, eave, w, d, height * 0.32, cobalt);
}

function well(m: Miniature, x: number, z: number, width: number) {
  m.part("octagon", stone, x, ground + 0.013, z, width, 0.026, width);
  m.part("octagon", ink, x, ground + 0.026, z, width * 0.72, 0.006, width * 0.72);
  m.part("octagon", copper, x, ground + 0.029, z, width * 0.56, 0.006, width * 0.56);
}

const villageCourts = [
  // A broad two-bay pottery shop shares an open yard with the old house.
  (m: Miniature) => workshop(m, 0.181, 0.055, 0.212, 0.181, 0.077, slateBlue),
  // Separate family houses frame a diagonal path between the gables.
  (m: Miniature) => {
    wing(m, -0.170, 0.137, 0.193, 0.158, 0.063, terracotta);
    wing(m, 0.141, 0.184, 0.146, 0.120, 0.054, cobalt);
  },
  // A close eastern granary and store make an offset service lane.
  (m: Miniature) => {
    granary(m, 0.166, -0.037, 0.161, 0.141, 0.124, cobalt);
    canopy(m, 0.115, 0.137, 0.202, 0.116, 0.052, 1);
  },
  // A strip of market stalls faces the approach, with a well at one end of the main house.
  (m: Miniature) => {
    canopy(m, 0.009, 0.185, 0.432, 0.112, 0.060, 3);
    well(m, 0.183, -0.003, 0.107);
  },
];

const townCourts = [
  // Formal twin wings flank an open forecourt and covered gate.
  (m: Miniature, enamel: string) => {
    wing(m, -0.173, 0.136, 0.125, 0.167, 0.101, terracotta);
    wing(m, 0.163, 0.142, 0.128, 0.166, 0.090, cobalt);
    gate(m, -0.006, 0.214, 0.150, 0.061, 0.095, enamel);
  },
  // A two-bay workshop shoulders into the lane opposite a tall raised store.
  (m: Miniature) => {
    workshop(m, -0.090, 0.155, 0.286, 0.150, 0.115, "#895a52");
    granary(m, 0.164, 0.122, 0.133, 0.134, 0.200, cobalt);
  },
  // Alternating stall depths wrap around the east side of the town's market.
  (m: Miniature) => {
    canopy(m, -0.133, 0.140, 0.181, 0.168, 0.083, 2);
    canopy(m, 0.119, 0.194, 0.226, 0.096, 0.072, 3);
    wing(m, 0.175, 0.085, 0.124, 0.088, 0.076, terracotta);
  },
  // A wide ceremonial gate takes the front, with a low guardhouse behind its east end.
  (m: Miniature, enamel: string) => {
    gate(m, -0.057, 0.169, 0.268, 0.125, 0.153, enamel);
    wing(m, 0.173, 0.118, 0.121, 0.136, 0.084, "#716e82");
  },
];

export function imperialLiaoCompanions(m: Miniature, stage: number, enamel: string, variant: number) {
  if (stage === 0) (villageCourts[variant] ?? villageCourts[0])(m);
  else (townCourts[variant] ?? townCourts[0])(m, enamel);
}
