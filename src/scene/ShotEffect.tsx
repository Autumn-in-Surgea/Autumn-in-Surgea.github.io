import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { GameState, Position } from "../game/types";
import { Piece, terrainHeight } from "./models";
import { clampProgress, easeInOut, easeOut } from "./motion";
import { incomingOffset, sampleAttackPose } from "./combatMotion";
import { usePlaybackClock } from "./playbackClock";
import type { Projectile, Strike } from "./combatMotion";

const up = new THREE.Vector3(0, 1, 0);
const titles: Record<Projectile, string> = {
  arrow: "箭矢",
  stone: "投石",
  bolt: "弩矢",
  shell: "炮弹",
};

function Missile({ type }: { type: Projectile }) {
  if (type === "stone")
    return (
      <>
        <Piece shape="octa" color="#64594f" scale={[0.109, 0.12, 0.103]} />
        <Piece
          shape="box"
          color="#b49d77"
          position={[0.056, 0.018, 0.036]}
          scale={[0.052, 0.11, 0.044]}
        />
      </>
    );
  if (type === "shell")
    return (
      <>
        <Piece shape="sphere" color="#3b4954" scale={[0.093, 0.13, 0.093]} />
        <Piece
          shape="cylinder"
          color="#e2aa57"
          position={[0, -0.035, 0]}
          scale={[0.094, 0.045, 0.094]}
        />
        <Piece
          shape="cone"
          color="#f6c278"
          rotation={[Math.PI, 0, 0]}
          position={[0, -0.15, 0]}
          scale={[0.051, 0.17, 0.051]}
        />
      </>
    );
  const bolt = type === "bolt";
  return (
    <>
      <Piece
        shape="cylinder"
        color={bolt ? "#465a58" : "#805637"}
        scale={[bolt ? 0.025 : 0.017, 0.37, bolt ? 0.025 : 0.017]}
      />
      <Piece
        shape="pyramid"
        color={bolt ? "#e6ae64" : "#536672"}
        position={[0, 0.22, 0]}
        scale={[0.055, 0.14, 0.055]}
      />
      <Piece
        color="#fbecd0"
        position={[0, -0.15, 0]}
        scale={[0.096, 0.103, 0.018]}
      />
      <Piece
        color="#ac684d"
        position={[0, -0.15, 0]}
        scale={[0.018, 0.103, 0.096]}
      />
    </>
  );
}

function tilePoint(game: GameState, at: Position, offset: number) {
  const tile = game.tiles[at.y * game.options.size + at.x];
  const side = tile.cityId ? 0.24 : 0;
  return new THREE.Vector3(
    at.x - offset + side,
    terrainHeight(tile) + 0.48,
    at.y - offset + side,
  );
}

/** Draws only the approved leg of a shot; aim the mesh along the tangent of its arc. */
export function ShotEffect({
  game,
  strike,
  offset,
  issuedAt,
  reducedMotion,
}: {
  game: GameState;
  strike: Strike;
  offset: number;
  issuedAt: number;
  reducedMotion: boolean;
}) {
  const playback = usePlaybackClock();
  const missile = useRef<THREE.Group>(null);
  const burst = useRef<THREE.Group>(null);
  const end = useMemo(() => {
    const point = tilePoint(game, strike.at, offset);
    if (strike.contact) {
      point.x -= strike.contact.x * strike.contact.targetReach;
      point.z -= strike.contact.z * strike.contact.targetReach;
      point.y -= 0.20;
    }
    return point;
  }, [game.tiles, strike, offset]);
  const start = useMemo(() => {
    if (strike.from) {
      const origin = tilePoint(game, strike.from, offset);
      if (strike.projectile) {
        const pose = sampleAttackPose(strike, strike.launch);
        const dx = strike.at.x - strike.from.x, dz = strike.at.y - strike.from.y;
        const distance = Math.hypot(dx, dz) || 1;
        origin.x += dx * pose.travel / distance;
        origin.z += dz * pose.travel / distance;
        origin.y += pose.lift;
      }
      return origin;
    }
    const [x, z] = incomingOffset(strike.id);
    // Even a garrison offset from tile center keeps the entire incoming leg on its square.
    return new THREE.Vector3(
      strike.at.x - offset + x,
      end.y + 0.72,
      strike.at.y - offset + z,
    );
  }, [game.tiles, strike, offset, end]);
  const tangent = useMemo(() => new THREE.Vector3(), []);
  const arc = !strike.from
    ? 0.06
    : strike.projectile === "stone"
      ? 1.15
      : strike.projectile === "shell"
        ? 0.64
        : 0.34;
  useFrame(() => {
    const time = (playback.time - issuedAt) / 1000;
    const progress = clampProgress(
      (time - strike.launch) / (strike.impact - strike.launch),
    );
    const t = progress * 0.72 + easeInOut(progress) * 0.28;
    if (missile.current) {
      missile.current.visible =
        !reducedMotion && time >= strike.launch && time < strike.impact;
      missile.current.position.lerpVectors(start, end, t);
      missile.current.position.y += 4 * arc * t * (1 - t);
      tangent.subVectors(end, start);
      tangent.y += 4 * arc * (1 - 2 * t);
      missile.current.quaternion.setFromUnitVectors(up, tangent.normalize());
    }
    if (!burst.current) return;
    const p = clampProgress(
      (time - (reducedMotion ? 0 : strike.impact)) / 0.29,
    );
    burst.current.visible = !reducedMotion && p > 0 && p < 1;
    burst.current.scale.setScalar(
      easeOut(p / 0.18) * (1 - easeInOut((p - 0.18) / 0.82)) *
        (strike.projectile === "shell" || strike.splashWeapon === "shell"
          ? 1.3
          : 0.85),
    );
    burst.current.rotation.y = easeOut(p) * 0.42;
  });
  return (
    <>
      {strike.projectile && (
        <group ref={missile} visible={false} name={titles[strike.projectile]}>
          <Missile type={strike.projectile} />
        </group>
      )}
      <group ref={burst} visible={false} position={end}>
        {[0, 1, 2, 3].map((i) => (
          <group key={i} rotation={[0, (i * Math.PI) / 2 + 0.3, 0]}>
            <Piece
              shape="pyramid"
              color={i % 2 ? "#fff0b5" : "#d49456"}
              position={[0.11, 0.047, 0]}
              rotation={[0, 0, -0.9]}
              scale={[0.033, 0.15, 0.033]}
            />
          </group>
        ))}
      </group>
    </>
  );
}
export const projectileName = (kind?: Projectile) => (kind ? titles[kind] : "");
