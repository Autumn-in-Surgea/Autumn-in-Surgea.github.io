import type { CSSProperties, ReactNode } from "react";
import {
  ArrowLeftRight, Award, BrainCircuit, Compass, Crosshair, Eye, Flag, Hammer, Heart,
  RotateCcw, Route, Shield, Sprout, Swords, Trash2, Trees, Users, Waves, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  BUILDINGS, NAVAL_UPGRADES, UNITS, canEditNavalUpgrade, canEditTraining, getCityIncome, getCityUnitCount, getMovement,
  getNavalUpgradeOrderCost, getNavalUpgradeRefund, getTrainingOrderCost, getTrainingRefund,
  getTrainingRounds, getUnitTrainingRounds, getUnitUpkeep,
  getUpgradeRewards, getVisibleResource, hasTech, isTerritoryResourceHarvestable, isUnitVisible,
  populationNeeded, previewCombat, validateAction,
} from "../game";
import type { Action, City, GameState, Resource, Reward, Terrain, Tile, Unit, UnitType } from "../game";
import { getNation } from "../nations/registry";
import { Cost } from "./Common";
import { NationEmblem } from "./NationEmblem";
import { UnitTraits } from "./UnitTraits";
import { cityMeter, cityMeterColors } from "./cityMeter";
import "./selection-details.css";

export function HudAction({
  icon: Icon, label, onClick, badge, title, disabled, variant, className, ariaLabel, secondaryText,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  badge?: ReactNode;
  title?: string;
  disabled?: boolean;
  variant?: "accent";
  className?: string;
  ariaLabel?: string;
  secondaryText?: string;
}) {
  return (
    <button
      type="button"
      className={className ? `hud-action ${className}` : "hud-action"}
      data-variant={variant}
      title={title}
      disabled={disabled}
      aria-label={ariaLabel ?? label}
      onClick={onClick}
    >
      {badge === undefined ? <Icon size={21} aria-hidden="true" /> : (
        <span className="hud-action-icon-row">
          <Icon size={21} aria-hidden="true" />
          <span className="hud-action-badge">{badge}</span>
        </span>
      )}
      <span className="hud-action-label">{label}</span>
      {secondaryText && <span className="hud-action-secondary">{secondaryText}</span>}
    </button>
  );
}

const terrainNames: Record<Terrain, string> = {
  plain: "田野",
  forest: "森林",
  mountain: "山脉",
  shallow: "浅水",
  deep: "海洋",
};
const resourceNames: Record<Resource, string> = {
  fruit: "水果",
  animal: "动物",
  crop: "作物",
  ore: "金属",
  fish: "鱼",
  starfish: "海星",
};
const unitIcons: Record<UnitType, LucideIcon> = {
  warrior: Swords,
  rider: Zap,
  defender: Shield,
  archer: Crosshair,
  swordsman: Swords,
  catapult: Crosshair,
  knight: Zap,
  mindBender: BrainCircuit,
  cloak: Eye,
  dagger: Swords,
  giant: Users,
  raft: Waves,
  scout: Compass,
  rammer: Waves,
  bomber: Crosshair,
  juggernaut: Waves,
  dinghy: Waves,
  pirate: Swords,
};
const rewards: Record<Reward, { title: string; note: string; icon: LucideIcon }> = {
  income: { title: "工坊", note: "每回合 +1 星星", icon: Hammer },
  explore: { title: "探索者", note: "自动探索 15 步", icon: Compass },
  resources: { title: "资源", note: "获得 5 星星", icon: Sprout },
  defense: { title: "城墙", note: "城市防御提升", icon: Shield },
  population: { title: "人口", note: "增加 3 人口", icon: Users },
  territory: { title: "边界扩张", note: "领土扩大 1 格", icon: Flag },
  park: { title: "公园", note: "增加 250 分", icon: Trees },
  giant: { title: "巨人", note: "生成巨人", icon: Users },
};

interface Command {
  action: Action;
  label: string;
  icon: LucideIcon;
  cost?: number;
  note?: string;
  variant?: "accent";
  secondaryText?: string;
}

