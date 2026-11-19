import type { BuildingId } from "../../../game/types";
import type { BuildingVisualTier as Tier } from "../../../scene/buildingVisualTier";
import { oreVein, standingWheat } from "../../../scene/landscape";
import { Miniature } from "../../../scene/miniature";
import { crate, rural } from "./ruralKit";

type Point = [number, number, number];

function log(m: Miniature, x: number, y: number, z: number, length: number, width: number) {
  // The pale end grain faces the board camera, even when the pile is just a few pixels wide.
  m.part("octagon", rural.timber, x, y, z, width, length, width, Math.PI / 2);
  m.part("octagon", rural.endgrain, x, y, z + length / 2 + .001, width * .82, .004, width * .82, Math.PI / 2);
}

// A panel roof with a ridge parallel to X. Tops, folded eaves and gables
// read at the normal board angle without drawing joints on every board.
function pitchedRoof(m: Miniature, x: number, z: number, w: number, d: number, eave: number, rise: number, color: string) {
  const slope = Math.atan2(rise, d / 2);
  for (const side of [-1, 1]) {
    m.box(color, x, eave + rise / 2, z + side * d / 4, w, .014, Math.hypot(d / 2, rise) + .009, side * slope);
    m.box(rural.timber, x, eave - .007, z + side * d / 2, w, .014, .014);
  }
  m.box(rural.slate, x, eave + rise + .008, z, w + .008, .013, .018);
}

function leanTo(m: Miniature, x: number, back: number, front: number, w: number, eave: number, cover: string) {
  const length = front - back, rise = length * .23, z = (front + back) / 2;
  for (const side of [-1, 1]) {
    const edge = x + side * (w / 2 - .010);
    m.box(rural.timber, edge, eave / 2, front - .014, .015, eave, .018);
    m.beam(rural.board, [edge, eave - .047, front - .014], [edge, eave + .002, front - .055], .011);
  }
  m.box(rural.timber, x, eave - .002, front - .013, w, .015, .021);
  m.box(cover, x, eave + rise / 2 + .007, z, w + .018, .014, Math.hypot(length, rise) + .023,
    Math.atan2(rise, length));
}

function flywheel(m: Miniature, x: number, y: number, z: number, r: number) {
  for (let i = 0; i < 8; i++) {
    const a = Math.PI * i / 4, b = Math.PI * (i + 1) / 4;
    const rim: Point = [x + r * Math.cos(a), y + r * Math.sin(a), z];
    m.beam(rural.iron, rim, [x + r * Math.cos(b), y + r * Math.sin(b), z], .013, .017);
    if (i % 2 === 0) m.beam(rural.board, [x, y, z], rim, .010);
  }
  m.part("octagon", rural.brass, x, y, z + .004, r * .40, .024, r * .40, Math.PI / 2);
}

// One closed service bay and one open loading bay, readable from both exposed
// facades. The through bay keeps the feed path or access apron visible.
function frameHall(m: Miniature, x: number, z: number, w: number, d: number, h: number, roof: string, stucco = false, sawLights?: Tier) {
  const wall = stucco ? rural.plaster : rural.board, front = z + d / 2;
  m.box(wall, x, h * .49, z - d / 2 + .009, w, h * .98, .018);
  m.box(wall, x - w * .34, h / 2, z, w * .31, h, d);
  m.box(rural.shade, x - w * .32, h * .55, front + .002, w * .17, h * .33, .009);
  m.box(rural.endgrain, x - w * .32, h * .37, front + .007, w * .20, .012, .012);
  for (const xStep of [-.49, -.16, .18, .49]) {
    const post = x + w * xStep;
    m.box(rural.timber, post, h / 2, front, .015, h, .021);
    m.box(rural.timber, post, h / 2, z - d / 2, .015, h, .019);
  }
  for (const rz of [front, z - d / 2]) {
    m.box(rural.timber, x, h - .009, rz, w + .018, .019, .025);
    m.beam(rural.board, [x + w * .18, h - .055, rz], [x + w * .33, h - .012, rz], .012);
  }
  const end = x + w / 2;
  m.box(wall, end - .005, .020, z, .022, .039, d);
  m.beam(rural.timber, [end, .031, z - d * .43], [end, h - .012, z + d * .43], .012);
  if (sawLights) {
    // Widen the saw hall from one working bay to a three-span northlight
    // factory. Each rear truss rises above the one in front of it.
    const bay = (d + .034) / sawLights, rise = .029 + .018 * sawLights;
    for (let i = 0; i < sawLights; i++) {
      const back = z - d / 2 - .017 + i * bay, edge = back + bay;
      const step = (sawLights - i - 1) * .024, eave = h + step;
      m.box(roof, x, eave + rise / 2 + .006, back + bay / 2,
        w + .039, .018, Math.hypot(bay,rise), -Math.atan2(rise, bay));
      m.box("#8da5a0", x, eave + rise / 2, edge, w + .022, rise - .006, .011);
      m.box(rural.timber, x, eave + rise, edge, w + .039, .012, .020);
      if (step) {
        m.box(rural.board,x,eave - step / 2,edge - .008,w,step,.016);
        m.box(rural.timber,x,eave - .001,edge,w + .026,.011,.017);
      }
      for (const offset of [-.43,-.15,.15,.43]) {
        m.box(rural.board, x + w * offset,eave + rise / 2,edge + .006,.012,rise,.009);
      }
      for (const side of [-1, 1]) {
        const end = x + side * w / 2;
        const clerestory: Point[] = [[end,h,back],[end,eave,back],[end,eave + rise,edge],[end,h,edge]];
        const endWall = step ? clerestory : [clerestory[0],clerestory[2],clerestory[3]];
        m.face(rural.board, side > 0 ? endWall : [...endWall].reverse());
      }
    }
  } else {
    pitchedRoof(m, x, z, w + .039, d + .037, h + .002, d * .25, roof);
  }
}

function roofVent(m: Miniature, x: number, z: number, y: number, w: number) {
  m.box(rural.shade, x, y + .017, z, w, .042, .043);
  for (const dx of [-.36, 0, .36]) m.box(rural.board, x + w * dx, y + .017, z + .021, .010, .041, .009);
  m.box(rural.slate, x, y + .042, z, w + .028, .016, .069);
}

