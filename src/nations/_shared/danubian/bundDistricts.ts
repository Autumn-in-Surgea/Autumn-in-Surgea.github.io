import { Miniature } from "../../../scene/miniature";
import { facade, cityStreetDatum as pavement } from "./cityMasonry";
import { brick, cobalt as slate, copper, ink as glass, ivory as cream, masonry as limestone, terracotta } from "../../../scene/architecturalPalette";

const sandstone = "#d0a37b";
const paleBrick = "#df9c83";
const bronze = "#c99a4c";
type Point = [number, number, number];

// Ridged terrace roofs meet above the party walls. Turn both slopes together
// for the return streets, so every roof ridge follows its own row of houses.
function pitchedRoof(m: Miniature, x: number, z: number, y: number, w: number, d: number, rise: number, roof: string,
  alongZ = d > w) {
  const halfRidge = (alongZ ? d : w) / 2 + 0.004;
  const halfSpan = (alongZ ? w : d) / 2 + 0.005;
  const point = (u: number, h: number, v: number): Point =>
    alongZ ? [x - v, y + h, z + u] : [x + u, y + h, z + v];
  const frontL = point(-halfRidge, 0, halfSpan), frontR = point(halfRidge, 0, halfSpan);
  const backL = point(-halfRidge, 0, -halfSpan), backR = point(halfRidge, 0, -halfSpan);
  const ridgeL = point(-halfRidge, rise, 0), ridgeR = point(halfRidge, rise, 0);
  m.face(roof, [frontL, frontR, ridgeR, ridgeL]);
  m.face(roof, [backR, backL, ridgeL, ridgeR]);
  m.face(paleBrick, [frontR, backR, ridgeR]);
  m.face(paleBrick, [backL, frontL, ridgeL]);
}

// Two slopes meet along each side of this long mansard. The dormers face
// the front street; their triangular cheeks actually emerge from the roof.
function mansard(m: Miniature, x: number, z: number, y: number, w: number, d: number, rise: number) {
  const rings = [[1.00, 1.00, 0], [0.83, 0.65, 0.72], [0.67, 0.22, 1]] as const;
  const corners = [[-1,-1], [1,-1], [1,1], [-1,1]] as const;
  const point = (ring: number, corner: number): Point => {
    const [width, depth, h] = rings[ring], [sx, sz] = corners[corner % 4];
    return [x + sx * width*w/2, y + h*rise, z + sz*depth*d/2];
  };
  for (let course = 0; course < 2; course++) for (let i = 0; i < 4; i++)
    m.face(slate, [point(course,i),point(course+1,i),point(course+1,i+1),point(course,i+1)]);
  m.face(slate, [point(2,3),point(2,2),point(2,1),point(2,0)]);
  for (const side of [-1, 1]) {
    const dx = x + side*w*0.22, dz = z+d*0.37, width = Math.min(0.046, w*0.21);
    m.box(cream, dx, y+rise*0.28, dz, width, rise*0.56, d*0.13);
    m.box(glass, dx, y+rise*0.34, dz+d*0.066, width*0.52, rise*0.30, 0.003);
    pitchedRoof(m, dx, dz, y+rise*0.56, width+0.006, d*0.18, rise*0.20, slate, true);
  }
}

