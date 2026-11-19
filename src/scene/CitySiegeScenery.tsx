import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, InstancedMesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, OctahedronGeometry, IcosahedronGeometry } from "three";
import { easeOut } from "./motion";
import { usePlaybackClock } from "./playbackClock";
import { CityUnderSiege } from "./territoryMaterials";

// Two fires at street level leave the silhouette and garrison legible.
const fireSites = [[-0.29, 0.36], [0.38, -0.24]] as const;
const flameShape = new OctahedronGeometry(0.5);
const smokeShape = new IcosahedronGeometry(0.5);
const flamePaint = new MeshBasicMaterial({ toneMapped: false });
const smokePaint = new MeshStandardMaterial({
  flatShading: true, roughness: 1, transparent: true, opacity: 0.72, depthWrite: false,
});
const flameColors = ["#c24f2e", "#e58b46", "#ffcb7d"].map(color => new Color(color));
const smokeColors = ["#433b3b", "#57505a", "#696372"].map(color => new Color(color));
const flamesPerSite = 3;
const puffsPerSite = 5;
const ignoreRaycast = () => {};

function SiegeEffects({ tileId, startsAt, reducedMotion }: { tileId: number; startsAt: number; reducedMotion: boolean }) {
  const flames = useRef<InstancedMesh>(null);
  const smoke = useRef<InstancedMesh>(null);
  const particle = useMemo(() => new Object3D(), []);
  const clock = usePlaybackClock();
  const beganAt = useRef(startsAt);
  const phase = (tileId % 23) * 0.13;

  function draw(age: number) {
    const flameMesh = flames.current, smokeMesh = smoke.current;
    if (!flameMesh || !smokeMesh) return;
    const ramp = easeOut(age / 0.3);
    fireSites.forEach(([x, z], site) => {
      for (let i = 0; i < flamesPerSite; i++) {
        const sway = Math.sin(age * (13 + 2 * i) + i + phase + site);
        const width = (0.104 - i * 0.016) * ramp;
        const height = (0.24 - i * 0.035) * (1 + sway * 0.16) * ramp;
        particle.position.set(x + (i - 1) * 0.039, 0.022 + height * 0.47, z + i * 0.015);
        particle.rotation.set(0, phase + i, 0.15 * sway + (i - 1) * 0.27);
        particle.scale.set(width, height, width * 0.8);
        particle.updateMatrix();
        flameMesh.setMatrixAt(site * flamesPerSite + i, particle.matrix);
      }
      for (let i = 0; i < puffsPerSite; i++) {
        const rise = (age / 2.4 + i / puffsPerSite + phase * 0.22 + site * 0.13) % 1;
        const radius = (0.101 + 0.18 * rise) * easeOut((1 - rise) / 0.28) * ramp;
        particle.position.set(x - rise * 0.19 + Math.sin(8 * rise + i) * 0.032,
          0.13 + rise * 0.78, z + rise * 0.11);
        particle.rotation.set(rise * 2 + i, phase + i, rise + site);
        particle.scale.set(radius * 1.15, radius, radius * 0.97);
        particle.updateMatrix();
        smokeMesh.setMatrixAt(site * puffsPerSite + i, particle.matrix);
      }
    });
    flameMesh.instanceMatrix.needsUpdate = smokeMesh.instanceMatrix.needsUpdate = true;
  }

  useLayoutEffect(() => {
    for (let i = 0; i < fireSites.length * flamesPerSite; i++) flames.current?.setColorAt(i, flameColors[i % flamesPerSite]);
    for (let i = 0; i < fireSites.length * puffsPerSite; i++) smoke.current?.setColorAt(i, smokeColors[i % smokeColors.length]);
    if (flames.current?.instanceColor) flames.current.instanceColor.needsUpdate = true;
    if (smoke.current?.instanceColor) smoke.current.instanceColor.needsUpdate = true;
    draw(reducedMotion ? 1.15 : Math.max(0.045, (clock.time - beganAt.current) / 1000));
  });
  useFrame(() => {
    if (!reducedMotion) draw(Math.max(0.045, (clock.time - beganAt.current) / 1000));
  });
  return (
    <group name="city-siege">
      <instancedMesh name="siege-flames" ref={flames} args={[flameShape, flamePaint, fireSites.length * flamesPerSite]}
        frustumCulled={false} raycast={ignoreRaycast} />
      <instancedMesh name="siege-smoke" ref={smoke} args={[smokeShape, smokePaint, fireSites.length * puffsPerSite]}
        frustumCulled={false} raycast={ignoreRaycast} />
    </group>
  );
}

export function CitySiegeScenery({ startsAt, tileId, reducedMotion, children }: {
  startsAt: number | undefined;
  tileId: number;
  reducedMotion: boolean;
  children: ReactNode;
}) {
  const clock = usePlaybackClock();
  const [shownAt, setShownAt] = useState<number>();
  const active = startsAt !== undefined && (reducedMotion || shownAt === startsAt || clock.time >= startsAt);
  useFrame(() => {
    if (!active && startsAt !== undefined && clock.time >= startsAt) setShownAt(startsAt);
  }, -1);
  return <CityUnderSiege.Provider value={active}>
    {children}
    {active && <SiegeEffects tileId={tileId} startsAt={startsAt} reducedMotion={reducedMotion} />}
  </CityUnderSiege.Provider>;
}
