import type { BuildingId, CivilizationId } from "../game/types";
import { Miniature } from "./miniature";

const stone = "#e0d4b7", pale = "#f0e5cd", shadow = "#8b8976";
const bronze = "#a58951", brass = "#d9ba72", ink = "#425455", wood = "#876548";
const slate = "#536c65", glass = "#67827b";

function plinth(m: Miniature, w: number, d: number) {
  m.part("bevel", shadow, 0, 0.025, 0, w, 0.05, d);
  m.part("bevel", stone, 0, 0.057, 0, w - 0.035, 0.032, d - 0.035);
}

// A setback, recessed ribbon windows and a contrasting cornice remain visible
// at play distance. Fine bronze mullions come into view as the board is enlarged.
function hall(m: Miniature, x: number, z: number, w: number, d: number, h: number, roof: string) {
  m.box(stone, x, 0.07 + h/2, z, w, h, d);
  m.box(glass, x, 0.07 + h * 0.72, z, w + 0.004, 0.063, d + 0.004);
  for (const s of [-1, 1]) {
    m.box(pale, x + w*s*0.34, 0.07 + h*0.66, z+d/2, 0.027, h*0.65, 0.015);
    m.box(pale, x + w/2, 0.07 + h*0.66, z+d*s*0.32, 0.015, h*0.65, 0.025);
  }
  m.box(bronze, x, 0.075 + h, z, w + 0.032, 0.027, d + 0.032);
  m.part("hip", roof, x, 0.102 + h, z, w + 0.054, 0.042, d + 0.054);
}

export function cityModel(color: string, style: CivilizationId, level: number, capital: boolean, walls: boolean) {
  const m = new Miniature();
  const neutral = level === 0;
  const h = neutral ? 0.19 : 0.235 + Math.min(level, 5) * 0.043;
  const roof = neutral ? "#857b65" : color;
  plinth(m, neutral ? 0.68 : 0.85, neutral ? 0.66 : 0.82);
  m.box(bronze, 0.045, 0.076, 0.026, 0.039, 0.009, neutral ? 0.56 : 0.7);
  m.box(bronze, 0.01, 0.076, 0.07, neutral ? 0.54 : 0.7, 0.01, 0.026);

  // Leave the front court open so a garrison remains visible.
  hall(m, -0.15, -0.16, 0.255, 0.22, h, roof);
  hall(m, 0.17, -0.15, 0.18, 0.175, h*0.62, roof);
  if (!neutral) hall(m, -0.21, 0.17, 0.154, 0.245, h*0.48, slate);
  if (level >= 3) hall(m, 0.205, 0.18, 0.155, 0.128, h*0.37, roof);
  if (level >= 5) hall(m, 0.16, -0.25, 0.09, 0.085, h*1.06, slate);

  const crownY = 0.135 + h;
  if (!neutral) {
    switch (style) {
      case "determia":
        m.part("bevel", ink, -0.178, crownY + 0.055, -0.16, 0.14, 0.115, 0.15);
        m.box(pale, -0.19, crownY + 0.12, -0.18, 0.125, 0.024, 0.115);
        m.box(brass, -0.115, crownY + 0.093, -0.135, 0.045, 0.185, 0.046);
        break;
      case "nosta":
        m.part("octagon", pale, -0.15, crownY + 0.04, -0.16, 0.16, 0.08, 0.16);
        m.part("spire", bronze, -0.15, crownY + 0.114, -0.16, 0.19, 0.10, 0.19);
        break;
      case "ida":
        m.box(stone, -0.175, crownY+0.026, -0.16, 0.165, 0.065, 0.15);
        m.part("hip", roof, -0.15, crownY+0.08, -0.168, 0.16, 0.075, 0.16, 0, 0.55);
        break;
      case "rina":
        m.part("octagon", slate, -0.15, crownY+0.065, -0.16, 0.1, 0.135, 0.1);
        m.part("disc", brass, -0.15, crownY+0.14, -0.16, 0.19, 0.037, 0.19);
        m.part("spire", roof, -0.15, crownY+0.184, -0.16, 0.145, 0.065, 0.145);
        break;
      default:
        m.box(pale, -0.15, crownY+0.043, -0.16, 0.14, 0.08, 0.135);
        m.part("hip", roof, -0.15, crownY+0.107, -0.16, 0.19, 0.056, 0.18);
    }
    if (capital) {
      m.part("octagon", brass, 0.308, 0.29, -0.27, 0.026, 0.44, 0.026);
      m.box(roof, 0.235, 0.45, -0.27, 0.145, 0.085, 0.018);
      m.box(brass, 0.241, 0.417, -0.269, 0.133, 0.018, 0.024);
      m.part("gem", pale, 0.308, 0.521, -0.27, 0.043, 0.062, 0.043);
    }
  }
  if (walls) {
    for (const sign of [-1, 1]) {
      m.box(shadow, sign*0.383, 0.13, 0, 0.043, 0.18, 0.76);
      m.box(bronze, sign*0.383, 0.225, 0, 0.055, 0.02, 0.76);
      m.box(shadow, sign*0.247, 0.13, 0.363, 0.227, 0.18, 0.04);
      m.part("bevel", pale, sign*0.36, 0.16, 0.36, 0.095, 0.25, 0.09);
    }
  }
  return m.finish();
}

