import { describe, expect, it } from "vitest";
import { applyAction, canApplyAction, getCityIncome, isCityUnderSiege } from "../../src/game";
import { siegeStartsAt, visibleCitySieges } from "../../src/scene/citySiege";
import { planEncounter } from "../../src/scene/combatMotion";
import { rememberCombatEvents } from "../../src/workers/combatEvents";
import { observeMoves } from "../../src/workers/visibleMove";
import { addCity, addUnit, battlefield } from "./helpers";

describe("city siege presentation", () => {
  it("begins on the entry turn, before capture is available, and synchronizes to visible movement", () => {
    const game = battlefield();
    const city = game.cities[1];
    const destination = city.y * game.options.size + city.x;
    const warrior = addUnit(game, 0, "warrior", city.x - 1, city.y);
    expect(getCityIncome(game, city.id)).toBeGreaterThan(0);
    expect(isCityUnderSiege(game, city)).toBe(false);

    const action = { type: "MOVE", unitId: warrior.id, to: destination } as const;
    const result = applyAction(game, action);
    expect(result.ok).toBe(true);
    const after = result.state;
    expect(after.round).toBe(game.round);
    expect(getCityIncome(after, city.id)).toBe(0);
    expect(canApplyAction(after, { type: "CAPTURE", unitId: warrior.id })).toBe(false);
    const besieger = visibleCitySieges(after, new Set(after.players[0].visible)).get(city.id)!;
    expect(besieger.id).toBe(warrior.id);
    rememberCombatEvents(after, [], observeMoves(game, after, action));
    const battle = planEncounter(game, after);
    const movement = battle.journeys.get(warrior.id)?.at(-1);
    expect(movement).toBeDefined();
    const issuedAt = 125;
    expect(siegeStartsAt(besieger, { ...battle, issuedAt })).toBeCloseTo(
      issuedAt + (movement!.start + movement!.duration) * 1000,
    );
  });

  it("does not reveal a hidden occupier or a siege outside current visibility", () => {
    const game = battlefield();
    const city = game.cities[0];
    const occupier = addUnit(game, 1, "cloak", city.x, city.y);
    const visible = new Set(game.players[0].visible);
    expect(visibleCitySieges(game, visible).has(city.id)).toBe(true);
    expect(visibleCitySieges(game, new Set()).size).toBe(0);
    occupier.hidden = true;
    expect(isCityUnderSiege(game, city)).toBe(true);
    expect(visibleCitySieges(game, visible).size).toBe(0);
  });

  it("leaves neutral, treaty and friendly cities without siege visuals", () => {
    const game = battlefield();
    const city = game.cities[0];
    const neutral = addCity(game, 5, 5);
    addUnit(game, 0, "warrior", neutral.x, neutral.y);
    const occupier = addUnit(game, 1, "warrior", city.x, city.y);
    const visible = new Set(game.players[0].visible);
    expect([...visibleCitySieges(game, visible).keys()]).toEqual([city.id]);
    game.players[0].peaceWith.push(1);
    expect(isCityUnderSiege(game, city)).toBe(false);
    expect(getCityIncome(game, city.id)).toBeGreaterThan(0);
    expect(visibleCitySieges(game, visible).size).toBe(0);
    game.players[0].peaceWith = [];
    occupier.owner = 0;
    expect(visibleCitySieges(game, visible).size).toBe(0);
    occupier.owner = 1;
    occupier.x++;
    expect(visibleCitySieges(game, visible).size).toBe(0);
  });
});
