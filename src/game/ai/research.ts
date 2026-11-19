import { BUILDINGS, TECHNOLOGIES, UNITS } from "../data/config";
import { neighbors } from "../map/generate";
import {
  getCityCapacity, getCityUnitCount, getEmbassyCost, getTechCost, getTrainingCost,
  getUnitTrainingRounds, getUnitUpkeep, getVisibleResource,
} from "../rules/engine";
import type { City, GameState, Tile } from "../types";
import { observableMarketIncome, type Knowledge, type ThreatMap } from "./knowledge";

interface Project {
  tech: string;
  cost: number;
  population: number;
}

interface Site {
  city: City;
  projects: Project[];
}

interface ResearchBudget {
  available: number;
  netIncome: number;
  horizon: number;
  coastal: boolean;
  armyShortage: boolean;
}

const harvestTech = { fruit: "organization", animal: "hunting", fish: "fishing" } as const;
const processors = { sawmill: "lumberHut", windmill: "farm", forge: "mine" } as const;
const economicBuildings = ["farm", "mine", "lumberHut", "sawmill", "windmill", "forge"] as const;
const branches = new Map(TECHNOLOGIES.map((t) => [t.id, [
  ...t.prerequisites, ...TECHNOLOGIES.filter((other) => other.prerequisites.includes(t.id)).map((other) => other.id),
]]));

function growthSites(s: GameState, k: Knowledge, cityByTile: ReadonlyMap<number, City>, plots: readonly Tile[]): Site[] {
  const projects = new Map(k.ownCities.map((city) => [city.id, { city, projects: [] as Project[] }]));
  const unique = new Map<string, Project>();
  for (const plot of plots) {
    const city = cityByTile.get(plot.id);
    if (!city || (k.occupants.get(plot.id)?.owner ?? k.player) !== k.player) continue;
    const site = projects.get(city.id)!;
    const resource = getVisibleResource(s, plot, k.player);
    const harvest = resource && resource in harvestTech ? harvestTech[resource as keyof typeof harvestTech] : null;
    if (harvest) site.projects.push({ tech: harvest, cost: 2, population: 1 });
    const adjacent = neighbors(s.tiles, s.options.size, plot)
      .filter((t) => k.visible.has(t.id) && t.owner === k.player);
    for (const id of economicBuildings) {
      const b = BUILDINGS[id];
      if (!b.terrain.includes(plot.terrain) || (b.resource && b.resource !== resource)) continue;
      if (b.unique && city.territory.some((tileId) => s.tiles[tileId].building === id)) continue;
      // Do not count both harvesting an animal and replacing it with timber.
      if (id === "lumberHut" && harvest) continue;
      const producer = id in processors ? processors[id as keyof typeof processors] : null;
      const population = producer ? adjacent.filter((t) => t.building === producer).length * (id === "forge" ? 2 : 1) : b.population;
      if (!population) continue;
      const project = { tech: b.tech!, cost: b.cost, population };
      const key = `${city.id}:${id}`;
      if (!b.unique) site.projects.push(project);
      else if (population > (unique.get(key)?.population ?? 0)) unique.set(key, project);
    }
  }
  for (const [key, project] of unique) projects.get(key.slice(0, key.lastIndexOf(":")))!.projects.push(project);
  return [...projects.values()].filter((site) => site.projects.length);
}

/** Minimum cost to finish the next upgrade. Land improvements affect at most
 * one local city by this estimate. Cap the forecast to a practical build budget. */
function nextUpgrade(site: Site, techs: ReadonlySet<string>, spendingLimit: number) {
  const required = site.city.level + 1 - site.city.population;
  const applicable = site.projects.filter((project) => techs.has(project.tech));
  const population = applicable.reduce((sum, project) => sum + project.population, 0);
  if (required <= 0 || population < required || required > spendingLimit * 2) return { cost: Infinity, progress: population };
  const costs = new Float64Array(required + 1).fill(Infinity);
  costs[0] = 0;
  for (const project of applicable) {
    for (let pop = required - 1; pop >= 0; pop--) {
      const cost = costs[pop] + project.cost, after = Math.min(required, pop + project.population);
      if (cost < costs[after] && cost <= spendingLimit) costs[after] = cost;
    }
  }
  return { cost: costs[required], progress: population };
}

