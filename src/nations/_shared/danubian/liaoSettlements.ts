import type { Miniature } from "../../../scene/miniature";
import { cityStreetDatum as ground } from "./cityMasonry";
import { cobalt, ink, ivory, terracotta } from "../../../scene/architecturalPalette";

type Point = [number, number, number];
const earth = "#c59470", stone = "#c7b4aa";
const timber = "#833e32", tileEdge = "#728db0";

// The lower slope flattens over the long eaves. The corners turn up slightly
// while the main ridge stays straight, as on the low hip roofs of Liao halls.
export function liaoTiledRoof(m: Miniature, x: number, z: number, y: number, width: number, depth: number,
  rise: number, tile: string, civic = false) {
  const w = width / 2, d = depth / 2;
  const ridge = w - d * 0.78;
  function course(a: number, b: number, height: number, kick: number): Point[] {
    return [
      [x-a,height+kick,z+b], [x,height,z+b], [x+a,height+kick,z+b], [x+a,height,z],
      [x+a,height+kick,z-b], [x,height,z-b], [x-a,height+kick,z-b], [x-a,height,z],
    ];
  }
  const lip = course(w, d, y, rise * 0.10);
  const mid = course(w - d * 0.34, d * 0.56, y + rise * 0.29, rise * 0.038);
  const crest = course(ridge, 0, y + rise, 0);
  for (let i = 0; i < lip.length; i++) {
    const j = (i + 1) % lip.length;
    const low = (p: Point): Point => [p[0], p[1] - rise * 0.12, p[2]];
    m.face(tileEdge, [low(lip[i]), low(lip[j]), lip[j], lip[i]]);
    m.face(tile, [lip[i], lip[j], mid[j], mid[i]]);
    if (crest[i][0] === crest[j][0]) m.face(tile, [mid[i], mid[j], crest[i]]);
    else m.face(tile, [mid[i], mid[j], crest[j], crest[i]]);
  }
  m.box(tileEdge, x, y + rise, z, ridge * 2 + 0.009, rise * 0.15, rise * 0.19);
  if (!civic) return;
  // Spaced rolls on the main pitches describe the two changes of slope at board zoom.
  for (const side of [-1, 1]) for (const fraction of [-0.74, -0.25, 0.25, 0.74]) {
    const dx = ridge * fraction;
    const drip: Point = [x + dx, y + rise * 0.10 * Math.abs(dx / w), z + side * d];
    const fold: Point = [x + dx, y + rise * (0.29 + 0.038 * Math.abs(dx / (w - d * 0.34))), z + side * d * 0.56];
    const top: Point = [x + dx, y + rise, z];
    m.beam(tileEdge, drip, fold, 0.0045);
    m.beam(tileEdge, fold, top, 0.0045);
  }
  for (const i of [0, 2, 4, 6]) {
    m.beam(tileEdge, lip[i], mid[i], 0.006);
    m.beam(tileEdge, mid[i], crest[i], 0.006);
  }
  for (const sign of [-1, 1]) {
    m.beam(cobalt, [x + sign * ridge, y + rise, z],
      [x + sign * (ridge + 0.004), y + rise + 0.012, z], 0.012);
  }
}

// The side wing presents a gable to the courtyard. Its ridge runs across the
// main hall's ridge, and the tiled slopes finish against the masonry end walls.
function crossGable(m: Miniature, x: number, z: number, eave: number, w: number, d: number) {
  const rise = w * 0.40;
  const left = x - w / 2, right = x + w / 2, front = z + d / 2, back = z - d / 2;
  for (const [a, ay, b, by] of [[left,eave,x,eave+rise], [x,eave+rise,right,eave]]) {
    m.face(terracotta, [[a,ay,front],[b,by,front],[b,by,back],[a,ay,back]]);
  }
  m.face(ivory, [[left,eave,front],[right,eave,front],[x,eave+rise,front]]);
  m.face(ivory, [[right,eave,back],[left,eave,back],[x,eave+rise,back]]);
  for (const end of [front,back]) {
    m.beam(timber, [left,eave,end], [x,eave+rise,end], 0.010);
    m.beam(timber, [x,eave+rise,end], [right,eave,end], 0.010);
  }
  m.box(timber, x, eave + rise, z, 0.010, 0.009, d);
}

function timberHouse(m: Miniature, x: number, z: number, w: number, d: number, h: number, gable = false) {
  m.box(stone, x, ground + 0.008, z, w + 0.012, 0.016, d + 0.012);
  const floor = ground + 0.016;
  m.box(ivory, x, floor + h / 2, z - d * 0.07, w * 0.95, h, d * 0.82);
  m.box(ink, x + w * 0.09, floor + h * 0.42, z + d * 0.35, w * 0.19, h * 0.84, 0.005);
  for (const dx of [-1, 1]) for (const dz of [-1, 1])
    m.box(timber, x + dx * w * 0.46, floor + h / 2, z + dz * d * 0.46, 0.012, h, 0.012);
  m.box(terracotta, x, floor + h, z, w, 0.011, d);
  const eave = floor + h + 0.006;
  if (gable) crossGable(m, x, z, eave, w + 0.016, d + 0.020);
  else liaoTiledRoof(m, x, z, eave, w * 1.23, d * 1.32, d * 0.31, cobalt);
}

