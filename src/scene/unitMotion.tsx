import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getMovementPath, isUnitVisible, UNITS } from "../game";
import type { GameState, Unit } from "../game/types";
import { usePlaybackClock, type PlaybackClock } from "./playbackClock";
import type { Strike, TravelLeg } from "./combatMotion";
import { carryStrikes, collapseDuration, impactRecoil, sampleAttackPose, strikeMotionEndsAt, strikeReadyAt } from "./combatMotion";
import { terrainHeight } from "./models";
import { planUnitTurns, unitFacingAt, unitFacingYaw } from "./unitFacing";
import {
  carryHeight,
  clampProgress,
  easeInOut,
  easeOut,
  getFreshEvents,
  isVisibleTransition,
  movementDuration,
  createMotionPath,
  sampleCarriedPath,
  sampleMotionPath,
} from "./motion";
import type {
  MotionPath,
  MotionVector,
  PresentedUnit,
  UnitCue,
} from "./motion";

export const unitAppearDuration = (trained: boolean) => trained ? 0.32 : 0.2;

const idleCue = (serial = 0): UnitCue => ({
  serial,
  issuedAt: 0,
  attackFirst: false,
  hit: false,
  appear: false,
  trained: false,
  dying: false,
});

const advanceDelay = (cue: UnitCue) =>
  cue.attackFirst && cue.attacks?.[0] ? strikeReadyAt(cue.attacks[0]) : 0;

function presentUnit(unit: Unit, cue: UnitCue, previous?: PresentedUnit, reducedMotion = false): PresentedUnit {
  const previousElapsed = previous && !reducedMotion
    ? (cue.issuedAt - previous.cue.issuedAt) / 1000 : Infinity;
  const initialFacing = previous
    ? unitFacingAt(previous.turns, previousElapsed, previous.initialFacing)
    : "right";
  return { unit, cue, initialFacing, turns: planUnitTurns(cue, unit, advanceDelay(cue)) };
}

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
  reducedMotion: boolean,
) {
  const previous = useRef(game);
  const serial = useRef(0);
  const [presented, setPresented] = useState<PresentedUnit[]>(() =>
    game.units
      .filter((unit) => preview || isUnitVisible(game, unit, 0))
      .map((unit) => presentUnit(unit, idleCue())),
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
          .map((unit) => presentUnit(unit, idleCue(revision))),
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
          result.push({ ...record!, unit });
          continue;
        }
        const cue: UnitCue = {
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
        };
        result.push(presentUnit(unit, cue, record, reducedMotion));
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
        const cue: UnitCue = {
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
        };
        result.push(presentUnit({ ...record.unit, x: at.x, y: at.y }, cue, record, reducedMotion));
      }
      return result;
    });
  }, [game, preview, combat, playback, reducedMotion]);
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
interface Track {
  serial: number;
  started: number;
  to: MotionVector;
  path: MotionPath;
  segment: number;
  legs: {
    path: MotionPath;
    start: number;
    duration: number;
    swap?: boolean;
    advanceAfter?: number;
    handoff?: ReturnType<typeof strikeTransform>;
  }[];
  moveDuration: number;
  moveDelay: number;
  hit: boolean;
  appear: boolean;
  trained: boolean;
  dying: boolean;
  finished: boolean;
}

