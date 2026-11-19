import { describe, expect, it } from 'vitest';
import { applyAction, distance, getAiBudget, getArmyTarget, getIncome, getReachableTiles, isWater, runAiTurnDetailed, TECHNOLOGIES, UNITS } from '../../src/game';
import { observe, buildThreatMap, incomingDamage } from '../../src/game/ai/knowledge';
import { captureIncome } from '../../src/game/ai/navigation';
import type { GameState, Unit, UnitType } from '../../src/game/types';
import { addUnit, battlefield, newGame } from './helpers';

function tactical(difficulty: 'easy' | 'normal' = 'normal'): GameState {
  const game = battlefield(); game.options.difficulty = difficulty;
  for (const player of game.players) {
    player.resources = 0; player.technologies = ['climbing', 'riding', 'archery', 'strategy'];
    player.unlockedMonuments = [];
  }
  return game;
}
function replay(initial: GameState, result: ReturnType<typeof runAiTurnDetailed>): void {
  let state = initial;
  for (const action of result.actions) {
    const applied = applyAction(state, action);
    expect(applied.error, JSON.stringify(action)).toBeUndefined();
    expect(applied.ok, JSON.stringify(action)).toBe(true); state = applied.state;
  }
  expect(state).toEqual(result.state);
}
function putUnit(state: GameState, owner: number, type: UnitType, x: number, y: number): Unit {
  const definition = UNITS[type], home = state.cities.find(city => city.owner === owner)!;
  const unit: Unit = { id: `unit-${state.nextId++}`, owner, type, x, y,
    hp: definition.hp, maxHp: definition.hp, kills: 0, veteran: false, moved: false, attacked: false,
    homeCityId: home.id, capturedTurn: null, escapeUsed: false, hidden: false, hiddenAtTurnStart: false };
  state.units.push(unit); return unit;
}
function armyFixture(count: number): GameState {
  const state = newGame({ size: 64, aiCount: 1, mapType: 'dryland' });
  state.round = 20; state.units = [];
  for (const tile of state.tiles) { tile.terrain = 'plain'; tile.resource = null; tile.ruin = false; tile.lighthouse = false; }
  for (const city of state.cities) {
    if (city.owner === null) { city.owner = 0; city.territory = [city.y * 64 + city.x]; state.tiles[city.territory[0]].owner = 0; }
    city.level = 80;
  }
  for (const player of state.players) {
    player.resources = 0; player.technologies = ['climbing'];
    player.visible = state.tiles.map(tile => tile.id); player.explored = [...player.visible];
    player.metPlayers = state.players.filter(other => other.id !== player.id).map(other => other.id);
    player.stats.explored = player.explored.length;
  }
  for (let y = 2; y < 62 && state.units.length < count; y += 3) for (let x = 2; x < 62 && state.units.length < count; x += 3) {
    if (!state.tiles[y * 64 + x].cityId) putUnit(state, 0, 'warrior', x, y);
  }
  return state;
}

