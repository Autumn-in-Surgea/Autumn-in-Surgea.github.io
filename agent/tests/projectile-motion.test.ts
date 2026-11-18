import { describe, expect, it } from "vitest";
import { applyAction } from "../../src/game";
import type { UnitType } from "../../src/game/types";
import { observeMoves } from "../../src/workers/visibleMove";
import {
  carryStrikes,
  incomingOffset,
  planCombat,
  planEncounter,
  sampleAttackPose,
  strikeMotionEndsAt,
} from "../../src/scene/combatMotion";
import { rememberCombatEvents } from "../../src/workers/combatEvents";
import { addUnit, battlefield } from "./helpers";

function shoot(weapon: UnitType, retaliation = false) {
  const before = battlefield();
  const shooter = addUnit(before, 1, weapon, 5, 5);
  const defender = addUnit(before, 0, retaliation ? "archer" : "warrior", 7, 5);
  defender.hp = retaliation ? 10 : 1;
  before.currentPlayer = 1;
  const command = {
    type: "ATTACK" as const,
    unitId: shooter.id,
    targetId: defender.id,
  };
  return { before, shooter, defender, command };
}

describe("visible combat choreography", () => {
  it("brings the two bases together at damage time, then clears the way for the counter", () => {
    const before = battlefield();
    const attacker = addUnit(before, 0, "warrior", 5, 5);
    const defender = addUnit(before, 1, "warrior", 6, 6);
    const after = applyAction(before, { type: "ATTACK", unitId: attacker.id, targetId: defender.id }).state;
    const [strike, counter] = planCombat(before, after);
    expect(strike.contact).toBeDefined();
    const contact = strike.contact!;
    expect(sampleAttackPose(strike, strike.launch).travel).toBeCloseTo(-0.16);
    expect(contact.gap - sampleAttackPose(strike, strike.impact).travel).toBeCloseTo(0.505);
    expect(sampleAttackPose(strike, strike.impact + 0.02).travel).toBeCloseTo(contact.travel);
    expect(sampleAttackPose(strike, strikeMotionEndsAt(strike)).travel).toBeCloseTo(0);
    expect(counter.start).toBeGreaterThanOrEqual(strikeMotionEndsAt(strike));
    expect(counter.contact?.x).toBeCloseTo(-contact.x);
  });

  it.each([
    ["archer", "arrow"],
    ["catapult", "stone"],
    ["scout", "bolt"],
    ["bomber", "shell"],
  ] as const)(
    "%s identifies its projectile even on a fatal attack from the fog",
    (weapon, projectile) => {
      const { before, defender, command } = shoot(weapon);
      before.players[0].visible = [defender.y * 12 + defender.x];
      const result = applyAction(before, command);
      expect(result.ok).toBe(true);
      // Defender's death removed its own view by the time the Worker replied.
      result.state.players[0].visible = [];
      const [hit] = planCombat(before, result.state);
      expect(hit).toMatchObject({
        from: undefined,
        attackerId: undefined,
        targetId: defender.id,
        projectile,
        lethal: true,
        at: { x: 7, y: 5 },
      });
      expect(hit.impact).toBeGreaterThan(hit.launch + 0.25);
      const [x, z] = incomingOffset(hit.id);
      expect(Math.hypot(x, z)).toBeLessThan(0.5);
    },
  );
  it("fires a visible counter only after the first arrow lands and before the second impact", () => {
    const { before, command } = shoot("archer", true);
    const after = applyAction(before, command).state;
    const [one, two] = planCombat(before, after);
    expect(one.from).toEqual({ x: 5, y: 5 });
    expect(two.from).toEqual(one.at);
    expect(two.start).toBeGreaterThan(one.impact);
    expect(two.projectile).toBe("arrow");
    expect(two.impact).toBeGreaterThan(two.launch);
  });
  it("does not disclose an intervening hidden tile or fights between unseen opponents", () => {
    const { before, command } = shoot("archer");
    before.players[0].visible = [5 * 12 + 5, 5 * 12 + 7];
    const after = applyAction(before, command).state;
    expect(planCombat(before, after)[0].from).toBeUndefined();
    after.events.find((e) => e.combat)!.combat!.targetVisible = false;
    expect(planCombat(before, after)).toEqual([]);
  });
  it("uses one primary shell for a bomber and times splashes to its landing", () => {
    const { before, command } = shoot("bomber");
    addUnit(before, 0, "rider", 7, 6);
    const shots = planCombat(before, applyAction(before, command).state);
    expect(shots.filter((hit) => hit.projectile)).toHaveLength(1);
    expect(shots[1]).toMatchObject({ splash: true, impact: shots[0].impact });
  });
  it("carries visible attacks past a long AI turn's capped game log and re-times pending impacts across updates", () => {
    const { before, command } = shoot("archer", true);
    const after = applyAction(before, command).state;
    rememberCombatEvents(
      after,
      after.events.filter((e) => e.type === "attack"),
    );
    after.events = [];
    const strikes = planCombat(before, after);
    expect(strikes).toHaveLength(2);
    const [next] = planCombat(before, after, { strikes, issuedAt: 1000 }, 1100);
    expect(next.start).toBeGreaterThan(strikes[1].impact - 0.1);
    const moved = carryStrikes(strikes, 1000, 1100);
    expect(moved[1].impact + 0.1).toBeCloseTo(strikes[1].impact);
    expect(carryStrikes(moved, 1100, 8000)).toEqual([]);
  });
});

