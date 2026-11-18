import type { EventNotice, Resource, Terrain, UnitType } from "../game/types";
import type { ModelSetId } from "./models";

export const DEFAULT_TERRAIN_VARIANT = "imperia" as const;

export interface NationOpening {
  technologies: readonly string[];
  unit: UnitType;
  stars: number;
  cityLevel: number;
  fairDeposit?: { terrain: Terrain; resource: Resource; count: number };
}

export interface NationPack {
  id: string;
  name: string;
  english: string;
  color: string;
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
