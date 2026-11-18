import type { Resource } from "../game/types";
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

// The same cut appears on foliage and architecture. Breaking the outline into a
// handful of overlapping slabs gives a readable silhouette at normal game zoom.
function tree(m: Miniature, x: number, z: number, scale: number, variant: number, simple: boolean) {
  const [shade, body, light] = leaves[variant % leaves.length];
  const y = (h: number) => h * scale;
  m.part("octagon", "#68513b", x, y(0.15), z, y(0.085), y(0.3), y(0.09));
  if (variant % 3 === 0) {
    m.part("spire", shade, x, y(0.34), z, y(0.5), y(0.4), y(0.45), 0, 0.22);
    m.part("spire", body, x - y(0.01), y(0.49), z, y(0.39), y(0.42), y(0.36));
    if (!simple) m.part("spire", light, x + y(0.012), y(0.64), z, y(0.22), y(0.27), y(0.22));
    return;
  }
  m.part("crown", shade, x, y(0.33), z, y(0.46), y(0.28), y(0.38), 0, 0.24, 0.06);
  m.part("crown", body, x - y(0.06), y(0.445), z - y(0.025), y(0.38), y(0.255), y(0.34), 0, -0.21);
  if (!simple) {
    m.part("crown", light, x - y(0.085), y(0.52), z - y(0.065), y(0.23), y(0.13), y(0.21));
    m.part("crown", body, x + y(0.115), y(0.335), z + y(0.09), y(0.27), y(0.21), y(0.22), 0, -0.28);
    m.beam("#796345", [x, y(0.11), z], [x + y(0.12), y(0.28), z + y(0.04)], y(0.035));
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

export function mountain(variant: number, simple: boolean) {
  const m = new Miniature();
  const r = (variant % 3 - 1) * 0.13;
  // Overlapping shoulders, a rock stratum, and a short pale summit.
  m.part("hip", "#687978", -0.05, 0.125, -0.07, 0.68, 0.25, 0.64, 0, r + 0.13);
  m.part("hip", "#899489", -0.075, 0.3, -0.1, 0.52, 0.19, 0.45, 0, r + 0.12);
  m.part("spire4", "#b3b7a3", -0.115, 0.485, -0.13, 0.345, 0.31, 0.33, 0, r);
  m.part("spire4", "#e2dfc7", -0.115, 0.589, -0.13, 0.125, 0.115, 0.12, 0, r);
  m.part("spire4", "#94a394", 0.19, 0.15, -0.055, 0.39, 0.3, 0.42, 0, -0.18);
  if (!simple) {
    m.part("hip", "#778984", -0.23, 0.065, 0.21, 0.28, 0.15, 0.21, 0, -0.22);
    m.part("hip", "#a8ad98", -0.28, 0.114, 0.19, 0.16, 0.10, 0.14, 0, -0.22);
    m.part("gem", "#a7ab95", 0.25, 0.032, 0.14, 0.12, 0.073, 0.1);
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
  m.part("crown", "#829069", -0.08,0.202,0.032, 0.171,0.128,0.151, 0.18,0.27,-0.09);
  m.part("crown", "#71856a", 0.047,0.235,-0.032, 0.209,0.164,0.183,-0.11,-0.34,0.14);
  m.part("gem", "#98a17b", 0.069,0.287,-0.037, 0.107,0.059,0.112,0,0.42,0.14);
  for (const [x,y,z,w] of [[-0.111,0.218,0.094,0.072], [0.014,0.253,0.063,0.065], [0.117,0.249,0.027,0.073]]) {
    m.part("crown", "#bf795a", x,y,z, w,w*0.91,w,0.09,0.36);
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
    m.part("gem", "#bc9249", top,h-0.023,z, 0.04,0.134,0.039,0,0.16,-lean);
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
    m.part("gem", "#b48c48", x,y,z, w,h,w*0.82, 0.15,0.37,tilt);
    m.part("gem", "#e4c77f", x+0.014,y+0.017,z+0.017,
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
    m.beam("#827159", [x-0.06,0.132,z+side*0.031], [x-0.077+side*0.014,0.014,z+side*0.039],0.021);
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
