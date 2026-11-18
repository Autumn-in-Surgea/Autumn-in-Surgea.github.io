import { Color, SRGBColorSpace } from "three";

// Glazed clay, painted timber and cut masonry carry more chroma than the terrain.
export const masonry = "#ebcfaa";
export const ivory = "#f5ead4";
export const brick = "#b65c42";
export const terracotta = "#b64432";
export const cobalt = "#395b91";
export const copper = "#267f8d";
export const ink = "#293748";
export const brass = "#e5b156";

export function architecturalEnamel(color: string) {
  const enamel = new Color(color);
  const { h, s, l } = enamel.getHSL({ h: 0, s: 0, l: 0 }, SRGBColorSpace);
  enamel.setHSL(h, Math.min(0.87, s * 1.47 + 0.055), Math.min(0.66, l + 0.045), SRGBColorSpace);
  return `#${enamel.getHexString()}`;
}
