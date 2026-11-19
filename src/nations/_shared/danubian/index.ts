import type { BuildingId, UnitType } from "../../../game/types";
import type { BuildingVisualTier } from "../../../scene/buildingVisualTier";
import { danubianBuilding } from "./buildings";
import { danubianCity } from "./cities";
import { danubianUnit } from "./units";

// Anchors are model-specific so another armour or sail design can reposition HP labels.
const tallPieceLabels: Partial<Record<UnitType, number>> = {
  warrior: .96, defender: .98, archer: .96, swordsman: .96,
  mindBender: .99, cloak: .95, dagger: .95, rider: 1.02, knight: 1.01, giant: 1.20,
  raft: .57, dinghy: .51, scout: .85, rammer: .48,
  bomber: .81, juggernaut: .94, pirate: .71,
};
export const danubianModels = {
  unit: danubianUnit,
  city: (color: string, level: number, capital: boolean, walls: boolean) => danubianCity(color, level, capital, walls),
  building: (type: BuildingId, color: string, tier: BuildingVisualTier) => danubianBuilding(type, color, tier),
  labelHeight: (type: UnitType) => tallPieceLabels[type] ?? 0.84,
};
