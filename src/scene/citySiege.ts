import { isCityUnderSiege, isUnitVisible } from "../game/rules/engine";
import type { GameState, Unit } from "../game/types";
import { strikeReadyAt, type CombatFrame } from "./combatMotion";
import { movementDuration } from "./motion";

export function visibleCitySieges(game: GameState, visible: ReadonlySet<number>) {
  const size = game.options.size;
  const occupants = new Map(game.units.map((unit) => [unit.y * size + unit.x, unit]));
  const sieges = new Map<string, Unit>();
  for (const city of game.cities) {
    const tileId = city.y * size + city.x;
    const occupant = occupants.get(tileId);
    if (occupant && visible.has(tileId) && isCityUnderSiege(game, city, occupant) && isUnitVisible(game, occupant, 0))
      sieges.set(city.id, occupant);
  }
  return sieges;
}

/** Begin the siege when the arriving piece reaches the city in the replay. */
export function siegeStartsAt(unit: Unit, combat: CombatFrame) {
  const travel = combat.journeys?.get(unit.id)?.at(-1);
  const destination = travel?.path.at(-1);
  if (travel && destination?.x === unit.x && destination.y === unit.y)
    return combat.issuedAt + (travel.start + travel.duration) * 1000;
  const advance = combat.strikes.find((strike) => strike.attackerId === unit.id && strike.lethal &&
    strike.contact && strike.from && strike.at.x === unit.x && strike.at.y === unit.y);
  if (advance?.from) {
    const distance = Math.hypot(unit.x - advance.from.x, unit.y - advance.from.y);
    return combat.issuedAt + (strikeReadyAt(advance) + movementDuration(distance)) * 1000;
  }
  return combat.issuedAt;
}
