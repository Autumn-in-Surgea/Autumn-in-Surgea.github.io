import type { UnitType } from "../../../game/types";
import type { NationId } from "../../registry";
import { bakeUnit, type BoardUnitGeometry } from "./bake";
import { fleetUnit, isVessel } from "./fleet";
import { groundUnit, landMuzzles } from "./land";

export function nationalUnits(nation: NationId) {
  const cache = new Map<UnitType, BoardUnitGeometry>();
  function unit(type: UnitType) {
    let geometry = cache.get(type);
    if (!geometry) {
      const sculpt = isVessel(type) ? fleetUnit(nation, type) : groundUnit(nation, type);
      geometry = bakeUnit(sculpt);
      cache.set(type, geometry);
    }
    return geometry;
  }
  function labelHeight(type: UnitType) {
    const { body, enamel } = unit(type);
    return Math.max(body.boundingBox!.max.y, enamel.boundingBox!.max.y) + .13;
  }
  return { unit, labelHeight, weaponMuzzles:landMuzzles };
}
