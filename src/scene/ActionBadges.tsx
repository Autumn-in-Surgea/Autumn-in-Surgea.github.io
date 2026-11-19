import { useRef } from "react";
import type { RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Award, ChevronsUp, Flag } from "lucide-react";
import { Matrix4, Vector3 } from "three";
import { validateAction } from "../game/rules/engine";
import { UNITS, VETERAN_KILLS_REQUIRED } from "../game/data/config";
import type { GameState, Unit } from "../game/types";
import { terrainHeight } from "./models";
import { factionForOwner } from "../nations/registry";
import { MODEL_SETS } from "./factionModels";
import "./actionBadges.css";

export type BadgeAction = "upgrade" | "capture" | "promote";
export type OpenBadge = (
  tileId: number,
  action: BadgeAction,
  unitId?: string,
) => void;

export type MapBadge = {
  tileId: number;
  position: [number, number, number];
  column?: -1 | 1;
} & (
  | { action: "upgrade"; cityName: string; unitId?: undefined }
  | { action: "capture"; cityName: string; unitId: string }
  | { action: "promote"; unitName: string; unitId: string }
);

const badgeKey = ({ tileId, action }: MapBadge) => `${tileId}:${action}`;
const compactZoom = 27;

const badgeStyles = {
  upgrade: { icon: ChevronsUp, title: "升级" },
  capture: { icon: Flag, title: "占领" },
  promote: { icon: Award, title: "晋升" },
} as const;

export function getMapBadges(game: GameState): MapBadge[] {
  if (
    game.status !== "playing" ||
    game.currentPlayer !== 0 ||
    game.players[0].eliminated
  )
    return [];
  const size = game.options.size;
  const offset = (size - 1) / 2;
  const visible = new Set(game.players[0].visible);
  const garrisons = new Map(
    game.units
      .filter((unit) => unit.owner === 0)
      .map((unit) => [unit.y * size + unit.x, unit]),
  );
  const cityBadges = new Map<number, MapBadge>();
  const badges: MapBadge[] = [];
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
    if (city.owner === 0 && city.pendingRewardLevels.length > 0) {
      cityBadges.set(tileId, {
        action: "upgrade",
        tileId,
        cityName: city.name,
        position: [x - 0.12, floor + (highRise ? 1.24 : 1.05), z - 0.12],
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
  for (const [tileId, unit] of garrisons) {
    if (unit.kills < VETERAN_KILLS_REQUIRED || unit.veteran || !visible.has(tileId) ||
      validateAction(game, { type: "PROMOTE", unitId: unit.id })) continue;
    const position = unitPosition(tileId, unit);
    const cityBadge = cityBadges.get(tileId);
    if (cityBadge) {
      position[0] = cityBadge.position[0];
      position[1] = Math.max(position[1], cityBadge.position[1]);
      position[2] = cityBadge.position[2];
      cityBadge.position = position;
      cityBadge.column = -1;
    }
    badges.push({
      action: "promote", tileId, unitId: unit.id,
      unitName: UNITS[unit.type].name,
      position, column: cityBadge ? 1 : undefined,
    });
  }
  return [...cityBadges.values(), ...badges];
}

export interface MapBadgesProps {
  badges: MapBadge[];
  badgeButtons: RefObject<Map<string, HTMLButtonElement>>;
}

export function MapBadgeButtons({
  badges,
  badgeButtons,
  onOpen,
  reducedMotion,
}: MapBadgesProps & { onOpen: OpenBadge; reducedMotion?: boolean }) {
  return (
    <div
      className="map-action-layer"
      data-reduced-motion={reducedMotion || undefined}
    >
      {badges.map((badge) => {
        const { tileId, action, unitId } = badge;
        const key = badgeKey(badge);
        const { icon: Icon, title } = badgeStyles[action];
        const label = badge.action === "upgrade" ? `选择${badge.cityName}的升级奖励`
          : badge.action === "capture" ? `查看占领${badge.cityName}的单位`
          : `查看可晋升老兵的${badge.unitName}`;
        return (
          <button
            key={key}
            type="button"
            className="map-action-badge"
            data-action={action}
            aria-label={label}
            ref={(button) => {
              if (button) badgeButtons.current.set(key, button);
              else badgeButtons.current.delete(key);
            }}
            onClick={() => onOpen(tileId, action, unitId)}
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

// Keep native, keyboard-accessible buttons anchored to their models without a React
// update on every camera frame. The same tile budget as the 3D models applies.
export function MapBadgePositions({
  badges,
  badgeButtons,
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
      const button = badgeButtons.current.get(badgeKey(badge));
      if (!button) {
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
      button.style.visibility = inView ? "visible" : "hidden";
      if (!inView) continue;
      button.style.left = `${point.current.x.toFixed(1)}px`;
      button.style.top = `${point.current.y.toFixed(1)}px`;
      button.toggleAttribute("data-compact", compact);
    }
  });
  return null;
}