it("identifies a lethal splash when the primary bombardment hits an unseen third party", () => {
  const before = battlefield();
  const third = { ...structuredClone(before.players[1]), id: 2 };
  before.players.push(third);
  const shooter = addUnit(before, 1, "bomber", 5, 5);
  const hiddenTarget = { ...addUnit(before, 0, "warrior", 7, 5), owner: 2 };
  before.units[1] = hiddenTarget;
  const victim = addUnit(before, 0, "warrior", 7, 6);
  victim.hp = 1;
  addUnit(before, 0, "rider", 8, 6);
  before.players[0].visible = [79, 80];
  before.currentPlayer = 1;
  const result = applyAction(before, {
    type: "ATTACK",
    unitId: shooter.id,
    targetId: hiddenTarget.id,
  });
  expect(result.ok).toBe(true);
  const shots = planCombat(before, result.state);
  expect(shots).toHaveLength(2);
  expect(shots.filter((shot) => shot.projectile)).toHaveLength(1);
  expect(shots[0]).toMatchObject({
    targetId: victim.id,
    from: undefined,
    lethal: true,
    projectile: "shell",
  });
  expect(shots[1]).toMatchObject({
    from: undefined,
    splashWeapon: "shell",
    impact: shots[0].impact,
  });
});

it("retains the previous opponent's fire if React paints only the final AI snapshot", () => {
  const { before, command } = shoot("archer", true);
  const first = applyAction(before, command).state;
  rememberCombatEvents(
    first,
    first.events.filter((e) => e.combat),
    [],
    before,
  );
  const next = structuredClone(first);
  next.round++;
  next.events = [];
  rememberCombatEvents(next, [], [], first);
  expect(planCombat(before, next)).toHaveLength(2);
  expect(planCombat(first, next)).toHaveLength(0);
});

describe("visible AI journeys", () => {
  it("plays two rider moves on opposite sides of a kill instead of drawing a shortcut", () => {
    const before = battlefield(),
      rider = addUnit(before, 1, "rider", 6, 5);
    const victim = addUnit(before, 0, "warrior", 3, 5);
    victim.hp = 1;
    before.currentPlayer = 1;
    const move = { type: "MOVE" as const, unitId: rider.id, to: 5 * 12 + 4 };
    const attack = {
      type: "ATTACK" as const,
      unitId: rider.id,
      targetId: victim.id,
    };
    const escape = { ...move, to: 6 * 12 + 3 };
    const first = applyAction(before, move);
    const second = applyAction(first.state, attack);
    const third = applyAction(second.state, escape);
    expect([first.ok, second.ok, third.ok]).toEqual([true, true, true]);
    const legs = [
      ...observeMoves(before, first.state, move),
      ...observeMoves(first.state, second.state, attack),
      ...observeMoves(second.state, third.state, escape),
    ];
    rememberCombatEvents(
      third.state,
      third.state.events.filter((e) => e.combat),
      legs,
    );
    const { strikes, journeys } = planEncounter(before, third.state);
    const journey = journeys.get(rider.id)!;
    expect(journey).toHaveLength(3);
    expect(journey[0].start + journey[0].duration).toBeLessThanOrEqual(
      strikes[0].start,
    );
    expect(journey[1].start).toBeGreaterThan(strikes[0].impact);
    expect(journey[2].start).toBeGreaterThanOrEqual(
      journey[1].start + journey[1].duration,
    );
    expect(journey[2].path.at(-1)).toEqual({ x: 3, y: 6 });
  });
  it("does not interpolate a visible destination through an unknown route", () => {
    const before = battlefield(),
      rider = addUnit(before, 1, "rider", 5, 5);
    before.currentPlayer = 1;
    before.players[0].visible = [65, 67];
    const move = { type: "MOVE" as const, unitId: rider.id, to: 67 };
    const after = applyAction(before, move).state;
    const [path] = observeMoves(before, after, move);
    expect(path.path).toEqual([]);
    rememberCombatEvents(after, [], [path]);
    const plan = planEncounter(before, after);
    expect(plan.hiddenJourneys.has(rider.id)).toBe(true);
    expect(plan.journeys.size).toBe(0);
  });
});

