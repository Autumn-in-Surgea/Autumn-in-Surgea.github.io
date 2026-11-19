import type { NationId } from "../nations/registry";
import type { BridgeAxis } from "./map/bridgeBanks";

export type CivilizationId = NationId | "neutral";
export type Terrain = "plain" | "forest" | "mountain" | "shallow" | "deep";
export type Resource =
  | "fruit"
  | "animal"
  | "crop"
  | "ore"
  | "fish"
  | "starfish";
export type UnitType =
  | "warrior"
  | "rider"
  | "defender"
  | "archer"
  | "swordsman"
  | "catapult"
  | "knight"
  | "mindBender"
  | "cloak"
  | "dagger"
  | "giant"
  | "raft"
  | "scout"
  | "rammer"
  | "bomber"
  | "juggernaut"
  | "dinghy"
  | "pirate";
export type NavalUpgradeType = "scout" | "rammer" | "bomber";
export type MonumentId =
  | "altarOfPeace"
  | "emperorTomb"
  | "eyeOfGod"
  | "gateOfPower"
  | "grandBazaar"
  | "parkOfFortune"
  | "towerOfWisdom";
export type BuildingId =
  | "farm"
  | "lumberHut"
  | "mine"
  | "windmill"
  | "sawmill"
  | "forge"
  | "market"
  | "port"
  | "temple"
  | "forestTemple"
  | "mountainTemple"
  | "waterTemple"
  | "bridge"
  | MonumentId;
export type Reward =
  | "income"
  | "explore"
  | "resources"
  | "defense"
  | "population"
  | "territory"
  | "park"
  | "giant";
export type UnitSkill =
  | "dash"
  | "escape"
  | "fortify"
  | "persist"
  | "stiff"
  | "static"
  | "heal"
  | "convert"
  | "hide"
  | "infiltrate"
  | "scout"
  | "creep"
  | "surprise"
  | "independent"
  | "water"
  | "carry"
  | "splash"
  | "stomp";
