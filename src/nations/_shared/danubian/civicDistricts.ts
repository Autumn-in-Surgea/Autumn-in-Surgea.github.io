import { Miniature } from "../../../scene/miniature";
import { facade, masonryCourse, cityStreetDatum as ground } from "./cityMasonry";
import { brass, brick, cobalt, copper, ink as shadow, ivory as limestone, terracotta as roofTile } from "../../../scene/architecturalPalette";

const sandstone = "#bd8c66";
type Point = [number, number, number];

// A pitched roof with a true ridge, rather than a truncated pyramid. The gable
// is returned toward the camera on the narrow-fronted shops.
function pitchedRoof(m: Miniature, x: number, y: number, z: number, w: number,
  d: number, rise: number, tile: string, gable: string, eastWest = false) {
  const point = (u: number, v: number, height: number): Point =>
    eastWest ? [x+v, y+height, z-u] : [x+u, y+height, z+v];
  const w2 = w/2, d2 = d/2;
  const lb = point(-w2, -d2, 0), lf = point(-w2, d2, 0);
  const rb = point(w2, -d2, 0), rf = point(w2, d2, 0);
  const ridgeFront = point(0, d2, rise), ridgeBack = point(0, -d2, rise);
  m.face(tile, [lb, lf, ridgeFront, ridgeBack]);
  m.face(tile, [ridgeBack, ridgeFront, rf, rb]);
  m.face(gable, [lf, rf, ridgeFront]);
  m.face(gable, [rb, lb, ridgeBack]);
  m.box(tile, x, y+rise, z, 0.012, 0.009, d+0.005, 0, eastWest ? Math.PI/2 : 0);
}

function parapet(m: Miniature, x: number, y: number, z: number, w: number, d: number, coping: string) {
  const rim = 0.011;
  m.box("#596278", x, y+0.004, z, w, 0.008, d);
  for (const sign of [-1,1]) {
    m.box(coping, x, y+0.012, z+sign*(d-rim)/2, w, 0.024, rim);
    m.box(coping, x+sign*(w-rim)/2, y+0.012, z, rim, 0.024, d-2*rim);
  }
}

function mansardShop(m: Miniature, x: number, y: number, z: number) {
  const half = 0.133;
  // The steep lower slope turns at a continuous shoulder under a shallow upper pitch.
  const profile: [number,number][] = [[0.076,0],[0.048,0.059],[0,0.074],[-0.048,0.059],[-0.076,0]];
  const points = (side: number): Point[] => profile.map(([depth,rise]) => [x+side*half,y+rise,z+depth]);
  const left = points(-1), right = points(1);
  for (let j=1; j<profile.length; j++) m.face(cobalt, [left[j-1],right[j-1],right[j],left[j]]);
  m.face(limestone, left);
  m.face(limestone, right.reverse());
  for (const dx of [-0.061,0.061]) {
    m.box(limestone, x+dx, y+0.035, z+0.055, 0.052, 0.055, 0.037);
    m.box(shadow, x+dx, y+0.037, z+0.075, 0.027, 0.031, 0.004);
    pitchedRoof(m, x+dx, y+0.061, z+0.055, 0.061, 0.049, 0.023, cobalt, limestone);
  }
}

export function treatyShops(m: Miniature, color: string) {
  // A red-roofed corner inn, with an oriel and the bay window below its cap.
  const eaves = facade(m, -0.125, -0.118, 0.264, 0.200, 0.152, "#ecc38c", 3, 2);
  pitchedRoof(m, -0.125, eaves, -0.118, 0.294, 0.226, 0.087, roofTile, limestone);
  // A timber collar and diagonal struts outline the inn's front gable.
  m.box("#866344", -0.125, eaves+0.006, -0.003, 0.267, 0.012, 0.009);
  for (const sign of [-1,1])
    m.beam("#866344", [-0.125+sign*0.084,eaves+0.012,-0.003], [-0.125+sign*0.030,eaves+0.064,-0.003], 0.009);
  m.box(brick, -0.223, eaves+0.051, -0.169, 0.029, 0.093, 0.033);
  m.box(sandstone, -0.223, eaves+0.100, -0.169, 0.036, 0.013, 0.039);
  const x = -0.004, z = -0.038;
  m.part("octagon", sandstone, x, 0.085, z, 0.116, 0.069, 0.116);
  m.part("octagon", limestone, x, 0.173, z, 0.112, 0.125, 0.112);
  for (const angle of [0, Math.PI/4, Math.PI/2]) {
    m.box(shadow, x+Math.sin(angle)*0.053, 0.185, z+Math.cos(angle)*0.053, 0.028, 0.048, 0.008, 0, angle);
  }
  m.part("octagon", sandstone, x, 0.240, z, 0.13, 0.018, 0.13);
  m.part("spire", roofTile, x, 0.285, z, 0.145, 0.092, 0.145);
  m.part("gem", brass, x, 0.337, z, 0.014, 0.019, 0.014);
  // Two low, separate shopfronts leave a lane across the front of the inn.
  const side = facade(m, 0.204, -0.125, 0.187, 0.130, 0.106, "#e1a882", 2, 2);
  pitchedRoof(m, 0.204, side, -0.125, 0.147, 0.206, 0.059, "#9f533e", limestone, true);
  const shop = facade(m, -0.110, 0.179, 0.244, 0.125, 0.101, limestone, 3, 1);
  mansardShop(m, -0.110, shop, 0.179);
  m.box(color, -0.110, 0.124, 0.257, 0.244, 0.014, 0.058, 0.15);
  m.box(brick, -0.110, 0.119, 0.287, 0.243, 0.012, 0.007);
  m.box(sandstone, -0.110, 0.060, 0.265, 0.253, 0.018, 0.057);
}

