import { Miniature } from "../../scene/miniature";

// Warm stucco, glazed tile and patinated copper are shared across the six
// silhouettes. The roofs of public buildings and the standard carry the owner's enamel.
const stone = "#d4bf97";
const ivory = "#efdfba";
const ochre = "#d5ac77";
const footing = "#888574";
const timber = "#785442";
const tile = "#a85d46";
const slate = "#4d6568";
const copper = "#5d9386";
const glass = "#44595a";
const brass = "#d7ad62";
const ground = 0.051;

// The two outward-facing walls use flush window inlays. Each opening is one
// quad, and every architectural detail is baked into the same coloured mesh.
function facade(m: Miniature, x: number, z: number, w: number, d: number, h: number,
  plaster: string, bays: number, floors: number) {
  m.box(plaster, x, ground + h / 2, z, w, h, d);
  const insetWall = (across: number, spacing: number, right: boolean) => {
    const half = spacing * 0.21;
    for (let floor = 0; floor < floors; floor++) {
      const low = ground + h * (floor + 0.18) / floors;
      const high = ground + h * (floor + 0.68) / floors;
      if (right) {
        const wall = x + w / 2 + 0.001;
        m.face(glass, [[wall,low,across+half], [wall,low,across-half], [wall,high,across-half], [wall,high,across+half]]);
      } else {
        const wall = z + d / 2 + 0.001;
        m.face(glass, [[across-half,low,wall], [across+half,low,wall], [across+half,high,wall], [across-half,high,wall]]);
      }
    }
  };
  for (let bay = 0; bay < bays; bay++) insetWall(x + w * ((bay + 0.5) / bays - 0.5), w / bays, false);
  const sideBays = Math.max(1, Math.round(bays * d / w));
  for (let bay = 0; bay < sideBays; bay++) insetWall(z + d * ((bay + 0.5) / sideBays - 0.5), d / sideBays, true);
  m.box(ivory, x, ground + h - 0.007, z, w + 0.014, 0.014, d + 0.014);
  return ground + h;
}

function gable(m: Miniature, x: number, y: number, z: number, width: number, depth: number, rise: number, roof: string) {
  const l = x - width / 2, r = x + width / 2;
  const back = z - depth / 2, front = z + depth / 2;
  m.face(roof, [[l,y,front], [r,y,front], [r,y+rise,z], [l,y+rise,z]]);
  m.face(roof, [[r,y,back], [l,y,back], [l,y+rise,z], [r,y+rise,z]]);
  m.face(ochre, [[r,y,front], [r,y,back], [r,y+rise,z]]);
  m.face(ochre, [[l,y,back], [l,y,front], [l,y+rise,z]]);
}

function cottage(m: Miniature, x: number, z: number, size: number, roof: string) {
  const w = 0.19 * size, d = 0.14 * size;
  const y = facade(m, x, z, w, d, 0.105 * size, ivory, 2, 1);
  gable(m, x, y, z, w + 0.028, d + 0.025, 0.08 * size, roof);
  m.box(timber, x - w * 0.28, y + 0.061 * size, z - d * 0.19, 0.032, 0.081 * size, 0.032);
}

function block(m: Miniature, x: number, z: number, w: number, d: number, h: number,
  roof: string, floors = 2, plaster = stone) {
  const y = facade(m, x, z, w, d, h, plaster, Math.max(2, Math.round(w / 0.07)), floors);
  const rise = Math.min(0.085, d * 0.4);
  m.part("hip", roof, x, y + rise / 2, z, w + 0.024, rise, d + 0.024);
  return y + rise;
}

function standard(m: Miniature, edge: number, height: number, color: string) {
  const x = edge - 0.034, z = -edge + 0.041;
  m.part("octagon", brass, x, (ground + height) / 2, z, 0.018, height - ground, 0.018);
  m.box(color, x - 0.054, height - 0.05, z, 0.117, 0.064, 0.014);
  m.part("gem", brass, x, height + 0.009, z, 0.031, 0.038, 0.031);
}

