import { expect, it } from "vitest";
import { danubianUnit } from "../../src/nations/_shared/danubian/units";

it("uses only untoned faction enamel across land-piece pedestals", () => {
  for (const type of ["warrior", "rider", "catapult", "giant"] as const) {
    const { body, enamel } = danubianUnit(type);
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
