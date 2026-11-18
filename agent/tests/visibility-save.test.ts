import { describe, expect, it } from "vitest";
import {
  applyAction,
  getAttackTargets,
  getReachableTiles,
  getVisibleResource,
  isUnitVisible,
  runAiTurn,
} from "../../src/game";
import type {
  Action,
  BuildingId,
  CivilizationId,
  GameState,
  Player,
  Resource,
  Terrain,
  UnitType,
} from "../../src/game/types";
import {
  deserializeGame,
  MAX_SAVE_BYTES,
  serializeGame,
} from "../../src/store/save";
import { DEFAULT_TERRAIN_VARIANT } from "../../src/nations/registry";
import { addCity, addUnit, battlefield, newGame } from "./helpers";

describe("independent fog, stealth and resource discovery", () => {
  it("keeps other capitals and their units outside the initial human visibility", () => {
    const game = newGame();
    expect(game.players[0].explored).not.toEqual(game.players[1].explored);
    const enemy = game.units.find((unit) => unit.owner === 1)!;
    expect(isUnitVisible(game, enemy, 0)).toBe(false);
    expect(
      game.players[0].visible.every((id) =>
        game.players[0].explored.includes(id),
      ),
    ).toBe(true);
  });
  it("does not target hidden or currently unseen enemies", () => {
    const game = battlefield(),
      attacker = addUnit(game, 0, "archer", 3, 3),
      target = addUnit(game, 1, "cloak", 5, 3);
    target.hidden = true;
    expect(isUnitVisible(game, target, 0)).toBe(false);
    expect(getAttackTargets(game, attacker.id)).toEqual([]);
    target.hidden = false;
    game.players[0].visible = game.players[0].visible.filter(
      (id) => id !== 3 * 12 + 5,
    );
    expect(
      applyAction(game, {
        type: "ATTACK",
        unitId: attacker.id,
        targetId: target.id,
      }).ok,
    ).toBe(false);
  });
  it("retains exploration after moving and maintains separate visibility arrays", () => {
    const game = newGame(),
      unit = game.units[0],
      destinations = getReachableTiles(game, unit.id);
    expect(destinations.length).toBeGreaterThan(0);
    const moved = applyAction(game, {
      type: "MOVE",
      unitId: unit.id,
      to: destinations[0],
    });
    expect(moved.ok).toBe(true);
    expect(
      game.players[0].explored.every((id) =>
        moved.state.players[0].explored.includes(id),
      ),
    ).toBe(true);
    expect(moved.state.players[0].visible).not.toBe(
      moved.state.players[1].visible,
    );
  });
  it.each([
    ["crop", "organization"],
    ["ore", "climbing"],
    ["starfish", "fishing"],
  ] as const)("reveals %s only after %s", (resource, technology) => {
    const game = battlefield(),
      tile = game.tiles[0];
    tile.resource = resource;
    game.players[0].technologies = [];
    expect(getVisibleResource(game, tile, 0)).toBeNull();
    game.players[0].technologies.push(technology);
    expect(getVisibleResource(game, tile, 0)).toBe(resource);
  });
});

