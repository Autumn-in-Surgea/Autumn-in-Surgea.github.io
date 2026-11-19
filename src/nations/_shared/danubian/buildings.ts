import type { BuildingId } from "../../../game/types";
import { facilityLayoutTier, type BuildingVisualTier } from "../../../scene/buildingVisualTier";
import { Miniature } from "../../../scene/miniature";
import { civicExpansion, civicGround } from "./civicGrounds";
import { farm, forge, industrialExpansion, mine, timberWorks, windmill } from "./workyards";
import { bridge, cargoTerminal, port, throughTruss } from "./waterworks";

export { mineOreSculpture } from "./workyards";

export function danubianBuilding(type: BuildingId, color: string, stage: BuildingVisualTier, includeNativeStock = true) {
  const m = new Miniature();
  const tier = facilityLayoutTier(stage);
  switch (type) {
    case "farm": farm(m, color, tier, includeNativeStock); break;
    case "lumberHut":
    case "sawmill": timberWorks(m, color, tier, type === "sawmill"); break;
    case "mine": mine(m, color, tier, includeNativeStock); break;
    case "windmill": windmill(m, color, tier); break;
    case "forge": forge(m, color, tier); break;
    case "port":
      port(m, color, tier);
      if (stage === 3) cargoTerminal(m, color);
      return m.finish();
    case "bridge":
      bridge(m, color, tier);
      if (stage === 3) throughTruss(m);
      return m.finish();
    default:
      civicGround(m, type, color, tier);
      if (stage === 3) civicExpansion(m, type, color);
      return m.finish();
  }
  if (stage === 3) industrialExpansion(m, type, color);
  return m.finish();
}