function cropRow(m: Miniature, x: number, back: number, front: number) {
  const width = .065, left = x - width / 2, right = x + width / 2;
  m.face("#9b7952", [[left, 0, front], [right, 0, front], [x, .018, front - .028]]);
  m.face("#a28055", [[left, 0, back], [left, 0, front], [x, .018, front - .028], [x, .018, back + .028]]);
  m.face("#96734e", [[right, 0, front], [right, 0, back], [x, .018, back + .028], [x, .018, front - .028]]);
  m.face("#a28055", [[right, 0, back], [left, 0, back], [x, .018, back + .028]]);
}
function stook(m: Miniature, x: number, z: number, h: number) {
  m.part("hip", rural.reed, x, h * .42, z, h * .84, h * .84, h * .76);
  m.part("octagon", rural.timber, x, h * .54, z, h * .50, .011, h * .45);
  m.part("gem", "#b59861", x, h * .83, z, h * .42, h * .34, h * .37);
}

export function farm(m: Miniature, enamel: string, tier: Tier, includeNativeStock = true) {
  for (const x of [-.28, -.14, -.01, .13]) cropRow(m, x, -.267, .269);
  // The farm encloses the original four mature stands. Stubble and sheaves
  // mark the two cut strips, then a winnower grades the harvest along the headland.
  if (includeNativeStock) standingWheat(m);
  for (const x of [-.28, -.01]) {
    for (const z of [-.195, -.095, .002, .098, .198]) {
      m.part("hip", "#af9763", x, .031, z, .034, .039, .054);
      m.box(rural.reed, x + .018, .020, z + .023, .019, .031, .020, .19, 0, -.23);
    }
  }
  const x = .286, z = .174, drum = .120;
  const packHeight = .132 + .015 * tier;
  frameHall(m, x, -.003, .179, .203, packHeight, rural.slate);
  leanTo(m, x, .075, .125, .162, packHeight * .8, rural.board);
  m.box(rural.board, x + .030, .034, .067, .086, .033, .084);
  for (const side of [-1, 1]) {
    m.box(rural.timber, x + side * .043, drum / 2, z, .021, drum, .126);
  }
  m.part("drum", rural.board, x, drum, z, .115, .125, .115, Math.PI / 2);
  m.box(rural.timber, x, .150, z - .034, .145, .033, .090);
  m.part("hip", rural.clay, x, .172, z - .041, .115, .044, .075, Math.PI);
  m.box(rural.shade, x, .196, z - .041, .085, .006, .045);
  flywheel(m, x, drum, z + .072, .054);
  m.box(enamel, x + .062, .119, z + .010, .013, .023, .053);
  m.box(rural.board, x - .057, .060, z + .022, .087, .014, .052, 0, 0, .39);
  stook(m, .281, .319, .106);
  if (tier >= 2) {
    const bin = .251 + (tier - 2) * .052;
    m.part("octagon", rural.board, .29, bin / 2, -.199, .147, bin, .139);
    for (const band of [.23, .73]) m.part("octagon", rural.iron, .29, bin * band, -.199, .15, .011, .142);
    m.part("spire", rural.slate, .29, bin + .036, -.199, .168, .077, .163);
    m.box(rural.timber, .29, .093, -.127, .032, .054, .091, -.35);
    stook(m, .35, .312, .089);
  }
  if (tier === 3) {
    m.beam(rural.board, [.360, .116, .144], [.361, .297, -.183], .031, .036);
    m.beam(rural.timber, [.363, .014, -.101], [.361, .250, -.095], .015);
    crate(m, .198, 0, .305, .068);
  }
}

function choppingAxe(m: Miniature, tier: Tier) {
  // The native tree at this position has just been felled; its stump is part of the forest edge.
  const x = .02, z = .005, cut = .054;
  m.beam(rural.timber, [x, cut + .03, z], [x - .080, cut + .12 + .005 * tier, z + .018], .019, .017);
  m.part("hip", rural.iron, x + .003, cut + .020, z, .070, .049, .022, 0, .24, -.15);
  m.box("#99a49c", x + .028, cut + .024, z, .012, .042, .022, 0, .24, -.15);
}

function timberStack(m: Miniature, tier: Tier) {
  // Two long skids are laid across the clearing. The cut timber runs down
  // towards the near corner, clear of the second stump on the left.
  const start = -.003, width = .057;
  for (const z of [.207, .351]) m.box(rural.timber, .085, .013, z, .207, .025, .024);
  for (let i = 0; i < tier + 2; i++) {
    const x = start + i * .047;
    log(m, x, .051, .271 + (i % 2) * .014, .214 - (i % 3) * .009, width);
    if (tier >= 2 && i > 0 && i < tier + 1) log(m, x - .0235, .094, .275, .221, .055);
  }
}