describe('visible tactical decisions distinguish AI difficulty', () => {
  it('normal keeps a threatened capital garrison while easy follows its offensive goal', () => {
    const normal = tactical(), capital = normal.cities[0];
    const guard = addUnit(normal, 0, 'defender', capital.x, capital.y);
    addUnit(normal, 1, 'warrior', capital.x + 2, capital.y);
    const easy = structuredClone(normal); easy.options.difficulty = 'easy';
    const cautious = runAiTurnDetailed(normal), simple = runAiTurnDetailed(easy);
    expect(cautious.state.units.find(unit => unit.id === guard.id)).toMatchObject({ x: capital.x, y: capital.y });
    expect(simple.actions).not.toEqual(cautious.actions);
    expect(simple.actions.some(action => action.type === 'MOVE' && action.unitId === guard.id)).toBe(true);
    expect(simple.diagnostics.simulations).toBe(0);
    replay(normal, cautious); replay(easy, simple);
  });
  it('normal brings a nearby defender closer to an exposed city', () => {
    const state = tactical(), capital = state.cities[0];
    const defender = addUnit(state, 0, 'defender', capital.x + 1, capital.y + 2);
    addUnit(state, 1, 'rider', capital.x + 3, capital.y);
    const result = runAiTurnDetailed(state), moved = result.state.units.find(unit => unit.id === defender.id)!;
    expect(distance(moved, capital)).toBeLessThan(distance(defender, capital));
    replay(state, result);
  });
  it('uses escape to get a rider outside a visible stationary catapult threat after a kill', () => {
    const state = tactical(), rider = addUnit(state, 0, 'rider', 4,4), victim = addUnit(state, 1, 'warrior', 5,4), catapult = addUnit(state, 1, 'catapult', 7,4);
    victim.hp = 1;
    const result = runAiTurnDetailed(state), survivor = result.state.units.find(unit => unit.id === rider.id)!;
    expect(result.state.units.some(unit => unit.id === victim.id)).toBe(false);
    expect(survivor).toBeDefined(); expect(distance(survivor, catapult)).toBeGreaterThan(UNITS.catapult.range);
    expect(result.diagnostics.simulations).toBeGreaterThan(0); replay(state, result);
  });
  it('coordinates two archers to eliminate an exposed dangerous target', () => {
    const state = tactical(); addUnit(state, 0, 'archer', 4,4); addUnit(state, 0, 'archer', 4,5);
    const catapult = addUnit(state, 1, 'catapult', 6,4); addUnit(state, 1, 'defender', 5,5);
    const result = runAiTurnDetailed(state);
    expect(result.state.units.some(unit => unit.id === catapult.id)).toBe(false);
    expect(result.actions.filter(action => action.type === 'ATTACK' && action.targetId === catapult.id)).toHaveLength(2);
    replay(state, result);
  });
  it('does not change decisions because of hidden enemy cloaks outside the action area', () => {
    const visible = tactical(); addUnit(visible, 0, 'warrior', 4,4); addUnit(visible, 1, 'warrior', 9,9);
    const hidden = structuredClone(visible);
    for (const x of [7,8,9,10]) addUnit(hidden, 1, 'cloak', x,1).hidden = true;
    const first = runAiTurnDetailed(visible), second = runAiTurnDetailed(hidden);
    expect(second.actions).toEqual(first.actions); replay(hidden, second);
  });
});

describe('bounded complete turns, legal replay and scaling', () => {
  it('is deterministic and does not mutate caller state', () => {
    const initial = newGame({ aiCount: 2 }), snapshot = structuredClone(initial);
    const first = runAiTurnDetailed(initial), second = runAiTurnDetailed(initial);
    expect(initial).toEqual(snapshot); expect(second.actions).toEqual(first.actions); expect(second.state).toEqual(first.state);
    replay(initial, first);
  });
  it('honors an explicit action budget and still returns a completed turn', () => {
    const state = armyFixture(8), result = runAiTurnDetailed(state, 3);
    expect(result.diagnostics.actionCount).toBeLessThanOrEqual(3);
    expect(result.diagnostics.truncated).toBe(true);
    expect(result.state.currentPlayer).toBe(1); expect(result.actions.at(-1)?.type).toBe('END_TURN'); replay(state, result);
  });
  it('allows armies above 24 and completes seventy-two ready units with the default budget', () => {
    const state = armyFixture(72), unitIds = new Set(state.units.map(unit => unit.id));
    expect(getArmyTarget(state)).toBeGreaterThan(24); expect(getAiBudget(state)).toBeGreaterThan(64);
    expect(state.units.every(unit => getReachableTiles(state, unit.id).length > 0)).toBe(true);
    const result = runAiTurnDetailed(state);
    expect(result.diagnostics.unitCount).toBe(72); expect(result.diagnostics.truncated).toBe(false);
    const acted = new Set(result.actions.filter(action => 'unitId' in action && unitIds.has(action.unitId)).map(action => 'unitId' in action ? action.unitId : ''));
    expect(acted.size).toBe(72); replay(state, result);
  }, 30000);
  it('advances all eleven factions on a 64-square opening with replayable commands', () => {
    let state = newGame({ size: 64, aiCount: 10 });
    for (let index = 0; index < 11; index++) {
      const result = runAiTurnDetailed(state); replay(state, result); expect(result.diagnostics.truncated).toBe(false); state = result.state;
    }
    expect(state.round).toBe(2); expect(state.currentPlayer).toBe(0);
  }, 30000);
  it('handles a constructed 64-square eleven-faction midgame with twelve units per faction', () => {
    let state = newGame({ size: 64, aiCount: 10, mapType: 'dryland' }); state.round = 20; state.units = [];
    const occupied = new Set<number>();
    for (const player of state.players) {
      player.resources = 25; player.technologies = TECHNOLOGIES.map(technology => technology.id);
      player.explored = state.tiles.map(tile => tile.id); player.visible = [...player.explored]; player.stats.explored = player.explored.length;
      player.metPlayers = state.players.filter(other => other.id !== player.id).map(other => other.id);
      const capital = state.cities.find(city => city.capitalOf === player.id)!; capital.level = 20;
      const tiles = state.tiles.filter(tile => !occupied.has(tile.id) && !isWater(tile) && tile.terrain !== 'mountain').sort((a,b) => distance(a, capital) - distance(b, capital) || a.id - b.id);
      for (const tile of tiles.slice(0,12)) { occupied.add(tile.id); putUnit(state, player.id, 'warrior', tile.x, tile.y); }
    }
    expect(state.units).toHaveLength(132);
    for (let index = 0; index < 11; index++) {
      const result = runAiTurnDetailed(state); replay(state, result); state = result.state;
      expect(state.players.every(player => player.resources >= 0)).toBe(true);
      expect(new Set(state.units.map(unit => unit.y * 64 + unit.x)).size).toBe(state.units.length);
    }
    expect(state.round).toBe(21);
  }, 60000);
  it.each([true, false])('finishes a seeded conquest with quick mode %s', (quickMode) => {
    let state = newGame({ seed: 'autumn-2026', mapType: 'dryland', aiCount: 1, quickMode }); let turns = 0;
    while (state.status === 'playing' && turns < 300) { const result = runAiTurnDetailed(state); replay(state, result); state = result.state; turns++; }
    expect(state.status).toBe('finished'); expect(state.winner).not.toBeNull(); expect(state.players.some(player => player.eliminated)).toBe(true);
  }, 30000);
});