function tileDevelopment(game: GameState, tile: Tile) {
  const candidates: Command[] = [];
  const player = game.players[0];
  const resource = getVisibleResource(game, tile, 0);
  const harvestAvailable = resource === "starfish"
    ? !tile.building && hasTech(player, "navigation")
    : isTerritoryResourceHarvestable(game, tile, 0);
  if (resource && harvestAvailable) {
    candidates.push({
      action: { type: "HARVEST", tileId: tile.id },
      label: `采集${resourceNames[resource]}`,
      icon: Sprout,
      cost: resource === "starfish" ? undefined : 2,
    });
  }
  if (tile.owner === 0 && !tile.building && !tile.cityId && !tile.ruin) {
    for (const building of Object.values(BUILDINGS)) {
      if (
        !building.terrain.includes(tile.terrain) ||
        (building.tech && !hasTech(player, building.tech)) ||
        (building.resource && building.resource !== resource)
      ) continue;
      const action = { type: "BUILD", tileId: tile.id, building: building.id } as const;
      if (building.monument && validateAction(game, action)) continue;
      candidates.push({ action, label: building.name, icon: Hammer, cost: building.cost, note: building.description });
    }
  }
  return candidates;
}

function tileManagement(game: GameState, tile: Tile) {
  const player = game.players[0];
  const tileId = tile.id;
  const candidates: Command[] = [];
  if (
    hasTech(player, "roads") && (tile.owner === null || tile.owner === 0) &&
    !tile.road && !tile.cityId && ["forest", "plain"].includes(tile.terrain)
  ) {
    candidates.push({ action: { type: "ROAD", tileId }, label: "道路", icon: Route, cost: 3 });
  }
  if (tile.owner !== 0) return candidates;
  if (!tile.building && !tile.cityId && !tile.ruin) {
    if (tile.terrain === "forest") {
      if (hasTech(player, "forestry"))
        candidates.push({ action: { type: "CLEAR_FOREST", tileId }, label: "砍伐", icon: Trees, note: "获得 1 星星" });
      if (hasTech(player, "construction"))
        candidates.push({ action: { type: "BURN_FOREST", tileId }, label: "烧毁", icon: Sprout, cost: 3 });
    }
    if (tile.terrain === "plain" && !tile.resource && hasTech(player, "spiritualism")) {
      candidates.push({ action: { type: "GROW_FOREST", tileId }, label: "种植森林", icon: Trees, cost: 5 });
    }
  }
  if (tile.building && !BUILDINGS[tile.building].monument && hasTech(player, "chivalry")) {
    candidates.push({ action: { type: "DESTROY", tileId }, label: "拆除", icon: Trash2 });
  }
  return candidates;
}

function unitCommands(game: GameState, unit: Unit, tile: Tile, city?: City | null): Command[] {
  const unitId = unit.id;
  if (unit.upkeep === "suspended") return [];
  if (unit.upkeep === "reactivation") {
    return [{
      action: { type: "REACTIVATE", unitId }, label: "重新激活", icon: RotateCcw,
      cost: getUnitUpkeep(game, unit), note: "立即恢复行动，回合结束时照常扣除维护费。", variant: "accent",
    }];
  }
  if (unit.navalTraining) return navalCommands(game, unit);
  const commands: Command[] = [];
  const skills = UNITS[unit.type].skills;
  if (city && city.owner !== 0 && !skills.includes("water") && (city.owner === null || !skills.includes("infiltrate"))) {
    commands.push({ action: { type: "CAPTURE", unitId }, label: "占领", icon: Flag, variant: "accent" });
  }
  if (tile.resource === "starfish" && skills.includes("water") && hasTech(game.players[0], "navigation")) {
    commands.push({ action: { type: "HARVEST", tileId: tile.id }, label: "采集海星", icon: Sprout });
  }
  if (tile.ruin) commands.push({ action: { type: "EXAMINE", unitId }, label: "探索遗迹", icon: Compass });
  if (unit.hp < unit.maxHp) commands.push({ action: { type: "HEAL", unitId }, label: "恢复", icon: Heart });
  if (skills.includes("heal")) commands.push({ action: { type: "HEAL_OTHERS", unitId }, label: "治疗友军", icon: Heart });
  if (unit.kills >= 3 && !unit.veteran && !skills.includes("static")) {
    commands.push({ action: { type: "PROMOTE", unitId }, label: "晋升老兵", icon: Award });
  }
  if (skills.includes("infiltrate")) {
    for (const c of game.cities) {
      if (c.owner === null || c.owner === 0 || Math.max(Math.abs(c.x - tile.x), Math.abs(c.y - tile.y)) > 1) continue;
      if (!game.players[0].visible.includes(c.y * game.options.size + c.x)) continue;
      commands.push({ action: { type: "INFILTRATE", unitId, cityId: c.id }, label: `渗透${c.name}`, icon: Eye });
    }
  }
  if (hasTech(game.players[0], "freeSpirit")) {
    commands.push({ action: { type: "DISBAND", unitId }, label: "解散", icon: Trash2 });
  }
  if (unit.type === "raft") commands.push(...navalCommands(game, unit));
  return commands;
}

