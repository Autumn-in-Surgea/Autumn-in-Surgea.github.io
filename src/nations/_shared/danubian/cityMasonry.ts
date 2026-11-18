import { Miniature } from "../../../scene/miniature";
import { ink, ivory } from "../../../scene/architecturalPalette";

// The shared architectural drawing datum is translated to the tile surface when baked.
export const cityStreetDatum = 0.051;

// The two outward-facing walls use flush window inlays. Each opening is one
// quad, and every architectural detail is baked into the same coloured mesh.
export function facade(m: Miniature, x: number, z: number, w: number, d: number, h: number,
  plaster: string, bays: number, floors: number) {
  m.box(plaster, x, cityStreetDatum + h / 2, z, w, h, d);
  const insetWall = (across: number, spacing: number, right: boolean) => {
    const half = spacing * 0.25;
    for (let floor = 0; floor < floors; floor++) {
      const low = cityStreetDatum + h * (floor + 0.18) / floors;
      const high = cityStreetDatum + h * (floor + 0.68) / floors;
      if (right) {
        const wall = x + w / 2 + 0.001;
        m.face(ink, [[wall,low,across+half], [wall,low,across-half], [wall,high,across-half], [wall,high,across+half]]);
      } else {
        const wall = z + d / 2 + 0.001;
        m.face(ink, [[across-half,low,wall], [across+half,low,wall], [across+half,high,wall], [across-half,high,wall]]);
      }
    }
  };
  for (let bay = 0; bay < bays; bay++) insetWall(x + w * ((bay + 0.5) / bays - 0.5), w / bays, false);
  const sideBays = Math.max(1, Math.round(bays * d / w));
  for (let bay = 0; bay < sideBays; bay++) insetWall(z + d * ((bay + 0.5) / sideBays - 0.5), d / sideBays, true);
  m.box(ivory, x, cityStreetDatum + h - 0.007, z, w + 0.014, 0.014, d + 0.014);
  return cityStreetDatum + h;
}

// Layer perimeter walls and window bays along convex, counterclockwise plans.
type Point = [number, number, number];

export function masonryCourse(m: Miniature, outline: [number,number][], x: number, z: number,
  bottom: number, top: number, scale: number, stone: string, floors = 0) {
  const ring = outline.map(([px, pz]): [number, number] => [x + (px - x) * scale, z + (pz - z) * scale]);
  m.face(stone, ring.map(([px, pz]): Point => [px, top, pz]).reverse());
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length];
    m.face(stone, [[ax, bottom, az], [ax, top, az], [bx, top, bz], [bx, bottom, bz]]);
    if (!floors || i === 0 || i === ring.length - 1) continue;
    const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz);
    const bays = Math.max(1, Math.round(length / 0.063));
    const onWall = (u: number, v: number): Point =>
      [ax + dx * u + dz * 0.001 / length, bottom + (top-bottom)*v, az + dz * u - dx * 0.001 / length];
    for (let bay = 0; bay < bays; bay++) for (let floor = 0; floor < floors; floor++) {
      const a = (bay + 0.24) / bays, b = (bay + 0.76) / bays;
      const low = (floor + 0.18) / floors, high = (floor + 0.67) / floors;
      m.face(ink, [onWall(a, low), onWall(a, high), onWall(b, high), onWall(b, low)]);
    }
  }
}
