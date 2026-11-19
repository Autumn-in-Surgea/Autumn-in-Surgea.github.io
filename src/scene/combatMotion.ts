import type { GameState, Position, UnitType } from "../game/types";
import { freshCombatEvents, witnessedMoves, type WitnessedMove } from "../workers/combatEvents";
import { easeInOut, isVisibleTransition, movementDuration } from "./motion";

export type Projectile = "arrow" | "stone" | "bolt" | "shell";
const missiles: Partial<Record<UnitType, Projectile>> = {
  archer: "arrow",
  catapult: "stone",
  scout: "bolt",
  bomber: "shell",
};
export const strikeWindup = 0.20;
const contactWindup = 0.20;
const contactCharge = 0.21;
const contactRecovery = 0.34;
const contactHold = 0.036;
const contactRebound = 0.20;
const advanceDelay = 0.14;
const rangedKick = 0.075;
const rangedRecovery = 0.30;
const recoilPeak = 0.075;
const recoilDuration = 0.28;
const contactHeight = 0.039;
const contactPitch = -0.07;
const drawnPitch = 0.16;
const rangedKickByWeapon: Record<Projectile, number> = {
  arrow: 0.028, stone: 0.060, bolt: 0.038, shell: 0.10,
};
export const collapseDuration = 0.58;
export const hitFeedbackDuration = 0.46;

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
  // Observed area impacts can guide a defender's stance without drawing a second attack.
  areaOrigin?: Position;
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
  swap?: boolean;
  passing?: number[];
  /** ID of the visible lethal contact that carries this piece into the next square. */
  advanceAfter?: number;
}
export type CombatFrame = { issuedAt: number; strikes: Strike[]; journeys?: Map<string, TravelLeg[]> };

export const strikeAdvanceAt = (strike: Strike) => strike.impact + advanceDelay;

export const strikeReadyAt = (strike: Strike) => Math.max(
  strikeMotionEndsAt(strike),
  strike.impact + (strike.lethal ? collapseDuration : recoilDuration),
) + 0.035;

export function strikeMotionEndsAt(strike: Strike): number {
  return strike.contact ? strike.impact + contactRecovery : strike.launch + rangedRecovery;
}

export function sampleAttackPose(strike: Strike, elapsed: number) {
  const raisedHeight = strike.contact ? 0.34 : 0.24;
  const drawDistance = strike.contact ? 0.16 : 0.072;
  if (elapsed <= strike.launch) {
    const progress = (elapsed - strike.start) / (strike.launch - strike.start);
    const draw = easeInOut((progress - 0.16) / 0.84);
    return {
      travel: -drawDistance * draw,
      pitch: drawnPitch * draw,
      lift: raisedHeight * easeInOut(progress / 0.82),
    };
  }
  if (!strike.contact) {
    const age = elapsed - strike.launch;
    const kick = easeInOut(age / rangedKick);
    const seat = 1 - easeInOut((age - rangedKick) / (rangedRecovery - rangedKick));
    const strength = strike.projectile ? rangedKickByWeapon[strike.projectile] : rangedKickByWeapon.arrow;
    return {
      travel: -(drawDistance + strength * kick) * seat,
      pitch: (drawnPitch + strength * 1.1 * kick) * seat,
      lift: (raisedHeight + strength * 0.32 * kick) * seat,
    };
  }
  if (elapsed <= strike.impact) {
    const progress = (elapsed - strike.launch) / (strike.impact - strike.launch);
    const charge = easeInOut(progress) ** 1.45;
    const landing = easeInOut((progress - 0.33) / 0.67);
    return {
      travel: -drawDistance + (strike.contact.travel + drawDistance) * charge,
      pitch: drawnPitch + (contactPitch - drawnPitch) * easeInOut(progress),
      lift: raisedHeight + (contactHeight - raisedHeight) * landing,
    };
  }
  const age = elapsed - strike.impact;
  const press = easeInOut(age / contactHold);
  const pressedPitch = contactPitch - 0.035 * press;
  const pressedHeight = contactHeight - 0.02 * press;
  if (strike.lethal) {
    // Settle momentarily above the point where a visible follow-through takes over.
    const release = easeInOut((age - contactHold) / (advanceDelay - contactHold));
    const returnHome = 1 - easeInOut((age - advanceDelay) / (contactRecovery - advanceDelay));
    return {
      travel: strike.contact.travel * (1 - 0.55 * release) * returnHome,
      pitch: (pressedPitch * (1 - release) + 0.06 * release) * returnHome,
      lift: (pressedHeight * (1 - release) + 0.09 * release) * returnHome,
    };
  }
  const rebound = easeInOut((age - contactHold) / contactRebound);
  const settle = 1 - easeInOut((age - contactHold - contactRebound) / (contactRecovery - contactHold - contactRebound));
  return {
    travel: (strike.contact.travel * (1 - rebound) - 0.045 * rebound) * settle,
    pitch: (pressedPitch * (1 - rebound) + 0.095 * rebound) * settle,
    lift: (pressedHeight * (1 - rebound) + 0.15 * rebound) * settle,
  };
}