function forestWorkshop(m: Miniature, enamel: string, tier: Tier) {
  const x = .224, z = .056, w = .282 + .016 * tier, d = .174;
  const wall = .131 + .022 * tier, front = z + d / 2;
  m.box(rural.board, x + w * .18, wall / 2, z, w * .64, wall, d);
  m.box(rural.board, x - w * .32, wall / 2, z - d * .46, w * .36, wall, d * .08);
  for (const side of [-1, 1]) {
    const end = x + side * w / 2;
    const gable: Point[] = [[end, wall, z - d / 2], [end, wall + .042, z], [end, wall, front]];
    m.face(rural.board, side < 0 ? [...gable].reverse() : gable);
    m.box(rural.timber, end, wall / 2, front, .013, wall, .016);
    m.box(rural.timber, end, wall / 2, z - d / 2, .013, wall, .016);
  }
  for (let i = 1; i < 4; i++) {
    m.box("#908069", x + w * .18, wall * i / 4, front + .001, w * .64, .006, .006);
    m.box("#908069", x + w / 2 + .002, wall * i / 4, z, .005, .005, d);
  }
  pitchedRoof(m, x, z, w + .034, d + .038, wall + .004, .044 + tier * .005, rural.sage);
  for (const side of [-1, 1]) {
    const bx = x - w * .32 + side * w * .15;
    m.box(rural.timber, bx, wall / 2, front, .014, wall, .018);
    m.beam(rural.board, [bx, wall - .043, front], [bx - side * .030, wall - .009, front], .012);
  }
  m.box(rural.shade, x + .014, wall * .38, front + .004, .061, wall * .76, .010);
  m.box(rural.endgrain, x + .014, wall * .77, front + .008, .079, .013, .013);
  m.box(rural.shade, x + w / 2 + .004, wall * .55, z + .004, .008, .049, .057);
  m.box(rural.timber, x + w / 2 + .012, wall * .55, z + .004, .016, .011, .071);
  m.box(enamel, x + .056, wall * .66, front + .010, .046, .026, .009);
  leanTo(m, x - .030, front, front + .057, .144, wall * .67, rural.slate);
  if (tier >= 2) {
    roofVent(m, x - .015, z, wall + .037, .103 + tier * .020);
    const rack = .398;
    for (const rz of [.058, .131]) {
      m.box(rural.timber, rack, .054, rz, .020, .108, .021);
      m.box(rural.timber, rack - .025, .103, rz, .073, .015, .023);
    }
    log(m, rack - .021, .123, .094, .135, .037);
    // A travelling timber jib on the taller loading frame reaches the stacked logs.
    const top = .233 + (tier - 2) * .062;
    m.box(rural.timber, .292, top / 2, .211, .028, top, .031);
    m.beam(rural.timber, [.350,.006,.239], [.292,top - .027,.211], .018);
    m.beam(rural.iron, [.292,top,.211], [.158,top + .008,.249], .021);
    m.beam(rural.board, [.292,top - .063,.211], [.168,top - .002,.246], .016);
    m.beam(rural.timber, [.158,top + .002,.249], [.158,.129,.249], .008);
    if (tier === 3) {
      m.part("drum",rural.iron,.289,.092,.230,.040,.049,.040,Math.PI / 2);
      for (const dx of [-.025,.025]) m.box(rural.iron,.158 + dx,.123,.249,.016,.029,.016,0,0,dx * 10);

    }
  }
}
function yardEngine(m: Miniature, enclosed: boolean) {
  // A steam donkey hauled on two skids. Boiler, connecting rod and cable
  // drum all remain visible facing into the loading court.
  const x = -.214, z = .277;
  for (const side of [-1,1]) {
    m.box(rural.timber,x + side * .066,.015,z,.034,.030,.221);
    m.box(rural.brick,x + side * .053,.049,z - .022,.047,.051,.134);
  }
  m.part("drum","#727c76",x,.108,z - .025,.119,.155,.119,Math.PI / 2);
  for (const dz of [-.074,.022]) m.part("drum",rural.iron,x,.108,z + dz,.125,.013,.125,Math.PI / 2);
  m.part("octagon",rural.shade,x,.108,z + .055,.089,.012,.089,Math.PI / 2);
  const axle = .078;
  m.part("drum",rural.timber,x + .094,axle,z + .021,.063,.102,.063,0,0,Math.PI / 2);
  for (const dx of [.044,.142]) {
    m.part("drum",rural.iron,x + dx,axle,z + .021,.090,.012,.090,0,0,Math.PI / 2);
    m.box(rural.timber,x + dx,.040,z + .021,.018,.078,.028);
  }
  flywheel(m,x - .035,.092,z + .076,.055);
  m.beam(rural.board,[x - .052,.123,z + .080],[x + .097,axle,z + .042],.014);
  m.beam(rural.iron,[x + .114,axle + .032,z + .021],[.046,.152,.253],.009);
  m.beam(rural.iron,[.046,.152,.253],[.158,.234,.249],.009);

  if (!enclosed) {
    m.part("drum",rural.iron,x,.188,z - .078,.043,.100,.043);
    m.part("octagon",rural.iron,x,.245,z - .078,.055,.018,.055);
    return;
  }
  // The old skids stay in place inside an open-sided winding house. Raised
  // curved zinc panels and an offset brick flue give the second building its own profile.
  const cx = -.239, cz = .241, width = .222, depth = .168, eave = .175;
  m.box(rural.brick,cx,.072,cz - depth / 2,width,.144,.027);
  m.box(rural.brick,cx - width / 2,.061,cz,.025,.122,depth);
  for (const dx of [-.49,.49]) {
    m.box(rural.timber,cx + dx * width,eave / 2,cz + depth / 2,.019,eave,.019);
    m.beam(rural.board,[cx + dx * width,eave - .046,cz + depth / 2],
      [cx + dx * width,eave,cz + depth * .24],.012);
  }
  m.box(rural.iron,cx,eave,cz + depth / 2,width + .037,.017,.021);
  const span = depth + .043, rise = .053;
  const pitch = [[-.5,0],[-.29,.72],[0,1],[.29,.72],[.5,0]];
  for (let i = 1; i < pitch.length; i++) {
    const [a,ay] = pitch[i - 1], [b,by] = pitch[i];
    const dy = (by - ay) * rise, dz = (b - a) * span;
    m.box(i % 2 ? "#687e80" : "#708383",cx,eave + (ay + by) * rise / 2,cz + (a + b) * span / 2,
      width + .035,.013,Math.hypot(dy,dz) + .006,-Math.atan2(dy,dz));
  }
  const stackX = cx - .071, stackZ = cz - .046;
  m.box(rural.brick,stackX,.125,stackZ,.065,.25,.064);
  m.part("octagon",rural.iron,stackX,.288,stackZ,.051,.11,.050);
  m.part("octagon",rural.shade,stackX,.347,stackZ,.061,.018,.061);
}

function sawBench(m: Miniature, tier: Tier, enamel: string) {
  // A circular blade protrudes from a timber feed table; only its upper half is visible.
  const x = .035, z = .109, height = .129 + .030 * tier;
  for (const support of [-.122, .122]) {
    m.box(rural.timber, x + support, height / 2, z, .033, height, .103);
  }
  m.box(rural.board, x, height - .011, z, .33, .027, .143);
  const radius = .089;
  m.part("drum", rural.iron, x + .022, height - .006, z, radius * 2, .017, radius * 2, Math.PI / 2);
  for (let tooth = 0; tooth < 6; tooth++) {
    const a = (tooth + .5) * Math.PI / 6;
    const y = height - .006 + Math.sin(a) * radius;
    m.box("#8b9690", x + .022 + Math.cos(a) * radius, y, z, .021, .022, .021, 0, 0, a - .29);
  }
  m.box(enamel, x, height - .021, z + .075, .062, .018, .007);
  m.box(rural.endgrain, x - .069, height + .011, z + .026, .181, .017, .042);
}

