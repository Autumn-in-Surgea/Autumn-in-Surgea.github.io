import { isUnitVisible, tileAt } from "../game/rules/engine";
import type { Action, GameEvent, GameState } from "../game/types";

import type { StructureChange } from "./structurePlayback";

export const ACTION_GAP_MS = 120;

export interface PlaybackStep {
  id: number;
  focusTile: number | null;
  structures: ReadonlyMap<number, StructureChange>;
  structureDuration: number;
}

/** Only observed positions can influence the camera or presentation time. */
export function observedActionTile(
  before: GameState,
  after: GameState,
  action: Action,
  events: readonly GameEvent[],
): number | null {
  const seen = new Set(before.players[0].visible);
  const visible = new Set(after.players[0].visible);
  for (const event of events) {
    if (event.combat?.targetVisible && event.at) return tileAt(after, event.at).id;
  }
  const lastEventId = before.events.at(-1)?.id ?? 0;
  for (const event of after.events) {
    if (event.id <= lastEventId || !event.at) continue;
    if (event.type !== "capture" && event.type !== "upgrade") continue;
    const id = tileAt(after, event.at).id;
    if (seen.has(id) || visible.has(id)) return id;
  }
  if (action.type === "CONVERT") {
    const target = before.units.find((unit) => unit.id === action.targetId);
    if (target && isUnitVisible(before, target, 0)) return tileAt(before, target).id;
  }
  if ("unitId" in action) {
    const original = before.units.find((unit) => unit.id === action.unitId);
    const current = after.units.find((unit) => unit.id === action.unitId);
    if (original && isUnitVisible(before, original, 0)) return tileAt(before, original).id;
    if (current && isUnitVisible(after, current, 0)) return tileAt(after, current).id;
    return null;
  }
  if ("tileId" in action)
    return seen.has(action.tileId) || visible.has(action.tileId) ? action.tileId : null;
  if ("cityId" in action) {
    const city = after.cities.find((item) => item.id === action.cityId);
    if (city) {
      const id = tileAt(after, city).id;
      if (seen.has(id) || visible.has(id)) return id;
    }
  }
  return null;
}
