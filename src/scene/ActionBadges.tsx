import { useRef } from "react";
import type { RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Award, ChevronsUp, Clock3, Compass, Flag, RotateCcw } from "lucide-react";
import { Matrix4, Vector3 } from "three";
import { validateAction } from "../game/rules/engine";
import { UNITS, VETERAN_KILLS_REQUIRED } from "../game/data/config";
import type { GameState, Unit } from "../game/types";
import { terrainHeight } from "./models";
import { factionForOwner } from "../nations/registry";
import { MODEL_SETS } from "./factionModels";
import "./actionBadges.css";

export type BadgeAction = "upgrade" | "capture" | "promote" | "examine" | "reactivate";
export type OpenBadge = (
  tileId: number,
  action: BadgeAction,
  unitId?: string,
) => void;

export type MapBadge = {
  tileId: number;
  position: [number, number, number];
  column?: number;
} & (
  | { action: "upgrade"; cityName: string; unitId?: undefined }
  | { action: "capture"; cityName: string; unitId: string }
  | { action: "promote" | "examine" | "reactivate"; unitName: string; unitId: string }
  | { action: "training"; cityName: string; unitId?: undefined }
);

const badgeKey = ({ tileId, action }: MapBadge) => `${tileId}:${action}`;
const compactZoom = 27;

const badgeStyles = {
  upgrade: { icon: ChevronsUp, title: "升级" },
  capture: { icon: Flag, title: "占领" },
  promote: { icon: Award, title: "晋升" },
  examine: { icon: Compass, title: "探索" },
  reactivate: { icon: RotateCcw, title: "激活" },
} as const;

export function getMapBadges(game: GameState, showActions = true): MapBadge[] {
  if (
    game.status !== "playing" ||
    game.players[0].eliminated
  )
    return [];
  const canAct = showActions && game.currentPlayer === 0;
  const size = game.options.size;
  const offset = (size - 1) / 2;
  const visible = new Set(game.players[0].visible);
  const garrisons = new Map(
    game.units
      .filter((unit) => unit.owner === 0)
      .map((unit) => [unit.y * size + unit.x, unit]),
  );
  const cityBadges = new Map<number, MapBadge>();
  const trainingBadges = new Map<number, MapBadge>();
  const unitBadges: MapBadge[] = [];
  const highRises = new Set<number>();

  function unitPosition(tileId: number, unit: Unit): MapBadge["position"] {
    const tile = game.tiles[tileId];
    const garrisonShift = tile.cityId ? 0.24 : 0;
    const { modelSet } = factionForOwner(game.players, unit.owner);
    // Keep action badges above the carving, including units garrisoning a tall city.
    return [
      unit.x - offset + garrisonShift,
      terrainHeight(tile) + Math.max(MODEL_SETS[modelSet].labelHeight(unit.type) + 0.34, highRises.has(tileId) ? 1.69 : 0),
      unit.y - offset + garrisonShift,
    ];
  }

  for (const city of game.cities) {
    const tileId = city.y * size + city.x;
    if (!visible.has(tileId)) continue;
    const floor = terrainHeight(game.tiles[tileId]);
    const x = city.x - offset;
    const z = city.y - offset;
    const unit = garrisons.get(tileId);
    const highRise = city.owner !== null && city.level >= 6;
    if (highRise) highRises.add(tileId);
    const cityTop: MapBadge["position"] = [x - 0.12, floor + (highRise ? 1.24 : 1.05), z - 0.12];
    if (city.owner === 0 && city.training) {
      const top = unit ? Math.max(cityTop[1], unitPosition(tileId, unit)[1]) : cityTop[1];
      trainingBadges.set(tileId, {
        action: "training", tileId, cityName: city.name,
        position: [cityTop[0], top, cityTop[2]],
      });
    }
    if (!canAct) continue;
    if (city.owner === 0 && city.pendingRewardLevels.length > 0) {
      cityBadges.set(tileId, {
        action: "upgrade",
        tileId,
        cityName: city.name,
        position: cityTop,
      });
    } else if (
      city.owner !== 0 &&
      unit &&
      !validateAction(game, { type: "CAPTURE", unitId: unit.id })
    ) {
      cityBadges.set(tileId, {
        action: "capture",
        tileId,
        cityName: city.name,
        unitId: unit.id,
        position: unitPosition(tileId, unit),
      });
    }
  }
  if (!canAct) return [...trainingBadges.values()];
  const groups = new Map<number, MapBadge[]>();
  for (const badge of cityBadges.values()) groups.set(badge.tileId, [badge]);
  for (const [tileId, unit] of garrisons) {
    if (!visible.has(tileId)) continue;
    const append = (action: "promote" | "examine" | "reactivate") => {
      const badge: MapBadge = {
        action, tileId, unitId: unit.id,
        unitName: UNITS[unit.type].name, position: unitPosition(tileId, unit),
      };
      unitBadges.push(badge);
      const group = groups.get(tileId);
      if (group) group.push(badge);
      else groups.set(tileId, [badge]);
    };
    if (unit.upkeep === "reactivation") {
      // Keep the one-turn deadline visible even when the player has to raise the fee.
      append("reactivate");
      continue;
    }
    if (unit.kills >= VETERAN_KILLS_REQUIRED && !unit.veteran &&
      !validateAction(game, { type: "PROMOTE", unitId: unit.id })) append("promote");
    if (game.tiles[tileId].ruin &&
      !validateAction(game, { type: "EXAMINE", unitId: unit.id })) append("examine");
  }
  for (const [tileId, actions] of groups) {
    const training = trainingBadges.get(tileId);
    if (actions.length === 1 && !training) continue;
    const [x, y, z] = actions[0].position;
    const height = Math.max(y, training?.position[1] ?? y, ...actions.map(badge => badge.position[1]));
    const position: MapBadge["position"] = [x, height, z];
    actions.forEach((badge, index) => {
      badge.position = position;
      badge.column = actions.length === 1 ? -0.85 : index * 2 - (actions.length - 1);
    });
    if (training) {
      training.position = position;
      training.column = actions.length === 1 ? 0.85 : actions.length + 0.45;
    }
  }
  return [...cityBadges.values(), ...unitBadges, ...trainingBadges.values()];
}

