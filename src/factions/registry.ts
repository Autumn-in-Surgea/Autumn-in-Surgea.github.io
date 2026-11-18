import type { Civilization, CivilizationId, Player } from "../game/types";

// Content is local and keyed by the civilization in the save. Rendering code
// lives in scene/factionModels so the rules and AI worker can read this file.
export type ModelSetId = "danubian";

interface FactionAssets {
  modelSet: ModelSetId;
  images?: { emblem?: string };
  missionTree?: readonly {
    id: string;
    title: string;
    prerequisites: readonly string[];
  }[];
}

type StoryFactionPack = Civilization & FactionAssets & {
  id: Exclude<CivilizationId, "neutral">;
  openingProfile: string;
};

type NeutralFactionPack = FactionAssets & { id: "neutral" };
export type FactionPack = StoryFactionPack | NeutralFactionPack;

const sharedStoryAssets = {
  modelSet: "danubian",
  bonus: "标准规则，与其他势力相同的开局。",
  startingTech: "",
} as const;

export const CIVILIZATIONS: StoryFactionPack[] = [
  {
    ...sharedStoryAssets,
    id: "imperia",
    openingProfile: "organization",
    name: "帝国",
    english: "Imperia",
    color: "#94735b",
    lightColor: "#d8c7b0",
    symbol: "柱",
    description: "中央大陆的旧日秩序。",
    capital: "中京",
  },
  {
    ...sharedStoryAssets,
    id: "determia",
    openingProfile: "strategy",
    name: "狄忒弥亚",
    english: "Determia",
    color: "#758b99",
    lightColor: "#d0d8db",
    symbol: "序",
    description: "西北的银灰文明。",
    capital: "定衡",
  },
  {
    ...sharedStoryAssets,
    id: "nosta",
    openingProfile: "luxury",
    name: "诺斯塔",
    english: "Nosta",
    color: "#b99a48",
    lightColor: "#e5d6a4",
    symbol: "穗",
    description: "北方枯金的自治国度。",
    capital: "丰化",
  },
  {
    ...sharedStoryAssets,
    id: "ida",
    openingProfile: "hunting",
    name: "艾达",
    english: "Ida",
    color: "#b35e59",
    lightColor: "#e8b7ac",
    symbol: "焰",
    description: "南方绯红的群岛文明。",
    capital: "绯川",
  },
  {
    ...sharedStoryAssets,
    id: "rina",
    openingProfile: "fishing",
    name: "铃亚",
    english: "Rina",
    color: "#4f9185",
    lightColor: "#b4d6c6",
    symbol: "澜",
    description: "东方山海间的青绿文明。",
    capital: "千华",
  },
];

const neutral: NeutralFactionPack = { id: "neutral", modelSet: "danubian" };
const byId = new Map<CivilizationId, FactionPack>(CIVILIZATIONS.map(pack => [pack.id, pack]));
byId.set(neutral.id, neutral);

export function getFactionPack(id: CivilizationId) {
  return byId.get(id) ?? neutral;
}

export function factionForOwner(players: ReadonlyArray<Pick<Player, "civilization">>, owner: number | null) {
  return getFactionPack(owner === null ? "neutral" : players[owner]?.civilization ?? "neutral");
}
