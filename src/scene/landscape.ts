import type { Resource, Tile } from "../game/types";
import { Miniature } from "./miniature";
import { fishShoal, seaStar } from "./tidalResources";

const leaves = {
  fir: ["#315345", "#48725a", "#679276"],
  broadleaf: ["#48654a", "#5f8058", "#849e65"],
};

// Short trunks and overlapping facets keep a dense stand below the taller pieces.
function tree(m: Miniature, x: number, z: number, scale: number, kind: keyof typeof leaves, simple: boolean) {
  const [shade, body, light] = leaves[kind];
  const y = (h: number) => h * scale;
  m.part(simple ? "box" : "octagon", "#735941", x, y(0.108), z, y(0.058), y(0.216), y(0.063));
  if (kind === "fir") {
    m.part(simple ? "spire4" : "whorl", shade, x, y(0.225), z, y(0.31), y(0.257), y(0.29), 0, 0.23);
    if (!simple) m.part("spire", body, x - y(0.015), y(0.306), z, y(0.26), y(0.24), y(0.245), 0, -0.13);
    m.part(simple ? "spire4" : "spire", light, x - y(0.012), y(0.38), z, y(0.19), y(0.29), y(0.19), 0, 0.28);
    return;
  }
  m.part(simple ? "gem" : "crown", shade, x, y(0.24), z, y(0.29), y(0.2), y(0.27), -0.04, 0.22, 0.05);
  m.part(simple ? "gem" : "crown", body, x - y(0.03), y(0.345), z - y(0.02), y(0.25), y(0.265), y(0.245), 0, -0.17, 0.15);
  if (!simple) {
    m.part("gem", light, x - y(0.051), y(0.431), z - y(0.045), y(0.14), y(0.11), y(0.14), 0, 0.31, 0.18);
    m.part("crown", light, x + y(0.081), y(0.256), z + y(0.063), y(0.155), y(0.151), y(0.15), 0, -0.37, -0.14);
  }
}

// The playable forest and its worksite use the same trees, in the same places.
// A construction exchange can keep the surviving trunks on screen throughout.
type LandscapePart = "developed" | "standing" | "removed" | "worked";
type Site = "forestEdge" | "forestShrine" | "quarry" | "ridge";
const trees: readonly [number, number, number, keyof typeof leaves][] = [
  [-.24, -.23, .96, "fir"], [.11, -.24, .69, "broadleaf"],
  [-.265, .08, .66, "fir"], [.02, .005, .77, "fir"],
  [.265, -.09, .55, "fir"], [-.085, .29, .47, "broadleaf"],
];

function cutStump(m: Miniature, x: number, z: number, d: number, h: number) {
  m.part("octagon", "#735941", x, h / 2, z, d, h, d * .93);
  m.part("octagon", "#cba977", x, h - .002, z, d * .84, .004, d * .79);
  for (const angle of [.3, 2.5, 4.4]) {
    m.part("hip", "#735941", x + Math.sin(angle) * d * .42, h * .16,
      z + Math.cos(angle) * d * .42, d * .27, h * .32, d * .63, 0, angle);
  }
}

function forestStand(m: Miniature, simple: boolean, part: LandscapePart | "native", shrine = false) {
  const native = part === "native";
  const standing = native || part === "standing" || part === "developed";
  const worked = part === "worked" || part === "developed";
  trees.forEach(([x, z, size, species], i) => {
    const cleared = i === 3 || (i === 5 && !shrine);
    if ((native || (cleared ? part === "removed" : standing)) && (!simple || i < 4)) {
      tree(m, x, z, size, species, simple);
    }
    if (worked && cleared && (!simple || i < 4)) {
      cutStump(m, x, z, i === 3 ? .09 : .066, i === 3 ? .054 : .037);
    }
  });
  if (simple) return;
  for (const [x, z, size] of [[-.31,.24,.083],[.05,.17,.105],[.32,-.27,.075]]) {
    const cleared = x === .05;
    if (!(native || (cleared ? part === "removed" : standing))) continue;
    m.part("gem", leaves.broadleaf[0], x, .041, z, size, .08, size * .75, 0, .28);
    m.part("gem", leaves.fir[2], x + size * .31, .032, z + size * .3, size * .62, .055, size * .63);
  }
}