function strikeTransform(game: GameState, strike: Strike, elapsed: number) {
  const from = strike.from!;
  const pose = sampleAttackPose(strike, elapsed);
  const dx = strike.contact?.x ?? strike.at.x - from.x;
  const dz = strike.contact?.z ?? strike.at.y - from.y;
  const distance = Math.hypot(dx, dz) || 1;
  let y = pose.lift;
  if (strike.contact) {
    const { tiles, options: { size } } = game;
    const rise = terrainHeight(tiles[strike.at.y * size + strike.at.x]) - terrainHeight(tiles[from.y * size + from.x]);
    y += rise * Math.max(0, pose.travel) / strike.contact.gap;
  }
  return { x: dx / distance * pose.travel, y, z: dz / distance * pose.travel, pitch: pose.pitch };
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
  const initialized = useRef(false);
  const track = useRef<Track>({
    serial: -1,
    started: 0,
    to: target,
    path: createMotionPath([target, target]),
    segment: 1,
    legs: [],
    moveDuration: 0,
    moveDelay: 0,
    hit: false,
    appear: false,
    trained: false,
    dying: false,
    finished: false,
  });
  useLayoutEffect(() => {
    if (!root.current || !model.current) return;
    const cue = record.cue;
    const running = track.current;
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
      to,
      path,
      segment: 1,
      legs: (cue.journey ?? []).map((leg) => {
        const strike = leg.advanceAfter === undefined ? undefined
          : cue.attacks?.find((shot) => shot.id === leg.advanceAfter);
        const previousAdvance = leg.advanceAfter === undefined ? undefined
          : running.legs.find((previous) => previous.advanceAfter === leg.advanceAfter);
        return {
          start: leg.start,
          duration: leg.duration,
          swap: leg.swap,
          advanceAfter: leg.advanceAfter,
          path: createMotionPath(leg.path.map((point) => positionOf(game, point, offset)), leg.passing),
          handoff: strike?.from ? strikeTransform(game, strike, leg.start) : previousAdvance?.handoff,
        };
      }),
      moveDuration: duration,
      moveDelay: advanceDelay(cue),
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
  useFrame(() => {
    if (!root.current || !model.current) return;
    const state = track.current;
    const elapsed = playback.time / 1000 - state.started;
    const facing = unitFacingAt(record.turns, reducedMotion ? Infinity : elapsed, record.initialFacing);
    const yaw = unitFacingYaw[facing];
    if (reducedMotion) {
      root.current.position.fromArray(state.to);
      model.current.position.set(0, 0, 0);
      label.current?.position.set(0, 0, 0);
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
    let swap = false;
    let handoff: Track["legs"][number]["handoff"];
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
      swap = !!leg.swap;
      handoff = leg.handoff;
    }
    const moveTime = elapsed - moveDelay;
    const glideDuration = moveDuration * 0.8;
    state.segment = handoff
      ? sampleMotionPath(path, moveTime, glideDuration, output.current)
      : sampleCarriedPath(path, moveTime, moveDuration, output.current, swap);
    root.current.position.fromArray(output.current);
    const moveProgress = moveDuration ? clampProgress(moveTime / moveDuration) : 1;
    const moving = moveTime >= 0 && moveProgress < 1;
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
    const advancing = handoff && moving ? handoff : undefined;
    const attack = advancing ?? (strike?.from ? strikeTransform(game, strike, elapsed) : undefined);
    // Carry the recoil position into the advance at the same pace as the board leg.
    const remaining = advancing ? 1 - easeInOut(moveTime / glideDuration) : 1;
    const upright = advancing ? 1 - easeInOut(moveProgress / 0.57) : 1;
    const afloat = UNITS[record.unit.type].skills.includes("water");
    const lift = moving ? carryHeight(moveProgress, path.total, afloat) * (advancing ? 0.65 : 1) : 0;
    let carryPitch = 0, rock = 0;
    if (moving) {
      const liftTilt = easeInOut(moveProgress / 0.2) * (1 - easeInOut((moveProgress - 0.22) / 0.24));
      const landTilt = easeInOut((moveProgress - 0.56) / 0.24) * (1 - easeInOut((moveProgress - 0.8) / 0.2));
      carryPitch = -liftTilt * 0.072 + landTilt * 0.083;
      rock = (liftTilt - landTilt) * (afloat ? 0.046 : 0.029);
    }
    const spawn = state.appear
      ? easeOut(elapsed / unitAppearDuration(state.trained))
      : 1;
    const spawnScale = state.appear
      ? 0.6 + 0.4 * spawn + Math.sin(spawn * Math.PI) * 0.08
      : 1;
    const death = state.dying
      ? clampProgress((elapsed - (cue.deathAt ?? 0)) / collapseDuration)
      : 0;
    const topple = easeInOut((death - 0.055) / 0.65);
    const deathScale = 1 - easeInOut((death - 0.30) / 0.70);
    const fall = cue.impacts?.find((shot) => shot.lethal)?.contact;
    const knockback = contact && !impact?.lethal ? hit * 0.15 : 0;
    const fallSlide = fall ? easeInOut(death / 0.72) * 0.17 : 0;
    model.current.rotation.set(
      (attack?.pitch ?? 0) * upright + carryPitch + hit * (1 - topple) * 0.18 + topple * (fall ? 1.22 : 0.24),
      yaw,
      rock + hit * 0.07 + topple * (fall ? 0.20 : 1.18),
      "YXZ",
    );
    model.current.position.set(
      (attack?.x ?? 0) * remaining + (contact?.x ?? 0) * knockback + (fall?.x ?? 0) * fallSlide,
      (attack?.y ?? 0) * upright + lift + hit * (1 - topple) * 0.035 - topple * 0.06 - (1 - deathScale) * 0.07,
      (attack?.z ?? 0) * remaining + (contact?.z ?? 0) * knockback + (fall?.z ?? 0) * fallSlide,
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
