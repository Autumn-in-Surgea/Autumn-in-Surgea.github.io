import * as THREE from "three";
import type { UnitType } from "../../../game/types";
import { miniatureMaterial } from "../../../scene/miniature";
import type { NationId } from "../../registry";
import { fieldGunMuzzle, groundSupport } from "../danubian/units";
import { additionalKit, horseTack } from "./fieldKit";
import { boardPawn } from "./boardPawn";

type Support = Parameters<typeof groundSupport>[0];
const mountingPlane = .118;
const coatHem = .132;
const headScale = .85;
const horseKits = new Map<boolean, THREE.BufferGeometry>();
const fieldKits = new Map<UnitType, ReturnType<typeof additionalKit>>();

function mesh(name: string, geometry: THREE.BufferGeometry, enamel = false) {
  const piece = new THREE.Mesh(geometry, miniatureMaterial);
  piece.name = name;
  piece.userData.factionEnamel = enamel;
  return piece;
}

function chassis(kind: Support) {
  const assembly = new THREE.Group();
  const support = groundSupport(kind);
  assembly.add(mesh("Carved support", support.body), mesh("Owner enamel", support.enamel, true));
  return assembly;
}

function fittedPawn(nation: NationId, type: UnitType) {
  const pawn = boardPawn(nation,type);
  const head = pawn.getObjectByName("Blank carved square head")!;
  const hat = pawn.getObjectByName("Hat socket")!;
  // Keep the chin fitted to the collar and move the hat with the carved head.
  head.scale.multiplyScalar(headScale);
  hat.position.lerp(head.position, 1 - headScale);
  hat.scale.multiplyScalar(headScale);
  if (!fieldKits.has(type)) fieldKits.set(type, additionalKit(type));
  const kit = fieldKits.get(type);
  if (kit) pawn.add(mesh("Field equipment", kit));
  return pawn;
}

function mounted(nation: NationId, type: "rider" | "knight") {
  const assembly = chassis(type);
  const heavy = type === "knight";
  if (!horseKits.has(heavy)) horseKits.set(heavy,horseTack(heavy));
  assembly.add(mesh("Riding boots and tack",horseKits.get(heavy)!));
  const soldier = fittedPawn(nation,type);
  soldier.scale.set(.274,.274,.245);
  soldier.position.set(0,.392,.060);
  assembly.add(soldier);
  return assembly;
}

function artillery(nation: NationId) {
  const assembly = chassis("catapult");
  const loader = fittedPawn(nation,"catapult");
  loader.scale.setScalar(.30);
  loader.rotation.y -= .48;
  loader.position.set(-.222,mountingPlane-coatHem*.30,.160);
  assembly.add(loader);
  return assembly;
}

function armoredVehicle(nation: NationId) {
  const assembly = chassis("giant");
  const commander = fittedPawn(nation,"giant");
  commander.scale.setScalar(.205);
  commander.position.set(-.017,.568,.098);
  assembly.add(commander);
  return assembly;
}

const infantryScale = .436;
export function groundUnit(nation: NationId,type: UnitType): THREE.Group {
  switch(type) {
    case "rider":
    case "knight": return mounted(nation,type);
    case "catapult": return artillery(nation);
    case "giant": return armoredVehicle(nation);
    case "warrior":
    case "archer":
    case "defender":
    case "swordsman":
    case "mindBender":
    case "cloak":
    case "dagger": {
      const assembly = chassis("infantry");
      const pawn = fittedPawn(nation,type);
      if (type === "archer" || type === "swordsman") {
        const gun = pawn.children.find(part => part.userData.heldEquipment);
        if (gun) {
          // Swing the rifle across the leading shoulder into the board firing lane.
          gun.rotateOnWorldAxis(new THREE.Vector3(0,1,0),type === "archer" ? -1.65 : -1.48);
          if (type === "archer") {
            gun.scale.y *= .84;
            gun.position.z -= .07;
          }
        }
      }
      pawn.scale.setScalar(infantryScale);
      pawn.position.y = mountingPlane - coatHem * infantryScale;
      if (type === "archer") pawn.position.z = .053;
      if (type === "swordsman") pawn.position.z = .020;
      assembly.add(pawn);
      return assembly;
    }
    default: throw new Error("Unknown land sculpture: "+type);
  }
}

// All five uniforms share a firing pose. Read the real marker after applying the
// figure's grip, barrel rotation and board scale, once on the first ranged shot.
let gunTip: [number, number, number] | undefined;
export const landMuzzles: Partial<Record<UnitType,[number,number,number]>> = {
  get archer() {
    if (!gunTip) {
      const miniature = groundUnit("imperia","archer");
      const muzzle = miniature.getObjectByName("Rifle muzzle");
      if (!muzzle) throw new Error("The marksman's rifle has no muzzle marker");
      gunTip = muzzle.getWorldPosition(new THREE.Vector3()).toArray();
    }
    return gunTip;
  },
  catapult: fieldGunMuzzle,
};
