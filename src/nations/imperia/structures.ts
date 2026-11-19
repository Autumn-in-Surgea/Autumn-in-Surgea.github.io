import type { BuildingId } from "../../game/types";
import { brass, brick, copper, ink, ivory, masonry } from "../../scene/architecturalPalette";
import type { BuildingVisualTier } from "../../scene/buildingVisualTier";
import type { Miniature } from "../../scene/miniature";
import { danubianBuilding } from "../_shared/danubian/buildings";
import { danubianCity } from "../_shared/danubian/cities";
import { imperialLiaoCompanions } from "./liaoCities";
import { imperialCivicCompanions } from "./civicCities";
import { imperialBundCompanions } from "./bundCities";

const roofStyles = ["hip", "clerestory", "canopy", "cupola"] as const;
type RoofStyle = typeof roofStyles[number];
export const imperialVariantCount = roofStyles.length;
const roofStyle = (index: number) => roofStyles[index] ?? roofStyles[0];

type Lot = readonly [x: number, z: number, width: number];
const timber = "#824634";
const tile = "#b34e3c";
const glass = "#80aab6";

function annex(m: Miniature, [x, z, w]: Lot, base: number, style: RoofStyle, roof: string, wall: string) {
  const d = w * 0.70;
  const h = w * 0.44;
  const eave = base + h;
  if (style === "canopy") {
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      m.box(timber, x + a * w * 0.36, base + h * 0.47, z + b * d * 0.38, w * 0.10, h * 0.94, w * 0.10);
    }
    m.box(brick, x, base + h * 0.16, z, w * 0.56, h * 0.32, d * 0.48);
    m.box(roof, x, eave, z, w, h * 0.20, d, -0.24);
    for (const side of [-1, 1]) {
      m.box(masonry, x + side * w * 0.21, eave + h * 0.06, z, w * 0.12, h * 0.22, d * 0.95, -0.24);
    }
    return;
  }
  if (style === "cupola") {
    m.part("octagon", wall, x, base + h * 0.44, z, d, h * 0.88, d);
    m.box(ink, x, base + h * 0.48, z + d * 0.47, w * 0.27, h * 0.62, w * 0.025);
    m.part("octagon", brass, x, eave - h * 0.09, z, d * 1.17, h * 0.15, d * 1.17);
    m.part("spire", roof, x, eave + h * 0.20, z, d * 1.25, h * 0.61, d * 1.25);
    m.part("gem", brass, x, eave + h * 0.53, z, w * 0.15, h * 0.30, w * 0.15);
    return;
  }
  m.box(wall, x, base + h * 0.48, z, w * 0.88, h * 0.96, d * 0.88);
  for (const a of [-1, 1]) {
    m.box(ink, x + a * w * 0.22, base + h * 0.65, z + d * 0.45, w * 0.15, h * 0.39, w * 0.025);
  }
  if (style === "hip") {
    m.box(masonry, x, eave - h * 0.04, z, w, h * 0.13, d);
    m.part("hip", roof, x, eave + h * 0.22, z, w * 1.08, h * 0.51, d * 1.06);
    m.box(brick, x - w * 0.23, eave + h * 0.28, z - d * 0.17, w * 0.13, h * 0.60, w * 0.12);
  } else {
    m.box(roof, x, eave, z, w, h * 0.13, d);
    m.box(glass, x, eave + h * 0.16, z - d * 0.08, w * 0.68, h * 0.28, d * 0.42);
    m.box(copper, x, eave + h * 0.33, z - d * 0.08, w * 0.74, h * 0.16, d * 0.50);
  }
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

function yard(m: Miniature, [x, z, w]: Lot, base: number, style: RoofStyle, enamel: string) {
  const d = w * 0.66;
  if (style === "hip") {
    for (const side of [-1, 1]) {
      m.box(timber, x + side * w * 0.22, base + d * 0.27, z, w * 0.39, d * 0.54, d);
      m.box(masonry, x + side * w * 0.22, base + d * 0.46, z, w * 0.43, d * 0.18, d * 1.03);
    }
    m.box(enamel, x + w * 0.19, base + d * 0.70, z - d * 0.13, w * 0.32, d * 0.40, d * 0.62);
  } else if (style === "clerestory") {
    m.part("drum", brick, x, base + d * 0.44, z, w * 0.54, d * 0.88, w * 0.54);
    m.part("disc", brass, x, base + d * 0.78, z, w * 0.60, d * 0.17, w * 0.60);
    m.beam(ink, [x, base + d * 0.87, z], [x, base + d * 1.19, z], w * 0.16);
    m.beam(ink, [x, base + d * 1.19, z], [x + w * 0.43, base + d * 1.19, z], w * 0.16);
  } else if (style === "canopy") {
    annex(m, [x, z, w], base, "canopy", tile, ivory);
  } else {
    m.box(ink, x, base + d * 0.11, z, w * 0.83, d * 0.22, d * 0.83);
    const peak: [number, number, number] = [x - w * 0.11, base + d * 1.55, z - d * 0.17];
    for (const side of [-1, 1]) {
      m.beam(timber, [x + side * w * 0.35, base + d * 0.20, z + d * 0.32], peak, w * 0.12);
    }
    m.beam(brass, peak, [x + w * 0.44, base + d * 1.28, z + d * 0.12], w * 0.10);
    m.beam(ink, [x + w * 0.44, base + d * 1.28, z + d * 0.12], [x + w * 0.44, base + d * 0.55, z + d * 0.12], w * 0.048);
  }
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

export function imperialBuilding(type: BuildingId, color: string, tier: BuildingVisualTier, variant = 0) {
  const style = roofStyle(variant);
  return danubianBuilding(type, color, tier, (m, roof, ground) => {
    if (type === "port") {
      yard(m, [0.223 + tier * 0.035, -0.048, 0.098], 0.143, style, roof);
    } else if (type === "bridge") {
      const edge = (0.245 + 0.038 * tier) / 2 + 0.006;
      const rail = 0.208 + [0, 0.068, 0.126][tier - 1];
      for (const side of [-1, 1]) annex(m, [side * edge, 0, 0.074], rail, style, roof, masonry);
    } else if (type === "waterTemple") {
      // The side basin supports the ornament above its timber piles.
      const edge = (0.239 + tier * 0.044) / 2 + 0.027;
      annex(m, [edge, 0.067, 0.088], 0.107, style, roof, ivory);
    } else if (industrialLots[type]) {
      yard(m, industrialLots[type], ground, style, roof);
    } else if (civicLots[type]) {
      annex(m, civicLots[type], ground, style, roof, ivory);
    }
  });
}
