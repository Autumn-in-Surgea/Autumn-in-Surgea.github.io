import type { Vector3Tuple } from "three";
import type { UnitType } from "../../../game/types";
import type { Tool } from "./equipment";

export interface HandPose {
  hand: Vector3Tuple;
  other?: Vector3Tuple;
}

interface EquippedPose extends HandPose {
  anchor: Vector3Tuple;
  tilt: Vector3Tuple;
  size: number;
}

const rifle: EquippedPose = {
  hand: [0.387, 0.741, 0.29],
  other: [-0.2, 0.635, 0.18],
  anchor: [0.376, 0.745, 0.285],
  tilt: [-0.36, -0.08, -0.58],
  size: 1.07,
};
const scope: EquippedPose = {
  hand: [0.389, 0.82, 0.33],
  other: [-0.18, 0.701, 0.24],
  anchor: [0.376, 0.816, 0.345],
  tilt: [-0.05, 0, -1.3],
  size: 1.12,
};
const shovel: EquippedPose = {
  hand: [0.5, 0.948, 0.244],
  anchor: [0.507, 0.949, 0.247],
  tilt: [0.34, -0.04, -2.72],
  size: 1.02,
};
const medic: EquippedPose = {
  hand: [0.558, 0.914, 0.143],
  anchor: [0.557, 0.875, 0.153],
  tilt: [0.02, -0.09, -0.07],
  size: 1.15,
};
const optics: EquippedPose = {
  hand: [0.456, 1.005, 0.245],
  anchor: [0.554, 1.026, 0.28],
  tilt: [-0.06, 0.17, -0.16],
  size: 1.17,
};
const saber: EquippedPose = {
  hand: [0.425, 0.787, 0.115],
  anchor: [0.418, 0.8, 0.13],
  tilt: [0.18, -0.3, -0.32],
  size: 1.13,
};
const crew: HandPose = { hand: [0.29, 0.67, 0.28], other: [-0.23, 0.72, 0.22] };

export interface PawnProfile {
  coat: string;
  fold: string;
  boots: string;
  darkStrap?: boolean;
  hands: HandPose;
  equipment?: { tool: Tool; pose: EquippedPose };
}

function uniform(
  coat: string,
  fold: string,
  boots: string,
  tool: Tool,
  pose: EquippedPose,
  darkStrap = false,
): PawnProfile {
  return { coat, fold, boots, darkStrap, hands: pose, equipment: { tool, pose } };
}

const deckCrew: PawnProfile = { coat: "#355674", fold: "#87a6a4", boots: "#293e4c", hands: crew };

// Crew use the same dress block as the land forces; boats and vehicles supply
// their own decks, seats, saddles and fixed equipment in the board assembly.
export const pawnProfiles = {
  warrior: uniform("#56624a", "#889268", "#35382b", "rifle", rifle),
  archer: uniform("#425b69", "#71949e", "#2c3d47", "scope", scope),
  defender: uniform("#98613d", "#ba8d58", "#503728", "shovel", shovel, true),
  mindBender: uniform("#e0d1ac", "#ab8c6d", "#615344", "medic", medic, true),
  cloak: uniform("#494858", "#7e788b", "#302c37", "optics", optics),
  swordsman: uniform("#593e48", "#b97e65", "#443243", "bayonet", rifle),
  knight: uniform("#78464c", "#a46163", "#432c36", "saber", saber),
  rider: uniform("#466d60", "#a1aa83", "#354a3a", "carbine", { ...rifle, size: 0.83 }),
  dagger: { coat: "#524a41", fold: "#a4795d", boots: "#312e29", hands: saber },
  catapult: { coat: "#4d6264", fold: "#969e8a", boots: "#314549", hands: crew },
  giant: { coat: "#576350", fold: "#90987f", boots: "#333a32", hands: crew },
  raft: deckCrew,
  scout: deckCrew,
  rammer: deckCrew,
  bomber: deckCrew,
  juggernaut: deckCrew,
  dinghy: deckCrew,
  pirate: deckCrew,
} satisfies Record<UnitType, PawnProfile>;