export function grove(simple: boolean) {
  const m = new Miniature();
  forestStand(m, simple, "native");
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
  height: number, turn: number, highPeak: boolean, simple: boolean,
  drawFace = (color: string, face: Point[]) => m.face(color, face)) {
  const yawC = Math.cos(turn), yawS = Math.sin(turn);
  const contour = (radius: number, h: number, dx: number, dz: number, jag: number): Point[] =>
    rockOutline.map(([a, b], i) => {
      const u = width * (radius*a + dx), v = depth * (radius*b + dz);
      const tooth = [0.1, 0.5, -0.38, -0.16, -0.57, 0.25, 0.69, -0.32][i];
      return [x + yawC*u - yawS*v, height*(h + jag*tooth), z + yawS*u + yawC*v];
    });
  const bands = [
    { ring: contour(1, 0.002, 0, 0, 0), color: "#58677a" },
    { ring: contour(0.91, 0.18, 0.009, -0.02, 0.06), color: "#68778a" },
    { ring: contour(0.58, 0.45, -0.035, -0.1, 0.13), color: "#8a8996" },
    { ring: contour(0.34, 0.69, -0.105, -0.16, 0.18), color: highPeak ? "#c4c4c5" : "#aaa89e" },
    { ring: contour(0.16, 0.88, -0.17, -0.14, 0.09), color: highPeak ? "#e4ddd5" : "#bebbb4" },
    { ring: contour(0.07, 1, -0.2, -0.17, 0.025), color: "#deddd7" },
  ];
  const silhouette = simple ? [bands[0], bands[2], bands[3], bands[5]] : bands;
  for (let j = 1; j < silhouette.length; j++) {
    const lower = silhouette[j - 1], upper = silhouette[j];
    for (let i = 0; i < rockOutline.length; i++) {
      const k = (i+1) % rockOutline.length;
      drawFace(lower.color, [lower.ring[i], upper.ring[i], lower.ring[k]]);
      drawFace(lower.color, [upper.ring[i], upper.ring[k], lower.ring[k]]);
    }
  }
  drawFace(highPeak ? "#e9e6dc" : "#c9c8bf", silhouette[silhouette.length-1].ring.slice().reverse());
}

// Remove only the front of the original ridge at the adit. The clipping planes
// follow the two timber jambs and the back of the cut. The upper strata and
// snowcap are emitted with the same vertices, even in the distant terrain LOD.
const quarryCuts = [[0, -.226, 1], [0, -.034, -1], [2, .035, 1]] as const;
function splitRock(face: Point[], axis: 0 | 2, edge: number, sign: number) {
  const inside: Point[] = [], outside: Point[] = [];
  for (let i = 0; i < face.length; i++) {
    const a = face[i], b = face[(i + 1) % face.length];
    const da = sign * (a[axis] - edge), db = sign * (b[axis] - edge);
    if (da >= 0) inside.push(a);
    if (da <= 0) outside.push(a);
    if (da * db < 0) {
      const t = da / (da - db);
      const p: Point = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      p[axis] = edge;
      inside.push(p);
      outside.push(p);
    }
  }
  return { inside, outside };
}

function quarryFace(m: Miniature, color: string, face: Point[], part: LandscapePart) {
  const keep = part === "standing" || part === "developed";
  if (quarryCuts.some(([axis, edge, sign]) => face.every(p => sign * (p[axis] - edge) <= 0))) {
    if (keep) m.face(color, face);
    return;
  }
  let cut = face;
  for (const [axis, edge, sign] of quarryCuts) {
    const { inside, outside } = splitRock(cut, axis, edge, sign);
    if (keep && outside.length >= 3) m.face(color, outside);
    cut = inside;
    if (cut.length < 3) return;
  }
  if (part === "removed") m.face(color, cut);
  if (part !== "worked" && part !== "developed") return;
  const back = (p: Point): Point => [p[0], p[1], .035];
  m.face(color, cut.map(back));
  for (let i = 0; i < cut.length; i++) {
    const a = cut[i], b = cut[(i + 1) % cut.length];
    if (a[0] !== b[0] || (a[0] !== -.226 && a[0] !== -.034)) continue;
    m.face("#666d78", [b, a, back(a), back(b)]);
  }
}

function mountainSpurs(m: Miniature, simple: boolean, part: LandscapePart | "native", quarry: boolean) {
  const standing = part === "native" || part === "standing" || part === "developed";
  const removed = part === "native" || part === "removed";
  if (quarry && part !== "native") {
    crag(m, -.115, -.14, .32, .28, .57, 0, true, simple, (color, face) => quarryFace(m, color, face, part));
  } else if (standing) {
    crag(m, -.115, -.14, .32, .28, .57, 0, true, simple);
  }
  if (standing) crag(m, .19, -.098, .205, .22, .34, .43, false, simple);
  if (simple) return;
  if (quarry ? removed : standing) crag(m, -.274, .139, .14, .116, .188, -.28, false, true);
  if (removed) crag(m, -.045, .203, .093, .085, .118, .21, false, true);
  for (const [x, z, size] of [[-.293,.286,.072],[-.12,.34,.092],[.265,.134,.095]]) {
    const onTrack = quarry && x === -.12;
    if (onTrack ? removed : standing) {
      m.part("crystal", "#9b9ca0", x, size * .35, z, size, size * .7, size * .83, -.18, .37, -.21);
    }
  }
}