/** Find the cheapest technology path the rules can actually open. A known
 * child can unlock an unlearned parent, including technologies gained in ruins. */
function researchPaths(known: ReadonlySet<string>, costs: ReadonlyMap<string, number>) {
  const paths = new Map<string, { steps: string[]; cost: number }>();
  const frontier = TECHNOLOGIES.filter((t) =>
    !known.has(t.id) && (t.tier === 1 || branches.get(t.id)!.some((neighbor) => known.has(neighbor))))
    .map((t) => ({ steps: [t.id], cost: costs.get(t.id)! }));
  while (frontier.length) {
    frontier.sort((a, b) => b.cost - a.cost);
    const path = frontier.pop()!, technology = path.steps.at(-1)!;
    if (paths.has(technology)) continue;
    paths.set(technology, path);
    for (const next of branches.get(technology)!)
      if (!known.has(next) && !paths.has(next))
        frontier.push({ steps: [...path.steps, next], cost: path.cost + costs.get(next)! });
  }
  return paths;
}

export function estimateResearch(
  s: GameState, k: Knowledge, threats: ThreatMap, cityByTile: ReadonlyMap<number, City>,
  plots: readonly Tile[], budget: ResearchBudget, baseValues: Readonly<Record<string, number>>,
) {
  const scores = new Map<string, number>();
  const p = s.players[k.player], known = new Set(p.technologies);
  const costs = new Map(TECHNOLOGIES.map((tech) => [tech.id, getTechCost(s, p.id, tech.id)]));
  const paths = researchPaths(known, costs);
  if (!paths.size) return scores;
  const canRecruit = k.ownCities.some((city) => !city.training &&
    (k.occupants.get(city.y * s.options.size + city.x)?.owner ?? p.id) === p.id &&
    getCityUnitCount(k.view, city) < getCityCapacity(city));
  const needDefense = [...threats.cityPressure.values()].some((value) => value > 3);
  const nearScoreEnd = s.options.mode === "score" && s.options.maxRounds - s.round < 3;
  const unitsByType = new Map<string, number>();
  for (const unit of k.own) if (!unit.upkeep)
    unitsByType.set(unit.type, (unitsByType.get(unit.type) ?? 0) + 1);
  const net = Math.max(0, budget.netIncome);
  const spendingLimit = Math.min(64, budget.available + net * budget.horizon);
  const sites = growthSites(s, k, cityByTile, plots);
  const baseline = sites.map((site) => nextUpgrade(site, known, spendingLimit));
  const turnsToFund = (cost: number) => cost <= budget.available ? 0
    : net > 0 ? Math.ceil((cost - budget.available) / net) : Infinity;

  for (const [target, path] of paths) {
    const [first] = path.steps;
    if (nearScoreEnd) {
      if (path.steps.length === 1)
        scores.set(first, TECHNOLOGIES.find((tech) => tech.id === first)!.tier * 8);
      continue;
    }
    const researchDelay = turnsToFund(path.cost);
    if (researchDelay >= budget.horizon) continue;
    const techs = new Set([...known, ...path.steps]);
    const returns: number[] = [];
    sites.forEach((site, index) => {
      if (!site.projects.some((project) => !known.has(project.tech) && techs.has(project.tech))) return;
      const next = nextUpgrade(site, techs, spendingLimit);
      const previous = baseline[index];
      const funding = turnsToFund(path.cost + next.cost);
      if (Number.isFinite(next.cost) && next.cost < previous.cost && funding + 1 < budget.horizon) {
        // Level 2 usually grants an extra star for the Workshop. Discount it
        // when the city is threatened and estimate later levels at 1 star.
        const incomeGain = site.city.level === 1 && !threats.cityPressure.has(site.city.id) ? 2 : 1;
        const income = incomeGain * (budget.horizon - funding - 1);
        const incremental = Number.isFinite(previous.cost) ? previous.cost - next.cost : income - next.cost;
        returns.push(incremental);
      } else if (!Number.isFinite(previous.cost) && !Number.isFinite(next.cost)) {
        const progress = next.progress - previous.progress;
        if (progress > 0) returns.push(Math.min(3, progress));
      }
    });
    returns.sort((a, b) => b - a);
    // Improvements compete for the same stars. Count at most one full
    // project and discount a second one within this short timeframe.
    let returnStars = Math.max(0, returns[0] ?? 0) + Math.max(0, returns[1] ?? 0) * 0.45;
    if (target === "trade" && !known.has("trade")) {
      for (const plot of plots) {
        const city = cityByTile.get(plot.id);
        if (plot.terrain !== "plain" || !city || city.territory.some((id) => s.tiles[id].building === "market")) continue;
        const income = observableMarketIncome(s, k, plot);
        const cost = BUILDINGS.market.cost;
        const beforePayoff = turnsToFund(path.cost + cost) + 1;
        if (income && beforePayoff < budget.horizon)
          returnStars = Math.max(returnStars, income * (budget.horizon - beforePayoff) - cost);
      }
    }
    if (target === "diplomacy" && p.metPlayers.some((other) => !p.embassies.includes(other) && !s.players[other].eliminated)) {
      const cost = getEmbassyCost(s, p.id);
      const income = p.peaceWith.length ? 4 : 2;
      const beforePayoff = turnsToFund(path.cost + cost) + 1;
      if (beforePayoff < budget.horizon) returnStars = Math.max(returnStars, income * (budget.horizon - beforePayoff) - cost);
    }
    if (target === "philosophy") {
      const subsequentPurchases = Math.min(4, Math.max(0, TECHNOLOGIES.length - techs.size));
      const savings = Math.floor((2 * k.ownCities.length + 4) / 3);
      const futureFunds = budget.available + net * budget.horizon - path.cost;
      returnStars = Math.max(returnStars, Math.min(subsequentPurchases, Math.floor(futureFunds / (2 * savings + 1))) * savings);
    }
    let unitValue = 0;
    for (const def of Object.values(UNITS)) {
      if (!def.tech || !path.steps.includes(def.tech) || def.id === "raft" || def.id === "dinghy") continue;
      const navy = def.skills.includes("water");
      if ((navy && (!budget.coastal || !k.own.some((u) => u.type === "raft" && !u.navalTraining))) ||
        (!navy && (!canRecruit || !def.trainable))) continue;
      if (s.options.quickMode === false && getUnitUpkeep(s, { type: def.id }) > net) continue;
      const beforeReady = turnsToFund(path.cost + getTrainingCost(s, p.id, def.id)) + getUnitTrainingRounds(s, def.id);
      if (beforeReady >= budget.horizon) continue;
      const role = baseValues[def.tech] ?? 15;
      const duplicate = unitsByType.get(def.id) ?? 0;
      const demand = budget.armyShortage || needDefense ? 10 : 0;
      unitValue = Math.max(unitValue, (role + 10 + demand) / (1 + duplicate * 0.55) - beforeReady * 4);
    }
    const payoff = Math.min(22, returnStars) - path.cost;
    const incomeValue = returnStars > 0 ? 28 + payoff * 3.2 : 0;
    let utility = (baseValues[target] ?? 5) * 0.62;
    if (target === "sailing" && k.own.some((u) => u.type === "raft")) utility += 20;
    if ((target === "organization" || target === "climbing") && plots.some((plot) =>
      plot.terrain === (target === "organization" ? "plain" : "mountain")))
      utility += 5; // Prospect based on terrain, never check hidden crops or ore.
    let score = Math.max(utility, incomeValue, unitValue) - costs.get(first)! * 0.45 -
      (path.steps.length - 1) * 5 - researchDelay * 2;
    if (needDefense && turnsToFund(path.cost + 3) > 0) score -= 20;
    if (k.own.length < 2) score -= 12;
    scores.set(first, Math.max(scores.get(first) ?? 0, score));
  }
  return scores;
}
