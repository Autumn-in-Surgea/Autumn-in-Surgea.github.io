import { Miniature } from "../../../scene/miniature";
import { architecturalEnamel, brass, cobalt, masonry } from "../../../scene/architecturalPalette";
import { cityStreetDatum } from "./cityMasonry";
import { liaoVillage, liaoTown } from "./liaoSettlements";
import { treatyShops, merchantQuarter, judicialQuarter } from "./civicDistricts";
import { bundNeighbourhood, bundSkyline } from "./bundDistricts";

const footing = "#928980";

function standard(m: Miniature, x: number, z: number, foot: number, height: number, color: string) {
  m.part("octagon", brass, x, foot + height / 2, z, 0.013, height, 0.013);
  const top = foot + height;
  m.box(color, x - 0.044, top - 0.031, z, 0.094, 0.049, 0.009);
  m.part("gem", brass, x, top + 0.006, z, 0.018, 0.022, 0.018);
}

function fortifications(m: Miniature, edge: number) {
  const span = 2 * edge;
  for (const s of [-1, 1]) {
    m.box(footing, s * edge, 0.109, 0, 0.031, 0.14, span);
    m.box(masonry, s * edge, 0.184, 0, 0.04, 0.016, span);
    m.box(footing, s * edge * 0.6, 0.102, edge, edge * 0.8, 0.125, 0.032);
    for (const end of [-1, 1]) {
      m.part("octagon", masonry, s * edge, 0.135, end * edge, 0.069, 0.18, 0.069);
      m.part("octagon", cobalt, s * edge, 0.228, end * edge, 0.074, 0.026, 0.074);
    }
  }
  m.box(footing, 0, 0.109, -edge, span, 0.14, 0.032);
}

const stages = [liaoVillage, liaoTown, treatyShops, merchantQuarter, judicialQuarter, bundNeighbourhood, bundSkyline];
const widths = [0.47, 0.60, 0.68, 0.77, 0.85, 0.975, 0.975];
// Small settlements grow across the square. The big districts already reach
// their tile boundaries, so their additional volume goes into the skyline.
const footprints = [1.55, 1.39, 1.26, 1.21, 1.12, 1, 1];
const elevations = [1.36, 1.25, 1.30, 1.24, 1.25, 1.27, 1.24];

export function danubianCity(color: string, level: number, capital: boolean, walls: boolean) {
  const stage = Math.min(level, stages.length - 1);
  const width = widths[stage];
  const model = new Miniature();
  const enamel = architecturalEnamel(color);
  stages[stage](model, enamel);
  if (walls && stage > 0) fortifications(model, width / 2 - 0.026);
  if (capital && stage > 0) {
    if (stage === 6) standard(model, 0.005, -0.400, 0.836, 0.118, enamel);
    else if (stage === 5) standard(model, -0.169, -0.123, 0.643, 0.102, enamel);
    else standard(model, width / 2 - 0.038, -width / 2 + 0.041, 0.051, 0.18 + stage * 0.04, enamel);
  }
  const widthScale = footprints[stage];
  return model.finish().translate(0, -cityStreetDatum, 0).scale(widthScale, elevations[stage], widthScale);
}