function treeSculpture(m: Miniature, x: number, z: number) {
  m.part("octagon", wood, x, 0.22, z, 0.06, 0.28, 0.06);
  m.part("hip", slate, x, 0.35, z, 0.34, 0.19, 0.3, 0, 0.28);
  m.part("hip", "#a59660", x-0.045, 0.465, z-0.035, 0.21, 0.13, 0.19);
}

function colonnade(m: Miniature, roof: string, width: number) {
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    m.part("octagon", pale, x*width*0.38, 0.215, z*0.175, 0.078, 0.28, 0.078);
    m.part("octagon", bronze, x*width*0.38, 0.33, z*0.175, 0.09, 0.035, 0.09);
  }
  m.box(bronze, 0, 0.367, 0, width, 0.04, 0.455);
  m.part("hip", roof, 0, 0.43, 0, width+0.035, 0.1, 0.5);
}

export function buildingModel(type: BuildingId, roof: string) {
  const m = new Miniature();
  if (type !== "port" && type !== "bridge") plinth(m, 0.68, 0.62);
  switch (type) {
    case "farm":
      m.box("#876d43", -0.06, 0.08, 0, 0.47, 0.025, 0.48);
      for (let x=0; x<4; x++) for (let z=0; z<3; z++) {
        m.part("hip", ["#b89952", "#d3b26b"][(x+z)%2], -0.24+x*0.105, 0.115, -0.16+z*0.16, 0.068, 0.092, 0.139);
      }
      m.part("octagon", pale, 0.203, 0.191, -0.14, 0.118, 0.24, 0.118);
      m.part("spire", roof, 0.203, 0.338, -0.14, 0.137, 0.068, 0.137);
      break;
    case "lumberHut":
    case "sawmill":
      hall(m, -0.07, -0.087, 0.36, 0.245, type==="sawmill" ? 0.245 : 0.166, roof);
      for (let i=0; i<3; i++) {
        const x = 0.11+i*0.065;
        m.part("octagon", wood, x, 0.121, 0.09, 0.071, 0.26, 0.071, Math.PI/2);
        m.part("octagon", "#d7b689", x, 0.121, 0.222, 0.053, 0.016, 0.052, Math.PI/2);
      }
      if (type === "sawmill") {
        m.part("drum", ink, -0.118, 0.214, 0.135, 0.19, 0.036, 0.19, Math.PI/2);
        m.part("octagon", brass, -0.118, 0.214, 0.158, 0.065, 0.026, 0.065, Math.PI/2);
      } else treeSculpture(m, 0.22, -0.17);
      break;
    case "mine":
      m.part("hip", shadow, -0.045, 0.186, -0.03, 0.54, 0.275, 0.43, 0, -0.07);
      m.box(ink, 0, 0.179, 0.185, 0.164, 0.205, 0.027);
      for (const s of [-1, 1]) {
        m.box(wood, s*0.10, 0.18, 0.185, 0.05, 0.22, 0.065);
        m.box(bronze, s*0.057, 0.083, 0.215, 0.017, 0.02, 0.16);
      }
      m.box(bronze, 0, 0.304, 0.184, 0.273, 0.05, 0.079);
      m.part("gem", brass, 0.18, 0.162, 0.114, 0.1, 0.19, 0.12);
      break;
    case "windmill":
      m.part("octagon", pale, 0, 0.278, 0, 0.178, 0.414, 0.178);
      m.part("spire", roof, 0, 0.52, 0, 0.23, 0.093, 0.23);
      for (let i=0; i<4; i++) {
        const a = i*Math.PI/2+0.33;
        m.box(bronze, Math.sin(a)*0.15, 0.435+Math.cos(a)*0.15, 0.14, 0.033, 0.3, 0.034, 0, 0, -a);
        m.box(stone, Math.sin(a)*0.201+Math.cos(a)*0.027, 0.435+Math.cos(a)*0.201-Math.sin(a)*0.027, 0.142, 0.086, 0.16, 0.029, 0, 0, -a);
      }
      m.part("gem", brass, 0, 0.435, 0.16, 0.087, 0.087, 0.078);
      break;
    case "forge":
      hall(m, -0.055, 0.01, 0.38, 0.34, 0.215, slate);
      for (const [x,h] of [[0.17,0.46],[0.259,0.34]]) {
        m.part("octagon", ink, x, h/2+0.07, -0.15, 0.079, h, 0.079);
        m.part("octagon", bronze, x, h+0.055, -0.15, 0.093, 0.043, 0.093);
      }
      m.box("#bd6c41", -0.055, 0.156, 0.19, 0.12, 0.111, 0.03);
      break;
    case "market":
    case "grandBazaar":
      hall(m, 0, -0.12, 0.37, 0.185, 0.205, roof);
      for (const s of [-1,1]) m.box(bronze, s*0.208, 0.20, 0.154, 0.029, 0.25, 0.03);
      for (let i=0; i<5; i++) m.box(i%2 ? pale : roof, (i-2)*0.094, 0.314, 0.105, 0.094, 0.04, 0.23, 0.16);
      m.box(wood, 0, 0.13, 0.126, 0.39, 0.097, 0.122);
      if (type === "grandBazaar") {
        m.part("octagon", bronze, 0, 0.39, -0.14, 0.17, 0.13, 0.17);
        m.part("spire", brass, 0, 0.49, -0.14, 0.24, 0.15, 0.24);
      }
      break;
    case "bridge":
      m.box(ink, 0, 0.104, 0, 0.35, 0.117, 1);
      m.box(stone, 0, 0.17, 0, 0.37, 0.045, 1);
      for (const side of [-1,1]) {
        for (const end of [-1,1]) {
          m.box(shadow, side*0.167, 0.174, end*0.368, 0.062, 0.35, 0.1);
          m.box(brass, side*0.167, 0.356, end*0.368, 0.08, 0.033, 0.104);
          m.beam(bronze, [side*0.17,0.32,end*0.36],[side*0.17,0.226,0],0.022);
        }
        m.box(bronze, side*0.17,0.241,0,0.028,0.035,0.97);
      }
      break;
    case "port":
      m.box(wood,0,0.078,-0.04,0.75,0.084,0.25);
      m.box(wood,-0.242,0.08,0.106,0.176,0.088,0.38);
      for (let i=0; i<5; i++) m.box(bronze,-0.3+i*0.15,0.125,-0.04,0.016,0.013,0.242);
      hall(m,0.145,-0.16,0.22,0.17,0.19,roof);
      m.box(ink,-0.185,0.257,0,0.058,0.28,0.065);
      m.beam(brass,[-0.185,0.385,0],[-0.02,0.455,0.13],0.032);
      m.beam(bronze,[-0.02,0.455,0.13],[-0.02,0.282,0.13],0.015);
      break;
    case "temple":
    case "forestTemple":
    case "mountainTemple":
    case "waterTemple":
      colonnade(m, roof, 0.43);
      m.part("gem", brass, 0, 0.211, 0, 0.115, 0.19, 0.115);
      if (type === "forestTemple") treeSculpture(m, -0.222, -0.185);
      if (type === "mountainTemple") m.part("spire4", brass,0,0.54,0,0.148,0.20,0.14);
      if (type === "waterTemple") {
        for (const side of [-1,1]) m.part("octagon", glass, side*0.25,0.103,0.13,0.115,0.063,0.15);
      }
      break;
    case "altarOfPeace":
      m.part("octagon", pale,0,0.169,0,0.39,0.196,0.39);
      m.part("disc", bronze,0,0.28,0,0.42,0.047,0.42);
      m.part("gem", glass,0,0.378,0,0.15,0.195,0.15);
      break;
    case "emperorTomb":
      m.part("hip", shadow,0,0.166,0,0.54,0.19,0.47);
      m.part("hip", pale,0,0.275,0,0.29,0.11,0.25);
      m.box(bronze,0,0.344,0,0.15,0.044,0.145);
      break;
    case "eyeOfGod":
      m.part("octagon", pale,0,0.20,0,0.25,0.25,0.25);
      m.part("disc", bronze,0,0.415,0,0.43,0.064,0.43,1.16,0.14);
      m.part("gem", glass,0,0.42,0.052,0.19,0.17,0.15);
      break;
    case "gateOfPower":
      for (const side of [-1,1]) m.part("hip", pale, side*0.187,0.257,0,0.154,0.37,0.212);
      m.box(bronze,0,0.438,0,0.49,0.065,0.206);
      m.part("hip", roof,0,0.493,0,0.56,0.074,0.247);
      break;
    case "parkOfFortune":
      treeSculpture(m,-0.11,-0.075);
      m.part("disc", bronze,0.128,0.114,0.12,0.207,0.08,0.207);
      m.part("disc", glass,0.128,0.157,0.12,0.158,0.018,0.158);
      break;
    case "towerOfWisdom":
      for (let i=0; i<3; i++) {
        const w = 0.36-i*0.079;
        m.part("octagon", pale,0,0.14+i*0.135,0,w,0.135,w);
        m.part("octagon", roof,0,0.207+i*0.135,0,w+0.025,0.03,w+0.025);
      }
      m.part("spire", brass,0,0.545,0,0.145,0.13,0.145);
  }
  return m.finish();
}

