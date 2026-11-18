import type { Player } from "../game/types";
import { nation as imperia } from "./imperia";
import { nation as determia } from "./determia";
import { nation as nosta } from "./nosta";
import { nation as ida } from "./ida";
import { nation as rina } from "./rina";
import { DEFAULT_TERRAIN_VARIANT, type NationPack } from "./types";

const registered = [imperia, determia, nosta, ida, rina] as const;
export type NationId = typeof registered[number]["id"];
type RegisteredNation = NationPack & { id: NationId; terrainVariant: NationId };
export const NATIONS: readonly RegisteredNation[] = registered;

export { NATIONS as CIVILIZATIONS };
export { DEFAULT_TERRAIN_VARIANT };
export type { ModelSetId } from "./models";
export type { NationPack, NationOpening } from "./types";

const neutral = { id: "neutral", modelSet: "danubian", terrainVariant: DEFAULT_TERRAIN_VARIANT } as const;
export type FactionPack = RegisteredNation | typeof neutral;
const byId: ReadonlyMap<string, RegisteredNation> = new Map(NATIONS.map(nation => [nation.id, nation]));

export function getNation(id: string) {
  return byId.get(id);
}

export function getFactionPack(id: string): FactionPack {
  return getNation(id) ?? neutral;
}

export function factionForOwner(players: ReadonlyArray<Pick<Player, "civilization">>, owner: number | null) {
  return owner === null ? neutral : getFactionPack(players[owner]?.civilization ?? "neutral");
}
