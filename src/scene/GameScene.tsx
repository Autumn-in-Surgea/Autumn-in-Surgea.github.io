import {
  Component,
  createContext,
  useContext,
  Suspense,
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode, Ref } from "react";
import { Canvas, events, useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { factionForOwner } from "../factions/registry";
import type { ModelSetId } from "../factions/registry";
import { colorForOwner, MODEL_SETS } from "./factionModels";
import { SceneQuality } from "./SceneQuality";
import { knownTerrainHeight, terrainCapOffset } from "./terrainElevation";
import { TerrainInlays } from "./TerrainInlays";
import { TerritoryBorders } from "./TerritoryBorders";
import { TileScenery } from "./TileScenery";
import { buildTileTiers, type StructureChange } from "../store/structurePlayback";
import { BoardFrame, tileCap, tilePlinth } from "./BoardFrame";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { City, GameEvent, GameState, Tile } from "../game/types";
import { getUnitsWithAvailableActions, UNITS } from "../game";
import { PlaybackContext, useBoardClock, usePlaybackClock } from "./playbackClock";
import { ShotEffect, projectileName } from "./ShotEffect";
import { carryStrikes, collapseDuration, hitFeedbackDuration, planEncounter } from "./combatMotion";
import type { CombatFrame, Strike } from "./combatMotion";
import { usePresentedUnits, useUnitMotion } from "./unitMotion";
import { getMapBadges, MapBadgeButtons, MapBadgePositions } from "./ActionBadges";
import type { MapBadgesProps, OpenBadge } from "./ActionBadges";
import { easeInOut, easeOut, getFreshEvents } from "./motion";
import type { PresentedUnit } from "./motion";
import { LAND_UNIT_RENDER_ORDER } from "./unitModels";
import { SelectionHalo, SquareOutline } from "./boardHighlights";
import { ForeignTerritory, foreignTerritoryBrightness, isForeignTerritory } from "./territoryMaterials";
import { terrainColors } from "./terrainColors";
import { ACTION_GAP_MS, type PlaybackStep } from "../store/actionPlayback";

import {
  geometry,
  material,
  Piece,
  WorldModelLibrary,
  terrainHeight,
  UnitModel,
} from "./models";

export interface GameSceneProps {
  game: GameState;
  selectedTile: number | null;
  selectedUnit: string | null;
  reachable: number[];
  attackTargets: string[];
  focusedTarget?: string | null;
  onTileClick: (id: number) => void;
  onActionBadge?: OpenBadge;
  onResultReady?: () => void;
  playbackStep?: PlaybackStep | null;
  attachPlayback?: () => () => void;
  onPlaybackDone?: (id: number) => void;
  resetKey: number;
  reducedMotion?: boolean;
  preview?: boolean;
}

const mapCameraOffset = new THREE.Vector3(13, 17, 13);
const mapViewAngles = new THREE.Spherical().setFromVector3(mapCameraOffset);

function CameraRig({
  game,
  resetKey,
  preview,
  selectedTile,
  playbackStep,
  reducedMotion,
}: Pick<
  GameSceneProps,
  "game" | "resetKey" | "preview" | "selectedTile" | "playbackStep" | "reducedMotion"
>) {
  const { camera, gl, size } = useThree();
  const cameraControls = useRef<OrbitControls | null>(null);
  const seed = game.options.seed;
  const n = game.options.size;
  const focus =
    game.cities.find((city) => city.capitalOf === 0) ?? game.cities[0];
  const automaticPan = useRef<{
    from: THREE.Vector3;
    to: THREE.Vector3;
    elapsed: number;
    duration: number;
  } | null>(null);
  const panStep = useRef(new THREE.Vector3());
  useLayoutEffect(() => {
    // Binding in render leaks listeners when React discards a render.
    const controls = new OrbitControls(camera);
    cameraControls.current = controls;
    controls.enableRotate = false;
    controls.minPolarAngle = controls.maxPolarAngle = mapViewAngles.phi;
    controls.minAzimuthAngle = controls.maxAzimuthAngle = mapViewAngles.theta;
    controls.enableDamping = true;
    controls.dampingFactor = 0.14;
    controls.screenSpacePanning = true;
    controls.panSpeed = 0.85;
    controls.zoomSpeed = 0.85;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
    controls.minZoom = Math.max(5, 180 / n);
    controls.maxZoom = 150;
    const cancelAutomaticPan = () => {
      automaticPan.current = null;
    };
    const choosePanAction = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      // OrbitControls swaps the rotate and pan bindings when a modifier is held.
      const action = event.ctrlKey || event.metaKey || event.shiftKey
        ? THREE.MOUSE.ROTATE
        : THREE.MOUSE.PAN;
      controls.mouseButtons.LEFT = controls.mouseButtons.RIGHT = action;
    };
    const canvas = gl.domElement;
    canvas.addEventListener("pointerdown", choosePanAction, true);
    controls.addEventListener("start", cancelAutomaticPan);
    controls.connect(canvas);
    return () => {
      canvas.removeEventListener("pointerdown", choosePanAction, true);
      controls.removeEventListener("start", cancelAutomaticPan);
      controls.dispose();
      cameraControls.current = null;
    };
  }, [camera, gl, n]);
  useLayoutEffect(() => {
    const controls = cameraControls.current;
    if (!controls) return;
    const offset = (n - 1) / 2;
    const x = preview ? 0 : (focus?.x ?? offset) - offset;
    const z = preview ? 0 : (focus?.y ?? offset) - offset;
    automaticPan.current = null;
    // Consume any damped drag before resetting, so momentum cannot shift the new view.
    const damped = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = damped;
    controls.target.set(x, 0, z);
    camera.position.copy(controls.target).add(mapCameraOffset);
    camera.zoom = preview
      ? Math.min(size.width / (n * 1.5), size.height / (n * 1.13))
      : Math.max(31, Math.min(size.width / 13, size.height / 9));
    camera.updateProjectionMatrix();
    controls.update();
    camera.updateMatrixWorld();
    // A new seed or explicit reset reframes the map; actions preserve the user's camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, n, resetKey, preview, camera, gl]);
  useEffect(() => {
    camera.updateProjectionMatrix();
  }, [size, camera]);
  useLayoutEffect(() => {
    const tileId = playbackStep?.focusTile;
    const controls = cameraControls.current;
    if (tileId == null || !controls) return;
    const offset = (n - 1) / 2;
    const point = new THREE.Vector3(tileId % n - offset, 0, Math.floor(tileId / n) - offset);
    camera.updateMatrixWorld();
    const projected = panStep.current.copy(point).project(camera);
    if (Math.abs(projected.x) <= 0.76 && Math.abs(projected.y) <= 0.72) return;
    automaticPan.current = null;
    camera.position.add(point).sub(controls.target);
    controls.target.copy(point);
    controls.update();
    camera.updateMatrixWorld();
  }, [camera, n, playbackStep]);
  useEffect(() => {
    const controls = cameraControls.current;
    if (!controls) return;
    controls.enableDamping = !reducedMotion;
    controls.update();
  }, [camera, gl, n, reducedMotion]);
  useEffect(() => {
    automaticPan.current = null;
    const controls = cameraControls.current;
    if (preview || selectedTile === null || !controls) return;
    const offset = (n - 1) / 2;
    const point = new THREE.Vector3(
      (selectedTile % n) - offset,
      0.15,
      Math.floor(selectedTile / n) - offset,
    );
    camera.updateMatrixWorld();
    const projected = panStep.current.copy(point).project(camera);
    // Reframe tiles near the edge of the board viewport when selected.
    if (
      Math.abs(projected.x) > 0.84 ||
      Math.abs(projected.y) > 0.78
    ) {
      point.y = 0;
      const from = controls.target.clone();
      automaticPan.current = {
        from,
        to: point,
        elapsed: 0,
        duration: Math.min(0.55, 0.29 + from.distanceTo(point) * 0.035),
      };
    }
  }, [selectedTile, preview, n, camera]);
  useFrame((_, delta) => {
    const controls = cameraControls.current;
    if (!controls) return;
    const step = Math.min(delta, 0.05);
    const pan = automaticPan.current;
    if (pan) {
      pan.elapsed = reducedMotion ? pan.duration : Math.min(pan.duration, pan.elapsed + step);
      const progress = pan.elapsed / pan.duration;
      panStep.current.lerpVectors(pan.from, pan.to, easeInOut(progress));
      camera.position.add(panStep.current).sub(controls.target);
      controls.target.copy(panStep.current);
      if (progress === 1) automaticPan.current = null;
    }
    // Match the same decay at different refresh rates.
    controls.dampingFactor = 1 - Math.pow(0.86, step * 60);
    controls.update();
    const bound = n * 0.7;
    const x = THREE.MathUtils.clamp(controls.target.x, -bound, bound);
    const z = THREE.MathUtils.clamp(controls.target.z, -bound, bound);
    const dy =
      THREE.MathUtils.clamp(controls.target.y, -3, 3) - controls.target.y;
    camera.position.x += x - controls.target.x;
    camera.position.y += dy;
    camera.position.z += z - controls.target.z;
    controls.target.set(x, controls.target.y + dy, z);
    camera.updateMatrixWorld();
  });
  return null;
}

const defaultLabelStyle = {
  font: '"PingFang SC", "Microsoft YaHei", sans-serif',
  size: 14,
};
const MapLabelStyle = createContext(defaultLabelStyle);
type LabelKind = "city" | "health" | "feedback";
const labelOrder: Record<LabelKind, number> = { city: 9, health: 10, feedback: 11 };
// Board labels are painted at this texture resolution per world-space tile.
const labelPixelsPerTile = 280;
const labelFontSize = { city: 44, health: 68 };

function createLabel(
  text: string,
  foreground: string,
  kind: LabelKind,
  style: typeof defaultLabelStyle,
) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const size = kind === "feedback" ? style.size * 2 : labelFontSize[kind];
  const weight = kind === "health" ? 700 : 600;
  const font = `${weight} ${size}px ${style.font}`;
  ctx.font = font;
  const metrics = ctx.measureText(text);
  const padding = kind === "city" ? 26 : 18;
  canvas.width = Math.ceil(metrics.width) + padding;
  canvas.height = size + 16;
  if (kind !== "health") {
    ctx.fillStyle = kind === "city" ? "rgba(31, 47, 47, 0.48)" : "#f5f0e3f2";
    ctx.beginPath();
    ctx.roundRect(1, 1, canvas.width - 2, canvas.height - 2, 11);
    ctx.fill();
  }
  ctx.font = font;
  ctx.textAlign = "center";
  const x = canvas.width / 2;
  const y = (canvas.height + metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
  if (kind === "health") {
    ctx.lineJoin = "round";
    ctx.lineWidth = 12;
    ctx.strokeStyle = "#182523";
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = foreground;
  ctx.fillText(text, x, y);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function Label({
  text,
  color,
  kind,
  position,
  opacity = 1,
  materialRef,
}: {
  text: string;
  color: string;
  kind: LabelKind;
  position: [number, number, number];
  opacity?: number;
  materialRef?: Ref<THREE.SpriteMaterial>;
}) {
  const style = useContext(MapLabelStyle);
  const texture = useMemo(
    () => createLabel(text, color, kind, style),
    [text, color, kind, style],
  );
  useEffect(() => () => texture.dispose(), [texture]);
  const pixelsPerUnit = kind === "feedback" ? 2 : labelPixelsPerTile;
  return (
    <sprite
      position={position}
      center={kind === "city" ? [0.5, 1] : [0.5, 0.5]}
      scale={[texture.image.width / pixelsPerUnit, texture.image.height / pixelsPerUnit, 1]}
      renderOrder={labelOrder[kind]}
    >
      <spriteMaterial
        ref={materialRef}
        map={texture}
        transparent
        toneMapped={false}
        depthWrite={false}
        depthTest={false}
        opacity={opacity}
      />
    </sprite>
  );
}

// Small instanced patches let Three cull offscreen squares on the 64×64 board.
// Each patch needs two draws regardless of the number of squares it contains.
function BoardTiles({ game, ...props }: {
  game: GameState;
  explored: Set<number>;
  visible: Set<number>;
  offset: number;
  onClick: (id: number) => void;
  onHover: (id: number | null) => void;
}) {
  const size = game.options.size;
  const patches = useMemo(() => {
    const span = size <= 24 ? size : 8;
    const across = Math.ceil(size / span);
    const groups = Array.from({ length: across * across }, () => [] as Tile[]);
    for (const tile of game.tiles) {
      groups[Math.floor(tile.y / span) * across + Math.floor(tile.x / span)].push(tile);
    }
    return groups;
  }, [game.tiles, size]);
  return <>{patches.map((tiles) => <BoardPatch key={tiles[0].id} tiles={tiles} {...props} />)}</>;
}

function BoardPatch({ tiles, explored, visible, offset, onClick, onHover }: {
  tiles: Tile[];
  explored: Set<number>;
  visible: Set<number>;
  offset: number;
  onClick: (id: number) => void;
  onHover: (id: number | null) => void;
}) {
  const baseRef = useRef<THREE.InstancedMesh>(null);
  const topRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!baseRef.current || !topRef.current) return;
    const transform = new THREE.Object3D();
    const color = new THREE.Color();
    tiles.forEach((tile, i) => {
      const known = explored.has(tile.id);
      const surface = knownTerrainHeight(tile, known);
      const brightness = visible.has(tile.id) && isForeignTerritory(tile.owner) ? foreignTerritoryBrightness : 1;
      transform.position.set(
        tile.x - offset,
        (surface - 0.33) / 2,
        tile.y - offset,
      );
      transform.scale.set(0.984, surface + 0.30, 0.984);
      transform.updateMatrix();
      baseRef.current!.setMatrixAt(i, transform.matrix);
      baseRef.current!.setColorAt(i, color.set(known ? "#907e65" : "#798681").multiplyScalar(brightness));
      transform.position.y = surface;
      transform.scale.set(1, 1, 1);
      transform.updateMatrix();
      topRef.current!.setMatrixAt(i, transform.matrix);
      const surfaceColor = known ? terrainColors[tile.terrain] : "#a2aca5";
      topRef.current!.setColorAt(i, color.set(surfaceColor).multiplyScalar(brightness));
    });
    for (const mesh of [baseRef.current, topRef.current]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [tiles, explored, visible, offset]);
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta < 6 && e.instanceId !== undefined)
      onClick(tiles[e.instanceId].id);
  };
  const hover = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.instanceId !== undefined) onHover(tiles[e.instanceId].id);
    glCursor("pointer");
  };
  return (
    <>
      <instancedMesh
        ref={baseRef}
        args={[tilePlinth, material("#ffffff"), tiles.length]}
        receiveShadow
        dispose={null}
        onClick={click}
        onPointerMove={hover}
        onPointerOut={() => onHover(null)}
      />
      <instancedMesh
        ref={topRef}
        args={[tileCap, material("#ffffff"), tiles.length]}
        receiveShadow
        dispose={null}
        onClick={click}
        onPointerMove={hover}
        onPointerOut={() => {
          onHover(null);
          glCursor("grab");
        }}
      />
    </>
  );
}

