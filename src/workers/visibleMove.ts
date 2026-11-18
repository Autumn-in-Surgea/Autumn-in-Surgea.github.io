import { getMovementPath, isUnitVisible } from "../game/rules/engine";
import type { Action, GameState } from "../game/types";
import type { WitnessedMove } from "./combatEvents";

/** Extract the original legal route while both sides of the command are available in the Worker. */
export function observeMove(
  before: GameState,
  after: GameState,
  action: Action,
): WitnessedMove | undefined {
  if (action.type !== "MOVE" && action.type !== "ATTACK") return;
  const old = before.units.find((u) => u.id === action.unitId);
  const unit = after.units.find((u) => u.id === action.unitId);
  if (!old || !unit || (old.x === unit.x && old.y === unit.y)) return;
  const at = unit.y * after.options.size + unit.x;
  const from = old.y * before.options.size + old.x;
  const advanced = action.type === "ATTACK";
  // Sort moves before their stomp and advances after their triggering strike.
  const id = advanced ? after.nextId - 0.5 : before.nextId - 0.5;
  const entry: WitnessedMove = { id, unitId: unit.id, path: [] };
  if (!isUnitVisible(before, old, 0) || !isUnitVisible(after, unit, 0))
    return entry;
  const path = advanced
    ? [from, at]
    : getMovementPath(before, old.id, at, true);
  if (!path.length) return entry;
  const seen = new Set(before.players[0].visible);
  const visible = new Set(after.players[0].visible);
  if (old.owner === 0 || path.every((tile) => seen.has(tile) && visible.has(tile)))
    entry.path = path;
  return entry;
}