function loggia(m: Miniature, x: number, z: number, width: number, bays: number) {
  const span = width / bays, radius = span * 0.39;
  const spring = ground + 0.075, archTop = spring + radius;
  const thickness = 0.021, back = z - thickness;
  // The piers, spandrels and curved soffits have actual openings and depth.
  for (let i = 0; i < bays; i++) {
    const center = x - width/2 + (i+0.5)*span;
    const edge = (a: number, depth: number): Point =>
      [center + Math.cos(a)*radius, spring + Math.sin(a)*radius, depth];
    m.box(limestone, center-span/2, ground+0.043, z-0.010, span*0.20, 0.087, 0.028);
    m.box(sandstone, center-span/2, spring, z-0.010, span*0.29, 0.012, 0.035);
    for (let j = 0; j < 6; j++) {
      const a = Math.PI - j*Math.PI/6, b = a-Math.PI/6;
      const l = edge(a,z), r = edge(b,z);
      m.face(limestone, [l,r,[r[0],archTop+0.012,z],[l[0],archTop+0.012,z]]);
      m.face(sandstone, [r,l,edge(a,back),edge(b,back)]);
    }
  }
  m.box(limestone, x+width/2, ground+0.043, z-0.010, span*0.20, 0.087, 0.028);
  m.box(sandstone, x+width/2, spring, z-0.010, span*0.29, 0.012, 0.035);
  m.box(limestone, x, archTop+0.018, z-0.009, width+0.025, 0.019, 0.042);
}