const TileView = memo(function TileView({
  tile,
  game,
  knownTiles,
  visible,
  selected,
  reachable,
  targeted,
  onClick,
  offset,
  simple,
  reducedMotion,
  showCityNames,
  showHarvestHints,
  city,
  tier,
  change,
  issuedAt,
  hovered,
  onHover,
}: {
  tile: Tile;
  game: GameState;
  knownTiles: ReadonlySet<number>;
  visible: boolean;
  selected: boolean;
  reachable: boolean;
  targeted: boolean;
  onClick: (id: number) => void;
  offset: number;
  simple: boolean;
  reducedMotion: boolean;
  showCityNames: boolean;
  showHarvestHints: boolean;
  city?: City;
  tier: number;
  change?: StructureChange;
  issuedAt: number;
  hovered: boolean;
  onHover: (id: number | null) => void;
}) {
  const explored = knownTiles.has(tile.id);
  const surface = knownTerrainHeight(tile, explored);
  const cityLabelOffset = city && city.owner !== null && city.level >= 5 ? 0.49 : 0.42;
  const click = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (event.delta < 6) onClick(tile.id);
  };
  const enter = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onHover(tile.id);
    glCursor("pointer");
  };
  const leave = () => {
    onHover(null);
    glCursor("grab");
  };
  return (
    <group
      position={[tile.x - offset, 0, tile.y - offset]}
      onClick={click}
      onPointerOver={enter}
      onPointerOut={leave}
    >
      {explored && (
        <group position={[0, surface + terrainCapOffset, 0]}>
          <ForeignTerritory.Provider value={visible && isForeignTerritory(tile.owner)}>
            <TileScenery
              game={game}
              tile={tile}
              city={city}
              tier={tier}
              knownTiles={knownTiles}
              visible={visible}
              simple={simple}
              showHarvestHints={showHarvestHints}
              change={change}
              issuedAt={issuedAt}
              surfaceY={surface + terrainCapOffset}
              reducedMotion={reducedMotion}
            />
          </ForeignTerritory.Provider>
          {!visible && (
            <Piece
              position={[0, 0.017, 0]}
              scale={[0.989, 0.04, 0.989]}
              color="#515c57"
              opacity={0.25}
            />
          )}
          {showCityNames && city?.name && (
            <Label
              kind="city"
              text={city.name}
              color="#e3decb"
              opacity={visible ? 1 : 0.8}
              // Equal x/z offsets put the top of the plate at the screen-facing corner.
              position={[cityLabelOffset, 0.015, cityLabelOffset]}
            />
          )}
        </group>
      )}
      {reachable && !selected && (
        <>
          <Piece
            position={[0, surface + 0.038, 0]}
            scale={[0.86, 0.012, 0.86]}
            color="#7fa58b"
            opacity={0.24}
          />
          <Piece
            shape="disc"
            position={[0, surface + 0.055, 0]}
            scale={[0.075, 0.018, 0.075]}
            color="#376954"
          />
          {!hovered && <SquareOutline kind="reachable" height={surface + 0.053} />}
        </>
      )}
      {(selected || targeted || hovered) && (
        <SquareOutline
          kind={targeted ? "target" : selected ? "selection" : "hover"}
          height={surface + 0.06}
        />
      )}
    </group>
  );
});

