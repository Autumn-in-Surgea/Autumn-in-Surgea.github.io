import type { BufferGeometry } from "three";
import type { PopulationSource, Resource, Tile } from "../game/types";
import { getTerrainAssets } from "../nations/models";
import { mineOreSculpture } from "../nations/_shared/danubian/buildings";
import { brass, copper, ink, ivory, masonry, terracotta } from "./architecturalPalette";
import { Miniature } from "./miniature";

const crops = new Set(["farm", "windmill"]);
const timberWorks = new Set(["lumberHut", "sawmill", "bridge"]);
const geometry = new Map<string, BufferGeometry>();

function token(kind: string) {
  const m = new Miniature();
  if (kind === "timber") {
    for (const [x, y] of [[-0.047, 0.052], [0.048, 0.052], [0, 0.119]]) {
      m.part("octagon", "#925535", x, y, 0, 0.088, 0.232, 0.088, Math.PI / 2);
      m.part("octagon", "#dfb789", x, y, 0.119, 0.064, 0.007, 0.064, Math.PI / 2);
    }
    for (const z of [-0.062, 0.063])
      m.box(ink, 0.002, 0.107, z, 0.176, 0.028, 0.016, 0, 0, -0.09);
  } else if (kind === "cargo") {
    m.part("bevel", "#ba8354", 0, 0.088, 0, 0.21, 0.176, 0.17);
    for (const x of [-0.075, 0.075])
      m.box("#e0b082", x, 0.093, 0, 0.021, 0.191, 0.184);
    m.beam("#734d38", [-0.065, 0.046, 0.088], [0.065, 0.14, 0.088], 0.018);
    m.box(brass, 0, 0.115, 0.094, 0.048, 0.037, 0.008);
  } else if (kind === "ruin") {
    m.part("bevel", terracotta, 0, 0.059, 0, 0.198, 0.118, 0.156);
    m.part("bevel", brass, 0, 0.102, 0, 0.207, 0.030, 0.165);
    m.part("gem", copper, 0, 0.135, 0, 0.07, 0.052, 0.07);
  } else if (kind === "lighthouse") {
    m.part("octagon", ivory, 0, 0.047, 0, 0.145, 0.094, 0.145);
    m.part("crystal", "#eebd62", 0, 0.123, 0, 0.119, 0.144, 0.119);
    m.part("spire", brass, 0, 0.202, 0, 0.145, 0.066, 0.145);
  } else {
    m.part("hip", masonry, 0, 0.049, 0, 0.212, 0.098, 0.178);
    m.part("gem", "#f4ce79", 0, 0.151, 0, 0.137, 0.172, 0.117, 0, Math.PI / 4, 0.22);
    m.part("gem", brass, -0.069, 0.109, 0.014, 0.08, 0.088, 0.067, 0, 0, 0.53);
    m.part("gem", brass, 0.069, 0.109, 0.014, 0.08, 0.088, 0.067, 0, 0, -0.53);
  }
  return m.finish();
}

export function populationFlightAsset(source: PopulationSource, tile: Tile): BufferGeometry {
  let resource: Resource | undefined;
  let kind: string = source.kind;
  if (source.kind === "resource") resource = source.resource;
  if (source.kind === "road") kind = "timber";
  if (source.kind === "building") {
    if (crops.has(source.building)) resource = "crop";
    else if (source.building === "mine") kind = "mineOre";
    else if (source.building === "forge") resource = "ore";
    else if (timberWorks.has(source.building)) kind = "timber";
    else if (source.building === "port" || source.building === "market") kind = "cargo";
  }
  const key = resource ? `${tile.terrainVariant}:${resource}` : kind;
  let sculpt = geometry.get(key);
  if (!sculpt) {
    sculpt = resource ? getTerrainAssets(tile.terrainVariant).resource(resource)
      : kind === "mineOre" ? mineOreSculpture() : token(kind);
    sculpt.computeBoundingBox();
    geometry.set(key, sculpt);
  }
  return sculpt;
}
