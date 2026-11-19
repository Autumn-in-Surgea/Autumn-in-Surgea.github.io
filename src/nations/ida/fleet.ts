import { brass, white, doubleFace, type Point, type FleetArt } from "../_shared/pawns/fleetOutfits";

const paint = { hull: "#704d57", roof: "#b9676b", sail: "#c77778" };

export const fleet = {
  paint,
  deck({ body, enamel }) {
    const { hull, roof } = paint;
    // Four posts support a light awning with an asymmetric, wind-lifted hem.
    body.box(hull, 0, .011, 0, .164, .022, .115);
    for (const x of [-.072, .072])
      for (const z of [-.048, .048])
        body.beam(brass, [x, .014, z], [x, x > 0 ? .123 : .096, z], .015);
    const left: Point = [-.102, .088, -.079];
    const leftBack: Point = [-.102, .088, .078];
    const right: Point = [.110, .121, -.072];
    const rightBack: Point = [.100, .130, .085];
    const crest: Point = [.012, .149, -.079];
    const crestBack: Point = [.012, .146, .084];
    doubleFace(enamel, white, [left, crest, crestBack, leftBack]);
    doubleFace(body, roof, [crest, right, rightBack, crestBack]);
    body.part("bevel", hull, 0, .043, .019, .102, .064, .053);
  },
  ensign: [
    { cut: [[0,0],[.36,-.08],[.36,.96],[0,1]] },
    { cut: [[.36,-.08],[1.16,-.25],[.36,.44]] },
    { cut: [[.36,.50],[.88,1.04],[.36,.96]] },
  ],
} satisfies FleetArt;
