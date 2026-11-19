import type { GameState, PopulationGain } from "../game/types";
import { getPopulationFlights } from "../store/populationPlayback";
import { clampProgress, easeIn, easeOut } from "./motion";

const populationFlightLanding = 0.13;
const anticipation = 0.05;

export function flightTiming(game: GameState, gain: PopulationGain, index: number) {
  const from = game.tiles[gain.source.tileId], to = game.tiles[gain.cityTileId];
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  // Start with the rising building just visible on the board.
  const construction = gain.source.kind === "building" && gain.source.built ? 0.43 : 0;
  return {
    distance,
    launch: construction + Math.min(index, 4) * 0.031,
    flight: 0.24 + Math.min(0.16, 0.04 * Math.sqrt(distance)),
  };
}

export function populationFlightSeconds(game: GameState) {
  return getPopulationFlights(game).reduce((duration, gain, index) => {
    const { launch, flight } = flightTiming(game, gain, index);
    return Math.max(duration, launch + anticipation + flight + populationFlightLanding);
  }, 0);
}

/** Flight positions use a quadratic arc. Warp only time for a quick launch and soft arrival. */
export function samplePopulationFlight(elapsed: number, flight: number, height: number) {
  const airborne = clampProgress((elapsed - anticipation) / flight);
  const travel = 1 - (1 - airborne) ** 1.45;
  const squeeze = elapsed < anticipation ? Math.sin(Math.PI * clampProgress(elapsed / anticipation)) : 0;
  const swell = Math.sin(Math.PI * airborne) * 0.14;
  const landingSquash = Math.sin(Math.PI * clampProgress((airborne - 0.55) / 0.45)) * 0.18;
  const absorb = 1 - easeIn((travel - 0.38) / 0.62);
  return {
    travel,
    lift: 4 * height * travel * (1 - travel),
    width: absorb * (1 + swell + squeeze * 0.17 + landingSquash),
    height: absorb * (1 + swell - squeeze * 0.28 - landingSquash),
    turn: travel * Math.PI * 1.46,
    glint: easeOut((elapsed - anticipation - flight) / populationFlightLanding),
    done: elapsed >= anticipation + flight + populationFlightLanding,
  };
}
