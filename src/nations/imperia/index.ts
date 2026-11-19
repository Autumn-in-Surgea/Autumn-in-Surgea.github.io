import emblem from "./logo.png";
import { DEFAULT_TERRAIN_VARIANT, type NationPack } from "../types";

export const nation = {
  id: "imperia",
  name: "帝国",
  english: "Imperia",
  capital: "中京",
  color: "#94735b",
  boardColor: "#e99054",
  lightColor: "#d8c7b0",
  description: "中央大陆的旧日秩序。",
  images: { emblem },
  modelSet: "imperia",
  terrainVariant: DEFAULT_TERRAIN_VARIANT,
  opening: {
    technologies: ["organization"],
    unit: "warrior",
    stars: 5,
    cityLevel: 1,
    fairDeposit: { terrain: "plain", resource: "fruit", count: 2 },
  },
  notices: {
    opening: { title: "帝国开局", message: "从中京出发。已掌握组织，可采集领内水果发展首都。" },
    firstContact: { title: "初次接触", message: "帝国仍以中央大陆的旧制度维持各地联系。" },
  },
} satisfies NationPack;