function glCursor(cursor: string) {
  const canvas = document.querySelector(
    ".game-scene canvas",
  ) as HTMLCanvasElement | null;
  if (canvas) canvas.style.cursor = cursor;
}

// The panel reads the resolved rules immediately. On the board the HP number
// changes on contact, even when several AI hits arrived in a single snapshot.
function UnitHealth({ record, reducedMotion, modelSet }: { record: PresentedUnit; reducedMotion: boolean; modelSet: ModelSetId }) {
  const { unit, cue } = record;
  const playback = usePlaybackClock();
  const hits = cue.impacts;
  const [phase, setPhase] = useState({ serial: cue.serial, landed: 0 });
  const previousPhase = useRef(phase);
  useFrame(() => {
    if (reducedMotion || !hits?.length) return;
    const elapsed = (playback.time - cue.issuedAt) / 1000;
    let landed = 0;
    while (landed < hits.length && hits[landed].impact <= elapsed) landed++;
    if (previousPhase.current.serial === cue.serial && previousPhase.current.landed === landed) return;
    previousPhase.current = { serial: cue.serial, landed };
    setPhase(previousPhase.current);
  });
  const landed = phase.serial === cue.serial ? phase.landed : 0;
  let hp = unit.hp;
  if (hits?.length && !reducedMotion) {
    const pending = hits.slice(landed);
    if (cue.dying) {
      if (landed >= hits.length) return null;
      hp = Math.max(1, (cue.initialHp ?? hp) - hits.slice(0, landed).reduce((sum, hit) => sum + hit.damage, 0));
    } else {
      hp = Math.min(unit.maxHp, hp + pending.reduce((sum, hit) => sum + hit.damage, 0));
    }
  } else if (cue.dying) return null;
  return (
    <Label
      kind="health"
      text={String(hp)}
      color={hp <= unit.maxHp * 0.4 ? "#ffc6ae" : "#fff9e8"}
      position={[0, MODEL_SETS[modelSet].labelHeight(unit.type), 0]}
    />
  );
}

