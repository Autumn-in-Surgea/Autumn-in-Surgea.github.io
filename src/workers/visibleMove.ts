import { getMovementPath, isUnitVisible } from "../game/rules/engine";
import type { Action, GameState, Unit } from "../game/types";
import type { WitnessedMove } from "./combatEvents";

/** Capture paths while the action's original positions and visibility are still available. */
export function observeMoves(
  before: GameState,
  after: GameState,
  action: Action,
): WitnessedMove[] {
  let old: Unit | undefined;
  if (action.type === "CITY_REWARD" && action.reward === "giant") {
    const city = before.cities.find((c) => c.id === action.cityId);
    if (city) old = before.units.find((u) => u.x === city.x && u.y === city.y);
  } else if (action.type === "MOVE" || action.type === "ATTACK" || action.type === "EXAMINE") {
    old = before.units.find((u) => u.id === action.unitId);
  } else return [];
  if (!old) return [];
  const unitId = old.id;
  const unit = after.units.find((u) => u.id === unitId);
  if (!unit || (old.x === unit.x && old.y === unit.y)) return [];
  const size = before.options.size;
  const at = unit.y * size + unit.x;
  const from = old.y * size + old.x;
  // Sort moves before their stomp and advances after their triggering strike.
  const id = (action.type === "ATTACK" ? after.nextId : before.nextId) - 0.5;
  const visiblePiece = (prior: Unit, current: Unit) =>
    isUnitVisible(before, prior, 0) && isUnitVisible(after, current, 0);
  const seenThroughout = (tile: number) =>
    before.players[0].visible.includes(tile) && after.players[0].visible.includes(tile);
  const observe = (prior: Unit, current: Unit, path: number[]): WitnessedMove => ({
    id, unitId: prior.id,
    path: visiblePiece(prior, current) && (prior.owner === 0 || path.every(seenThroughout)) ? path : [],
  });

  // Advances and forced moves already have exact adjacent endpoints, even if
  // the unit's normal move allowance is exhausted.
  if (action.type !== "MOVE") return [observe(old, unit, [from, at])];

  const owner = old.owner;
  const partner = before.units.find(u => u.owner === owner && u.x === unit.x && u.y === unit.y);
  const displaced = partner && after.units.find(u => u.id === partner.id && u.y * size + u.x === from);
  if (partner && displaced) {
    const a = observe(old, unit, [from, at]);
    const b = observe(partner, displaced, [at, from]);
    // At the midpoint of a diagonal swap, the models pass on opposite sides
    // of the corner. Never draw that passage into an unseen flank square.
    const cleared = owner === 0 || old.x === unit.x || old.y === unit.y ||
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

  if (!visiblePiece(old, unit)) return [{ id, unitId, path: [] }];
  const path = getMovementPath(before, unitId, at, true);
  const move: WitnessedMove = { id, unitId, path: owner === 0 || path.every(seenThroughout) ? path : [] };
  const passing = move.path.slice(1, -1).flatMap((tile, index) => {
    const { x, y } = before.tiles[tile];
    return before.units.some(other => other.owner === owner && other.x === x && other.y === y &&
      isUnitVisible(before, other, 0)) ? [index + 1] : [];
  });
  if (passing.length) move.passing = passing;
  return [move];
}