export function timberWorks(m: Miniature, enamel: string, tier: Tier, mill: boolean) {
  if (!mill) {
    forestWorkshop(m, enamel, tier);
    timberStack(m, tier);
    choppingAxe(m, tier);
    if (tier >= 2) yardEngine(m, tier === 3);
    // The bark and chips run from the felled trunk to the skids and through the bay.
    for (const [x, z, a] of [[.026,.072,.11],[-.014,.106,-.28],[.052,.114,.35],[.063,.161,-.27]]) {
      m.part("hip", rural.endgrain, x, .007, z, .035, .012, .014, 0, a);
    }
    return;
  }

  const h = .110 + .044 * tier;
  const span = .254 + .061 * tier, depth = .114 + .054 * tier;
  frameHall(m, .007, .020 - depth / 2, span, depth, h, "#658085", false, tier);
  sawBench(m, tier, enamel);
  // The green log enters the saw at the open end; the sawn boards leave by
  // the raised roller bed and are stickered on the drying racks.
  for (const x of [.155, .248]) {
    m.box(rural.timber, x, .060, .109, .026, .120, .102);
    m.part("drum", rural.iron, x, .134, .109, .033, .116, .033, Math.PI / 2);
  }
  m.box(rural.timber, .207, .073, .155, .172, .027, .017);
  for (let row = 0; row < tier + 1; row++) {
    m.box(rural.board, -.117 + .010 * (row % 2), .026 + row * .028, .206, .239, .024, .087);
    m.box(rural.endgrain, -.117, .026 + row * .028, .251, .237, .023, .005);
    for (const dx of [-.075,.075]) m.box(rural.timber, -.117 + dx, .041 + row * .028, .203, .014, .008, .093);
  }
  m.part("octagon", rural.timber, .236, .170, .108, .056, .229, .057, 0, 0, Math.PI / 2);
  m.part("octagon", rural.endgrain, .352, .170, .108, .045, .004, .046, 0, 0, Math.PI / 2);
  flywheel(m, -.118, .091, .132, .059 + .005 * tier);
  m.beam(rural.iron, [-.123,.149,.135], [.063,.174,.136], .011, .015);
  if (tier >= 2) {
    m.box(rural.shade, -.148, h * .48, .035, .067, h * .83, .029);
    m.part("disc", rural.brass, -.148, .099, .055,.049,.012,.049,Math.PI / 2);
    leanTo(m, -.112, .022, .109, .137, h * .82, rural.board);
    log(m, .279, .028, -.106, .218, .056);
  }
  if (tier === 3) {
    // A perpendicular drying kiln closes the west side of the yard. The
    // kiln's slatted mouth faces the log deck; the brick flue is on the boiler end.
    const kx = -.300, kz = -.084, kilnH = .157;
    m.box(rural.brick,kx,.044,kz,.147,.087,.212);
    for (const side of [-1,1]) {
      m.box(rural.board,kx + side * .067,.118,kz,.017,.090,.208);
      m.box(rural.timber,kx + side * .061,.102,kz + .111,.016,.202,.021);
    }
    for (const layer of [0,1,2,3]) {
      m.box(layer % 2 ? rural.endgrain : rural.board,kx,.051 + layer * .028,kz + .103,.113,.012,.080);
    }
    m.box(rural.timber,kx,.159,kz + .089,.167,.018,.035);
    pitchedRoof(m,kx,kz,.174,.260,kilnH + .013,.045,"#966d58");
    m.box(rural.brick,kx + .027,.152,kz - .073,.073,.303,.076);
    m.part("octagon",rural.iron,kx + .027,.334,kz - .073,.063,.097,.063);
    m.part("octagon",rural.shade,kx + .027,.388,kz - .073,.076,.018,.076);
    m.box(rural.board, -.256, .080, .135, .095, .019, .209);
    for (const rz of [.071,.208]) m.box(rural.timber,-.256,.037,rz,.076,.074,.022);
  }
}

function extractedOre(m: Miniature) {
  // The laden wagon takes the place of the original centre vein. The loading
  // rock itself is also the flying ore token used by the population animation.
  const x = .072, z = .341;
  for (const [dx,dz,h,angle] of [[-.024,.010,.059,.46],[.017,.012,.070,-.29],[.005,-.037,.052,.32]]) {
    m.part("gem", "#b77947", x + dx, .099 + h * .38, z + dz, h * .86, h, h * .69, .15, -.09, angle);
    m.part("gem", "#f1c485", x + dx + .005, .105 + h * .38, z + dz + .005,
      h * .61, h * .75, h * .50, .14, -.06, angle);
  }
}

export function mineOreSculpture() {
  const m = new Miniature();
  extractedOre(m);
  return m.finish();
}

