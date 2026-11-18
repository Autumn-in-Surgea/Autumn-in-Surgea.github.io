import type { EventNotice, Resource, Terrain, UnitType } from "../game/types";
import type { ModelSetId } from "./models";

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
  opening: NationOpening;
  notices: {
    opening: EventNotice;
    firstContact: EventNotice;
  };
}
