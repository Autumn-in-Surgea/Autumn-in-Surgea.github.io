import { createContext, memo, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { BufferGeometry } from "three";
import { BackSide, Color, ShaderMaterial } from "three";
import type { BuildingId, City, Player, Tile } from "../game/types";
import { lighthouseModel, ruinModel } from "./architecture";
import { developedLandscape, grove, mountain, siteLandscape } from "./landscape";
import type { BuildingVisualTier } from "./buildingVisualTier";
import type { ModelSetId } from "../nations/registry";
import { cityAppearance, MODEL_SETS } from "./factionModels";
import { useTerritoryMaterial } from "./territoryMaterials";

const Library = createContext<Map<string, BufferGeometry> | null>(null);

// Share prototypes between equal tiles, including during panning. Their lifetime
// is one scene so customized faction colours do not accumulate between matches.
export function WorldModelLibrary({ children }: { children: ReactNode }) {
  const [models] = useState(() => new Map<string, BufferGeometry>());
  useEffect(() => () => { for (const geometry of models.values()) geometry.dispose(); }, [models]);
  return <Library.Provider value={models}>{children}</Library.Provider>;
}

const harvestOutline = new ShaderMaterial({
  uniforms: { edgeColor: { value: new Color("#ffed9d") } },
  side: BackSide,
  depthWrite: false,
  toneMapped: false,
  vertexShader: `
    void main() {
      vec4 view = modelViewMatrix * vec4(position, 1.0);
      view.xyz += normalize(normalMatrix * normal) * 0.027;
      gl_Position = projectionMatrix * view;
    }
  `,
  fragmentShader: `
    uniform vec3 edgeColor;
    void main() {
      gl_FragColor = vec4(edgeColor, 1.0);
      #include <colorspace_fragment>
    }
  `,
});
const ignoreRaycast = () => {};

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
  return (
    <>
      <mesh geometry={geometry} material={material} castShadow receiveShadow dispose={null} />
      {highlight && (
        <mesh
          name="harvest-highlight"
          geometry={geometry}
          material={harvestOutline}
          renderOrder={1}
          raycast={ignoreRaycast}
          dispose={null}
        />
      )}
    </>
  );
}

export const TerrainDetails = memo(function TerrainDetails({ tile, simple = false }: { tile: Tile; simple?: boolean }) {
  if (tile.cityId || tile.lighthouse) return null;
  const variant = (tile.x * 7 + tile.y * 13) % 6;
  if (tile.building) {
    const site = siteLandscape(tile);
    return site && <Sculpture modelKey={`site:${site}:${variant}:${simple}`}
      build={() => developedLandscape(site, variant, simple)} />;
  }
  if (tile.terrain === "forest") {
    return <Sculpture modelKey={`grove:${variant}:${simple}`} build={() => grove(variant, simple)} />;
  }
  if (tile.terrain === "mountain") {
    return <Sculpture modelKey={`ridge:${variant%3}:${simple}`} build={() => mountain(variant, simple)} />;
  }
  return null;
});

export const Resources = memo(function Resources({ tile, modelSet, highlight }: {
  tile: Tile;
  modelSet: ModelSetId;
  highlight: boolean;
}) {
  const kind = tile.resource;
  if (!kind || tile.cityId || tile.building) return null;
  return <Sculpture modelKey={`resource:${modelSet}:${kind}`} build={() => MODEL_SETS[modelSet].resource(kind)} highlight={highlight} />;
});

export const CityModel = memo(function CityModel({ city, players }: { city: City; players: readonly Player[] }) {
  const { modelSet, color, level, capital, walls } = cityAppearance(players, city);
  return <Sculpture modelKey={`city:${modelSet}:${color}:${level}:${capital}:${walls}`}
    build={() => MODEL_SETS[modelSet].city(color, level, capital, walls)} />;
});

export const BuildingModel = memo(function BuildingModel({ type, color, modelSet, tier }: {
  type: BuildingId; color: string; modelSet: ModelSetId; tier: BuildingVisualTier;
}) {
  return <Sculpture modelKey={`building:${modelSet}:${type}:${color}:${tier}`}
    build={() => MODEL_SETS[modelSet].building(type, color, tier)} />;
});

export const RuinModel = () => <Sculpture modelKey="ruin" build={ruinModel} />;
export const LighthouseModel = () => <Sculpture modelKey="lighthouse" build={lighthouseModel} />;
