import type { BuildingId } from "../../game/types";
import { bridgeDeckHeight, type BuildingVisualTier } from "../../scene/buildingVisualTier";
import { Miniature } from "../../scene/miniature";

const stone = "#d6c29c",
  ivory = "#efe2bd",
  foundation = "#8b8876";
const brass = "#deb670",
  bronze = "#9e8155",
  timber = "#886047",
  dark = "#415657";
const copper = "#659488",
  slate = "#516a68",
  brick = "#af7156",
  glass = "#72938b";
// Land sculptures are drawn about this datum and placed flush on the tile when baked.
const ground = 0.067;
type Tier = BuildingVisualTier;

// Keep windows inset flush with two façades facing the camera. The projecting
// eaves and truncated roof make even the small workshops read at board zoom.
function hall(m: Miniature, x: number, z: number, w: number, d: number, h: number, roof: string, floor = ground) {
  const eave = floor + h;
  m.box(stone, x, floor + h / 2, z, w, h, d);
  for (let i = 0; i < 3; i++) {
    m.box(dark, x + ((i - 1) * w) / 3, floor + h * 0.55, z + d / 2 + 0.001, w * 0.17, h * 0.34, 0.003);
  }
  m.box(dark, x + w / 2 + 0.001, floor + h * 0.55, z, 0.003, h * 0.34, d * 0.48);
  m.box(ivory, x, eave, z, w + 0.022, 0.022, d + 0.022);
  m.part("hip", roof, x, eave + 0.035, z, w + 0.035, 0.065, d + 0.035);
}

function lantern(m: Miniature, x: number, y: number, z: number, size: number, roof: string) {
  m.part("octagon", bronze, x, y + size * 0.1, z, size, size * 0.2, size);
  m.part("octagon", ivory, x, y + size * 0.42, z, size * 0.71, size * 0.45, size * 0.71);
  m.part("spire", roof, x, y + size * 0.91, z, size * 1.13, size * 0.54, size * 1.13);
  m.part("gem", brass, x, y + size * 1.26, z, size * 0.18, size * 0.22, size * 0.18);
}

function grainSilo(m: Miniature, x: number, z: number, h: number, d: number, roof: string) {
  m.part("drum", ivory, x, ground + h / 2, z, d, h, d);
  m.part("drum", bronze, x, ground + h * 0.43, z, d + 0.009, 0.014, d + 0.009);
  m.part("drum", brass, x, ground + h, z, d + 0.012, 0.018, d + 0.012);
  m.part("spire", roof, x, ground + h + d * 0.25, z, d + 0.024, d * 0.48, d + 0.024);
}

type Point = [number, number, number];

// Each drill has its own raised shoulder and cropped crest, with the native
// plain showing through between rows. The two ends follow the field boundary.
function cropDrill(m: Miniature, x: number, back: number, front: number, wheat: string) {
  const ridge = (y: number, z: number, w: number): Point[] =>
    [[x-w,ground,z],[x-w*0.54,y,z],[x+w*0.54,y,z],[x+w,ground,z]];
  const rows = [ridge(ground+0.001,back,0.016), ridge(ground+0.023,back+0.028,0.035),
    ridge(ground+0.023,front-0.03,0.035), ridge(ground+0.001,front,0.013)];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i-1], b = rows[i];
    for (let j = 0; j < 3; j++) m.face(j === 1 ? "#ac8256" : "#927149", [b[j],b[j+1],a[j+1],a[j]]);
  }
  const clusters = 6;
  const spacing = (front - back - 0.08) / clusters;
  for (let i = 0; i < clusters; i++) {
    const z = back + 0.04 + spacing * (i + 0.5);
    m.part("hip", wheat, x, ground+0.037, z, 0.039, 0.043, spacing*0.90);
  }
}