export function impactRecoil(elapsed: number): number {
  return easeInOut(elapsed / recoilPeak) *
    (1 - easeInOut((elapsed - recoilPeak) / (recoilDuration - recoilPeak)));
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
  const lethalContacts = new Map<string, Strike>();
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
  const size = after.options.size;
  function matchesAdvance(move: WitnessedMove, strike: Strike) {
    return !move.swapWith && move.path.length === 2 && strike.from &&
      move.path[0] === strike.from.y * size + strike.from.x &&
      move.path[1] === strike.at.y * size + strike.at.x;
  }
  let moveIndex = 0;
  function scheduleMove(move: WitnessedMove, readyAt: number, swap = false) {
    if (hiddenJourneys.has(move.unitId) || move.path.length < 2) return;
    const attack = lethalContacts.get(move.unitId);
    lethalContacts.delete(move.unitId);
    const advance = !swap && attack && matchesAdvance(move, attack) ? attack : undefined;
    const path = move.path.map((id) => ({ x: after.tiles[id].x, y: after.tiles[id].y }));
    let distance = 0;
    for (let i = 1; i < path.length; i++)
      distance += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    const duration = swap ? 0.58 : movementDuration(distance);
    const start = advance ? strikeAdvanceAt(advance) : readyAt;
    const journey = journeys.get(move.unitId) ?? [];
    journey.push({ from: path[0], path, start, duration, swap, passing: move.passing, advanceAfter: advance?.id });
    journeys.set(move.unitId, journey);
    ready.set(move.unitId, Math.max(readyAt, start + duration));
  }

  function scheduleMoves(beforeId: number) {
    while (moveIndex < moves.length && moves[moveIndex].id < beforeId) {
      const move = moves[moveIndex++];
      const start = ready.get(move.unitId) ?? 0;
      const partner = moves[moveIndex];
      if (move.swapWith && partner?.id === move.id && partner.unitId === move.swapWith &&
        !hiddenJourneys.has(move.unitId) && !hiddenJourneys.has(partner.unitId)) {
        const together = Math.max(start, ready.get(partner.unitId) ?? 0);
        scheduleMove(move, together, true);
        scheduleMove(partner, together, true);
        moveIndex++;
      } else {
        scheduleMove(move, start);
      }
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
    const pendingMove = moves[moveIndex];
    const lethalContact = lethalContacts.get(sourceId);
    // The rules record a giant's stomp before the witnessed move is appended.
    // A stomp at the advanced destination must wait for that move to land.
    if (hit.kind === "stomp" && pendingMove?.unitId === sourceId && lethalContact &&
      lethalContact.at.x === origin.x && lethalContact.at.y === origin.y && matchesAdvance(pendingMove, lethalContact)) {
      scheduleMoves(pendingMove.id + 0.001);
    }
    const areaHit = hit.kind === "splash" || hit.kind === "stomp";
    const safeOrigin =
      hit.originVisible &&
      isVisibleTransition(origin, at, seen, now, size);
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
    const windup = hit.kind === "stomp" ? 0 : contact ? contactWindup : strikeWindup;
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
      areaOrigin: areaHit && safeOrigin ? { x: origin.x, y: origin.y } : undefined,
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
    if (!areaHit) {
      ready.set(sourceId, strikeReadyAt(strike));
      if (strike.lethal && strike.contact) lethalContacts.set(sourceId, strike);
      else lethalContacts.delete(sourceId);
    }
    ready.set(hit.targetId, strikeReadyAt(strike));
    lethalContacts.delete(hit.targetId);
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
    .filter((strike) => strikeReadyAt(strike) > age)
    .map((strike) => ({
      ...strike,
      start: strike.start - age,
      launch: strike.launch - age,
      impact: strike.impact - age,
    }));
}
