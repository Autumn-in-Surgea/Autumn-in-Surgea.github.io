import { createContext, memo, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { BufferGeometry, MeshStandardMaterial } from "three";
import type { BuildingId, City, Player, Tile } from "../game/types";
import { siteLandscape, type developedLandscape } from "./landscape";
import type { BuildingVisualTier } from "./buildingVisualTier";
import { nation as imperia } from "../nations/imperia";
import { getTerrainAssets, representativeTerrain, structureVariant, type NationModels } from "../nations/models";
import { cityAppearance, MODEL_SETS } from "./factionModels";
import { useTerritoryMaterial } from "./territoryMaterials";
import { makeGlowGeometry, resourceSilhouetteMask, silhouetteGlowProps, writeSilhouette } from "./silhouetteGlow";

const Library = createContext<Map<string, BufferGeometry> | null>(null);

// Share prototypes between equal tiles, including during panning. Their lifetime
// is one scene so customized faction colours do not accumulate between matches.
export function WorldModelLibrary({ children }: { children: ReactNode }) {
  const [models] = useState(() => new Map<string, BufferGeometry>());
  useEffect(() => () => { for (const geometry of models.values()) geometry.dispose(); }, [models]);
  return <Library.Provider value={models}>{children}</Library.Provider>;
}

// Resources write during the opaque pass. Their glow draws before the unit
// layer clears board depth and stencil to bring the pieces to the foreground.
const harvestOutline = silhouetteGlowProps(resourceSilhouetteMask, 0.5);
const harvestMaterials = new WeakMap<MeshStandardMaterial, MeshStandardMaterial>();

function harvestMaterial(base: MeshStandardMaterial) {
  let material = harvestMaterials.get(base);
  if (!material) {
    material = writeSilhouette(base.clone(), resourceSilhouetteMask);
    harvestMaterials.set(base, material);
  }
  return material;
}

function Sculpture({ modelKey, build, highlight = false }: {
  modelKey: string;
  build: () => BufferGeometry;
  highlight?: boolean;
}) {
  const models = useContext(Library)!;
  const material = useTerritoryMaterial();
  let geometry = models.get(modelKey);
  if (!geometry) {
    geometry = build();
    models.set(modelKey, geometry);
  }
  if (geometry.getAttribute("position").count === 0) return null;
  let glow: BufferGeometry | undefined;
  if (highlight) {
    const key = `glow:${modelKey}`;
    glow = models.get(key);
    if (!glow) {
      glow = makeGlowGeometry(geometry);
      models.set(key, glow);
    }
  }
  return (
    <>
      <mesh geometry={geometry} material={highlight ? harvestMaterial(material) : material}
        castShadow receiveShadow dispose={null} />
      {glow && <mesh {...harvestOutline} name="harvest-highlight" geometry={glow} dispose={null} />}
    </>
  );
}

export function WorksiteTerrain({ tile, site, part = "developed", simple }: {
  tile: Tile; site: NonNullable<ReturnType<typeof siteLandscape>>;
  part?: Parameters<typeof developedLandscape>[2]; simple: boolean;
}) {
  const terrain = getTerrainAssets(tile.terrainVariant);
  return <Sculpture modelKey={`site:${tile.terrainVariant}:${site}:${part}:${simple}`}
    build={() => terrain.developed(site, simple, part)} />;
}

export const TerrainDetails = memo(function TerrainDetails({ tile, simple = false }: { tile: Tile; simple?: boolean }) {
  if (tile.cityId || tile.lighthouse) return null;
  if (tile.building) {
    const site = siteLandscape(tile);
    return site && <WorksiteTerrain tile={tile} site={site} simple={simple} />;
  }
  const build = getTerrainAssets(tile.terrainVariant).details[tile.terrain];
  return build ? <Sculpture modelKey={`terrain:${tile.terrainVariant}:${tile.terrain}:${simple}`}
    build={() => build(simple)} /> : null;
});

export const Resources = memo(function Resources({ tile, highlight }: {
  tile: Tile;
  highlight: boolean;
}) {
  const kind = tile.resource;
  if (!kind || tile.cityId || tile.building) return null;
  return <Sculpture modelKey={`resource:${tile.terrainVariant}:${kind}`}
    build={() => getTerrainAssets(tile.terrainVariant).resource(kind)} highlight={highlight} />;
});

export function NativeStock({ tile, kind, section }: {
  tile: Tile; kind: "crop" | "ore"; section: "remaining" | "extracted";
}) {
  if (kind === "crop" && section === "extracted") return null;
  const terrain = getTerrainAssets(tile.terrainVariant);
  return <Sculpture modelKey={`stock:${tile.terrainVariant}:${kind}:${section}`}
    build={() => kind === "crop" ? terrain.resource("crop") : terrain.mineSeams(section)} />;
}

export const CityModel = memo(function CityModel({ city, players, seed, terrainVariant }: {
  city: City; players: readonly Player[]; seed: string; terrainVariant: Tile["terrainVariant"];
}) {
  const { modelSet, color, level, capital, walls } = cityAppearance(players, city, terrainVariant);
  const models: NationModels = MODEL_SETS[modelSet];
  const variant = structureVariant(models, seed, city);
  return <Sculpture modelKey={`city:${modelSet}:${color}:${level}:${capital}:${walls}:${variant ?? ""}`}
    build={() => models.city(color, level, capital, walls, variant)} />;
});

export const BuildingModel = memo(function BuildingModel({ type, tier, includeNativeStock = true }: {
  type: BuildingId; tier: BuildingVisualTier; includeNativeStock?: boolean;
}) {
  return <Sculpture modelKey={`building:${type}:${tier}:${includeNativeStock}`}
    build={() => MODEL_SETS.imperia.building(type, imperia.color, tier, includeNativeStock)} />;
});

export const RuinModel = () => <Sculpture modelKey="ruin" build={representativeTerrain.ruin} />;
export const LighthouseModel = () => <Sculpture modelKey="lighthouse" build={representativeTerrain.lighthouse} />;