export function mine(m: Miniature, enamel: string, tier: Tier, includeNativeStock = true) {
  const x = -.131, face = .055;
  // Retain both side veins. The third has been worked and its crystals are on the wagon.
  if (includeNativeStock) oreVein(m, 1);
  m.box(rural.shade, x, .080, face - .014, .156, .160, .022);
  for (const rz of [face, face + .062]) {
    for (const side of [-1,1]) {
      m.beam(rural.timber, [x + side * .103, .004, rz], [x + side * .083, .163, rz], .026, .030);
      m.beam(rural.board, [x + side * .090, .104, rz], [x + side * .052, .157, rz], .015);
    }
    m.box(rural.board, x, .170, rz, .218, .029, .038);
  }
  for (const side of [-1,1]) m.box(rural.timber, x + side * .071, .188, face + .022, .027, .019, .149);
  // A short lined drift protects the tram as it emerges from the rock. The
  // lower retaining walls and the fall of the roof actually meet the cut face.
  for (const side of [-1, 1]) {
    m.box(rural.stone, x + side * .103,.022,face + .030,.036,.045,.114);
    for (let board = 0; board < 3; board++) {
      m.box(rural.timber,x + side * .098,.063 + board * .031,face + .025,.014,.026,.090);
    }
  }
  m.box(rural.board,x,.193,face + .027,.224,.017,.133,.073);
  for (const dx of [-.064,0,.064]) m.box(rural.timber,x + dx,.206,face + .027,.013,.008,.135,.073);
  m.box(enamel, x, .169, face + .084, .042, .015, .012);

  // Short rail lengths and sleepers follow the actual bend from tunnel to loading lip.
  const stops = [[x,face],[-.101,.163],[.029,.273],[.071,.331],[.079,.404]];
  for (let i = 1; i < stops.length; i++) {
    const [a,b] = stops[i - 1], [c,d] = stops[i], len = Math.hypot(c - a,d - b);
    const acrossX = (d - b) / len, acrossZ = (a - c) / len;
    for (const sign of [-1,1]) {
      const dx = sign * acrossX * .041, dz = sign * acrossZ * .041;
      m.beam(rural.iron, [a + dx,.019,b + dz], [c + dx,.019,d + dz], .012);
    }
    for (const t of [.17, .69]) {
      const px = a + (c - a) * t, pz = b + (d - b) * t;
      m.beam(rural.timber, [px - acrossX * .059,.008,pz - acrossZ * .059], [px + acrossX * .059,.008,pz + acrossZ * .059], .015, .019);
    }
  }
  for (const side of [-1,1]) {
    for (const rz of [.304,.369]) m.part("drum", rural.iron, .072 + side * .042, .039, rz, .039, .019, .039, 0, 0, Math.PI / 2);
  }
  m.part("hip", rural.iron, .072, .081, .341, .125, .060, .135, Math.PI);
  m.box(rural.shade, .072, .113, .341, .112, .008, .119);
  extractedOre(m);

  const px = .251, pz = .096, h = .179 + .039 * tier;
  for (const side of [-1, 1]) {
    m.beam(rural.board, [px + side * .061,.006,pz + .049],[px + side * .039,h,pz], .026);
    m.beam(rural.timber, [px + side * .061,.006,pz - .065],[px + side * .039,h,pz], .025);
  }
  m.part("drum", rural.timber, px,h,pz,.056,.113,.056,0,0,Math.PI / 2);
  m.beam(rural.iron, [px - .005,h + .018,pz], [x + .049,.140,face + .073], .011);
  if (tier >= 2) {
    m.box(rural.timber, px, h + .016, pz, .158,.026,.061);
    m.beam(rural.timber,[px - .052,.051,pz + .045],[px + .044,h - .046,pz + .012],.017);
    m.box(rural.board,px,.087,pz + .028,.106,.051,.018);
    m.box(rural.iron,px,.111,pz + .040,.102,.014,.018);
    const top = h + .057;
    m.beam(rural.iron,[px,top,pz],[px - .109,top + .007,pz + .071],.019);
    m.beam(rural.board,[px,top - .061,pz],[px - .099,top,pz + .066],.015);
    m.beam(rural.timber,[px - .107,top,pz + .072],[px - .107,.129,pz + .072],.010);
    m.box(rural.timber,px,h + .031,pz,.020,.047,.028);
  }
  if (tier === 3) {
    // Sorting chutes take the hanging basket over the head of the ore wagon.
    m.box(rural.board, .177,.122,.221,.099,.020,.143,-.35);
    for (const side of [-1,1]) m.box(rural.timber,.177 + side * .050,.140,.221,.014,.029,.150,-.35);
    for (const rz of [.187,.264]) m.box(rural.timber,.177,.052,rz,.077,.105,.018);
    // Slatted winding house around the drum; roof area is just the headframe's footprint.
    for (const dx of [-.064,.064]) m.box(rural.board,px + dx,h + .036,pz,.013,.088,.115);
    for (const off of [-.029, .001, .031]) m.box(rural.timber,px,h + .019 + off,pz + .060,.135,.012,.013);
    pitchedRoof(m,px,pz,.177,.135,h + .081,.030,rural.slate);
  }
}
export function windmill(m: Miniature, enamel: string, tier: Tier) {
  const x = -.120, z = .119;
  const hub = .147 + (tier - 1) * .037, radius = .146 + (tier - 1) * .022;
  // The grinding floor abuts a timber-frame sacking hall. The sails turn
  // its shaft through the tower wall directly above the millstones.
  const h = .128 + tier * .020;
  frameHall(m, .080, -.088, .282, .188, h, rural.slate, true);
  m.part("octagon", rural.stone, x, hub * .19, z, .201, hub * .38, .197);
  m.part("hip", rural.plaster, x, hub * .63, z, .188, hub * .66, .173);
  m.part("octagon", rural.board, x, hub * .84, z, .116, hub * .35, .111);
  m.part("spire", rural.slate, x, hub + .021, z, .145, .058, .148);
  // A windmill can turn into the wind. Present the cloth's broad side to the fixed map camera.
  const faceX = x + .063, faceZ = z + .080;
  for (let i = 0; i < 4; i++) {
    const angle = Math.PI * i / 2 + .69;
    const dx = Math.sin(angle), dy = Math.cos(angle);
    const onSail = (length: number, width: number): Point => {
      const horizontal = length * dx + width * dy;
      return [faceX + horizontal * .788, hub + length * dy - width * dx, faceZ - horizontal * .616];
    };
    const canvas = [onSail(radius * .35, 0), onSail(radius, 0), onSail(radius, .048), onSail(radius * .44, .068)];
    m.face(rural.canvas, canvas);
    m.face(rural.canvas, [...canvas].reverse());
    m.beam(rural.timber, [faceX, hub, faceZ], onSail(radius + .007, 0), .017);
    m.beam(rural.board, onSail(radius * .45, 0), onSail(radius * .45, .064), .009);
  }
  m.part("gem", enamel, faceX + .004, hub, faceZ + .005, .031, .033, .033);
  for (const rz of [.058, .138]) m.box(rural.timber, .105, .032, rz, .161, .064, .020);
  m.box(rural.board, .105, .074, .095, .193, .022, .136);
  for (const sx of [.071,.131]) {
    m.part("crown", rural.canvas, sx, .112, .098, .063, .061, .068);
    m.part("gem", rural.reed, sx + .003, .148, .097, .020, .017, .023);
  }
  m.part("disc", rural.stone, -.238, .051, .074, .099, .028, .099, Math.PI / 2, 0, -.22);
  if (tier >= 2) {
    leanTo(m, .105, .026, .170, .206, h - .039, rural.sage);
    for (let i = 0; i < 3; i++) m.box(rural.board, .180, .008 + i * .012, .233 - i * .026, .085, .016 + i * .024, .031);
    stook(m, .227, -.028, .078);
  }
  if (tier === 3) {
    const bin = .213;
    for (const dx of [.214,.275]) m.box(rural.timber, dx, .052, -.153, .026, .104, .080);
    m.part("hip", rural.board, .245,.134,-.153,.104,.096,.103,Math.PI);
    m.box(rural.board, .245,.184,-.153,.119,.059,.115);
    m.part("hip", rural.slate, .245,bin + .013,-.153,.136,.030,.139);
    m.beam(rural.board,[.228,.159,-.116],[.161,.103,-.020],.025);
  }
}

