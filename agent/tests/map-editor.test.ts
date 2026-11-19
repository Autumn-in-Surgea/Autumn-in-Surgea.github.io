import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS } from "../../src/game/data/config";
import {
  createEditorDraft,
  getBrushTiles,
  moveEditorCity,
  paintEditorTiles,
  renameEditorCity,
} from "../../src/game/map/editorDraft";
import { createGame } from "../../src/game/rules/engine";
import { deserializeGame, serializeGame } from "../../src/store/save";

describe("story map editor draft", () => {
  it("loads all names and the six approved preview positions independently of the game", () => {
    const game = createGame({ ...DEFAULT_OPTIONS, scenario: "story" });
    const draft = createEditorDraft();
    expect(draft.options.size).toBe(64);
    expect(draft.units).toEqual([]);
    expect(draft.events).toEqual([]);
    expect(game.units).toHaveLength(5);
    expect(draft.cities.map(city => city.name)).toEqual(game.cities.map(city => city.name));
    expect(new Set(draft.cities.map(city => city.name)).size).toBe(45);
    for (const [name, x, y] of [
      ["孤泉", 12, 15], ["嘉原", 18, 16], ["辽汀", 26, 11],
      ["丹阳", 25, 15], ["岑阳", 16, 52], ["岚港", 25, 50],
    ]) {
      expect(draft.cities.find(city => city.name === name)).toMatchObject({ x, y });
    }
    expect(draft.tiles.filter(tile => tile.owner !== null)).toHaveLength(5);
    expect(draft.players.every(player => player.visible.length === draft.tiles.length)).toBe(true);
  });

  it("clips circular brushes at board edges", () => {
    expect(getBrushTiles(4, 0, 0)).toEqual([0]);
    expect(getBrushTiles(4, 0, 1)).toEqual([0, 1, 4]);
    expect(getBrushTiles(4, 0, 2)).toEqual([0, 1, 2, 4, 5, 8]);
    expect(getBrushTiles(4, 16, 1)).toEqual([]);
    expect(getBrushTiles(4, 0, -1)).toEqual([]);
  });

  it("protects city and lighthouse squares and only clears incompatible scenery", () => {
    const draft = createEditorDraft();
    const city = draft.tiles.find(tile => tile.cityId)!;
    const lighthouse = draft.tiles.find(tile => tile.lighthouse)!;
    const fruit = draft.tiles.find(tile => tile.resource === "fruit")!;
    const ruin = draft.tiles.find(tile => tile.ruin)!;
    expect(paintEditorTiles(draft, [city.id, lighthouse.id, -1], "deep")).toBe(draft);
    const painted = paintEditorTiles(draft, [fruit.id, ruin.id], "shallow");
    expect(painted.tiles[fruit.id]).toMatchObject({ terrain: "shallow", resource: null, terrainVariant: fruit.terrainVariant });
    expect(painted.tiles[ruin.id].ruin).toBe(false);
    expect(draft.tiles[fruit.id].resource).toBe("fruit");
    expect(painted.tiles[city.id]).toBe(city);
  });

  it("moves and renames a capital with consistent IDs and survives round-trip storage", () => {
    const draft = createEditorDraft();
    const city = draft.cities.find(candidate => candidate.capitalOf === 0)!;
    const source = city.y * draft.options.size + city.x;
    const target = draft.tiles.find(tile => tile.terrain === "forest" && !tile.cityId)!;
    const water = draft.tiles.find(tile => tile.terrain === "deep")!;
    const lighthouse = draft.tiles.find(tile => tile.lighthouse)!;
    for (const invalid of [water.id, lighthouse.id, source, -1]) {
      expect(moveEditorCity(draft, source, invalid)).toBe(draft);
    }
    const moved = moveEditorCity(draft, source, target.id);
    expect(draft.tiles[source].cityId).toBe(city.id);
    expect(moved.tiles[source]).toMatchObject({ cityId: null, owner: null });
    expect(moved.tiles[target.id]).toMatchObject({ terrain: "plain", cityId: city.id, owner: 0, resource: null, ruin: false });
    expect(moved.cities.find(candidate => candidate.id === city.id)).toMatchObject({
      x: target.x, y: target.y, territory: [target.id], capitalOf: 0,
    });
    expect(renameEditorCity(moved, city.id, "  大台  ")).toBe(moved);
    expect(renameEditorCity(moved, city.id, "  ")).toBe(moved);
    const renamed = renameEditorCity(moved, city.id, "  新中京  ");
    expect(renamed.cities.find(candidate => candidate.id === city.id)?.name).toBe("新中京");
    expect(deserializeGame(serializeGame(renamed))).toEqual(renamed);
  });
});