function fortifications(m: Miniature, edge: number) {
  const span = 2 * edge;
  for (const s of [-1, 1]) {
    m.box(footing, s * edge, 0.109, 0, 0.031, 0.14, span);
    m.box(stone, s * edge, 0.184, 0, 0.04, 0.016, span);
    m.box(footing, s * edge * 0.6, 0.102, edge, edge * 0.8, 0.125, 0.032);
    for (const end of [-1, 1]) {
      m.part("octagon", stone, s * edge, 0.135, end * edge, 0.069, 0.18, 0.069);
      m.part("octagon", slate, s * edge, 0.228, end * edge, 0.074, 0.026, 0.074);
    }
  }
  m.box(footing, 0, 0.109, -edge, span, 0.14, 0.032);
}

// A stepped octagonal drum gives the copper dome a drum, shoulder, crown
// and lantern silhouette even at board zoom. No transparent faces or textures.
function cupola(m: Miniature, x: number, y: number, z: number, width: number, roof: string) {
  const course = (shape: "octagon" | "spire", color: string, w: number, h: number) => {
    m.part(shape, color, x, y + h * width / 2, z, w * width, h * width, w * width);
    y += h * width;
  };
  course("octagon", brass, 0.94, 0.065);
  course("octagon", ivory, 0.83, 0.20);
  course("octagon", slate, 0.88, 0.06);
  course("octagon", roof, 1, 0.14);
  course("spire", roof, 0.99, 0.48);
  course("octagon", ivory, 0.19, 0.13);
  course("spire", brass, 0.27, 0.22);
}

function clockTower(m: Miniature, x: number, z: number, w: number, h: number, roof: string) {
  const y = facade(m, x, z, w, w, h, ochre, 1, 3);
  m.box(ivory, x, y - 0.058, z, w + 0.012, 0.102, w + 0.012);
  m.part("octagon", glass, x, y - 0.055, z + w / 2 + 0.010, w * 0.50, 0.012, w * 0.50, Math.PI / 2);
  m.part("octagon", ivory, x, y - 0.055, z + w / 2 + 0.018, w * 0.36, 0.009, w * 0.36, Math.PI / 2);
  m.box(brass, x, y, z, w + 0.036, 0.021, w + 0.036);
  m.part("hip", roof, x, y + w * 0.32, z, w * 1.17, w * 0.59, w * 1.17);
  m.part("spire4", brass, x, y + w * 0.79, z, w * 0.33, w * 0.40, w * 0.33);
}

function village(m: Miniature, color: string) {
  cottage(m, -0.115, -0.104, 1.04, tile);
  cottage(m, 0.115, -0.019, 0.82, color);
  m.box(timber, -0.11, 0.078, 0.127, 0.13, 0.052, 0.08);
  gable(m, -0.11, 0.106, 0.127, 0.151, 0.102, 0.041, slate);
}

function marketTown(m: Miniature, color: string) {
  const y = facade(m, -0.045, -0.129, 0.367, 0.156, 0.19, ochre, 4, 2);
  gable(m, -0.045, y, -0.129, 0.394, 0.188, 0.098, tile);
  for (const x of [-0.20, 0.105]) m.box(timber, x, 0.119, 0.025, 0.019, 0.136, 0.019);
  for (let i = 0; i < 5; i++) m.box(i % 2 ? ivory : color, -0.197 + i * 0.075, 0.183, -0.001, 0.075, 0.018, 0.103, 0.20);
  cottage(m, 0.196, 0.112, 0.8, slate);
  cottage(m, -0.185, 0.173, 0.71, tile);
}

function borough(m: Miniature, color: string) {
  // The belfry rises out of a cluster of lower roofs around the public square.
  block(m, -0.09, -0.16, 0.375, 0.19, 0.175, tile, 2, ochre);
  clockTower(m, -0.14, -0.16, 0.125, 0.325, color);
  block(m, 0.19, -0.06, 0.136, 0.261, 0.144, slate);
  cottage(m, -0.181, 0.155, 0.98, tile);
  m.part("octagon", ivory, 0.105, 0.071, 0.145, 0.092, 0.039, 0.092);
  m.part("octagon", copper, 0.105, 0.103, 0.145, 0.031, 0.032, 0.031);
}

