import { describe, expect, it } from "vitest";
import { cityMeter } from "../../src/ui/cityMeter";
import { labelBounce, sampleCityNameplate } from "../../src/scene/labelMotion";

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

  it("supports fractional fills and occupancy during a change", () => {
    expect(cityMeter(1.25, 0.5, 3).cells).toEqual([
      { fill: 1, unit: 0.5 },
      { fill: 0.25, unit: 0 },
      { fill: 0, unit: 0 },
    ]);
  });
});

describe("city nameplate motion", () => {
  const before = { population: 1, units: 2, capacity: 3, income: 3 };

  it("drains and fills the affected cells with the change in either direction", () => {
    const after = { ...before, population: -1, units: 1, income: 1 };
    const intermediate = sampleCityNameplate(before, after, 0.4);
    expect(intermediate.population).toBeLessThan(before.population);
    expect(intermediate.population).toBeGreaterThan(after.population);
    expect(intermediate.units).toBeGreaterThan(after.units);
    expect(intermediate.units).toBeLessThan(before.units);
    expect(sampleCityNameplate(before, after, 1)).toBe(after);
  });

  it("fills the old meter before showing the new capacity and remainder", () => {
    const after = { ...before, population: 1, capacity: 4, income: 4 };
    expect(sampleCityNameplate(before, after, 0.35)).toMatchObject({ capacity: 3 });
    expect(sampleCityNameplate(before, after, 0.35).population).toBeGreaterThan(2.9);
    expect(sampleCityNameplate(before, after, 0.4).population).toBeLessThan(0.2);
    expect(sampleCityNameplate(before, after, 0.4).capacity).toBe(4);
    expect(labelBounce(0.2)).toBeGreaterThan(0.8);
    expect(labelBounce(1)).toBeCloseTo(0);
  });
});
