import { danubianCity } from "../_shared/danubian/cities";
import { imperialLiaoCompanions } from "./liaoCities";
import { imperialCivicCompanions } from "./civicCities";
import { imperialBundCompanions } from "./bundCities";

export const imperialVariantCount = 4;

export function imperialCity(color: string, level: number, capital: boolean, walls: boolean, variant = 0) {
  return danubianCity(color, level, capital, walls, {
    companions(model, stage, enamel) {
      const sculpt = stage < 2 ? imperialLiaoCompanions : stage < 5 ? imperialCivicCompanions : imperialBundCompanions;
      sculpt(model, stage, enamel, variant);
    },
    // The flagpole stands on the fixed pyramid tower's podium roof.
    skylineFlag: [0.10, -0.020, 0.631, 0.118],
  });
}

export { danubianBuilding as imperialBuilding } from "../_shared/danubian/buildings";
