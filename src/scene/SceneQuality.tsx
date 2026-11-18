import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

// Keep battle silhouettes and timing legible on slower GPUs. Only switch after
// sustained slow frames, allowing the board and its shadow map to compile first.
export function SceneQuality() {
  const { gl, setDpr } = useThree();
  const sample = useRef({ warmup: 0, frames: 0, elapsed: 0, adjusted: false });
  useEffect(() => {
    const reset = () => {
      sample.current.frames = 0;
      sample.current.elapsed = 0;
    };
    document.addEventListener("visibilitychange", reset);
    return () => document.removeEventListener("visibilitychange", reset);
  }, []);
  useFrame((_, delta) => {
    const q = sample.current;
    if (q.adjusted || document.hidden || delta > 1.2 || delta <= 0) return;
    if (q.warmup < 0.8) { q.warmup += delta; return; }
    q.frames++;
    q.elapsed += delta;
    if (q.elapsed < 1.25 || q.frames < 6) return;
    if (q.frames / q.elapsed < 24) {
      gl.shadowMap.enabled = false;
      setDpr(Math.min(1, gl.getPixelRatio()));
      q.adjusted = true;
    }
    q.elapsed = 0;
    q.frames = 0;
  });
  return null;
}