function farm(m: Miniature, roof: string, tier: Tier) {
  const rows = tier + 3;
  for (let i = 0; i < rows; i++) {
    const x = -0.342 + i * 0.084;
    cropDrill(m, x, -0.175 + 0.011 * i, 0.239 + i * 0.014, i % 2 ? "#cda654" : "#dabb68");
  }
  grainSilo(m, 0.156, -0.083, 0.100 + tier*0.053, 0.110, roof);
  if (tier >= 2) hall(m, -0.120, -0.233, 0.203, 0.103, 0.145, roof);
  if (tier === 3) {
    grainSilo(m, 0.287, -0.102, 0.187, 0.102, copper);
    m.beam(bronze, [0.156,0.312,-0.083], [0.287,0.247,-0.102], 0.021);
    hall(m, 0.249, 0.100, 0.131, 0.092, 0.082, slate);
  }
}

function wheel(m: Miniature, x: number, y: number, z: number, size: number) {
  // Straight spokes and an open ring keep the silhouette legible from a distance.
  const count = 10;
  for (let i = 0; i < count; i++) {
    const a = (i * 2 * Math.PI) / count,
      b = ((i + 1) * 2 * Math.PI) / count;
    const dx = Math.sin(a) * size,
      dy = Math.cos(a) * size;
    m.beam(bronze, [x + dx, y + dy, z], [x + Math.sin(b) * size, y + Math.cos(b) * size, z], 0.022, 0.034);
    if (i % 2 === 0) m.beam(timber, [x, y, z], [x + dx, y + dy, z], 0.016, 0.023);
  }
  m.part("octagon", brass, x, y, z + 0.014, size * 0.4, 0.043, size * 0.4, Math.PI / 2);
}

function tree(m: Miniature, x: number, z: number, size: number) {
  m.part("octagon", timber, x, ground + 0.09 * size, z, 0.051 * size, 0.18 * size, 0.051 * size);
  m.part("crown", slate, x, ground + 0.22 * size, z, 0.19 * size, 0.19 * size, 0.18 * size);
  m.part("crown", copper, x - 0.015 * size, ground + 0.307 * size, z - 0.011 * size, 0.146 * size, 0.12 * size, 0.141 * size);
}

function log(m: Miniature, x: number, y: number, z: number, d: number, length: number) {
  m.part("octagon", timber, x,y,z,d,length,d,Math.PI/2);
  m.part("octagon", "#cfab71", x,y,z+length/2,d*0.85,0.006,d*0.85,Math.PI/2);
  m.part("octagon", "#a88052", x,y,z+length/2+0.003,d*0.43,0.004,d*0.43,Math.PI/2);
}

function stump(m: Miniature, x: number, z: number, width: number, height: number) {
  m.part("octagon", timber, x,ground+height/2,z,width,height,width*0.94);
  m.part("octagon", "#c6a26c", x,ground+height,z,width*0.88,0.004,width*0.83);
  m.part("octagon", "#a58054", x,ground+height+0.003,z,width*0.47,0.003,width*0.45);
  for (const angle of [0.5,2.6,4.8]) {
    const dx = Math.sin(angle) * width*0.41, dz = Math.cos(angle) * width*0.41;
    m.part("hip", timber, x+dx,ground+height*0.17,z+dz,width*0.33,height*0.34,width*0.69,0,angle);
  }
}

