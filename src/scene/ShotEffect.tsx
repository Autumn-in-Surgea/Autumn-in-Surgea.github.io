import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { GameState, Position } from "../game/types";
import { factionForOwner } from "../nations/registry";
import { Piece, terrainHeight } from "./models";
import { MODEL_SETS } from "./factionModels";
import { clampProgress, easeInOut, easeOut } from "./motion";
import type { PresentedUnit } from "./motion";
import { incomingOffset } from "./combatMotion";
import { usePlaybackClock } from "./playbackClock";
import { unitFacingAt, unitFacingYaw } from "./unitFacing";
import { unitBoardPosition, strikeTransform } from "./unitMotion";
import type { Projectile, Strike } from "./combatMotion";

const up = new THREE.Vector3(0, 1, 0);
const titles: Record<Projectile, string> = {
  arrow: "步枪弹",
  stone: "野战炮弹",
  bolt: "弩矢",
  shell: "炮弹",
};

function Missile({ type }: { type: Projectile }) {
  if (type === "arrow") return <>
    <Piece shape="cylinder" color="#ddac60" scale={[0.043, 0.10, 0.043]} />
    <Piece shape="cone" color="#f7dfa3" position={[0, 0.08, 0]} scale={[0.043, 0.071, 0.043]} />
    <Piece shape="cone" color="#aa7041" rotation={[Math.PI, 0, 0]}
      position={[0, -0.12, 0]} scale={[0.029, 0.146, 0.029]} />
  </>;
  if (type === "stone") return <>
    <Piece shape="cylinder" color="#43535a" scale={[0.093, 0.15, 0.093]} />
    <Piece shape="cylinder" color="#bd8d4c" position={[0, -0.05, 0]} scale={[0.099, 0.027, 0.099]} />
    <Piece shape="cone" color="#8b969a" position={[0, 0.126, 0]} scale={[0.093, 0.103, 0.093]} />
  </>;
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
  return (
    <>
      <Piece
        shape="cylinder"
        color="#465a58"
        scale={[0.025, 0.37, 0.025]}
      />
      <Piece
        shape="pyramid"
        color="#e6ae64"
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
  shooter,
  offset,
  issuedAt,
  reducedMotion,
}: {
  game: GameState;
  strike: Strike;
  shooter?: PresentedUnit;
  offset: number;
  issuedAt: number;
  reducedMotion: boolean;
}) {
  const playback = usePlaybackClock();
  const missile = useRef<THREE.Group>(null);
  const burst = useRef<THREE.Group>(null);
  const muzzle = useRef<THREE.Group>(null);
  const rifle = strike.projectile === "arrow";
  const fieldGun = strike.projectile === "stone";
  const localMuzzle = shooter && (rifle || fieldGun)
    ? MODEL_SETS[factionForOwner(game.players, shooter.unit.owner).modelSet].weaponMuzzles?.[shooter.unit.type]
    : undefined;
  const launchFacing = shooter && unitFacingAt(
    shooter.turns,
    (issuedAt - shooter.cue.issuedAt) / 1000 + strike.launch,
    shooter.initialFacing,
  );
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
      const pose = strikeTransform(game, strike, strike.launch);
      if (localMuzzle && launchFacing) {
        const origin = new THREE.Vector3(...unitBoardPosition(game, strike.from, offset));
        const barrelTip = new THREE.Vector3(...localMuzzle)
          .applyEuler(new THREE.Euler(pose.pitch, unitFacingYaw[launchFacing], 0, "YXZ"));
        return origin.add(barrelTip).add(new THREE.Vector3(pose.x, pose.y, pose.z));
      }
      const origin = tilePoint(game, strike.from, offset);
      if (strike.projectile) origin.add(new THREE.Vector3(pose.x, pose.y, pose.z));
      return origin;
    }
    const [x, z] = incomingOffset(strike.id);
    // Even a garrison offset from tile center keeps the entire incoming leg on its square.
    return new THREE.Vector3(
      strike.at.x - offset + x,
      end.y + 0.72,
      strike.at.y - offset + z,
    );
  }, [game, strike, offset, end, localMuzzle, launchFacing]);
  const tangent = useMemo(() => new THREE.Vector3(), []);
  const arc = !strike.from
    ? 0.06
    : fieldGun
      ? 0.78
      : rifle
        ? 0.09
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
    if (muzzle.current) {
      const flash = (time - strike.launch) / (fieldGun ? 0.14 : 0.09);
      muzzle.current.visible = !reducedMotion && flash >= 0 && flash < 1;
      muzzle.current.scale.setScalar((fieldGun ? 1 : 0.58) * (1 - easeInOut(flash)));
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
      {strike.from && localMuzzle && <group ref={muzzle} name="land-muzzle-flash" position={start} visible={false}>
        <Piece shape="octa" color="#f1ae58" scale={[0.21, 0.15, 0.21]} />
        <Piece shape="octa" color="#fff1b8" scale={[0.11, 0.18, 0.11]} />
      </group>}
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
