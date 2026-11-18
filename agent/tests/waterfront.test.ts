import { describe, expect, it } from "vitest";
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import type { BufferGeometry } from "three";
import { BUILDINGS } from "../../src/game/data/config";
import type { MonumentId } from "../../src/game/types";
import { terrainHeight } from "../../src/scene/terrainElevation";
import { portGangway, portShore, waterMonument } from "../../src/scene/Waterfront";
import { battlefield } from "./helpers";

function waterGrid() {
  const state = battlefield();
  const tile = state.tiles[65];
  for (const t of state.tiles) t.terrain = "deep";
  tile.terrain = "shallow";
  tile.building = "port";
  return { tile, tiles: state.tiles, size: state.options.size, explored: new Set([tile.id]) };
}

const topMaterial = new MeshBasicMaterial({ side: DoubleSide });
function topAt(geometry: BufferGeometry, x: number, z: number) {
  const ray = new Raycaster(new Vector3(x,1,z), new Vector3(0,-1,0));
  return ray.intersectObject(new Mesh(geometry,topMaterial))[0]?.point.y;
}

describe("waterfront fittings", () => {
  it("leaves an offshore wharf freestanding and never follows an unexplored bank", () => {
    const props = waterGrid(), bank = props.tiles[props.tile.id+1];
    expect(portShore(props)).toBeUndefined();
    bank.terrain = "plain";
    expect(portShore(props)).toBeUndefined();
    props.explored.add(bank.id);
    expect(portShore(props)?.rotation).toBeCloseTo(-Math.PI/2);
    const hidden = props.tiles[props.tile.id-props.size];
    hidden.terrain = "mountain";
    expect(portShore(props)?.rotation).toBeCloseTo(-Math.PI/2);
  });

  it.each(["plain","mountain"] as const)("joins the existing wharf to the surface of a %s bank", (terrain) => {
    const props = waterGrid(), bank = props.tiles[props.tile.id+props.size];
    bank.terrain = terrain;
    props.explored.add(bank.id);
    const shore = portShore(props)!;
    const v = new Vector3(0,0,-1).applyAxisAngle(new Vector3(0,1,0),shore.rotation);
    expect(v.z).toBeCloseTo(1);
    expect(shore.rise).toBeCloseTo(terrainHeight(bank)-terrainHeight(props.tile));
    for (const tier of [1,2,3] as const) {
      const gangway = portGangway(shore.rise,tier);
      expect(topAt(gangway,-0.06,-0.149)).toBeCloseTo(0.141,2);
      expect(topAt(gangway,-0.06,-0.499)).toBeCloseTo(shore.rise+0.003,3);
      gangway.dispose();
    }
  });

  it("has different grounded shorelines for every water-buildable monument", () => {
    const types = Object.values(BUILDINGS).filter(def => def.monument).map(def => def.id as MonumentId);
    expect(types).toHaveLength(7);
    const outlines = new Set<string>();
    for (const type of types) for (const tier of [1,2,3] as const) {
      const mesh = waterMonument(type,tier);
      mesh.computeBoundingBox();
      const {min,max} = mesh.boundingBox!;
      expect(min.y).toBeLessThan(0);
      expect(max.y).toBeGreaterThan(0);
      expect(Math.max(-min.x,-min.z,max.x,max.z)).toBeLessThan(0.5);
      if (tier===3) outlines.add(Array.from(mesh.getAttribute("position").array).join(","));
      mesh.dispose();
    }
    expect(outlines.size).toBe(types.length);
  });

  it("supports the park's trees and pavilion but leaves water between the monumental gate piers", () => {
    const park = waterMonument("parkOfFortune",3);
    for (const [x,z] of [[-.082,-.063],[.156,-.158],[-.251,.211],[-.102,.049]])
      expect(topAt(park,x,z)).toBeCloseTo(.031);
    const gate = waterMonument("gateOfPower",3);
    expect(topAt(gate,0,0)).toBeUndefined();
    expect(topAt(gate,.188,0)).toBeGreaterThan(0);
    park.dispose();
    gate.dispose();
  });
});
