import type { WitnessedMove } from "./combatEvents";
import type { Action, GameState, GameEvent } from "../game/types";

export interface AiRequest {
  type: "RUN_TURN" | "PLAN_TURN";
  requestId: number;
  state: GameState;
}

export type AiResponse =
  | { type: "TURN_PLAN"; requestId: number; actions: Action[] }
  | {
      type: "TURN_COMPLETE";
      requestId: number;
      state: GameState;
      combatEvents?: GameEvent[];
      moves?: WitnessedMove[];
    }
  | { type: "TURN_ERROR"; requestId: number; error: string };
