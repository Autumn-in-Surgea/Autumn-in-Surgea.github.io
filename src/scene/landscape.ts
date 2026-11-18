import type { Resource, Tile } from "../game/types";
import { Miniature } from "./miniature";
import { fishShoal, seaStar } from "./tidalResources";

const leaves = [
  ["#344f46", "#547462", "#839471"],
  ["#77612f", "#af8a43", "#d6b76a"],
  ["#6f3d33", "#a35d43", "#c58252"],
  ["#365e59", "#587c70", "#91a88f"],
  ["#58685a", "#859077", "#bec1a8"],
  ["#494d40", "#747552", "#a89b66"],
];

// A turned collar at the foot and overhanging cuts on the canopy keep the
// trees readable as small carved pieces. The distant model keeps the same crown.
function tree(m: Miniature, x: number, z: number, scale: number, variant: number, simple: boolean) {
  const [shade, body, light] = leaves[variant % leaves.length];
  const y = (h: number) => h * scale;
  if (!simple) m.part("octagon", "#766044", x, y(0.033), z, y(0.17), y(0.065), y(0.15), 0, 0.22);
  m.part("octagon", "#68513b", x, y(0.15), z, y(0.083), y(0.3), y(0.09));
  if (variant % 3 === 0) {
    m.part(simple ? "spire" : "whorl", shade, x, y(0.33), z, y(0.5), y(0.38), y(0.45), 0, 0.23);
    m.part(simple ? "spire" : "whorl", body, x - y(0.01), y(0.47), z, y(0.39), y(0.41), y(0.37), 0, -0.13);
    m.part(simple ? "spire" : "whorl", light, x - y(0.01), y(0.63), z, y(0.23), y(0.32), y(0.24), 0, 0.28);
    return;
  }
  m.part(simple ? "crown" : "foliage", shade, x, y(0.34), z, y(0.45), y(0.27), y(0.39), -0.04, 0.22, 0.05);
  m.part(simple ? "crown" : "foliage", body, x - y(0.05), y(0.455), z - y(0.035), y(0.38), y(0.26), y(0.34), 0, -0.17, 0.15);
  if (!simple) {
    m.part("foliage", light, x - y(0.095), y(0.535), z - y(0.055), y(0.24), y(0.125), y(0.19), 0, 0.31, 0.18);
    m.part("foliage", body, x + y(0.12), y(0.35), z + y(0.1), y(0.24), y(0.20), y(0.22), 0, -0.37, -0.14);
    m.beam("#806848", [x, y(0.13), z], [x + y(0.115), y(0.29), z + y(0.08)], y(0.036));
  }
}

export function grove(variant: number, simple: boolean) {
  const m = new Miniature();
  tree(m, -0.18, -0.16, 0.96, variant, simple);
  tree(m, 0.19, -0.035, 0.73, variant + 1, simple);
  if (!simple) {
    tree(m, -0.2, 0.19, 0.46, variant + 3, false);
    m.part("gem", "#a79560", 0.24, 0.027, 0.18, 0.07, 0.05, 0.055);
  }
  return m.finish();
}

type Point = [number, number, number];

// Unequal ribs break up the ridgeline. Adjacent rings share the snow line and
// the two rock strata, avoiding seams or floating caps on the steep near face.
const rockOutline = [
  [-0.91,-0.42], [-0.23,-0.97], [0.63,-0.78], [0.99,-0.24],
  [0.7,0.52], [0.14,0.72], [-0.43,0.94], [-0.97,0.31],
];
function crag(m: Miniature, x: number, z: number, width: number, depth: number,
  height: number, turn: number, highPeak: boolean, simple: boolean) {
  const yawC = Math.cos(turn), yawS = Math.sin(turn);
  const contour = (radius: number, h: number, dx: number, dz: number, jag: number): Point[] =>
    rockOutline.map(([a, b], i) => {
      const u = width * (radius*a + dx), v = depth * (radius*b + dz);
      const tooth = [0.1, 0.5, -0.38, -0.16, -0.57, 0.25, 0.69, -0.32][i];
      return [x + yawC*u - yawS*v, height*(h + jag*tooth), z + yawS*u + yawC*v];
    });
  const bands = [
    { ring: contour(1, 0.002, 0, 0, 0), color: "#687b78" },
    { ring: contour(0.91, 0.18, 0.009, -0.02, 0.06), color: "#7f8e84" },
    { ring: contour(0.58, 0.45, -0.035, -0.1, 0.13), color: "#9aa595" },
    { ring: contour(0.34, 0.69, -0.105, -0.16, 0.18), color: highPeak ? "#c9cbb5" : "#b1baaa" },
    { ring: contour(0.16, 0.88, -0.17, -0.14, 0.09), color: highPeak ? "#e2dfc6" : "#bcc4b0" },
    { ring: contour(0.07, 1, -0.2, -0.17, 0.025), color: "#dedcc4" },
  ];
  const silhouette = simple ? [bands[0], bands[2], bands[3], bands[5]] : bands;
  for (let j = 1; j < silhouette.length; j++) {
    const lower = silhouette[j - 1], upper = silhouette[j];
    for (let i = 0; i < rockOutline.length; i++) {
      const k = (i+1) % rockOutline.length;
      m.face(lower.color, [lower.ring[i], upper.ring[i], lower.ring[k]]);
      m.face(lower.color, [upper.ring[i], upper.ring[k], lower.ring[k]]);
    }
  }
  m.face(highPeak ? "#e5e3ce" : "#bfccbc", silhouette[silhouette.length-1].ring.slice().reverse());
}

