import { describe, expect, it } from "vitest";
import {
  CIVILIZATIONS,
  DEFAULT_OPTIONS,
  distance,
  generateMap,
  getCityIncome,
  getReachableTiles,
  MAP_SIZE_CHOICES,
  opponentLimit,
  OPENING_PROFILES,
  type Resource,
  type Terrain,
} from "../../src/game";
import { assignTerrainVariants } from "../../src/game/map/terrainVariants";
import { DEFAULT_TERRAIN_VARIANT, getFactionPack, getNation } from "../../src/nations/registry";
import { deserializeGame, serializeGame } from "../../src/store/save";
import { newGame } from "./helpers";

const storyNames = ["中京", "大台", "春州", "长守", "漠海", "丰化", "千华"];
const shape = (game: ReturnType<typeof newGame>) => ({
  terrain: game.tiles.map((tile) => [tile.terrain, tile.resource]),
  cities: game.cities.map((city) => [city.name, city.x, city.y]).sort(),
});

describe("three distinct world modes", () => {
  it("reproduces identical fair starts from identical seeds", () => {
    expect(newGame()).toEqual(newGame());
    expect(newGame({ seed: "different-season" }).tiles).not.toEqual(
      newGame().tiles,
    );
  });
  it("keeps authored story geography and proper city names invariant across seed and faction", () => {
    const first = newGame({
      scenario: "story",
      civilization: "imperia",
      seed: "one",
    });
    const second = newGame({
      scenario: "story",
      civilization: "rina",
      seed: "two",
    });
    expect(first.options.size).toBe(32);
    expect(first.players).toHaveLength(5);
    expect(shape(first)).toEqual(shape(second));
    for (const name of storyNames)
      expect(first.cities.some((city) => city.name === name)).toBe(true);
    expect(first.players[0].civilization).toBe("imperia");
    expect(second.players[0].civilization).toBe("rina");
  });
  it.each(CIVILIZATIONS.map((civ) => civ.id))(
    "selects %s in story without adding a different ruleset",
    (civilization) => {
      const game = newGame({ scenario: "story", civilization });
      expect(game.players[0].civilization).toBe(civilization);
      const profiles: Record<string, string> = {
        imperia: "organization",
        determia: "strategy",
        nosta: "luxury",
        ida: "hunting",
        rina: "fishing",
      };
      for (const player of game.players) {
        const profile = OPENING_PROFILES.find(
          (candidate) => candidate.id === profiles[player.civilization],
        )!;
        expect(player.resources).toBe(profile.stars);
        expect(player.technologies).toEqual(
          profile.technology ? [profile.technology] : [],
        );
        expect(game.units.find((unit) => unit.owner === player.id)?.type).toBe(
          profile.unit,
        );
      }
    },
  );
  it.each(["free", "fair"] as const)(
    "%s can still reproduce an old anonymous opening",
    (scenario) => {
      const game = newGame({ scenario, aiCount: 4, size: 20 });
      expect(
        game.players.every((player) => player.civilization === "neutral"),
      ).toBe(true);
      expect(new Set(game.players.map((player) => player.name)).size).toBe(5);
      expect(game.cities.some((city) => storyNames.includes(city.name))).toBe(
        false,
      );
      expect(
        game.players.every(
          (player) =>
            player.resources === 5 &&
            player.technologies.join(",") === "organization",
        ),
      ).toBe(true);
      for (const player of game.players) {
        const city = game.cities.find(
          (candidate) => candidate.owner === player.id,
        )!;
        expect(getCityIncome(game, city.id)).toBe(2);
        expect(
          game.units.filter((unit) => unit.owner === player.id),
        ).toHaveLength(1);
        expect(game.units.find((unit) => unit.owner === player.id)?.type).toBe(
          "warrior",
        );
      }
    },
  );
  it.each(MAP_SIZE_CHOICES)("starts a %i-square fair game with the chosen nation and unique national rivals", (size) => {
    const options = {
      scenario: "fair" as const,
      civilization: "rina" as const,
      mapType: "continents" as const,
      seed: "nations-on-the-coast",
      aiCount: 10,
      size,
      factionNames: ["占位名称"],
      startingProfiles: ["luxury"],
    };
    const game = newGame(options);
    expect(game).toEqual(newGame(options));
    expect(game.options.aiCount).toBe(opponentLimit("fair"));
    expect(game.players[0].civilization).toBe("rina");
    expect(new Set(game.players.map(player => player.civilization)).size).toBe(game.players.length);
    expect(new Set(game.players.map(player => player.color)).size).toBe(game.players.length);
    expect(game.tiles).toHaveLength(size ** 2);
    for (const player of game.players) {
      const nation = getNation(player.civilization)!;
      const capital = game.cities.find(city => city.capitalOf === player.id)!;
      expect(player.name).toBe(nation.name);
      expect(player.color).toBe(nation.color);
      expect(player.technologies).toEqual(nation.opening.technologies);
      expect(game.units.find(unit => unit.owner === player.id)?.type).toBe(nation.opening.unit);
      expect(capital.name).toBe(nation.capital);
      expect(capital.level).toBe(nation.opening.cityLevel);
      const deposit = nation.opening.fairDeposit;
      if (deposit) {
        const tiles = capital.territory.map(id => game.tiles[id]);
        expect(tiles.filter(t => t.terrain === deposit.terrain && t.resource === deposit.resource).length)
          .toBeGreaterThanOrEqual(deposit.count);
      }
    }
    expect(deserializeGame(serializeGame(game))).toEqual(game);
  });

  it("keeps fair terrain dry when Rina's fishing is unlocked", () => {
    const game = newGame({ scenario: "fair", civilization: "rina", mapType: "dryland", size: 24 });
    expect(game.players[0].technologies).toContain("fishing");
    expect(game.tiles.some(tile => tile.terrain === "deep" || tile.terrain === "shallow")).toBe(false);
  });

  it("rejects duplicate or mixed nation rosters in a named fair save", () => {
    const game = newGame({ scenario: "fair", civilization: "imperia", size: 24 });
    for (const invalid of ["imperia", "neutral"] as const) {
      game.players[1].civilization = invalid;
      expect(() => deserializeGame(serializeGame(game))).toThrow(/国家列表/);
    }
  });

  it("accepts custom names in free mode", () => {
    const game = newGame({
      scenario: "free",
      factionNames: ["松岬联盟", "白川共和"],
    });
    expect(game.players.map((player) => player.name)).toEqual([
      "松岬联盟",
      "白川共和",
    ]);
  });
});

