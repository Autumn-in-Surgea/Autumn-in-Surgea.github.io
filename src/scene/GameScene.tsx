import {
  Component,
  createContext,
  useContext,
  useCallback,
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
import { factionForOwner } from "../nations/registry";
import { representativeTerrain } from "../nations/models";
import { boardColorForOwner, MODEL_SETS } from "./factionModels";
import { SceneQuality } from "./SceneQuality";
import { knownTerrainHeight, terrainCapOffset } from "./terrainElevation";
import { TerrainInlays } from "./TerrainInlays";
import { TerritoryBorders } from "./TerritoryBorders";
import { CityTerritoryOutline } from "./CityTerritoryOutline";
import { ShippingLanes } from "./ShippingLanes";
import { TileScenery } from "./TileScenery";
import { PopulationFlights } from "./PopulationFlights";
import { populationFlightSeconds } from "./populationFlightMotion";
import { getPopulationFlights } from "../store/populationPlayback";
import { CitySiegeScenery } from "./CitySiegeScenery";
import { siegeStartsAt, visibleCitySieges } from "./citySiege";
import { buildTileTiers, type StructureChange } from "../store/structurePlayback";
import { BoardFrame, tileCap, tilePlinth } from "./BoardFrame";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { bindBoardGestures, canHoverBoard, takeBoardTap } from "./boardGestures";
import type { City, GameEvent, GameState, Tile } from "../game/types";
import { getCityCapacity, getCityIncome, getCityUnitCount, getUnitsWithAvailableActions, getVisibleResource, isUnitVisible } from "../game";
import { PlaybackContext, useBoardClock, usePlaybackClock } from "./playbackClock";
import { ShotEffect, projectileName } from "./ShotEffect";
import { carryStrikes, collapseDuration, hitFeedbackDuration, planEncounter } from "./combatMotion";
import type { CombatFrame, Strike } from "./combatMotion";
import { unitAppearDuration, usePresentedUnits, useUnitMotion } from "./unitMotion";
import { getMapBadges, MapBadgeLayer, MapBadgePositions } from "./ActionBadges";
import type { MapBadgesProps, OpenBadge } from "./ActionBadges";
import { clampProgress, easeInOut, easeOut, getFreshEvents } from "./motion";
import type { PresentedUnit } from "./motion";
import { BOARD_UNIT_RENDER_ORDER, unitHealthAnchor } from "./unitModels";
import { SelectionHalo, SquareOutline } from "./boardHighlights";
import { ForeignTerritory, foreignTerritoryBrightness, isForeignTerritory } from "./territoryMaterials";
import type { PlaybackStep } from "../store/actionPlayback";
import {
  boardNumberFontSize, cityDetailHeight, drawCityDetails, measureCityDetails,
  type CityNameplateDetails, type CityNameplateMotion,
} from "./cityNameplate";
import { cityMeterMotionMs, labelBounce, labelBounceMs, sampleCityNameplate } from "./labelMotion";

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
  swapTargetTile?: number | null;
  onTileClick: (id: number) => void;
  onActionBadge?: OpenBadge;
  onResultReady?: () => void;
  playbackStep?: PlaybackStep | null;
  attachPlayback?: () => () => void;
  onPlaybackDone?: (id: number) => void;
  resetKey: number;
  reducedMotion?: boolean;
  showCityDetails?: boolean;
  showResourceHints?: boolean;
  preview?: boolean;
}

const mapCameraOffset = new THREE.Vector3(13, 17, 13);
const mapViewAngles = new THREE.Spherical().setFromVector3(mapCameraOffset);
const panCoastSeconds = 0.21;

