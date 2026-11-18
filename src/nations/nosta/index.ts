import emblem from "./logo.png";
import type { NationPack } from "../types";

export const nation = {
  id: "nosta",
  name: "诺斯塔",
  english: "Nosta",
  capital: "丰化",
  color: "#b99a48",
  lightColor: "#e5d6a4",
  description: "北方枯金的自治国度。",
  images: { emblem },
  modelSet: "nosta",
  opening: {
    technologies: [],
    unit: "warrior",
    stars: 2,
    cityLevel: 2,
  },
  notices: {
    opening: { title: "诺斯塔开局", message: "从丰化出发。首都起始为二级，初始国库有两颗星。" },
    firstContact: { title: "初次接触", message: "诺斯塔自帝国北方独立，仍由地方自治与旧有基础设施维系。" },
  },
} satisfies NationPack;
