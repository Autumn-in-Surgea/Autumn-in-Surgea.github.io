import { expect, it } from "vitest";
import { Vector3 } from "three";
import type { UnitType } from "../../src/game/types";
import { danubianModels } from "../../src/nations/_shared/danubian";

function measure(type: UnitType) {
  const { body, enamel } = danubianModels.unit(type);
  body.computeBoundingBox();
  enamel.computeBoundingBox();
  return body.boundingBox!.clone().union(enamel.boundingBox!);
}

it("keeps the bomber long while narrowing its full silhouette relative to the juggernaut", () => {
  const bomber = measure("bomber").getSize(new Vector3());
  const juggernaut = measure("juggernaut").getSize(new Vector3());
  expect(bomber.x).toBeLessThan(juggernaut.x * .8);
  expect(juggernaut.y).toBeGreaterThan(bomber.y * 1.15);
  expect(bomber.z).toBeCloseTo(.972, 3);
  expect(juggernaut.z).toBeCloseTo(.994, 3);
});

it.each(["raft", "dinghy", "pirate", "scout", "rammer", "bomber", "juggernaut"] as const)(
  "keeps the %s inside the diagonal board footprint and below its action badge height",
  type => {
    const bounds = measure(type);
    const { x: beam, z: length } = bounds.getSize(new Vector3());
    expect((beam + length) / Math.SQRT2).toBeLessThan(1);
    expect(danubianModels.labelHeight(type) - bounds.max.y).toBeGreaterThan(.1);
  },
);
