import { danubianModels } from "./_shared/danubian";
import { models as imperia } from "./imperia/models";
import { models as determia } from "./determia/models";
import { models as nosta } from "./nosta/models";
import { models as ida } from "./ida/models";
import { models as rina } from "./rina/models";

export type NationModels = typeof danubianModels;
export const MODEL_SETS = {
  danubian: danubianModels,
  imperia,
  determia,
  nosta,
  ida,
  rina,
} satisfies Record<string, NationModels>;

export type ModelSetId = keyof typeof MODEL_SETS;
