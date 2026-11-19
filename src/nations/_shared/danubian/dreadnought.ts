import type { Miniature } from "../../../scene/miniature";
import { foldedPennant } from "./lightVessels";

const armoredPlate = "#536677";
const darkArmor = "#303f50";
const turretRoof = "#97a6aa";
const glazedDeck = "#be9e70";
const brass = "#cfac68";
const glass = "#182c3a";
const enamelWhite = "#ffffff";
type Point = [number, number, number];

function armoredTurret(body: Miniature, z: number, foot: number, heading: number) {
  const direction = Math.cos(heading);
  body.part("drum", darkArmor, 0, foot + .016, z, .156, .035, .142);
  body.part("bevel", armoredPlate, 0, foot + .051, z, .145, .052, .128, 0, heading);
  const lid: Point[] = [[-.045, foot + .075, z - .053], [-.064, foot + .075, z - .027],
    [-.064, foot + .075, z + .030], [-.041, foot + .075, z + .053],
    [.041, foot + .075, z + .053], [.064, foot + .075, z + .030],
    [.064, foot + .075, z - .027], [.045, foot + .075, z - .053]];
  const ridge: Point = [0, foot + .099, z + direction * .008];
  for (let i = 0; i < lid.length; i++)
    body.face(i < 4 ? turretRoof : "#a9b6b7", [lid[i], lid[(i + 1) % lid.length], ridge]);
  for (const x of [-.032, .032]) {
    body.beam(darkArmor, [x, foot + .058, z + direction * .052],
      [x, foot + .073, z + direction * .140], .030);
    body.beam(turretRoof, [x, foot + .066, z + direction * .105],
      [x, foot + .074, z + direction * .148], .019);
  }
}

function armoredUptake(body: Miniature, foot: number, z: number, height: number) {
  body.part("bevel", darkArmor, 0, foot + .011, z, .102, .024, .096);
  body.part("drum", armoredPlate, 0, foot + height * .5, z, .073, height, .069);
  body.part("drum", brass, 0, foot + height - .026, z, .079, .015, .075);
  body.part("octagon", darkArmor, 0, foot + height - .007, z, .090, .019, .090);
  body.part("octagon", glass, 0, foot + height + .004, z, .062, .005, .061);
}

/** An armored flagship with staggered main batteries and a forward director. */
export function carveDreadnoughtDeck(
  { body, enamel }: { body: Miniature; enamel: Miniature },
  deck: number,
  width: number,
) {
  // A raised forward battery steps down towards a separate aft gun platform.
  body.part("bevel", darkArmor, 0, deck + .028, -.122, width * .88, .064, .336);
  body.part("bevel", glazedDeck, 0, deck + .062, -.122, width * .86, .012, .331);
  body.part("bevel", armoredPlate, 0, deck + .024, .167, width * .57, .052, .230);
  body.part("bevel", glazedDeck, 0, deck + .053, .167, width * .55, .013, .222);
  armoredTurret(body, -.326, deck + .004, Math.PI);
  armoredTurret(body, -.204, deck + .068, Math.PI);
  armoredTurret(body, .328, deck + .005, 0);

  // A broad, angular bridge with a recessed dark window band and bright brow.
  const bridge = -.087;
  body.part("bevel", armoredPlate, 0, deck + .123, bridge, width * .57, .111, .131);
  body.part("bevel", darkArmor, 0, deck + .187, bridge, width * .74, .032, .119);
  body.part("bevel", turretRoof, 0, deck + .216, bridge, width * .55, .028, .087);
  enamel.box(enamelWhite, 0, deck + .212, bridge - .048, width * .48, .015, .014);
  for (const aperture of [-1, 0, 1])
    body.box(glass, aperture * .057, deck + .187, bridge - .061, .037, .018, .013);

  armoredUptake(body, deck + .070, .033, .228);
  armoredUptake(body, deck + .060, .153, .211);
  for (const side of [-1, 1]) {
    const wing = side * width * .344;
    // Round wing mounts and facing shields distinguish the middle deck in plan.
    body.part("octagon", darkArmor, wing, deck + .022, .025, .083, .041, .102);
    body.part("octagon", turretRoof, wing, deck + .049, .025, .065, .027, .080);
    body.beam(darkArmor, [wing, deck + .050, .012],
      [side * width * .45, deck + .062, -.024], .018);
    body.part("bevel", turretRoof, side * width * .305, deck + .033, .160, .062, .042, .116);
    body.part("bevel", glazedDeck, side * width * .305, deck + .055, .160, .048, .009, .096);
    enamel.part("bevel", enamelWhite, side * width * .439, deck + .019, -.268, .013, .025, .101);
  }

  // The open tripod leaves a legible silhouette above the two capped funnels.
  const director = deck + .442;
  body.beam(darkArmor, [0, deck + .205, -.142], [0, director, -.120], .022);
  for (const side of [-1, 1])
    body.beam(armoredPlate, [side * width * .285, deck + .094, -.010], [0, director, -.120], .021);
  body.part("octagon", turretRoof, 0, director - .004, -.120, .101, .035, .080);
  body.part("octagon", darkArmor, 0, director + .017, -.120, .075, .016, .057);
  body.beam(brass, [0, director + .014, -.120], [0, director + .066, -.120], .013);
  foldedPennant(enamel, [0, director + .064, -.120], [.081, director + .044, -.107], .046);
  body.beam(armoredPlate, [0, deck + .061, .239], [0, deck + .263, .269], .016);
  body.box(turretRoof, 0, deck + .216, .264, .114, .012, .012);
  for (const side of [-1, 1])
    body.beam(brass, [side * width * .346, deck + .062, .095], [0, deck + .216, .264], .006);
}