export function mountain(variant: number, simple: boolean) {
  const m = new Miniature();
  const turn = (variant % 3 - 1) * 0.12;
  crag(m, -0.07, -0.1, 0.37, 0.33, 0.68, turn, true, simple);
  crag(m, 0.168, -0.05, 0.2, 0.23, 0.365, turn + 0.43, false, simple);
  if (!simple) {
    crag(m, -0.22, 0.175, 0.158, 0.123, 0.183, turn - 0.28, false, true);
    m.part("crystal", "#a7ab95", 0.242, 0.031, 0.16, 0.113, 0.067, 0.084, -0.18, 0.37, -0.21);
  }
  return m.finish();
}

/** Keep a wooded margin or a cut rock face behind a developed site, with room
 * for the door, tracks, cranes and loading area on its camera-facing side. */
export function siteLandscape(tile: Tile) {
  if (!tile.building || tile.cityId || tile.lighthouse) return null;
  if (tile.terrain === "forest") return "forestEdge";
  if (tile.terrain === "mountain") return tile.building === "mine" ? "quarry" : "ridge";
  return null;
}

export function developedLandscape(kind: NonNullable<ReturnType<typeof siteLandscape>>, variant: number, simple: boolean) {
  const m = new Miniature();
  if (kind === "forestEdge") {
    tree(m, -0.308, -0.254, 0.64, variant, simple);
    tree(m, 0.159, -0.345, 0.50, variant + 1, simple);
    if (!simple) tree(m, -0.366, 0.007, 0.30, variant + 3, false);
  } else {
    const turn = ((variant % 3) - 1) * 0.075;
    if (kind === "quarry") {
      crag(m, -0.19, -0.206, 0.27, 0.24, 0.45, turn, false, simple);
      crag(m, -0.29, -0.002, 0.13, 0.145, 0.20, turn - 0.15, false, true);
    } else {
      crag(m, -0.259, -0.244, 0.207, 0.218, 0.46, turn, true, simple);
      crag(m, 0.111, -0.318, 0.17, 0.125, 0.23, turn + 0.23, false, true);
    }
  }
  return m.finish();
}

// Basic harvests leave most of the tile visible. The low, spreading fruit tree
// carries its fruit on the camera-facing edge of just two clusters of leaves.
function orchard(m: Miniature) {
  const bark = "#7d684d";
  m.beam(bark, [-0.012,0.013,0.012], [-0.027,0.153,0], 0.041,0.045);
  m.beam(bark, [-0.026,0.129,0], [-0.091,0.203,0.029], 0.029);
  m.beam("#8a7658", [-0.025,0.124,0], [0.063,0.229,-0.021], 0.032);
  m.part("foliage", "#829069", -0.08,0.202,0.032, 0.171,0.128,0.151, 0.18,0.27,-0.09);
  m.part("foliage", "#71856a", 0.047,0.235,-0.032, 0.209,0.164,0.183,-0.11,-0.34,0.14);
  m.part("foliage", "#98a17b", 0.069,0.287,-0.037, 0.107,0.059,0.112,0,0.42,0.14);
  for (const [x,y,z,w] of [[-0.111,0.218,0.094,0.072], [0.014,0.253,0.063,0.065], [0.117,0.249,0.027,0.073]]) {
    m.part("foliage", "#bd7150", x,y,z, w,w*0.94,w,0.09,0.36);
    m.part("gem", "#92a06e", x+0.012,y+w*0.53,z-0.005,w*0.44,w*0.16,w*0.21,0.4,-0.48,0.35);
    m.beam("#81744b", [x,y+w*0.4,z], [x+0.006,y+w*0.59,z-0.004], 0.009);
  }
}