export function merchantQuarter(m: Miniature, color: string) {
  // A customs hall, raised loggia and river merchants' offices enclose a small square.
  const eaves = facade(m, -0.105, -0.122, 0.392, 0.205, 0.225, limestone, 5, 3);
  parapet(m, -0.105, eaves, -0.122, 0.395, 0.210, limestone);
  loggia(m, -0.104, 0.035, 0.361, 3);
  // A projecting pediment finishes the centre bay, leaving the arcades at both sides open.
  const l = -0.183, r = -0.026, mid = (l+r)/2, sill = 0.2034;
  m.face(limestone, [[l,sill,0.042],[r,sill,0.042],[mid,sill+0.040,0.042]]);
  m.face(sandstone, [[l,sill,0.042],[mid,sill+0.040,0.042],[mid,sill+0.040,0.002],[l,sill,0.002]]);
  m.face(sandstone, [[mid,sill+0.040,0.042],[r,sill,0.042],[r,sill,0.002],[mid,sill+0.040,0.002]]);
  m.box(limestone, mid, sill, 0.026, 0.167, 0.009, 0.041);
  m.box(sandstone, -0.104, 0.059, 0.036, 0.412, 0.017, 0.073);
  // An eight-panel copper dome fills the width of the hall below its lantern.
  const x = -0.171, z = -0.125;
  m.part("octagon", sandstone, x, eaves+0.025, z, 0.195, 0.052, 0.195);
  m.part("octagon", color, x, eaves+0.052, z, 0.214, 0.014, 0.214);
  const dome: [number,number][] = [[0.103,0.056],[0.101,0.074],[0.091,0.10],[0.068,0.124],[0.030,0.142]];
  for (let panel=0; panel<8; panel++) {
    const a=panel*Math.PI/4, b=a+Math.PI/4;
    const point=(r: number, h: number, angle: number): Point => [x+r*Math.cos(angle), eaves+h, z+r*Math.sin(angle)];
    for (let j=1; j<dome.length; j++) {
      const [lr,lh]=dome[j-1], [hr,hh]=dome[j];
      m.face(copper, [point(lr,lh,b),point(lr,lh,a),point(hr,hh,a),point(hr,hh,b)]);
    }
  }
  m.part("octagon", limestone, x, eaves+0.151, z, 0.056, 0.026, 0.056);
  m.part("spire", copper, x, eaves+0.174, z, 0.069, 0.035, 0.069);
  const office = facade(m, 0.216, -0.064, 0.158, 0.303, 0.188, brick, 2, 3);
  parapet(m, 0.216, office, -0.064, 0.163, 0.309, "#b98266");
  // A stepped street-end parapet screens the brick exchange's flat roof.
  for (let i=0; i<3; i++)
    m.box(brick, 0.216, office+0.026+0.016*i, 0.083, 0.139-i*0.034, 0.017, 0.019);
  m.box(limestone, 0.216, office+0.068, 0.083, 0.081, 0.009, 0.024);
  m.box(limestone, 0.216, 0.137, -0.064, 0.167, 0.011, 0.309);
  const terrace = facade(m, -0.163, 0.187, 0.247, 0.136, 0.129, "#d39d78", 3, 2);
  pitchedRoof(m, -0.163, terrace, 0.187, 0.157, 0.266, 0.065, roofTile, limestone, true);
  const annex = facade(m, 0.147, 0.198, 0.186, 0.109, 0.103, limestone, 3, 1);
  // The printing office admits daylight through a pair of sawtooth clerestories.
  const left = 0.049, right = 0.245;
  for (const front of [0.198,0.259]) {
    const back = front-0.061, crest = annex+0.045;
    m.face(cobalt, [[left,annex,front],[right,annex,front],[right,crest,back],[left,crest,back]]);
    m.face(copper, [[right,annex,back],[left,annex,back],[left,crest,back],[right,crest,back]]);
    m.face(limestone, [[right,annex,front],[right,annex,back],[right,crest,back]]);
    m.face(limestone, [[left,annex,back],[left,annex,front],[left,crest,back]]);
  }
}

type Plan = [number, number][];
const violetTile = "#514773";
const blueGlaze = "#72699a";
const buffBrick = "#c58866";
const smokeBrick = "#a66f59";

// Four raking hips curve in two pitches. An overhanging corner sits a little
// above the centre of each eave. The small flat top takes the lantern above it.
function glazedEaves(m: Miniature, x: number, z: number, base: number,
  width: number, depth: number, rise: number, crown: number) {
  const perimeter = [[-1,-1], [0,-1], [1,-1], [1,0], [1,1], [0,1], [-1,1], [-1,0]];
  const point = (index: number, scale: number, elevation: number, kick: number): Point => {
    const [u,v] = perimeter[index % 8];
    return [x + u * width * scale / 2, base + elevation + Math.abs(u*v) * kick, z + v * depth * scale / 2];
  };
  for (let i = 0; i < 8; i++) {
    const edge = point(i, 1, 0, 0.009), next = point(i+1, 1, 0, 0.009);
    const shoulder = point(i, 0.70, rise*0.24, 0.002), shoulderNext = point(i+1, 0.70, rise*0.24, 0.002);
    const high = point(i, crown, rise, 0), highNext = point(i+1, crown, rise, 0);
    m.face("#473c50", [point(i, 1, -0.009, 0.009), edge, next, point(i+1, 1, -0.009, 0.009)]);
    m.face(violetTile, [edge, shoulder, shoulderNext, next]);
    m.face(blueGlaze, [shoulder, high, highNext, shoulderNext]);
    if (i % 2 === 0) {
      m.beam("#9185a1", edge, shoulder, 0.009);
      m.beam("#9185a1", shoulder, high, 0.009);
    }
  }
  m.box(violetTile, x, base+rise, z, width*crown, 0.005, depth*crown);
}