describe("map sizes, topology and configurable generation", () => {
  it.each([
    "dryland",
    "lakes",
    "continents",
    "archipelago",
    "waterworld",
  ] as const)(
    "%s provides usable, separate starts and coherent tile indices",
    (mapType) => {
      const game = newGame({ mapType, size: 20, aiCount: 4 });
      expect(game.tiles).toHaveLength(400);
      const capitals = game.cities.filter((city) => city.capitalOf !== null);
      expect(capitals).toHaveLength(5);
      expect(new Set(capitals.map((city) => city.y * 20 + city.x)).size).toBe(
        5,
      );
      game.tiles.forEach((tile, id) =>
        expect([tile.id, tile.x, tile.y]).toEqual([
          id,
          id % 20,
          Math.floor(id / 20),
        ]),
      );
      for (const player of game.players) {
        const unit = game.units.find(
          (candidate) => candidate.owner === player.id,
        )!;
        expect(
          getReachableTiles({ ...game, currentPlayer: player.id }, unit.id)
            .length,
        ).toBeGreaterThan(0);
      }
    },
  );
  it("supports a 64 by 64 world with ten AI opponents", () => {
    const game = newGame({ size: 64, aiCount: 10 });
    expect(game.tiles).toHaveLength(4096);
    expect(game.players).toHaveLength(11);
    expect(game.cities.filter((city) => city.capitalOf !== null)).toHaveLength(
      11,
    );
    expect(new Set(game.players.map((player) => player.color)).size).toBe(11);
    expect(
      game.units.every((unit) => unit.owner < 11 && unit.x < 64 && unit.y < 64),
    ).toBe(true);
  }, 15000);
  it("makes free-mode sliders materially affect terrain and resources", () => {
    const initial = newGame({ scenario: "free", size: 32 });
    const low = newGame({
      scenario: "free",
      size: 32,
      mapSettings: {
        ...initial.options.mapSettings,
        landRatio: 0.3,
        forestRatio: 0.05,
        mountainRatio: 0.05,
        resourceDensity: 0.1,
        villageDensity: 0.2,
      },
    });
    const high = newGame({
      scenario: "free",
      size: 32,
      mapSettings: {
        ...initial.options.mapSettings,
        landRatio: 0.85,
        forestRatio: 0.6,
        mountainRatio: 0.2,
        resourceDensity: 0.9,
        villageDensity: 0.8,
      },
    });
    expect(
      high.tiles.filter(
        (tile) => tile.terrain !== "shallow" && tile.terrain !== "deep",
      ).length,
    ).toBeGreaterThan(
      low.tiles.filter(
        (tile) => tile.terrain !== "shallow" && tile.terrain !== "deep",
      ).length,
    );
    expect(
      high.tiles.filter((tile) => tile.terrain === "forest").length,
    ).toBeGreaterThan(
      low.tiles.filter((tile) => tile.terrain === "forest").length,
    );
    expect(high.tiles.filter((tile) => tile.resource).length).toBeGreaterThan(
      low.tiles.filter((tile) => tile.resource).length,
    );
    expect(high.cities.length).toBeGreaterThan(low.cities.length);
    const detail = newGame({
      scenario: "free",
      size: 32,
      mapSettings: { ...initial.options.mapSettings, noiseScale: 12 },
    });
    expect(detail.tiles.map((tile) => tile.terrain)).not.toEqual(
      initial.tiles.map((tile) => tile.terrain),
    );
  });
  it("thins each non-ore resource by ten percent in seeded free maps", () => {
    const totals: Record<Terrain, number> = {
      plain: 0, forest: 0, mountain: 0, shallow: 0, deep: 0,
    };
    const counts: Record<Resource, number> = {
      fruit: 0, crop: 0, animal: 0, ore: 0, fish: 0, starfish: 0,
    };
    for (let i = 0; i < 12; i++) {
      const { tiles, starts } = generateMap({
        ...DEFAULT_OPTIONS, scenario: "free", size: 64, aiCount: 1, seed: `resource-rates-${i}`,
        mapSettings: { ...DEFAULT_OPTIONS.mapSettings, resourceDensity: 0.9, villageDensity: 0 },
      });
      for (const tile of tiles) {
        if (tile.ruin || tile.lighthouse || starts.some(id => distance(tile, tiles[id]) <= 2)) continue;
        totals[tile.terrain]++;
        if (tile.resource) counts[tile.resource]++;
      }
    }
    const rates = [
      ["fruit", counts.fruit / totals.plain, 0.2025, 0.016],
      ["crop", counts.crop / totals.plain, 0.2025, 0.016],
      ["animal", counts.animal / totals.forest, 0.405, 0.03],
      ["fish", counts.fish / totals.shallow, 0.405, 0.03],
      ["starfish", counts.starfish / totals.deep, 0.0729, 0.006],
      ["ore", counts.ore / totals.mountain, 0.7, 0.035],
    ] as const;
    for (const [resource, rate, expected, tolerance] of rates)
      expect(Math.abs(rate - expected), resource).toBeLessThan(tolerance);
  });
  it.each(["fair", "free"] as const)("places ruins on about one percent of eligible land in %s maps", (scenario) => {
    let land = 0;
    let ruins = 0;
    for (let i = 0; i < 6; i++) {
      const { tiles, starts, villages } = generateMap({
        ...DEFAULT_OPTIONS, scenario, size: 64, aiCount: 1, mapType: "dryland", seed: `ruin-rates-${i}`,
        mapSettings: { ...DEFAULT_OPTIONS.mapSettings, landRatio: 1 },
      });
      const villagesSet = new Set(villages);
      for (const tile of tiles) {
        if (tile.terrain === "shallow" || tile.terrain === "deep" || tile.lighthouse ||
          villagesSet.has(tile.id) || starts.some(id => distance(tile, tiles[id]) <= 1)) continue;
        land++;
        if (tile.ruin) ruins++;
      }
    }
    expect(Math.abs(ruins / land - 0.01)).toBeLessThan(0.003);
  });
  it.each(["fair", "free"] as const)("matches the mountain ore rate in %s maps independently of resource density", (scenario) => {
    const { tiles, starts, villages } = generateMap({
      ...DEFAULT_OPTIONS, scenario, size: 64, mapType: "dryland", seed: "mountain-ore-rate",
      mapSettings: { ...DEFAULT_OPTIONS.mapSettings, landRatio: 1, resourceDensity: 0 },
    });
    const mountains = tiles.filter(tile => tile.terrain === "mountain" && !tile.ruin &&
      !starts.includes(tile.id) && !villages.includes(tile.id));
    expect(mountains.length).toBeGreaterThan(350);
    expect(mountains.filter(tile => tile.resource === "ore").length / mountains.length).toBeCloseTo(0.7, 1);
    if (scenario === "free")
      expect(tiles.every(tile => !tile.resource || tile.resource === "ore")).toBe(true);
  });
  it("uses custom free-mode positions exactly and rejects duplicates or outside coordinates", () => {
    const base = newGame({ scenario: "free", size: 20, mapType: "dryland" });
    const spawns = base.cities
      .filter((city) => city.capitalOf !== null)
      .map((city) => ({ x: city.x, y: city.y }))
      .reverse();
    const options = {
      ...base.options,
      mapSettings: {
        ...base.options.mapSettings,
        spawnMode: "custom" as const,
        customSpawns: spawns,
      },
    };
    const world = generateMap(options);
    expect(world.starts).toEqual(
      spawns.map((position) => position.y * 20 + position.x),
    );
    expect(() =>
      generateMap({
        ...options,
        mapSettings: {
          ...options.mapSettings,
          customSpawns: [spawns[0], spawns[0]],
        },
      }),
    ).toThrow();
    expect(() =>
      generateMap({
        ...options,
        mapSettings: {
          ...options.mapSettings,
          customSpawns: [{ x: -1, y: 0 }, spawns[1]],
        },
      }),
    ).toThrow();
  });
});

