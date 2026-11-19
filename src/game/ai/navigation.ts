import { UNITS } from "../data/config";
import { distance, isWater, neighbors } from "../map/generate";
import { movementCost } from "../rules/engine";
import type { City, GameState, Tile, Unit } from "../types";
import { frontierTiles, observableMarketIncome, type Knowledge, type ThreatMap } from "./knowledge";
import { AI_PROFILES } from "./profiles";

/** A binary heap keeps map-wide navigation O(V log V), including 64² boards. */
class MinHeap {
  entries: [number, number][] = [];
  push(id: number, cost: number) {
    const a = this.entries; a.push([id, cost]); let i = a.length - 1;
    while (i) { const p = (i - 1) >> 1; if (a[p][1] <= cost) break; a[i] = a[p]; i = p; }
    a[i] = [id, cost];
  }
  pop(): [number, number] | undefined {
    const a = this.entries, top = a[0], last = a.pop();
    if (!a.length || !last) return top;
    let i = 0;
    while (i * 2 + 1 < a.length) {
      let child = i * 2 + 1;
      if (child + 1 < a.length && a[child + 1][1] < a[child][1]) child++;
      if (a[child][1] >= last[1]) break;
      a[i] = a[child]; i = child;
    }
    a[i] = last; return top;
  }
}

export function defensiveOrders(s: GameState, k: Knowledge, threats: ThreatMap): Map<string, City> {
  const orders = new Map<string, City>();
  if (s.options.difficulty === "easy") return orders;
  const endangered = k.ownCities.filter((c) => threats.cityPressure.has(c.id))
    .sort((a, b) => (threats.cityPressure.get(b.id)! + (b.capitalOf === k.player ? 5 : 0)) -
      (threats.cityPressure.get(a.id)! + (a.capitalOf === k.player ? 5 : 0)));
  for (const city of endangered) {
    const candidates = k.own.filter((u) => !u.upkeep && !orders.has(u.id) && !UNITS[u.type].skills.includes("water") &&
      UNITS[u.type].defense >= 1 && !UNITS[u.type].skills.includes("infiltrate") &&
      // A unit already besieging an enemy settlement must keep its capture.
      !k.cities.some((c) => c.owner !== k.player && distance(c, u) === 0) && distance(u, city) <= 7)
      .sort((a, b) =>
        (distance(a, city) * 4 - UNITS[a.type].defense - a.hp / 10) -
        (distance(b, city) * 4 - UNITS[b.type].defense - b.hp / 10));
    const count = (threats.cityPressure.get(city.id) ?? 0) >= 10 ? 2 : 1;
    for (const u of candidates.slice(0, count)) orders.set(u.id, city);
  }
  return orders;
}

/** Navigation includes a future embark/disembark leg. Ground soldiers can
 * therefore deliberately reach a port when their objective is overseas. */
function routeCost(s: GameState, k: Knowledge, u: Unit, from: Tile, to: Tile): number {
  const tech = s.players[k.player].technologies;
  const naval = UNITS[u.type].skills.includes("water");
  const afloatFrom = isWater(from) && from.building !== "bridge";
  const afloatTo = isWater(to) && to.building !== "bridge";
  if (!naval && (afloatFrom || afloatTo) && !tech.includes("fishing")) return Infinity;
  if (afloatTo && to.terrain === "deep" && !tech.includes("sailing")) return Infinity;
  if (!afloatFrom && afloatTo) {
    if (to.building !== "port" || (to.owner !== k.player &&
      !s.players[k.player].peaceWith.includes(to.owner ?? -1))) return Infinity;
    return 1;
  }
  if (afloatFrom && afloatTo) return 1 / (naval ? UNITS[u.type].movement : 2);
  if (afloatFrom && !afloatTo) {
    if (naval && !u.carried) return Infinity;
    if (to.terrain === "mountain" && !tech.includes("climbing")) return Infinity;
    return 1;
  }
  const ground = naval ? { ...u, type: u.carried?.type ?? "warrior" as const } : u;
  return movementCost(k.view, ground, from, to) / UNITS[ground.type].movement;
}

/** Income after capture, limited to properties currently visible to the AI.
 * A surveyed town outside vision still represents at least one star per turn. */
export function captureIncome(s: GameState, k: Knowledge, city: City): number {
  const id = city.y * s.options.size + city.x;
  if (city.owner === null || !k.visible.has(id)) return 1;
  let income = city.level + city.incomeBonus + Math.min(0, city.population);
  for (const id of city.territory) {
    if (!k.visible.has(id)) continue;
    const tile = s.tiles[id];
    if (tile.building !== "market" || tile.owner !== city.owner) continue;
    income += observableMarketIncome(s, k, tile);
  }
  return Math.max(1, income);
}

export function navigationField(s: GameState, k: Knowledge, u: Unit, guard?: City): Map<number, number> {
  const values = new Map<number, number>(), heap = new MinHeap();
  const goal = (id: number, cost: number) => {
    if (cost >= (values.get(id) ?? Infinity)) return;
    values.set(id, cost); heap.push(id, cost);
  };
  if (guard) goal(guard.y * s.options.size + guard.x, 0);
  else {
    for (const c of k.cities) {
      if (c.owner === k.player || (c.owner !== null && s.players[k.player].peaceWith.includes(c.owner))) continue;
      if (UNITS[u.type].skills.includes("infiltrate") && c.owner !== null) {
        for (const tile of neighbors(s.tiles, s.options.size, c))
          if (k.known.has(tile.id)) goal(tile.id, 1);
      } else {
        const id = c.y * s.options.size + c.x;
        const rival = c.owner !== null;
        let cost = rival ? 2 : 0;
        if (s.options.difficulty === "normal") {
          const planningTurns = AI_PROFILES.normal.economicHorizon;
          const horizon = s.options.mode === "score" ? Math.min(planningTurns, Math.max(1, s.options.maxRounds - s.round)) : planningTurns;
          const incomeValue = Math.min(5, captureIncome(s, k, c) - 1) * horizon / planningTurns;
          const occupant = k.occupants.get(id);
          // Estimate the resistance from the current garrison, and avoid
          // directing a whole army to the town a friendly unit is securing.
          const contest = occupant?.owner === k.player ? 3 : occupant ? Math.min(3, UNITS[occupant.type].defense) : 0;
          cost += contest - incomeValue;
        }
        goal(id, cost);
      }
    }
    // Keeping frontier goals even after seeing an unreachable city prevents
    // an isolated island or mountain barrier from stopping exploration.
    for (const id of frontierTiles(s, k)) goal(id, 7);
    for (const id of k.known) if (s.tiles[id].ruin) goal(id, 3);
  }
  while (heap.entries.length) {
    const [id, cost] = heap.pop()!;
    if (cost !== values.get(id)) continue;
    const target = s.tiles[id];
    for (const from of neighbors(s.tiles, s.options.size, target)) {
      if (!k.known.has(from.id)) continue;
      const next = cost + routeCost(s, k, u, from, target);
      if (!Number.isFinite(next) || next >= (values.get(from.id) ?? Infinity)) continue;
      values.set(from.id, next); heap.push(from.id, next);
    }
  }
  return values;
}
