import type { WitnessedMove } from "./combatEvents";
import { observeMove } from "./visibleMove";
import type { GameEvent } from "../game/types";
import { runAiTurnDetailed } from "../game/ai/ai";
import type { AiRequest, AiResponse } from "./aiProtocol";

// No DOM, store, rendering, or network access belongs in the AI worker.
self.onmessage = (event: MessageEvent<AiRequest>) => {
  const request = event.data;
  if (request.type !== "RUN_TURN") return;
  let response: AiResponse;
  try {
    const moves: WitnessedMove[] = [];
    const combatEvents: GameEvent[] = [];
    const { state } = runAiTurnDetailed(
      request.state,
      undefined,
      (before, after, action) => {
        if (action.type !== "ATTACK" && action.type !== "MOVE") return;
        const movement = observeMove(before, after, action);
        if (movement) moves.push(movement);
        const lastId = before.events.at(-1)?.id ?? 0;
        for (const event of after.events)
          if (event.id > lastId && event.combat?.targetVisible)
            combatEvents.push(event);
      },
    );
    response = {
      type: "TURN_COMPLETE",
      requestId: request.requestId,
      state,
      combatEvents,
      moves,
    };
  } catch (error) {
    response = {
      type: "TURN_ERROR",
      requestId: request.requestId,
      error: error instanceof Error ? error.message : "AI 计算失败。",
    };
  }
  self.postMessage(response);
};