function anvil(m: Miniature, x: number, z: number) {
  m.part("octagon", rural.timber, x, .036, z, .116, .071, .103);
  m.part("hip", rural.iron, x, .083, z, .095, .035, .076);
  m.box(rural.iron, x, .110, z, .055, .032, .052);
  m.box("#737e79", x - .001, .135, z, .118, .022, .064);
  m.part("spire4", rural.iron, x + .088, .130, z, .047, .070, .058, 0, 0, -Math.PI / 2);
}

export function forge(m: Miniature, enamel: string, tier: Tier) {
  // The smithy encloses one brick furnace and a louvred working hall.
  // Blowing, heating, hammering and cooling follow a single apron.
  const x = .109, z = .090, w = .355 + tier * .016, d = .192;
  const front = z + d / 2, h = .134 + tier * .014;
  const fireX = x - .087;
  m.box(rural.brick, x, h / 2, z, w, h, d);
  m.box(rural.stone, x, .014, z, w + .005, .027, d + .006);
  for (const xx of [x - w / 2 + .01, x + .006, x + w / 2 - .01]) {
    m.box("#a78169", xx, (h + .008) / 2, front + .004, .024, h + .008, .016);
  }
  for (const rz of [z - .051, z + .033]) {
    m.box(rural.shade, x + w / 2 + .002, h * .55, rz, .010, .065, .058);
    m.box(rural.stone, x + w / 2 + .006, h * .78, rz, .015, .013, .070);
    m.box(rural.board, x + w / 2 + .010, h * .55, rz, .011, .060, .007);
  }
  m.box(rural.shade, x + .068, h * .44, front + .003, .094, h * .88, .012);
  m.box(rural.iron, x + .068, h * .87, front + .011, .118, .015, .017);
  const forgedRoof = "#796e64";
  pitchedRoof(m, x, z, w + .042, d + .052, h + .003, .047, forgedRoof);
  for (const dx of [-.127,-.041,.047,.134]) {
    m.beam(rural.board, [x + dx,h + .060,z], [x + dx,h + .017,front + .017], .007);
  }
  m.box(rural.brick, fireX, .065, front + .003, .151, .127, .107);
  m.box(rural.shade, fireX, .048, front + .062, .110, .086, .018);
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (i + .5) / 5;
    m.box(rural.clay, fireX + .057 * Math.cos(a), .057 + .040 * Math.sin(a), front + .071,
      .028, .020, .022, 0, 0, a - Math.PI / 2);
  }
  m.box("#c88248", fireX, .035, front + .075, .084, .030, .009);
  m.box("#ddb278", fireX - .007, .028, front + .082, .048, .015, .006);
  m.box(rural.stone, fireX, .014, front + .092, .146, .028, .046);
  const chimney = .207 + tier * .045;
  m.box(rural.brick, fireX - .041, chimney / 2, z - .034, .082, chimney, .082);
  m.box(rural.clay, fireX - .041, chimney - .016, z - .034, .092, .026, .091);
  m.box(rural.iron, fireX - .041, chimney + .005, z - .034, .102, .020, .101);
  m.box(rural.shade, fireX - .041, chimney + .017, z - .034, .062, .005, .062);
  anvil(m, .200, .273);
  m.box(enamel, x + .139, .106, front + .012, .041, .025, .010);
  m.box(rural.timber, .135, .015, .303, .082, .030, .043);
  m.beam(rural.board, [.112,.033,.302],[.157,.039,.285],.012);
  m.box(rural.iron, .161,.040,.285,.025,.026,.046,0,-.27);
  if (tier >= 2) {
    roofVent(m,x + .027,z,h + .037,.129);
    m.part("drum", rural.board, .318,.044,.178,.095,.088,.095);
    m.part("drum", "#839a96", .318,.091,.178,.080,.007,.080);
    m.part("drum", rural.iron, .318,.056,.178,.099,.011,.099);
    for (const rz of [.231,.302]) m.box(rural.board,-.088,.017,rz,.096,.030,.023);
    for (const dx of [-.108,-.076]) m.box(rural.iron,dx,.039,.268,.021,.016,.165);
  }
  if (tier === 3) {
    leanTo(m,x + .084,front,front + .082,.145,h * .90,rural.iron);
    for (const dx of [-.033, .033]) m.box(rural.iron,x + .080 + dx,.056,front + .055,.016,.112,.027);
    m.box(rural.iron,x + .080,.110,front + .055,.087,.022,.038);
    m.box(rural.brass,x + .080,.079,front + .055,.022,.059,.025);
    m.part("drum",rural.iron,-.116,.094,.144,.103,.026,.103,Math.PI / 2);
    m.box(rural.brick,-.116,.044,.108,.077,.087,.085);
    m.beam(rural.board,[-.116,.104,.145],[-.021,.087,.206],.022);
  }
}

// Later additions grow beside the established buildings and reuse their working
// faces. Each stage-three addition connects to a machine in the existing yard.
function latticeGirder(m: Miniature, a: Point, b: Point, height: number, panels: number, paint: string) {
  const node = (i: number, rise: number): Point => [
    a[0] + (b[0] - a[0]) * i / panels,
    a[1] + (b[1] - a[1]) * i / panels + rise,
    a[2] + (b[2] - a[2]) * i / panels,
  ];
  m.beam(paint, a, b, .021, .021);
  m.beam(paint, node(0, height), node(panels, height), .018, .019);
  for (let i = 0; i < panels; i++) {
    m.beam(paint, node(i, i % 2 ? height : 0), node(i + 1, i % 2 ? 0 : height), .012);
  }
}