function orderTiming(rounds: number, cost: number) {
  return cost < 0 ? `${rounds} 回合 · 返还 ${-cost} 星` : `${rounds} 回合`;
}

function navalCommands(game: GameState, unit: Unit): Command[] {
  const pending = unit.navalTraining;
  if (pending && !canEditNavalUpgrade(game, unit)) return [];
  const unitId = unit.id;
  const commands: Command[] = pending ? [{
    action: { type: "CANCEL_NAVAL_UPGRADE", unitId }, label: "取消改装", icon: RotateCcw,
    secondaryText: `返还 ${getNavalUpgradeRefund(unit)} 星`,
  }] : [];
  for (const unitType of NAVAL_UPGRADES) {
    const def = UNITS[unitType];
    if (pending?.unitType === unitType || (def.tech && !hasTech(game.players[0], def.tech))) continue;
    const cost = getNavalUpgradeOrderCost(game, unit, unitType);
    commands.push({
      action: { type: "UPGRADE_NAVAL", unitId, unitType },
      label: def.name,
      icon: unitIcons[unitType],
      cost: cost > 0 ? cost : undefined,
      secondaryText: game.options.quickMode === false ? orderTiming(getUnitTrainingRounds(game, unitType), cost) : undefined,
    });
  }
  return commands;
}

function cityCommands(game: GameState, city: City) {
  const player = game.players[0];
  const commands: Command[] = getUpgradeRewards(city).map(reward => ({
    action: { type: "CITY_REWARD", cityId: city.id, reward },
    label: rewards[reward].title,
    icon: rewards[reward].icon,
    secondaryText: rewards[reward].note,
    variant: "accent",
  }));
  const training = city.training;
  if (training) {
    if (!canEditTraining(game, city)) return commands;
    commands.push({
      action: { type: "CANCEL_TRAINING", cityId: city.id },
      label: "取消训练",
      icon: RotateCcw,
      secondaryText: `返还 ${getTrainingRefund(game, city)} 星`,
    });
  }
  for (const def of Object.values(UNITS)) {
    if (def.id === training?.unitType || !def.trainable || (def.tech && !hasTech(player, def.tech))) continue;
    const rounds = getTrainingRounds(game, city, def.id);
    const cost = getTrainingOrderCost(game, city, def.id);
    commands.push({
      action: { type: "TRAIN", cityId: city.id, unitType: def.id },
      label: training ? `改训${def.name}` : def.name,
      icon: unitIcons[def.id],
      cost: cost > 0 ? cost : undefined,
      note: def.description,
      secondaryText: game.options.quickMode === false ? orderTiming(rounds, cost) : undefined,
    });
  }
  return commands;
}

function Details({ rows }: { rows: ReadonlyArray<readonly [string, ReactNode]> }) {
  return (
    <dl className="selection-detail-grid">
      {rows.map(([label, value]) => (
        <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
      ))}
    </dl>
  );
}

function CityMeter({ game, city }: { game: GameState; city: City }) {
  const units = getCityUnitCount(game, city);
  const capacity = populationNeeded(city);
  const { cells, deficit } = cityMeter(city.population, units, capacity);
  return (
    <span
      className="selection-city-meter"
      data-deficit={deficit < 0}
      role="meter"
      aria-label="人口进度与单位容量"
      aria-valuemin={0}
      aria-valuemax={capacity}
      aria-valuenow={Math.min(capacity, Math.max(0, city.population))}
      aria-valuetext={`人口 ${city.population}，升阶需要 ${capacity}，已用单位位 ${units}`}
      style={{
        "--population": cityMeterColors.population,
        "--occupied": cityMeterColors.units,
        "--empty": cityMeterColors.empty,
        "--track": cityMeterColors.track,
        "--deficit": cityMeterColors.deficit,
        "--slots": cells.length,
      } as CSSProperties}
    >
      {cells.map(({ fill, unit }, index) => (
        <span className="selection-city-slot" aria-hidden="true" key={index}>
          {fill > 0 && <span className="selection-city-fill" style={{ width: `${fill * 100}%` }} />}
          {unit > 0 && <i className="selection-city-dot" />}
        </span>
      ))}
    </span>
  );
}

