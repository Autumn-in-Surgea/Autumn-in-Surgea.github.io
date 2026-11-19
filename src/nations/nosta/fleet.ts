import { brass, glass, white, type FleetArt } from "../_shared/pawns/fleetOutfits";

const paint = { hull: "#635039", roof: "#b68e51", sail: "#ceac69" };

export const fleet = {
  paint,
  deck({ body, enamel }) {
    const { hull, roof } = paint;
    // Timber gallery with a pitched glazed roof and a gilded ridge cap.
    body.part("bevel", hull, 0, .040, .005, .173, .082, .136);
    body.part("bevel", glass, 0, .085, .005, .177, .050, .135);
    for (const side of [-1, 1]) {
      body.box(brass, side * .088, .085, .005, .010, .052, .014);
      body.box(brass, side * .043, .085, .073, .011, .051, .008);
    }
    body.part("hip", roof, 0, .125, .007, .211, .068, .160);
    enamel.box(white, 0, .158, .007, .119, .017, .062);
    body.box(brass, 0, .173, .007, .093, .017, .036);
  },
  ensign: [
    { cut: [[0,0],[.61,0],[.61,1],[0,1]] },
    { cut: [[.61,0],[1.03,.03],[.61,.49]] },
    { cut: [[.61,.49],[1.03,.98],[.61,1]] },
  ],
} satisfies FleetArt;