function operaDistrict(m: Miniature, color: string) {
  const y = block(m, -0.105, -0.14, 0.36, 0.26, 0.247, slate, 2, ivory);
  cupola(m, -0.106, y - 0.025, -0.14, 0.214, copper);
  block(m, 0.208, -0.086, 0.157, 0.326, 0.216, color, 3, ochre);
  block(m, -0.17, 0.19, 0.254, 0.124, 0.168, tile);
  // Portico faces the square, with stepped approach and three stone piers.
  m.box(stone, -0.105, 0.068, 0.042, 0.237, 0.034, 0.13);
  for (const dx of [-0.083, 0, 0.083]) m.box(ivory, -0.105 + dx, 0.155, 0.046, 0.028, 0.15, 0.027);
  gable(m, -0.105, 0.235, 0.018, 0.245, 0.122, 0.051, color);
}

function boulevard(m: Miniature, color: string) {
  // The tall civic clock and broad mansard blocks frame two sides of the avenue.
  block(m, -0.105, -0.22, 0.426, 0.178, 0.289, color, 3, ivory);
  clockTower(m, -0.136, -0.161, 0.145, 0.565, copper);
  block(m, 0.207, -0.071, 0.187, 0.432, 0.267, slate, 3);
  block(m, -0.225, 0.106, 0.146, 0.30, 0.234, tile, 3, ochre);
  block(m, 0.055, 0.223, 0.235, 0.119, 0.158, slate);
  for (const x of [-0.071, 0.067]) m.part("octagon", stone, x, 0.12, 0.001, 0.026, 0.14, 0.026);
  m.part("hip", color, -0.003, 0.224, -0.012, 0.202, 0.076, 0.13);
}

function metropolis(m: Miniature, color: string) {
  // A large central dome is flanked by two copper-roofed pavilions. Stepped
  // wings and lower street fronts preserve its skyline above a dense city block.
  const y = block(m, -0.094, -0.152, 0.425, 0.312, 0.367, slate, 4, ivory);
  cupola(m, -0.094, y - 0.038, -0.151, 0.324, copper);
  for (const x of [-0.263, 0.086]) {
    const base = block(m, x, -0.026, 0.133, 0.13, 0.322, color, 3, ochre);
    cupola(m, x, base - 0.015, -0.026, 0.129, copper);
  }
  block(m, 0.236, -0.159, 0.161, 0.325, 0.337, color, 4);
  block(m, 0.242, 0.153, 0.151, 0.187, 0.246, slate, 3, ivory);
  block(m, -0.207, 0.209, 0.226, 0.15, 0.25, tile, 3, ochre);
  block(m, 0.022, 0.269, 0.142, 0.123, 0.172, color);
  m.box(stone, -0.083, 0.072, 0.102, 0.289, 0.04, 0.127);
  for (const x of [-0.192, -0.119, -0.046, 0.026]) m.box(ivory, x, 0.187, 0.077, 0.032, 0.208, 0.035);
  gable(m, -0.083, 0.295, 0.066, 0.292, 0.122, 0.067, color);
}

const stages = [village, marketTown, borough, operaDistrict, boulevard, metropolis];
const widths = [0.54, 0.62, 0.71, 0.77, 0.82, 0.86];

export function danubianCity(color: string, level: number, capital: boolean, walls: boolean) {
  const m = new Miniature();
  if (level === 0) {
    m.part("bevel", footing, 0, 0.024, 0, 0.455, 0.048, 0.375);
    cottage(m, -0.09, -0.045, 0.91, "#938268");
    cottage(m, 0.105, 0.094, 0.7, "#8b7862");
    return m.finish();
  }
  const stage = Math.min(level, stages.length) - 1;
  const width = widths[stage];
  m.part("bevel", footing, 0, 0.017, 0, width, 0.034, width);
  m.part("bevel", level < 3 ? "#bca98a" : stone, 0, 0.042, 0, width - 0.025, 0.018, width - 0.025);
  stages[stage](m, color);
  if (capital) standard(m, width / 2, 0.245 + stage * 0.063, color);
  if (walls) fortifications(m, width / 2 - 0.03);
  return m.finish();
}
