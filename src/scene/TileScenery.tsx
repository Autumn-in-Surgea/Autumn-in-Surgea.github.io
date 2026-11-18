import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Box3, Group, Vector3 } from "three";
import type { City, GameState, Tile } from "../game/types";
import { getVisibleResource, isTerritoryResourceAvailable } from "../game/rules/engine";
import { factionForOwner } from "../nations/registry";
import type { BuildingVisualTier } from "./buildingVisualTier";
import { colorForOwner } from "./factionModels";
import { BuildingModel, CityModel, LighthouseModel, Resources, RuinModel, TerrainDetails } from "./worldModels";
import { siteLandscape } from "./landscape";
import { RoadInlay } from "./RoadInlay";
import { Waterfront } from "./Waterfront";
import { BridgeSpan } from "./BridgeSpan";
import { ForeignTerritory, isForeignTerritory, StructureClipHeight } from "./territoryMaterials";
import { usePlaybackClock } from "./playbackClock";
import { exposedHeight } from "./structureMotion";
import { hasRoadModel, type ModelExchange, type StructureChange } from "../store/structurePlayback";

interface ModelProps {
  game: GameState;
  tile: Tile;
  city?: City;
  tier: number;
  simple: boolean;
  checkResourceAvailability: boolean;
  showResourceHints: boolean;
  knownTiles: ReadonlySet<number>;
}

function Scenery({ game, tile, city, tier, simple, checkResourceAvailability, showResourceHints, knownTiles, includeLandscape = true }: ModelProps & { includeLandscape?: boolean }) {
  const { modelSet } = factionForOwner(game.players, tile.owner);
  if (city) return <CityModel city={city} players={game.players} />;
  if (tile.building) {
    const stage = tier as BuildingVisualTier;
    const building = <BuildingModel type={tile.building} modelSet={modelSet}
      tier={stage} color={colorForOwner(game.players, tile.owner)} />;
    if (tile.building === "bridge") return <BridgeSpan tile={tile} tiles={game.tiles}
      size={game.options.size} explored={knownTiles} tier={stage}>{building}</BridgeSpan>;
    if (tile.terrain === "shallow" || tile.terrain === "deep")
      return <Waterfront tile={tile} tiles={game.tiles} size={game.options.size} explored={knownTiles} tier={stage}>
        {building}
      </Waterfront>;
    return <>{includeLandscape && <TerrainDetails tile={tile} simple={simple} />}{building}</>;
  }
  const resource = getVisibleResource(game, tile, 0);
  const available = checkResourceAvailability && !!resource && isTerritoryResourceAvailable(game, tile, 0);
  return <>
    <TerrainDetails tile={tile} simple={simple} />
    {resource && (!simple || available) && (
      <Resources tile={tile} highlight={available && showResourceHints} />
    )}
    {tile.ruin && <RuinModel terrainVariant={tile.terrainVariant} />}
  </>;
}

interface ExchangeProps {
  phase: ModelExchange;
  issuedAt: number;
  surfaceY: number;
  previous: ReactNode;
  next: ReactNode;
}

function Exchange({ phase, issuedAt, surfaceY, previous, next }: ExchangeProps) {
  const oldModel = useRef<Group>(null), newModel = useRef<Group>(null);
  const heights = useRef({ previous: 0, next: 0 });
  const clock = usePlaybackClock();

  function place() {
    const elapsed = (clock.time - issuedAt) / 1000;
    function setLayer(model: Group | null, incoming: boolean, height: number) {
      if (!model) return;
      const fraction = exposedHeight(phase, incoming, elapsed);
      model.visible = fraction > 0;
      model.position.y = -(1 - fraction) * height;
    }
    setLayer(oldModel.current, false, heights.current.previous);
    setLayer(newModel.current, true, heights.current.next);
  }

  useLayoutEffect(() => {
    function measure(model: Group | null) {
      if (!model) return 0;
      model.position.y = 0;
      model.updateWorldMatrix(true, true);
      const bounds = new Box3().setFromObject(model);
      const floor = model.getWorldPosition(new Vector3()).y;
      return Math.max(0, bounds.max.y - floor) + 0.004;
    }
    heights.current = { previous: measure(oldModel.current), next: measure(newModel.current) };
    place();
  }, [phase, issuedAt, previous, next]);
  useFrame(place, -1);

  return <StructureClipHeight.Provider value={surfaceY}>
    {phase !== "rise" && <group name="outgoing-structure" ref={oldModel}>{previous}</group>}
    {phase !== "sink" && <group name="incoming-structure" ref={newModel}>{next}</group>}
  </StructureClipHeight.Provider>;
}

export function TileScenery(props: ModelProps & {
  visible: boolean;
  reducedMotion: boolean;
  change?: StructureChange;
  issuedAt: number;
  surfaceY: number;
}) {
  const { game, tile, tier, knownTiles, visible, reducedMotion, change, issuedAt, surfaceY } = props;
  const road = hasRoadModel(tile) && <RoadInlay tile={tile} tiles={game.tiles}
    size={game.options.size} explored={knownTiles} tier={tier as BuildingVisualTier} />;
  const scene = <Scenery {...props} checkResourceAvailability={visible && props.checkResourceAvailability} />;
  const lighthouse = tile.lighthouse && <LighthouseModel terrainVariant={tile.terrainVariant} />;
  if (!change || reducedMotion) return <>{road}{scene}{lighthouse}</>;

  const { previousGame, previousTier, previousCity, previousExplored } = change;
  const oldTile = previousGame.tiles[tile.id];
  const site = siteLandscape(tile);
  const fixedLandscape = !!change.scenery && !!site && site === siteLandscape(oldTile)
    && tile.terrainVariant === oldTile.terrainVariant;
  const oldOwnership = isForeignTerritory(oldTile.owner);
  const start = issuedAt + change.delay * 1000;
  return <>
    {lighthouse}
    {fixedLandscape && <TerrainDetails tile={tile} simple={props.simple} />}
    {change.road ? <Exchange phase={change.road} issuedAt={start} surfaceY={surfaceY}
      previous={<ForeignTerritory.Provider value={oldOwnership}>
        <RoadInlay tile={oldTile} tiles={previousGame.tiles} size={game.options.size}
          explored={previousExplored} tier={previousTier} />
      </ForeignTerritory.Provider>} next={road} /> : road}
    {change.scenery ? <Exchange phase={change.scenery} issuedAt={start} surfaceY={surfaceY}
      previous={<ForeignTerritory.Provider value={oldOwnership}>
        <Scenery game={previousGame} tile={oldTile} city={previousCity} tier={previousTier}
          simple={props.simple} checkResourceAvailability={false} showResourceHints={false}
          includeLandscape={!fixedLandscape} knownTiles={previousExplored} />
      </ForeignTerritory.Provider>}
      next={<Scenery {...props} checkResourceAvailability={false} includeLandscape={!fixedLandscape} />} /> : scene}
  </>;
}
