import { glass, white, type FleetArt } from "../_shared/pawns/fleetOutfits";

const paint = { hull: "#465f70", roof: "#a6bbc1", sail: "#91aeb8" };

export const fleet = {
  paint,
  deck({ body, enamel }) {
    const { hull, roof } = paint;
    // A bridge with cantilevered shoulders and a transverse survey beam.
    body.part("bevel", hull, 0, .035, 0, .144, .071, .112);
    body.part("hip", glass, 0, .083, -.008, .180, .049, .119, Math.PI);
    enamel.part("bevel", white, 0, .111, -.008, .188, .018, .123);
    body.part("bevel", roof, 0, .133, 0, .077, .033, .069);
    body.beam(hull, [-.091, .159, -.002], [.090, .159, -.002], .026);
    for (const side of [-1, 1])
      body.part("bevel", roof, side * .093, .160, -.002, .033, .047, .045);
  },
  ensign: [
    { cut: [[0,0],[.56,0],[.56,.96],[0,.96]] },
    { cut: [[.56,0],[.95,.02],[.95,.57],[.56,.96]] },
  ],
} satisfies FleetArt;
