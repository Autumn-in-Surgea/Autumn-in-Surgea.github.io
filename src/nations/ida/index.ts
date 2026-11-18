import emblem from "./logo.png";
import { DEFAULT_TERRAIN_VARIANT, type NationPack } from "../types";

export const nation = {
  id: "ida",
  name: "艾达",
  english: "Ida",
  capital: "绯川",
  color: "#b35e59",
  lightColor: "#e8b7ac",
  description: "南方绯红的群岛文明。",
  images: { emblem },
  modelSet: "ida",
  terrainVariant: DEFAULT_TERRAIN_VARIANT,
  opening: {
    technologies: ["hunting"],
    unit: "warrior",
    stars: 5,
    cityLevel: 1,
    fairDeposit: { terrain: "forest", resource: "animal", count: 2 },
  },
  notices: {
    opening: { title: "艾达开局", message: "从绯川出发。已掌握狩猎，可采集领内森林的动物。" },
    firstContact: { title: "初次接触", message: "艾达的半岛和群岛各有传统，潮汐推动了频繁的革新。" },
  },
} satisfies NationPack;