describe('economic foresight', () => {
  it('crosses toward a known higher-income city over equally reachable low-income land', () => {
    const state = tactical(), rival = state.cities[1];
    state.options.quickMode = true;
    const richer = { ...rival, id: 'industrial-town', x: 6, y: 6, level: 6, capitalOf: null, territory: [78] };
    const poorer = { ...richer, id: 'frontier-village', x: 4, owner: null, level: 1, territory: [76] };
    state.cities.push(richer, poorer);
    for (const city of [richer, poorer]) {
      const tile = state.tiles[city.territory[0]];
      tile.cityId = city.id;
      tile.owner = city.owner;
    }
    const rider = addUnit(state, 0, 'rider', 5, 5);
    const easy = structuredClone(state);
    easy.options.difficulty = 'easy';
    const normal = runAiTurnDetailed(state), simple = runAiTurnDetailed(easy);
    expect(normal.actions).toContainEqual({ type: 'MOVE', unitId: rider.id, to: 78 });
    expect(simple.actions).toContainEqual({ type: 'MOVE', unitId: rider.id, to: 76 });
    const next = applyAction(normal.state, { type: 'END_TURN' }).state;
    const captured = runAiTurnDetailed(next);
    expect(captured.actions).toContainEqual({ type: 'CAPTURE', unitId: rider.id });
    expect(getIncome(captured.state, 0)).toBeGreaterThanOrEqual(getIncome(state, 0) + 6);
    replay(state, normal); replay(easy, simple); replay(next, captured);
  });

  it('estimates occupied-city income from observable production only', () => {
    const state = tactical(), rival = state.cities[1];
    const plot = (x: number, y: number) => state.tiles[y * state.options.size + x];
    const market = plot(10, 9), producer = plot(10, 8), source = plot(10, 7);
    for (const tile of [market, producer, source]) tile.owner = 1;
    market.building = 'market';
    producer.building = 'forge';
    state.players[0].visible = state.players[0].visible.filter((id) => id !== source.id);
    expect(captureIncome(state, observe(state), rival)).toBe(1);
    source.terrain = 'mountain';
    source.building = 'mine';
    expect(captureIncome(state, observe(state), rival)).toBe(1);
    state.players[0].visible.push(source.id);
    expect(captureIncome(state, observe(state), rival)).toBe(2);
  });

  it('researches a viable farming project and realizes its forecast recurring income', () => {
    const state = tactical();
    state.options.quickMode = false;
    state.players[0].resources = 13;
    state.players[0].technologies.push('organization');
    for (const [x,y] of [[4,4],[4,5]]) {
      const unit = addUnit(state, 0, 'warrior', x, y);
      unit.moved = unit.attacked = true;
    }
    const crop = state.tiles[2 * state.options.size + 2];
    crop.resource = 'crop';
    const result = runAiTurnDetailed(state);
    expect(result.actions.slice(0, 2)).toEqual([
      { type: 'RESEARCH', techId: 'farming' },
      { type: 'BUILD', tileId: crop.id, building: 'farm' },
    ]);
    expect(getIncome(result.state, 0)).toBe(getIncome(state, 0) + 2);
    replay(state, result);
  });
  it('saves for trade and then funds a market with recurring revenue', () => {
    const state = tactical();
    state.options.quickMode = true;
    state.players[0].resources = 6;
    state.players[0].technologies = ['riding', 'roads', 'forestry', 'farming', 'construction', 'mathematics'];
    state.cities[0].level = 2;
    const id = (x: number, y: number) => y * state.options.size + x;
    for (let y = 2; y <= 4; y++) for (let x = 1; x <= 4; x++) {
      const plot = state.tiles[id(x, y)];
      plot.owner = 0;
      if (!state.cities[0].territory.includes(plot.id)) state.cities[0].territory.push(plot.id);
    }
    for (const [x,y] of [[1,2],[1,3],[1,4],[2,2],[2,4],[3,2],[3,4]]) {
      const plot = state.tiles[id(x, y)];
      plot.terrain = 'forest';
      plot.building = 'lumberHut';
    }
    state.tiles[id(2, 3)].building = 'sawmill';
    state.tiles[id(4, 3)].building = 'windmill';
    for (const y of [2,4]) state.tiles[id(4, y)].building = 'farm';
    for (const [x,y] of [[4,4],[4,5]]) {
      const unit = addUnit(state, 0, 'warrior', x, y);
      unit.moved = unit.attacked = true;
    }
    const turns = [runAiTurnDetailed(state)];
    expect(turns[0].actions).toEqual([{ type: 'END_TURN' }]);
    for (let i = 1; i < 3; i++) {
      const next = applyAction(turns[i-1].state, { type: 'END_TURN' }).state;
      for (const unit of next.units) unit.moved = unit.attacked = true;
      turns.push(runAiTurnDetailed(next));
      replay(next, turns[i]);
    }
    expect(turns[1].actions).toContainEqual({ type: 'RESEARCH', techId: 'trade' });
    expect(turns[2].actions).toContainEqual({ type: 'BUILD', tileId: id(3, 3), building: 'market' });
    expect(getIncome(turns[2].state, 0)).toBe(getIncome(state, 0) + 8);
  });

  it('researches a ranged option and fields it alongside an existing melee force', () => {
    const state = tactical();
    state.options.quickMode = true;
    state.players[0].technologies = ['organization', 'hunting', 'climbing', 'riding', 'strategy'];
    state.players[0].resources = 13;
    state.cities[0].level = 2;
    for (const [x,y] of [[4,4],[4,5]]) {
      const unit = addUnit(state, 0, 'warrior', x, y);
      unit.moved = unit.attacked = true;
    }
    addUnit(state, 1, 'warrior', 6, 6);
    const result = runAiTurnDetailed(state);
    expect(result.actions).toContainEqual({ type: 'RESEARCH', techId: 'archery' });
    expect(result.actions).toContainEqual({ type: 'TRAIN', cityId: state.cities[0].id, unitType: 'archer' });
    replay(state, result);
  });
});

