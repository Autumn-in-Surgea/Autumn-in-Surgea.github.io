import { isWater, neighbors } from "../map/generate";
import type { GameState, Player, Tile } from "../types";

const maximumSeaSteps = 5;
type MapState = Pick<GameState, "tiles" | "options">;

/** Shortest legal sailing links from a port, including both endpoint tiles. */
export function portRoutes(
  { tiles, options }: MapState,
  origin: Tile,
  player: Player,
  explored: ReadonlySet<number>,
): number[][] {
  const canSailDeep = player.technologies.includes("sailing");
  const friendlyOwner = (owner: number | null) =>
    owner === null || owner === player.id || player.peaceWith.includes(owner);
  const origins = new Map([[origin.id, { from: origin.id, steps: 0, diagonals: 0 }]]);
  const queue = [origin.id], destinations: number[] = [];
  for (let i = 0; i < queue.length; i++) {
    const tile = tiles[queue[i]];
    const { steps, diagonals } = origins.get(tile.id)!;
    if (steps === maximumSeaSteps) continue;
    for (const next of neighbors(tiles, options.size, tile)) {
      if (!explored.has(next.id) || !isWater(next) || !friendlyOwner(next.owner) ||
        (next.terrain === "deep" && !canSailDeep)) continue;
      const nextDiagonals = diagonals + Number(tile.x !== next.x && tile.y !== next.y);
      const reached = origins.get(next.id);
      if (reached && (reached.steps !== steps + 1 || reached.diagonals <= nextDiagonals)) continue;
      origins.set(next.id, { from: tile.id, steps: steps + 1, diagonals: nextDiagonals });
      if (reached) continue;
      queue.push(next.id);
      if (next.building === "port" && next.owner === player.id) destinations.push(next.id);
    }
  }
  return destinations.map((id) => {
    const path = [id];
    while (id !== origin.id) {
      id = origins.get(id)!.from;
      path.push(id);
    }
    return path.reverse();
  });
}
