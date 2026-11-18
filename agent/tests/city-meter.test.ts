import { describe, expect, it } from "vitest";
import { cityMeter } from "../../src/ui/cityMeter";

describe("city population and unit meter", () => {
  it("marks stationed units even in slots without population", () => {
    expect(cityMeter(1, 2, 4).cells).toEqual([
      { fill: 1, unit: 1 },
      { fill: 0, unit: 1 },
      { fill: 0, unit: 0 },
      { fill: 0, unit: 0 },
    ]);
  });

  it("keeps population independent when there are fewer units than filled slots", () => {
    expect(cityMeter(2, 1, 3).cells).toEqual([
      { fill: 1, unit: 1 },
      { fill: 1, unit: 0 },
      { fill: 0, unit: 0 },
    ]);
  });

  it("keeps deficits separate and bounds implausibly high imported capacity", () => {
    const meter = cityMeter(-2, 1, Number.MAX_SAFE_INTEGER);
    expect(meter.deficit).toBe(-2);
    expect(meter.cells.length).toBeLessThan(129);
    expect(meter.cells[0]).toEqual({ fill: 0, unit: 1 });
    expect(meter.cells.every((cell) => cell.fill === 0)).toBe(true);
  });
});