function timberWorks(m: Miniature, roof: string, tier: Tier, mill: boolean) {
  const h = 0.09 + tier * 0.045 + (mill ? 0.03 : 0);
  hall(m, -0.072, -0.063, 0.195 + tier * 0.038, 0.166, h, roof);
  const count = tier + 2;
  for (let i = 0; i < count; i++) {
    const x = 0.023 + i * 0.058;
    log(m, x,ground+0.032,0.164+(i%2)*0.012,0.064,0.216+(i%3)*0.013);
    if (tier > 1 && i > 0 && i < count-1) log(m, x-0.029,ground+0.085,0.162,0.059,0.224);
  }
  if (mill) wheel(m, -0.129, ground+0.083+tier*0.021, 0.052, 0.069+tier*0.021);
  else {
    stump(m, 0.190, -0.049, 0.098, 0.047);
    stump(m, -0.115, 0.191, 0.072, 0.032);
    // One felled trunk still bears a branch and points back towards the treeline.
    log(m, 0.112,ground+0.031,-0.181,0.062,0.217);
    m.beam(timber,[0.107,ground+0.04,-0.221],[0.068,ground+0.079,-0.250],0.018);
  }
  if (tier >= 2) {
    for (const x of [0.042, 0.231])
      for (const z of [0.094,0.232]) m.box(timber, x, ground+0.094, z, 0.022, 0.188, 0.024);
    m.part("hip", slate, 0.136,ground+0.204,0.159,0.231,0.042,0.181);
  }
  if (tier === 3) {
    if (mill) {
      hall(m, -0.012, -0.207, 0.29, 0.096, 0.235, slate);
      m.part("octagon", brick, -0.173, ground+0.2235, -0.186, 0.072, 0.447, 0.072);
      m.part("octagon", ivory, -0.173, ground+0.447, -0.186, 0.087, 0.023, 0.087);
    } else {
      const apex: Point = [-0.234, 0.383, 0.085];
      m.beam(timber, [-0.299,ground+0.010,0.216], apex, 0.031);
      m.beam(timber, [-0.214,ground+0.010,-0.050], apex, 0.031);
      m.beam(bronze, apex, [-0.05,0.426,0.172], 0.03);
      m.beam(bronze, [-0.05,0.426,0.172], [-0.05,0.2,0.172], 0.012);
    }
  }
}

function mine(m: Miniature, roof: string, tier: Tier) {
  // An exposed face of bedrock carries the adit, with its spoil apron reaching
  // the ground at irregular heights around the track.
  const toe: Point[] = [[-0.33,ground,-0.055],[-0.234,ground,0.116],[-0.14,ground,0.150],
    [0.034,ground,0.142],[0.131,ground,0.055],[0.087,ground,-0.147],[-0.170,ground,-0.245]];
  const ledge: Point[] = [[-0.261,0.164,-0.042],[-0.209,0.185,0.065],[-0.132,0.235,0.103],
    [0.028,0.216,0.104],[0.087,0.147,0.025],[0.046,0.263,-0.093],[-0.142,0.305,-0.132]];
  const top: Point = [-0.118,0.276,-0.051];
  const rock = ["#8e907a","#95937c","#808471","#878a77","#9d9a82","#8f8e79","#929580"];
  for (let i = 0; i < toe.length; i++) {
    const j = (i+1) % toe.length;
    m.face(rock[i], [toe[i],toe[j],ledge[j],ledge[i]]);
    m.face(rock[(i+2)%rock.length], [ledge[i],ledge[j],top]);
  }
  // The doorway projects from the cut. Its tie beams and ore seam stay legible at board zoom.
  m.box(dark,-0.052,ground+0.066,0.123,0.128,0.132,0.035);
  for (const side of [-1,1]) {
    m.box(timber,-0.054+side*0.080,ground+0.079,0.132,0.033,0.158,0.052);
    m.box(bronze,-0.054+side*0.044,ground+0.016,0.213,0.012,0.012,0.220);
  }
  m.box(timber,-0.054,ground+0.157,0.134,0.210,0.030,0.063);
  m.box(roof,-0.052,ground+0.158,0.167,0.051,0.020,0.006);
  for (const z of [0.114,0.164,0.214,0.264,0.314]) m.box(timber,-0.054,ground+0.006,z,0.136,0.012,0.022);
  m.beam("#c1a564",[-0.279,0.132,-0.027],[-0.216,0.177,0.067],0.012);
  m.beam("#d5b86f",[-0.216,0.177,0.067],[-0.167,0.207,0.089],0.010);
  for (const [x,z,h] of [[0.106,0.182,0.083],[0.157,0.130,0.062],[0.184,0.199,0.054]]) {
    m.part("crown",foundation,x,ground+h/2,z,h*1.21,h,h);
    m.part("gem","#b8a16b",x+0.004,ground+h*0.73,z+0.004,h*0.69,h*0.68,h*0.60);
  }
  if (tier >= 2) {
    const h = tier === 2 ? 0.373 : 0.498;
    for (const side of [-1, 1]) {
      m.beam(dark, [0.165 + side * 0.071, ground+0.009, -0.16], [0.165 + side * 0.037, h, -0.121], 0.029);
      m.beam(dark, [0.165 + side * 0.075, ground+0.009, 0.018], [0.165 + side * 0.037, h, -0.107], 0.029);
    }
    m.box(bronze, 0.165, h, -0.116, 0.164, 0.035, 0.12);
    wheel(m, 0.165, h + 0.044, -0.077, 0.055);
    m.part("hip", roof, 0.165, h + 0.129, -0.119, 0.195, 0.048, 0.151);
  }
  if (tier === 3) {
    hall(m, -0.135, -0.191, 0.217, 0.103, 0.197, copper);
    m.beam(bronze, [-0.046,0.269,-0.167],[0.165,0.543,-0.092],0.019);
    for (const z of [0.220,0.273]) m.beam(dark,[-0.106,ground+0.028,z],[-0.002,ground+0.028,z],0.027);
    m.part("hip", dark,-0.055,ground+0.059,0.246,0.106,0.058,0.094,Math.PI);
    m.part("crown",foundation,-0.054,ground+0.087,0.245,0.081,0.053,0.080);
  }
}

