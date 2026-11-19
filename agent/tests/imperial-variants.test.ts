import { Mesh, MeshBasicMaterial, Raycaster, Vector3, type BufferGeometry } from "three";
import { describe, expect, it } from "vitest";
import { BUILDINGS } from "../../src/game/data/config";
import { MODEL_SETS, structureVariant } from "../../src/nations/models";
import { danubianCity } from "../../src/nations/_shared/danubian/cities";
import { cityAppearance } from "../../src/scene/factionModels";
import { deserializeGame, serializeGame } from "../../src/store/save";
import { newGame } from "./helpers";

function verifyVariations(base: BufferGeometry, makeGeometry: (variant: number) => BufferGeometry) {
  base.computeBoundingBox();
  const foundation = base.boundingBox!.min.y;
  base.dispose();
  const shapes = new Set<number>();
  for (const variant of [0, 1, 2, 3]) {
    const geometry = makeGeometry(variant);
    geometry.computeBoundingBox();
    const { min, max } = geometry.boundingBox!;
    expect(Math.max(-min.x, -min.z, max.x, max.z)).toBeLessThanOrEqual(0.5);
    expect(min.y).toBeGreaterThanOrEqual(foundation - 0.002);
    expect(geometry.getAttribute("color").count).toBe(geometry.getAttribute("position").count);
    const vertices = geometry.getAttribute("position").array;
    let hash = 2166136261;
    for (const bits of new Uint32Array(vertices.buffer)) hash = Math.imul(hash ^ bits, 16777619);
    shapes.add(hash);
    geometry.dispose();
  }
  expect(shapes.size).toBe(4);
}

function roofPlan(geometry: BufferGeometry, material: MeshBasicMaterial) {
  const mesh = new Mesh(geometry, material);
  const side = 24;
  const ray = new Raycaster(), origin = new Vector3(), down = new Vector3(0, -1, 0);
  return Array.from({ length: side * side }, (_, cell) => {
    ray.set(origin.set((cell % side + 0.5) / side - 0.5, 2, (Math.floor(cell / side) + 0.5) / side - 0.5), down);
    return ray.intersectObject(mesh, false)[0]?.point.y ?? 0;
  });
}

describe("Imperial architecture variations", () => {
  it.each([0, 1, 2, 3, 4, 5, 6])("provides four city silhouettes within the square at stage %i", level => {
    const base = MODEL_SETS.danubian.city("#937051", level, level > 0, level > 0);
    verifyVariations(base, variant => MODEL_SETS.imperia.city("#937051", level, level > 0, level > 0, variant));
  });

  it.each([0, 1, 2, 3, 4, 5, 6])("preserves the main building and rebuilds the quarter at stage %i", level => {
    const color = "#937051";
    const landmark = danubianCity(color, level, false, false, { companions: () => {} });
    const shared = MODEL_SETS.danubian.city(color, level, false, false);
    const material = new MeshBasicMaterial();
    const variants = [0, 1, 2, 3].map(variant => MODEL_SETS.imperia.city(color, level, false, false, variant));
    try {
      landmark.computeBoundingBox();
      shared.computeBoundingBox();
      const highest = landmark.boundingBox!.max.y;
      expect(highest).toBeCloseTo(shared.boundingBox!.max.y, 5);

      const plans = variants.map(city => {
        city.computeBoundingBox();
        expect(city.boundingBox!.max.y).toBeCloseTo(highest, 5);
        // The landmark is baked first, with the same shape, orientation and paint.
        for (const attribute of ["position", "normal", "color"]) {
          const original = landmark.getAttribute(attribute).array;
          expect(city.getAttribute(attribute).array.slice(0, original.length)).toEqual(original);
        }
        return roofPlan(city, material);
      });

      for (let i = 0; i < plans.length; i++) for (const other of plans.slice(i + 1)) {
        const height = plans[i];
        const built = height.filter((y, cell) => Math.max(y, other[cell]) > 0.05).length;
        const changed = height.filter((y, cell) => Math.abs(y - other[cell]) > 0.055).length;
        expect(changed / built).toBeGreaterThan(0.16);
      }
    } finally {
      landmark.dispose();
      shared.dispose();
      material.dispose();
      for (const city of variants) city.dispose();
    }
  });

  it.each(Object.values(BUILDINGS).map(b => b.id))("gives %s four shapes at each of its three tiers", type => {
    for (const tier of [1, 2, 3] as const) {
      const base = MODEL_SETS.danubian.building(type, "#937051", tier);
      verifyVariations(base, variant => MODEL_SETS.imperia.building(type, "#937051", tier, variant));
    }
  });

  it("regenerates the same choices from old saves without storing any structure index", () => {
    const game = newGame({ scenario: "story", civilization: "imperia", seed: "imperial-workshops" });
    const oldSave = JSON.parse(serializeGame(game));
    for (const tile of oldSave.game.tiles) delete tile.terrainVariant;
    const restored = deserializeGame(JSON.stringify(oldSave));
    const choices = game.tiles.map(tile => structureVariant(MODEL_SETS.imperia, game.options.seed, tile));
    expect(new Set(choices)).toEqual(new Set([0, 1, 2, 3]));
    expect(restored.tiles.map(tile => structureVariant(MODEL_SETS.imperia, restored.options.seed, tile))).toEqual(choices);
    expect(restored.tiles.map(tile => structureVariant(MODEL_SETS.imperia, "different-seed", tile))).not.toEqual(choices);
  });

  it("uses the terrain nation's village model then switches to the current owner's models", () => {
    const game = newGame({ scenario: "story", civilization: "imperia" });
    const neutral = game.cities.find(city => city.owner === null)!;
    expect(cityAppearance(game.players, neutral, "imperia")).toMatchObject({ modelSet: "imperia", level: 0 });
    expect(cityAppearance(game.players, { ...neutral, owner: 0 }, "nosta").modelSet).toBe("imperia");
    const nosta = game.players.find(player => player.civilization === "nosta")!;
    expect(cityAppearance(game.players, { ...neutral, owner: nosta.id }, "imperia").modelSet).toBe("nosta");
    expect(structureVariant(MODEL_SETS.nosta, game.options.seed, neutral)).toBeUndefined();
  });
});
