import emblem from "./logo.png";
import { DEFAULT_TERRAIN_VARIANT, type NationPack } from "../types";

export const nation = {
  id: "rina",
  name: "铃亚",
  english: "Rina",
  capital: "千华",
  color: "#4f9185",
  lightColor: "#b4d6c6",
  description: "东方山海间的青绿文明。",
  images: { emblem },
  modelSet: "rina",
  terrainVariant: DEFAULT_TERRAIN_VARIANT,
  opening: {
    technologies: ["fishing"],
    unit: "warrior",
    stars: 5,
    cityLevel: 1,
    fairDeposit: { terrain: "shallow", resource: "fish", count: 2 },
  },
  notices: {
    opening: { title: "铃亚开局", message: "从千华出发。已掌握捕鱼，可在沿海城市发展渔业和港口。" },
    firstContact: { title: "初次接触", message: "铃亚的关键城市分布在山海之间，以测绘、导航和贸易相连。" },
  },
} satisfies NationPack;
