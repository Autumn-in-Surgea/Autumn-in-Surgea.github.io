import type { BuildingId } from "../../game/types";
import { brick, ink, ivory, masonry } from "../../scene/architecturalPalette";
import type { BuildingVisualTier } from "../../scene/buildingVisualTier";
import type { Miniature } from "../../scene/miniature";
import { danubianBuilding } from "../_shared/danubian/buildings";
import { danubianCity } from "../_shared/danubian/cities";
import { imperialLiaoCompanions } from "./liaoCities";
import { imperialCivicCompanions } from "./civicCities";
import { imperialBundCompanions } from "./bundCities";

export const imperialVariantCount = 4;

type Lot = readonly [x: number, z: number, width: number];
const timber = "#824634";

function annex(m: Miniature, [x, z, w]: Lot, base: number, roof: string, wall: string) {
  const d = w * 0.70;
  const h = w * 0.44;
  const eave = base + h;
  m.box(wall, x, base + h * 0.48, z, w * 0.88, h * 0.96, d * 0.88);
  for (const a of [-1, 1]) {
    m.box(ink, x + a * w * 0.22, base + h * 0.65, z + d * 0.45, w * 0.15, h * 0.39, w * 0.025);
  }
  m.box(masonry, x, eave - h * 0.04, z, w, h * 0.13, d);
  m.part("hip", roof, x, eave + h * 0.22, z, w * 1.08, h * 0.51, d * 1.06);
  m.box(brick, x - w * 0.23, eave + h * 0.28, z - d * 0.17, w * 0.13, h * 0.60, w * 0.12);
}

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

function yard(m: Miniature, [x, z, w]: Lot, base: number, enamel: string) {
  const d = w * 0.66;
  for (const side of [-1, 1]) {
    m.box(timber, x + side * w * 0.22, base + d * 0.27, z, w * 0.39, d * 0.54, d);
    m.box(masonry, x + side * w * 0.22, base + d * 0.46, z, w * 0.43, d * 0.18, d * 1.03);
  }
  m.box(enamel, x + w * 0.19, base + d * 0.70, z - d * 0.13, w * 0.32, d * 0.40, d * 0.62);
}

const industrialLots: Partial<Record<BuildingId, Lot>> = {
  farm: [0.224, 0.205, 0.128], windmill: [0.138, 0.198, 0.129],
  lumberHut: [-0.157, 0.196, 0.120], sawmill: [-0.196, 0.171, 0.133],
  mine: [0.254, 0.205, 0.111], forge: [0.139, 0.175, 0.129],
};
const civicLots: Partial<Record<BuildingId, Lot>> = {
  market: [0.100, 0.242, 0.117], grandBazaar: [0.038, 0.240, 0.121],
  temple: [0.166, 0.159, 0.101], forestTemple: [0.161, 0.161, 0.095], mountainTemple: [-0.160, 0.151, 0.096],
  altarOfPeace: [0.089, 0.190, 0.104], emperorTomb: [0.165, 0.113, 0.091],
  eyeOfGod: [0.123, 0.089, 0.100], gateOfPower: [0.017, 0.115, 0.105],
  parkOfFortune: [0.021, 0.190, 0.085], towerOfWisdom: [0.114, 0.130, 0.105],
};

export function imperialBuilding(type: BuildingId, color: string, tier: BuildingVisualTier) {
  return danubianBuilding(type, color, tier, (m, roof, ground) => {
    if (type === "port") {
      yard(m, [0.223 + tier * 0.035, -0.048, 0.098], 0.143, roof);
    } else if (type === "bridge") {
      const edge = (0.245 + 0.038 * tier) / 2 + 0.006;
      const rail = 0.208 + [0, 0.068, 0.126][tier - 1];
      for (const side of [-1, 1]) annex(m, [side * edge, 0, 0.074], rail, roof, masonry);
    } else if (type === "waterTemple") {
      // The side basin supports the ornament above its timber piles.
      const edge = (0.239 + tier * 0.044) / 2 + 0.027;
      annex(m, [edge, 0.067, 0.088], 0.107, roof, ivory);
    } else if (industrialLots[type]) {
      yard(m, industrialLots[type], ground, roof);
    } else if (civicLots[type]) {
      annex(m, civicLots[type], ground, roof, ivory);
    }
  });
}
