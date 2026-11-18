import { Miniature } from "../../../scene/miniature";
import { facade, cityStreetDatum as ground } from "./cityMasonry";

const limestone = "#e9d8b6";
const sandstone = "#c0a47b";
const brick = "#a66348";
const roofTile = "#af523d";
const copper = "#5c847d";
const shadow = "#445452";
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
  m.box("#747875", x, y+0.004, z, w, 0.008, d);
  for (const sign of [-1,1]) {
    m.box(coping, x, y+0.012, z+sign*(d-rim)/2, w, 0.024, rim);
    m.box(coping, x+sign*(w-rim)/2, y+0.012, z, rim, 0.024, d-2*rim);
  }
}

function mansardShop(m: Miniature, x: number, y: number, z: number) {
  const half = 0.133, slate = "#67747c";
  // The steep lower slope turns at a continuous shoulder under a shallow upper pitch.
  const profile: [number,number][] = [[0.076,0],[0.048,0.059],[0,0.074],[-0.048,0.059],[-0.076,0]];
  const points = (side: number): Point[] => profile.map(([depth,rise]) => [x+side*half,y+rise,z+depth]);
  const left = points(-1), right = points(1);
  for (let j=1; j<profile.length; j++) m.face(slate, [left[j-1],right[j-1],right[j],left[j]]);
  m.face(limestone, left);
  m.face(limestone, right.reverse());
  for (const dx of [-0.061,0.061]) {
    m.box(limestone, x+dx, y+0.035, z+0.055, 0.052, 0.055, 0.037);
    m.box(shadow, x+dx, y+0.037, z+0.075, 0.027, 0.031, 0.004);
    pitchedRoof(m, x+dx, y+0.061, z+0.055, 0.061, 0.049, 0.023, "#55656a", limestone);
  }
}

export function treatyShops(m: Miniature, color: string) {
  // A red-roofed corner inn, with an oriel and the bay window below its cap.
  const eaves = facade(m, -0.125, -0.118, 0.264, 0.200, 0.152, "#dfbb85", 3, 2);
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
  m.part("gem", "#be9859", x, 0.337, z, 0.014, 0.019, 0.014);
  // Two low, separate shopfronts leave a lane across the front of the inn.
  const side = facade(m, 0.204, -0.125, 0.187, 0.130, 0.106, "#c7976c", 2, 2);
  pitchedRoof(m, 0.204, side, -0.125, 0.147, 0.206, 0.059, "#98604b", limestone, true);
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
    m.face("#88958b", [[left,annex,front],[right,annex,front],[right,crest,back],[left,crest,back]]);
    m.face("#779697", [[right,annex,back],[left,annex,back],[left,crest,back],[right,crest,back]]);
    m.face(limestone, [[right,annex,front],[right,annex,back],[right,crest,back]]);
    m.face(limestone, [[left,annex,back],[left,annex,front],[left,crest,back]]);
  }
}

function crownRoof(m: Miniature, x: number, y: number, z: number, w: number, d: number, h: number) {
  // A broad skirt turns up slightly at the corners beneath the upper gable.
  const corners: [number, number][] = [[-1,-1],[-1,1],[1,1],[1,-1]];
  for (let i = 0; i < corners.length; i++) {
    const [a,b] = corners[i], [c,e] = corners[(i+1)%4];
    const left: Point = [x+a*w/2, y+0.012, z+b*d/2];
    const right: Point = [x+c*w/2, y+0.012, z+e*d/2];
    const mid: Point = [(left[0]+right[0])/2,y,(left[2]+right[2])/2];
    const innerL: Point = [x+a*w*0.30,y+h*0.46,z+b*d*0.30];
    const innerR: Point = [x+c*w*0.30,y+h*0.46,z+e*d*0.30];
    m.face("#817848", [[left[0],left[1]-0.009,left[2]], [right[0],right[1]-0.009,right[2]], right, left]);
    m.face("#9c9052", [left,mid,innerL]);
    m.face("#9c9052", [mid,innerR,innerL]);
    m.face("#9c9052", [mid,right,innerR]);
  }
  // Long ridge runs across the central facade; gable ends remain visible above
  // the hipped skirt from both three-quarter views.
  const e = y+h*0.46, peak = y+h, l = x-w*0.30, r = x+w*0.30;
  const back = z-d*0.30, front = z+d*0.30;
  m.face("#9e9252", [[l,e,front],[r,e,front],[r,peak,z],[l,peak,z]]);
  m.face("#96884d", [[r,e,back],[l,e,back],[l,peak,z],[r,peak,z]]);
  m.face(limestone, [[l,e,back],[l,e,front],[l,peak,z]]);
  m.face(limestone, [[r,e,front],[r,e,back],[r,peak,z]]);
  m.box("#b4a359", x, peak+0.002, z, w*0.67, 0.013, 0.014);
  for (const sign of [-1,1]) {
    // The ridge caps turn upward above the pale triangular gable ends.
    m.beam("#b4a359", [x+w*0.303*sign,peak+0.004,z],
      [x+w*0.354*sign,peak+0.017,z], 0.013);
  }
}

