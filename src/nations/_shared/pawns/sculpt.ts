import { Group } from "three";
import type { UnitType } from "../../../game/types";
import type { NationId } from "../../types";
import { imperia } from "../../imperia/headwear";
import { determia } from "../../determia/headwear";
import { nosta } from "../../nosta/headwear";
import { ida } from "../../ida/headwear";
import { rina } from "../../rina/headwear";
import { makePawnBody } from "./body";
import { makeTool } from "./equipment";
import { pawnProfiles, type PawnProfile } from "./roles";

const milliners = { imperia, determia, nosta, ida, rina } satisfies Record<NationId, () => Group>;
const hats = new Map<NationId, Group>();
const uniforms = new Map<PawnProfile, Group>();

/** +Z is forward. Fit around the origin at the brow; the puppet owns the hat socket. */
export function makeNationHat(nation: NationId): Group {
  let hat = hats.get(nation);
  if (!hat) {
    hat = milliners[nation]();
    hat.name = nation + " headwear B";
    hat.scale.multiplyScalar(0.9);
    hats.set(nation, hat);
  }
  return hat.clone();
}

export function makePawn(nation: NationId, type: UnitType): Group {
  const profile: PawnProfile = pawnProfiles[type];
  let body = uniforms.get(profile);
  if (!body) {
    body = makePawnBody(profile, profile.hands);
    if (profile.equipment) {
      const { tool, pose } = profile.equipment;
      const equipment = makeTool(tool);
      equipment.name = tool;
      equipment.userData.heldEquipment = true;
      equipment.position.fromArray(pose.anchor);
      equipment.rotation.set(...pose.tilt);
      equipment.scale.setScalar(pose.size);
      body.add(equipment);
    }
    uniforms.set(profile, body);
  }
  const pawn = body.clone();
  pawn.name = nation + " " + type;
  pawn.getObjectByName("Hat socket")!.add(makeNationHat(nation));
  return pawn;
}
