import type { EventNotice, Resource, Terrain, UnitType } from "../game/types";
import type { ModelSetId } from "./models";

export type NationId = "imperia" | "determia" | "nosta" | "ida" | "rina";

export const DEFAULT_TERRAIN_VARIANT = "imperia" as const;

export interface NationOpening {
  technologies: readonly string[];
  unit: UnitType;
  stars: number;
  cityLevel: number;
  fairDeposit?: { terrain: Terrain; resource: Resource; count: number };
}

export interface NationPack {
  id: NationId;
  name: string;
  english: string;
  color: string;
  boardColor: string;
  lightColor: string;
  description: string;
  capital: string;
  images: { emblem: string };
  modelSet: ModelSetId;
  terrainVariant: string;
  opening: NationOpening;
  notices: {
    opening: EventNotice;
    firstContact: EventNotice;
  };
}