type TerraceRoof = "ridge" | "crowSteps" | "mansard" | "turret" | "court";
function terrace(m: Miniature, x: number, z: number, w: number, d: number, h: number,
  wall: string, roof: string, shape: TerraceRoof) {
  const y = facade(m, x, z, w, d, h, wall, Math.max(2, Math.round(w / 0.078)), 2);
  if (shape === "mansard") {
    mansard(m, x, z, y, w+0.009, d+0.009, 0.081);
  } else if (shape === "crowSteps") {
    pitchedRoof(m, x, z, y, w-0.006, d-0.023, 0.070, roof, true);
    // Crow-stepped fire walls cap both perpendicular ends of the roof.
    for (const sign of [-1, 1]) for (let i = 0; i < 3; i++) {
      const width = w*(1-i*0.29), elevation = 0.024*(i+1);
      m.box(wall, x, y+elevation/2, z+sign*d*0.46, width, elevation, 0.015);
      m.box(cream, x, y+elevation, z+sign*d*0.46, width+0.003, 0.007, 0.019);
    }
  } else if (shape === "turret") {
    // A roof pavilion grows out of the projecting corner bay and cuts into one slope.
    pitchedRoof(m, x, z, y, w, d, 0.048, roof);
    const cap = Math.min(w, d)*0.70, tx = x+w*0.22, tz = z+d*0.18;
    m.part("octagon", wall, tx, y+0.025, tz, cap, 0.094, cap);
    m.part("octagon", cream, tx, y+0.073, tz, cap*1.10, 0.013, cap*1.10);
    m.part("spire", copper, tx, y+0.117, tz, cap*1.15, 0.085, cap*1.15);
  } else if (shape === "court") {
    // The parapet encloses an open roof terrace with a short glazed stairwell.
    m.box(slate, x, y+0.003, z, w*0.97, 0.008, d*0.97);
    for (const sign of [-1,1]) {
      m.box(wall, x, y+0.012, z+sign*(d/2-0.005), w, 0.025, 0.012);
      m.box(wall, x+sign*(w/2-0.005), y+0.012, z, 0.012, 0.025, d);
    }
    pitchedRoof(m, x-w*0.12, z-d*0.10, y+0.004, w*0.55, d*0.32, 0.025, copper);
  } else {
    pitchedRoof(m, x, z, y, w, d, 0.056, roof);
    m.box(brick, x-w*0.23, y+0.049, z-d*0.11, 0.023, 0.056, 0.021);
  }
}

// Flat clock and hand inlays remain legible without bevels or stacked discs.
function clockFaces(m: Miniature, x: number, z: number, y: number, width: number) {
  for (const side of [false, true]) {
    const at = (u: number, v: number, depth: number): Point =>
      side ? [x + depth, y + v, z - u] : [x + u, y + v, z + depth];
    for (const [r, color, depth] of [[width * 0.35, slate, 0.001], [width * 0.274, cream, 0.002]] as const) {
      const ring: Point[] = [];
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6;
        ring.push(at(r * Math.cos(a), r * Math.sin(a), width / 2 + depth));
      }
      m.face(color, ring);
    }
    const face = width / 2 + 0.003;
    m.face(glass, [at(-0.004, -0.004, face), at(0.003, -0.004, face),
      at(0.003, width * 0.21, face), at(-0.004, width * 0.21, face)]);
    m.face(glass, [at(0, 0, face), at(width * 0.15, -width * 0.08, face),
      at(width * 0.15, -width * 0.02, face), at(0, 0.005, face)]);
  }
}

function customsHall(m: Miniature, x: number, z: number, towerTop: number, color: string) {
  const y = facade(m, x, z, 0.275, 0.215, towerTop * 0.36, limestone, 4, 3);
  m.box(slate, x, y + 0.008, z, 0.26, 0.013, 0.20);
  const tx = x - 0.038, tz = z + 0.012, w = 0.122;
  const shaft = towerTop - 0.162;
  m.box(sandstone, tx, (y + shaft) / 2, tz, w, shaft - y, w);
  for (const dx of [-0.031, 0.031]) {
    m.box(cream, tx + dx, (y + shaft) / 2, tz + w / 2, 0.012, shaft - y, 0.009);
    m.box(slate, tx + w / 2, (y + shaft) / 2, tz + dx, 0.003, (shaft - y) * 0.78, 0.012);
  }
  m.box(cream, tx, shaft + 0.038, tz, w + 0.013, 0.08, w + 0.013);
  clockFaces(m, tx, tz, shaft + 0.039, w + 0.013);
  m.box(bronze, tx, shaft + 0.084, tz, w + 0.025, 0.012, w + 0.025);
  // Open bell chamber and a low metal hood above the clock's four faces.
  for (const dx of [-0.044, 0.044]) for (const dz of [-0.044, 0.044])
    m.box(cream, tx+dx, shaft+0.106, tz+dz, 0.016, 0.039, 0.016);
  m.part("octagon", bronze, tx, shaft+0.112, tz, 0.040, 0.031, 0.040);
  m.part("octagon", color, tx, shaft+0.126, tz, w+0.029, 0.012, w+0.029);
  m.part("hip", color, tx, shaft+0.140, tz, w-0.002, 0.026, w-0.002);
  m.part("octagon", bronze, tx, towerTop-0.006, tz, 0.032, 0.012, 0.032);
}

