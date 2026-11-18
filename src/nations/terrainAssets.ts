import type { BufferGeometry } from "three";
import type { Resource, Terrain } from "../game/types";
import type { developedLandscape } from "../scene/landscape";

export interface TerrainShell {
  cap: BufferGeometry;
  plinth: BufferGeometry;
  color: string;
  plinthColor: string;
}

type TerrainInlay = { geometry: BufferGeometry; color: string };
type TerrainDetail = (variation: number, simple: boolean) => BufferGeometry;

/** Regional sculpture and paint. Shells share the board's coordinates and surface height. */
export interface TerrainAssets {
  shells: Readonly<Record<Terrain, TerrainShell>>;
  details: Readonly<Partial<Record<Terrain, TerrainDetail>>>;
  developed: typeof developedLandscape;
  resource: (kind: Resource) => BufferGeometry;
  ruin: () => BufferGeometry;
  lighthouse: () => BufferGeometry;
  inlays: Readonly<Record<"plain" | "shallow" | "deep", TerrainInlay | null>>;
}