function AnimatedUnit({
  record,
  game,
  offset,
  selected,
  targeted,
  actionsSpent,
  onClick,
  reducedMotion,
  onFinish,
}: {
  record: PresentedUnit;
  game: GameState;
  offset: number;
  selected: boolean;
  targeted: boolean;
  actionsSpent: boolean;
  onClick: (id: number) => void;
  reducedMotion: boolean;
  onFinish: (id: string, serial: number) => void;
}) {
  const { unit, cue } = record;
  const { root, model, label, initial } = useUnitMotion(
    record,
    game,
    offset,
    reducedMotion,
    onFinish,
  );
  const tile = game.tiles[unit.y * game.options.size + unit.x];
  const color = colorForOwner(game.players, unit.owner);
  const { modelSet } = factionForOwner(game.players, unit.owner);
  return (
    <group
      ref={root}
      position={initial}
      onClick={(event) => {
        event.stopPropagation();
        if (event.delta < 6) onClick(tile.id);
      }}
    >
      {(selected || targeted) && !cue.dying && (
        <SelectionHalo kind={targeted ? "target" : "selection"} reducedMotion={reducedMotion} />
      )}
      <group ref={model}>
        <UnitModel
          getGeometry={MODEL_SETS[modelSet].unit}
          type={unit.type}
          color={color}
          actionsSpent={actionsSpent}
          foreignTerritory={isForeignTerritory(tile.owner)}
          foreground={!UNITS[unit.type].skills.includes("water")}
        />
      </group>
      <group ref={label}>
        <UnitHealth record={record} reducedMotion={reducedMotion} modelSet={modelSet} />
      </group>
      {!cue.dying && unit.owner === 0 && !actionsSpent && (
        <Piece
          shape="sphere"
          position={[0.24, 0.06, 0.12]}
          scale={[0.035, 0.035, 0.035]}
          color="#fff4c6"
        />
      )}
    </group>
  );
}

type SceneEffect = GameEvent & {
  strike?: Strike;
  issuedAt?: number;
  feedback?: "build" | "harvest" | "road" | "terrain";
};

function tileFeedbackFor(old: Tile, tile: Tile): SceneEffect["feedback"] {
  if (old.building !== tile.building && tile.building) return "build";
  if (!old.road && tile.road) return "road";
  if (old.terrain !== tile.terrain) return "terrain";
  if (old.resource && !tile.resource && !tile.building) return "harvest";
}