function wheat(m: Miniature) {
  for (const [x, z, h, lean] of [
    [-0.131,0.044,0.246,-0.061], [-0.082,-0.117,0.328,-0.02],
    [0.07,-0.075,0.37,0.026], [0.117,0.097,0.28,0.061],
  ]) {
    const top = x + lean;
    m.beam("#8e794b", [x,0.013,z], [top,h,z], 0.021,0.018);
    // Folded leaf and a compact ear. Exposed stalk separates grain from a built farm.
    m.part("gem", "#a6a263", x+lean*0.38+0.021,h*0.46,z, 0.031,0.141,0.027,0.12,0.22,-0.51);
    m.part("crystal", "#bc9249", top,h-0.023,z, 0.04,0.134,0.039,0,0.16,-lean);
    for (let row = 0; row < 3; row++) {
      const spread = 0.034-row*0.005, rise = h-0.068+row*0.042;
      for (const side of [-1,1]) {
        m.part("gem", side === 1 ? "#e3bf70" : "#d3a557",
          top+side*spread*0.77,rise,z-side*spread*0.64,0.051,0.087,0.061,0,0.69,-side*0.63);
      }
    }
    m.part("gem", "#e8c983", top+lean*0.1,h+0.053,z,0.034,0.072,0.04,0,0.2,-lean);
  }
}

function oreVein(m: Miniature) {
  // Keep the exposed seam on the near slope, in front of every mountain variant.
  m.part("hip", "#645e52", 0.201,0.052,0.288, 0.31,0.105,0.196,0,0.28);
  m.part("crown", "#6c6b60", 0.27,0.091,0.26, 0.236,0.173,0.176,-0.09,0.16);
  for (const [x,y,z,w,h,tilt] of [
    [0.16,0.09,0.338,0.084,0.139,0.61], [0.238,0.146,0.305,0.111,0.188,-0.35],
    [0.322,0.127,0.276,0.091,0.15,-0.53],
  ]) {
    m.part("crystal", "#b48c48", x,y,z, w,h,w*0.82, 0.15,0.37,tilt);
    m.part("crystal", "#e4c77f", x+0.014,y+0.017,z+0.017,
      w*0.7,h*0.8,w*0.69,0.14,0.4,tilt);
  }
  m.beam("#d2ab63", [0.107,0.062,0.343], [0.174,0.075,0.365],0.024,0.02);
  m.beam("#d2ab63", [0.174,0.075,0.365], [0.223,0.069,0.344],0.024,0.02);
}

function deer(m: Miniature) {
  // A raised head and short ivory rump clear the tree trunks at the near edge.
  const x = 0.121, z = 0.284;
  m.part("crown", "#a88058", x-0.018,0.155,z,0.193,0.105,0.097,0,0.17,0.06);
  m.part("crown", "#af865c", x+0.045,0.163,z,0.123,0.109,0.091,0,-0.16,-0.12);
  m.part("gem", "#dcc6a2", x-0.099,0.177,z,0.075,0.067,0.061,0.12,0.2,-0.48);
  m.beam("#b28d65", [x+0.067,0.151,z], [x+0.118,0.249,z+0.004], 0.054,0.062);
  m.part("gem", "#d6bc92", x+0.109,0.215,z+0.013,0.046,0.075,0.055,0,0,-0.39);
  m.part("crown", "#c39e73", x+0.133,0.255,z+0.009,0.10,0.066,0.058,0,-0.1,-0.4);
  m.part("gem", "#635342", x+0.176,0.242,z+0.015,0.04,0.027,0.037,0.09,0.19,-0.32);
  for (const side of [-1, 1]) {
    const hock: Point = [x-0.080,0.076,z+side*0.034];
    m.beam("#977b5b", [x-0.053,0.14,z+side*0.028], hock,0.029);
    m.beam("#827159", hock, [x-0.066+side*0.013,0.018,z+side*0.039],0.019);
    m.part("crystal", "#75624e", x-0.059+side*0.013,0.017,z+side*0.039,0.037,0.027,0.026);
    m.beam("#827159", [x+0.051,0.142,z+side*0.033], [x+0.06-side*0.016,0.013,z+side*0.037],0.02);
    m.part("gem", "#b49a7b", x+0.101,0.282,z+side*0.032,0.041,0.065,0.029,side*0.66,0,0.6);
    m.beam("#8e7954", [x+0.11,0.277,z+side*0.019], [x+0.081,0.323,z+side*0.045],0.016);
    m.beam("#8e7954", [x+0.081,0.323,z+side*0.045], [x+0.049,0.347,z+side*0.062],0.013);
    m.beam("#a38b62", [x+0.081,0.323,z+side*0.045], [x+0.092,0.353,z+side*0.054],0.013);
  }
}

export function resourceModel(kind: Resource) {
  if (kind === "fish") return fishShoal();
  if (kind === "starfish") return seaStar();
  const m = new Miniature();
  switch (kind) {
    case "fruit": orchard(m); break;
    case "crop": wheat(m); break;
    case "ore": oreVein(m); break;
    case "animal": deer(m); break;
  }
  return m.finish();
}
