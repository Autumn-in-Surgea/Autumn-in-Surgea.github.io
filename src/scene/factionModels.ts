import type { ModelSetId } from "../factions/registry";
import type { UnitType } from "../game/types";
import { cityModel, buildingModel } from "./architecture";
import { resourceModel } from "./landscape";
import { danubianUnit } from "../factions/danubian/units";

// Anchors are part of the sculpture set so other hats and masts can use their own clearance.
const tallPieceLabels: Partial<Record<UnitType, number>> = {
  warrior: 1.01, defender: 1.01, archer: 0.99, swordsman: 1.04,
  mindBender: 1.04, rider: 1.09, knight: 1.09, giant: 1.14,
};
const danubian = {
  unit: danubianUnit,
  city: cityModel,
  building: buildingModel,
  resource: resourceModel,
  labelHeight: (type: UnitType) => tallPieceLabels[type] ?? 0.84,
};
export const MODEL_SETS: Record<ModelSetId, typeof danubian> = { danubian };