function EventEffect({
  event,
  offset,
  height,
  onDone,
  reducedMotion,
}: {
  event: SceneEffect;
  offset: number;
  height: number;
  onDone: () => void;
  reducedMotion: boolean;
}) {
  const playback = usePlaybackClock();
  const label = useRef<THREE.Group>(null);
  const ink = useRef<THREE.SpriteMaterial>(null);
  const ring = useRef<THREE.Mesh>(null);
  const start = useRef(playback.time);
  const done = useRef(false);
  const at = event.at!;
  const accent =
    event.type === "attack"
      ? "#914c3e"
      : event.type === "capture" || event.type === "upgrade"
        ? "#b59a55"
        : "#4d7162";
  const ringMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [accent],
  );
  useEffect(() => () => ringMaterial.dispose(), [ringMaterial]);
  const duration = reducedMotion ? 0.65 : event.strike ? hitFeedbackDuration : event.feedback ? 0.85 : 1.05;
  useFrame(({ camera, size }) => {
    const elapsed = event.strike && event.issuedAt !== undefined
      ? (playback.time - event.issuedAt) / 1000 - (reducedMotion ? 0 : event.strike.impact)
      : (playback.time - start.current) / 1000;
    if (ring.current) ring.current.visible = elapsed >= 0;
    if (label.current) label.current.visible = elapsed >= 0;
    if (elapsed < 0) return;
    const progress = Math.min(1, elapsed / duration);
    const arrival = easeOut(elapsed / 0.11);
    if (ink.current) {
      ink.current.opacity = reducedMotion
        ? 1
        : arrival * (1 - easeInOut((progress - 0.58) / 0.42));
    }
    if (label.current) {
      label.current.position.y = reducedMotion
        ? 0.82
        : 0.65 + easeOut(progress) * 0.42;
      const animationScale = reducedMotion ? 1 : 0.86 + arrival * 0.14;
      // Transient feedback uses screen pixels inside this animated group.
      if (camera instanceof THREE.OrthographicCamera) {
        const worldPerPixel = (camera.top - camera.bottom) / (camera.zoom * size.height);
        label.current.scale.setScalar(animationScale * worldPerPixel);
      }
    }
    if (ring.current)
      ring.current.scale.setScalar(
        reducedMotion ? 1 : 0.72 + easeOut(progress) * 1.28,
      );
    ringMaterial.opacity = (1 - easeInOut(progress)) * (reducedMotion ? 0.4 : 0.7);
    if (progress === 1 && !done.current) {
      done.current = true;
      onDone();
    }
  });
  const text =
    event.type === "attack"
      ? [(!event.strike?.from || reducedMotion) && projectileName(event.strike?.projectile ?? event.strike?.splashWeapon), `−${event.damage ?? ""}`].filter(Boolean).join(" ")
      : event.type === "upgrade"
        ? "城市升级 ↑"
        : event.type === "capture"
          ? "已占领"
          : event.feedback === "build"
            ? "建成"
            : event.feedback === "harvest"
              ? "已采集"
              : event.feedback === "road"
                ? "道路连通"
                : "地形改变";
  return (
    <group position={[at.x - offset, height + 0.04, at.y - offset]}>
      <mesh
        ref={ring}
        geometry={geometry.ring}
        material={ringMaterial}
        visible={false}
        rotation={[-Math.PI / 2, 0, 0]}
        dispose={null}
      />
      <group ref={label} position={[0, 0.8, 0]} visible={false}>
        <Label
          kind="feedback"
          text={text}
          position={[0, 0, 0]}
          color={accent}
          materialRef={ink}
        />
      </group>
    </group>
  );
}

function FogReveal({
  game,
  explored,
  offset,
  reducedMotion,
}: {
  game: GameState;
  explored: Set<number>;
  offset: number;
  reducedMotion: boolean;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const previous = useRef(explored);
  const playback = usePlaybackClock();
  const revealTime = useRef<number | null>(null);
  const fogMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#a0aca0",
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => () => fogMaterial.dispose(), [fogMaterial]);
  useLayoutEffect(() => {
    const newly = [...explored]
      .filter((id) => !previous.current.has(id))
      .slice(0, 256);
    previous.current = explored;
    if (!mesh.current) return;
    if (reducedMotion) {
      revealTime.current = null;
      mesh.current.visible = false;
      return;
    }
    if (!newly.length) return;
    const transform = new THREE.Object3D();
    newly.forEach((id, i) => {
      const tile = game.tiles[id];
      transform.position.set(tile.x - offset, terrainHeight(tile) + terrainCapOffset + 0.13, tile.y - offset);
      transform.scale.set(0.99, 0.3, 0.99);
      transform.updateMatrix();
      mesh.current!.setMatrixAt(i, transform.matrix);
    });
    mesh.current.count = newly.length;
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
    revealTime.current = playback.time;
    fogMaterial.opacity = 1;
    mesh.current.visible = true;
  }, [explored, fogMaterial, game.tiles, offset, playback, reducedMotion]);
  useFrame(() => {
    if (revealTime.current === null || !mesh.current) return;
    const progress = easeInOut((playback.time - revealTime.current) / 460);
    fogMaterial.opacity = 1 - progress;
    if (progress === 1) {
      revealTime.current = null;
      mesh.current.visible = false;
    }
  });
  return (
    <instancedMesh
      ref={mesh}
      args={[geometry.box, fogMaterial, 256]}
      visible={false}
      dispose={null}
    />
  );
}

