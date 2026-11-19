import type { Miniature } from "../../../scene/miniature";

// Weathered materials for working ground outside the city walls. Worn edges
// and the cut faces of stock carry the highlights at the board camera angle.
export const rural = {
  timber: "#705747", board: "#a78b69", endgrain: "#c7a87b",
  stone: "#99988a", plaster: "#beb6a1", slate: "#6d7880",
  iron: "#57616a", shade: "#474c4c", brick: "#986e5b",
  reed: "#af975f", canvas: "#c8be9e", sage: "#7f8b77",
  brass: "#a48a61", clay: "#a98a72",
};

export function crate(m: Miniature, x: number, y: number, z: number, w: number) {
  const h = w * .69;
  m.box(rural.board, x, y + h / 2, z, w, h, w * .83);
  m.box(rural.timber, x - w * .19, y + h + .002, z, w * .12, .004, w * .83);
}