function grainElevator(m: Miniature, enamel: string) {
  // Reinforced grain bins share a bucket-elevator head and a gallery along the
  // back of the field, leaving the four original stands exposed to the south.
  const z = -.337, rim = .304;
  for (const x of [-.204,-.052,.100]) {
    m.part("drum", "#b2afa0", x,rim / 2,z,.148,rim,.149);
    for (const level of [.082,.219,rim]) m.part("drum",rural.iron,x,level,z,.153,.011,.154);
    m.part("spire",rural.slate,x,rim + .026,z,.164,.055,.165);
    m.box(rural.timber,x,.106,z + .078,.029,.055,.020);
  }
  const x = .216;
  m.box(rural.board,x,.204,z,.094,.408,.115);
  m.box("#7b837b",x,.430,z,.138,.070,.154);
  pitchedRoof(m,x,z,.146,.164,.466,.036,rural.slate);
  m.box(rural.shade,x,.434,z + .080,.070,.027,.009);
  m.box(enamel,x + .074,.435,z,.010,.022,.055);
  m.box(rural.iron,.002,.358,z,.478,.033,.043);
  m.box(rural.canvas,.002,.384,z,.478,.026,.054);
  for (const side of [-1,1]) m.beam(rural.board,[.234 + side * .012,.373,z + .039],
    [.295 + side * .012,.306,-.212],.020);
  cropRow(m,-.384,-.306,.289);
  for (const rz of [-.232,-.083,.065,.217]) stook(m,-.384,rz,.084);
  for (const dx of [-.119,.024]) m.box(rural.timber,dx,.019,.324,.022,.037,.121);
  m.box(rural.board,-.047,.047,.328,.199,.020,.108);
  for (const dx of [-.099,-.037,.022]) m.part("crown",rural.canvas,dx,.080,.330,.055,.047,.078);
}

function timberTerminal(m: Miniature, enamel: string) {
  const a = -.095, b = .349, z = .333, runway = .374, steel = "#657c80";
  // The travelling crab can collect a bundle anywhere over the skids and lower
  // it onto the loading spur. Leave enough space below the bridge to see the timber.
  for (const x of [a,b]) {
    for (const side of [-1,1]) {
      const foot = z + side * .086;
      m.box(rural.stone,x,.016,foot,.059,.032,.052);
      m.beam(steel,[x,.029,foot],[x,runway,z + side * .018],.027,.032);
    }
    m.beam(steel,[x,.141,z - .057],[x,.141,z + .057],.019);
    m.beam(rural.iron,[x,.146,z - .052],[x,.278,z + .039],.015);
  }
  for (const side of [-1,1]) {
    latticeGirder(m,[a - .029,runway,z + side * .026],[b + .025,runway,z + side * .026],.052,6,steel);
  }
  m.box(rural.iron,.072,runway - .013,z,.095,.034,.081);
  m.box(enamel,.072,runway + .006,z + .048,.074,.024,.013);
  for (const x of [.031,.113]) {
    m.beam(rural.iron,[x,runway - .021,z],[x,.210,z],.009);
    m.beam(rural.iron,[x,.210,z],[x,.177,z + .029],.010);
  }
  m.part("octagon",rural.timber,.073,.189,z,.057,.204,.057,0,0,Math.PI / 2);
  m.part("octagon",rural.endgrain,.176,.189,z,.048,.006,.048,0,0,Math.PI / 2);

  for (let i = 0; i < 6; i++) m.box(rural.timber,-.152 + .092 * i,.009,.428,.025,.018,.067);
  for (const rz of [.402,.451]) m.box(rural.iron,.066,.023,rz,.527,.012,.010);
  m.box(rural.board,.217,.049,.422,.160,.028,.065);
  for (const x of [.159,.274]) m.box(rural.shade,x,.033,.422,.019,.025,.067);
  frameHall(m,.380,.220,.117,.125,.154,"#7b8982");
}

function sawmillWorks(m: Miniature, enamel: string) {
  // At the wide end of the feed line a stickered lumber store doubles as a
  // kiln. Its perforated end wall and high exhaust differ from the glazed saw bays.
  const x = .319, z = -.139, w = .191, d = .246, h = .259;
  m.box(rural.brick,x,.041,z,w,.082,d);
  for (const side of [-1,1]) {
    m.box(rural.timber,x + side * w * .46,h * .57,z,.022,h * .84,d);
    m.box(rural.timber,x + side * w * .43,h / 2,z + d * .48,.022,h,.020);
  }
  m.box(rural.shade,x,.159,z + d / 2 - .020,w * .84,.163,.028);
  for (let i = 0; i < 5; i++) m.box(rural.board,x,.100 + i * .030,z + d / 2,w * .90,.014,.020);
  pitchedRoof(m,x,z,w + .037,d + .031,h,.056,"#8a725c");

  // Pneumatic duct from the highest saw bay to the cyclone bin behind the kiln.
  const cx = .317, cz = -.336;
  for (const ox of [-.051,.051]) for (const oz of [-.042,.042])
    m.box(rural.iron,cx + ox,.090,cz + oz,.015,.180,.015);
  m.part("spire","#82918b",cx,.203,cz,.145,.111,.145,Math.PI);
  m.part("drum","#788985",cx,.310,cz,.144,.108,.144);
  m.part("spire",rural.slate,cx,.388,cz,.148,.049,.148);
  m.part("drum",rural.iron,cx,.432,cz,.055,.075,.055);
  m.box(enamel,cx,.310,cz + .072,.039,.026,.009);
  m.beam(rural.iron,[.110,.371,-.210],[.152,.431,-.249],.035);
  m.beam(rural.iron,[.152,.431,-.249],[.299,.399,cz],.035);
  // Bundles leave the kiln under an open sorting shelter at the front of the yard.
  for (const dx of [-.286,-.069]) for (const rz of [.295,.408])
    m.box(rural.timber,dx,.077,rz,.018,.154,.020);
  pitchedRoof(m,-.177,.355,.265,.135,.155,.026,rural.sage);
  for (let row = 0; row < 3; row++) {
    m.box(rural.board,-.176 + (row % 2) * .011,.022 + row * .025,.356,.218,.020,.086);
    m.box(rural.endgrain,-.176,.022 + row * .025,.402,.208,.016,.005);
  }
}