function CombatSide({ unit, incoming, enemy = false }: {
  unit: Unit;
  incoming: number;
  enemy?: boolean;
}) {
  const health = `${unit.hp} → ${Math.max(0, unit.hp - incoming)}`;
  return (
    <dl className="hud-combat-side" data-enemy={enemy}>
      <dt><span>{enemy ? "目标" : "我方"}</span> {UNITS[unit.type].name}</dt>
      <dd>
        <strong><span className="hud-combat-health-label">生命 </span>{health}</strong>
        <span>{enemy ? "预计伤害" : "预计反击"} <b>{incoming}</b></span>
      </dd>
    </dl>
  );
}

export function SelectionControls({
  game, tileId, unit, city, target, busy = false, showCityStats, onCommand,
}: {
  game: GameState;
  tileId: number;
  unit?: Unit | null;
  city?: City | null;
  target?: Unit | null;
  busy?: boolean;
  showCityStats: boolean;
  onCommand: (action: Action) => void;
}) {
  const tile = game.tiles[tileId];
  const player = game.players[0];
  const explored = player.explored.includes(tileId);
  const unitVisible = explored && unit && isUnitVisible(game, unit, 0) ? unit : null;
  const knownCity = explored ? city : null;
  const owner = explored ? (unitVisible?.owner ?? (knownCity ? knownCity.owner : tile.owner)) : null;
  const faction = owner === null ? undefined : game.players[owner];
  const nation = faction && getNation(faction.civilization);
  const canAct = !busy && game.currentPlayer === 0 && game.status === "playing";

  function commandButton({ action, label, icon, cost, note, variant, secondaryText }: Command) {
    const reason = game.status !== "playing" ? "对局已结束。"
      : !canAct ? "等待己方回合。" : validateAction(game, action);
    const ariaLabel = [label, cost ? `${cost} 星` : undefined, secondaryText]
      .filter(Boolean).join("，");
    return (
      <HudAction
        key={JSON.stringify(action)}
        icon={icon}
        label={label}
        badge={cost ? <Cost value={cost} /> : undefined}
        ariaLabel={ariaLabel}
        title={reason ?? note}
        variant={variant}
        secondaryText={secondaryText}
        disabled={reason !== null}
        onClick={() => onCommand(action)}
      />
    );
  }

  const visibleTarget = canAct && unitVisible?.owner === 0 && target &&
    isUnitVisible(game, target, 0) ? target : null;
  const swapping = visibleTarget?.owner === 0;
  const preview = unitVisible && visibleTarget ? targetPreview(game, unitVisible, visibleTarget) : null;
  let commands: Command[] = [];
  if (unitVisible?.owner === 0) {
    if (!swapping) commands = unitCommands(game, unitVisible, tile, knownCity);
  } else if (!unitVisible && knownCity?.owner === 0) {
    commands = cityCommands(game, knownCity);
  } else if (!unitVisible && !knownCity && explored && player.visible.includes(tileId)) {
    commands = [
      ...(tile.owner === 0 || tile.resource === "starfish" ? tileDevelopment(game, tile) : []),
      ...tileManagement(game, tile),
    ];
  }

  const title = !explored ? "未探索地块"
    : unitVisible ? UNITS[unitVisible.type].name
    : knownCity?.name ?? terrainNames[tile.terrain];
  const details = preview ?? selectionDetails(game, tile, explored, unitVisible, knownCity, showCityStats);
  const upkeepStatus = unitVisible?.owner === 0 && unitVisible.upkeep === "suspended"
    ? "欠费停用 · 下回合可激活"
    : unitVisible?.owner === 0 && unitVisible.upkeep === "reactivation"
      ? "本回合未激活将解散" : undefined;
  const refit = unitVisible?.owner === 0 ? unitVisible.navalTraining : undefined;
  const refitStatus = refit ? `改装${UNITS[refit.unitType].name} · 剩余 ${refit.readyRound - game.round} 回合` : undefined;
  const actionStatus = swapping ? "再点友军确认换位" : upkeepStatus ?? refitStatus;

  return (
    <>
      <div className="hud-selection-actions" role="group" aria-label="所选对象操作">
        {commands.map(commandButton)}
        {(!commands.length || actionStatus) && (
          <span className="hud-selection-empty">{actionStatus ?? (preview ? "再点目标执行行动" : "暂无可用操作")}</span>
        )}
      </div>
      <div className="hud-selection-details" role="region" tabIndex={0} aria-label="所选对象详情">
        {nation ? <NationEmblem nation={nation} className="selection-nation-emblem" decorative={false} />
          : faction && (
            <span className="selection-faction-color" style={{ backgroundColor: faction.color }}
              role="img" aria-label={faction.name} />
          )}
        {!preview && <strong className="hud-selection-title">{title}</strong>}
        {details}
      </div>
    </>
  );
}

