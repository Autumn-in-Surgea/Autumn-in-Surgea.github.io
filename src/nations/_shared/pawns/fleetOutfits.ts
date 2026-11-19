import { Miniature } from "../../../scene/miniature";

export type Point = [number, number, number];
export type DeckFittings = { body: Miniature; enamel: Miniature };

interface FlagPanel {
  // Points span the hoist (u=0) to fly (u=1) and head (v=0) to foot (v=1).
  cut: [number, number][];
  paint?: string;
}

export interface FleetArt {
  paint: { hull: string; roof: string; sail: string };
  deck: (fittings: DeckFittings) => void;
  ensign: FlagPanel[];
}

export const brass = "#cfac70";
export const glass = "#263f49";
export const white = "#ffffff";

export function doubleFace(sculpt: Miniature, paint: string, corners: Point[]) {
  sculpt.face(paint, corners);
  sculpt.face(paint, [...corners].reverse());
}

// Fit the same navy's wheelhouse or steering platform to the available deck.
export function deckStation(art: FleetArt): DeckFittings {
  const fittings = { body: new Miniature(), enamel: new Miniature() };
  art.deck(fittings);
  return fittings;
}

// The two sides share a folded surface; unpainted panels take the owner color.
export function ensign(art: FleetArt): DeckFittings {
  const body = new Miniature();
  const enamel = new Miniature();
  for (const { cut, paint } of art.ensign) {
    const corners: Point[] = cut.map(([u,v]) => [
      u * .33 + Math.sin(u * Math.PI * 1.6) * .075, -.16 * u - v, u,
    ]);
    doubleFace(paint ? body : enamel, paint ?? white, corners);
  }
  return { body, enamel };
}