function mineConcentrator(m: Miniature, enamel: string) {
  // A shaft gantry above the rail line carries two winding sheaves. The old
  // winch house drives it across the gap; the ore screens discharge to the tram.
  const x = -.011, z = .165, head = .418, steel = "#677c81";
  for (const side of [-1,1]) {
    const leg = x + side * .074;
    m.beam(steel,[leg,.020,z + .073],[x + side * .045,head,z + .018],.030);
    m.beam(steel,[leg,.020,z - .058],[x + side * .045,head,z - .014],.028);
    m.beam(steel,[leg,.145,z + .044],[x + side * .057,.273,z - .032],.016);
    m.beam(steel,[.188 + side * .040,.047,.120],[x + side * .040,head - .022,z],.021);
  }
  for (const y of [.148,.286,head]) m.box(steel,x,y,z,.135,.019,.086);
  for (const dx of [-.032,.032]) {
    m.part("drum",rural.iron,x + dx,head + .043,z,.083,.024,.083,0,0,Math.PI / 2);
    m.beam(rural.shade,[x + dx,head + .073,z],[.236 + dx,.321,.094],.009);
  }
  m.box(rural.board,x,head + .005,z + .043,.149,.038,.020);
  m.box(enamel,x + .025,head + .005,z + .054,.048,.020,.007);
  for (const dx of [-.066,.066]) m.box(steel,x + dx,head + .051,z,.013,.107,.017);
  pitchedRoof(m,x,z,.180,.119,head + .105,.025,steel);
  const sx = .240, sz = .330;
  for (const dx of [-.073,.073]) for (const dz of [-.052,.052]) {
    m.box(rural.timber,sx + dx,.082,sz + dz,.020,.164,.021);
  }
  m.part("hip",rural.iron,sx,.161,sz,.182,.098,.134,Math.PI);
  m.box(rural.board,sx,.229,sz,.185,.043,.143);
  m.box(rural.shade,sx,.253,sz,.152,.008,.112);
  m.box(rural.board,sx,.276,sz - .012,.159,.030,.119,-.19);
  for (const dx of [-.059,-.030,0,.030,.059]) m.box(rural.iron,sx + dx,.300,sz - .011,.008,.009,.116,-.19);
  m.beam(rural.iron,[.182,.139,.343],[.078,.116,.344],.028,.036);
  latticeGirder(m,[.030,.292,.193],[sx,.257,.290],.032,4,steel);
}

function rollerMill(m: Miniature, enamel: string) {
  // The existing wind-driven mill feeds a new roller floor. Its raised brick
  // elevator and the enclosed bridge let the flour move to the rear packing hall.
  const x = -.301, z = -.108, w = .177, d = .246, h = .290;
  m.box(rural.brick,x,h / 2,z,w,h,d);
  for (const y of [.066,.180]) {
    for (const rz of [-.072,.007,.083]) m.box(rural.shade,x + w / 2 + .002,y,z + rz,.009,.049,.043);
    for (const dx of [-.040,.040]) m.box(rural.shade,x + dx,y,z + d / 2 + .003,.044,.049,.009);
    m.box(rural.stone,x,y + .033,z,w + .012,.013,d + .012);
  }
  pitchedRoof(m,x,z,w + .030,d + .035,h,.050,rural.slate);
  const ex = x + .050, ez = z - .068;
  m.box(rural.brick,ex,.199,ez,.087,.398,.083);
  m.box(rural.board,ex,.405,ez,.105,.051,.095);
  m.box(rural.shade,ex,.408,ez + .051,.050,.025,.009);
  pitchedRoof(m,ex,ez,.115,.103,.432,.027,rural.slate);

  frameHall(m,.035,-.331,.380,.137,.186,"#938065",true);
  latticeGirder(m,[ex,.303,ez],[.009,.229,-.285],.035,4,rural.iron);
  m.beam(rural.board,[ex,.323,ez],[.009,.249,-.285],.031,.051);
  m.box(rural.board,.127,.079,-.229,.147,.025,.093);
  for (const dx of [.085,.143]) m.part("crown",rural.canvas,dx,.119,-.223,.055,.056,.062);
  m.box(enamel,x + w / 2 + .005,.244,z - .005,.012,.022,.056);
}

function forgeWorks(m: Miniature, enamel: string) {
  // A cupola and a second casting bay open directly onto the original forge's
  // apron. An elevated charging platform and ladle runway connect both shops.
  const x = -.225, z = .242, w = .218, d = .144, h = .181;
  frameHall(m,x,z,w,d,h,"#81716a");
  m.box(rural.brick,x - .048,.085,z,.104,.171,.135);
  const fx = x - .036, fz = z + .001;
  m.part("octagon",rural.brick,fx,.211,fz,.128,.213,.119);
  for (const y of [.171,.281]) m.part("octagon",rural.iron,fx,y,fz,.136,.019,.128);
  m.part("spire",rural.iron,fx,.351,fz,.157,.082,.147);
  m.part("drum",rural.iron,fx,.416,fz,.072,.113,.072);
  m.part("drum",rural.shade,fx,.479,fz,.091,.017,.090);
  m.box(rural.iron,fx,.250,fz + .061,.076,.061,.020);
  m.box("#bf8054",fx,.247,fz + .074,.037,.026,.009);
  m.box(enamel,fx,.313,fz + .067,.042,.019,.010);
  m.box(rural.iron,x + .046,.213,z + .090,.168,.018,.081);
  for (const dx of [-.025,.108]) m.box(rural.iron,x + dx,.111,z + .116,.019,.222,.020);
  m.beam(rural.iron,[x + .111,.209,z + .105],[-.027,.035,.355],.022);
  for (const sx of [-.075,.151]) {
    m.box(rural.iron,sx,.127,.359,.022,.254,.025);
    m.beam(rural.iron,[sx,.171,.359],[sx + .035,.226,.359],.012);
  }
  latticeGirder(m,[-.116,.247,.359],[.188,.247,.359],.029,5,rural.iron);
  m.beam(rural.iron,[-.006,.243,.359],[-.006,.149,.359],.009);
  m.part("hip",rural.shade,-.006,.126,.359,.083,.059,.069,Math.PI);
  m.box("#c08451",-.006,.157,.359,.053,.007,.043);
  for (const sx of [-.080,-.010,.060]) {
    m.box(rural.stone,sx,.021,.404,.059,.042,.056);
    m.box(rural.shade,sx,.045,.404,.040,.007,.039);
  }
}

export function industrialExpansion(m: Miniature, type: BuildingId, enamel: string) {
  switch (type) {
    case "farm": return grainElevator(m, enamel);
    case "lumberHut": return timberTerminal(m, enamel);
    case "sawmill": return sawmillWorks(m, enamel);
    case "mine": return mineConcentrator(m, enamel);
    case "windmill": return rollerMill(m, enamel);
    case "forge": return forgeWorks(m, enamel);
  }
}
