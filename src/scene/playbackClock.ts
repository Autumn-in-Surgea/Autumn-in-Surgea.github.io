import { createContext, useContext, useLayoutEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";

export interface PlaybackClock {
  time: number;
}
export const PlaybackContext = createContext<PlaybackClock>({ time: 0 });
export const usePlaybackClock = () => useContext(PlaybackContext);

/** An expensive map update must not consume a shot's entire flight before its first paint. */
export function useBoardClock(session: string) {
  const clock = useMemo(() => ({ time: 0 }), []);
  useLayoutEffect(() => {
    clock.time = 0;
  }, [clock, session]);
  useFrame((_, delta) => {
    if (!document.hidden) clock.time += Math.min(delta, 0.05) * 1000;
  }, -2);
  return clock;
}
