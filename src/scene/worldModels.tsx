import { createContext, memo, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { BufferGeometry } from "three";
import type { BuildingId, City, Tile } from "../game/types";
import { lighthouseModel, ruinModel } from "./architecture";
import { grove, mountain } from "./landscape";
import type { FactionPack, ModelSetId } from "../factions/registry";
import { MODEL_SETS } from "./factionModels";
import { miniatureMaterial } from "./miniature";

const Library = createContext<Map<string, BufferGeometry> | null>(null);

// Share prototypes between equal tiles, including during panning. Their lifetime
// is one scene so customized faction colours do not accumulate between matches.
export function WorldModelLibrary({ children }: { children: ReactNode }) {
  const [models] = useState(() => new Map<string, BufferGeometry>());
  useEffect(() => () => { for (const geometry of models.values()) geometry.dispose(); }, [models]);
  return <Library.Provider value={models}>{children}</Library.Provider>;
}

function Sculpture({ modelKey, build }: { modelKey: string; build: () => BufferGeometry }) {
  const models = useContext(Library)!;
  let geometry = models.get(modelKey);
  if (!geometry) {
    geometry = build();
    models.set(modelKey, geometry);
  }
  return <mesh geometry={geometry} material={miniatureMaterial} castShadow receiveShadow dispose={null} />;
}

export const TerrainDetails = memo(function TerrainDetails({ tile, simple = false }: { tile: Tile; simple?: boolean }) {
  if (tile.cityId || tile.building || tile.lighthouse) return null;
  const variant = (tile.x*7 + tile.y*13) % 6;
  if (tile.terrain === "forest") {
    return <Sculpture modelKey={`grove:${variant}:${simple}`} build={() => grove(variant, simple)} />;
  }
  if (tile.terrain === "mountain") {
    return <Sculpture modelKey={`ridge:${variant%3}:${simple}`} build={() => mountain(variant, simple)} />;
  }
  return null;
});

export const Resources = memo(function Resources({ tile, modelSet }: { tile: Tile; modelSet: ModelSetId }) {
  const kind = tile.resource;
  if (!kind || tile.cityId || tile.building) return null;
  return <Sculpture modelKey={`resource:${modelSet}:${kind}`} build={() => MODEL_SETS[modelSet].resource(kind)} />;
});

export const CityModel = memo(function CityModel({ city, color, faction }: { city: City; color: string; faction: FactionPack }) {
  const level = city.owner === null ? 0 : Math.min(city.level, 5);
  const walls = city.defenseBonus > 0;
  const capital = level > 0 && city.capitalOf !== null;
  return <Sculpture modelKey={`city:${faction.modelSet}:${faction.id}:${color}:${level}:${capital}:${walls}`}
    build={() => MODEL_SETS[faction.modelSet].city(color, faction.id, level, capital, walls)} />;
});

export const BuildingModel = memo(function BuildingModel({ type, color, modelSet }: { type: BuildingId; color: string; modelSet: ModelSetId }) {
  return <Sculpture modelKey={`building:${modelSet}:${type}:${color}`} build={() => MODEL_SETS[modelSet].building(type, color)} />;
});

export const RuinModel = () => <Sculpture modelKey="ruin" build={ruinModel} />;
export const LighthouseModel = () => <Sculpture modelKey="lighthouse" build={lighthouseModel} />;