function windmill(m: Miniature, roof: string, tier: Tier) {
  const h = 0.256 + tier * 0.081,
    x = -0.027,
    z = -0.039;
  const hub = h + 0.018,
    radius = 0.159 + tier * 0.019;
  m.part("octagon", ivory, x, ground + h / 2, z, 0.172, h, 0.172);
  m.part("disc", bronze, x, h * 0.64, z, 0.193, 0.022, 0.193);
  m.part("spire", roof, x, ground + h + 0.044, z, 0.214, 0.097, 0.214);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + 0.33;
    m.box(timber, x + (Math.sin(a) * radius) / 2, hub + (Math.cos(a) * radius) / 2, 0.075, 0.022, radius, 0.023, 0, 0, -a);
    m.box(
      stone,
      x + Math.sin(a) * radius * 0.78 + Math.cos(a) * 0.019,
      hub + Math.cos(a) * radius * 0.78 - Math.sin(a) * 0.019,
      0.078,
      0.06,
      radius * 0.49,
      0.019,
      0,
      0,
      -a,
    );
  }
  m.part("gem", brass, x, hub, 0.091, 0.059, 0.061, 0.05);
  if (tier >= 2) hall(m, 0.129, -0.098, 0.176, 0.208, 0.132, slate);
  if (tier === 3) {
    grainSilo(m, -0.212, -0.164, 0.215, 0.117, copper);
    grainSilo(m, -0.229, -0.019, 0.16, 0.091, copper);
    m.box(bronze, -0.119, 0.22, -0.154, 0.175, 0.028, 0.047);
  }
}

function forge(m: Miniature, roof: string, tier: Tier) {
  hall(m, -0.043, 0.022, 0.244 + tier * 0.026, 0.21, 0.1 + tier * 0.032, roof);
  m.part("hip", brick, -0.045, ground+0.072, 0.148, 0.154, 0.144, 0.071);
  m.box("#cf8050", -0.045, 0.121, 0.184, 0.082, 0.086, 0.009);
  for (let i = 0; i < tier; i++) {
    const x = 0.136 - i * 0.15,
      h = 0.225 + tier * 0.095 - i * 0.048;
    m.part("octagon", brick, x, ground + h / 2, -0.152, 0.084, h, 0.084);
    m.part("octagon", stone, x, ground + h * 0.77, -0.152, 0.09, 0.025, 0.09);
    m.part("octagon", dark, x, ground + h, -0.152, 0.1, 0.034, 0.1);
  }
  if (tier === 3) {
    m.part("drum", copper, 0.223, 0.184, 0.042, 0.125, 0.213, 0.125);
    m.part("hip", slate, 0.223, 0.3, 0.042, 0.164, 0.047, 0.155);
    m.beam(bronze, [0.223, 0.225, 0.04], [0.135, 0.298, -0.151], 0.028);
  }
}

