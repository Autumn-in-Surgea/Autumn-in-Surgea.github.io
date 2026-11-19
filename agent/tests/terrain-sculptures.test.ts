import { MODEL_SETS } from "../../src/nations/models";
import { describe, expect, it } from "vitest";
import { battlefield } from "./helpers";
import { terrainInlay } from "../../src/scene/TerrainInlays";
import { Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { tileCap, tilePlinth } from "../../src/scene/BoardFrame";
import { developedLandscape, grove, mineSeams, mountain, resourceModel, siteLandscape } from "../../src/scene/landscape";
import { getTerrainAssets, representativeTerrain } from "../../src/nations/models";
import { DEFAULT_TERRAIN_VARIANT, NATIONS } from "../../src/nations/registry";

it("resolves each configured tile variant to a complete terrain asset pack", () => {
  const imperial = getTerrainAssets(DEFAULT_TERRAIN_VARIANT);
  expect(representativeTerrain).toBe(imperial);
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
    "keeps the %s silhouette low and within the tile at both levels of detail", (kind, sculpt) => {
      const detailed = sculpt(false), distant = sculpt(true);
      for (const model of [detailed, distant]) {
        model.computeBoundingBox();
        const { min, max } = model.boundingBox!;
        expect(Math.max(-min.x, -min.z, max.x, max.z)).toBeLessThan(0.475);
        expect(max.y).toBeLessThan(kind === "grove" ? 0.53 : 0.61);
      }
      expect(distant.index!.count).toBeLessThan(detailed.index!.count / 2);
      expect(distant.boundingBox!.max.y).toBeCloseTo(detailed.boundingBox!.max.y, 1);
      detailed.dispose();
      distant.dispose();
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
        const mesh = new Mesh(developedLandscape(kind, simple), new MeshBasicMaterial());
        expect(ray.intersectObject(mesh, false)).toHaveLength(0);
        mesh.geometry.computeBoundingBox();
        expect(mesh.geometry.boundingBox!.min.z).toBeGreaterThan(-0.5);
        expect(mesh.geometry.boundingBox!.max.y).toBeGreaterThan(0.30);
        mesh.material.dispose();
        mesh.geometry.dispose();
      }
    }
  });
  it("retains the original painted trees, peaks, ripe wheat and ore in place after development", () => {
    // Matching both position and paint rejects replacement terrain with a vaguely similar outline.
    const painted = (geometry: ReturnType<typeof grove>) => {
      const points = geometry.getAttribute("position"), colors = geometry.getAttribute("color");
      const vertices = new Set<string>();
      for (let i = 0; i < points.count; i++) {
        vertices.add([points.getX(i), points.getY(i), points.getZ(i), colors.getX(i), colors.getY(i), colors.getZ(i)].join("/"));
      }
      geometry.dispose();
      return vertices;
    };
    const retained = (original: Set<string>, after: Set<string>) =>
      Array.from(original).filter(vertex => after.has(vertex)).length / original.size;

    for (const simple of [true, false]) {
      const woods = painted(grove(simple)), rock = painted(mountain(simple));
      for (const site of ["forestEdge", "forestShrine", "quarry", "ridge"] as const) {
        const native = site.startsWith("forest") ? woods : rock;
        const worked = painted(developedLandscape(site, simple));
        const stable = painted(developedLandscape(site, simple, "standing"));
        expect(retained(native, worked), site).toBeGreaterThan(.54);
        expect(retained(stable, worked), site).toBe(1);
      }
    }
    const wheat = painted(resourceModel("crop")), ore = painted(resourceModel("ore"));
    const seams = painted(mineSeams("remaining")), extracted = painted(mineSeams("extracted"));
    expect(new Set([...seams, ...extracted])).toEqual(ore);
    for (const tier of [1, 2, 3] as const) {
      expect(retained(wheat, painted(MODEL_SETS.imperia.building("farm", "#94735b", tier)))).toBe(1);
      expect(retained(seams, painted(MODEL_SETS.imperia.building("mine", "#94735b", tier)))).toBe(1);
    }
  });

  it("keeps the fruit clusters clear of the tile center and smaller than wheat and starfish", () => {
    const models = (["fruit","crop","starfish"] as const).map(kind => resourceModel(kind));
    const widths = models.map(model => {
      model.computeBoundingBox();
      return model.boundingBox!.getSize(new Vector3()).x;
    });
    expect(widths[0]).toBeLessThan(0.48);
    expect(widths[1]).toBeGreaterThan(widths[0]);
    expect(widths[2]).toBeGreaterThan(widths[1]);
    const material = new MeshBasicMaterial();
    const orchard = new Mesh(models[0], material);
    const ray = new Raycaster(), down = new Vector3(0, -1, 0);
    for (const x of [-0.075, 0, 0.075]) for (const z of [-0.075, 0, 0.075]) {
      ray.set(new Vector3(x, 1, z), down);
      expect(ray.intersectObject(orchard)).toHaveLength(0);
    }
    material.dispose();
    models.forEach(model => model.dispose());
  });

  it.each([["fruit", 0.19], ["crop", 0.32], ["ore", 0.18], ["animal", 0.27], ["fish", 0.145], ["starfish", 0.09]] as const)(
    "keeps the %s cluster in its low local footprint", (kind, height) => {
      const geometry = resourceModel(kind);
      geometry.computeBoundingBox();
      const { min, max } = geometry.boundingBox!;
      expect(max.y).toBeLessThan(height);
      expect(Math.max(-min.x, -min.z, max.x, max.z)).toBeLessThan(0.475);
      geometry.dispose();
    },
  );
});


describe("plain and sea ornament", () => {
  it.each(["plain", "shallow", "deep"] as const)("keeps the same %s inlay across coordinates and terrain packs", terrain => {
    const game = battlefield();
    const tile = game.tiles.find(t => terrainInlay(game, t))!;
    const clear = { ...tile, terrain };
    expect(terrainInlay(game, clear)).toBeTruthy();
    expect(terrainInlay(game, { ...clear, x: 6, y: 5, terrainVariant: "nosta" })).toEqual(terrainInlay(game, clear));
  });

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
  it("keeps city lots, roads and ruins clear and moves the original inlay to the edge of developed lots", () => {
    const game = battlefield();
    const tile = game.tiles.find(t => terrainInlay(game,t))!;
    for (const patch of [{ road:true }, { cityId:"capital" }, { ruin:true }, { lighthouse:true }]) {
      expect(terrainInlay(game,{ ...tile, ...patch })).toBeNull();
    }
    for (const [terrain, building] of [["plain","farm"], ["shallow","port"]] as const) {
      const worked = terrainInlay(game, { ...tile, terrain, building });
      expect(worked?.terrain).toBe(terrain);
      expect(worked!.z).toBeGreaterThan(.29);
    }
  });
});
