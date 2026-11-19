import * as THREE from "three";
import type { UnitType } from "../../../game/types";
import { miniatureMaterial, setMiniatureColor } from "../../../scene/miniature";
import type { NationId } from "../../registry";
import { carveUncrewedDinghy, danubianUnit } from "../danubian/units";
import { boardPawn } from "./boardPawn";
import { deckStation, ensign } from "./fleetOutfits";
import type { DeckFittings, FleetArt } from "./fleetOutfits";
import { fleet as imperia } from "../../imperia/fleet";
import { fleet as determia } from "../../determia/fleet";
import { fleet as nosta } from "../../nosta/fleet";
import { fleet as ida } from "../../ida/fleet";
import { fleet as rina } from "../../rina/fleet";

const fleets = { imperia, determia, nosta, ida, rina } satisfies Record<NationId, FleetArt>;

type Point = [number, number, number];
type Vessel = "raft" | "dinghy" | "pirate" | "scout" | "rammer" | "bomber" | "juggernaut";
interface Station { at: Point; scale: number }
interface Staff { head: Point; length: number; hoist: number }
interface Rig {
  stations: Station[];
  staffs: Staff[];
  oldFlagFloor: number;
  helmsman?: Station;
}

const launchCenters = [[0, -.160], [-.184, .144], [.184, .144]] as const;
// Coordinates are local to the proven hull sculpts; their bows run toward -Z.
// Torpedo launches each carry their own tiny bridge and ensign.
const rigs: Record<Vessel, Rig> = {
  raft: {
    stations: [{ at: [0, .114, -.053], scale: .83 }],
    helmsman: { at: [.003, .087, -.151], scale: .132 },
    staffs: [{ head: [-.071, .298, .071], length: .11, hoist: .064 }], oldFlagFloor: .218,
  },
  dinghy: {
    stations: [{ at: [0, .131, -.123], scale: .55 }],
    helmsman: { at: [0, .083, .034], scale: .111 },
    staffs: [{ head: [0, .263, .131], length: .075, hoist: .045 }], oldFlagFloor: .199,
  },
  pirate: {
    stations: [{ at: [0, .204, .168], scale: .88 }],
    helmsman: { at: [-.014, .111, -.125], scale: .130 },
    staffs: [{ head: [0, .470, .038], length: .118, hoist: .057 }], oldFlagFloor: .397,
  },
  scout: {
    stations: [{ at: [0, .249, .259], scale: .75 }],
    staffs: [
      { head: [0, .616, -.123], length: .111, hoist: .055 },
      { head: [0, .514, .164], length: .090, hoist: .046 },
    ], oldFlagFloor: .430,
  },
  rammer: {
    stations: launchCenters.map(([x,z]) => ({ at: [x,.125,z-.041], scale: .46 })),
    staffs: launchCenters.map(([x,z]) => ({ head: [x,.195,z-.051], length: .068, hoist: .034 })),
    oldFlagFloor: .135,
  },
  bomber: {
    stations: [{ at: [0, .374, -.117], scale: .85 }],
    staffs: [{ head: [0, .599, -.117], length: .118, hoist: .058 }], oldFlagFloor: .526,
  },
  juggernaut: {
    stations: [{ at: [0, .468, -.087], scale: 1.1 }],
    staffs: [{ head: [0, .744, -.120], length: .146, hoist: .064 }], oldFlagFloor: .650,
  },
};

export function isVessel(type: UnitType): type is Vessel {
  return Object.hasOwn(rigs, type);
}

interface Layers {
  body: THREE.BufferGeometry;
  enamel: THREE.BufferGeometry;
}

const furnishings = new Map<NationId, { station: Layers; flag: Layers }>();
const hullEnamel = new Map<Vessel, THREE.BufferGeometry>();
let dinghyHull: Layers | undefined;

function finish({ body, enamel }: DeckFittings): Layers {
  return { body: body.finish(), enamel: enamel.finish() };
}

function layer(geometry: THREE.BufferGeometry, tinted: boolean) {
  const mesh = new THREE.Mesh(geometry, miniatureMaterial);
  if (tinted) mesh.userData.factionEnamel = true;
  return mesh;
}