function targetPreview(game: GameState, unit: Unit, target: Unit) {
  if (unit.owner === target.owner) {
    return (
      <div className="hud-convert-preview" role="status" aria-label="换位预览">
        <ArrowLeftRight size={18} aria-hidden="true" />
        <strong>{UNITS[unit.type].name}</strong><span>与</span><strong>{UNITS[target.type].name}</strong><span>换位</span>
      </div>
    );
  }
  if (UNITS[unit.type].skills.includes("convert")) {
    if (validateAction(game, { type: "CONVERT", unitId: unit.id, targetId: target.id })) return null;
    return (
      <div className="hud-convert-preview" role="status" aria-label="转化预估">
        <BrainCircuit size={18} aria-hidden="true" />
        <span>转化后，<strong>{UNITS[target.type].name}</strong>加入我方</span>
      </div>
    );
  }
  const preview = previewCombat(game, unit.id, target.id);
  if (!preview.canAttack) return null;
  return (
    <div className="hud-combat-preview" role="status" aria-label="战斗预估" aria-atomic="true">
      <CombatSide unit={unit} incoming={preview.retaliation} />
      <CombatSide unit={target} incoming={preview.damage} enemy />
    </div>
  );
}

function selectionDetails(
  game: GameState, tile: Tile, explored: boolean, unit: Unit | null, city: City | null | undefined, showCityStats: boolean,
) {
  if (!explored) return <span className="hud-selection-description">派单位探索后可查看地形。</span>;
  if (unit) {
    const def = UNITS[unit.type];
    const traits = unit.independent && !def.skills.includes("independent")
      ? [...def.skills, "independent" as const] : def.skills;
    const upkeep = unit.owner === 0 ? getUnitUpkeep(game, unit) : 0;
    return (
      <Details rows={[
        ["特性", <UnitTraits skills={traits} />],
        ["攻击", def.attack],
        ["防御", def.defense],
        ["移动", getMovement(game, unit)],
        ["射程", def.range],
        ...(upkeep ? [["维护费", unit.upkeep ? "0 星" : `${upkeep} 星 / 回合`] as const] : []),
        ...(unit.veteran ? [["兵阶", "老兵"] as const] : []),
      ]} />
    );
  }
  if (city) {
    const owned = city.owner === 0;
    const training = owned ? city.training : undefined;
    const remaining = training ? training.readyRound - game.round : 0;
    const trainingStatus = training && `${UNITS[training.unitType].name} · ${
      canEditTraining(game, city) ? `计划 ${remaining} 回合` : remaining > 0 ? `剩余 ${remaining} 回合` : "等待交付"
    }`;
    return (
      <>
        <Details rows={[
          ...(trainingStatus ? [["训练", trainingStatus] as const] : []),
          ["等级", city.level],
          ...(showCityStats && owned ? [
            ["人口和单位", <CityMeter game={game} city={city} />] as const,
            ["收入", `+${getCityIncome(game, city.id)} 星`] as const,
          ] : []),
        ]} />
        {owned && city.pendingRewardLevels.length > 0 && (
          <span className="hud-selection-description">待选等级 {city.pendingRewardLevels[0]} 奖励</span>
        )}
      </>
    );
  }
  const resource = getVisibleResource(game, tile, 0);
  return (
    <Details rows={[
      ...(resource ? [["资源", resourceNames[resource]] as const] : []),
      ...(tile.building ? [["建筑", BUILDINGS[tile.building].name] as const] : []),
      ...(tile.road ? [["道路", "已修建"] as const] : []),
      ...(tile.ruin ? [["遗迹", "尚可探索"] as const] : []),
      ...(tile.lighthouse ? [["设施", "灯塔"] as const] : []),
    ]} />
  );
}
