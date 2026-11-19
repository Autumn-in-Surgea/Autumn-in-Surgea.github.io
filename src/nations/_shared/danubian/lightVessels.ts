import type { Miniature } from "../../../scene/miniature";

type Sculpture = { body: Miniature; enamel: Miniature };
type Point = [number, number, number];
type Station = readonly [z: number, halfBeam: number, sheer: number];
type Paint = { keel: string; chine: string; hull: string; deck: string };

const teak = "#b79264";
const umber = "#604031";
const brass = "#d0aa68";
const enamel = "#ffffff";
const steel = "#6a8390";
const darkSteel = "#34454d";

const caravelStations: readonly Station[] = [
  [-.366, 0, .036], [-.298, .047, .025], [-.210, .078, .014],
  [-.096, .104, .005], [.059, .107, 0], [.206, .097, .010],
  [.300, .074, .024], [.352, .056, .036],
];
const launchStations: readonly Station[] = [
  [-.233, 0, .024], [-.190, .020, .016], [-.136, .038, .010],
  [-.061, .053, .003], [.037, .056, 0], [.139, .055, .003],
  [.201, .047, .008], [.220, .040, .009],
];
const timberPaint = { keel: "#78442d", chine: "#8e6247", hull: umber, deck: teak };
const launchPaint = { keel: "#513f37", chine: "#3c5056", hull: darkSteel, deck: "#829398" };

function hull(sculpt: Sculpture, x: number, z: number, deck: number,
  stations: readonly Station[], paint: Paint) {
  function ring(horizontal: number, length: number, y: number, sheer: number) {
    const starboard = stations.map(([at, beam, rise]): Point =>
      [x + beam * horizontal, y + rise * sheer, z + at * length]);
    const port = starboard.slice(1).reverse().map(([side, height, at]): Point =>
      [2 * x - side, height, at]);
    return [...starboard, ...port];
  }
  function band(mesh: Miniature, color: string, lower: Point[], upper: Point[]) {
    for (const [index, point] of lower.entries()) {
      const next = (index + 1) % lower.length;
      mesh.face(color, [point, upper[index], upper[next]]);
      mesh.face(color, [point, upper[next], lower[next]]);
    }
  }
  const keel = ring(.57, .88, .014, .18);
  const chine = ring(.98, .98, deck * .49, .37);
  const shoulder = ring(1, 1, deck * .82, .83);
  const rim = ring(.95, 1, deck, 1);
  band(sculpt.body, paint.keel, keel, chine);
  band(sculpt.body, paint.chine, chine, shoulder);
  band(sculpt.enamel, enamel, shoulder, rim);
  sculpt.body.face(paint.hull, keel);
  for (const [index, point] of rim.entries())
    sculpt.body.face(paint.deck, [[x, deck, z], rim[(index + 1) % rim.length], point]);
}

export function foldedPennant(mesh: Miniature, mast: Point, end: Point, topToHem = .033) {
  const [x, y, z] = mast;
  const hem: Point = [x, y - topToHem, z];
  const fold: Point = [x + (end[0] - x) * .5 + .013, y - topToHem * .38, (z + end[2]) / 2];
  for (const facet of [[hem, mast, fold], [hem, fold, end], [fold, mast, end]]) {
    mesh.face(enamel, facet);
    mesh.face(enamel, facet.reverse());
  }
}

function lateenRig(sculpt: Sculpture, z: number, deck: number, top: number, scale: number) {
  const { body } = sculpt;
  const mast: Point = [0, top, z];
  const forward: Point = [-.038 * scale, top - .142 * scale, z - .174 * scale];
  const peak: Point = [.046 * scale, top - .039 * scale, z + .103 * scale];
  const clew: Point = [.123 * scale, top - .300 * scale, z + .105 * scale];
  const billow: Point = [.096 * scale, top - .160 * scale, z + .013 * scale];
  body.beam(umber, [0, deck, z], mast, .019 * scale);
  body.beam(teak, forward, peak, .012 * scale);
  body.beam(brass, [0, top - .082 * scale, z], [0, top - .135 * scale, z], .022 * scale);
  const edge: Point[] = [forward, peak, clew,
    [.065 * scale, top - .251 * scale, z + .038 * scale]];
  const cloth = ["#f1e2c0", "#e3cb9f", "#faf1d9", "#e7d6b0"];
  for (const [index, point] of edge.entries()) {
    const face = [point, edge[(index + 1) % edge.length], billow];
    body.face(cloth[index], face);
    body.face(cloth[index], face.reverse());
  }
  body.beam("#b69972", clew, [0, deck + .024, z + .125 * scale], .006);
  foldedPennant(sculpt.enamel, mast, [.014 * scale, top - .016 * scale, z + .094 * scale]);
}