function tradingBank(m: Miniature, x: number, z: number, w: number, d: number, h: number, color: string) {
  const top = facade(m, x, z, w, d, h, limestone, 4, 3);
  const front = z + d / 2;
  const pillars = 4;
  for (let i = 0; i < pillars; i++) {
    const px = x + w * ((i + 0.5) / pillars - 0.5) * 0.87;
    m.part("octagon", cream, px, pavement + h * 0.43, front + 0.010,
      0.019, h * 0.70, 0.019);
  }
  m.box(cream, x, pavement + h * 0.81, front, w * 0.95, 0.021, 0.042);
  m.box(slate, x, top + 0.007, z, w * 0.94, 0.012, d * 0.92);
  const domeWidth = Math.min(w * 0.84, d * 1.08);
  m.part("drum", cream, x, top + 0.033, z, domeWidth * 0.92, 0.056, domeWidth * 0.92);
  // Flared eave, rounded shoulder and a pinched lantern crown the full banking hall.
  const rings = [[0, 0.54], [0.06, 0.51], [0.22, 0.46], [0.38, 0.35], [0.48, 0.18], [0.48, 0.12]] as const;
  const point = (side: number, course: number): Point => {
    const a = (side / 12) * Math.PI * 2 + Math.PI / 12;
    const [rise, radius] = rings[course];
    return [x + Math.cos(a) * radius * domeWidth, top + 0.062 + rise * domeWidth,
      z + Math.sin(a) * radius * domeWidth];
  };
  for (let j = 1; j < rings.length; j++) for (let i = 0; i < 12; i++)
    m.face(color, [point(i, j-1), point(i, j), point(i+1, j), point(i+1, j-1)]);
  const crown = top + 0.062 + 0.48 * domeWidth;
  m.part("octagon", cream, x, crown + 0.012, z, domeWidth * 0.21, 0.024, domeWidth * 0.21);
  m.part("spire", bronze, x, crown + 0.036, z, domeWidth * 0.25, 0.028, domeWidth * 0.25);
}

// A pair of stone lane gates interrupts the line of brick shopfronts.
function laneGate(m: Miniature, x: number, z: number, width: number) {
  const spring = pavement + 0.074, radius = width * 0.30;
  m.box(cream, x, spring, z, width, 0.018, 0.013);
  const arch: Point[] = [[x-radius, pavement, z+0.009], [x+radius, pavement, z+0.009]];
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * Math.PI;
    arch.push([x + Math.cos(a) * radius, spring + Math.sin(a) * radius, z+0.009]);
  }
  m.face(glass, arch);
  for (const sign of [-1, 1])
    m.box(cream, x + sign * (radius+0.005), (pavement+spring)/2, z+0.008,
      0.009, spring-pavement, 0.012);
  m.face(cream, [[x-width*0.50,spring+0.005,z+0.010],
    [x+width*0.50,spring+0.005,z+0.010], [x,spring+0.048,z+0.010]]);
}