export interface Position {
  x: number;
  y: number;
}
export interface MapSettings {
  landRatio: number;
  forestRatio: number;
  mountainRatio: number;
  resourceDensity: number;
  villageDensity: number;
  noiseScale: number;
  spawnMode: "random" | "balanced" | "custom";
  customSpawns: Position[];
}
export interface GameOptions {
  scenario: "story" | "free" | "fair";
  civilization: CivilizationId;
  size: number;
  aiCount: number;
  difficulty: "easy" | "normal";
  mapType: "dryland" | "lakes" | "continents" | "archipelago" | "waterworld";
  seed: string;
  mode: "conquest" | "score";
  maxRounds: number;
  quickMode?: boolean;
  factionNames: string[];
  startingProfiles: string[];
  mapSettings: MapSettings;
}
export interface Tile extends Position {
  id: number;
  terrain: Terrain;
  readonly terrainVariant: NationId;
  resource: Resource | null;
  owner: number | null;
  cityId: string | null;
  building: BuildingId | null;
  bridgeAxis?: BridgeAxis;
  road: boolean;
  ruin: boolean;
  builtTurn?: number;
  buildingLevel?: number;
  lighthouse?: boolean;
}
export interface Player {
  id: number;
  civilization: CivilizationId;
  name: string;
  color: string;
  isAI: boolean;
  resources: number;
  allowOverspend?: boolean;
  technologies: string[];
  explored: number[];
  visible: number[];
  eliminated: boolean;
  score: number;
  peaceWith: number[];
  peaceOffers: number[];
  embassies: number[];
  metPlayers: number[];
  lastAttackRound: number;
  builtMonuments: MonumentId[];
  unlockedMonuments?: MonumentId[];
  bonusScore: number;
  stats: {
    kills: number;
    citiesCaptured: number;
    explored: number;
    resourcesEarned: number;
  };
}
export interface City extends Position {
  id: string;
  name: string;
  owner: number | null;
  capitalOf: number | null;
  level: number;
  population: number;
  incomeBonus: number;
  defenseBonus: number;
  territory: number[];
  pendingRewards: number;
  pendingRewardLevels: number[];
  connected: boolean;
  connectionRewarded: boolean;
  borderExpanded: boolean;
  parks: number;
  infiltratedRound: number | null;
  training?: {
    unitType: UnitType;
    readyRound: number;
    orderedRound?: number;
    paidStars?: number;
  };
}
export interface Unit extends Position {
  id: string;
  owner: number;
  type: UnitType;
  hp: number;
  maxHp: number;
  kills: number;
  veteran: boolean;
  moved: boolean;
  attacked: boolean;
  homeCityId: string;
  capturedTurn: number | null;
  escapeUsed: boolean;
  independent?: boolean;
  /** Unpaid upkeep disables this unit through its next turn, then gives one turn to reactivate. */
  upkeep?: "suspended" | "reactivation";
  /** A converted unit's partial turn does not count toward its suspension. */
  upkeepTransferRound?: number;
  navalTraining?: {
    unitType: NavalUpgradeType;
    readyRound: number;
    orderedRound: number;
    paidStars: number;
  };
  hidden: boolean;
  hiddenAtTurnStart: boolean;
  carried?: { type: UnitType; maxHp: number; veteran: boolean; kills: number };
}
export interface CombatWitness {
  kind: "strike" | "counter" | "splash" | "stomp";
  weapon: UnitType;
  volleyId?: number;
  targetId: string;
  originVisible: boolean;
  targetVisible: boolean;
  lethal: boolean;
}
export interface EventNotice {
  title: string;
  message: string;
  nationId?: Exclude<CivilizationId, "neutral">;
}
export interface GameEvent {
  id: number;
  type:
    | "move"
    | "attack"
    | "death"
    | "capture"
    | "upgrade"
    | "promotion"
    | "research"
    | "turn"
    | "info";
  message: string;
  player: number;
  at?: Position;
  from?: Position;
  unitId?: string;
  damage?: number;
  combat?: CombatWitness;
  /** An announcement for the player associated with this event. */
  notice?: EventNotice;
}
export interface GameState {
  version: 2;
  options: GameOptions;
  tiles: Tile[];
  cities: City[];
  units: Unit[];
  players: Player[];
  round: number;
  currentPlayer: number;
  status: "playing" | "finished";
  winner: number | null;
  events: GameEvent[];
  nextId: number;
}
export type Action =
  | { type: "MOVE"; unitId: string; to: number }
  | { type: "ATTACK"; unitId: string; targetId: string }
  | { type: "REACTIVATE"; unitId: string }
  | {
      type:
        | "HEAL"
        | "CAPTURE"
        | "PROMOTE"
        | "DISBAND"
        | "HEAL_OTHERS"
        | "EXAMINE";
      unitId: string;
    }
  | { type: "CONVERT"; unitId: string; targetId: string }
  | { type: "INFILTRATE"; unitId: string; cityId: string }
  | {
      type: "UPGRADE_NAVAL";
      unitId: string;
      unitType: NavalUpgradeType;
    }
  | { type: "CANCEL_NAVAL_UPGRADE"; unitId: string }
  | { type: "TRAIN"; cityId: string; unitType: UnitType }
  | { type: "CANCEL_TRAINING"; cityId: string }
  | { type: "RESEARCH"; techId: string }
  | { type: "BUILD"; tileId: number; building: BuildingId }
  | {
      type:
        | "ROAD"
        | "HARVEST"
        | "CLEAR_FOREST"
        | "BURN_FOREST"
        | "GROW_FOREST"
        | "DESTROY";
      tileId: number;
    }
  | { type: "CITY_REWARD"; cityId: string; reward: Reward }
  | { type: "PEACE" | "BREAK_PEACE" | "EMBASSY"; targetPlayer: number }
  | { type: "SET_OVERSPEND"; enabled: boolean }
  | { type: "END_TURN" | "RESIGN" };
export type PopulationSource = { tileId: number } & (
  | { kind: "resource"; resource: Resource }
  | { kind: "building"; building: BuildingId; built?: boolean }
  | { kind: "road" | "ruin" | "lighthouse" | "reward" }
);
export interface PopulationGain {
  cityId: string;
  cityTileId: number;
  amount: number;
  source: PopulationSource;
}
export interface ActionResult {
  state: GameState;
  ok: boolean;
  error?: string;
  /** Presentation details for this action, independent of the saved game. */
  populationGains?: readonly PopulationGain[];
}
export interface UnitDefinition {
  id: UnitType;
  name: string;
  cost: number;
  hp: number;
  attack: number;
  defense: number;
  movement: number;
  range: number;
  vision: number;
  tech: string | null;
  description: string;
  skills: UnitSkill[];
  trainable: boolean;
}
export interface TechDefinition {
  id: string;
  name: string;
  description: string;
  tier: number;
  branch: string;
  prerequisites: string[];
  unlocks: string;
}
export interface BuildingDefinition {
  id: BuildingId;
  name: string;
  cost: number;
  population: number;
  income: number;
  tech: string;
  terrain: Terrain[];
  resource?: Resource;
  description: string;
  unique?: boolean;
  monument?: boolean;
}
export interface CombatPreview {
  damage: number;
  retaliation: number;
  canAttack: boolean;
}
