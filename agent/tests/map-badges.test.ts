import { describe, expect, it } from "vitest";
import { Matrix4, OrthographicCamera, Vector3 } from "three";
import { getMapBadges, projectMapBadge } from "../../src/scene/ActionBadges";
import { terrainHeight } from "../../src/scene/terrainElevation";
import { unitHealthAnchor } from "../../src/scene/unitModels";
import { applyAction } from "../../src/game";
import { deserializeGame, serializeGame } from "../../src/store/save";
import { addCity, addUnit, battlefield } from "./helpers";

describe("map action badges", () => {
  it("marks the player's queued training while it lasts and keeps rival orders private", () => {
    const game = battlefield();
    const city = game.cities[0];
    const result = applyAction(game, { type: "TRAIN", unitType: "archer", cityId: city.id });
    expect(result.ok).toBe(true);
    const after = result.state;
    after.cities[1].training = { unitType: "knight", readyRound: game.round + 3 };
    expect(getMapBadges(after)).toMatchObject([{ action: "training", cityName: city.name }]);
    after.currentPlayer = 1;
    expect(getMapBadges(after, false)).toMatchObject([{ action: "training", cityName: city.name }]);
    after.currentPlayer = 0;
    after.players[0].visible = [];
    expect(getMapBadges(after)).toEqual([]);
    after.players[0].visible = game.players[0].visible;
    const canceled = applyAction(after, { type: "CANCEL_TRAINING", cityId: city.id });
    expect(canceled.ok).toBe(true);
    expect(getMapBadges(canceled.state)).toEqual([]);
  });

  it("keeps the clock clear of both a city upgrade and an eligible veteran", () => {
    const game = battlefield();
    const city = game.cities[0];
    city.training = { unitType: "archer", readyRound: game.round + 2 };
    city.pendingRewardLevels = [2];
    addUnit(game, 0, "warrior", city.x, city.y).kills = 3;
    const [upgrade, promote, training] = getMapBadges(game);
    expect([upgrade.action, promote.action, training.action]).toEqual(["upgrade", "promote", "training"]);
    expect(training.position).toEqual(promote.position);
    expect(training.column! - promote.column!).toBeGreaterThan(1.25);
  });

  it("opens the city reward even when a garrison is on the same tile", () => {
    const game = battlefield();
    const capital = game.cities[0];
    capital.pendingRewards = 1;
    capital.pendingRewardLevels = [2];
    game.cities[1].pendingRewards = 1;
    game.cities[1].pendingRewardLevels = [2];
    addUnit(game, 0, "warrior", capital.x, capital.y);
    expect(getMapBadges(game)).toMatchObject([
      { action: "upgrade", cityName: capital.name },
    ]);
    expect(getMapBadges(game)[0].unitId).toBeUndefined();
  });

  it("offers the occupying unit only once it can capture", () => {
    const game = battlefield();
    const village = addCity(game, 3, 3);
    const unit = addUnit(game, 0, "warrior", village.x, village.y);
    unit.capturedTurn = game.round;
    expect(getMapBadges(game)).toEqual([]);
    game.round++;
    expect(getMapBadges(game)).toMatchObject([
      { action: "capture", unitId: unit.id },
    ]);
    unit.attacked = true;
    expect(getMapBadges(game)).toEqual([]);
  });

  it("offers promotion on ordinary tiles only when the visible unit can promote", () => {
    const game = battlefield();
    const unit = addUnit(game, 0, "warrior", 3, 3);
    addUnit(game, 1, "warrior", 5, 3).kills = 4;
    addUnit(game, 0, "giant", 4, 3).kills = 4;
    unit.kills = 2;
    expect(getMapBadges(game)).toEqual([]);
    unit.kills++;
    unit.moved = unit.attacked = true;
    const badges = getMapBadges(game);
    expect(badges).toMatchObject([{ action: "promote", unitId: unit.id }]);
    game.players[0].visible = game.players[0].visible.filter((id) => id !== badges[0].tileId);
    expect(getMapBadges(game)).toEqual([]);
    game.players[0].visible.push(badges[0].tileId);

    const promoted = applyAction(game, { type: "PROMOTE", unitId: unit.id });
    expect(promoted.ok).toBe(true);
    expect(getMapBadges(promoted.state)).toEqual([]);
    const restored = deserializeGame(serializeGame(promoted.state));
    expect(restored.events.at(-1)).toMatchObject({ type: "promotion", unitId: unit.id });
  });

  it.each(["upgrade", "capture"] as const)("keeps %s and promotion side by side above a garrison", (cityAction) => {
    const game = battlefield();
    const city = cityAction === "upgrade" ? game.cities[0] : addCity(game, 3, 3);
    if (cityAction === "upgrade") city.pendingRewardLevels = [2];
    const unit = addUnit(game, 0, "warrior", city.x, city.y);
    unit.kills = 3;
    unit.capturedTurn = game.round - 1;

    const badges = getMapBadges(game);
    expect(badges).toMatchObject([
      { action: cityAction, column: -1 },
      { action: "promote", unitId: unit.id, column: 1 },
    ]);
    const [x, , z] = badges[0].position;
    const camera = new OrthographicCamera(-330, 330, 210, -210, 0.1, 240);
    camera.position.set(x + 13, 17, z + 13);
    camera.lookAt(x, 0, z);
    camera.updateMatrixWorld();
    const matrix = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const rendered = new Set([badges[0].tileId]);
    for (const compact of [false, true]) {
      const coordinates = badges.map((badge) => {
        const point = new Vector3();
        expect(projectMapBadge(badge, rendered, matrix, { width: 660, height: 420 }, point, compact)).toBe(true);
        return point;
      });
      expect(coordinates[0].y).toBe(coordinates[1].y);
      expect(coordinates[1].x - coordinates[0].x).toBeGreaterThan(compact ? 32 : 66);
    }
  });

  it.each(["warrior", "swordsman", "knight", "rider", "giant"] as const)(
    "keeps the %s flag tip clear of its HP label while zooming and panning",
    (type) => {
      const game = battlefield();
      game.round++;
      const city = addCity(game, 3, 3);
      const unit = addUnit(game, 0, type, city.x, city.y);
      unit.capturedTurn = game.round - 1;
      const badge = getMapBadges(game)[0];
      const rendered = new Set([badge.tileId]);
      const size = { width: 980, height: 720 };
      const camera = new OrthographicCamera(-490, 490, 360, -360, 0.1, 240);
      const screen = new Vector3();
      const matrix = new Matrix4();
      const [x, , z] = badge.position;
      camera.position.set(x + 13, 17, z + 13);
      camera.lookAt(x, 0, z);
      camera.updateMatrixWorld();
      for (const zoom of [20, 70, 150]) {
        camera.zoom = zoom;
        camera.updateProjectionMatrix();
        matrix.multiplyMatrices(
          camera.projectionMatrix,
          camera.matrixWorldInverse,
        );
        expect(projectMapBadge(badge, rendered, matrix, size, screen)).toBe(
          true,
        );
        const [healthX, healthY, healthZ] = unitHealthAnchor(type);
        const health = new Vector3(
          x + healthX,
          terrainHeight(game.tiles[badge.tileId]) + 0.08 + healthY,
          z + healthZ,
        ).project(camera);
        const healthLabelTop =
          ((1 - health.y) * size.height) / 2 - (0.34 * 0.7 * zoom) / 2;
        expect(screen.y).toBeLessThan(healthLabelTop);
      }
      expect(projectMapBadge(badge, new Set(), matrix, size, screen)).toBe(
        false,
      );
      camera.position.x += 30;
      camera.updateMatrixWorld();
      matrix.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      );
      expect(projectMapBadge(badge, rendered, matrix, size, screen)).toBe(
        false,
      );
    },
  );

  it("hides model actions outside current vision, during AI turns and after the game", () => {
    const game = battlefield();
    game.cities[0].pendingRewards = 1;
    game.cities[0].pendingRewardLevels = [2];
    game.currentPlayer = 1;
    expect(getMapBadges(game)).toEqual([]);
    game.currentPlayer = 0;
    game.status = "finished";
    expect(getMapBadges(game)).toEqual([]);
    game.status = "playing";
    game.players[0].visible = [];
    expect(getMapBadges(game)).toEqual([]);
  });
});
