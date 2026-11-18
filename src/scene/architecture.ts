import { Miniature } from "./miniature";
import { brass, cobalt, ink, ivory, masonry, terracotta } from "./architecturalPalette";

const stone = "#e4d2c3", shadow = "#7b7888";
const bronze = "#ae7b4f";

function plinth(m: Miniature, w: number, d: number) {
  m.part("bevel", shadow, 0, 0.025, 0, w, 0.05, d);
  m.part("bevel", stone, 0, 0.057, 0, w - 0.035, 0.032, d - 0.035);
}

export function ruinModel() {
  const m = new Miniature();
  plinth(m, 0.55, 0.43);
  for (const [x,z,h] of [[-0.17,-0.065,0.35],[0.15,-0.08,0.185],[0.15,0.1,0.11]]) {
    m.part("bevel", stone, x,0.07+h/2,z,0.117,h,0.124);
    m.box(bronze,x,0.07+h*0.63,z,0.124,0.033,0.13);
  }
  m.box(shadow,-0.109,0.42,-0.061,0.201,0.065,0.146,0,0,-0.082);
  m.part("gem", "#98699c",0.012,0.161,0.05,0.141,0.196,0.132,0,0,-0.16);
  m.box(masonry,0.03,0.113,0.138,0.117,0.079,0.17,0,0.39,-0.1);
  return m.finish().scale(1.20, 1.19, 1.20);
}

export function lighthouseModel() {
  const m = new Miniature();
  m.part("octagon", shadow,0,0.063,0,0.48,0.126,0.48);
  m.part("octagon", ivory,0,0.323,0,0.226,0.401,0.226);
  m.part("octagon", terracotta,0,0.327,0,0.235,0.089,0.235);
  m.part("octagon", bronze,0,0.528,0,0.302,0.055,0.302);
  m.part("octagon", "#efc665",0,0.624,0,0.17,0.139,0.17);
  for (const x of [-1,1]) for (const z of [-1,1]) m.box(ink,x*0.081,0.632,z*0.08,0.02,0.169,0.022);
  m.part("spire", cobalt,0,0.765,0,0.302,0.144,0.302);
  m.part("gem", brass,0,0.852,0,0.038,0.099,0.039);
  return m.finish().scale(1.21, 1.14, 1.21);
}
