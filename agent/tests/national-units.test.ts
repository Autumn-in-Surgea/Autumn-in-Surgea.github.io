import { describe, expect, it } from "vitest";
import { UNITS } from "../../src/game/data/config";
import type { UnitType } from "../../src/game/types";
import { MODEL_SETS } from "../../src/nations/models";
import { NATIONS } from "../../src/nations/registry";

const types = Object.keys(UNITS) as UnitType[];

describe("national board sculptures", () => {
  it("builds a distinct, cached and paintable sculpture for every nation and unit", async () => {
    const poses = new Set<string>();
    for (const nation of NATIONS) {
      const models = MODEL_SETS[nation.modelSet];
      for (const type of types) {
        const label = nation.id + "/" + type;
        const pair = models.unit(type);
        expect(models.unit(type), label).toBe(pair);
        const fingerprints: string[] = [];
        for (const part of [pair.body, pair.enamel]) {
          const points = part.getAttribute("position");
          expect(points.count, label).toBeGreaterThan(2);
          expect(part.getAttribute("normal").count, label).toBe(points.count);
          expect(part.getAttribute("color").count, label).toBe(points.count);
          expect(Number.isFinite(part.boundingSphere?.radius), label).toBe(true);
          expect(part.getIndex()!.count % 3, label).toBe(0);
          const { min, max } = part.boundingBox!;
          expect(Math.max(-min.x, max.x, -min.z, max.z), label).toBeLessThanOrEqual(.5);
          expect(models.labelHeight(type), label).toBeGreaterThan(max.y + .1);
          const bytes = new Uint8Array(points.array.buffer, points.array.byteOffset, points.array.byteLength);
          const digest = await crypto.subtle.digest("SHA-256", bytes.slice());
          fingerprints.push(new Uint8Array(digest).join(","));
        }
        expect(pair.enamel.getAttribute("color").array.every(value => value === 1), label).toBe(true);
        const digest = fingerprints.join("/");
        expect(poses.has(digest), label).toBe(false);
        poses.add(digest);
      }
    }
    expect(poses.size).toBe(types.length * NATIONS.length);
    expect(MODEL_SETS.danubian.unit("warrior")).toBe(MODEL_SETS.imperia.unit("warrior"));
  });
});