it("preserves the remainder of a movement when an attack arrives in the next snapshot", () => {
  const before = battlefield();
  const archer = addUnit(before, 0, "archer", 5, 5);
  const defender = addUnit(before, 1, "warrior", 8, 5);
  const move = { type: "MOVE" as const, unitId: archer.id, to: 5 * 12 + 6 };
  const moved = applyAction(before, move);
  expect(moved.ok).toBe(true);
  rememberCombatEvents(moved.state, [], observeMoves(before, moved.state, move));
  const travel = planEncounter(before, moved.state);
  const attacked = applyAction(moved.state, { type: "ATTACK", unitId: archer.id, targetId: defender.id });
  expect(attacked.ok).toBe(true);
  const next = planEncounter(moved.state, attacked.state, { ...travel, issuedAt: 0 }, 60);
  const [leg] = next.journeys.get(archer.id)!;
  expect(leg.start).toBeCloseTo(-0.06);
  expect(leg.path.at(-1)).toEqual({ x: 6, y: 5 });
  expect(next.strikes[0].start).toBeGreaterThanOrEqual(leg.start + leg.duration);
});

describe("friendly move presentation", () => {
  it("schedules both sides of a swap together with opposing paths", () => {
    const before = battlefield();
    const a = addUnit(before, 0, "warrior", 4, 4);
    const b = addUnit(before, 0, "archer", 5, 4);
    const move = { type: "MOVE", unitId: a.id, to: 53 } as const;
    const result = applyAction(before, move);
    expect(result.ok).toBe(true);
    const moves = observeMoves(before, result.state, move);
    expect(moves).toMatchObject([
      { unitId: a.id, path: [52, 53], swapWith: b.id },
      { unitId: b.id, path: [53, 52], swapWith: a.id },
    ]);
    rememberCombatEvents(result.state, [], moves);
    const { journeys } = planEncounter(before, result.state);
    const [first] = journeys.get(a.id)!;
    const [second] = journeys.get(b.id)!;
    expect(first.swap && second.swap).toBe(true);
    expect(second.start).toBe(first.start);
    expect(second.duration).toBe(first.duration);
    expect(second.path).toEqual([...first.path].reverse());
  });

  it("draws an ordinary move without hinting at a concealed swap partner", () => {
    const before = battlefield();
    before.currentPlayer = 1;
    const a = addUnit(before, 1, "warrior", 4, 4);
    const b = addUnit(before, 1, "cloak", 5, 4);
    b.hidden = true;
    const move = { type: "MOVE", unitId: a.id, to: 53 } as const;
    const result = applyAction(before, move);
    expect(result.ok).toBe(true);
    result.state.players[0].visible = [52, 53];
    const moves = observeMoves(before, result.state, move);
    expect(moves.map(({ path, swapWith }) => [path, swapWith])).toEqual([[[52, 53], undefined], [[], undefined]]);
    rememberCombatEvents(result.state, [], moves);
    const plan = planEncounter(before, result.state);
    expect(plan.journeys.get(a.id)?.[0]?.swap).toBe(false);
    expect(plan.journeys.has(b.id)).toBe(false);
  });

  it("marks a friend on an intermediate square of the legal route", () => {
    const before = battlefield();
    const rider = addUnit(before, 0, "rider", 4, 4);
    addUnit(before, 0, "warrior", 5, 4);
    before.players[0].explored = [52, 53, 54];
    const move = { type: "MOVE", unitId: rider.id, to: 54 } as const;
    const result = applyAction(before, move);
    expect(result.ok).toBe(true);
    const [path] = observeMoves(before, result.state, move);
    expect(path).toMatchObject({ path: [52, 53, 54], passing: [1] });
  });
});
