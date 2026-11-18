import { expect, it } from "vitest";
import { danubianModels } from "../../src/nations/_shared/danubian";

const landPieces = [
  "warrior", "defender", "archer", "swordsman", "mindBender", "cloak", "dagger",
  "rider", "knight", "catapult", "giant",
] as const;

it("uses only untoned faction enamel across land-piece pedestals", () => {
  for (const type of landPieces) {
    const { body, enamel } = danubianModels.unit(type);
    body.computeBoundingBox();
    expect(body.boundingBox!.min.y).toBeGreaterThan(.118);
    const vertices = enamel.getAttribute("position");
    const color = enamel.getAttribute("color");
    const baseVertices = Array.from({ length: vertices.count }, (_, index) => index)
      .filter(index => vertices.getY(index) <= .11801);
    expect(baseVertices.length).toBeGreaterThan(100);
    for (const index of baseVertices)
      expect([color.getX(index), color.getY(index), color.getZ(index)]).toEqual([1, 1, 1]);
  }
});

it("keeps health labels above the helmets and equipment of the taller pieces", () => {
  for (const type of landPieces) {
    const { body, enamel } = danubianModels.unit(type);
    body.computeBoundingBox();
    enamel.computeBoundingBox();
    const top = Math.max(body.boundingBox!.max.y, enamel.boundingBox!.max.y);
    expect(danubianModels.labelHeight(type) - top, type).toBeGreaterThan(.10);
  }
});