function Effects({
  game,
  offset,
  visible,
  reducedMotion,
  combat,
}: {
  game: GameState;
  offset: number;
  visible: Set<number>;
  reducedMotion: boolean;
  combat: { strikes: Strike[]; issuedAt: number };
}) {
  const previous = useRef(game);
  const [active, setActive] = useState<SceneEffect[]>([]);
  const visualId = useRef(-1);
  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = game;
    if (before === game) return;
    if (
      before.options.seed !== game.options.seed ||
      before.options.size !== game.options.size ||
      game.round < before.round
    ) {
      setActive([]);
      return;
    }
    const fresh: SceneEffect[] = getFreshEvents(before, game).filter(
      (event) =>
        event.at &&
        visible.has(event.at.y * game.options.size + event.at.x) &&
        ["upgrade", "capture"].includes(event.type),
    );
    for (const strike of combat.strikes) {
      fresh.push({
        id: strike.id, type: "attack", at: strike.at, damage: strike.damage,
        player: 0, message: "", strike, issuedAt: combat.issuedAt,
      });
    }
    for (const tile of game.tiles) {
      if (!visible.has(tile.id)) continue;
      const feedback = tileFeedbackFor(before.tiles[tile.id], tile);
      if (feedback)
        fresh.push({
          id: visualId.current--,
          type: "info",
          message: "",
          player: tile.owner ?? 0,
          at: { x: tile.x, y: tile.y },
          feedback,
        });
    }
    if (fresh.length) setActive((old) => [...old, ...fresh]);
  }, [game, visible, combat]);
  return (
    <>
      {active.map((event) => (
        <group key={event.id}>
          {event.strike && (
            <ShotEffect
              game={game}
              strike={event.strike}
              offset={offset}
              issuedAt={event.issuedAt!}
              reducedMotion={reducedMotion}
            />
          )}
          <EventEffect
            event={event}
            offset={offset}
            height={terrainHeight(game.tiles[event.at!.y * game.options.size + event.at!.x])}
            reducedMotion={reducedMotion}
            onDone={() => setActive((old) => old.filter((e) => e.id !== event.id))}
          />
        </group>
      ))}
    </>
  );
}

