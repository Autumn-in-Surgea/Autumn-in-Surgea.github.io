import type { UnitType } from "../../../game/types";
import { resourceModel } from "../../../scene/landscape";
import { danubianBuilding } from "./buildings";
import { danubianCity } from "./cities";
import { danubianUnit } from "./units";

// Anchors are model-specific so another armour or sail design can reposition HP labels.
const tallPieceLabels: Partial<Record<UnitType, number>> = {
  warrior: 1.01, defender: 1.01, archer: 0.99, swordsman: 1.04,
  mindBender: 1.04, rider: 1.09, knight: 1.09, giant: 1.14,
};
export const danubianModels = {
  unit: danubianUnit,
  city: danubianCity,
  building: danubianBuilding,
  resource: resourceModel,
  labelHeight: (type: UnitType) => tallPieceLabels[type] ?? 0.84,
};