function market(m: Miniature, roof: string, tier: Tier, bazaar: boolean) {
  const width = 0.237 + tier * 0.046,
    h = 0.106 + tier * 0.053 + (bazaar ? 0.049 : 0);
  hall(m, 0, -0.091, width, 0.154, h, roof);
  const eave = h + 0.036;
  for (const side of [-1, 1]) m.box(bronze, side * width * 0.49, ground + (eave - ground) / 2, 0.166, 0.023, eave - ground, 0.024);
  for (let i = 0; i < 5; i++) m.box(i % 2 ? ivory : roof, ((i - 2) * width) / 5, eave, 0.102, width / 5, 0.032, 0.171, 0.15);
  m.box(timber, 0, 0.113, 0.145, width, 0.084, 0.086);
  if (tier >= 2)
    for (const side of [-1, 1]) {
      hall(m, side * (width / 2 + 0.046), -0.061, 0.076, 0.174, h * 0.67, copper);
    }
  if (bazaar || tier === 3) lantern(m, 0, ground + h + 0.067, -0.091, 0.109 + tier * 0.026, brass);
  if (tier === 3) {
    for (const side of [-1, 1]) {
      m.part("octagon", stone, side * 0.286, 0.15, 0.136, 0.077, 0.169, 0.077);
      m.part("spire", roof, side * 0.286, 0.265, 0.136, 0.112, 0.094, 0.112);
    }
    if (bazaar) hall(m, 0, -0.209, 0.267, 0.084, h * 0.81, copper);
  }
}

function wharf(m: Miniature, x: number, z: number, w: number, d: number) {
  for (const side of [-1, 1])
    for (const end of [-1, 1]) {
      m.part("octagon", dark, x + side * w * 0.41, 0.078, z + end * d * 0.4, 0.049, 0.156, 0.049);
    }
  m.part("bevel", timber, x, 0.109, z, w, 0.063, d);
  for (let i = 1; i < 5; i++) m.box(bronze, x + w * (i / 5 - 0.5), 0.142, z, 0.012, 0.006, d - 0.02);
}

function port(m: Miniature, roof: string, tier: Tier) {
  wharf(m, 0, -0.071, 0.394 + tier * 0.103, 0.176);
  wharf(m, -0.139 - tier * 0.032, 0.104, 0.114, 0.281 + tier * 0.023);
  hall(m, 0.067, -0.071, 0.144 + tier * 0.026, 0.140, 0.096 + tier * 0.039, roof, 0.141);
  if (tier === 1) {
    m.part("octagon", bronze, -0.144, 0.216, -0.03, 0.034, 0.149, 0.034);
    m.beam(timber, [-0.144, 0.28, -0.03], [-0.057, 0.3, 0.056], 0.022);
    return;
  }
  const crane = tier === 3 ? 0.533 : 0.383;
  for (const side of [-1, 1]) {
    m.beam(dark, [-0.154 + side * 0.062, 0.141, -0.062], [-0.154 + side * 0.022, crane, -0.05], 0.028);
  }
  m.beam(bronze, [-0.154, crane, -0.05], [0.015, crane + 0.061, 0.111], 0.036);
  m.beam(bronze, [-0.154, crane - 0.081, -0.05], [-0.01, crane + 0.049, 0.091], 0.016);
  m.beam(dark, [0.015, crane + 0.061, 0.111], [0.015, crane - 0.11, 0.111], 0.012);
  m.box(timber, 0.015, crane - 0.135, 0.111, 0.058, 0.046, 0.061);
  if (tier === 3) {
    wharf(m, 0.241, 0.086, 0.111, 0.274);
    m.part("octagon", ivory, 0.243, 0.23, 0.162, 0.106, 0.197, 0.106);
    lantern(m, 0.243, 0.326, 0.162, 0.126, copper);
    wharf(m,-0.19,-0.198,0.190,0.151);
    hall(m,-0.19,-0.198,0.164,0.124,0.184,slate,0.141);
  }
}