describe('naval logistics and economic prerequisites', () => {
  it('prioritizes affordable sailing for existing ports and subsequently upgrades a raft', () => {
    let state = tactical(); state.players[0].resources = 11; state.players[0].technologies = ['fishing'];
    for (const [x, y] of [[2,1], [2,2]]) {
      const tile = state.tiles[y * 12 + x]; tile.terrain = 'shallow'; tile.building = 'port';
      const raft = addUnit(state, 0, 'raft', x, y); raft.moved = raft.attacked = true;
      raft.carried = { type: 'warrior', maxHp: 10, veteran: false, kills: 0 };
    }
    const research = runAiTurnDetailed(state, 1);
    expect(research.actions[0]).toEqual({ type: 'RESEARCH', techId: 'sailing' }); replay(state, research);
    state = applyAction(research.state, { type: 'END_TURN' }).state;
    const upgrade = runAiTurnDetailed(state);
    expect(upgrade.actions.some(action => action.type === 'UPGRADE_NAVAL' && action.unitType === 'scout')).toBe(true);
    replay(state, upgrade);
  });
  it('funds a slow refit and budgets its future upkeep before scheduling a second one', () => {
    const state = tactical();
    state.options.quickMode = false;
    state.players[0].resources = 10;
    state.players[0].technologies = ['fishing', 'sailing'];
    for (const [x, y] of [[2,1], [2,2]]) {
      const tile = state.tiles[y * 12 + x];
      tile.terrain = 'shallow'; tile.building = 'port';
      const raft = addUnit(state, 0, 'raft', x, y);
      raft.carried = { type: 'warrior', maxHp: 10, veteran: false, kills: 0 };
    }
    const result = runAiTurnDetailed(state);
    const orders = result.actions.filter(action => action.type === 'UPGRADE_NAVAL');
    expect(orders).toHaveLength(1);
    expect(result.state.units.find(unit => unit.id === orders[0].unitId)).toMatchObject({
      type: 'raft', navalTraining: { unitType: 'scout', readyRound: 3 },
    });
    replay(state, result);
  });
  it('deliberately embarks at a port to approach a known city beyond an ocean barrier', () => {
    const state = tactical(); state.players[0].technologies = ['fishing', 'sailing'];
    for (let y = 0; y < 12; y++) for (const x of [5,6,7]) state.tiles[y * 12 + x].terrain = x === 6 ? 'deep' : 'shallow';
    const port = state.tiles[5 * 12 + 5]; port.building = 'port'; port.owner = 0; state.cities[0].territory.push(port.id);
    const soldier = addUnit(state, 0, 'warrior', 4,5), result = runAiTurnDetailed(state);
    expect(result.actions).toContainEqual({ type: 'MOVE', unitId: soldier.id, to: port.id });
    expect(result.state.units.find(unit => unit.id === soldier.id)?.type).toBe('raft'); replay(state, result);
  });
});

