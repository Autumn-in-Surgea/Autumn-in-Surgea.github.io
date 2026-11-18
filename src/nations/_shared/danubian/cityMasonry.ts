import { Miniature } from "../../../scene/miniature";

// The shared architectural drawing datum is translated to the tile surface when baked.
export const cityStreetDatum = 0.051;
const cornice = "#e3d8bc";
const windowColor = "#607278";

// The two outward-facing walls use flush window inlays. Each opening is one
// quad, and every architectural detail is baked into the same coloured mesh.
export function facade(m: Miniature, x: number, z: number, w: number, d: number, h: number,
  plaster: string, bays: number, floors: number) {
  m.box(plaster, x, cityStreetDatum + h / 2, z, w, h, d);
  const insetWall = (across: number, spacing: number, right: boolean) => {
    const half = spacing * 0.21;
    for (let floor = 0; floor < floors; floor++) {
      const low = cityStreetDatum + h * (floor + 0.18) / floors;
      const high = cityStreetDatum + h * (floor + 0.68) / floors;
      if (right) {
        const wall = x + w / 2 + 0.001;
        m.face(windowColor, [[wall,low,across+half], [wall,low,across-half], [wall,high,across-half], [wall,high,across+half]]);
      } else {
        const wall = z + d / 2 + 0.001;
        m.face(windowColor, [[across-half,low,wall], [across+half,low,wall], [across+half,high,wall], [across-half,high,wall]]);
      }
    }
  };
  for (let bay = 0; bay < bays; bay++) insetWall(x + w * ((bay + 0.5) / bays - 0.5), w / bays, false);
  const sideBays = Math.max(1, Math.round(bays * d / w));
  for (let bay = 0; bay < sideBays; bay++) insetWall(z + d * ((bay + 0.5) / sideBays - 0.5), d / sideBays, true);
  m.box(cornice, x, cityStreetDatum + h - 0.007, z, w + 0.014, 0.014, d + 0.014);
  return cityStreetDatum + h;
}
