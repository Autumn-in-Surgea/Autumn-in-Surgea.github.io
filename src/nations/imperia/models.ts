import { danubianModels } from "../_shared/danubian";
import { imperialBuilding, imperialCity, imperialVariantCount } from "./structures";

export const models = {
  ...danubianModels,
  city: imperialCity,
  building: imperialBuilding,
  structureVariantCount: imperialVariantCount,
};

export { imperialTerrain as terrain } from "./terrain";