describe('fog-of-war information boundary', () => {
  it('ignores additional ordinary enemy units on tiles that stay unexplored throughout this turn', () => {
    const known = tactical(); addUnit(known, 0, 'warrior', 4,4);
    const player = known.players[0];
    player.explored = known.tiles.filter(tile => tile.x <= 6 && tile.y <= 6).map(tile => tile.id);
    player.visible = [...player.explored]; player.stats.explored = player.explored.length;
    const unknown = structuredClone(known);
    for (const x of [8,9,10]) addUnit(unknown, 1, 'knight', x,10);
    const first = runAiTurnDetailed(known), second = runAiTurnDetailed(unknown);
    expect(second.actions).toEqual(first.actions);
    expect(second.state.players[0].explored.some(id => id >= 10 * 12 + 8 && id <= 10 * 12 + 10)).toBe(false);
    replay(unknown, second);
  });
});

describe('unpublished opponent research does not inform movement risk', () => {
  it('uses the same conservative mountain threat and guarding decision for researched and unresearched enemies', () => {
    const unresearched = tactical(), capital = unresearched.cities[0];
    const guard = addUnit(unresearched, 0, 'defender', capital.x, capital.y);
    const enemy = addUnit(unresearched, 1, 'rider', 4,1);
    for (let y = 0; y < 12; y++) unresearched.tiles[y * 12 + 2].terrain = 'mountain';
    unresearched.players[1].technologies = [];
    const researched = structuredClone(unresearched);
    researched.players[1].technologies = ['climbing', 'fishing', 'sailing'];
    // The underlying legal enemy routes really differ across this barrier.
    // Our AI has not observed the research, so that difference cannot guide it.
    const mountain = 1 * 12 + 2, cityTile = capital.y * 12 + capital.x;
    expect(getReachableTiles({ ...unresearched, currentPlayer: 1 }, enemy.id)).not.toContain(mountain);
    expect(getReachableTiles({ ...researched, currentPlayer: 1 }, enemy.id)).toContain(mountain);
    const lowKnowledge = observe(unresearched), highKnowledge = observe(researched);
    const lowThreat = buildThreatMap(unresearched, lowKnowledge, true), highThreat = buildThreatMap(researched, highKnowledge, true);
    const lowRisk = incomingDamage(unresearched, lowKnowledge, lowThreat, guard, cityTile);
    expect(lowRisk).toBeGreaterThan(0);
    expect(incomingDamage(researched, highKnowledge, highThreat, guard, cityTile)).toBe(lowRisk);
    const first = runAiTurnDetailed(unresearched), second = runAiTurnDetailed(researched);
    expect(second.actions).toEqual(first.actions);
    expect(first.state.units.find(unit => unit.id === guard.id)).toMatchObject({ x: capital.x, y: capital.y });
    replay(unresearched, first); replay(researched, second);
  });
});

