import type { GameState, Position, UnitType } from "../game/types";
import { freshCombatEvents, witnessedMoves } from "../workers/combatEvents";
import { isVisibleTransition, movementDuration } from "./motion";

export type Projectile = "arrow" | "stone" | "bolt" | "shell";
const missiles: Partial<Record<UnitType, Projectile>> = {
  archer: "arrow",
  catapult: "stone",
  scout: "bolt",
  bomber: "shell",
};
export const strikeWindup = 0.17;
export const collapseDuration = 0.58;
export interface Strike {
  id: number;
  targetId: string;
  at: Position;
  // Omitted even for a visible shooter if the intervening trajectory crosses fog.
  from?: Position;
  attackerId?: string;
  projectile?: Projectile;
  splash: boolean;
  splashWeapon?: Projectile;
  damage: number;
  lethal: boolean;
  start: number;
  launch: number;
  impact: number;
}

/** Keep exchanges involving the same pieces in order; unrelated duels may play together. */
export interface TravelLeg {
  from: Position;
  path: Position[];
  start: number;
  duration: number;
}
export type CombatFrame = { issuedAt: number; strikes: Strike[] };
export function planEncounter(
  before: GameState,
  after: GameState,
  preceding?: CombatFrame,
  issuedAt = 0,
) {
  const journeys = new Map<string, TravelLeg[]>();
  const result: Strike[] = [];
  const ready = new Map<string, number>();
  const volleys = new Map<number, Strike>();
  if (preceding) {
    const age = (issuedAt - preceding.issuedAt) / 1000;
    for (const strike of preceding.strikes) {
      const until = strike.impact + 0.1 - age;
      if (until <= 0) continue;
      if (strike.attackerId)
        ready.set(
          strike.attackerId,
          Math.max(ready.get(strike.attackerId) ?? 0, until),
        );
      ready.set(
        strike.targetId,
        Math.max(ready.get(strike.targetId) ?? 0, until),
      );
    }
  }
  const moves = witnessedMoves(before, after);
  const actorsWithMoves = new Set(moves.map((move) => move.unitId));
  const hiddenJourneys = new Set(
    moves.filter((move) => !move.path.length).map((move) => move.unitId),
  );
  let moveIndex = 0;
  function scheduleMoves(beforeId: number) {
    while (moveIndex < moves.length && moves[moveIndex].id < beforeId) {
      const move = moves[moveIndex++];
      // A partially observed itinerary must never be bridged across unknown squares.
      if (hiddenJourneys.has(move.unitId) || move.path.length < 2) continue;
      const path = move.path.map((id) => ({
        x: after.tiles[id].x,
        y: after.tiles[id].y,
      }));
      let distance = 0;
      for (let i = 1; i < path.length; i++)
        distance += Math.hypot(
          path[i].x - path[i - 1].x,
          path[i].y - path[i - 1].y,
        );
      const start = ready.get(move.unitId) ?? 0;
      const duration = movementDuration(distance);
      const journey = journeys.get(move.unitId) ?? [];
      journey.push({ from: path[0], path, start, duration });
      journeys.set(move.unitId, journey);
      ready.set(move.unitId, start + duration);
    }
  }
  const seen = new Set(before.players[0].visible);
  const now = new Set(after.players[0].visible);
  for (const event of freshCombatEvents(before, after)) {
    scheduleMoves(event.id);
    const hit = event.combat!;
    const at = event.at,
      origin = event.from,
      sourceId = event.unitId;
    if (!at || !origin || !sourceId) continue;
    const areaHit = hit.kind === "splash" || hit.kind === "stomp";
    const safeOrigin =
      hit.originVisible &&
      isVisibleTransition(origin, at, seen, now, after.options.size);
    const from =
      !areaHit && safeOrigin ? { x: origin.x, y: origin.y } : undefined;
    const primary =
      hit.volleyId === undefined ? undefined : volleys.get(hit.volleyId);
    // If only a splash victim was seen, show a single incoming shell on an observed square.
    const drawMissile = !areaHit || (hit.kind === "splash" && !primary);
    const projectile = drawMissile ? missiles[hit.weapon] : undefined;
    const travel = projectile
      ? from
        ? 0.29 + Math.min(3, Math.hypot(at.x - from.x, at.y - from.y)) * 0.075
        : 0.33
      : 0.055;
    const attacker = from && before.units.find((u) => u.id === sourceId);
    const moved =
      !actorsWithMoves.has(sourceId) &&
      attacker &&
      (attacker.x !== origin.x || attacker.y !== origin.y);
    const arrive = moved
      ? movementDuration(
          Math.hypot(origin.x - attacker.x, origin.y - attacker.y),
        )
      : 0;
    const start = Math.max(
      arrive,
      ready.get(sourceId) ?? 0,
      ready.get(hit.targetId) ?? 0,
    );
    const strike: Strike = {
      id: event.id,
      at: { x: at.x, y: at.y },
      from,
      attackerId: from ? sourceId : undefined,
      targetId: hit.targetId,
      projectile,
      splash: areaHit,
      splashWeapon: hit.kind === "splash" ? missiles[hit.weapon] : undefined,
      damage: event.damage ?? 0,
      lethal: hit.lethal,
      start: primary?.start ?? start,
      launch: primary?.launch ?? start + strikeWindup,
      impact: primary?.impact ?? start + strikeWindup + travel,
    };
    if (hit.kind === "strike") volleys.set(event.id, strike);
    if (hit.kind === "splash" && hit.volleyId !== undefined && !primary)
      volleys.set(hit.volleyId, strike);
    if (!areaHit) ready.set(sourceId, strike.impact + 0.1);
    ready.set(hit.targetId, strike.impact + 0.1);
    result.push(strike);
  }
  scheduleMoves(Infinity);
  return { strikes: result, journeys, hiddenJourneys };
}
export function planCombat(
  before: GameState,
  after: GameState,
  preceding?: CombatFrame,
  issuedAt = 0,
) {
  return planEncounter(before, after, preceding, issuedAt).strikes;
}

/** Direction for an incoming effect is decorative and independent of the hidden shooter. */
export function incomingOffset(eventId: number): [number, number] {
  const angle = eventId * 2.399963;
  return [Math.cos(angle) * 0.42, Math.sin(angle) * 0.42];
}

/** Carry only unfinished cues into a newly published snapshot's timebase. */
export function carryStrikes(
  strikes: Strike[] | undefined,
  previousTime: number,
  newTime: number,
): Strike[] {
  const age = (newTime - previousTime) / 1000;
  return (strikes ?? [])
    .filter((strike) => strike.impact + 0.35 > age)
    .map((strike) => ({
      ...strike,
      start: strike.start - age,
      launch: strike.launch - age,
      impact: strike.impact - age,
    }));
}