// Chamfered brick shoulders and narrow stone cornices turn with the frontage.
// The tower and its unequal wings adjoin along party walls, across an open court
// from the separate street buildings. All heights start on the bare tile.
export function judicialQuarter(m: Miniature, color: string) {
  const x = -0.062, z = -0.141;
  const court: Plan = [[-0.202,-0.261], [0.084,-0.261], [0.084,-0.080], [0.071,-0.049],
    [0.039,-0.022], [-0.001,-0.010], [-0.127,-0.010], [-0.169,-0.024], [-0.202,-0.069]];
  const offices = (plan: Plan, cx: number, cz: number, height: number, wall: string, floors: number) => {
    const top = ground + height;
    masonryCourse(m, plan, cx, cz, ground, top, 1, wall, floors);
    masonryCourse(m, plan, cx, cz, ground+height*0.30, ground+height*0.30+0.009, 1.014, limestone);
    masonryCourse(m, plan, cx, cz, top, top+0.010, 1.022, limestone);
    masonryCourse(m, plan, cx, cz, top+0.010, top+0.018, 0.97, "#636777");
  };
  offices(court, x, z, 0.265, buffBrick, 4);
  const west: Plan = [[-0.364,-0.214], [-0.202,-0.250], [-0.202,-0.106],
    [-0.279,-0.086], [-0.339,-0.072], [-0.364,-0.087]];
  const east: Plan = [[0.084,-0.250], [0.215,-0.275], [0.304,-0.276], [0.331,-0.252],
    [0.331,-0.167], [0.306,-0.135], [0.237,-0.127], [0.084,-0.096]];
  offices(west, -0.281, -0.156, 0.173, smokeBrick, 2);
  offices(east, 0.206, -0.187, 0.214, buffBrick, 3);

  // Projecting portal, recessed glazing and the staircase face the forecourt.
  m.box(shadow, x, ground+0.082, -0.004, 0.112, 0.152, 0.009);
  for (const dx of [-0.066, -0.022, 0.022, 0.066])
    m.box(limestone, x+dx, ground+0.0825, 0.006, 0.014, 0.165, 0.028);
  m.box(color, x, ground+0.173, 0.025, 0.163, 0.015, 0.077);
  for (let step=0; step<3; step++) {
    const h = (step+1)*0.009;
    m.box(limestone, x, ground+h/2, 0.085-step*0.024, 0.158, h, 0.025);
  }

  // A four-square lantern with paired windows separates the two glazed tiers.
  // The upper storey narrows on all four sides to expose the first roof skirt.
  const tower: Plan = [[x-0.104,z-0.078], [x-0.082,z-0.100], [x+0.081,z-0.100], [x+0.103,z-0.078],
    [x+0.103,z+0.078], [x+0.081,z+0.100], [x-0.082,z+0.100], [x-0.104,z+0.078]];
  masonryCourse(m, tower, x, z, ground+0.283, 0.430, 1, "#d9b38d", 2);
  masonryCourse(m, tower, x, z, 0.430, 0.446, 1.06, limestone);
  glazedEaves(m, x, z, 0.450, 0.300, 0.264, 0.041, 0.52);
  m.box(shadow, x, 0.506, z, 0.145, 0.031, 0.123);
  for (const s of [-1,1]) {
    m.box(buffBrick, x+s*0.062, 0.507, z, 0.014, 0.035, 0.129);
    m.box(buffBrick, x, 0.507, z+s*0.059, 0.012, 0.035, 0.012);
  }
  glazedEaves(m, x, z, 0.525, 0.217, 0.196, 0.065, 0.10);
  m.part("octagon", "#bd945d", x, 0.599, z, 0.023, 0.016, 0.023);

  const archives = facade(m, -0.289, 0.099, 0.164, 0.155, 0.192, "#b48472", 3, 3);
  parapet(m, -0.289, archives, 0.099, 0.165, 0.156, "#bfa084");
  m.box("#809caa", -0.289, archives+0.032, 0.099, 0.092, 0.048, 0.095);
  m.part("hip", cobalt, -0.289, archives+0.067, 0.099, 0.107, 0.026, 0.113);

  // The detached east registry rounds off into the lane by the court.
  const registry: Plan = [[0.192,-0.059], [0.347,-0.059], [0.357,-0.048], [0.357,0.090],
    [0.347,0.112], [0.326,0.129], [0.290,0.136], [0.192,0.136]];
  offices(registry, 0.272, 0.038, 0.192, "#cea77c", 3);
  m.box(copper, 0.260, ground+0.226, 0.012, 0.088, 0.033, 0.066);

  const school = facade(m, -0.205, 0.276, 0.275, 0.129, 0.151, "#c68d76", 4, 2);
  pitchedRoof(m, -0.205, school, 0.276, 0.151, 0.297, 0.054, roofTile, limestone, true);
  m.box(brick, -0.286, school+0.050, 0.246, 0.023, 0.058, 0.024);
  const lodge = facade(m, 0.191, 0.273, 0.217, 0.123, 0.108, limestone, 3, 2);
  m.part("hip", violetTile, 0.191, lodge+0.027, 0.273, 0.239, 0.055, 0.147);
  for (const dx of [-0.082,0.082]) m.box(smokeBrick, 0.191+dx, ground+0.045, 0.365, 0.013, 0.09, 0.016);
  m.box(color, 0.191, ground+0.096, 0.352, 0.192, 0.014, 0.053, 0.09);
}
