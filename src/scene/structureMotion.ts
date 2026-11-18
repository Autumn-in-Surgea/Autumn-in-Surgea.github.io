import { easeInOut } from "./motion";
import { exchangePause, riseSeconds, sinkSeconds, type ModelExchange } from "../store/structurePlayback";

/** Fraction of a model's height above the tile, sampled on a shared action clock. */
export function exposedHeight(phase: ModelExchange, incoming: boolean, elapsed: number) {
  if (incoming) {
    if (phase === "sink") return 0;
    const start = phase === "replace" ? sinkSeconds + exchangePause : 0;
    return easeInOut((elapsed - start) / riseSeconds);
  }
  return phase === "rise" ? 0 : 1 - easeInOut(elapsed / sinkSeconds);
}
