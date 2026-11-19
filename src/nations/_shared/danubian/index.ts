import type { UnitType } from "../../../game/types";
import { danubianBuilding } from "./buildings";
import { danubianCity } from "./cities";
import { danubianUnit, fieldGunMuzzle, rifleMuzzle } from "./units";

// Model-specific heights keep action badges above helmets and masts.
const tallPieceLabels: Partial<Record<UnitType, number>> = {
  warrior: .96, defender: .98, archer: .96, swordsman: .96,
  mindBender: .99, cloak: .95, dagger: .95, rider: 1.02, knight: 1.01, giant: 1.20,
  raft: .57, dinghy: .51, scout: .85, rammer: .48,
  bomber: .81, juggernaut: .94, pirate: .71,
};
const weaponMuzzles: Partial<Record<UnitType, [number, number, number]>> = {
  archer: rifleMuzzle,
  catapult: fieldGunMuzzle,
};
export const danubianModels = {
  unit: danubianUnit,
  weaponMuzzles,
  city: (color: string, level: number, capital: boolean, walls: boolean) => danubianCity(color, level, capital, walls),
  building: danubianBuilding,
  labelHeight: (type: UnitType) => tallPieceLabels[type] ?? 0.84,
};
