import emblem from "./logo.png";
import { DEFAULT_TERRAIN_VARIANT, type NationPack } from "../types";

export const nation = {
  id: "determia",
  name: "狄忒弥亚",
  english: "Determia",
  capital: "定衡",
  color: "#758b99",
  boardColor: "#a8daff",
  lightColor: "#d0d8db",
  description: "西北的银灰文明。",
  images: { emblem },
  modelSet: "determia",
  terrainVariant: DEFAULT_TERRAIN_VARIANT,
  opening: {
    technologies: ["strategy"],
    unit: "defender",
    stars: 7,
    cityLevel: 1,
  },
  notices: {
    opening: { title: "狄忒弥亚开局", message: "从定衡出发。已掌握筑垒战术，首都部署了一支战壕工兵。" },
    firstContact: { title: "初次接触", message: "狄忒弥亚依靠计算和制度来应对潮汐的不确定性。" },
  },
} satisfies NationPack;