function grainShelter(m: Miniature, x: number, z: number) {
  const width = 0.153, depth = 0.126;
  for (const side of [-1,1]) {
    for (const dz of [-1,1]) {
      const h = dz > 0 ? 0.097 : 0.061;
      m.box(timber, x + side * 0.056, ground + h/2, z + dz * 0.045, 0.013, h, 0.013);
    }
    m.beam(timber, [x + side*0.056,ground+0.061,z-0.045], [x + side*0.056,ground+0.097,z+0.045], 0.014);
  }
  const tilt = -Math.atan(0.4);
  m.box("#d3a151", x, ground+0.087, z, width, 0.016, depth, tilt);
  // Two dark battens bind the reed mat on its single raking slope.
  for (const side of [-1,1])
    m.box("#80664b", x + side * 0.040, ground + 0.097, z, 0.006, 0.003, depth - 0.004, tilt);
  m.box(earth, x, ground + 0.019, z, 0.086, 0.038, 0.063);
}

export function liaoVillageLandmark(m: Miniature, _color: string) {
  timberHouse(m, -0.065, -0.062, 0.205, 0.127, 0.063);
}

export function liaoVillage(m: Miniature, color: string) {
  liaoVillageLandmark(m, color);
  grainShelter(m, 0.115, 0.079);
}

export function liaoTownLandmark(m: Miniature, color: string) {
  const x = -0.014, z = -0.101;
  const terrace = ground + 0.029;
  // Stone terrace, stairs and a recessed timber façade under an open three-bay porch.
  m.part("bevel", stone, x, ground + 0.0145, z, 0.410, 0.029, 0.203);
  m.box(stone, x, ground + 0.008, 0.017, 0.112, 0.016, 0.035);
  m.box(ivory, x, terrace + 0.047, z - 0.013, 0.305, 0.094, 0.115);
  m.box(timber, x, terrace + 0.047, z + 0.046, 0.085, 0.094, 0.008);
  for (const side of [-1, 1]) {
    const panel = x + side * 0.104;
    m.box(ink, panel, terrace + 0.062, z + 0.047, 0.054, 0.046, 0.007);
    m.box(terracotta, panel, terrace + 0.062, z + 0.052, 0.005, 0.048, 0.004);
  }
  const eave = 0.203;
  for (const dz of [-0.072, 0.072]) {
    const line = z + dz;
    m.box(timber, x, 0.171, line, 0.363, 0.016, 0.015);
    for (const dx of [-0.166, -0.062, 0.062, 0.166]) {
      const post = x + dx;
      m.part("octagon", stone, post, terrace + 0.006, line, 0.026, 0.012, 0.026);
      m.part("octagon", timber, post, (terrace + 0.169) / 2, line, 0.019, 0.169 - terrace, 0.019);
      // Three increasingly wide bracket courses carry the eave above each column.
      m.box(terracotta, post, 0.181, line, 0.026, 0.015, 0.026);
      m.box(terracotta, post, 0.190, line, 0.046, 0.012, 0.033);
      m.box(timber, post, 0.198, line, 0.021, 0.010, 0.062);
    }
  }
  liaoTiledRoof(m, x, z, eave, 0.470, 0.267, 0.071, cobalt, true);
  // The lacquered front lintel carries the owner's colour.
  m.box(color, x, 0.168, z + 0.084, 0.059, 0.023, 0.009);
}

export function liaoTown(m: Miniature, color: string) {
  liaoTownLandmark(m, color);
  timberHouse(m, -0.168, 0.114, 0.102, 0.143, 0.062, true);
  for (const side of [-1, 1]) {
    m.box(earth, 0.028 + side * 0.132, ground + 0.022, 0.207, 0.118, 0.044, 0.025);
    m.box(tileEdge, 0.028 + side * 0.132, ground + 0.046, 0.207, 0.125, 0.009, 0.032);
    m.box(timber, 0.028 + side * 0.055, ground + 0.040, 0.207, 0.015, 0.080, 0.015);
  }
  m.box(color, 0.028, ground + 0.078, 0.207, 0.131, 0.014, 0.026);
  // A short ridge-less canopy caps the gate, with a rolled crown and shallow flaring ends.
  const cap = [[0.168,0.135], [0.192,0.151], [0.204,0.155], [0.216,0.155], [0.229,0.151], [0.253,0.136]];
  for (let i = 1; i < cap.length; i++) {
    const [back, high] = cap[i-1], [front, low] = cap[i];
    m.face(cobalt, [[-0.053,low,front],[0.109,low,front],[0.109,high,back],[-0.053,high,back]]);
    for (const x of [-0.052, 0.108])
      m.beam(tileEdge, [x,high,back], [x,low,front], 0.006);
  }
  m.box(tileEdge, 0.028, 0.134, 0.253, 0.165, 0.006, 0.007);
}
