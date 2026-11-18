import { useEffect, useLayoutEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeft, ArrowUp, Award, BrainCircuit, Compass, Crosshair,
  Eye, Flag, Hammer, Heart, Info, List, Route, Shield, Sprout,
  Swords, Trash2, Trees, Users, Waves, X, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  BUILDINGS, UNITS, getCityCapacity, getCityIncome, getMovement, getTrainingCost,
  getUpgradeRewards, getVisibleResource, hasTech, isUnitVisible, populationNeeded, previewCombat,
  validateAction,
} from "../game";
import type { Action, City, GameState, Resource, Reward, Terrain, Tile, Unit, UnitType } from "../game";
import { Cost, Modal } from "./Common";
import "./selection-details.css";

export function HudAction({
  icon: Icon, label, onClick, badge, title, disabled, variant, className, ariaLabel,
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
}

function tileDevelopment(game: GameState, tile: Tile) {
  const candidates: Command[] = [];
  const resource = getVisibleResource(game, tile, 0);
  if (resource && !tile.building && ["fruit", "animal", "fish", "starfish"].includes(resource)) {
    candidates.push({
      action: { type: "HARVEST", tileId: tile.id },
      label: `采集${resourceNames[resource]}`,
      icon: Sprout,
      cost: resource === "starfish" ? undefined : 2,
    });
  }
  if (tile.owner === 0 && !tile.building && !tile.cityId) {
    for (const building of Object.values(BUILDINGS)) {
      if (!building.terrain.includes(tile.terrain) || (building.resource && building.resource !== resource)) continue;
      const action = { type: "BUILD", tileId: tile.id, building: building.id } as const;
      if (building.monument && validateAction(game, action)) continue;
      candidates.push({ action, label: building.name, icon: Hammer, cost: building.cost, note: building.description });
    }
  }
  return candidates;
}

function tileManagement(tile: Tile) {
  const tileId = tile.id;
  const candidates: Command[] = [];
  if ((tile.owner === null || tile.owner === 0) && !tile.road && !tile.cityId && ["forest", "plain"].includes(tile.terrain)) {
    candidates.push({ action: { type: "ROAD", tileId }, label: "道路", icon: Route, cost: 3 });
  }
  if (tile.owner !== 0) return candidates;
  if (!tile.building && !tile.cityId && !tile.ruin) {
    if (tile.terrain === "forest") {
      candidates.push(
        { action: { type: "CLEAR_FOREST", tileId }, label: "砍伐", icon: Trees, note: "获得 1 星星" },
        { action: { type: "BURN_FOREST", tileId }, label: "烧毁", icon: Sprout, cost: 3 },
      );
    }
    if (tile.terrain === "plain" && !tile.resource) {
      candidates.push({ action: { type: "GROW_FOREST", tileId }, label: "种植森林", icon: Trees, cost: 5 });
    }
  }
  if (tile.building && !BUILDINGS[tile.building].monument) {
    candidates.push({ action: { type: "DESTROY", tileId }, label: "拆除", icon: Trash2 });
  }
  return candidates;
}

function unitCommands(game: GameState, unit: Unit, tile: Tile, city?: City | null) {
  const commands: Command[] = [];
  const unitId = unit.id;
  const skills = UNITS[unit.type].skills;
  if (city && city.owner !== 0 && !skills.includes("water") && (city.owner === null || !skills.includes("infiltrate"))) {
    commands.push({ action: { type: "CAPTURE", unitId }, label: "占领", icon: Flag, variant: "accent" });
  }
  if (tile.resource === "starfish" && getVisibleResource(game, tile, 0)) {
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
  if (game.players[0].technologies.includes("freeSpirit")) {
    commands.push({ action: { type: "DISBAND", unitId }, label: "解散", icon: Trash2 });
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

type Submenu = "main" | "train" | "develop" | "naval" | "extra";

export function SelectionControls({
  game, tileId, unit, city, target, busy = false, onClose, onCommand,
  selectionRequest, resetScroll,
}: {
  game: GameState;
  tileId: number;
  unit?: Unit | null;
  city?: City | null;
  target?: Unit | null;
  busy?: boolean;
  onClose: () => void;
  onCommand: (a: Action) => void;
  selectionRequest: number;
  resetScroll: () => void;
}) {
  const [submenu, setSubmenu] = useState<Submenu>("main");
  const [details, showDetails] = useState(false);
  useEffect(() => {
    setSubmenu("main");
    showDetails(false);
  }, [tileId, unit?.id, selectionRequest]);
  useLayoutEffect(resetScroll, [resetScroll, submenu, target?.id]);

  const tile = game.tiles[tileId];
  const player = game.players[0];
  const explored = player.explored.includes(tileId);
  const unitVisible = explored && unit && isUnitVisible(game, unit, 0) ? unit : null;
  const knownCity = explored ? city : null;
  const canAct = !busy && game.currentPlayer === 0 && game.status === "playing";
  function blocked(action: Action) {
    if (game.status !== "playing") return "对局已结束。";
    if (!canAct) return "等待己方回合。";
    return validateAction(game, action);
  }
  function commandButton(command: Command) {
    const { action, label, icon, cost, note, variant } = command;
    const reason = blocked(action);
    return (
      <HudAction
        key={JSON.stringify(action)}
        icon={icon}
        label={label}
        badge={cost ? <Cost value={cost} /> : undefined}
        ariaLabel={cost ? `${label}，${cost} 星` : undefined}
        title={reason ?? note}
        variant={variant}
        disabled={reason !== null}
        onClick={() => onCommand(action)}
      />
    );
  }

  const visibleTarget = canAct && unitVisible?.owner === 0 && target &&
    isUnitVisible(game, target, 0) && target.owner !== 0 ? target : null;
  const detailsButton = <HudAction icon={Info} label="详情" onClick={() => showDetails(true)} />;
  const closeButton = <HudAction icon={X} label="取消" ariaLabel="取消选择" onClick={onClose} />;
  const backButton = <HudAction icon={ArrowLeft} label="返回" className="hud-submenu-back" onClick={() => setSubmenu("main")} />;

  if (visibleTarget && unitVisible) {
    if (UNITS[unitVisible.type].skills.includes("convert")) {
      return (
        <div className="hud-convert-preview" role="status" aria-label="转化预估">
          <BrainCircuit size={18} aria-hidden="true" />
          <span>转化后，<strong>{UNITS[visibleTarget.type].name}</strong>加入我方</span>
        </div>
      );
    }
    const preview = previewCombat(game, unitVisible.id, visibleTarget.id);
    if (preview.canAttack) {
      return (
        <div className="hud-combat-preview" role="status" aria-label="战斗预估" aria-atomic="true">
          <CombatSide unit={unitVisible} incoming={preview.retaliation} />
          <CombatSide unit={visibleTarget} incoming={preview.damage} enemy />
        </div>
      );
    }
  }

  const cityRewards = !unitVisible && knownCity?.owner === 0 ? getUpgradeRewards(knownCity) : [];
  let actions: ReactNode;
  let isNested = false;
  if (unitVisible?.owner === 0) {
    const commands = unitCommands(game, unitVisible, tile, knownCity);
    const naval = unitVisible.type === "raft";
    if (submenu === "naval" && naval) {
      isNested = true;
      actions = <>{backButton}{(["scout", "rammer", "bomber"] as const).map(type => commandButton({
        action: { type: "UPGRADE_NAVAL", unitId: unitVisible.id, unitType: type },
        label: UNITS[type].name,
        icon: unitIcons[type],
        cost: UNITS[type].cost,
      }))}</>;
    } else if (submenu === "extra" && commands.length) {
      isNested = true;
      actions = <>{backButton}{commands.map(commandButton)}</>;
    } else {
      const direct = commands.length + Number(naval) <= 2 ? commands.length : naval ? 0 : 1;
      actions = <>
        {commands.slice(0, direct).map(commandButton)}
        {naval && <HudAction icon={ArrowUp} label="改装" ariaLabel="舰船升级" onClick={() => setSubmenu("naval")} />}
        {commands.length > direct && <HudAction icon={List} label="更多" onClick={() => setSubmenu("extra")} />}
      </>;
    }
  } else if (!unitVisible && knownCity?.owner === 0) {
    if (cityRewards.length) {
      const cityId = knownCity.id;
      actions = cityRewards.map(reward => {
        const data = rewards[reward];
        return commandButton({
          action: { type: "CITY_REWARD", cityId, reward },
          label: data.title,
          icon: data.icon,
          note: data.note,
          variant: "accent",
        });
      });
    } else if (submenu === "train") {
      isNested = true;
      const cityId = knownCity.id;
      const trainable = Object.values(UNITS)
        .filter(def => def.trainable && (!def.tech || hasTech(player, def.tech)));
      actions = <>{backButton}{trainable.map(def => commandButton({
        action: { type: "TRAIN", cityId, unitType: def.id },
        label: def.name,
        icon: unitIcons[def.id],
        cost: getTrainingCost(game, 0, def.id),
        note: def.description,
      }))}</>;
    } else {
      actions = <HudAction icon={Users} label="训练" onClick={() => setSubmenu("train")} />;
    }
  } else if (!unitVisible && !knownCity && explored && player.visible.includes(tileId)) {
    const candidates = [
      ...(tile.owner === 0 || tile.resource === "starfish" ? tileDevelopment(game, tile) : []),
      ...tileManagement(tile),
    ];
    const harvest = candidates.find(command => command.action.type === "HARVEST");
    const work = candidates.filter(command => command.action.type !== "HARVEST");
    isNested = submenu === "develop" && work.length > 1;
    if (isNested) actions = <>{backButton}{work.map(commandButton)}</>;
    else actions = <>
      {harvest && commandButton(harvest)}
      {work.length === 1 && commandButton(work[0])}
      {work.length > 1 && <HudAction icon={Hammer} label="建设" onClick={() => setSubmenu("develop")} />}
    </>;
  }

  const title = !explored
    ? "未探索地块"
    : unitVisible ? UNITS[unitVisible.type].name
      : knownCity?.name ?? terrainNames[tile.terrain];
  const resource = explored ? getVisibleResource(game, tile, 0) : null;
  const owner = tile.owner === null ? "中立" : game.players[tile.owner]?.name;
  const upgradingCity = cityRewards.length > 0 && knownCity;
  return (
    <>
      {actions}
      {!isNested && <>{detailsButton}{closeButton}</>}
      {details && (
        <Modal title={title} onClose={() => showDetails(false)}>
          <div className="selection-details">
            {unitVisible ? (
              <>
                <Details rows={[
                  ["阵营", game.players[unitVisible.owner].name],
                  ["生命", `${unitVisible.hp} / ${unitVisible.maxHp}`],
                  ["攻击", UNITS[unitVisible.type].attack],
                  ["防御", UNITS[unitVisible.type].defense],
                  ["移动", getMovement(game, unitVisible)],
                  ["射程", UNITS[unitVisible.type].range],
                  ...(unitVisible.veteran ? [["兵阶", "老兵"] as const] : []),
                ]} />
                <p>{UNITS[unitVisible.type].description}</p>
              </>
            ) : knownCity ? (
              <>
                <Details rows={[
                  ["阵营", knownCity.owner === null ? "中立" : game.players[knownCity.owner].name],
                  ["等级", knownCity.level],
                  ...(knownCity.owner === 0 ? [
                    ["人口", `${knownCity.population} / ${populationNeeded(knownCity)}`] as const,
                    ["收入", `+${getCityIncome(game, knownCity.id)} 星 / 回合`] as const,
                    ["单位", `${game.units.filter(u => u.homeCityId === knownCity.id && u.owner === 0 && !u.independent && !UNITS[u.type].skills.includes("independent")).length} / ${getCityCapacity(knownCity)}`] as const,
                  ] : []),
                ]} />
                {upgradingCity && <section>
                  <h3>等级 {upgradingCity.pendingRewardLevels[0]} 升级奖励</h3>
                  <Details rows={cityRewards.map(reward => [rewards[reward].title, rewards[reward].note])} />
                </section>}
                {knownCity.owner !== 0 && <p>进入城市后驻守至下一己方回合即可占领。</p>}
              </>
            ) : explored ? (
              <Details rows={[
                ["阵营", owner],
                ...(resource ? [["资源", resourceNames[resource]] as const] : []),
                ...(tile.building ? [["建筑", BUILDINGS[tile.building].name] as const] : []),
                ...(tile.road ? [["道路", "已修建"] as const] : []),
                ...(tile.ruin ? [["遗迹", "尚可探索"] as const] : []),
                ...(tile.lighthouse ? [["设施", "灯塔"] as const] : []),
              ]} />
            ) : <p>派单位探索后可查看地形。</p>}
          </div>
        </Modal>
      )}
    </>
  );
}