export function bundNeighbourhood(m: Miniature, color: string) {
  // Adjoining low-rise houses run all the way around the block. The street
  // gaps line up with the civic core; each of the four corners has a house.
  const frontages: [number, number, number, number, number, string, string, TerraceRoof][] = [
    [-0.362,  0.380, 0.205, 0.160, 0.132, paleBrick, slate,      "mansard"],
    [-0.141,  0.379, 0.179, 0.173, 0.154, brick,     terracotta, "crowSteps"],
    [ 0.068,  0.365, 0.199, 0.193, 0.109, limestone, slate,      "court"],
    [ 0.332,  0.377, 0.262, 0.169, 0.157, sandstone, terracotta, "turret"],
    [-0.343, -0.374, 0.245, 0.177, 0.120, brick,     terracotta, "ridge"],
    [-0.083, -0.371, 0.206, 0.172, 0.150, limestone, slate,      "crowSteps"],
    [ 0.162, -0.385, 0.239, 0.159, 0.115, sandstone, slate,      "court"],
    [ 0.388, -0.377, 0.151, 0.173, 0.143, paleBrick, terracotta, "ridge"],
    [-0.392, -0.153, 0.141, 0.226, 0.154, sandstone, slate,      "turret"],
    [-0.402,  0.124, 0.130, 0.270, 0.114, brick,     terracotta, "ridge"],
    [ 0.403, -0.144, 0.125, 0.252, 0.128, paleBrick, slate,      "mansard"],
    [ 0.388,  0.128, 0.153, 0.233, 0.100, limestone, terracotta, "crowSteps"],
  ];
  for (const lot of frontages) terrace(m, ...lot);
  laneGate(m, -0.141, 0.4655, 0.072);
  laneGate(m, 0.280, 0.4615, 0.069);
  customsHall(m, -0.131, -0.135, 0.643, color);
  tradingBank(m, 0.118, 0.142, 0.315, 0.188, 0.248, copper);
  const exchange = facade(m, 0.171, -0.119, 0.176, 0.242, 0.232, brick, 2, 3);
  m.part("hip", slate, 0.171, exchange + 0.031, -0.119, 0.186, 0.066, 0.25);
  terrace(m, -0.188, 0.160, 0.165, 0.155, 0.147, limestone, terracotta, "ridge");
}

type Roofline = "parapet" | "lantern" | "mansard" | "galleria" | "pyramid" | "setback";


function commercialBlock(m: Miniature, x: number, z: number, w: number, d: number,
  h: number, wall: string, roofline: Roofline, color: string) {
  const bays = Math.max(2, Math.round(w / 0.085));
  const floors = Math.max(4, Math.round(h / 0.094));
  const y = facade(m, x, z, w, d, h, wall, bays, floors);
  const belt = pavement + h * 0.27;
  if (roofline === "parapet") {
    m.box(slate, x, y + 0.005, z, w * 0.91, 0.012, d * 0.89);
    // Long, low tiled service wing on the rear part of the terrace.
    pitchedRoof(m, x-w*0.09, z-d*0.18, y+0.008, w*0.67, d*0.52, 0.047, terracotta);
    m.box(cream, x, y+0.020, z+d/2-0.005, w+0.005, 0.042, 0.011);
    return;
  }
  if (roofline === "mansard") {
    mansard(m, x, z, y, w, d, 0.117);
    return;
  }
  if (roofline === "galleria") {
    // The trade arcade's barrel vault and fanlight terminate a long street axis.
    const length = w*0.93, span = d*0.84, rise = 0.096, panels = 7;
    const rib = (along: number, i: number): Point => {
      const a = Math.PI * i/panels;
      return [x+along, y+rise*Math.sin(a), z+span*0.5*Math.cos(a)];
    };
    for (let i = 0; i < panels; i++)
      m.face(i < 2 || i > 4 ? copper : "#83b9c6",
        [rib(-length/2,i), rib(length/2,i), rib(length/2,i+1), rib(-length/2,i+1)]);
    const endFace: Point[] = [];
    for (let i = panels; i >= 0; i--) endFace.push(rib(length/2+0.001,i));
    m.face(glass, endFace);
    for (const index of [1, 3, 5, 6]) {
      const base: Point = [x+length/2+0.002, y+0.002, z];
      m.beam(cream, base, rib(length/2+0.002,index), 0.006);
    }
    return;
  }
  // Vertical piers carry the eye from the upper windows into the crown.
  if (roofline !== "lantern") m.box(cream, x, belt, z, w+0.010, 0.014, d+0.010);
  for (const side of [-1, 1]) {
    m.box(cream, x + side * w * 0.34, (belt + y) / 2, z + d / 2 + 0.001,
      0.013, y - belt + 0.024, 0.009);
    m.box(cream, x + w / 2 + 0.001, (belt + y) / 2, z + side * d * 0.33,
      0.009, y - belt + 0.024, 0.013);
  }
  m.box(wall, x, y + 0.025, z, w * 0.81, 0.05, d * 0.80);
  if (roofline === "lantern") {
    const radius = Math.min(w, d) * 0.63;
    const tx = x-w*0.13, tz = z+d*0.11;
    m.part("octagon", cream, tx, y+0.108, tz, radius, 0.119, radius);
    for (const side of [-1, 1])
      m.box(glass, tx+side*radius*0.17, y+0.11, tz+radius*0.44, 0.013, 0.070, 0.013);
    m.part("octagon", bronze, tx, y+0.17, tz, radius*1.16, 0.016, radius*1.16);
    m.part("spire", color, tx, y+0.217, tz, radius*1.17, 0.086, radius*1.17);
  } else if (roofline === "pyramid") {
    const cap = Math.min(w, d) * 0.72, tx = x + w * 0.07;
    m.box(wall, tx, y+0.101, z, cap, 0.103, cap);
    for (const offset of [-0.04, 0.04]) {
      m.box(glass, tx+offset, y+0.098, z+cap/2, 0.017, 0.069, 0.006);
      m.box(glass, tx+cap/2, y+0.098, z+offset, 0.006, 0.069, 0.017);
    }
    m.box(bronze, tx, y+0.157, z, cap*1.08, 0.015, cap*1.08);
    m.part("spire4", color, tx, y+0.247, z, cap*1.08, 0.175, cap*1.08);
    m.box(bronze, tx, y+0.339, z, 0.015, 0.016, 0.015);
  } else {
    m.box(wall, x, y + 0.080, z, w * 0.60, 0.069, d * 0.59);
    m.box(color, x, y + 0.124, z, w * 0.44, 0.027, d * 0.47);
    for (const offset of [-0.19, 0, 0.19]) {
      const h = offset === 0 ? 0.102 : 0.071;
      m.box(cream, x + offset * w, y + 0.115 + h / 2, z + d * 0.12, 0.013, h, 0.026);
    }
  }
}

