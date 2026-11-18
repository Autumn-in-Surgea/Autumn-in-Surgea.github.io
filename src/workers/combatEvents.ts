import type { GameEvent, GameState } from "../game/types";

export interface WitnessedMove {
  id: number;
  unitId: string;
  path: number[];
}
interface AiPresentation {
  round: number;
  attacks: GameEvent[];
  moves: WitnessedMove[];
}
// Keep one AI round's visual history outside saves. React can coalesce very fast
// opponents' updates; the last reply must still contain the earlier visible battle.
const presentations = new WeakMap<GameState, AiPresentation>();
export function rememberCombatEvents(
  state: GameState,
  attacks: GameEvent[],
  moves: WitnessedMove[] = [],
  input?: GameState,
) {
  const round = input?.round ?? state.round;
  const previous = input && presentations.get(input);
  const sameRound = previous?.round === round;
  presentations.set(state, {
    round,
    attacks: sameRound ? [...previous.attacks, ...attacks] : attacks,
    moves: sameRound ? [...previous.moves, ...moves] : moves,
  });
}
export function witnessedMoves(
  before: GameState,
  after: GameState,
): WitnessedMove[] {
  const lastId = before.events.at(-1)?.id ?? 0;
  return (presentations.get(after)?.moves ?? []).filter(
    (move) => move.id > lastId,
  );
}
export function freshCombatEvents(
  before: GameState,
  after: GameState,
): GameEvent[] {
  const lastId = before.events.at(-1)?.id ?? 0;
  return (presentations.get(after)?.attacks ?? after.events).filter(
    (event) =>
      event.id > lastId &&
      event.type === "attack" &&
      event.combat?.targetVisible,
  );
}