export interface MapBadgesProps {
  badges: MapBadge[];
  badgeElements: RefObject<Map<string, HTMLElement>>;
}

export function MapBadgeLayer({
  badges,
  badgeElements,
  onOpen,
  reducedMotion,
}: MapBadgesProps & { onOpen?: OpenBadge; reducedMotion?: boolean }) {
  return (
    <div
      className="map-action-layer"
      data-reduced-motion={reducedMotion || undefined}
    >
      {badges.map((badge) => {
        const key = badgeKey(badge);
        const setMarker = (element: HTMLElement | null) => {
          if (element) badgeElements.current.set(key, element);
          else badgeElements.current.delete(key);
        };
        if (badge.action === "training") return (
          <span key={key} ref={setMarker} className="map-action-badge" data-action="training"
            role="img" aria-label={`${badge.cityName}正在训练`}>
            <span className="map-action-tag"><Clock3 aria-hidden="true" size={15} strokeWidth={2.1} /></span>
          </span>
        );
        const { tileId, action, unitId } = badge;
        const { icon: Icon, title } = badgeStyles[action];
        const label = badge.action === "upgrade" ? `选择${badge.cityName}的升级奖励`
          : badge.action === "capture" ? `查看占领${badge.cityName}的单位`
          : badge.action === "promote" ? `查看可晋升老兵的${badge.unitName}`
          : badge.action === "examine" ? `查看可探索遗迹的${badge.unitName}`
          : `查看待重新激活的${badge.unitName}`;
        return (
          <button
            key={key}
            type="button"
            className="map-action-badge"
            data-action={action}
            aria-label={label}
            ref={setMarker}
            onClick={() => onOpen?.(tileId, action, unitId)}
          >
            <span className="map-action-tag">
              <Icon aria-hidden="true" size={16} strokeWidth={2.5} />
              <span>{title}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function projectMapBadge(
  badge: MapBadge,
  renderedIds: Set<number>,
  viewProjection: Matrix4,
  size: { width: number; height: number },
  screen: Vector3,
  compact = false,
): boolean {
  if (!renderedIds.has(badge.tileId)) return false;
  screen.fromArray(badge.position).applyMatrix4(viewProjection);
  if (
    Math.abs(screen.x) > 1 ||
    Math.abs(screen.y) > 1 ||
    Math.abs(screen.z) > 1
  )
    return false;
  screen.x = ((screen.x + 1) * size.width) / 2 + (badge.column ?? 0) * (compact ? 18 : 36);
  screen.y = ((1 - screen.y) * size.height) / 2;
  return true;
}

// Keep badges anchored to their models without a React
// update on every camera frame. The same tile budget as the 3D models applies.
export function MapBadgePositions({
  badges,
  badgeElements,
  renderedIds,
}: MapBadgesProps & { renderedIds: Set<number> }) {
  const point = useRef(new Vector3());
  const matrix = useRef(new Matrix4());
  const previous = useRef({
    matrix: new Matrix4(),
    width: -1,
    height: -1,
    badges: null as MapBadge[] | null,
    renderedIds: null as Set<number> | null,
  });
  useFrame(({ camera, size }) => {
    if (badges.length === 0) return;
    const view = previous.current;
    camera.updateMatrixWorld();
    matrix.current.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    if (
      view.badges === badges &&
      view.renderedIds === renderedIds &&
      view.width === size.width &&
      view.height === size.height &&
      view.matrix.equals(matrix.current)
    )
      return;
    view.matrix.copy(matrix.current);
    Object.assign(view, {
      badges,
      renderedIds,
      width: size.width,
      height: size.height,
    });
    const compact = camera.zoom < compactZoom;
    for (const badge of badges) {
      const element = badgeElements.current.get(badgeKey(badge));
      if (!element) {
        view.badges = null;
        continue;
      }
      const inView = projectMapBadge(
        badge,
        renderedIds,
        matrix.current,
        size,
        point.current,
        compact,
      );
      element.style.visibility = inView ? "visible" : "hidden";
      if (!inView) continue;
      element.style.left = `${point.current.x.toFixed(1)}px`;
      element.style.top = `${point.current.y.toFixed(1)}px`;
      element.toggleAttribute("data-compact", compact);
    }
  });
  return null;
}
