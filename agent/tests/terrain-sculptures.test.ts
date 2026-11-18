import { describe, expect, it } from "vitest";
import { battlefield } from "./helpers";
import { terrainInlay } from "../../src/scene/TerrainInlays";
import { Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { tileCap, tilePlinth } from "../../src/scene/BoardFrame";
import { developedLandscape, grove, mountain, resourceModel, siteLandscape } from "../../src/scene/landscape";
import { getTerrainAssets } from "../../src/nations/models";
import { DEFAULT_TERRAIN_VARIANT, NATIONS } from "../../src/nations/registry";

it("resolves each configured tile variant to a complete terrain asset pack", () => {
  const imperial = getTerrainAssets(DEFAULT_TERRAIN_VARIANT);
  expect(imperial.details.forest).toBe(grove);
  expect(imperial.details.mountain).toBe(mountain);
  expect(imperial.developed).toBe(developedLandscape);
  expect(imperial.resource).toBe(resourceModel);
  for (const nation of NATIONS) {
    const assets = getTerrainAssets(nation.terrainVariant);
    for (const terrain of ["plain", "forest", "mountain", "shallow", "deep"] as const) {
      const shell = assets.shells[terrain];
      expect(shell.cap.getAttribute("position").count).toBeGreaterThan(0);
      expect(shell.plinth.getAttribute("position").count).toBeGreaterThan(0);
      expect(shell.color).toBeTruthy();
      expect(shell.plinthColor).toBeTruthy();
    }
    expect(assets.ruin).toBeTypeOf("function");
    expect(assets.lighthouse).toBeTypeOf("function");
  }
});

describe("carved terrain tiles", () => {
  it("keeps the cap pickable across its full playing face and bevel", () => {
    const mesh = new Mesh(tileCap, new MeshBasicMaterial());
    const ray = new Raycaster();
    for (const [x,z] of [[0,0], [0.47,0], [-0.47,0.46], [0.46,-0.47]]) {
      ray.set(new Vector3(x,1,z), new Vector3(0,-1,0));
      const hit = ray.intersectObject(mesh)[0];
      expect(hit?.point.y).toBeCloseTo(0.015);
    }
    ray.set(new Vector3(0.49,1,0), new Vector3(0,-1,0));
    expect(ray.intersectObject(mesh)[0]?.point.y).toBeLessThan(0.015);
    ray.set(new Vector3(0.51,1,0), new Vector3(0,-1,0));
    expect(ray.intersectObject(mesh)).toHaveLength(0);
    mesh.material.dispose();
  });

  it("keeps rising terrain sides pickable from each cardinal direction", () => {
    const mesh = new Mesh(tilePlinth, new MeshBasicMaterial());
    for (const [dx,dz] of [[1,0], [0,1], [-1,0], [0,-1]]) {
      const hit = new Raycaster(new Vector3(dx,0,dz), new Vector3(-dx,0,-dz)).intersectObject(mesh)[0];
      expect(hit?.distance).toBeLessThan(0.55);
    }
    mesh.material.dispose();
  });

  it.each([["grove",grove], ["mountain",mountain]] as const)(
    "keeps all %s silhouettes within the tile and the distant variant cheaper", (_, sculpt) => {
      for (let variant = 0; variant < 6; variant++) {
        const detailed = sculpt(variant,false), distant = sculpt(variant,true);
        for (const model of [detailed, distant]) {
          model.computeBoundingBox();
          const { min, max } = model.boundingBox!;
          expect(Math.max(-min.x, -min.z, max.x, max.z)).toBeLessThan(0.475);
        }
        expect(distant.index!.count).toBeLessThan(detailed.index!.count / 2);
        expect(distant.boundingBox!.max.y).toBeCloseTo(detailed.boundingBox!.max.y, 1);
        detailed.dispose();
        distant.dispose();
      }
    },
  );

  it("keeps trees and bedrock on developed tiles while leaving the working front of the site clear", () => {
    const tile = battlefield().tiles.find(t => !t.cityId)!;
    expect(siteLandscape({ ...tile, terrain: "forest", building: "lumberHut" })).toBe("forestEdge");
    expect(siteLandscape({ ...tile, terrain: "forest", building: "forge" })).toBe("forestEdge");
    expect(siteLandscape({ ...tile, terrain: "plain", building: "forge" })).toBeNull();
    expect(siteLandscape({ ...tile, terrain: "mountain", building: "mine" })).toBe("quarry");
    expect(siteLandscape({ ...tile, terrain: "mountain", building: "mountainTemple" })).toBe("ridge");
    const ray = new Raycaster(new Vector3(0.07, 1, 0.18), new Vector3(0, -1, 0));
    for (const kind of ["forestEdge", "quarry", "ridge"] as const) {
      for (const simple of [false, true]) {
        const mesh = new Mesh(developedLandscape(kind, 2, simple), new MeshBasicMaterial());
        expect(ray.intersectObject(mesh, false)).toHaveLength(0);
        mesh.geometry.computeBoundingBox();
        expect(mesh.geometry.boundingBox!.min.z).toBeGreaterThan(-0.5);
        expect(mesh.geometry.boundingBox!.max.y).toBeGreaterThan(0.30);
        mesh.material.dispose();
        mesh.geometry.dispose();
      }
    }
  });
  it("keeps the basic fruit tree smaller than crops and the navigation resource", () => {
    const models = (["fruit","crop","starfish"] as const).map(kind => resourceModel(kind));
    const widths = models.map(model => {
      model.computeBoundingBox();
      return model.boundingBox!.getSize(new Vector3()).x;
    });
    expect(widths[0]).toBeLessThan(0.34);
    expect(widths[1]).toBeGreaterThan(widths[0]);
    expect(widths[2]).toBeGreaterThan(widths[1]);
    models.forEach(model => model.dispose());
  });
});


describe("plain and sea ornament", () => {
  it.each([["plain","crop","organization"], ["deep","starfish","fishing"]] as const)(
    "preserves the same %s marks over a resource until it can be seen", (terrain, resource, reveal) => {
      const game = battlefield();
      game.players[0].technologies = [];
      for (const tile of game.tiles) tile.terrain = terrain;
      const tile = game.tiles.find(t => terrainInlay(game, t))!;
      const bare = terrainInlay(game, tile);
      tile.resource = resource;
      expect(terrainInlay(game, tile)).toEqual(bare);
      game.players[0].technologies.push(reveal);
      expect(terrainInlay(game, tile)).toBeNull();
    },
  );
  it("keeps city lots, roads, ruins and facilities clear", () => {
    const game = battlefield();
    const tile = game.tiles.find(t => terrainInlay(game,t))!;
    for (const patch of [{ road:true }, { cityId:"capital" }, { ruin:true }, { lighthouse:true }, { building:"farm" as const }]) {
      expect(terrainInlay(game,{ ...tile, ...patch })).toBeNull();
    }
  });
});
