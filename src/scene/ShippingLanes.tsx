import { memo, useEffect, useMemo } from "react";
import { MeshBasicMaterial } from "three";
import { isWater } from "../game/map/generate";
import { portRoutes } from "../game/rules/waterConnections";
import type { GameState, Tile } from "../game/types";
import { Miniature } from "./miniature";
import { terrainCapOffset, terrainHeight } from "./terrainElevation";

interface Props {
  game: GameState;
  explored: ReadonlySet<number>;
}

const material = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
const ignoreRaycast = () => {};
type Point = { x: number; z: number };
const interpolate = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  z: a.z + (b.z - a.z) * t,
});

/** Draw a minimal backbone across nearby ports instead of a web of equivalent links. */
export function knownShippingRoutes(game: GameState, explored: ReadonlySet<number>) {
  const player = game.players[0];
  const links: number[][] = [];
  const parents = new Map<number, number>();
  for (const tile of game.tiles) {
    if (tile.building !== "port" || tile.owner !== player.id || !explored.has(tile.id)) continue;
    parents.set(tile.id, tile.id);
    for (const route of portRoutes(game, tile, player, explored)) {
      if (route[route.length - 1] > tile.id) links.push(route);
    }
  }
  function root(id: number) {
    let parent = parents.get(id)!;
    while (parent !== id) {
      id = parent;
      parent = parents.get(id)!;
    }
    return id;
  }
  links.sort((a, b) => a.length - b.length || a[0] - b[0] || a[a.length - 1] - b[b.length - 1]);
  return links.filter((route) => {
    const first = root(route[0]), last = root(route[route.length - 1]);
    if (first === last) return false;
    parents.set(last, first);
    return true;
  });
}

function routeCurve(route: readonly number[], tiles: readonly Tile[], offset: number) {
  const centers = route.map(id => ({ x: tiles[id].x - offset, z: tiles[id].y - offset }));
  const points = [centers[0]];
  for (let i = 1; i < centers.length - 1; i++) {
    const at = centers[i];
    const entry = interpolate(at, centers[i - 1], 0.22);
    const exit = interpolate(at, centers[i + 1], 0.22);
    points.push(entry);
    for (let j = 1; j <= 4; j++) {
      const t = j / 4;
      points.push(interpolate(interpolate(entry, at, t), interpolate(at, exit, t), t));
    }
  }
  points.push(centers[centers.length - 1]);
  return points;
}

function drawSeaDashes(model: Miniature, points: readonly Point[]) {
  const y = terrainHeight({ terrain: "shallow" }) + terrainCapOffset + 0.009;
  function stroke(a: Point, b: Point, halfWidth: number, level: number, color: string) {
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (length < 0.0001) return;
    const dx = (b.z - a.z) * halfWidth / length, dz = (a.x - b.x) * halfWidth / length;
    model.face(color, [
      [a.x - dx, level, a.z - dz], [b.x - dx, level, b.z - dz],
      [b.x + dx, level, b.z + dz], [a.x + dx, level, a.z + dz],
    ]);
  }
  const dash = 0.14, gap = 0.095;
  let drawn = 0;
  let begins = 0.06;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (length < 0.0001) continue;
    const end = drawn + length;
    while (begins < end) {
      const from = interpolate(a, b, (Math.max(begins, drawn) - drawn) / length);
      const to = interpolate(a, b, (Math.min(begins + dash, end) - drawn) / length);
      stroke(from, to, 0.029, y, "#2e5d68");
      stroke(from, to, 0.017, y + 0.001, "#d2ede7");
      if (begins + dash > end) break;
      begins += dash + gap;
    }
    drawn = end;
  }
}

function sameSeaLanes(previous: Props, next: Props) {
  if (previous.game === next.game && previous.explored === next.explored) return true;
  const a = previous.game.players[0], b = next.game.players[0];
  if (previous.game.options.size !== next.game.options.size || previous.explored.size !== next.explored.size ||
    a.technologies.includes("sailing") !== b.technologies.includes("sailing") ||
    a.peaceWith.length !== b.peaceWith.length || a.peaceWith.some(id => !b.peaceWith.includes(id))) return false;
  for (const id of previous.explored) {
    if (!next.explored.has(id)) return false;
    const before = previous.game.tiles[id], after = next.game.tiles[id];
    if (!isWater(before) && !isWater(after)) continue;
    if (before.terrain !== after.terrain || before.owner !== after.owner ||
      (before.building === "port") !== (after.building === "port")) return false;
  }
  return true;
}

export const ShippingLanes = memo(function ShippingLanes({ game, explored }: Props) {
  const geometry = useMemo(() => {
    const routes = knownShippingRoutes(game, explored);
    if (!routes.length) return null;
    const model = new Miniature(), offset = (game.options.size - 1) / 2;
    for (const route of routes) drawSeaDashes(model, routeCurve(route, game.tiles, offset));
    return model.finish();
  }, [game, explored]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  return geometry && <mesh name="shipping-lanes" geometry={geometry} material={material}
    dispose={null} raycast={ignoreRaycast} />;
}, sameSeaLanes);