function masonryCourse(m: Miniature, outline: [number,number][], x: number, z: number,
  bottom: number, top: number, scale: number, stone: string, floors = 0) {
  const ring = outline.map(([px, pz]): [number, number] => [x + (px - x) * scale, z + (pz - z) * scale]);
  m.face(stone, ring.map(([px, pz]): Point => [px, top, pz]).reverse());
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length];
    m.face(stone, [[ax, bottom, az], [ax, top, az], [bx, top, bz], [bx, bottom, bz]]);
    if (!floors || i === 0 || i === ring.length - 1) continue;
    const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz);
    const bays = Math.max(1, Math.round(length / 0.063));
    const onWall = (u: number, v: number): Point =>
      [ax + dx * u + dz * 0.001 / length, bottom + (top-bottom)*v, az + dz * u - dx * 0.001 / length];
    for (let bay = 0; bay < bays; bay++) for (let floor = 0; floor < floors; floor++) {
      const a = (bay + 0.24) / bays, b = (bay + 0.76) / bays;
      const low = (floor + 0.18) / floors, high = (floor + 0.67) / floors;
      m.face(glass, [onWall(a, low), onWall(a, high), onWall(b, high), onWall(b, low)]);
    }
  }
}


// This corner bank turns into the side street on a curved frontage. The
// window quads and stone bands follow the same faceted arc as the masonry.
function cornerBank(m: Miniature, x: number, z: number) {
  const w = 0.302, d = 0.216, radius = 0.082, height = 0.422;
  const left = x - w / 2, right = x + w / 2, back = z - d / 2, front = z + d / 2;
  const cx = right - radius, cz = front - radius;
  const outline: [number, number][] = [[left, back], [right, back]];
  for (let i = 0; i <= 4; i++) {
    const a = Math.PI * i / 8;
    outline.push([cx + radius * Math.cos(a), cz + radius * Math.sin(a)]);
  }
  outline.push([left, front]);

  const y = pavement + height;
  masonryCourse(m, outline, x, z, pavement, y, 1, sandstone, 5);
  masonryCourse(m, outline, x, z, pavement + height * 0.30, pavement + height * 0.30 + 0.012, 1.035, cream);
  masonryCourse(m, outline, x, z, y - 0.01, y + 0.010, 1.055, cream);
  masonryCourse(m, outline, x, z, y + 0.010, y + 0.016, 0.96, slate);
  // Three hipped-back bands turn the curved frontage into a fan-shaped pediment.
  const radial = Math.SQRT1_2;
  for (let i = 0; i < 3; i++) {
    const radius = 0.051 - i * 0.007, width = 0.132 - i * 0.032, level = y + 0.016 + i * 0.029;
    m.box(cream, cx+radial*radius, level+0.015, cz+radial*radius, width, 0.030, 0.040, 0, Math.PI/4);
    m.box(bronze, cx+radial*radius, level+0.031, cz+radial*radius, width+0.004, 0.005, 0.043, 0, Math.PI/4);
  }
  pitchedRoof(m, x-w*0.12, z-d*0.11, y+0.02, w*0.56, d*0.48, 0.044, slate);
}

