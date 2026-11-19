import { describe, expect, it } from "vitest";
import {
  applyAction,
  CIVILIZATIONS,
  DEFAULT_OPTIONS,
  distance,
  generateMap,
  getCityIncome,
  getReachableTiles,
  isSettlementTerrain,
  isWater,
  MAP_SIZE_CHOICES,
  neighbors,
  opponentLimit,
  OPENING_PROFILES,
  type Resource,
  type Terrain,
} from "../../src/game";
import { STORY_RIVER_CHANNELS } from "../../src/game/map/story";
import { STORY_CITIES } from "../../src/game/map/storyGeography";
import { assignTerrainVariants } from "../../src/game/map/terrainVariants";
import { DEFAULT_TERRAIN_VARIANT, getFactionPack, getNation } from "../../src/nations/registry";
import { deserializeGame, serializeGame, validateGameOptions } from "../../src/store/save";
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
    expect(first.options.size).toBe(64);
    expect(first.players).toHaveLength(5);
    expect(shape(first)).toEqual(shape(second));
    for (const name of storyNames)
      expect(first.cities.some((city) => city.name === name)).toBe(true);
    expect(first.players[0].civilization).toBe("imperia");
    expect(second.players[0].civilization).toBe("rina");
  });
  it("places the story cities in close corridors and deliberately sparse regions", () => {
    const game = newGame({ scenario: "story", civilization: "rina" });
    const size = game.options.size;
    expect(game.cities).toHaveLength(45);
    expect(new Set(game.cities.map(city => city.name)).size).toBe(game.cities.length);
    const nearest = game.cities.map(city => {
      expect(game.tiles[city.y * size + city.x].terrain, city.name).toBe("plain");
      return Math.min(...game.cities.filter(other => other !== city).map(other => distance(city, other)));
    });
    expect(Math.min(...nearest)).toBeGreaterThanOrEqual(3);
    expect(nearest.filter(gap => gap === 3).length).toBeGreaterThanOrEqual(8);
    const landLinks = (radius: number) => {
      const outskirts = game.cities.map(city =>
        game.tiles.filter(tile => !isWater(tile) && distance(tile, city) <= radius),
      );
      return outskirts.map((tiles, index) => outskirts.flatMap((other, neighbor) =>
        index !== neighbor && tiles.some(one => other.some(two =>
          Math.abs(one.x - two.x) + Math.abs(one.y - two.y) === 1,
        )) ? [neighbor] : [],
      ));
    };
    expect(landLinks(1).flat().length / 2).toBeGreaterThanOrEqual(10);
    const expanded = landLinks(2);
    for (const [mainCity, minimum] of [["中京", 30], ["千华", 4]] as const) {
      const connected = new Set([game.cities.findIndex(city => city.name === mainCity)]);
      for (const city of connected) for (const neighbor of expanded[city]) connected.add(neighbor);
      expect(connected.size).toBeGreaterThanOrEqual(minimum);
    }
    expect(STORY_CITIES.filter(city => city.region === "帝国中原").length).toBeGreaterThanOrEqual(13);
    for (const region of ["北部草原", "西部高原"]) {
      expect(STORY_CITIES.filter(city => city.region === region)).toHaveLength(1);
    }
    const steppe = STORY_CITIES.find(city => city.region === "北部草原")!;
    const mohai = STORY_CITIES.find(city => city.name === "漠海")!;
    expect(mohai.region).toBe("帝国中原");
    expect(mohai.x).toBeLessThan(steppe.x);
    expect(mohai.y).toBeGreaterThan(steppe.y);
    expect(game.cities.find(city => city.name === "漠海")).toMatchObject({ x: 15, y: 20 });
    expect(game.cities.find(city => city.name === "望川")).toMatchObject({ x: 25, y: 27 });
    expect(game.cities.find(city => city.name === "柳梁")).toMatchObject({ x: 20, y: 32 });
    expect(nearest.some(gap => gap >= 9)).toBe(true);
    const home = game.cities.find(city => city.capitalOf === 0)!;
    expect(home.territory.some(id => game.tiles[id].resource === "fish")).toBe(true);
  });

  it("keeps scattered shallow steppe pools separate from rivers and the sea", () => {
    const { tiles, cities } = newGame({ scenario: "story" });
    const size = Math.sqrt(tiles.length);
    const steppe = cities.find(city => city.name === "怀远")!;
    const visited = new Set<number>();
    const poolSizes: number[] = [];
    for (const tile of tiles) {
      if (!isWater(tile) || distance(tile, steppe) > 8 || tile.x < steppe.x - 4 ||
        tile.x > steppe.x + 6 ||
        visited.has(tile.id)) continue;
      const basin = [tile];
      visited.add(tile.id);
      for (const cell of basin) {
        for (const next of neighbors(tiles, size, cell)) {
          if (Math.abs(next.x - cell.x) + Math.abs(next.y - cell.y) !== 1 ||
            !isWater(next) || visited.has(next.id)) continue;
          visited.add(next.id);
          basin.push(next);
        }
      }
      if (basin.some(cell => Math.min(cell.x, cell.y, size - cell.x - 1, size - cell.y - 1) === 0)) continue;
      expect(basin.every(cell => cell.terrain === "shallow")).toBe(true);
      poolSizes.push(basin.length);
    }
    expect(poolSizes.sort((left, right) => left - right)).toEqual([1, 2]);
    for (const [x, y] of [[28, 16], [26, 18]]) {
      const pond = tiles[y * size + x];
      expect(pond.terrain).toBe("shallow");
      expect(neighbors(tiles, size, pond).filter(tile =>
        Math.abs(tile.x - x) + Math.abs(tile.y - y) === 1,
      ).every(tile => !isWater(tile))).toBe(true);
    }
  });

  it("gives each story capital a nearby neutral settlement on ordinary land", () => {
    const game = newGame({ scenario: "story" });
    const size = game.options.size;
    const neutral = new Set(game.cities.filter(city => city.owner === null).map(city => city.y * size + city.x));
    for (const capital of game.cities.filter(city => city.capitalOf !== null)) {
      const frontier = [{ id: capital.y * size + capital.x, steps: 0 }];
      const visited = new Set([frontier[0].id]);
      for (const { id, steps } of frontier) {
        if (steps >= 8) continue;
        for (const tile of neighbors(game.tiles, size, game.tiles[id])) {
          if (visited.has(tile.id) || !isSettlementTerrain(tile)) continue;
          visited.add(tile.id);
          frontier.push({ id: tile.id, steps: steps + 1 });
        }
      }
      expect(frontier.some(({ id }) => neutral.has(id)), capital.name).toBe(true);
    }
  });

  it("preserves a wide deep-water corridor between the continent and eastern islands", () => {
    const { tiles, cities, options: { size } } = newGame({ scenario: "story" });
    const datai = cities.find(city => city.name === "大台")!;
    const qianhua = cities.find(city => city.name === "千华")!;
    let openRows = 0;
    for (let y = datai.y - 6; y <= datai.y + 6; y++) {
      let consecutive = 0;
      for (const tile of tiles.filter(tile => tile.y === y && tile.x > datai.x && tile.x < qianhua.x)) {
        consecutive = tile.terrain === "deep" ? consecutive + 1 : 0;
        if (consecutive < 7) continue;
        openRows++;
        break;
      }
    }
    expect(openRows).toBeGreaterThanOrEqual(8);
    const easternMargin = tiles.filter(tile => tile.x >= size - 5 && tile.y >= 2 && tile.y < size - 2);
    expect(easternMargin.every(tile => tile.terrain === "deep")).toBe(true);
  });

  it("joins the central corridor through actual city expansion rewards", () => {
    const game = newGame({ scenario: "story", civilization: "imperia" });
    const capital = game.cities.find(city => city.capitalOf === 0)!;
    const next = game.cities.find(city => city.name === "砾都")!;
    const unit = game.units.find(piece => piece.owner === 0)!;
    Object.assign(unit, { x: next.x, y: next.y, moved: false, attacked: false, capturedTurn: 0 });
    const capture = applyAction(game, { type: "CAPTURE", unitId: unit.id });
    expect(capture.ok).toBe(true);
    function touches(state: typeof game) {
      const a = state.cities.find(city => city.id === capital.id)!;
      const b = state.cities.find(city => city.id === next.id)!;
      return a.territory.some(aId => b.territory.some(bId => {
        const one = state.tiles[aId], two = state.tiles[bId];
        return !isWater(one) && !isWater(two) &&
          Math.abs(one.x - two.x) + Math.abs(one.y - two.y) === 1;
      }));
    }
    let state = capture.state;
    expect(touches(state)).toBe(false);
    for (const id of [capital.id, next.id]) {
      const city = state.cities.find(candidate => candidate.id === id)!;
      Object.assign(city, { level: 4, pendingRewards: 1, pendingRewardLevels: [4] });
      const expansion = applyAction(state, { type: "CITY_REWARD", cityId: id, reward: "territory" });
      expect(expansion.ok).toBe(true);
      state = expansion.state;
    }
    expect(touches(state)).toBe(true);
  });

  it("restores the story atlas with the surveyed board and accepts older story dimensions", () => {
    const atlas = newGame({ scenario: "story", civilization: "imperia" });
    expect(deserializeGame(serializeGame(atlas))).toEqual(atlas);
    for (const size of [32, 48]) {
      const formerBoard = newGame({ scenario: "fair", civilization: "imperia", aiCount: 4, size });
      formerBoard.options.scenario = "story";
      expect(deserializeGame(serializeGame(formerBoard))).toEqual(formerBoard);
    }
    expect(() => validateGameOptions({ ...atlas.options, size: 80 })).not.toThrow();
    expect(() => validateGameOptions({ ...atlas.options, scenario: "fair", size: 80 })).toThrow("地图大小");
  });

  it("opens a surveyed story map without triggering discovery rewards or popups", () => {
    const game = newGame({ scenario: "story", civilization: "imperia" });
    const survey = game.tiles.map(tile => tile.id);
    for (const player of game.players) {
      expect(player.visible).toEqual(survey);
      expect(player.explored).toEqual(survey);
      expect(player.stats.explored).toBe(survey.length);
      expect(player.metPlayers).toEqual(game.players.filter(other => other.id !== player.id).map(other => other.id));
    }
    expect(game.events.filter(event => event.notice)).toEqual([]);
    expect(game.cities.every(city => city.pendingRewards === 0 && city.population === 0)).toBe(true);
    const end = applyAction(game, { type: "END_TURN" });
    expect(end.ok).toBe(true);
    expect(end.state.players.every(player => player.visible.length === survey.length)).toBe(true);
    expect(end.state.events.filter(event => event.notice)).toEqual([]);
    const random = newGame({ scenario: "fair" });
    expect(random.players.every(player => player.explored.length < random.tiles.length)).toBe(true);
  });

  it("keeps every named story river edge-connected all the way into the open sea", () => {
    const { tiles, cities } = newGame({ scenario: "story" });
    const size = Math.sqrt(tiles.length);
    const cardinal = (id: number) => {
      const { x, y } = tiles[id];
      return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
        .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < size && ny < size)
        .map(([nx, ny]) => ny * size + nx);
    };
    // Only bodies of water connected to the frame count as the sea.
    const coast = tiles.filter(tile => isWater(tile) &&
      (tile.x === 0 || tile.y === 0 || tile.x === size - 1 || tile.y === size - 1)).map(tile => tile.id);
    const sea = new Set(coast);
    for (let i = 0; i < coast.length; i++) {
      for (const id of cardinal(coast[i])) if (isWater(tiles[id]) && !sea.has(id)) {
        sea.add(id);
        coast.push(id);
      }
    }
    for (const channel of STORY_RIVER_CHANNELS) {
      expect(channel.length).toBeGreaterThan(1);
      expect(channel.every(id => isWater(tiles[id]))).toBe(true);
      expect(channel.every((id, i) => i === 0 || cardinal(channel[i - 1]).includes(id))).toBe(true);
      expect(sea.has(channel.at(-1)!)).toBe(true);
    }
    const [central] = STORY_RIVER_CHANNELS;
    for (const [x, y] of [[16, 32], [23, 33], [27, 31], [31, 29]]) {
      expect(isWater(tiles[y * size + x])).toBe(false);
    }
    const datai = cities.find(city => city.name === "大台")!;
    expect(central).toContain((datai.y - 1) * size + datai.x);
    const mouth = tiles[central.at(-1)!];
    expect(mouth.y).toBeLessThan(datai.y);
    expect(distance(datai, mouth)).toBeLessThanOrEqual(4);
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

  it("starts with a selected nation and independently configurable free-mode opponents", () => {
    const nation = getNation("rina")!;
    const options = {
      scenario: "free" as const,
      size: 32,
      civilization: nation.id,
      aiCount: 10,
      factionNames: ["Ignored player name", "Custom rival"],
      startingProfiles: ["luxury", "hunting"],
    };
    const game = newGame(options);
    expect(game.players).toHaveLength(11);
    expect(game.players[0]).toMatchObject({
      civilization: nation.id,
      name: nation.name,
      color: nation.color,
      technologies: nation.opening.technologies,
      resources: nation.opening.stars,
    });
    expect(game.cities.find(city => city.capitalOf === 0)?.name).toBe(nation.capital);
    expect(game.players[1]).toMatchObject({
      civilization: "neutral",
      name: "Custom rival",
      technologies: ["hunting"],
    });
    expect(game.players.slice(1).every(player => player.civilization === "neutral")).toBe(true);
    expect(deserializeGame(serializeGame(game))).toEqual(game);
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
    for (const id of world.starts) expect(world.tiles[id].terrain).toBe("plain");
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
    const mountain = world.tiles.find(tile => tile.terrain === "mountain" &&
      tile.x > 0 && tile.x < 19 && tile.y > 0 && tile.y < 19)!;
    expect(() =>
      generateMap({
        ...options,
        mapSettings: {
          ...options.mapSettings,
          customSpawns: [mountain, spawns[1]],
        },
      }),
    ).toThrow(/山地/);
  });

  it.each(["balanced", "random"] as const)("puts all %s free-mode settlements on clear flat terrain", (spawnMode) => {
    const options = {
      ...DEFAULT_OPTIONS,
      scenario: "free" as const,
      size: 24,
      aiCount: 4,
      seed: "mountain-settlements",
      mapSettings: {
        ...DEFAULT_OPTIONS.mapSettings,
        landRatio: 1,
        mountainRatio: 0.45,
        forestRatio: 0.35,
        villageDensity: 0.09,
        spawnMode,
      },
    };
    const map = generateMap(options);
    const game = newGame(options);
    expect(map.starts).toHaveLength(5);
    expect(map.villages.length).toBeGreaterThan(0);
    expect(map.tiles.filter(tile => tile.terrain === "mountain").length).toBeGreaterThan(200);
    const positions = game.cities.map(city => city.y * options.size + city.x);
    expect(positions).toEqual([...map.starts, ...map.villages]);
    for (const id of positions) {
      expect(map.tiles[id]).toMatchObject({ terrain: "plain", resource: null, ruin: false });
      expect(game.tiles[id]).toMatchObject({ terrain: "plain", resource: null, ruin: false });
    }
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
