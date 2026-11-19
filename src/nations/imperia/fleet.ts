import { brass, glass, white, type FleetArt } from "../_shared/pawns/fleetOutfits";

const paint = { hull: "#665248", roof: "#b27e56", sail: "#c58d6a" };

export const fleet = {
  paint,
  deck({ body, enamel }) {
    const { hull, roof } = paint;
    // Copper clerestory over the three lights of a dispatch cabin.
    body.part("bevel", hull, 0, .040, 0, .163, .080, .119);
    body.part("bevel", glass, 0, .078, 0, .168, .042, .123);
    for (const side of [-1, 1]) {
      body.box(brass, side * .033, .079, -.062, .009, .039, .008);
      body.box(brass, side * .033, .079, .062, .009, .039, .008);
    }
    body.part("hip", roof, 0, .108, 0, .218, .043, .158);
    body.part("bevel", glass, 0, .133, 0, .090, .020, .071);
    enamel.part("hip", white, 0, .150, 0, .109, .023, .086);
  },
  ensign: [
    { cut: [[0,0],[.56,0],[.56,1],[0,1]] },
    { cut: [[.56,0],[.65,0],[.65,1],[.56,1]], paint: "#eedab0" },
    { cut: [[.65,0],[1,.03],[1,.99],[.65,1]] },
  ],
} satisfies FleetArt;
