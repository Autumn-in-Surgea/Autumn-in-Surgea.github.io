import type { GameState, Position, UnitType } from "../game/types";
import { freshCombatEvents, witnessedMoves } from "../workers/combatEvents";
import { easeIn, easeInOut, easeOut, isVisibleTransition, movementDuration } from "./motion";

export type Projectile = "arrow" | "stone" | "bolt" | "shell";
const missiles: Partial<Record<UnitType, Projectile>> = {
  archer: "arrow",
  catapult: "stone",
  scout: "bolt",
  bomber: "shell",
};
export const strikeWindup = 0.17;
const contactWindup = 0.15;
const contactCharge = 0.17;
const contactRecovery = 0.24;
const contactHold = 0.034;
const contactRebound = 0.105;
const rangedRecovery = 0.27;
export const collapseDuration = 0.58;

// Distance from the centre of each miniature to its leading base or bow.
const pieceReach: Partial<Record<UnitType, number>> = {
  rider: 0.324, knight: 0.324, giant: 0.30, catapult: 0.31,
  raft: 0.23, dinghy: 0.22, pirate: 0.28, rammer: 0.34,
  scout: 0.37, bomber: 0.48, juggernaut: 0.49,
};

export interface Contact {
  x: number;
  z: number;
  travel: number;
  gap: number;
  targetReach: number;
}

function pieceContact(game: GameState, from: Position, to: Position, attacker: UnitType, defender?: UnitType): Contact {
  const garrison = (at: Position) => game.tiles[at.y * game.options.size + at.x].cityId ? 0.24 : 0;
  const offset = garrison(to) - garrison(from);
  const x = to.x - from.x + offset;
  const z = to.y - from.y + offset;
  const gap = Math.hypot(x, z) || 1;
  const targetReach = defender ? pieceReach[defender] ?? 0.245 : 0.245;
  const separation = (pieceReach[attacker] ?? 0.245) + targetReach + 0.015;
  return { x: x / gap, z: z / gap, gap, targetReach, travel: Math.max(0, gap - separation) };
}

export interface Strike {
  id: number;
  targetId: string;
  at: Position;
  // Omitted even for a visible shooter if the intervening trajectory crosses fog.
  from?: Position;
  attackerId?: string;
  projectile?: Projectile;
  contact?: Contact;
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
export type CombatFrame = { issuedAt: number; strikes: Strike[]; journeys?: Map<string, TravelLeg[]> };

export const strikeReadyAt = (strike: Strike) =>
  strike.impact + (strike.contact ? contactRecovery : 0.1);

export function strikeMotionEndsAt(strike: Strike): number {
  return strike.contact ? strike.impact + contactRecovery : strike.launch + rangedRecovery;
}

export function sampleAttackPose(strike: Strike, elapsed: number) {
  if (elapsed <= strike.launch) {
    const draw = easeInOut((elapsed - strike.start) / (strike.launch - strike.start));
    return { travel: -(strike.contact ? 0.16 : 0.072) * draw, pitch: 0.19 * draw, lift: 0.025 * draw };
  }
  if (!strike.contact) {
    const recovery = 1 - easeOut((elapsed - strike.launch) / rangedRecovery);
    return { travel: -0.072 * recovery, pitch: 0.19 * recovery, lift: 0.025 * recovery };
  }
  if (elapsed <= strike.impact) {
    const charge = easeIn((elapsed - strike.launch) / (strike.impact - strike.launch));
    return {
      travel: -0.16 + (strike.contact.travel + 0.16) * charge,
      pitch: 0.19 - 0.22 * charge,
      lift: 0.025 + 0.075 * Math.sin(charge * Math.PI),
    };
  }
  const age = elapsed - strike.impact - contactHold;
  const rebound = easeInOut(age / contactRebound);
  const settle = 1 - easeInOut((age - contactRebound) / (contactRecovery - contactHold - contactRebound));
  return {
    travel: (strike.contact.travel - (strike.contact.travel + 0.055) * rebound) * settle,
    pitch: (-0.03 + 0.14 * Math.sin(Math.PI * rebound)) * settle,
    lift: (0.025 + 0.035 * Math.sin(Math.PI * rebound)) * settle,
  };
}

export function impactRecoil(elapsed: number): number {
  return easeOut((elapsed - contactHold) / 0.058) *
    (1 - easeInOut((elapsed - contactHold - 0.058) / 0.15));
}
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
      const until = strikeReadyAt(strike) - age;
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
    for (const [id, legs] of preceding.journeys ?? []) {
      const active = legs
        .filter((leg) => leg.start + leg.duration > age)
        .map((leg) => ({ ...leg, start: leg.start - age }));
      if (!active.length) continue;
      const end = active[active.length - 1];
      ready.set(id, Math.max(ready.get(id) ?? 0, end.start + end.duration));
      journeys.set(id, active);
    }
  }
  const moves = witnessedMoves(before, after);
  const actorsWithMoves = new Set([...journeys.keys(), ...moves.map((move) => move.unitId)]);
  const hiddenJourneys = new Set(
    moves.filter((move) => !move.path.length).map((move) => move.unitId),
  );
  for (const id of hiddenJourneys) journeys.delete(id);
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
  const oldUnits = new Map(before.units.map((unit) => [unit.id, unit]));
  const newUnits = new Map(after.units.map((unit) => [unit.id, unit]));
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
    const defender = oldUnits.get(hit.targetId) ?? newUnits.get(hit.targetId);
    const contact = from && !projectile ? pieceContact(after, from, at, hit.weapon, defender?.type) : undefined;
    const travel = projectile
      ? from
        ? 0.29 + Math.min(3, Math.hypot(at.x - from.x, at.y - from.y)) * 0.075
        : 0.33
      : contact ? contactCharge : 0.055;
    const windup = contact ? contactWindup : strikeWindup;
    const attacker = from && oldUnits.get(sourceId);
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
      contact,
      splash: areaHit,
      splashWeapon: hit.kind === "splash" ? missiles[hit.weapon] : undefined,
      damage: event.damage ?? 0,
      lethal: hit.lethal,
      start: primary?.start ?? start,
      launch: primary?.launch ?? start + windup,
      impact: primary?.impact ?? start + windup + travel,
    };
    if (hit.kind === "strike") volleys.set(event.id, strike);
    if (hit.kind === "splash" && hit.volleyId !== undefined && !primary)
      volleys.set(hit.volleyId, strike);
    if (!areaHit) ready.set(sourceId, strikeReadyAt(strike));
    ready.set(hit.targetId, strikeReadyAt(strike));
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
