import { nationalUnits } from "../_shared/pawns";
import { danubianModels } from "../_shared/danubian";
import { imperialBuilding, imperialCity, imperialVariantCount } from "./structures";

export const models = {
  ...danubianModels,
  ...nationalUnits("imperia"),
  city: imperialCity,
  building: imperialBuilding,
  structureVariantCount: imperialVariantCount,
};

export { imperialTerrain as terrain } from "./terrain";