function install(parent: THREE.Group, name: string, geometry: Layers, at: Point, scale: Point) {
  const item = new THREE.Group();
  item.name = name;
  item.position.set(...at);
  item.scale.set(...scale);
  if (geometry.body.getAttribute("position").count) item.add(layer(geometry.body, false));
  if (geometry.enamel.getAttribute("position").count) item.add(layer(geometry.enamel, true));
  parent.add(item);
}

// Share the original coordinates/normals; only the changed color or index buffer
// is distinct. Nothing mutates the neutral fleet or another player's hull.
function referenceGeometry(source: THREE.BufferGeometry) {
  const result = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes))
    result.setAttribute(name, attribute);
  result.setIndex(source.index);
  return result;
}

function enamelWithoutPennants(type: Vessel, source: THREE.BufferGeometry) {
  const existing = hullEnamel.get(type);
  if (existing) return existing;

  const result = referenceGeometry(source);
  const pos = source.getAttribute("position");
  const retained: number[] = [];
  const count = source.index?.count ?? pos.count;
  const floor = rigs[type].oldFlagFloor;
  for (let i = 0; i < count; i += 3) {
    const a = source.index?.getX(i) ?? i;
    const b = source.index?.getX(i + 1) ?? i + 1;
    const c = source.index?.getX(i + 2) ?? i + 2;
    // Only the old pennants sit this high in each ship's enamel layer.
    if (Math.min(pos.getY(a), pos.getY(b), pos.getY(c)) < floor) retained.push(a, b, c);
  }
  result.setIndex(retained);
  hullEnamel.set(type, result);
  return result;
}

type PaintKey = "hull" | "roof" | "sail";
const liveryByPigment = new Map<number, PaintKey>();
const pigment = new THREE.Color();
const historicalPaints: Record<PaintKey, string[]> = {
  hull: ["#48585e", "#445d6b", "#34454d", "#604031", "#624937"],
  roof: ["#97a6aa", "#83908d", "#6a8390"],
  sail: ["#e3cb9f", "#e7d6b0", "#aaa399"],
};
for (const key of ["hull", "roof", "sail"] as const) {
  for (const tone of historicalPaints[key]) {
    setMiniatureColor(pigment, tone);
    liveryByPigment.set(pigment.getHex(), key);
  }
}

function paintedHull(nation: NationId, source: THREE.BufferGeometry) {
  const geometry = referenceGeometry(source);
  const colors = source.getAttribute("color").clone();
  const paint = fleets[nation].paint;
  const tones = {
    hull: setMiniatureColor(new THREE.Color(), paint.hull),
    roof: setMiniatureColor(new THREE.Color(), paint.roof),
    sail: setMiniatureColor(new THREE.Color(), paint.sail),
  };
  for (let i = 0; i < colors.count; i++) {
    pigment.setRGB(colors.getX(i), colors.getY(i), colors.getZ(i));
    const key = liveryByPigment.get(pigment.getHex());
    if (key) colors.setXYZ(i, tones[key].r, tones[key].g, tones[key].b);
  }
  return geometry.setAttribute("color", colors);
}

export function fleetUnit(nation: NationId, type: UnitType): THREE.Group {
  if (!isVessel(type)) throw new Error("Expected naval unit, received " + type);
  const { body, enamel } = type === "dinghy" ? (dinghyHull ??= carveUncrewedDinghy()) : danubianUnit(type);
  const group = new THREE.Group();
  group.name = nation + "-" + type;
  group.add(layer(paintedHull(nation, body), false), layer(enamelWithoutPennants(type, enamel), true));
  let outfit = furnishings.get(nation);
  if (!outfit) {
    outfit = { station: finish(deckStation(fleets[nation])), flag: finish(ensign(fleets[nation])) };
    furnishings.set(nation, outfit);
  }
  for (const { at, scale } of rigs[type].stations)
    install(group, "Deck station", outfit.station, at, [scale, scale, scale]);
  for (const { head, length, hoist } of rigs[type].staffs)
    install(group, "Naval ensign", outfit.flag, head, [length, hoist, length]);
  const berth = rigs[type].helmsman;
  if (berth) {
    const sailor = boardPawn(nation, type);
    sailor.position.set(...berth.at);
    sailor.scale.setScalar(berth.scale);
    group.add(sailor);
  }
  return group;
}