export function mountain(simple: boolean) {
  const m = new Miniature();
  mountainSpurs(m, simple, "native", false);
  return m.finish();
}

export function siteLandscape(tile: Tile): Site | null {
  if (!tile.building || tile.cityId || tile.lighthouse) return null;
  if (tile.terrain === "forest") return tile.building === "forestTemple" ? "forestShrine" : "forestEdge";
  if (tile.terrain === "mountain") return tile.building === "mine" ? "quarry" : "ridge";
  return null;
}

export function developedLandscape(kind: Site, simple: boolean, part: LandscapePart = "developed") {
  const m = new Miniature();
  if (kind === "forestEdge" || kind === "forestShrine") forestStand(m, simple, part, kind === "forestShrine");
  else mountainSpurs(m, simple, part, kind === "quarry");
  return m.finish();
}

function fruitBush(m: Miniature, x: number, z: number, scale: number) {
  m.beam("#805c42", [x, 0.008, z], [x - 0.017 * scale, 0.144 * scale, z], 0.026 * scale);
  m.part("crown", "#467b55", x, 0.125 * scale, z, 0.164 * scale, 0.132 * scale, 0.15 * scale, 0, 0.31);
  m.part("crown", "#7da66a", x - 0.028 * scale, 0.175 * scale, z - 0.018 * scale,
    0.104 * scale, 0.089 * scale, 0.101 * scale, 0, -0.31);
  for (const [i, [dx, y, dz, width]] of [[-0.05, 0.141, 0.058, 0.043], [0.028, 0.197, 0.034, 0.035],
    [0.058, 0.136, 0.046, 0.039]].entries()) {
    m.part("gem", i === 1 ? "#f2a258" : "#c85441", x + dx * scale, y * scale, z + dz * scale,
      width * scale, width * 0.91 * scale, width * scale, 0.13, i * 0.4, -0.16);
  }
}

// Three pairs of low bushes leave the square's centre open for its piece.
function orchard(m: Miniature) {
  for (const [x, z, scale] of [[-0.15, -0.172, 0.68], [0.174, -0.12, 0.69], [-0.10, 0.205, 0.72]]) {
    fruitBush(m, x - 0.016, z - 0.025, scale);
    fruitBush(m, x + 0.020, z + 0.043, scale * 0.71);
  }
}

function wheatPatch(m: Miniature, centerX: number, centerZ: number, scale: number) {
  for (const [dx, dz, height, lean] of [[-0.042, -0.017, 0.175, -0.021],
    [0.009, -0.037, 0.235, 0.012], [0.036, 0.033, 0.202, 0.022]]) {
    const x = centerX + dx, z = centerZ + dz, h = height * scale;
    const top = x + lean;
    m.beam("#a47936", [x, 0.008, z], [top, h, z], 0.013, 0.011);
    m.part("gem", "#b9a154", x + lean * 0.37 + 0.017, h * 0.46, z, 0.025, 0.095, 0.021, 0.12, 0.22, -0.57);
    for (let row = 0; row < 2; row++) {
      const spread = 0.021 - row * 0.004, rise = h - 0.04 + row * 0.03;
      for (const side of [-1, 1]) {
        m.part("gem", side === 1 ? "#efbf56" : "#ce9643",
          top + side * spread * 0.77, rise, z - side * spread * 0.64, 0.039, 0.069, 0.044, 0, 0.69, -side * 0.63);
      }
    }
    m.part("gem", "#f6d27c", top + lean * 0.1, h + 0.024, z, 0.026, 0.059, 0.027, 0, 0.2, -lean);
  }
}

export function standingWheat(m: Miniature) {
  for (const [x, z, scale] of [[-0.146, -0.15, 0.81], [0.132, -0.14, 0.91],
    [-0.135, 0.123, 0.76], [0.119, 0.13, 0.86]]) wheatPatch(m, x, z, scale);
}

