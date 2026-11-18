import { describe, expect, it } from "vitest";
import { Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { CIVILIZATIONS, factionForOwner, getFactionPack } from "../../src/nations/registry";
import { applyAction } from "../../src/game";
import { cityAppearance, MODEL_SETS } from "../../src/scene/factionModels";
import { deserializeGame, serializeGame } from "../../src/store/save";
import { addUnit, battlefield, newGame } from "./helpers";

describe("owner-selected faction assets", () => {
  it("resolves each story owner after selection and save restore, sharing this edition's sculptures", () => {
    const currentWarrior = MODEL_SETS.danubian.unit("warrior");
    for (const selected of CIVILIZATIONS) {
      const state = deserializeGame(serializeGame(newGame({ scenario: "story", civilization: selected.id })));
      expect(factionForOwner(state.players, 0)).toBe(selected);
      for (const unit of state.units) {
        const pack = factionForOwner(state.players, unit.owner);
        expect(pack.id).toBe(state.players[unit.owner].civilization);
        expect(MODEL_SETS[pack.modelSet].unit("warrior")).toBe(currentWarrior);
      }
    }
  });

  it.each(["fair", "free"] as const)("keeps custom names independent of the story asset registry in %s", scenario => {
    const state = newGame({ scenario, factionNames: ["铃亚", "帝国"] });
    const neutral = getFactionPack("neutral");
    for (const player of state.players) expect(factionForOwner(state.players, player.id)).toBe(neutral);
    expect(factionForOwner(state.players, null)).toBe(neutral);
  });

  it("uses the new owner of a converted piece", () => {
    const game = battlefield();
    game.players[0].civilization = "ida";
    game.players[1].civilization = "rina";
    const ally = addUnit(game, 0, "mindBender", 4, 4);
    const target = addUnit(game, 1, "warrior", 5, 4);
    expect(factionForOwner(game.players, target.owner).id).toBe("rina");
    const result = applyAction(game, { type: "CONVERT", unitId: ally.id, targetId: target.id });
    expect(result.ok).toBe(true);
    const converted = result.state.units.find(unit => unit.id === target.id)!;
    expect(factionForOwner(result.state.players, converted.owner).id).toBe("ida");
  });
});

describe("Danubian cities", () => {
  it("grows a distinct single-mesh skyline at each of the six levels and keeps it inside its tile", () => {
    let previousHeight = 0;
    let previousWidth = 0;
    for (let level = 0; level <= 6; level++) {
      const geometry = MODEL_SETS.danubian.city("#705868", level, false, false);
      geometry.computeBoundingBox();
      const { min, max } = geometry.boundingBox!;
      expect(max.y).toBeGreaterThan(previousHeight + 0.05);
      if (level < 6) expect(max.x - min.x).toBeGreaterThan(previousWidth);
      if (level >= 5) expect(max.x - min.x).toBeGreaterThan(0.93);
      expect(Math.max(-min.x, -min.z, max.x, max.z)).toBeLessThan(0.50);
      expect(geometry.getAttribute("color").count).toBe(geometry.getAttribute("position").count);
      previousHeight = max.y;
      previousWidth = max.x - min.x;
      geometry.dispose();
    }
  });

  it.each([[2, 3], [3, 4], [4, 5]])("separates the level %i houses with streets", (level, expectedBlocks) => {
    const mesh = new Mesh(MODEL_SETS.danubian.city("#576e63", level, false, false), new MeshBasicMaterial());
    const ray = new Raycaster(), down = new Vector3(0, -1, 0), origin = new Vector3();
    const side = 61, occupied = new Set<number>();
    for (let z = 0; z < side; z++) for (let x = 0; x < side; x++) {
      ray.set(origin.set((x - 30) * 0.016, 2, (z - 30) * 0.016), down);
      if ((ray.intersectObject(mesh, false)[0]?.point.y ?? 0) > 0.085) occupied.add(z * side + x);
    }
    // Count disconnected roof footprints, ignoring freestanding chimneys and small ornaments.
    let blocks = 0;
    for (const start of occupied) {
      const pending = [start];
      occupied.delete(start);
      let area = 0;
      while (pending.length) {
        const id = pending.pop()!;
        area++;
        for (const next of [id - 1, id + 1, id - side, id + side])
          if (occupied.delete(next)) pending.push(next);
      }
      if (area >= 36) blocks++;
    }
    expect(blocks).toBeGreaterThanOrEqual(expectedBlocks);
    mesh.geometry.dispose();
    mesh.material.dispose();
  });

  it("keeps streets open to the ground and lines all four edges with low houses at five and high buildings at six", () => {
    const ray = new Raycaster();
    const origin = new Vector3(), down = new Vector3(0, -1, 0);
    for (const level of [5, 6]) {
      const mesh = new Mesh(MODEL_SETS.danubian.city("#576e63", level, false, false), new MeshBasicMaterial());
      const heightAt = (x: number, z: number) => {
        ray.set(origin.set(x, 2, z), down);
        return ray.intersectObject(mesh, false)[0]?.point.y ?? 0;
      };
      for (const edge of [-0.425, 0.425]) {
        const positions = Array.from({ length: 15 }, (_, i) => (i - 7) * 0.06);
        for (const heights of [positions.map(z => heightAt(edge, z)), positions.map(x => heightAt(x, edge))]) {
          const street = heights.filter(h => level === 5 ? h > 0.08 && h < 0.31 : h > 0.30);
          expect(street.length).toBeGreaterThanOrEqual(11);
        }
      }
      // A roof or a modelled slab spanning the whole block would intercept all these rays.
      let open = 0;
      for (let x = -8; x <= 8; x++) for (let z = -8; z <= 8; z++)
        if (!heightAt(x * 0.05, z * 0.05)) open++;
      expect(open).toBeGreaterThan(10);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  });

  it("caps the sculpture and its cache variant at six without capping the city itself", () => {
    const game = battlefield();
    const city = game.cities[0];
    city.level = 6;
    const atSix = cityAppearance(game.players, city);
    city.level = 12;
    expect(cityAppearance(game.players, city)).toEqual(atSix);
    const six = MODEL_SETS.danubian.city(atSix.color, 6, true, true);
    const twelve = MODEL_SETS.danubian.city(atSix.color, 12, true, true);
    expect(twelve.getAttribute("position").array).toEqual(six.getAttribute("position").array);
    expect(city.level).toBe(12);
    six.dispose();
    twelve.dispose();
  });

  it("restyles a captured developed city using its new owner's asset pack and enamel", () => {
    const game = battlefield();
    game.players[0].civilization = "ida";
    game.players[1].civilization = "rina";
    const city = game.cities[1];
    city.level = 5;
    city.defenseBonus = 1;
    expect(cityAppearance(game.players, city).color).toBe(game.players[1].color);
    const unit = addUnit(game, 0, "warrior", city.x, city.y);
    unit.capturedTurn = game.round - 1;
    const captured = applyAction(game, { type: "CAPTURE", unitId: unit.id });
    expect(captured.ok).toBe(true);
    const changed = captured.state.cities.find(candidate => candidate.id === city.id)!;
    expect(changed.capitalOf).toBe(1);
    expect(cityAppearance(captured.state.players, changed)).toEqual({
      modelSet: getFactionPack("ida").modelSet, color: game.players[0].color,
      level: 5, capital: true, walls: true,
    });
    expect(cityAppearance(game.players, { ...city, owner: null })).toMatchObject({ level: 0, capital: false, walls: false });
  });
});