describe("coordinate-bound terrain assets", () => {
  it.each(["fair", "free", "story"] as const)("uses the starting nations' configured variants throughout %s", (scenario) => {
    const game = newGame({ scenario, civilization: "nosta" });
    const expected = new Set(game.players.map(player => getFactionPack(player.civilization).terrainVariant));
    expect(new Set(game.tiles.map(tile => tile.terrainVariant))).toEqual(expected);
  });

  it("assigns all terrains by distance and breaks ties by the original coordinate", () => {
    const { tiles } = generateMap({ ...DEFAULT_OPTIONS, scenario: "free", size: 12, seed: "terrain-variant-border" });
    const anchors = [
      { tileId: 17, terrainVariant: "nosta" },
      { tileId: 13, terrainVariant: "rina" },
    ] as const;
    const assigned = assignTerrainVariants(tiles, anchors);
    expect(assigned[13].terrainVariant).toBe("rina");
    expect(assigned[17].terrainVariant).toBe("nosta");
    expect(assigned[15].terrainVariant).toBe("rina");
    expect(assigned[143].terrainVariant).toBe("nosta");
    expect(assigned).toEqual(assignTerrainVariants(tiles, [...anchors].reverse()));
    expect(tiles[15].terrainVariant).toBe(DEFAULT_TERRAIN_VARIANT);
  });

  it("uses configured variants at national capitals without changing generation rolls", () => {
    const options = { ...DEFAULT_OPTIONS, aiCount: 4, civilization: "rina" as const, seed: "terrain-variant-roster" };
    const original = generateMap(options);
    const rina = getNation("rina")!, nosta = getNation("nosta")!;
    const rinaVariant = rina.terrainVariant, nostaVariant = nosta.terrainVariant;
    try {
      rina.terrainVariant = "rina";
      nosta.terrainVariant = "nosta";
      const preview = generateMap(options);
      const fair = newGame(options);
      expect(preview.starts).toEqual(original.starts);
      expect(preview.villages).toEqual(original.villages);
      const geography = (map: typeof preview) => map.tiles.map(tile => [tile.terrain, tile.resource, tile.ruin]);
      expect(geography(preview)).toEqual(geography(original));
      expect(fair.tiles.map(tile => tile.terrainVariant)).toEqual(preview.tiles.map(tile => tile.terrainVariant));
      for (const [id, start] of preview.starts.entries()) {
        expect(preview.tiles[start].terrainVariant).toBe(getNation(fair.players[id].civilization)?.terrainVariant);
      }
      const story = generateMap({ ...options, scenario: "story" });
      const otherStory = generateMap({ ...options, scenario: "story", civilization: "imperia" });
      expect(story.tiles).toEqual(otherStory.tiles);
      expect(story.tiles[story.starts[0]].terrainVariant).toBe("rina");
    } finally {
      rina.terrainVariant = rinaVariant;
      nosta.terrainVariant = nostaVariant;
    }
  });
});