describe("version-two snapshot validation", () => {
  it("round-trips a real state, preserving references and legal future actions", () => {
    const game = applyAction(newGame(), { type: "END_TURN" }).state;
    const restored = deserializeGame(serializeGame(game));
    expect(restored).toEqual(game);
    expect(restored).not.toBe(game);
    expect(applyAction(restored, { type: "END_TURN" }).ok).toBe(true);
  });
  it("migrates missing terrain variants to the imperial pack regardless of tile owner", () => {
    const game = newGame({ civilization: "rina" });
    const snapshot = JSON.parse(serializeGame(game));
    const city = game.cities[0];
    const capitalId = city.y * game.options.size + city.x;
    for (const tile of snapshot.game.tiles) delete tile.terrainVariant;

    const restored = deserializeGame(JSON.stringify(snapshot));
    expect(restored.players[0].civilization).toBe("rina");
    expect(restored.tiles[capitalId].owner).toBe(0);
    expect(restored.tiles.every((tile) => tile.terrainVariant === DEFAULT_TERRAIN_VARIANT)).toBe(true);
  });
  it.each(["neutral", "unknown", null, 42])("rejects an explicit invalid terrain variant (%s)", (terrainVariant) => {
    const snapshot = JSON.parse(serializeGame(newGame()));
    snapshot.game.tiles[0].terrainVariant = terrainVariant;
    expect(() => deserializeGame(JSON.stringify(snapshot))).toThrow(/地块资产变体/);
  });
  it("preserves terrain variants through capture, new claims, terrain edits and save round-trips", () => {
    let game = battlefield();
    const town = addCity(game, 5, 5, 1);
    const townId = town.y * game.options.size + town.x;
    const fieldId = townId + 1;
    const unclaimedId = townId - 1;
    game.tiles[townId] = { ...game.tiles[townId], terrainVariant: "nosta" };
    game.tiles[fieldId] = { ...game.tiles[fieldId], terrainVariant: "rina" };
    game.tiles[unclaimedId] = { ...game.tiles[unclaimedId], terrainVariant: "determia", owner: null };
    town.territory = town.territory.filter((id) => id !== unclaimedId);
    game.round = 2;
    const occupier = addUnit(game, 0, "warrior", town.x, town.y);
    occupier.capturedTurn = 1;
    const variants = game.tiles.map((tile) => tile.terrainVariant);
    game = deserializeGame(serializeGame(game));
    expect(game.tiles.map((tile) => tile.terrainVariant)).toEqual(variants);

    function apply(action: Action) {
      const result = applyAction(game, action);
      expect(result.ok, result.error).toBe(true);
      game = result.state;
      expect(game.tiles.map((tile) => tile.terrainVariant)).toEqual(variants);
    }
    apply({ type: "CAPTURE", unitId: occupier.id });
    expect(game.tiles[townId]).toMatchObject({ owner: 0, terrainVariant: "nosta" });
    expect(game.tiles[unclaimedId]).toMatchObject({ owner: 0, terrainVariant: "determia" });
    apply({ type: "GROW_FOREST", tileId: fieldId });
    expect(game.tiles[fieldId]).toMatchObject({ terrain: "forest", terrainVariant: "rina" });
    apply({ type: "CLEAR_FOREST", tileId: fieldId });
    expect(game.tiles[fieldId]).toMatchObject({ terrain: "plain", terrainVariant: "rina" });
    expect(deserializeGame(serializeGame(game))).toEqual(game);
  });
  it("rejects old rules, unknown formats and invalid JSON clearly", () => {
    expect(() => deserializeGame("not-json")).toThrow(/JSON/);
    expect(() => deserializeGame("{}")).toThrow(/存档/);
    expect(() =>
      deserializeGame(
        JSON.stringify({ format: "autumn-v1", game: { version: 1 } }),
      ),
    ).toThrow(/旧版/);
  });
  const corruptions: [string, (game: GameState) => void][] = [
    [
      "unknown civilization",
      (game) => {
        game.players[0].civilization = "unknown" as CivilizationId;
      },
    ],
    [
      "unknown unit type",
      (game) => {
        game.units[0].type = "unknown" as UnitType;
      },
    ],
    [
      "inherited unit key",
      (game) => {
        game.units[0].type = "toString" as UnitType;
      },
    ],
    [
      "unknown terrain",
      (game) => {
        game.tiles[0].terrain = "void" as Terrain;
      },
    ],
    [
      "unknown resource",
      (game) => {
        game.tiles[0].resource = "gold" as Resource;
      },
    ],
    [
      "unknown building",
      (game) => {
        game.tiles[0].building = "castle" as BuildingId;
      },
    ],
    [
      "unknown technology",
      (game) => {
        game.players[0].technologies.push("alchemy");
      },
    ],
    [
      "negative stars",
      (game) => {
        game.players[0].resources = -1;
      },
    ],
    [
      "nonfinite stars",
      (game) => {
        game.players[0].resources = Infinity;
      },
    ],
    [
      "fractional statistics",
      (game) => {
        game.players[0].stats.kills = 1.5;
      },
    ],
    [
      "missing statistics",
      (game) => {
        delete (game.players[0] as Partial<Player>).stats;
      },
    ],
    [
      "invalid unit owner",
      (game) => {
        game.units[0].owner = 11;
      },
    ],
    [
      "invalid city owner",
      (game) => {
        game.cities[0].owner = -1;
      },
    ],
    [
      "duplicate player ids",
      (game) => {
        game.players[1].id = 0;
      },
    ],
    [
      "duplicate unit ids",
      (game) => {
        game.units[1].id = game.units[0].id;
      },
    ],
    [
      "duplicate city ids",
      (game) => {
        game.cities[1].id = game.cities[0].id;
      },
    ],
    [
      "incorrect tile index",
      (game) => {
        game.tiles[0].id = 99;
      },
    ],
    [
      "out of bounds unit",
      (game) => {
        game.units[0].x = game.options.size;
      },
    ],
    [
      "zero HP unit",
      (game) => {
        game.units[0].hp = 0;
      },
    ],
    [
      "HP greater than maximum",
      (game) => {
        game.units[0].hp = game.units[0].maxHp + 1;
      },
    ],
    [
      "overlapping units",
      (game) => {
        game.units[1].x = game.units[0].x;
        game.units[1].y = game.units[0].y;
      },
    ],
    [
      "missing home city",
      (game) => {
        game.units[0].homeCityId = "missing";
      },
    ],
    [
      "missing city reference",
      (game) => {
        game.tiles[0].cityId = "missing";
      },
    ],
    [
      "city center mismatch",
      (game) => {
        const city = game.cities[0];
        game.tiles[city.y * game.options.size + city.x].cityId = null;
      },
    ],
    [
      "territory outside map",
      (game) => {
        game.cities[0].territory.push(game.tiles.length);
      },
    ],
    [
      "duplicate territory",
      (game) => {
        game.cities[0].territory.push(game.cities[0].territory[0]);
      },
    ],
    [
      "visibility outside map",
      (game) => {
        game.players[0].visible.push(game.tiles.length);
      },
    ],
    [
      "invalid diplomacy reference",
      (game) => {
        game.players[0].peaceWith = [999];
      },
    ],
    [
      "self embassy",
      (game) => {
        game.players[0].embassies = [0];
      },
    ],
    [
      "unknown monument",
      (game) => {
        game.players[0].builtMonuments = ["farm" as "altarOfPeace"];
      },
    ],
    [
      "invalid opening profile",
      (game) => {
        game.options.startingProfiles = ["unknown"];
      },
    ],
    [
      "invalid independent flag",
      (game) => {
        game.units[0].independent = "true" as unknown as boolean;
      },
    ],
    [
      "unknown unlocked monument",
      (game) => {
        game.players[0].unlockedMonuments = ["farm" as "altarOfPeace"];
      },
    ],
    [
      "invalid color",
      (game) => {
        game.players[0].color = "url(unsafe)";
      },
    ],
    [
      "reward queue mismatch",
      (game) => {
        game.cities[0].pendingRewards = 1;
        game.cities[0].pendingRewardLevels = [];
      },
    ],
    [
      "invalid carried type",
      (game) => {
        game.units[0].carried = {
          type: "ocean" as UnitType,
          maxHp: 10,
          kills: 0,
          veteran: false,
        };
      },
    ],
    [
      "eliminated current player",
      (game) => {
        game.players[0].eliminated = true;
      },
    ],
    [
      "winner before game over",
      (game) => {
        game.winner = 0;
      },
    ],
    [
      "unsafe id sequence",
      (game) => {
        game.nextId = 1;
      },
    ],
    [
      "too many AI",
      (game) => {
        game.options.aiCount = 11;
      },
    ],
    [
      "invalid map ratio",
      (game) => {
        game.options.mapSettings.landRatio = 4;
      },
    ],
  ];
  it.each(corruptions)(
    "rejects %s before scene and AI use it",
    (_name, corrupt) => {
      const game = newGame();
      corrupt(game);
      expect(() => deserializeGame(serializeGame(game))).toThrow(/存档/);
    },
  );
  it("enforces an eight MB UTF-8 size limit", () => {
    expect(() => deserializeGame(" ".repeat(MAX_SAVE_BYTES + 1))).toThrow(
      /文件大小/,
    );
    expect(() => deserializeGame("秋".repeat(2_700_000))).toThrow(/文件大小/);
  });
  it("round-trips a 64 by 64 eleven-faction game without the old size or civilization restrictions", () => {
    const game = newGame({ size: 64, aiCount: 10 });
    expect(deserializeGame(serializeGame(game))).toEqual(game);
  }, 15000);
  it("preserves legitimate negative population, veteran HP and lost home cities", () => {
    const game = newGame();
    game.cities[0].population = -2;
    game.units[0].veteran = true;
    game.units[0].maxHp = game.units[0].hp = 15;
    game.units[0].kills = 3;
    game.units[0].homeCityId = "";
    expect(deserializeGame(serializeGame(game))).toEqual(game);
  });
  it("restores every turn and the final result throughout a real AI match", () => {
    let game = newGame({ mode: "score", maxRounds: 30, aiCount: 2 });
    for (
      let turn = 0;
      game.status === "playing" &&
      turn < game.options.maxRounds * game.players.length + 1;
      turn++
    ) {
      game = runAiTurn(game, 32);
      const restored = deserializeGame(serializeGame(game));
      expect(restored).toEqual(game);
      game = restored;
    }
    expect(game.status).toBe("finished");
  }, 20000);
});

describe("sparse setup arrays from late opponent edits", () => {
  it("normalizes unset factions and profiles before JSON persistence", () => {
    const factionNames: string[] = [], startingProfiles: string[] = [];
    factionNames[10] = "  第十对手  "; startingProfiles[10] = "philosophy";
    const game = newGame({ scenario: "free", size: 64, aiCount: 10, factionNames, startingProfiles });
    expect(game.options.factionNames).toEqual([...Array(10).fill(""), "第十对手"]);
    expect(game.options.startingProfiles).toEqual([...Array(10).fill("random"), "philosophy"]);
    expect(game.players[10].name).toBe("第十对手");
    expect(game.players[10].technologies).toEqual(["philosophy"]);
    expect(game.units.find((unit) => unit.owner === 10)?.type).toBe("mindBender");
    const restored = deserializeGame(serializeGame(game));
    expect(restored).toEqual(game);
    expect(applyAction(restored, { type: "END_TURN" }).ok).toBe(true);
  });
});
