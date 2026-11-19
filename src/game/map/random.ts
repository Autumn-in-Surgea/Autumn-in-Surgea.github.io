export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
export function seededRandom(seed: string): () => number {
  let value = hashSeed(seed);
  return () => {
    value += 0x6d2b79f5;
    let n = Math.imul(value ^ (value >>> 15), value | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (n: number) => n * n * (3 - 2 * n);
/** Continuous seeded value noise for fixed maps and procedural geography. */
export function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    u = smooth(x - xi),
    v = smooth(y - yi);
  const corner = (a: number, b: number) => {
    let h = Math.imul(a ^ seed, 374761393) ^ Math.imul(b + seed, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const a = corner(xi, yi),
    b = corner(xi + 1, yi),
    c = corner(xi, yi + 1),
    d = corner(xi + 1, yi + 1);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
