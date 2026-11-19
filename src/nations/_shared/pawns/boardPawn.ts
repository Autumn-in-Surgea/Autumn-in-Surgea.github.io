import type { UnitType } from "../../../game/types";
import type { NationId } from "../../registry";
import { makePawn } from "./sculpt";

/** A dressed pawn in the board's -Z facing, ready to stand on a deck, seat or enamel disk. */
export function boardPawn(nation: NationId, type: UnitType) {
  const pawn = makePawn(nation,type);
  for (const name of ["Turned walnut foot", "Metal thread"]) pawn.getObjectByName(name)?.removeFromParent();
  pawn.rotation.y = Math.PI;
  return pawn;
}
