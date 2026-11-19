import { describe, expect, it } from "vitest";
import {
  createMotionPath,
  isVisibleTransition,
  movementDuration,
  sampleMotionPath,
  sampleMovement,
  turnTowards,
} from "../../src/scene/motion";
import type { MotionVector } from "../../src/scene/motion";
import type { Strike } from "../../src/scene/combatMotion";
import { planUnitTurns, unitFacingAt, unitFacingYaw } from "../../src/scene/unitFacing";

describe("unit presentation timing", () => {
  it("holds the starting square before a delayed melee advance", () => {
    const out: MotionVector = [0, 0, 0];
    sampleMovement([2, 0.1, 2], [3, 0.1, 2], -0.12, 0.3, out);
    expect(out).toEqual([2, 0.1, 2]);
  });
  it("has the same pose at a fixed elapsed time regardless of frame cadence", () => {
    const from: MotionVector = [1, 0, 1],
      to: MotionVector = [3, 0.2, 1];
    const direct: MotionVector = [0, 0, 0],
      stepped: MotionVector = [0, 0, 0];
    sampleMovement(from, to, 0.2, 0.4, direct);
    for (let frame = 1; frame <= 12; frame++)
      sampleMovement(from, to, frame / 60, 0.4, stepped);
    expect(stepped).toEqual(direct);
    expect(direct).toEqual([2, 0.1, 1]);
  });
  it("finishes on the precise target without asymptotic drift", () => {
    const out: MotionVector = [0, 0, 0];
    sampleMovement([0, 0, 0], [2, 0.17, 3], 3, 0.4, out);
    expect(out).toEqual([2, 0.17, 3]);
  });
  it("keeps one-square moves legible and long moves bounded", () => {
    expect(movementDuration(1)).toBeGreaterThanOrEqual(0.28);
    expect(movementDuration(6)).toBeLessThanOrEqual(0.55);
  });
  it("turns across the short arc at the angle wrap", () => {
    const result = turnTowards(Math.PI - 0.1, -Math.PI + 0.1, 0.5);
    expect(result).toBeCloseTo(Math.PI);
  });
});

describe("two-sided unit silhouettes", () => {
  const start = { x: 4, y: 4 };

  it("chooses one 45-degree view for the whole leg, including when the route detours left", () => {
    const goal = { x: 5, y: 4 };
    const turns = planUnitTurns({
      journey: [{
        from: start, path: [start, { x: 3, y: 4 }, goal], start: 0.2, duration: 0.5,
      }],
    }, goal, 0);
    expect(unitFacingYaw[unitFacingAt(turns, 0, "left")]).toBe(Math.PI);
    expect(unitFacingYaw[unitFacingAt(turns, 0.25, "left")]).toBe(-Math.PI / 2);
    expect(unitFacingAt(turns, 1, "left")).toBe("right");
    expect(planUnitTurns({ from: goal }, start, 0)).toEqual([{ at: 0, facing: "left" }]);
  });

  it("keeps the stance when the destination is aligned vertically on screen", () => {
    const turns = planUnitTurns({ from: start }, { x: 5, y: 5 }, 0);
    expect(unitFacingAt(turns, Infinity, "left")).toBe("left");
  });

  it("faces the opponent on attack and at impact, and maintains the pose for a hidden origin", () => {
    const hit: Strike = {
      id: 1, from: { x: 2, y: 4 }, at: start, targetId: "defender", projectile: "arrow",
      splash: false, lethal: false, damage: 3, start: 0.1, launch: 0.3, impact: 0.6,
    };
    expect(planUnitTurns({ attacks: [hit] }, hit.from!, 0)).toEqual([{ at: 0.1, facing: "right" }]);
    const turns = planUnitTurns({ impacts: [hit] }, start, 0);
    expect(unitFacingAt(turns, 0.5, "right")).toBe("right");
    expect(unitFacingAt(turns, 0.6, "right")).toBe("left");
    expect(planUnitTurns({ impacts: [{ ...hit, from: undefined }] }, start, 0)).toEqual([]);
  });
});

describe("legal route presentation", () => {
  it("follows the route around an obstacle instead of cutting its corner", () => {
    const path = createMotionPath([
      [0, 0, 0],
      [0, 0, 2],
      [2, 0, 2],
    ]);
    const out: MotionVector = [0, 0, 0];
    for (let frame = 0; frame <= 30; frame++) {
      sampleMotionPath(path, frame / 60, 0.5, out);
      expect(out[0] === 0 || out[2] === 2).toBe(true);
    }
    expect(out).toEqual([2, 0, 2]);
  });
  it("samples a terrain height only along the selected segment", () => {
    const path = createMotionPath([
      [0, 0, 0],
      [1, 0.5, 0],
      [2, 0, 0],
    ]);
    const out: MotionVector = [0, 0, 0];
    sampleMotionPath(path, 0.25, 0.5, out);
    expect(out).toEqual([1, 0.5, 0]);
  });
  it("handles repeated endpoints without division by zero", () => {
    const path = createMotionPath([
      [1, 0.2, 1],
      [1, 0.2, 1],
    ]);
    const out: MotionVector = [0, 0, 0];
    sampleMotionPath(path, 2, 0, out);
    expect(out).toEqual([1, 0.2, 1]);
  });
});

describe("fog-safe transitions", () => {
  const from = { x: 0, y: 0 },
    to = { x: 2, y: 0 };
  it("allows a path visible in both rule snapshots", () => {
    expect(
      isVisibleTransition(from, to, new Set([0, 1, 2]), new Set([0, 1, 2]), 8),
    ).toBe(true);
  });
  it("rejects a hidden intermediate square even when endpoints are visible", () => {
    expect(
      isVisibleTransition(from, to, new Set([0, 2]), new Set([0, 1, 2]), 8),
    ).toBe(false);
  });
  it("does not reveal a path that became hidden after the move", () => {
    expect(
      isVisibleTransition(from, to, new Set([0, 1, 2]), new Set([1, 2]), 8),
    ).toBe(false);
  });
  it("checks diagonal paths with the same privacy requirement", () => {
    expect(
      isVisibleTransition(
        from,
        { x: 2, y: 2 },
        new Set([0, 9, 18]),
        new Set([0, 18]),
        8,
      ),
    ).toBe(false);
  });
});

describe("friendly piece clearance", () => {
  it("swaps along opposite arcs while keeping the original endpoints", () => {
    const from: MotionVector = [2, 0.2, 3], to: MotionVector = [3, 0.3, 4];
    const a = createMotionPath([from, to]), b = createMotionPath([to, from]);
    const first: MotionVector = [0, 0, 0], second: MotionVector = [0, 0, 0];
    sampleMotionPath(a, 0.19, 0.38, first, true);
    sampleMotionPath(b, 0.19, 0.38, second, true);
    expect(Math.hypot(first[0] - second[0], first[2] - second[2])).toBeCloseTo(0.72);
    sampleMotionPath(a, 0.38, 0.38, first, true);
    sampleMotionPath(b, 0.38, 0.38, second, true);
    expect(first).toEqual(to);
    expect(second).toEqual(from);
  });

  it("sidesteps a stationary friend and returns to the exact destination", () => {
    const target: MotionVector = [4, 0.2, 3];
    const path = createMotionPath([[2, 0.2, 3], [3, 0.2, 3], target], [1]);
    const out: MotionVector = [0, 0, 0];
    sampleMotionPath(path, 0.16, 0.32, out);
    expect(out[2]).toBeCloseTo(3.46);
    sampleMotionPath(path, 0.32, 0.32, out);
    expect(out).toEqual(target);
  });
});