// A full bow front, stepped back for the penthouse, makes a broad curve
// across three floors of terraces. The stack of unequal wings follows its street corner.
function shippingExchange(m: Miniature, x: number, z: number) {
  const w = 0.342, d = 0.207;
  const outline: [number,number][] = [[x-w/2,z-d/2], [x+w*0.18,z-d/2]];
  for (let i = 1; i <= 8; i++) {
    const a = -Math.PI/2 + Math.PI*i/8;
    outline.push([x+w*0.18+w*0.32*Math.cos(a), z+d*0.50*Math.sin(a)]);
  }
  outline.push([x-w/2,z+d/2]);
  const shoulder = pavement+0.364;
  masonryCourse(m, outline, x, z, pavement, shoulder, 1, limestone, 4);
  for (let floor = 0; floor < 3; floor++) {
    const y = shoulder + floor*0.061, width = 1-floor*0.14;
    masonryCourse(m, outline, x, z, y, y+0.010, width, cream);
    masonryCourse(m, outline, x, z, y+0.010, y+0.061, width-0.07, "#5d91ad", 1);
  }
  masonryCourse(m, outline, x, z, shoulder+0.183, shoulder+0.198, 0.70, cream);
  m.part("drum", bronze, x-w*0.21, shoulder+0.231, z, 0.039, 0.07, 0.039);
}

function steppedPress(m: Miniature, x: number, z: number, color: string) {
  // A taller, narrower elevator tower emerges from one side of a wide printing house.
  const h = 0.419, podium = facade(m, x, z, 0.242, 0.217, h, brick, 3, 5);
  const tx = x-0.047, tz = z+0.017;
  m.box(slate, x, podium+0.008, z, 0.234, 0.014, 0.208);
  m.box(sandstone, tx, podium+0.089, tz, 0.116, 0.178, 0.144);
  for (const dx of [-0.030,0,0.030]) {
    m.box(glass, tx+dx, podium+0.094, tz+0.073, 0.012, 0.115, 0.003);
    m.box(cream, tx+dx-0.007, podium+0.154, tz+0.073, 0.007, 0.095, 0.006);
  }
  m.box(color, tx, podium+0.199, tz, 0.081, 0.043, 0.099);
  m.box(cream, tx, podium+0.231, tz, 0.038, 0.027, 0.061);
}

export function bundSkyline(m: Miniature, color: string) {
  // Four continuous street lines, with a narrow crossing between the second
  // and third row. Rear heights rise above the nearer banks and apartment roofs.
  commercialBlock(m, -0.307, -0.367, 0.319, 0.195, 0.492, limestone, "mansard", copper);
  commercialBlock(m, 0.005, -0.367, 0.266, 0.190, 0.647, sandstone, "setback", color);
  commercialBlock(m, 0.317, -0.361, 0.298, 0.204, 0.552, paleBrick, "parapet", copper);

  customsHall(m, -0.323, -0.119, 0.769, color);
  commercialBlock(m, -0.009, -0.119, 0.278, 0.232, 0.580, limestone, "pyramid", copper);
  commercialBlock(m, 0.312, -0.112, 0.310, 0.224, 0.446, sandstone, "galleria", copper);

  commercialBlock(m, -0.324, 0.132, 0.285, 0.217, 0.544, brick, "lantern", copper);
  steppedPress(m, -0.034, 0.135, color);
  shippingExchange(m, 0.293, 0.135);

  commercialBlock(m, -0.329, 0.365, 0.273, 0.204, 0.393, paleBrick, "mansard", copper);
  tradingBank(m, -0.012, 0.356, 0.319, 0.182, 0.371, copper);
  cornerBank(m, 0.314, 0.357);
}