export function axialCapital(m: Miniature, color: string) {
  // Two detached offices flank the central building across narrow side streets.
  // Their different rooflines keep each building distinct at board scale.
  const archives = facade(m, -0.297, -0.024, 0.129, 0.181, 0.175, "#d4b382", 2, 3);
  pitchedRoof(m, -0.297, archives, -0.024, 0.152, 0.205, 0.063, "#936954", limestone);
  const registry = facade(m, 0.283, -0.151, 0.153, 0.173, 0.219, "#be9b72", 3, 3);
  parapet(m, 0.283, registry, -0.151, 0.158, 0.178, limestone);
  m.box("#b79a71", 0.247, registry+0.047, -0.187, 0.068, 0.083, 0.077);
  m.box("#61716c", 0.247, registry+0.093, -0.187, 0.080, 0.014, 0.088);
  m.box(limestone, 0.283, ground+0.104, -0.151, 0.161, 0.012, 0.182);
  facade(m, 0, -0.108, 0.304, 0.246, 0.291, limestone, 5, 4);
  const tower = facade(m, 0, -0.029, 0.210, 0.210, 0.372, "#cfb482", 3, 4);
  m.box("#87795b", 0, tower+0.008, -0.029, 0.229, 0.019, 0.227);
  crownRoof(m, 0, tower+0.023, -0.029, 0.306, 0.265, 0.105);
  // A deep entrance canopy, three tall recessed bays and a stepped axis down
  // into the otherwise open forecourt carry through the institutional scale.
  const faceZ = 0.081;
  for (const x of [-0.069,0,0.069]) {
    m.box(shadow, x, 0.148, faceZ, 0.040, 0.111, 0.014);
    m.box(limestone, x-0.027, 0.189, faceZ+0.009, 0.013, 0.196, 0.020);
  }
  m.box(limestone, 0.097, 0.189, faceZ+0.009, 0.013, 0.196, 0.020);
  m.box(color, 0, 0.155, 0.127, 0.186, 0.014, 0.084);
  for (const s of [-1,1]) m.box(sandstone, s*0.073, 0.105, 0.155, 0.018, 0.097, 0.019);
  for (let i=0; i<3; i++) {
    m.box(limestone, 0, ground+0.006+i*0.008, 0.218-i*0.035, 0.18, 0.012+i*0.016, 0.042);
  }
  const visitors = facade(m, -0.246, 0.208, 0.194, 0.134, 0.131, limestone, 3, 2);
  m.part("hip", "#7f866b", -0.246, visitors+0.029, 0.208, 0.221, 0.059, 0.158);
  m.box(color, -0.246, ground+0.084, 0.287, 0.105, 0.012, 0.040);
  const officers = facade(m, 0.257, 0.219, 0.156, 0.195, 0.145, "#d0b283", 2, 2);
  pitchedRoof(m, 0.257, officers, 0.219, 0.218, 0.179, 0.062, "#776a5b", limestone, true);
  m.box(brick, 0.301, officers+0.031, 0.166, 0.027, 0.061, 0.026);
}
