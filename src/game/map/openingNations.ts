import { getNation, NATIONS } from "../../nations/registry";
import type { GameOptions } from "../types";
import { hashSeed } from "./random";
import { STORY_NATIONS } from "./story";

/** Match the opening spawn order used by both rules and map previews. */
export function openingNations({ scenario, civilization, seed }: Pick<GameOptions, "scenario" | "civilization" | "seed">) {
  if (scenario === "free") {
    const selected = getNation(civilization);
    return selected ? [selected] : [];
  }
  if (scenario === "fair" && civilization === "neutral") return [];
  const available = scenario === "story" ? STORY_NATIONS : NATIONS;
  const selected = available.find(nation => nation.id === civilization) ?? available.at(0);
  if (!selected) return [];
  const rivals = available.filter(nation => nation !== selected);
  if (scenario === "fair") {
    const order = (id: string) => hashSeed(`${seed}:rival:${id}`);
    rivals.sort((a, b) => order(a.id) - order(b.id));
  }
  return [selected, ...rivals];
}