function World({
  game,
  selectedTile,
  selectedUnit,
  reachable,
  attackTargets,
  focusedTarget,
  onTileClick,
  onResultReady,
  playbackStep,
  onPlaybackDone,
  resetKey,
  reducedMotion = false,
  preview = false,
  badges,
  badgeButtons,
}: GameSceneProps & MapBadgesProps) {
  const [hoveredTile, setHoveredTile] = useState<number | null>(null);
  const offset = (game.options.size - 1) / 2;
  const explored = useMemo(
    () =>
      new Set(preview ? game.tiles.map((t) => t.id) : game.players[0].explored),
    [game.tiles, game.players, preview],
  );
  const visible = useMemo(
    () =>
      new Set(preview ? game.tiles.map((t) => t.id) : game.players[0].visible),
    [game.tiles, game.players, preview],
  );
  const movable = useMemo(() => new Set(reachable), [reachable]);
  const availableUnits = useMemo(
    () => !preview && game.currentPlayer === 0 ? getUnitsWithAvailableActions(game) : null,
    [game, preview],
  );
  const targets = useMemo(() => new Set(attackTargets), [attackTargets]);
  const targetTiles = useMemo(() => new Set(
    game.units.filter((unit) => targets.has(unit.id)).map((unit) => unit.y * game.options.size + unit.x),
  ), [game.units, game.options.size, targets]);
  const buildingTiers = useMemo(() => buildTileTiers(game.cities, game.tiles.length), [game.cities, game.tiles.length]);
  const cityById = useMemo(
    () => new Map(game.cities.map((city) => [city.id, city])),
    [game.cities],
  );
  const [view, setView] = useState<{ ids: number[]; simple: boolean }>({
    ids: [...explored].slice(0, 420),
    simple: false,
  });
  const scan = useRef({ time: -1, key: "", dirty: true });
  const scratch = useRef(new THREE.Vector3());
  useEffect(() => {
    scan.current.dirty = true;
  }, [game.tiles, explored]);
  useFrame(({ camera, clock, size }) => {
    if (clock.elapsedTime - scan.current.time < 0.12) return;
    scan.current.time = clock.elapsedTime;
    const key = `${camera.position.x.toFixed(2)}:${camera.position.y.toFixed(2)}:${camera.position.z.toFixed(2)}:${camera.zoom.toFixed(2)}:${size.width}:${size.height}`;
    if (key === scan.current.key && !scan.current.dirty) return;
    scan.current.key = key;
    scan.current.dirty = false;
    const candidates: { id: number; rank: number }[] = [];
    for (const id of explored) {
      const tile = game.tiles[id];
      if (!tile) continue;
      scratch.current
        .set(tile.x - offset, 0.25, tile.y - offset)
        .project(camera);
      const { x, y, z } = scratch.current;
      if (x > -1.18 && x < 1.18 && y > -1.2 && y < 1.2 && z > -1 && z < 1)
        candidates.push({
          id,
          rank: x * x + y * y - (tile.cityId?.length ? 0.3 : 0),
        });
    }
    const simple = camera.zoom < 28 || candidates.length > 420;
    const ids = candidates
      .sort((a, b) => a.rank - b.rank)
      .slice(0, simple ? 650 : 420)
      .map((t) => t.id);
    setView((old) =>
      old.simple === simple &&
      old.ids.length === ids.length &&
      old.ids.every((id, i) => id === ids[i])
        ? old
        : { ids, simple },
    );
  });
  const renderedIds = useMemo(
    () =>
      new Set([
        ...view.ids,
        ...reachable,
        ...targetTiles,
        ...(playbackStep?.structures.keys() ?? []),
        ...(selectedTile === null ? [] : [selectedTile]),
        ...(hoveredTile === null ? [] : [hoveredTile]),
        ...(playbackStep?.focusTile == null ? [] : [playbackStep.focusTile]),
      ]),
    [view.ids, reachable, targetTiles, selectedTile, hoveredTile, playbackStep],
  );
  const displayTiles = useMemo(
    () =>
      [...renderedIds]
        .map((id) => game.tiles[id])
        .filter((t): t is Tile => !!t),
    [renderedIds, game.tiles],
  );
  // Stable unit keys are intentionally independent of the decoration viewport.
  // Three.js culls offscreen geometry; moving units no longer remount at endpoints.
  const playback = useBoardClock(game.options.seed);
  const previousFrame = useRef(game);
  const pendingCombat = useRef<CombatFrame>({ strikes: [], issuedAt: 0 });
  const combat = useMemo(() => {
    const issuedAt = playback.time;
    const before = previousFrame.current;
    return {
      ...planEncounter(before, game, pendingCombat.current, issuedAt),
      issuedAt,
      boardFeedback: getFreshEvents(before, game).some((event) =>
        event.at && visible.has(event.at.y * game.options.size + event.at.x) &&
        (event.type === "upgrade" || event.type === "capture"),
      ),
      tileFeedback: game.tiles.some((tile) =>
        visible.has(tile.id) && !!tileFeedbackFor(before.tiles[tile.id], tile),
      ),
    };
  }, [game, preview, playback, visible]);
  const playbackDeadline = useRef<{ id: number; end: number } | null>(null);
  useLayoutEffect(() => {
    if (!playbackStep) {
      playbackDeadline.current = null;
      return;
    }
    const id = playbackStep.id;
    if (playbackDeadline.current?.id === id && !reducedMotion) return;
    let seconds = reducedMotion ? 0.12 : 0.46;
    if (combat.boardFeedback)
      seconds = reducedMotion ? 0.65 : 1.05;
    else if (combat.tileFeedback)
      seconds = reducedMotion ? 0.65 : 0.85;
    if (reducedMotion && combat.strikes.length) seconds = Math.max(seconds, 0.65);
    if (!reducedMotion) {
      seconds = Math.max(seconds, playbackStep.structureDuration);
      for (const strike of combat.strikes)
        seconds = Math.max(seconds, strike.impact + (strike.lethal ? collapseDuration : hitFeedbackDuration));
      for (const journey of combat.journeys.values()) {
        const last = journey.at(-1);
        if (last) seconds = Math.max(seconds, last.start + last.duration);
      }
    }
    playbackDeadline.current = { id, end: combat.issuedAt + seconds * 1000 + ACTION_GAP_MS };
  }, [combat, playbackStep, reducedMotion]);
  useFrame(() => {
    const deadline = playbackDeadline.current;
    if (!deadline || playback.time < deadline.end) return;
    playbackDeadline.current = null;
    onPlaybackDone?.(deadline.id);
  }, 0);
  useLayoutEffect(() => {
    previousFrame.current = game;
    pendingCombat.current = {
      issuedAt: combat.issuedAt,
      strikes: [...carryStrikes(pendingCombat.current.strikes, pendingCombat.current.issuedAt, combat.issuedAt), ...combat.strikes],
      journeys: combat.journeys,
    };
  }, [game, combat]);
  const resultAnnounced = useRef(false);
  useFrame(() => {
    if (preview || game.status !== "finished" || resultAnnounced.current) return;
    const { strikes, issuedAt } = pendingCombat.current;
    const elapsed = (playback.time - issuedAt) / 1000;
    if (!reducedMotion && (elapsed < (playbackStep?.structureDuration ?? 0) ||
      strikes.some(strike => elapsed < strike.impact + collapseDuration))) return;
    resultAnnounced.current = true;
    onResultReady?.();
  });
  const { presented, finish } = usePresentedUnits(game, preview, combat, playback);
  const visibleUnits = presented.filter((record) => {
    const at = (point: { x: number; y: number }) =>
      renderedIds.has(point.y * game.options.size + point.x);
    if (at(record.unit)) return true;
    return (
      playback.time - record.cue.issuedAt < 800 &&
      ((record.cue.from && at(record.cue.from)) || record.cue.path?.some(at))
    );
  });
  return (
    <PlaybackContext.Provider value={playback}>
      <SceneQuality />
      <CameraRig
        game={game}
        resetKey={resetKey}
        preview={preview}
        selectedTile={selectedTile}
        playbackStep={playbackStep}
        reducedMotion={reducedMotion}
      />
      <MapBadgePositions
        badges={badges}
        badgeButtons={badgeButtons}
        renderedIds={renderedIds}
      />
      <ambientLight intensity={0.71} color="#f2f7ff" />
      <hemisphereLight args={["#e3f0f8", "#829489", 0.94]} />
      <directionalLight
        position={[-7, 15, 8]}
        intensity={1.84}
        color="#fff9ef"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-camera-near={0.1}
        shadow-camera-far={60}
        shadow-bias={-0.0003}
        shadow-normalBias={0.03}
      />
      <directionalLight
        position={[8, 6, -10]}
        intensity={0.3}
        color="#e1ecfa"
      />
      <group>
        <BoardFrame size={game.options.size} />
        <BoardTiles
          game={game}
          explored={explored}
          visible={visible}
          offset={offset}
          onClick={onTileClick}
          onHover={setHoveredTile}
        />
        {!view.simple && <TerrainInlays game={game} tileIds={view.ids} visible={visible} />}
        <TerritoryBorders tiles={game.tiles} players={game.players} explored={explored} size={game.options.size} />
        {displayTiles.map((tile) => (
          <TileView
            key={tile.id}
            tile={tile}
            game={game}
            knownTiles={explored}
            visible={visible.has(tile.id)}
            selected={selectedTile === tile.id}
            reachable={movable.has(tile.id)}
            targeted={targetTiles.has(tile.id)}
            onClick={onTileClick}
            offset={offset}
            simple={view.simple}
            reducedMotion={reducedMotion}
            showCityNames={!preview}
            showHarvestHints={!preview && game.status === "playing" && game.currentPlayer === 0}
            city={tile.cityId ? cityById.get(tile.cityId) : undefined}
            tier={buildingTiers[tile.id]}
            change={playbackStep?.structures.get(tile.id)}
            issuedAt={combat.issuedAt}
            hovered={hoveredTile === tile.id}
            onHover={setHoveredTile}
          />
        ))}
        {visibleUnits.map((record) => (
          <AnimatedUnit
            key={record.unit.id}
            record={record}
            game={game}
            offset={offset}
            selected={selectedUnit === record.unit.id}
            targeted={focusedTarget === record.unit.id}
            actionsSpent={!preview && record.unit.owner === 0 && !availableUnits?.has(record.unit.id)}
            onFinish={finish}
            onClick={onTileClick}
            reducedMotion={reducedMotion}
          />
        ))}
        {!preview && (
          <FogReveal
            game={game}
            explored={explored}
            offset={offset}
            reducedMotion={reducedMotion}
          />
        )}
        {!preview && (
          <Effects
            combat={combat}
            game={game}
            offset={offset}
            visible={visible}
            reducedMotion={reducedMotion}
          />
        )}
      </group>
    </PlaybackContext.Provider>
  );
}

