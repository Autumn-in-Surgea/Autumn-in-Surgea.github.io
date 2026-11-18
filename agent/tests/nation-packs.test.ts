import { describe, expect, it } from "vitest";
import { TECHNOLOGIES, UNITS } from "../../src/game";
import { MODEL_SETS } from "../../src/nations/models";
import { NATIONS, getNation } from "../../src/nations/registry";

describe("nation resource packs", () => {
  it("gives each selectable nation its own emblem, board color and first-contact copy", () => {
    expect(new Set(NATIONS.map(nation => nation.images.emblem)).size).toBe(NATIONS.length);
    expect(new Set(NATIONS.map(nation => nation.color)).size).toBe(NATIONS.length);
    expect(new Set(NATIONS.map(nation => nation.notices.firstContact.message)).size).toBe(NATIONS.length);
    expect(getNation("neutral")).toBeUndefined();
  });

  it.each(NATIONS)("registers offline assets and a valid opening for $name", nation => {
    expect(getNation(nation.id)).toBe(nation);
    expect(nation.images.emblem).toMatch(new RegExp(`/nations/${nation.id}/logo\\.png$`));
    for (const technology of nation.opening.technologies)
      expect(TECHNOLOGIES.some(entry => entry.id === technology)).toBe(true);
    expect(UNITS[nation.opening.unit]).toBeDefined();
    const models = MODEL_SETS[nation.modelSet];
    expect(models.unit).toBeTypeOf("function");
    expect(models.city).toBeTypeOf("function");
    expect(models.building).toBeTypeOf("function");
  });
});
