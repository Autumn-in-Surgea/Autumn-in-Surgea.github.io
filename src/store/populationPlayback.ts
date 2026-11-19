import type { GameState, PopulationGain } from "../game/types";

const populationPlayback = new WeakMap<GameState, readonly PopulationGain[]>();

export function recordPopulationFlights(before: GameState, next: GameState, gains: readonly PopulationGain[] = []) {
  if (!gains.length) return [];
  const visible = new Set([...before.players[0].visible, ...next.players[0].visible]);
  const witnessed = gains.filter(gain => visible.has(gain.source.tileId) && visible.has(gain.cityTileId));
  if (witnessed.length) populationPlayback.set(next, witnessed);
  return witnessed;
}

const noFlights: readonly PopulationGain[] = [];
export const getPopulationFlights = (game: GameState) => populationPlayback.get(game) ?? noFlights;