function bridge(m: Miniature, roof: string, tier: Tier) {
  const width = 0.245 + 0.038 * tier,
    edge = width / 2 + 0.006;
  // The deck spans on two beams; the opening under the bridge remains visible.
  for (const side of [-1,1])
    m.box(tier === 1 ? timber : foundation, side*width*0.36,0.111,0,0.047,0.052,0.995);
  m.box(tier === 1 ? bronze : stone, 0, bridgeDeckHeight - 0.013, 0, width + 0.016, 0.026, 1);
  m.box(roof, edge - 0.004,bridgeDeckHeight - 0.020,0,0.014,0.023,0.130);
  for (const side of [-1, 1]) {
    const x = side * edge;
    for (const end of [-1, 1]) {
      const z = end * 0.376;
      m.part("bevel", tier === 1 ? timber : foundation, x, 0.103, z, 0.056, 0.207, 0.105);
      if (tier >= 2) {
        const h = tier === 3 ? 0.398 : 0.281;
        m.part("bevel", stone, x, (0.16 + h) / 2, z, 0.076, h - 0.16, 0.11);
        m.part("hip", roof, x, h + 0.031, z, 0.095, 0.059, 0.129);
      }
    }
    // Graduated openwork parapets leave the water and the span visible underneath.
    const spans = tier === 1 ? 4 : 6;
    for (let i = 0; i <= spans; i++) {
      const z = -0.48 + (0.96 * i) / spans;
      const rise = tier === 1 ? 0 : (tier === 2 ? 0.068 : 0.126) * Math.sin((Math.PI * i) / spans);
      const y = 0.208 + rise;
      m.beam(tier === 1 ? timber : bronze, [x, 0.152, z], [x, y, z], 0.019);
      if (i > 0) {
        const previous = 0.208 + (tier === 1 ? 0 : tier === 2 ? 0.068 : 0.126) * Math.sin((Math.PI * (i - 1)) / spans);
        m.beam(tier === 1 ? timber : dark, [x, previous, z - 0.96 / spans], [x, y, z], 0.024);
        if (tier === 3) m.beam(bronze, [x, 0.157, z - 0.96 / spans], [x, y, z], 0.014);
      }
    }
  }
}

function temple(m: Miniature, roof: string, tier: Tier, type: BuildingId) {
  const w = 0.276 + 0.049 * tier,
    d = 0.219 + 0.034 * tier,
    h = 0.18 + 0.048 * tier;
  const water = type === "waterTemple";
  for (const side of [-1, 1])
    for (let i = 0; i < tier + 1; i++) {
      const x = w * (i / tier - 0.5) * 0.84, z = side * d * 0.39;
      // Separate column footings grow out of the ground; lake pavilions stand on piles.
      m.part("octagon", water ? timber : stone, x,ground+0.026,z,0.071,0.052,0.071);
      m.part("octagon", ivory, x,ground+0.051+h/2,z,0.044,h+0.003,0.044);
      m.part("octagon", brass, x,0.116+h,z,0.064,0.025,0.064);
    }
  if (water) {
    m.box(timber,0,ground+0.043,0,w,0.024,d);
  } else {
    const pathWidth = w * 0.39;
    for (let i=0;i<3;i++) m.box(stone,0,ground+0.006,d*(i-0.5)*0.3,pathWidth,0.012,d*0.24);
  }
  // The statue has its own foot stone even on the open-sided pavilions.
  const statueFoot = ground + (water ? 0.055 : 0);
  m.part("octagon", stone,0,(statueFoot+0.132)/2,0,0.096,0.132-statueFoot,0.096);
  m.box(bronze, 0, 0.13 + h, 0, w + 0.034, 0.034, d + 0.046);
  m.part("hip", roof, 0, 0.181 + h, 0, w + 0.067, 0.08, d + 0.073);
  m.part("gem", brass, 0, 0.188, 0, 0.082, 0.132, 0.082);
  if (type === "forestTemple") {
    tree(m, w / 2 + 0.024, -0.014, 0.91 + tier * 0.074);
    if (tier >= 2) tree(m, -w / 2 - 0.005, 0.131, 0.7);
  }
  if (type === "mountainTemple") {
    m.part("spire4", brass, 0, 0.261 + h, 0, 0.097, 0.093, 0.097);
    m.part("crown", foundation, w / 2 + 0.026, 0.138, 0.068, 0.119, 0.144, 0.132);
    m.part("gem", stone, w / 2 + 0.047, 0.205, 0.066, 0.066, 0.091, 0.055);
  }
  if (type === "waterTemple")
    for (const side of [-1, 1]) {
      const x = side * (w / 2 + 0.027);
      m.part("bevel", copper, x, ground+0.017, 0.026, 0.082, 0.034, d + 0.082);
      m.box(glass, x, 0.102, 0.026, 0.061, 0.01, d + 0.046);
      m.part("octagon", brass, x, 0.121, d / 2 + 0.012, 0.038, 0.044, 0.038);
    }
  if (tier >= 2) {
    m.part("bevel", ivory, 0, ground+0.010, d/2+0.058,0.192,0.020,0.086);
    m.part("bevel", stone,0,ground+0.026,d/2+0.018,0.162,0.025,0.060);
  }
  if (tier === 3) {
    lantern(m, 0, 0.22 + h, 0, 0.143, type === "mountainTemple" ? brass : copper);
    for (const x of [-0.251, 0.251]) {
      m.part("octagon", stone, x, 0.18, 0.171, 0.064, 0.217, 0.064);
      m.part("gem", brass, x, 0.313, 0.171, 0.071, 0.076, 0.071);
    }
  }
}

