import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getMovementPath, isUnitVisible, UNITS } from "../game";
import type { GameState, Unit } from "../game/types";
import { usePlaybackClock, type PlaybackClock } from "./playbackClock";
import type { Strike, TravelLeg } from "./combatMotion";
import { carryStrikes, collapseDuration, impactRecoil, sampleAttackPose, strikeMotionEndsAt, strikeReadyAt } from "./combatMotion";
import { terrainHeight } from "./models";
import {
  clampProgress,
  easeIn,
  easeInOut,
  easeOut,
  getFreshEvents,
  isVisibleTransition,
  movementDuration,
  createMotionPath,
  sampleMotionPath,
} from "./motion";
import type {
  MotionPath,
  MotionVector,
  PresentedUnit,
  UnitCue,
} from "./motion";

const idleCue = (serial = 0): UnitCue => ({
  serial,
  issuedAt: 0,
  attackFirst: false,
  hit: false,
  appear: false,
  trained: false,
  dying: false,
});
/** Presentation snapshots survive viewport changes and retain a dying model briefly.
 * Only visual data is retained: rule state and command timing are never delayed. */
export function usePresentedUnits(
  game: GameState,
  preview: boolean,
  combat: {
    strikes: Strike[];
    issuedAt: number;
    journeys: Map<string, TravelLeg[]>;
    hiddenJourneys: Set<string>;
  },
  playback: PlaybackClock,
) {
  const previous = useRef(game);
  const serial = useRef(0);
  const [presented, setPresented] = useState<PresentedUnit[]>(() =>
    game.units
      .filter((unit) => preview || isUnitVisible(game, unit, 0))
      .map((unit) => ({ unit, cue: idleCue() })),
  );
  useLayoutEffect(() => {
    const before = previous.current;
    if (before === game) return;
    previous.current = game;
    const revision = ++serial.current;
    if (
      before.options.seed !== game.options.seed ||
      before.options.size !== game.options.size ||
      game.nextId < before.nextId ||
      game.round < before.round
    ) {
      setPresented(
        game.units
          .filter((unit) => preview || isUnitVisible(game, unit, 0))
          .map((unit) => ({ unit, cue: idleCue(revision) })),
      );
      return;
    }
    const oldUnits = new Map(before.units.map((unit) => [unit.id, unit]));
    const newIds = new Set(game.units.map((unit) => unit.id));
    const visibleBefore = new Set(before.players[0].visible);
    const visibleNow = new Set(game.players[0].visible);
    const events = getFreshEvents(before, game);
    const attacks = new Map<string, Strike[]>();
    const impacts = new Map<string, Strike[]>();
    for (const strike of combat.strikes) {
      if (strike.attackerId) {
        const sequence = attacks.get(strike.attackerId) ?? [];
        sequence.push(strike);
        attacks.set(strike.attackerId, sequence);
      }
      const hits = impacts.get(strike.targetId) ?? [];
      hits.push(strike);
      impacts.set(strike.targetId, hits);
    }
    const deaths = new Map(
      events
        .filter((event) => event.type === "death" && event.unitId)
        .map((event) => [event.unitId!, event]),
    );
    setPresented((current) => {
      const existing = new Map(
        current.map((record) => [record.unit.id, record]),
      );
      const result: PresentedUnit[] = [];
      for (const unit of game.units) {
        if (!preview && !isUnitVisible(game, unit, 0)) continue;
        const old = oldUnits.get(unit.id);
        const record = existing.get(unit.id);
        const hadVisibility =
          !!old && (preview || isUnitVisible(before, old, 0));
        const moved = !!old && (old.x !== unit.x || old.y !== unit.y);
        const attack = attacks.get(unit.id)?.[0];
        const attackFirst = !!(
          moved &&
          attack?.from &&
          old &&
          attack.from.x === old.x &&
          attack.from.y === old.y
        );
        const journey = combat.journeys.get(unit.id);
        const observedMove = journey || combat.hiddenJourneys.has(unit.id);
        const ids =
          !observedMove && moved && old
            ? getMovementPath(
                before,
                old.id,
                unit.y * game.options.size + unit.x,
              )
            : [];
        // Advancing after a melee kill is a direct adjacent combat step, not a MOVE command.
        const path = journey
          ? journey.flatMap((leg) => leg.path)
          : ids.length
            ? ids.map((id) => ({
                x: before.tiles[id].x,
                y: before.tiles[id].y,
              }))
            : !observedMove &&
                attackFirst &&
                old &&
                Math.max(Math.abs(old.x - unit.x), Math.abs(old.y - unit.y)) ===
                  1
              ? [
                  { x: old.x, y: old.y },
                  { x: unit.x, y: unit.y },
                ]
              : undefined;
        const safePath =
          !!path &&
          hadVisibility &&
          (preview ||
            unit.owner === 0 ||
            path.every((point, index) =>
              isVisibleTransition(
                path[Math.max(0, index - 1)],
                point,
                visibleBefore,
                visibleNow,
                game.options.size,
              ),
            ));
        const hit = impacts.has(unit.id) || (!!old && unit.hp < old.hp);
        const appeared = !record || !hadVisibility;
        if (!moved && !journey && !attack && !hit && !appeared) {
          result.push({ unit, cue: record!.cue });
          continue;
        }
        result.push({
          unit,
          cue: {
            serial: revision,
            issuedAt: combat.issuedAt,
            initialHp: old?.hp,
            attacks: [
              ...carryStrikes(
                record?.cue.attacks,
                record?.cue.issuedAt ?? 0,
                combat.issuedAt,
              ),
              ...(attacks.get(unit.id) ?? []),
            ],
            impacts: [
              ...carryStrikes(
                record?.cue.impacts,
                record?.cue.issuedAt ?? 0,
                combat.issuedAt,
              ),
              ...(impacts.get(unit.id) ?? []),
            ],
            journey: safePath ? journey : undefined,
            path: safePath ? path : undefined,
            from: moved && safePath ? { x: old!.x, y: old!.y } : undefined,
            attackFirst,
            hit,
            appear: appeared || (moved && !safePath),
            trained: !old,
            dying: false,
          },
        });
      }
      for (const record of current) {
        if (newIds.has(record.unit.id)) continue;
        if (record.cue.dying) {
          if (
            (playback.time - record.cue.issuedAt) / 1000 <
            (record.cue.deathAt ?? 0) + collapseDuration
          )
            result.push(record);
          continue;
        }
        const death = deaths.get(record.unit.id);
        const hits = impacts.get(record.unit.id);
        const lethal = hits?.find((strike) => strike.lethal);
        const at = lethal?.at ?? death?.at ?? record.unit;
        const journey = combat.journeys.get(record.unit.id);
        if (
          (!death && !lethal) ||
          (!preview &&
            record.unit.owner !== 0 &&
            !lethal &&
            !visibleNow.has(at.y * game.options.size + at.x))
        )
          continue;
        result.push({
          unit: { ...record.unit, x: at.x, y: at.y },
          cue: {
            ...idleCue(revision),
            journey,
            from: journey?.[0].from,
            path: journey?.flatMap((leg) => leg.path),
            issuedAt: combat.issuedAt,
            attacks: [
              ...carryStrikes(
                record.cue.attacks,
                record.cue.issuedAt,
                combat.issuedAt,
              ),
              ...(attacks.get(record.unit.id) ?? []),
            ],
            impacts: [
              ...carryStrikes(
                record.cue.impacts,
                record.cue.issuedAt,
                combat.issuedAt,
              ),
              ...(hits ?? []),
            ],
            initialHp: record.unit.hp,
            deathAt: lethal?.impact,
            hit: true,
            dying: true,
          },
        });
      }
      return result;
    });
  }, [game, preview, combat, playback]);
  const finish = useCallback((unitId: string, cueSerial: number) => {
    setPresented((records) =>
      records.filter(
        (record) =>
          !(
            record.unit.id === unitId &&
            record.cue.serial === cueSerial &&
            record.cue.dying
          ),
      ),
    );
  }, []);
  return { presented, finish };
}