function caravel(sculpt: Sculpture) {
  const { body } = sculpt;
  const deck = .132;
  hull(sculpt, 0, 0, deck, caravelStations, timberPaint);

  // Low foredeck and a glazed stern gallery anchor the rig to its hull.
  body.part("bevel", umber, 0, .176, -.247, .094, .026, .072);
  body.part("bevel", umber, 0, .182, .259, .139, .080, .135);
  for (const side of [-1, 1]) {
    const roof: Point[] = [[0, .253, .196], [side * .073, .226, .190], [side * .068, .228, .326], [0, .259, .329]];
    body.face(side > 0 ? teak : brass, side < 0 ? roof : roof.reverse());
  }
  body.box(brass, 0, .192, .325, .110, .038, .010);
  for (const x of [-.033, 0, .033])
    body.box("#2f454e", x, .193, .332, .018, .023, .007);
  body.part("bevel", "#9f744b", 0, .149, .005, .063, .027, .078);

  for (const side of [-1, 1]) {
    body.beam(umber, [side * .100, .152, -.08], [side * .098, .160, .171], .015);
    body.beam(umber, [side * .068, .257, .195], [side * .053, .257, .316], .013);
    for (const z of [.211, .286])
      body.beam(brass, [side * .062, .235, z], [side * .062, .263, z], .010);
    body.beam("#b3946b", [side * .091, .140, -.078], [0, .383, -.118], .006);
  }
  body.beam(teak, [0, .170, -.292], [0, .251, -.458], .018);
  body.beam(umber, [0, .115, -.327], [0, .239, -.433], .009);
  lateenRig(sculpt, -.123, deck, .616, 1);
  lateenRig(sculpt, .164, deck, .514, .81);
}

function torpedoLaunch(sculpt: Sculpture, x: number, z: number) {
  const { body } = sculpt;
  const deck = .067;
  hull(sculpt, x, z, deck, launchStations, launchPaint);
  body.part("hip", steel, x, .094, z - .044, .063, .052, .102);
  const bridgeTip: Point = [x, .137, z - .069];
  for (const side of [-1, 1]) {
    const facet: Point[] = [[x + side * .030, .113, z - .092], [x + side * .033, .113, z - .011],
      [x, .132, z - .016], bridgeTip];
    body.face(side > 0 ? "#9cb0ae" : "#bcc8c5", side < 0 ? facet : facet.reverse());
  }
  body.box("#253840", x, .111, z - .093, .047, .019, .010);
  body.part("bevel", brass, x, .089, z - .152, .033, .018, .045);
  body.part("octagon", darkSteel, x, .111, z + .037, .034, .085, .040, -.14);
  body.part("octagon", "#212c32", x, .154, z + .030, .035, .013, .043, -.14);
  body.beam(steel, [x, .123, z - .059], [x, .196, z - .051], .008);
  foldedPennant(sculpt.enamel, [x, .195, z - .051], [x + .004, .180, z + .004]);

  // Slender deck tubes read at game scale as part of the period silhouette.
  for (const side of [-1, 1]) {
    const lateral = x + side * .035;
    body.part("octagon", "#4c5d62", lateral, .083, z + .100, .022, .125, .024, Math.PI / 2);
    body.part("octagon", brass, lateral, .083, z + .041, .026, .013, .025, Math.PI / 2);
    body.beam(steel, [x + side * .043, .085, z + .126], [x + side * .037, .093, z + .195], .007);
  }
  body.part("bevel", "#a8b8ac", x, .092, z + .177, .043, .026, .036);
}

export function carveLightVessel(sculpt: Sculpture, type: "scout" | "rammer") {
  if (type === "scout") {
    caravel(sculpt);
    return;
  }
  torpedoLaunch(sculpt, 0, -.160);
  torpedoLaunch(sculpt, -.184, .144);
  torpedoLaunch(sculpt, .184, .144);
}