function monument(m: Miniature, roof: string, tier: Tier, type: BuildingId) {
  const podium = 0.171 + tier * 0.039;
  switch (type) {
    case "altarOfPeace":
      m.part("octagon", ivory, 0, (ground + podium) / 2, 0, 0.261 + tier * 0.036, podium - ground, 0.261 + tier * 0.036);
      m.part("disc", bronze, 0, podium, 0, 0.286 + tier * 0.037, 0.025, 0.286 + tier * 0.037);
      m.part("gem", roof, 0, podium + 0.083 + tier * 0.012, 0, 0.123 + tier * 0.023, 0.145 + tier * 0.04, 0.13 + tier * 0.019);
      if (tier >= 2) for (const side of [-1, 1]) tree(m, side * 0.212, -0.13, 0.71);
      if (tier === 3)
        for (const side of [-1, 1]) {
          m.part("octagon", ivory, side * 0.22, 0.253, -0.197, 0.073, 0.37, 0.073);
          m.beam(brass, [side * 0.22, 0.433, -0.197], [0, 0.505, -0.197], 0.036);
        }
      break;
    case "emperorTomb":
      for (let i = 0; i <= tier; i++) {
        const w = 0.387 + tier * 0.049 - i * 0.073;
        m.part("hip", i % 2 ? stone : foundation, 0, ground+0.0465 + i * 0.081, 0, w, 0.093, w * 0.78);
        m.box(ivory, 0, 0.156 + i * 0.081, 0, w * 0.73, 0.02, w * 0.59);
      }
      m.box(roof,0,0.123,0.127+tier*0.018,0.092,0.069,0.032);
      if (tier >= 2) lantern(m, 0, 0.173 + tier * 0.081, 0, 0.107 + tier * 0.015, roof);
      break;
    case "eyeOfGod": {
      const y = 0.279 + tier * 0.081,
        r = 0.107 + tier * 0.028;
      m.part("octagon", ivory, 0, (ground + y - 0.067) / 2, 0, 0.174 + tier * 0.017, y - 0.067 - ground, 0.174 + tier * 0.017);
      // A pair of open meridians encloses the optical stone on the observatory.
      const rings = tier === 1 ? [0] : [0, 1.05];
      for (const angle of rings)
        for (let i = 0; i < 16; i++) {
          const point = (n: number): [number, number, number] => {
            const phase = (n * 2 * Math.PI) / 16;
            return [r * Math.cos(phase) * Math.cos(angle), y + r * Math.sin(phase), r * Math.cos(phase) * Math.sin(angle)];
          };
          m.beam(brass, point(i), point(i + 1), 0.021);
        }
      m.part("gem", roof, 0, y, 0, 0.137 + tier * 0.019, 0.136 + tier * 0.019, 0.119 + tier * 0.012);
      if (tier === 3)
        for (const s of [-1, 1]) {
          m.part("hip", foundation, s * 0.215, 0.165, 0, 0.111, 0.193, 0.149);
          m.beam(bronze, [s * 0.213, 0.248, 0], [s * r, y, 0], 0.026);
        }
      break;
    }
    case "gateOfPower": {
      const h = 0.212 + tier * 0.089,
        dx = 0.107 + tier * 0.027;
      for (const s of [-1, 1]) {
        m.part("bevel", ivory, s * dx, ground + h / 2, 0, 0.096 + tier * 0.011, h, 0.155 + tier * 0.014);
        m.box(bronze, s * dx, ground + h * 0.76, 0, 0.11 + tier * 0.011, 0.033, 0.169 + tier * 0.014);
        if (tier >= 2) m.part("gem", brass, s * dx, ground + h + 0.099, 0, 0.068, 0.083, 0.068);
      }
      m.box(stone, 0, ground + h, 0, 2 * dx + 0.129, 0.062, 0.221);
      m.part("hip", roof, 0, ground + h + 0.058, 0, 2 * dx + 0.166, 0.071, 0.239);
      if (tier === 3) lantern(m, 0, ground + h + 0.091, 0, 0.106, copper);
      break;
    }
    case "parkOfFortune":
      tree(m, -0.082, -0.063, 0.78 + tier * 0.162);
      m.part("disc", roof, 0.094, ground+0.03, 0.086, 0.14 + tier * 0.039, 0.06, 0.14 + tier * 0.039);
      m.part("disc", glass, 0.094, 0.129, 0.086, 0.108 + tier * 0.039, 0.014, 0.108 + tier * 0.039);
      if (tier >= 2) {
        tree(m, 0.156, -0.158, 0.87);
        m.part("octagon", stone, 0.094, 0.164, 0.086, 0.035, 0.07, 0.035);
        m.part("disc", copper, 0.094, 0.209, 0.086, 0.09, 0.027, 0.09);
      }
      if (tier === 3) {
        for (const x of [-0.251, -0.102]) for (const z of [0.049, 0.211]) m.box(ivory, x, 0.157, z, 0.025, 0.18, 0.025);
        m.part("hip", roof, -0.176, 0.274, 0.13, 0.217, 0.073, 0.22);
      }
      break;
    case "towerOfWisdom":
      for (let i = 0; i < tier + 1; i++) {
        const w = 0.193 + tier * 0.044 - i * 0.037,
          y = ground + 0.117 * i;
        m.part("octagon", ivory, 0, y + 0.057, 0, w, 0.115, w);
        m.part("octagon", roof, 0, y + 0.116, 0, w + 0.022, 0.028, w + 0.022);
      }
      lantern(m, 0, ground + 0.117 * (tier + 1) + 0.014, 0, 0.091 + tier * 0.018, brass);
      if (tier === 3) for (const s of [-1, 1]) hall(m, s * 0.203, -0.077, 0.088, 0.201, 0.154, slate);
      break;
  }
}

export function danubianBuilding(type: BuildingId, roof: string, tier: Tier) {
  const m = new Miniature();
  switch (type) {
    case "farm":
      farm(m, roof, tier);
      break;
    case "lumberHut":
    case "sawmill":
      timberWorks(m, roof, tier, type === "sawmill");
      break;
    case "mine":
      mine(m, roof, tier);
      break;
    case "windmill":
      windmill(m, roof, tier);
      break;
    case "forge":
      forge(m, roof, tier);
      break;
    case "market":
    case "grandBazaar":
      market(m, roof, tier, type === "grandBazaar");
      break;
    case "port":
      port(m, roof, tier);
      break;
    case "bridge":
      bridge(m, roof, tier);
      break;
    case "temple":
    case "forestTemple":
    case "mountainTemple":
    case "waterTemple":
      temple(m, roof, tier, type);
      break;
    default:
      monument(m, roof, tier, type);
  }
  const geometry = m.finish();
  // Marine piers and the shore-fitted bridge already use the waterline as zero.
  if (type === "port" || type === "bridge") return geometry;
  return geometry.translate(0, -ground, 0);
}
