import type { CityNameplateDetails } from "./cityNameplate";
import { clampProgress, easeInOut, easeOut } from "./motion";

export const labelBounceMs = 430;
export const cityMeterMotionMs = 510;

export function labelBounce(progress: number) {
  const t = clampProgress(progress);
  return Math.sin(Math.PI * easeOut(t)) * (1 - 0.4 * t);
}

export function sampleCityNameplate(from: CityNameplateDetails, to: CityNameplateDetails, progress: number): CityNameplateDetails {
  const t = clampProgress(progress);
  if (t === 1) return to;
  const easing = easeInOut(t);
  const levelUp = to.capacity > from.capacity;
  const fillingOldMeter = levelUp && t < 0.38;
  // A level-up first fills the old bar, then rolls into the new slots.
  const population = fillingOldMeter
    ? from.population + (from.capacity - from.population) * easeOut(t / 0.38)
    : levelUp
      ? to.population * easeOut((t - 0.38) / 0.62)
      : from.population + (to.population - from.population) * easing;
  return {
    population,
    units: from.units + (to.units - from.units) * easing,
    capacity: fillingOldMeter || (to.capacity < from.capacity && t < 0.5) ? from.capacity : to.capacity,
    income: Math.round(from.income + (to.income - from.income) * easeOut(t)),
  };
}