function CameraRig({
  game,
  resetKey,
  preview,
  selectedTile,
  playbackStep,
  reducedMotion,
  onReplayFocus,
  onDrag,
}: Pick<
  GameSceneProps,
  "game" | "resetKey" | "preview" | "selectedTile" | "playbackStep" | "reducedMotion"
> & { onReplayFocus: (id: number) => void; onDrag: () => void }) {
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
    replayId?: number;
  } | null>(null);
  const panStep = useRef(new THREE.Vector3());
  const coastVelocity = useRef(new THREE.Vector3());
  const finishPan = useCallback(() => {
    const id = automaticPan.current?.replayId;
    automaticPan.current = null;
    if (id !== undefined) onReplayFocus(id);
  }, [onReplayFocus]);
  useLayoutEffect(() => {
    // Binding in render leaks listeners when React discards a render.
    const controls = new OrbitControls(camera);
    cameraControls.current = controls;
    controls.enableRotate = false;
    controls.minPolarAngle = controls.maxPolarAngle = mapViewAngles.phi;
    controls.minAzimuthAngle = controls.maxAzimuthAngle = mapViewAngles.theta;
    // Track the pointer directly. Apply the inertial tail only after release.
    controls.enableDamping = false;
    controls.screenSpacePanning = true;
    controls.panSpeed = 1;
    controls.zoomSpeed = 1;
    controls.zoomToCursor = true;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
    controls.minZoom = Math.max(5, 180 / n);
    controls.maxZoom = 150;
    const choosePanAction = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      // OrbitControls swaps the rotate and pan bindings when a modifier is held.
      const action = event.ctrlKey || event.metaKey || event.shiftKey
        ? THREE.MOUSE.ROTATE
        : THREE.MOUSE.PAN;
      controls.mouseButtons.LEFT = controls.mouseButtons.RIGHT = action;
    };
    const canvas = gl.domElement;
    const right = new THREE.Vector3(), up = new THREE.Vector3();
    const disconnectGestures = bindBoardGestures(canvas, onDrag, (vx, vy) => {
      if (!(camera instanceof THREE.OrthographicCamera) || !canvas.clientWidth || !canvas.clientHeight) return;
      const speedScale = Math.min(1, 1050 / Math.hypot(vx, vy));
      const dx = vx * speedScale * (camera.right - camera.left) / (camera.zoom * canvas.clientWidth);
      const dy = vy * speedScale * (camera.top - camera.bottom) / (camera.zoom * canvas.clientHeight);
      right.setFromMatrixColumn(camera.matrix, 0);
      up.setFromMatrixColumn(camera.matrix, 1);
      coastVelocity.current.copy(right).multiplyScalar(-dx).addScaledVector(up, dy);
    });
    const startCameraInput = () => {
      coastVelocity.current.set(0, 0, 0);
      finishPan();
    };
    canvas.addEventListener("pointerdown", choosePanAction, true);
    controls.addEventListener("start", startCameraInput);
    controls.connect(canvas);
    return () => {
      canvas.removeEventListener("pointerdown", choosePanAction, true);
      disconnectGestures();
      controls.removeEventListener("start", startCameraInput);
      controls.dispose();
      cameraControls.current = null;
    };
  }, [camera, gl, n, onDrag, finishPan]);
  useLayoutEffect(() => {
    const controls = cameraControls.current;
    if (!controls) return;
    const offset = (n - 1) / 2;
    const x = preview ? 0 : (focus?.x ?? offset) - offset;
    const z = preview ? 0 : (focus?.y ?? offset) - offset;
    automaticPan.current = null;
    coastVelocity.current.set(0, 0, 0);
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
  const replayTile = playbackStep?.focusTile ?? null;
  const replayId = playbackStep?.id;
  useLayoutEffect(() => {
    if (replayTile === null || replayId === undefined) return;
    automaticPan.current = null;
    coastVelocity.current.set(0, 0, 0);
    const controls = cameraControls.current;
    if (!controls) {
      onReplayFocus(replayId);
      return;
    }
    const offset = (n - 1) / 2;
    const point = new THREE.Vector3(replayTile % n - offset, 0, Math.floor(replayTile / n) - offset);
    camera.updateMatrixWorld();
    const projected = panStep.current.copy(point).project(camera);
    if (Math.abs(projected.x) <= 0.76 && Math.abs(projected.y) <= 0.72) {
      onReplayFocus(replayId);
      return;
    }
    const from = controls.target.clone();
    automaticPan.current = {
      from,
      to: point,
      elapsed: 0,
      duration: Math.min(0.78, 0.32 + from.distanceTo(point) * 0.032),
      replayId,
    };
  }, [camera, n, resetKey, replayTile, replayId, onReplayFocus]);
  useEffect(() => {
    if (replayTile !== null) return;
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
  }, [selectedTile, preview, n, camera, replayTile]);
  useFrame((_, delta) => {
    const controls = cameraControls.current;
    if (!controls) return;
    const step = Math.min(delta, 0.05);
    const pan = automaticPan.current;
    const velocity = coastVelocity.current;
    if (pan || reducedMotion) velocity.set(0, 0, 0);
    const coasting = velocity.lengthSq() * camera.zoom ** 2 > 14 ** 2;
    if (coasting) {
      const retention = Math.exp(-step / panCoastSeconds);
      const distance = panCoastSeconds * (1 - retention);
      camera.position.addScaledVector(velocity, distance);
      controls.target.addScaledVector(velocity, distance);
      velocity.multiplyScalar(retention);
    }
    if (pan) {
      pan.elapsed = reducedMotion ? pan.duration : Math.min(pan.duration, pan.elapsed + step);
      const progress = pan.elapsed / pan.duration;
      panStep.current.lerpVectors(pan.from, pan.to, easeInOut(progress));
      camera.position.add(panStep.current).sub(controls.target);
      controls.target.copy(panStep.current);
    }

    const bound = n * 0.7;
    const x = THREE.MathUtils.clamp(controls.target.x, -bound, bound);
    const z = THREE.MathUtils.clamp(controls.target.z, -bound, bound);
    const dy =
      THREE.MathUtils.clamp(controls.target.y, -3, 3) - controls.target.y;
    if (!pan && !coasting && x === controls.target.x && z === controls.target.z && dy === 0) return;
    camera.position.x += x - controls.target.x;
    camera.position.y += dy;
    camera.position.z += z - controls.target.z;
    controls.target.set(x, controls.target.y + dy, z);
    camera.updateMatrixWorld();
    if (pan && pan.elapsed === pan.duration) finishPan();
  }, -1);
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
const labelFontSize = { city: 34, health: boardNumberFontSize };
const ignoreLabelRaycast = () => {};

function paintLabel(
  texture: THREE.CanvasTexture,
  text: string,
  foreground: string,
  kind: LabelKind,
  style: typeof defaultLabelStyle,
  cityDetails?: CityNameplateDetails,
  cityMotion?: CityNameplateMotion,
  cityBackgroundOpacity = 0.28,
) {
  const canvas = texture.image as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const size = kind === "feedback" ? style.size * 2 : labelFontSize[kind];
  const font = `600 ${size}px ${style.font}`;
  ctx.font = font;
  // Glyph bounds are relative to the active baseline. Measure with the drawing baseline.
  ctx.textBaseline = "alphabetic";
  const metrics = ctx.measureText(text);
  const padding = kind === "city" ? 22 : kind === "health" ? 16 : 18;
  const titleWidth = Math.ceil(metrics.width) + padding;
  const titleHeight = size + (kind === "city" ? 8 : 16);
  const detailRow = cityDetails && measureCityDetails(ctx, cityDetails, style.font);
  const width = Math.max(titleWidth, Math.ceil(detailRow?.width ?? 0));
  const height = titleHeight + (detailRow ? cityDetailHeight : 0);
  if (width !== canvas.width || height !== canvas.height) {
    // WebGL storage is fixed-size. Only resize for a different label width or row count.
    texture.dispose();
    canvas.width = width;
    canvas.height = height;
  } else ctx.clearRect(0, 0, width, height);
  if (kind !== "health") {
    ctx.fillStyle = kind === "city"
      ? detailRow ? "#172b3b" : "#1f2f2f"
      : "#f5f0e3f2";
    ctx.save();
    ctx.globalAlpha = kind === "city" ? cityBackgroundOpacity : 1;
    ctx.beginPath();
    ctx.roundRect(1, 1, canvas.width - 2, canvas.height - 2, kind === "city" ? 9 : 11);
    ctx.fill();
    ctx.restore();
  }
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const x = canvas.width / 2;
  const y = (titleHeight + metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
  if (kind === "health" || kind === "city") {
    ctx.lineJoin = "round";
    ctx.lineWidth = kind === "health" ? 6 : 5;
    ctx.strokeStyle = kind === "health" ? "#182523" : "#172b3bbb";
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = foreground;
  ctx.fillText(text, x, y);
  if (detailRow) drawCityDetails(ctx, detailRow, titleHeight, canvas.width, cityMotion);
  texture.needsUpdate = true;
}

function Label({
  text,
  color,
  kind,
  position,
  opacity = 1,
  materialRef,
  cityDetails,
  cityBackgroundOpacity,
  reducedMotion = false,
}: {
  text: string;
  color: string;
  kind: LabelKind;
  position: [number, number, number];
  opacity?: number;
  materialRef?: Ref<THREE.SpriteMaterial>;
  cityDetails?: CityNameplateDetails;
  cityBackgroundOpacity?: number;
  reducedMotion?: boolean;
}) {
  const style = useContext(MapLabelStyle);
  const showDetails = !!cityDetails;
  const { population = 0, units = 0, capacity = 0, income = 0 } = cityDetails ?? {};
  const [texture] = useState(() => {
    const canvasTexture = new THREE.CanvasTexture(document.createElement("canvas"));
    canvasTexture.colorSpace = THREE.SRGBColorSpace;
    return canvasTexture;
  });
  useEffect(() => () => texture.dispose(), [texture]);
  const sprite = useRef<THREE.Sprite>(null);
  const clock = usePlaybackClock();
  const previous = useRef({ text, details: cityDetails });
  const painted = useRef(cityDetails);
  const motion = useRef<{
    since: number;
    nextPaint: number;
    city?: { from: CityNameplateDetails; to: CityNameplateDetails };
  } | null>(null);
  const pixelsPerUnit = kind === "feedback" ? 2 : labelPixelsPerTile;
  const originY = position[1];
  function draw(details?: CityNameplateDetails, cityMotion?: CityNameplateMotion) {
    if (!sprite.current) return;
    paintLabel(texture, text, color, kind, style, details, cityMotion, cityBackgroundOpacity);
    painted.current = details;
    sprite.current.scale.set(texture.image.width / pixelsPerUnit, texture.image.height / pixelsPerUnit, 1);
  }
  useLayoutEffect(() => {
    const next = showDetails ? { population, units, capacity, income } : undefined;
    const last = previous.current;
    previous.current = { text, details: next };
    const from = painted.current;
    const change = next && last.details &&
      (population !== last.details.population || units !== last.details.units ||
        capacity !== last.details.capacity || income !== last.details.income);
    if (!reducedMotion && from && next && change) {
      motion.current = { since: clock.time, nextPaint: clock.time, city: { from, to: next } };
      return;
    }
    motion.current = !reducedMotion && kind === "health" && text !== last.text
      ? { since: clock.time, nextPaint: clock.time }
      : null;
    draw(next);
    if (sprite.current && kind === "health") {
      sprite.current.position.y = originY;
      sprite.current.material.opacity = opacity;
    }
  }, [texture, style, text, color, kind, showDetails, population, units, capacity, income, reducedMotion, clock, originY, opacity, cityBackgroundOpacity]);
  useFrame(() => {
    const active = motion.current;
    if (!active || !sprite.current) return;
    const progress = clampProgress((clock.time - active.since) / (active.city ? cityMeterMotionMs : labelBounceMs));
    const pulse = labelBounce(progress);
    if (active.city) {
      if (clock.time < active.nextPaint && progress < 1) return;
      active.nextPaint = clock.time + 32;
      const { from, to } = active.city;
      draw(sampleCityNameplate(from, to, progress), { previous: from, target: to, pulse });
    } else {
      sprite.current.scale.set(
        texture.image.width / pixelsPerUnit * (1 + pulse * 0.16),
        texture.image.height / pixelsPerUnit * (1 + pulse * 0.26), 1,
      );
      sprite.current.position.y = originY + pulse * 0.05;
      if (text === "0") sprite.current.material.opacity = opacity * (1 - easeInOut((progress - 0.38) / 0.62));
    }
    if (progress === 1) motion.current = null;
  });
  return (
    <sprite
      ref={sprite}
      name={`board-label-${kind}`}
      position={position}
      center={kind === "city" ? [0.5, 1] : [0.5, 0.5]}
      renderOrder={labelOrder[kind]}
      raycast={ignoreLabelRaycast}
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

const fogShell = { cap: tileCap, plinth: tilePlinth, color: "#a2aca5", plinthColor: "#798681" };
const boardShell = (tile: Tile, known: boolean) =>
  known ? representativeTerrain.shells[tile.terrain] : fogShell;

interface ShellBatch {
  cap: THREE.BufferGeometry;
  plinth: THREE.BufferGeometry;
  tiles: Tile[];
}

// Cull offscreen patches on large boards and share two draws per shell geometry pair.
const BoardTiles = memo(function BoardTiles({ game, explored, ...props }: {
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
    const groups = Array.from({ length: across * across }, () => new Map<string, ShellBatch>());
    for (const tile of game.tiles) {
      const group = groups[Math.floor(tile.y / span) * across + Math.floor(tile.x / span)];
      const { cap, plinth } = boardShell(tile, explored.has(tile.id));
      const key = `${cap.id}:${plinth.id}`;
      let batch = group.get(key);
      if (!batch) {
        batch = { cap, plinth, tiles: [] };
        group.set(key, batch);
      }
      batch.tiles.push(tile);
    }
    return groups;
  }, [game.tiles, explored, size]);
  return <>{patches.flatMap((batches, index) => [...batches].map(([key, batch]) =>
    <BoardPatch key={`${index}:${key}`} {...batch} explored={explored} {...props} />
  ))}</>;
});

function BoardPatch({ tiles, cap, plinth, explored, visible, offset, onClick, onHover }: ShellBatch & {
  explored: Set<number>;
  visible: Set<number>;
  offset: number;
  onClick: (id: number) => void;
  onHover: (id: number | null) => void;
}) {
  const baseRef = useRef<THREE.InstancedMesh>(null);
  const topRef = useRef<THREE.InstancedMesh>(null);
  const lastLayout = useRef<{
    tiles: Tile[]; explored: Set<number>; visible: Set<number>; offset: number;
    base: THREE.InstancedMesh; top: THREE.InstancedMesh;
  } | null>(null);
  useLayoutEffect(() => {
    const base = baseRef.current, top = topRef.current;
    if (!base || !top) return;
    const last = lastLayout.current;
    const previous = last && last.base === base && last.top === top && last.offset === offset ? last : null;
    lastLayout.current = { tiles, explored, visible, offset, base, top };
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    let moved = false, recolored = false;
    tiles.forEach((tile, i) => {
      const known = explored.has(tile.id);
      const surface = knownTerrainHeight(tile, known);
      const old = previous?.tiles[i];
      const wasKnown = !!old && !!previous?.explored.has(old.id);
      if (!old || old.id !== tile.id || knownTerrainHeight(old, wasKnown) !== surface) {
        const x = tile.x - offset, z = tile.y - offset;
        matrix.makeScale(0.984, surface + 0.30, 0.984).setPosition(x, (surface - 0.33) / 2, z);
        base.setMatrixAt(i, matrix);
        matrix.makeTranslation(x, surface, z);
        top.setMatrixAt(i, matrix);
        moved = true;
      }
      const dark = visible.has(tile.id) && isForeignTerritory(tile.owner);
      const wasDark = !!old && !!previous?.visible.has(old.id) && isForeignTerritory(old.owner);
      if (!old || old.id !== tile.id || known !== wasKnown || dark !== wasDark ||
        (known && old.terrain !== tile.terrain)) {
        const brightness = dark ? foreignTerritoryBrightness : 1;
        const shell = boardShell(tile, known);
        base.setColorAt(i, color.set(shell.plinthColor).multiplyScalar(brightness));
        top.setColorAt(i, color.set(shell.color).multiplyScalar(brightness));
        recolored = true;
      }
    });
    for (const mesh of [base, top]) {
      if (moved) {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
      }
      if (recolored && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
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
        args={[plinth, material("#ffffff"), tiles.length]}
        receiveShadow
        onClick={click}
        onPointerMove={hover}
        onPointerOut={() => onHover(null)}
      />
      <instancedMesh
        ref={topRef}
        args={[cap, material("#ffffff"), tiles.length]}
        receiveShadow
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
  showCityDetails,
  checkResourceAvailability,
  showResourceHints,
  city,
  siegeStart,
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
  showCityDetails: boolean;
  checkResourceAvailability: boolean;
  showResourceHints: boolean;
  city?: City;
  siegeStart?: number;
  tier: number;
  change?: StructureChange;
  issuedAt: number;
  hovered: boolean;
  onHover: (id: number | null) => void;
}) {
  const explored = knownTiles.has(tile.id);
  const surface = knownTerrainHeight(tile, explored);
  const cityLabelOffset = city && city.owner !== null && city.level >= 5 ? 0.34 : 0.27;
  const cityDetails = useMemo<CityNameplateDetails | undefined>(() => {
    if (city?.owner !== 0 || !showCityNames || !showCityDetails) return;
    return {
      population: city.population,
      units: getCityUnitCount(game, city),
      capacity: getCityCapacity(city),
      income: getCityIncome(game, city.id),
    };
  }, [city, game, showCityDetails, showCityNames]);
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
  const scenery = <TileScenery
    game={game}
    tile={tile}
    city={city}
    tier={tier}
    knownTiles={knownTiles}
    visible={visible}
    simple={simple}
    checkResourceAvailability={checkResourceAvailability}
    showResourceHints={showResourceHints}
    change={change}
    issuedAt={issuedAt}
    surfaceY={surface + terrainCapOffset}
    reducedMotion={reducedMotion}
  />;
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
            {city ? <CitySiegeScenery startsAt={siegeStart} tileId={tile.id} reducedMotion={reducedMotion}>
              {scenery}
            </CitySiegeScenery> : scenery}
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
              cityBackgroundOpacity={visible ? 0.28 : 0.224}
              cityDetails={cityDetails}
              reducedMotion={reducedMotion}
              // Keep the plate centered just in front of the city.
              position={[cityLabelOffset, 0.04, cityLabelOffset]}
            />
          )}
        </group>
      )}
      {(selected || targeted || reachable || hovered) && (
        <SquareOutline
          kind={targeted ? "target" : selected ? "selection" : reachable ? "reachable" : "hover"}
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
function UnitHealth({ record, reducedMotion }: { record: PresentedUnit; reducedMotion: boolean }) {
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
      hp = landed >= hits.length ? 0
        : Math.max(1, (cue.initialHp ?? hp) - hits.slice(0, landed).reduce((sum, hit) => sum + hit.damage, 0));
    } else {
      hp = Math.min(unit.maxHp, hp + pending.reduce((sum, hit) => sum + hit.damage, 0));
    }
  } else if (cue.dying) return null;
  return (
    <Label
      kind="health"
      text={String(hp)}
      color={hp <= unit.maxHp * 0.4 ? "#ffc6ae" : "#fff9e8"}
      position={unitHealthAnchor(unit.type)}
      reducedMotion={reducedMotion}
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
  const color = boardColorForOwner(game.players, unit.owner);
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
        <SelectionHalo kind={targeted && unit.owner !== 0 ? "target" : "selection"} reducedMotion={reducedMotion} />
      )}
      <group ref={model}>
        <UnitModel
          getGeometry={MODEL_SETS[modelSet].unit}
          type={unit.type}
          color={color}
          playerOwned={unit.owner === 0}
          actionsSpent={actionsSpent}
          foreignTerritory={isForeignTerritory(tile.owner)}
        />
      </group>
      <group ref={label}>
        <UnitHealth record={record} reducedMotion={reducedMotion} />
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

const feedbackDuration = (event: SceneEffect, reducedMotion: boolean) =>
  reducedMotion ? 0.65 : event.strike ? hitFeedbackDuration : event.feedback ? 0.85 : 1.05;

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
      : event.type === "promotion"
        ? "#75618e"
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
  const duration = feedbackDuration(event, reducedMotion);
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
      const animationScale = reducedMotion ? 1 : 0.86 + arrival * 0.14 + labelBounce(elapsed / 0.36) * 0.22;
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
      : event.type === "promotion"
        ? "晋升老兵 ↑"
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
  presented,
  onFeedbackEnds,
}: {
  game: GameState;
  offset: number;
  visible: Set<number>;
  reducedMotion: boolean;
  combat: { strikes: Strike[]; issuedAt: number };
  presented: readonly PresentedUnit[];
  onFeedbackEnds: (time: number) => void;
}) {
  const playback = usePlaybackClock();
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
    const fresh: SceneEffect[] = getFreshEvents(before, game).filter((event) => {
      if (!event.at || !visible.has(event.at.y * game.options.size + event.at.x)) return false;
      if (event.type !== "promotion") return event.type === "upgrade" || event.type === "capture";
      const unit = game.units.find((unit) => unit.id === event.unitId);
      return !!unit && isUnitVisible(game, unit, 0);
    });
    for (const strike of combat.strikes) {
      fresh.push({
        id: strike.id, type: "attack", at: strike.at, damage: strike.damage,
        player: 0, message: "", strike, issuedAt: combat.issuedAt,
      });
    }
    const thrownResources = reducedMotion ? null : new Set(getPopulationFlights(game)
      .filter(gain => gain.source.kind === "resource").map(gain => gain.source.tileId));
    for (const tile of game.tiles) {
      if (!visible.has(tile.id)) continue;
      const feedback = tileFeedbackFor(before.tiles[tile.id], tile);
      if (feedback && (feedback !== "harvest" || !thrownResources?.has(tile.id)))
        fresh.push({
          id: visualId.current--,
          type: "info",
          message: "",
          player: tile.owner ?? 0,
          at: { x: tile.x, y: tile.y },
          feedback,
        });
    }
    if (fresh.length) {
      for (const event of fresh) {
        if (!event.strike || reducedMotion)
          onFeedbackEnds(playback.time + feedbackDuration(event, reducedMotion) * 1000);
      }
      setActive((old) => [...old, ...fresh]);
    }
  }, [game, visible, combat, reducedMotion, playback, onFeedbackEnds]);
  return (
    <>
      {active.map((event) => (
        <group key={event.id}>
          {event.strike && (
            <ShotEffect
              game={game}
              strike={event.strike}
              shooter={presented.find(({ unit }) => unit.id === event.strike?.attackerId)}
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
  game: committedGame,
  selectedTile,
  selectedUnit,
  reachable,
  attackTargets,
  focusedTarget,
  swapTargetTile = null,
  onTileClick,
  onResultReady,
  playbackStep,
  onPlaybackDone,
  resetKey,
  reducedMotion = false,
  showCityDetails = false,
  showResourceHints = true,
  preview = false,
  badges,
  badgeElements,
}: GameSceneProps & MapBadgesProps) {
  const replay = playbackStep?.focusTile != null ? playbackStep : null;
  const [focusedReplayId, setFocusedReplayId] = useState<number | null>(null);
  const awaitingFocus = replay && !reducedMotion && focusedReplayId !== replay.id;
  // The store has settled the action. Hold its old board until the camera is ready.
  const game = awaitingFocus ? replay.previousGame : committedGame;
  const playingStep = awaitingFocus ? null : playbackStep;
  const [hoveredTile, setHoveredTile] = useState<number | null>(null);
  const clearHover = useCallback(() => setHoveredTile(null), []);
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
  const previewingSwap = swapTargetTile !== null;
  const movable = useMemo(() => new Set(previewingSwap ? [] : reachable), [previewingSwap, reachable]);
  const availableUnits = useMemo(
    () => !preview && game.currentPlayer === 0 ? getUnitsWithAvailableActions(game) : null,
    [game, preview],
  );
  const targets = useMemo(() => new Set(previewingSwap ? [] : attackTargets), [previewingSwap, attackTargets]);
  const targetTiles = useMemo(() => new Set(
    game.units.filter((unit) => targets.has(unit.id)).map((unit) => unit.y * game.options.size + unit.x),
  ), [game.units, game.options.size, targets]);
  const buildingTiers = useMemo(() => buildTileTiers(game.cities, game.tiles.length), [game.cities, game.tiles.length]);
  const cityById = useMemo(
    () => new Map(game.cities.map((city) => [city.id, city])),
    [game.cities],
  );
  const selectedCity = useMemo(() => {
    if (preview || selectedUnit !== null || selectedTile === null || !explored.has(selectedTile)) return;
    const tile = game.tiles[selectedTile];
    if (tile.cityId) return cityById.get(tile.cityId);
    if (tile.owner !== null && (getVisibleResource(game, tile, 0) || tile.building || tile.terrain === "forest")) {
      return game.cities.find(city => city.owner === tile.owner && city.territory.includes(tile.id));
    }
  }, [preview, game, explored, selectedTile, selectedUnit, cityById]);
  const [view, setView] = useState<{ ids: number[]; simple: boolean }>({
    ids: [...explored].slice(0, 420),
    simple: false,
  });
  const scan = useRef({
    position: new THREE.Vector3(), projection: new THREE.Matrix4(),
    zoom: -1, width: 0, height: 0, dirty: true,
  });
  const scratch = useRef(new THREE.Vector3());
  useLayoutEffect(() => {
    scan.current.dirty = true;
  }, [game.tiles, explored]);
  useFrame(({ camera, size }) => {
    const current = scan.current;
    // The overscan is much larger than this threshold. Refresh after camera
    // travel, so models arrive before they enter view without waiting on a timer.
    const zoomChanged = Math.abs(camera.zoom - current.zoom) > camera.zoom * 0.035 ||
      (camera.zoom < 28) !== (current.zoom < 28);
    const travel = camera.position.distanceToSquared(current.position) * camera.zoom ** 2;
    if (!current.dirty && !zoomChanged && travel < 12 ** 2 &&
      current.width === size.width && current.height === size.height) return;
    current.position.copy(camera.position);
    current.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    Object.assign(current, { zoom: camera.zoom, width: size.width, height: size.height, dirty: false });
    const candidates: { id: number; rank: number }[] = [];
    for (const id of explored) {
      const tile = game.tiles[id];
      if (!tile) continue;
      scratch.current
        .set(tile.x - offset, 0.25, tile.y - offset)
        .applyMatrix4(current.projection);
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
      .map((t) => t.id)
      .sort((a, b) => a - b);
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
        ...movable,
        ...targetTiles,
        ...(playingStep?.structures.keys() ?? []),
        ...(selectedTile === null ? [] : [selectedTile]),
        ...(swapTargetTile === null ? [] : [swapTargetTile]),
        ...(previewingSwap || hoveredTile === null ? [] : [hoveredTile]),
        ...(playbackStep?.focusTile == null ? [] : [playbackStep.focusTile]),
      ]),
    [view.ids, movable, targetTiles, selectedTile, swapTargetTile, previewingSwap, hoveredTile, playbackStep, playingStep],
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
    const encounter = planEncounter(before, game, pendingCombat.current, issuedAt);
    let appearanceDuration = 0;
    if (before !== game) {
      const beforeUnits = new Map(before.units.map(unit => [unit.id, unit]));
      for (const unit of game.units) {
        const old = beforeUnits.get(unit.id);
        const appears = !old || encounter.hiddenJourneys.has(unit.id) || !isUnitVisible(before, old, 0);
        if (appears && isUnitVisible(game, unit, 0))
          appearanceDuration = Math.max(appearanceDuration, unitAppearDuration(!old));
      }
    }
    return { ...encounter, issuedAt, appearanceDuration };
  }, [game, playback]);
  const siegeStarts = useMemo(() => {
    const starts = new Map<string, number>();
    if (!preview) for (const [cityId, unit] of visibleCitySieges(game, visible))
      starts.set(cityId, siegeStartsAt(unit, combat));
    return starts;
  }, [game, visible, combat, preview]);
  const feedbackEnd = useRef({ game, time: 0 });
  const onFeedbackEnds = useCallback((time: number) => {
    if (feedbackEnd.current.game !== game || time > feedbackEnd.current.time)
      feedbackEnd.current = { game, time };
  }, [game]);
  const playbackDeadline = useRef<{ id: number; end: number; pause: number } | null>(null);
  useLayoutEffect(() => {
    if (!playingStep) {
      playbackDeadline.current = null;
      return;
    }
    const id = playingStep.id;
    if (playbackDeadline.current?.id === id && !reducedMotion) return;
    let seconds = 0;
    if (!reducedMotion) {
      seconds = Math.max(playingStep.structureDuration, combat.appearanceDuration);
      for (const strike of combat.strikes)
        seconds = Math.max(seconds, strike.impact + (strike.lethal ? collapseDuration : hitFeedbackDuration));
      for (const journey of combat.journeys.values()) {
        const last = journey.at(-1);
        if (last) seconds = Math.max(seconds, last.start + last.duration);
      }
      for (const arrival of siegeStarts.values())
        seconds = Math.max(seconds, (arrival - combat.issuedAt) / 1000);
      if (replay) seconds = Math.max(seconds, populationFlightSeconds(game));
    }
    // A separate pause gives each replayed action a beat, even for an instant change.
    playbackDeadline.current = { id, end: combat.issuedAt + seconds * 1000, pause: replay ? 140 : 0 };
  }, [combat, game, playingStep, reducedMotion, replay, siegeStarts]);
  useFrame(() => {
    const deadline = playbackDeadline.current;
    if (!deadline) return;
    const end = deadline.pause && feedbackEnd.current.game === game
      ? Math.max(deadline.end, feedbackEnd.current.time) : deadline.end;
    if (playback.time < end + deadline.pause) return;
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
    if (preview || game.status !== "finished" || resultAnnounced.current || playbackDeadline.current) return;
    const { strikes, issuedAt } = pendingCombat.current;
    const elapsed = (playback.time - issuedAt) / 1000;
    if (!reducedMotion && (elapsed < (playingStep?.structureDuration ?? 0) ||
      strikes.some(strike => elapsed < strike.impact + collapseDuration))) return;
    resultAnnounced.current = true;
    onResultReady?.();
  });
  const { presented, finish } = usePresentedUnits(game, preview, combat, playback, reducedMotion);
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
        onDrag={clearHover}
        preview={preview}
        selectedTile={selectedTile}
        playbackStep={playbackStep}
        reducedMotion={reducedMotion}
        onReplayFocus={setFocusedReplayId}
      />
      <MapBadgePositions
        badges={badges}
        badgeElements={badgeElements}
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
        {!preview && <ShippingLanes game={game} explored={explored} />}
        <TerritoryBorders tiles={game.tiles} players={game.players} explored={explored} size={game.options.size} />
        {selectedCity && <CityTerritoryOutline territory={selectedCity.territory} explored={explored} size={game.options.size} />}
        {displayTiles.map((tile) => (
          <TileView
            key={tile.id}
            tile={tile}
            game={game}
            knownTiles={explored}
            visible={visible.has(tile.id)}
            selected={selectedTile === tile.id || swapTargetTile === tile.id}
            reachable={movable.has(tile.id)}
            targeted={targetTiles.has(tile.id)}
            onClick={onTileClick}
            offset={offset}
            simple={view.simple}
            reducedMotion={reducedMotion}
            showCityNames={!preview}
            showCityDetails={showCityDetails}
            checkResourceAvailability={!preview && game.status === "playing" && game.currentPlayer === 0}
            showResourceHints={showResourceHints}
            city={tile.cityId ? cityById.get(tile.cityId) : undefined}
            siegeStart={tile.cityId ? siegeStarts.get(tile.cityId) : undefined}
            tier={buildingTiers[tile.id]}
            change={playingStep?.structures.get(tile.id)}
            issuedAt={combat.issuedAt}
            hovered={!previewingSwap && hoveredTile === tile.id}
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
            actionsSpent={!preview && record.unit.owner === 0 &&
              (!!record.unit.upkeep || !availableUnits?.has(record.unit.id))}
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
            presented={presented}
            visible={visible}
            reducedMotion={reducedMotion}
            onFeedbackEnds={onFeedbackEnds}
          />
        )}
        {!preview && <PopulationFlights game={game} offset={offset} reducedMotion={reducedMotion} />}
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
  return object.renderOrder === BOARD_UNIT_RENDER_ORDER ? BOARD_UNIT_RENDER_ORDER : 0;
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

const sceneEvents: typeof events = (store) => {
  const manager = events(store);
  const handlers = manager.handlers!;
  return {
    ...manager,
    handlers: {
      ...handlers,
      onPointerDown(event) {
        if (event instanceof PointerEvent && event.button === 0 && event.isPrimary) handlers.onPointerDown(event);
      },
      onPointerMove(event) {
        if (event instanceof PointerEvent && canHoverBoard(store.getState().gl.domElement, event)) handlers.onPointerMove(event);
      },
      onPointerUp(event) {
        // Pick on release rather than waiting for a synthesized browser click.
        if (event instanceof PointerEvent && takeBoardTap(store.getState().gl.domElement, event)) handlers.onClick(event);
      },
      onClick(event) {
        if (event instanceof MouseEvent && event.detail === 0 && !("pointerType" in event && event.pointerType))
          handlers.onClick(event);
      },
      // OrbitControls handles the wheel. These DOM events have no board actions.
      onWheel: () => {},
      onDoubleClick: () => {},
      onContextMenu: () => {},
    },
    // Foreground pieces can overlap nearby tiles. Give them priority as drawn.
    filter: (hits) => hits
      .filter(visibleBoardHit)
      .sort((a, b) => hitPriority(b.object) - hitPriority(a.object)),
  };
};

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
  const replay = props.playbackStep?.focusTile != null ? props.playbackStep : null;
  const badges = useMemo(
    () => props.preview ? [] : getMapBadges(replay?.previousGame ?? props.game, !replay && !!props.onActionBadge),
    [props.game, props.preview, props.onActionBadge, replay],
  );
  const badgeElements = useRef(new Map<string, HTMLElement>());
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
              stencil: true,
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
                <World {...props} badges={badges} badgeElements={badgeElements} />
              </WorldModelLibrary>
            </MapLabelStyle.Provider>
          </Canvas>
          {badges.length > 0 && (
            <MapBadgeLayer
              badges={badges}
              badgeElements={badgeElements}
              onOpen={props.onActionBadge}
              reducedMotion={props.reducedMotion}
            />
          )}
        </Suspense>
      </SceneBoundary>
    </div>
  );
}
