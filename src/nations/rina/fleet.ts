import { brass, white, type FleetArt } from "../_shared/pawns/fleetOutfits";

const paint = { hull: "#365b5d", roof: "#66958b", sail: "#77aa9a" };

export const fleet = {
  paint,
  deck({ body, enamel }) {
    const { hull, roof } = paint;
    // An open chart table between two swept davits and a hanging survey reel.
    body.part("bevel", hull, 0, .025, 0, .153, .050, .120);
    body.part("bevel", roof, 0, .056, -.007, .137, .020, .097, -.12);
    for (const side of [-1, 1]) {
      body.beam(hull, [side * .082, .011, .046], [side * .109, .140, .002], .024);
      body.beam(roof, [side * .109, .140, .002], [side * .092, .160, -.065], .022);
      body.beam(brass, [side * .092, .160, -.065], [side * .092, .094, -.064], .008);
    }
    body.beam(brass, [-.106, .141, .002], [.106, .141, .002], .019);
    enamel.part("drum", white, 0, .099, -.063, .063, .154, .063, 0, 0, Math.PI / 2);
  },
  ensign: [
    { cut: [[0,0],[.22,.018],[.22,.858],[0,1]], paint: "#e6dfb7" },
    { cut: [[.22,.018],[1.21,.19],[.22,.858]] },
  ],
} satisfies FleetArt;