describe('slow-mode maintenance decisions', () => {
  it.each(['easy', 'normal'] as const)('%s reactivates an affordable unit before making purchases', (difficulty) => {
    const state = tactical(difficulty);
    state.options.quickMode = false;
    state.players[0].resources = 4;
    const active = addUnit(state, 0, 'rider', 4, 4);
    const ready = addUnit(state, 0, 'rider', 4, 5);
    ready.upkeep = 'reactivation';
    const suspended = addUnit(state, 0, 'archer', 3, 4);
    suspended.upkeep = 'suspended';

    const result = runAiTurnDetailed(state);
    expect(result.actions[0]).toEqual({ type: 'REACTIVATE', unitId: ready.id });
    expect(result.actions.some((action) => 'unitId' in action && action.unitId === suspended.id)).toBe(false);
    expect(result.state.units.find((unit) => unit.id === active.id)?.upkeep).toBeUndefined();
    expect(result.state.units.find((unit) => unit.id === ready.id)?.upkeep).toBeUndefined();
    expect(result.state.units.find((unit) => unit.id === suspended.id)?.upkeep).toBe('reactivation');
    replay(state, result);
  });

  it('prioritizes supporting active units when the treasury covers the reactivation fee alone', () => {
    const state = tactical();
    state.options.quickMode = false;
    state.players[0].resources = 2;
    const active = addUnit(state, 0, 'rider', 4, 4);
    const ready = addUnit(state, 0, 'rider', 4, 5);
    ready.upkeep = 'reactivation';

    const result = runAiTurnDetailed(state);
    expect(result.actions.some((action) => action.type === 'REACTIVATE')).toBe(false);
    expect(result.state.units.find((unit) => unit.id === active.id)?.upkeep).toBeUndefined();
    expect(result.state.units.some((unit) => unit.id === ready.id)).toBe(false);
    expect(result.state.players[0].resources).toBe(1);
    replay(state, result);
  });

  it('spends excess stars on growth without sacrificing the current upkeep bill', () => {
    const state = tactical();
    state.options.quickMode = false;
    state.players[0].resources = 5;
    state.players[0].technologies.push('organization');
    const active = addUnit(state, 0, 'archer', 4, 4);
    addUnit(state, 0, 'warrior', 6, 4);
    for (const [x, y] of [[1, 2], [2, 2]]) state.tiles[y * 12 + x].resource = 'fruit';

    const result = runAiTurnDetailed(state);
    expect(result.actions.filter((action) => action.type === 'HARVEST')).toHaveLength(1);
    expect(result.state.units.find((unit) => unit.id === active.id)?.upkeep).toBeUndefined();
    expect(result.state.players[0].resources).toBe(0);
    replay(state, result);
  });

  it('recruits a warrior immediately only when recurring income has room for its upkeep', () => {
    const state = tactical();
    state.options.quickMode = false;
    state.players[0].resources = 10;
    state.players[0].technologies = ['climbing', 'archery'];
    addUnit(state, 0, 'archer', 4, 4);
    const committed = runAiTurnDetailed(state);
    expect(committed.actions.some(action => action.type === 'TRAIN')).toBe(false);
    replay(state, committed);

    state.cities[0].incomeBonus = 1;
    const result = runAiTurnDetailed(state);
    expect(result.actions).toContainEqual({ type: 'TRAIN', cityId: state.cities[0].id, unitType: 'warrior' });
    expect(result.state.units).toContainEqual(expect.objectContaining({ owner: 0, type: 'warrior', moved: true, attacked: true }));
    replay(state, result);
  });

  it('advances two rounds on a 64-square board with eleven factions and slow rules', () => {
    let state = newGame({ size: 64, aiCount: 10, quickMode: false });
    for (let turn = 0; turn < 22; turn++) {
      const result = runAiTurnDetailed(state);
      replay(state, result);
      expect(result.state.players.every((player) => player.resources >= 0)).toBe(true);
      state = result.state;
    }
    expect(state.round).toBe(3);
    expect(state.currentPlayer).toBe(0);
  }, 30_000);
});