class SceneBoundary extends Component<
  { children: ReactNode; onUnavailable?: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() { this.props.onUnavailable?.(); }
  render() {
    if (this.state.failed)
      return (
        <div className="scene-error" role="alert">
          三维场景暂时无法显示，请启用浏览器硬件加速后刷新。存档仍保留在本机。
        </div>
      );
    return this.props.children;
  }
}

function hitPriority(object: THREE.Object3D) {
  if (object instanceof THREE.Sprite) return object.renderOrder;
  return object.renderOrder === LAND_UNIT_RENDER_ORDER ? LAND_UNIT_RENDER_ORDER : 0;
}

function visibleBoardHit({ object, point, face }: THREE.Intersection) {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) {
    if (!node.visible) return false;
  }
  if (!(object instanceof THREE.Mesh)) return true;
  const material: THREE.Material | undefined = Array.isArray(object.material)
    ? object.material[face?.materialIndex ?? 0] : object.material;
  return !material?.clippingPlanes?.some(plane => plane.distanceToPoint(point) < 0);
}

const sceneEvents: typeof events = (store) => ({
  ...events(store),
  // Plates extend below their tile. Resolve overlaps in the same order they are drawn.
  filter: (hits) => hits
    .filter(visibleBoardHit)
    .sort((a, b) => hitPriority(b.object) - hitPriority(a.object)),
});

export default function GameScene(props: GameSceneProps) {
  const [unavailable, setUnavailable] = useState(false);
  useLayoutEffect(() => props.preview ? undefined : props.attachPlayback?.(), [props.preview, props.attachPlayback]);
  useEffect(() => {
    if (unavailable && props.playbackStep) props.onPlaybackDone?.(props.playbackStep.id);
  }, [unavailable, props.playbackStep, props.onPlaybackDone]);
  useEffect(() => {
    if (unavailable && props.game.status === "finished") props.onResultReady?.();
  }, [unavailable, props.game.status, props.onResultReady]);
  const [labelStyle, setLabelStyle] = useState(defaultLabelStyle);
  useEffect(() => {
    if (!document.fonts) return;
    let active = true;
    const css = getComputedStyle(document.documentElement);
    const size = parseFloat(css.getPropertyValue("--font-size-small")) || defaultLabelStyle.size;
    const font = css.getPropertyValue("--font-body").trim() || defaultLabelStyle.font;
    document.fonts.load(`700 ${size}px ${font}`, "城市0123").then(
      () => { if (active) setLabelStyle({ font, size }); },
      () => { if (active) setLabelStyle({ ...defaultLabelStyle, size }); },
    );
    return () => { active = false; };
  }, []);
  const badges = useMemo(
    () => (props.preview ? [] : getMapBadges(props.game)),
    [props.game, props.preview],
  );
  const badgeButtons = useRef(new Map<number, HTMLButtonElement>());
  return (
    <div
      className={`game-scene${props.preview ? " game-scene-preview" : ""}`}
      style={{ width: "100%", height: "100%", touchAction: "none" }}
      aria-label={
        props.preview ? "文明地图" : "三维战略地图，拖动平移，滚轮缩放"
      }
    >
      <SceneBoundary onUnavailable={() => setUnavailable(true)}>
        <Suspense fallback={<div className="scene-loading">加载地图…</div>}>
          <Canvas
            orthographic
            shadows
            events={sceneEvents}
            dpr={[1, 1.6]}
            camera={{ position: [13, 17, 13], zoom: 60, near: 0.1, far: 240 }}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: "high-performance",
            }}
            onCreated={({ gl }) => {
              gl.localClippingEnabled = true;
              gl.shadowMap.type = THREE.PCFSoftShadowMap;
              gl.setClearColor("#090e1b", 0);
            }}
            fallback={
              <div className="scene-error">此浏览器未启用 WebGL，请开启硬件加速后刷新。</div>
            }
          >
            <MapLabelStyle.Provider value={labelStyle}>
              <WorldModelLibrary>
                <World {...props} badges={badges} badgeButtons={badgeButtons} />
              </WorldModelLibrary>
            </MapLabelStyle.Provider>
          </Canvas>
          {badges.length > 0 && props.onActionBadge && (
            <MapBadgeButtons
              badges={badges}
              badgeButtons={badgeButtons}
              onOpen={props.onActionBadge}
              reducedMotion={props.reducedMotion}
            />
          )}
        </Suspense>
      </SceneBoundary>
    </div>
  );
}