function positionOf(
  game: GameState,
  unit: Pick<Unit, "x" | "y">,
  offset: number,
): MotionVector {
  const tile = game.tiles[unit.y * game.options.size + unit.x];
  const extra = tile.cityId ? 0.24 : 0;
  return [
    unit.x - offset + extra,
    terrainHeight(tile) + 0.08,
    unit.y - offset + extra,
  ];
}
const DEFAULT_LAND_HEADING = -2.35;
// With the board's orthographic camera this yaw shows the bow and one flank,
// with the ship's length projected at about 45° to the screen edge.
const DEFAULT_SHIP_HEADING = -1.76;

interface Track {
  serial: number;
  started: number;
  from: MotionVector;
  to: MotionVector;
  path: MotionPath;
  segment: number;
  legs: { path: MotionPath; start: number; duration: number }[];
  moveDuration: number;
  moveDelay: number;
  moveYaw: number;
  hit: boolean;
  appear: boolean;
  trained: boolean;
  dying: boolean;
  finished: boolean;
}
export function useUnitMotion(
  record: PresentedUnit,
  game: GameState,
  offset: number,
  reducedMotion: boolean,
  onFinish: (id: string, serial: number) => void,
) {
  const playback = usePlaybackClock();
  const root = useRef<THREE.Group>(null);
  const model = useRef<THREE.Group>(null);
  const label = useRef<THREE.Group>(null);
  const target = positionOf(game, record.unit, offset);
  const initial = useRef<MotionVector>(
    record.cue.from && playback.time - record.cue.issuedAt < 800
      ? positionOf(game, record.cue.from, offset)
      : target,
  );
  const output = useRef<MotionVector>([...target]);
  const initialHeading = UNITS[record.unit.type].skills.includes("water")
    ? DEFAULT_SHIP_HEADING : DEFAULT_LAND_HEADING;
  const heading = useRef(initialHeading);
  const desiredHeading = useRef(initialHeading);
  const initialized = useRef(false);
  const track = useRef<Track>({
    serial: -1,
    started: 0,
    from: target,
    to: target,
    path: createMotionPath([target, target]),
    segment: 1,
    legs: [],
    moveDuration: 0,
    moveDelay: 0,
    moveYaw: initialHeading,
    hit: false,
    appear: false,
    trained: false,
    dying: false,
    finished: false,
  });
  useLayoutEffect(() => {
    if (!root.current || !model.current) return;
    const cue = record.cue;
    const to = positionOf(game, record.unit, offset);
    const from: MotionVector = initialized.current
      ? [
          root.current.position.x,
          root.current.position.y,
          root.current.position.z,
        ]
      : cue.from
        ? positionOf(game, cue.from, offset)
        : [...to];
    initialized.current = true;
    // Missing/hidden origins must snap to the known endpoint, never cross fog.
    if (cue.appear && !cue.from) from.splice(0, 3, ...to);
    if (cue.dying && !cue.from) from.splice(0, 3, ...to);
    const distance = Math.hypot(to[0] - from[0], to[2] - from[2]);
    const points: MotionVector[] = [from];
    if (!cue.appear && !cue.dying) {
      // A fast follow-up action continues the still-visible remainder of the old path.
      const running = track.current;
      if (
        initialized.current &&
        running.moveDuration &&
        playback.time / 1000 - running.started <
          running.moveDelay + running.moveDuration
      )
        points.push(...running.path.points.slice(running.segment));
      if (cue.path)
        points.push(
          ...cue.path.slice(1).map((point) => positionOf(game, point, offset)),
        );
    }
    points.push(to);
    const path = createMotionPath(points);
    const duration =
      (!cue.appear || !!cue.from) && distance > 0.015
        ? movementDuration(path.total)
        : 0;
    track.current = {
      serial: cue.serial,
      started: cue.issuedAt / 1000,
      from,
      to,
      path,
      segment: 1,
      legs: (cue.journey ?? []).map((leg) => ({
        start: leg.start,
        duration: leg.duration,
        path: createMotionPath(
          leg.path.map((point) => positionOf(game, point, offset)),
        ),
      })),
      moveDuration: duration,
      moveDelay: cue.attackFirst && cue.attacks?.[0] ? strikeReadyAt(cue.attacks[0]) : 0,
      moveYaw:
        distance > 0.015
          ? Math.atan2(-(to[0] - from[0]), -(to[2] - from[2]))
          : desiredHeading.current,
      hit: cue.hit,
      appear: cue.appear,
      trained: cue.trained,
      dying: cue.dying,
      finished: false,
    };
    root.current.position.fromArray(from);
    // Track changes are tied to snapshot cues, never to incidental UI rerenders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.cue.serial, record.unit.id, offset]);
  useFrame((_, delta) => {
    if (!root.current || !model.current) return;
    const state = track.current;
    const elapsed = playback.time / 1000 - state.started;
    if (reducedMotion) {
      root.current.position.fromArray(state.to);
      model.current.position.set(0, 0, 0);
      label.current?.position.set(0, 0, 0);
      const attack = record.cue.attacks?.at(-1);
      const yaw = attack?.from && !record.cue.attackFirst
        ? Math.atan2(attack.from.x - attack.at.x, attack.from.y - attack.at.y)
        : state.moveYaw;
      desiredHeading.current = heading.current = yaw;
      model.current.rotation.set(0, yaw, 0);
      model.current.scale.setScalar(1);
      if (state.dying && !state.finished) {
        state.finished = true;
        onFinish(record.unit.id, state.serial);
      }
      return;
    }
    let path = state.path;
    let moveDelay = state.moveDelay;
    let moveDuration = state.moveDuration;
    if (state.legs.length) {
      let leg = state.legs[0];
      for (
        let i = 1;
        i < state.legs.length && elapsed >= state.legs[i].start;
        i++
      )
        leg = state.legs[i];
      path = leg.path;
      moveDelay = leg.start;
      moveDuration = leg.duration;
    }
    state.segment = sampleMotionPath(
      path,
      elapsed - moveDelay,
      moveDuration,
      output.current,
    );
    root.current.position.fromArray(output.current);
    const moveProgress = moveDuration
      ? clampProgress((elapsed - moveDelay) / moveDuration)
      : 1;
    const moving = elapsed >= moveDelay && moveProgress < 1;
    const cue = record.cue;
    const strike = cue.attacks?.find(
      (shot) => elapsed >= shot.start && elapsed < strikeMotionEndsAt(shot),
    );
    const impact = cue.impacts?.find(
      (shot) => elapsed >= (shot.contact ? shot.launch : shot.impact) &&
        elapsed < shot.impact + 0.32,
    );
    const contact = impact?.contact;
    const hitAge = impact ? elapsed - impact.impact : cue.impacts?.length ? -1 : elapsed;
    const hit = (state.hit || impact) && hitAge >= 0 ? impactRecoil(hitAge) : 0;
    let attackX = 0, attackY = 0, attackZ = 0, pitch = 0;
    if (strike?.from) {
      let dx = strike.contact?.x ?? strike.at.x - strike.from.x;
      let dz = strike.contact?.z ?? strike.at.y - strike.from.y;
      const length = Math.hypot(dx, dz) || 1;
      dx /= length;
      dz /= length;
      desiredHeading.current = Math.atan2(-dx, -dz);
      const pose = sampleAttackPose(strike, elapsed);
      pitch = pose.pitch;
      attackX = dx * pose.travel;
      attackY = pose.lift;
      attackZ = dz * pose.travel;
      if (strike.contact) {
        const tiles = game.tiles, size = game.options.size;
        const fromHeight = terrainHeight(tiles[strike.from.y * size + strike.from.x]);
        const toHeight = terrainHeight(tiles[strike.at.y * size + strike.at.x]);
        attackY += (toHeight - fromHeight) * Math.max(0, pose.travel) / strike.contact.gap;
      }
    } else if (contact && !moving) {
      desiredHeading.current = Math.atan2(contact.x, contact.z);
    }
    const travel = moving ? easeInOut(moveProgress) * path.total : 0;
    const envelope = moving ? Math.sin(moveProgress * Math.PI) ** 2 : 0;
    const afloat = UNITS[record.unit.type].skills.includes("water");
    const gait = Math.sin(travel * Math.PI * 2) * (afloat ? 0.022 : 0.035) * envelope;
    const bob = (afloat ? 0.022 : 0.054) * envelope;
    const spawn = state.appear
      ? easeOut(elapsed / (state.trained ? 0.32 : 0.2))
      : 1;
    const spawnScale = state.appear
      ? 0.6 + 0.4 * spawn + Math.sin(spawn * Math.PI) * 0.08
      : 1;
    const death = state.dying
      ? clampProgress((elapsed - (cue.deathAt ?? 0)) / collapseDuration)
      : 0;
    const topple = easeInOut((death - 0.035) / 0.59);
    const deathScale = 1 - easeIn((death - 0.48) / 0.52);
    if (moving) {
      const a = path.points[state.segment - 1],
        b = path.points[state.segment];
      if (a && b && Math.hypot(b[0] - a[0], b[2] - a[2]) > 0.01)
        state.moveYaw = Math.atan2(-(b[0] - a[0]), -(b[2] - a[2]));
    }
    if (!strike && moving) desiredHeading.current = state.moveYaw;
    const headingTarget = desiredHeading.current;
    const yawDelta = Math.atan2(
      Math.sin(headingTarget - heading.current),
      Math.cos(headingTarget - heading.current),
    );
    const yaw = heading.current + yawDelta * (1 - Math.exp(-24 * delta));
    heading.current = yaw;
    const fall = cue.impacts?.find((shot) => shot.lethal)?.contact;
    const knockback = contact && !impact?.lethal ? hit * 0.15 : 0;
    const fallSlide = fall ? easeOut(death) * 0.15 : 0;
    model.current.rotation.set(
      pitch - envelope * 0.06 + hit * 0.18 + topple * (fall ? 1.22 : 0.24),
      yaw,
      gait + hit * 0.07 + topple * (fall ? 0.20 : 1.18),
      "YXZ",
    );
    model.current.position.set(
      attackX + (contact?.x ?? 0) * knockback + (fall?.x ?? 0) * fallSlide,
      attackY + bob + hit * 0.035 - topple * 0.06 - (1 - deathScale) * 0.07,
      attackZ + (contact?.z ?? 0) * knockback + (fall?.z ?? 0) * fallSlide,
    );
    label.current?.position.copy(model.current.position);
    model.current.scale.setScalar(spawnScale * deathScale);
    if (state.dying && death >= 1 && !state.finished) {
      state.finished = true;
      onFinish(record.unit.id, state.serial);
    }
  });
  return { root, model, label, initial: initial.current };
}
