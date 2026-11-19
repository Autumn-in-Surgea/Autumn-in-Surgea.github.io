import type { GameOptions } from "../game/types";
import { validateGameOptions } from "./save";

const historyKey = "four-shades-of-autumn.match-history.v1";
const historyLimit = 10;

export interface MatchHistoryEntry {
  startedAt: number;
  options: GameOptions;
}

export function readMatchHistory(): MatchHistoryEntry[] | undefined {
  try {
    const records: unknown = JSON.parse(localStorage.getItem(historyKey) ?? "[]");
    if (!Array.isArray(records)) return undefined;
    const history: MatchHistoryEntry[] = [];
    for (const entry of records) {
      if (!entry || typeof entry !== "object") continue;
      const { startedAt, options } = entry as Record<string, unknown>;
      if (typeof startedAt !== "number" || !Number.isSafeInteger(startedAt) ||
        startedAt < 0 || startedAt > 8_640_000_000_000_000) continue;
      try {
        validateGameOptions(options);
        history.push({ startedAt, options });
      } catch {
        continue;
      }
      if (history.length === historyLimit) break;
    }
    return history;
  } catch {
    return undefined;
  }
}

export function addMatchHistory(options: GameOptions, history: readonly MatchHistoryEntry[]) {
  return [{ startedAt: Date.now(), options: structuredClone(options) }, ...history].slice(0, historyLimit);
}

export function persistMatchHistory(history: readonly MatchHistoryEntry[]): boolean {
  try {
    localStorage.setItem(historyKey, JSON.stringify(history));
    return true;
  } catch {
    return false;
  }
}
