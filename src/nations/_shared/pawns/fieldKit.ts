import { Miniature } from "../../../scene/miniature";
import type { UnitType } from "../../../game/types";

type Point = [number, number, number];
const leather = "#5c4135", iron = "#434f53", brass = "#bd9a62";

/** Small articles not part of the shared showpiece. Coordinates are in the pawn's +Z-facing frame. */
function infantryKnife(kit: Miniature) {
  // The thumb closes on the grip; the bright central ridge splits the two blade faces.
  kit.beam(leather, [.339,.67,.105],[.514,.899,.169], .076,.077);
  kit.beam(brass, [.438,.895,.106],[.591,.914,.207], .033,.032);
  const heel: Point = [.446,.932,.161], back: Point = [.594,.877,.139];
  const shoulder: Point = [.532,1.291,.299], belly: Point = [.709,1.211,.266];
  const mid: Point = [.627,1.255,.344], ridge: Point = [.523,.904,.218];
  const tip: Point = [.766,1.492,.382];
  kit.face("#d9e3dd", [heel, ridge, mid, shoulder]);
  kit.face("#92abba", [ridge, back, belly, mid]);
  kit.face("#f0eed6", [shoulder, mid, tip]);
  kit.face("#aec4c4", [mid, belly, tip]);
  kit.face("#788d96", [back, heel, shoulder, tip, belly]);
  // A waxed dispatch pouch and the field knife distinguish the underground operative.
  kit.part("bevel", "#70583e", -.194,.466,.149,.245,.177,.120,0,-.40,-.09);
  kit.part("bevel", "#b18b5e", -.191,.513,.205,.225,.072,.040,0,-.40,-.09);
}

function cuirass(kit: Miniature) {
  const collar: Point = [0,.824,.271], ridge: Point = [0,.667,.295], lower: Point = [0,.521,.271];
  for (const sign of [-1,1]) {
    const upper: Point = [sign*.191,.802,.179];
    const side: Point = [sign*.194,.664,.117];
    const waist: Point = [sign*.146,.548,.191];
    for (const [color, points] of [
      ["#cdd9d5", [collar, upper, ridge]], ["#91a5af", [upper, side, ridge]],
      ["#aebdc1", [ridge, side, waist]], ["#657e89", [ridge, waist, lower]],
    ] as [string, Point[]][]) {
      kit.face(color, sign < 0 ? points : points.reverse());
    }
    kit.beam(brass, lower, waist, .017,.019);
  }
}

function ammunition(kit: Miniature) {
  // An inert brass round carried at the breech gives the crew a loading pose.
  kit.part("drum", "#bf9956", .300,.740,.260,.138,.429,.138, -.49,0,-.48);
  kit.part("crystal", "#485b56", .399,.887,.181,.133,.192,.133, -.49,0,-.48);
  kit.part("drum", "#d7b572", .210,.579,.349,.158,.032,.158, -.49,0,-.48);
}

export function additionalKit(type: UnitType) {
  const kit = new Miniature();
  switch (type) {
    case "warrior":
      // Militia carry their short bayonet sheathed; assault infantry fix theirs.
      kit.beam(leather, [-.174,.350,.235],[-.280,.634,.173],.073,.067);
      kit.beam(iron, [-.278,.628,.170],[-.301,.704,.160],.056,.051);
      kit.beam(brass,[-.31,.622,.159],[-.247,.639,.182],.019);
      break;
    case "dagger": infantryKnife(kit); break;
    case "knight": cuirass(kit); break;
    case "catapult": ammunition(kit); break;
    default: return null;
  }
  return kit.finish();
}

/** Mounted equipment lives in the horse's board frame, where the muzzle faces -Z. */
export function horseTack(knight: boolean) {
  const kit = new Miniature();
  for (const sign of [-1,1]) {
    kit.part("bevel", knight ? "#495264" : "#756653", sign*.092,.405,.060,.057,.110,.085,-.19);
    kit.part("bevel", leather, sign*.108,.342,.035,.052,.098,.068,-.14);
    kit.part("bevel", "#413832", sign*.110,.298,.005,.054,.041,.095);
    kit.beam(brass,[sign*.131,.287,.004],[sign*.131,.289,.059],.011);
    kit.beam(leather,[sign*.118,.412,.048],[sign*.130,.291,.058],.011);
    kit.beam(leather,[sign*.074,.527,-.267],[sign*.087,.512,-.012],.011);
    if (knight) {
      const front: Point = [0,.417,-.230];
      const quarter: Point = [sign*.099,.407,-.147];
      const waist: Point = [sign*.088,.328,-.154];
      const end: Point = [0,.319,-.216];
      kit.face("#a7bcc1", sign < 0 ? [front,quarter,waist,end] : [end,waist,quarter,front]);
      kit.beam(brass,waist,end,.012);
    } else {
      kit.part("bevel", "#906b4c",sign*.105,.367,.157,.065,.096,.093,.05);
      kit.part("bevel", "#b28b5f",sign*.134,.392,.155,.019,.034,.096,.05);
    }
  }
  if (!knight) kit.part("drum", "#aaa085",0,.428,.184,.069,.192,.073,0,0,Math.PI/2);
  return kit.finish();
}
