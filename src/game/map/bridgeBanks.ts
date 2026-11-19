import type { Position, Tile } from "../types";

export const bridgeAxes = ["northSouth", "westEast", "northwestSoutheast", "northeastSouthwest"] as const;
export type BridgeAxis = typeof bridgeAxes[number];

export const bridgeAxisSteps: Record<BridgeAxis, readonly [dx: number, dy: number]> = {
  northSouth: [0, 1],
  westEast: [1, 0],
  northwestSoutheast: [1, 1],
  northeastSouthwest: [-1, 1],
};

export function bridgeBanksAt(
  tiles: readonly Tile[], size: number, { x, y }: Position, axis: BridgeAxis,
): [Tile | undefined, Tile | undefined] {
  const [dx, dy] = bridgeAxisSteps[axis];
  const get = (x: number, y: number) => x >= 0 && x < size && y >= 0 && y < size
    ? tiles[y * size + x] : undefined;
  return [get(x - dx, y - dy), get(x + dx, y + dy)];
}