describe("opening choices preserve authored and previewed geography", () => {
  it.each(["balanced", "custom"] as const)(
    "preserves free-mode %s terrain and resources after selecting different openings",
    (spawnMode) => {
      const base = newGame({ scenario: "free", size: 20, aiCount: 4 });
      const customSpawns = base.cities
        .filter((city) => city.capitalOf !== null)
        .map((city) => ({ x: city.x, y: city.y }))
        .reverse();
      const settings = { ...base.options.mapSettings, spawnMode, customSpawns };
      const selected = newGame({
        ...base.options,
        mapSettings: settings,
        startingProfiles: ["fishing", "hunting", "farming", "organization", "fishing"],
      });
      const preview = generateMap(selected.options);
      const naturalFeatures = (tiles: typeof selected.tiles) => tiles.map((tile) => [
        tile.terrain, tile.resource, tile.ruin, tile.lighthouse,
      ]);
      expect(naturalFeatures(selected.tiles)).toEqual(naturalFeatures(preview.tiles));
      if (spawnMode === "custom") {
        expect(selected.cities.filter((city) => city.capitalOf !== null).map((city) => ({ x: city.x, y: city.y }))).toEqual(customSpawns);
      }
    },
  );
  it("preserves the authored story terrain and resources through civilization initialization", () => {
    const game = newGame({ scenario: "story", civilization: "rina", seed: "fixed-story" });
    const authored = generateMap(game.options);
    expect(game.tiles.map((tile) => [tile.terrain, tile.resource, tile.ruin, tile.lighthouse])).toEqual(
      authored.tiles.map((tile) => [tile.terrain, tile.resource, tile.ruin, tile.lighthouse]),
    );
  });
  it("keeps fair dryland completely dry even when all eleven factions select fishing", () => {
    const game = newGame({ size: 64, aiCount: 10, scenario: "fair", mapType: "dryland", startingProfiles: Array(11).fill("fishing") });
    expect(game.players.every((player) => player.technologies.includes("fishing"))).toBe(true);
    expect(game.tiles.some((tile) => tile.terrain === "shallow" || tile.terrain === "deep")).toBe(false);
  });
});