export function ruinModel() {
  const m = new Miniature();
  plinth(m, 0.55, 0.43);
  for (const [x,z,h] of [[-0.17,-0.065,0.35],[0.15,-0.08,0.185],[0.15,0.1,0.11]]) {
    m.part("bevel", stone, x,0.07+h/2,z,0.117,h,0.124);
    m.box(bronze,x,0.07+h*0.63,z,0.124,0.033,0.13);
  }
  m.box(shadow,-0.109,0.42,-0.061,0.201,0.065,0.146,0,0,-0.082);
  m.part("gem", brass,0.012,0.142,0.05,0.124,0.16,0.114,0,0,-0.16);
  m.box("#aaa18a",0.03,0.113,0.138,0.117,0.079,0.17,0,0.39,-0.1);
  return m.finish();
}

export function lighthouseModel() {
  const m = new Miniature();
  m.part("octagon", shadow,0,0.063,0,0.48,0.126,0.48);
  m.part("octagon", pale,0,0.323,0,0.226,0.401,0.226);
  m.part("octagon", slate,0,0.327,0,0.235,0.077,0.235);
  m.part("octagon", bronze,0,0.528,0,0.302,0.055,0.302);
  m.part("octagon", "#d7b66f",0,0.624,0,0.17,0.139,0.17);
  for (const x of [-1,1]) for (const z of [-1,1]) m.box(ink,x*0.081,0.632,z*0.08,0.02,0.169,0.022);
  m.part("spire", slate,0,0.765,0,0.302,0.144,0.302);
  m.part("gem", brass,0,0.852,0,0.038,0.099,0.039);
  return m.finish();
}
