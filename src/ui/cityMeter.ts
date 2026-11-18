export const cityMeterColors = {
  population: "#d9b453",
  units: "#6ec9b3",
  empty: "#799aad",
  track: "#102331",
  deficit: "#e28c74",
} as const;

export function cityMeter(population: number, units: number, capacity: number) {
  // Imported saves can contain levels well beyond the map's population limits.
  const slots = Math.min(128, capacity);
  return {
    cells: Array.from({ length: slots }, (_, index) => ({
      fill: Math.max(0, Math.min(1, population - index)),
      unit: Number(index < units),
    })),
    deficit: Math.min(0, population),
  };
}
