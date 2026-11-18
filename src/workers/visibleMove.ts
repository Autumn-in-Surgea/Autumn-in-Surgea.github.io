import { getMovementPath, isUnitVisible } from "../game/rules/engine";
import type { Action, GameState, Unit } from "../game/types";
import type { WitnessedMove } from "./combatEvents";

/** Resolve both legs of a swap while the original positions are still available. */
export function observeMoves(
  before: GameState,
  after: GameState,
  action: Action,
): WitnessedMove[] {
  if (action.type !== "MOVE" && action.type !== "ATTACK") return [];
  const old = before.units.find((u) => u.id === action.unitId);
  const unit = after.units.find((u) => u.id === action.unitId);
  if (!old || !unit || (old.x === unit.x && old.y === unit.y)) return [];
  const size = before.options.size;
  const at = unit.y * size + unit.x;
  const from = old.y * size + old.x;
  const advanced = action.type === "ATTACK";
  // Sort moves before their stomp and advances after their triggering strike.
  const id = advanced ? after.nextId - 0.5 : before.nextId - 0.5;
  const visiblePiece = (prior: Unit, current: Unit) =>
    isUnitVisible(before, prior, 0) && isUnitVisible(after, current, 0);
  const seenThroughout = (tile: number) =>
    before.players[0].visible.includes(tile) && after.players[0].visible.includes(tile);
  const observe = (prior: Unit, current: Unit, path: number[]): WitnessedMove => ({
    id, unitId: prior.id,
    path: visiblePiece(prior, current) && (prior.owner === 0 || path.every(seenThroughout)) ? path : [],
  });

  if (!advanced) {
    const partner = before.units.find(u => u.owner === old.owner && u.x === unit.x && u.y === unit.y);
    const displaced = partner && after.units.find(u => u.id === partner.id && u.x === old.x && u.y === old.y);
    if (partner && displaced) {
      const a = observe(old, unit, [from, at]);
      const b = observe(partner, displaced, [at, from]);
      // At the midpoint of a diagonal swap, the models pass on opposite sides
      // of the corner. Never draw that passage into an unseen flank square.
      const cleared = old.owner === 0 || old.x === unit.x || old.y === unit.y ||
        (seenThroughout(old.y * size + unit.x) && seenThroughout(unit.y * size + old.x));
      if (a.path.length && b.path.length) {
        if (cleared) {
          a.swapWith = b.unitId;
          b.swapWith = a.unitId;
        } else {
          a.path = [];
          b.path = [];
        }
      }
      return [a, b];
    }
  }

  if (!visiblePiece(old, unit)) return [{ id, unitId: unit.id, path: [] }];
  const path = advanced ? [from, at] : getMovementPath(before, old.id, at, true);
  const move: WitnessedMove = { id, unitId: unit.id, path: old.owner === 0 || path.every(seenThroughout) ? path : [] };
  const passing = move.path.slice(1, -1).flatMap((tile, index) => {
    const { x, y } = before.tiles[tile];
    return before.units.some(other => other.owner === old.owner && other.x === x && other.y === y &&
      isUnitVisible(before, other, 0)) ? [index + 1] : [];
  });
  if (passing.length) move.passing = passing;
  return [move];
}
