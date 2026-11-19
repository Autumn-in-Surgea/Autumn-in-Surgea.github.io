import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
  DoubleSide, Object3D, OctahedronGeometry, RingGeometry, Vector3,
  type BufferGeometry, type Group, type InstancedMesh, type Mesh, type MeshBasicMaterial,
} from "three";
import type { GameState, PopulationGain } from "../game/types";
import { getPopulationFlights } from "../store/populationPlayback";
import { miniatureMaterial } from "./miniature";
import { usePlaybackClock } from "./playbackClock";
import { populationFlightAsset } from "./populationFlightAssets";
import { flightTiming, samplePopulationFlight } from "./populationFlightMotion";
import { terrainCapOffset, terrainHeight } from "./terrainElevation";

const gleamColor = "#f4d88a";
const ringGeometry = new RingGeometry(0.91, 1, 32);
const sparkGeometry = new OctahedronGeometry(1);
const ignoreRaycast = () => {};

interface FlightCue {
  id: number;
  startedAt: number;
  from: Vector3;
  to: Vector3;
  center: Vector3;
  duration: number;
  arc: number;
  geometry: BufferGeometry;
  gain: PopulationGain;
}

function makeCue(
  game: GameState, gain: PopulationGain, offset: number, index: number, clock: number, id: number,
): FlightCue {
  const source = game.tiles[gain.source.tileId], city = game.tiles[gain.cityTileId];
  const level = game.cities.find(item => item.id === gain.cityId)?.level ?? 1;
  const { launch, flight, distance } = flightTiming(game, gain, index);
  const geometry = populationFlightAsset(gain.source, source);
  const center = geometry.boundingBox!.getCenter(new Vector3());
  const from = new Vector3(
    source.x - offset + center.x,
    terrainHeight(source) + terrainCapOffset + center.y,
    source.y - offset + center.z,
  );
  // City rewards start at the near side of their own square and spring into the roofline.
  if (source.id === city.id) from.add(new Vector3(0.28, 0.08, 0.25));
  const to = new Vector3(
    city.x - offset + 0.08,
    terrainHeight(city) + terrainCapOffset + 0.15 + Math.min(0.68, level * 0.108),
    city.y - offset + 0.06,
  );
  return {
    id, startedAt: clock + launch * 1000, from, to, center, duration: flight,
    arc: 0.35 + Math.min(1.04, Math.sqrt(distance) * 0.17), geometry, gain,
  };
}

function PopulationFlight({ cue, onDone }: { cue: FlightCue; onDone: (id: number) => void }) {
  const clock = usePlaybackClock();
  const body = useRef<Group>(null), glint = useRef<Group>(null);
  const ring = useRef<Mesh<RingGeometry, MeshBasicMaterial>>(null);
  const sparks = useRef<InstancedMesh<OctahedronGeometry, MeshBasicMaterial>>(null);
  const finished = useRef(false);
  const spark = useMemo(() => new Object3D(), []);
  const sparkCount = Math.min(8, 5 + cue.gain.amount);
  const { gain, from, to, center, duration, arc, geometry } = cue;
  useFrame(() => {
    if (!body.current || !glint.current || !ring.current || !sparks.current || finished.current) return;
    const elapsed = (clock.time - cue.startedAt) / 1000;
    if (elapsed < 0) return;
    const pose = samplePopulationFlight(elapsed, duration, arc);
    body.current.visible = pose.travel < 1;
    body.current.position.lerpVectors(from, to, pose.travel);
    body.current.position.y += pose.lift;
    body.current.scale.set(pose.width, pose.height, pose.width);
    body.current.rotation.set(-Math.sin(pose.travel * Math.PI) * 0.29, pose.turn, Math.sin(pose.travel * Math.PI) * 0.22);

    glint.current.visible = pose.glint > 0 && !pose.done;
    if (glint.current.visible) {
      const radius = 0.12 + pose.glint * 0.33;
      ring.current.scale.setScalar(radius);
      ring.current.material.opacity = (1 - pose.glint) * 0.56;
      sparks.current.material.opacity = (1 - pose.glint) * 0.92;
      for (let index = 0; index < sparkCount; index++) {
        const angle = index * (Math.PI * 2 / sparkCount) + gain.cityTileId * 0.41;
        const distance = radius * (0.58 + (index % 3) * 0.18);
        spark.position.set(Math.cos(angle) * distance, 0.018 + Math.sin(pose.glint * Math.PI) * (0.12 + index * 0.012),
          Math.sin(angle) * distance);
        spark.rotation.set(0.25 + index, angle, pose.glint * 2);
        spark.scale.set(0.018, 0.029, 0.018).multiplyScalar(1 - pose.glint * 0.75);
        spark.updateMatrix();
        sparks.current.setMatrixAt(index, spark.matrix);
      }
      sparks.current.instanceMatrix.needsUpdate = true;
    }
    if (pose.done) {
      finished.current = true;
      onDone(cue.id);
    }
  });

  return <group name="population-flight" userData={gain}>
    <group ref={body} visible={false}>
      <mesh name="population-flight-token" geometry={geometry} material={miniatureMaterial}
        position={[-center.x, -center.y, -center.z]} raycast={ignoreRaycast} dispose={null} />
    </group>
    <group ref={glint} position={to} visible={false}>
      <mesh name="population-flight-landing" ref={ring} geometry={ringGeometry}
        rotation={[-Math.PI / 2, 0, 0]} raycast={ignoreRaycast}>
        <meshBasicMaterial color={gleamColor} transparent opacity={0} depthWrite={false} side={DoubleSide} />
      </mesh>
      <instancedMesh ref={sparks} args={[sparkGeometry, undefined, sparkCount]}
        frustumCulled={false} raycast={ignoreRaycast}>
        <meshBasicMaterial color={gleamColor} transparent opacity={0} depthWrite={false} />
      </instancedMesh>
    </group>
  </group>;
}

/** The queue follows snapshots, not UI selection or the command lock. */
export function PopulationFlights({ game, offset, reducedMotion }: {
  game: GameState;
  offset: number;
  reducedMotion: boolean;
}) {
  const clock = usePlaybackClock();
  const last = useRef<GameState | null>(null);
  const id = useRef(0);
  const [cues, setCues] = useState<FlightCue[]>([]);
  useLayoutEffect(() => {
    if (reducedMotion) {
      last.current = game;
      setCues(active => active.length ? [] : active);
    } else if (last.current !== game) {
      last.current = game;
      const incoming = getPopulationFlights(game).map((gain, index) =>
        makeCue(game, gain, offset, index, clock.time, ++id.current));
      if (incoming.length) setCues(active => [...active, ...incoming]);
    }
  }, [game, offset, reducedMotion, clock]);
  const done = useCallback((finished: number) => setCues(active => active.filter(cue => cue.id !== finished)), []);
  return <group name="population-flights">
    {!reducedMotion && cues.map(cue => <PopulationFlight key={cue.id} cue={cue} onDone={done} />)}
  </group>;
}