function orePocket(m: Miniature, x: number, z: number, scale: number, angle: number) {
  m.part("crown", "#536476", x, 0.041 * scale, z, 0.199 * scale, 0.082 * scale, 0.153 * scale, -0.09, angle);
  for (const [dx, dz, width, height, tilt] of [[-0.046, 0.021, 0.063, 0.088, 0.46],
    [0.008, 0.029, 0.078, 0.108, -0.29], [0.051, -0.013, 0.052, 0.07, 0.32]]) {
    const ox = x + dx * scale, oz = z + dz * scale, w = width * scale, h = height * scale;
    const y = h * 0.70;
    m.part("gem", "#b77947", ox, y, oz, w, h, w * 0.82, 0.15, angle, tilt);
    m.part("gem", "#f1c485", ox + 0.008, y + 0.012, oz + 0.01,
      w * 0.64, h * 0.69, w * 0.69, 0.14, angle + 0.03, tilt);
  }
}

// A mine works the centre pocket into its wagon. Both remaining seams retain
// their natural coordinates and paint, including during construction playback.
const orePockets = [
  [-.147, .289, .78, .18], [.077, .368, 1, -.09], [.343, .176, .77, .34],
] as const;
export function oreVein(m: Miniature, omitted?: number) {
  orePockets.forEach(([x, z, scale, angle], i) => {
    if (i !== omitted) orePocket(m, x, z, scale, angle);
  });
}

export function mineSeams(section: "remaining" | "extracted") {
  const m = new Miniature();
  if (section === "remaining") oreVein(m, 1);
  else orePocket(m, ...orePockets[1]);
  return m.finish();
}

function carveDeer(m: Miniature, x: number, z: number, size: number, heading: number, adult: boolean) {
  const cos = Math.cos(heading), sin = Math.sin(heading);
  function place([a, y, b]: Point): Point {
    return [x + size * (a * cos + b * sin), y * size, z + size * (-a * sin + b * cos)];
  }
  function part(shape: "crown" | "gem", color: string, at: Point,
    width: number, height: number, depth: number, lean = 0) {
    m.part(shape, color, ...place(at), width * size, height * size, depth * size, 0, heading, lean);
  }
  function beam(color: string, from: Point, to: Point, width: number) {
    m.beam(color, place(from), place(to), width * size);
  }
  part("crown", adult ? "#a56946" : "#ba8c60", [-0.018, 0.155, 0], 0.193, 0.105, 0.097);
  part("crown", "#be8452", [0.045, 0.163, 0], 0.123, 0.109, 0.091, -0.12);
  part("gem", "#f0d2a6", [-0.099, 0.177, 0], 0.075, 0.067, 0.061, -0.48);
  beam("#ba8758", [0.067, 0.151, 0], [0.118, 0.249, 0.004], 0.054);
  part("gem", "#e1ba87", [0.109, 0.215, 0.013], 0.046, 0.075, 0.055, -0.39);
  part("crown", "#d3a478", [0.133, 0.255, 0.009], 0.10, 0.066, 0.058, -0.4);
  part("gem", "#644c43", [0.176, 0.242, 0.015], 0.04, 0.027, 0.037, -0.32);
  for (const side of [-1, 1]) {
    const hock: Point = [-0.080, 0.076, side * 0.034];
    beam("#9b7051", [-0.053, 0.14, side * 0.028], hock, 0.029);
    beam("#745641", hock, [-0.066 + side * 0.013, 0.012, side * 0.039], 0.019);
    beam("#745641", [0.051, 0.142, side * 0.033], [0.06 - side * 0.016, 0.012, side * 0.037], 0.02);
    part("gem", "#c49169", [0.101, 0.282, side * 0.032], 0.041, 0.065, 0.029, 0.6);
    if (adult) {
      beam("#ae8c64", [0.11, 0.277, side * 0.019], [0.081, 0.323, side * 0.045], 0.016);
      beam("#c2a481", [0.081, 0.323, side * 0.045], [0.049, 0.347, side * 0.062], 0.013);
      beam("#c2a481", [0.081, 0.323, side * 0.045], [0.092, 0.353, side * 0.054], 0.013);
    } else {
      part("gem", "#f0d2a6", [-0.028, 0.201, side * 0.035], 0.034, 0.023, 0.024);
    }
  }
}

function deer(m: Miniature) {
  // Two small pairs occupy gaps on the front lip, clear of the tree crowns.
  carveDeer(m, -0.18, 0.336, 0.63, -0.10, true);
  carveDeer(m, -0.066, 0.407, 0.48, 0.22, false);
  carveDeer(m, 0.258, 0.138, 0.58, -0.84, true);
  carveDeer(m, 0.336, 0.210, 0.49, -0.63, false);
}

export function resourceModel(kind: Resource) {
  if (kind === "fish") return fishShoal();
  if (kind === "starfish") return seaStar();
  const m = new Miniature();
  switch (kind) {
    case "fruit": orchard(m); break;
    case "crop": standingWheat(m); break;
    case "ore": oreVein(m); break;
    case "animal": deer(m); break;
  }
  return m.finish();
}
