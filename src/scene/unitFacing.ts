import type { Position } from "../game/types";
import type { UnitCue } from "./motion";

// The fixed camera looks from +X/+Z. Models are fronted along local -Z.
export const unitFacingYaw = { left: Math.PI, right: -Math.PI / 2 };
export type UnitFacing = keyof typeof unitFacingYaw;
export interface UnitTurn {
  at: number;
  facing: UnitFacing;
}

export function planUnitTurns(
  cue: Pick<UnitCue, "journey" | "from" | "attacks" | "impacts">,
  destination: Position,
  moveDelay: number,
): UnitTurn[] {
  const turns: UnitTurn[] = [];
  const turnToward = (at: number, from: Position, to: Position) => {
    // Screen right is +X/-Z, so positions aligned in this projection keep their side.
    const horizontal = (to.x - from.x) - (to.y - from.y);
    if (horizontal) turns.push({ at, facing: horizontal < 0 ? "left" : "right" });
  };
  if (cue.journey?.length) {
    for (const leg of cue.journey) {
      const goal = leg.path.at(-1);
      if (goal) turnToward(leg.start, leg.from, goal);
    }
  } else if (cue.from) {
    turnToward(moveDelay, cue.from, destination);
  }
  for (const shot of cue.attacks ?? [])
    if (shot.from) turnToward(shot.start, shot.from, shot.at);
  for (const hit of cue.impacts ?? []) {
    const origin = hit.from ?? hit.areaOrigin;
    if (origin) turnToward(hit.impact, hit.at, origin);
  }
  return turns.sort((a, b) => a.at - b.at);
}

export function unitFacingAt(
  turns: readonly UnitTurn[],
  elapsed: number,
  initial: UnitFacing,
): UnitFacing {
  for (let i = turns.length - 1; i >= 0; i--)
    if (turns[i].at <= elapsed) return turns[i].facing;
  return initial;
}
