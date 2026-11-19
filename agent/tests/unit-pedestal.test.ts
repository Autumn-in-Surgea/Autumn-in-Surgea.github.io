import { expect, it } from "vitest";
import { danubianModels } from "../../src/nations/_shared/danubian";

const landPieces = [
  "warrior", "defender", "archer", "swordsman", "mindBender", "cloak", "dagger",
  "rider", "knight", "catapult", "giant",
] as const;

it("uses a circular faction enamel disk and a separate gold rim on land pieces", () => {
  for (const type of landPieces) {
    const { body, enamel } = danubianModels.unit(type);
    const vertices = enamel.getAttribute("position");
    const color = enamel.getAttribute("color");
    const baseVertices = Array.from({ length: vertices.count }, (_, index) => index)
      .filter(index => vertices.getY(index) <= .11801);
    expect(baseVertices.length).toBeGreaterThan(100);
    const outerRadius = Math.max(...baseVertices.map(index => Math.hypot(vertices.getX(index), vertices.getZ(index))));
    expect(Math.max(...baseVertices.map(index => vertices.getX(index)))).toBeCloseTo(outerRadius, 4);
    expect(Math.max(...baseVertices.map(index => vertices.getZ(index)))).toBeCloseTo(outerRadius, 4);
    for (const index of baseVertices)
      expect([color.getX(index), color.getY(index), color.getZ(index)]).toEqual([1, 1, 1]);

    const rim = body.getAttribute("position");
    const metal = body.getAttribute("color");
    const rimVertices = Array.from({ length: rim.count }, (_, index) => index)
      .filter(index => rim.getY(index) <= .11801);
    expect(rimVertices.length).toBeGreaterThan(100);
    for (const index of rimVertices) {
      expect(rim.getY(index)).toBeGreaterThan(.095);
      expect(Math.hypot(rim.getX(index), rim.getZ(index))).toBeGreaterThan(outerRadius - .025);
      expect(metal.getX(index)).toBeGreaterThan(metal.getY(index));
      expect(metal.getY(index)).toBeGreaterThan(metal.getZ(index));
    }
  }
});

it("keeps action badge heights above the helmets and equipment of the taller pieces", () => {
  for (const type of landPieces) {
    const { body, enamel } = danubianModels.unit(type);
    body.computeBoundingBox();
    enamel.computeBoundingBox();
    const top = Math.max(body.boundingBox!.max.y, enamel.boundingBox!.max.y);
    expect(danubianModels.labelHeight(type) - top, type).toBeGreaterThan(.10);
  }
});
