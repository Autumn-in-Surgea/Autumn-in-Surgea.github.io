import type { UnitType } from "../../game/types";
import { Miniature } from "../../scene/miniature";

// Sculpt the walnut, ivory and metal once. A second mesh carries the enamel
// inlay so every faction shares the same carving, including exhausted pieces.
const ink = "#344247";
const walnut = "#624937";
const wood = "#ab825a";
const brass = "#c9a45c";
const ivory = "#efdfbc";
const steel = "#b9cccb";
const deepSteel = "#60767a";
const enamelLight = "#fffdf1";
const enamelShade = "#bcbcb5";

type Sculpture = { body: Miniature; enamel: Miniature };
type Infantry = "warrior" | "defender" | "archer" | "swordsman" | "mindBender" | "cloak" | "dagger";

function plinth({ body, enamel }: Sculpture, width: number, depth = width) {
  body.part("octagon", walnut, 0, .025, 0, width, .05, depth);
  body.part("octagon", brass, 0, .056, 0, width * .99, .022, depth * .99);
  enamel.part("octagon", enamelLight, 0, .083, 0, width * .94, .047, depth * .94);
  body.part("octagon", ivory, 0, .109, 0, width * .83, .018, depth * .83);
}

function pavise({ body, enamel }: Sculpture) {
  const width = .28;
  const height = .38;
  const x = -.147;
  const z = -.112;
  body.part("bevel", brass, x, .354, z, width, height, .059);
  enamel.part("bevel", enamelShade, x, .354, z - .029, width * .85, height * .9, .028);
  body.part("gem", ivory, x, .354, z - .052, width * .41, height * .6, .039);
}

function sabre(body: Miniature, x: number, y: number, blade: number, side: number) {
  const hand: [number, number, number] = [x, y + .025, -.094];
  const tip: [number, number, number] = [x + side * .056, y + blade, -.172];
  body.beam(walnut, [x - side * .014, y - .076, -.069], hand, .032);
  body.box(brass, ...hand, .099, .026, .046);
  body.beam(steel, hand, tip, .052, .024);
  body.part("spire4", ivory, tip[0] + side * .003, tip[1] + .022, tip[2], .051, .062, .023);
}

function bow({ body }: Sculpture) {
  const grip: [number, number, number] = [.251, .395, -.133];
  const upper: [number, number, number] = [.14, .698, -.089];
  const lower: [number, number, number] = [.14, .155, -.089];
  const shoulder: [number, number, number] = [.257, .545, -.133];
  const foot: [number, number, number] = [.236, .275, -.13];
  body.beam(ivory, [.142, .351, -.062], grip, .055);
  body.beam(wood, grip, shoulder, .037);
  body.beam(brass, shoulder, upper, .028);
  body.beam(wood, grip, foot, .037);
  body.beam(brass, foot, lower, .028);
  body.beam(ivory, upper, lower, .012);
  body.beam(walnut, [-.088, .267, .114], [.065, .526, .159], .08, .075);
  for (const dx of [-.023, .018])
    body.beam(ivory, [.048 + dx, .508, .156], [.097 + dx, .608, .17], .017);
}

const pikeGrey = "#718693";
const capBlue = "#627988";
const officerBlue = "#384c5b";
const madder = "#954f48";
const leather = "#443c35";
const skin = "#dfc39e";

// The folded M1908 field cap, dark visor and round cockade are large enough
// to read in profile. One blank honey-coloured facet stands for the face.
type CapStyle = "field" | "officer" | "alpine" | "hussar" | "lancer";

function cappedHead(body: Miniature, style: CapStyle, y: number, z = 0, scale = 1) {
  const part = (shape: Parameters<Miniature["part"]>[0], color: string,
    x: number, dy: number, dz: number, w: number, h: number, d: number, rx = 0, ry = 0, rz = 0) =>
    body.part(shape, color, x * scale, y + dy * scale, z + dz * scale,
      w * scale, h * scale, d * scale, rx, ry, rz);

  part("octagon", skin, 0, .004, -.007, .17, .153, .169);
  if (style === "alpine") {
    part("octagon", "#546258", -.006, .065, -.009, .269, .023, .233, 0, .02, .085);
    part("crown", "#69786b", 0, .099, .002, .177, .101, .164);
    part("gem", officerBlue, -.075, .149, .028, .071, .143, .063, -.19, 0, -.22);
    return;
  }

  part("octagon", leather, 0, .069, -.027, .195, .022, .176, .06);
  if (style === "hussar" || style === "lancer") {
    const shako = style === "hussar";
    part("octagon", shako ? madder : officerBlue, 0, .125, .003,
      .193, shako ? .148 : .121, .176);
    if (shako) {
      part("octagon", officerBlue, 0, .196, .003, .204, .021, .186);
      part("gem", ivory, -.013, .225, -.042, .051, .096, .057, -.17);
    } else {
      part("hip", madder, 0, .190, .008, .162, .065, .160, Math.PI, .55);
      part("bevel", madder, 0, .223, .008, .166, .019, .166, 0, .55);
    }
    part("octagon", brass, 0, .128, -.086, .055, .018, .055, Math.PI / 2);
    return;
  }

  const crown = style === "officer" ? officerBlue : capBlue;
  const fold = style === "officer" ? "#465a67" : "#8295a0";
  const point = (x: number, dy: number, dz: number): [number, number, number] =>
    [x * scale, y + dy * scale, z + dz * scale];
  const outline = [[-.045,-.099],[.045,-.099],[.092,-.056],[.098,.032],
    [.063,.087],[-.063,.087],[-.098,.032],[-.092,-.056]];
  const lower = outline.map(([x, dz]) => point(x, .067, dz));
  const flap = outline.map(([x, dz]) => point(x, .104 + dz * .14, dz));
  const ridge = outline.map(([x, dz]) => point(x * .77, .156 - dz * .18, dz * .93));
  const crease = point(0, .137, .006);
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    body.face(fold, [lower[i], flap[i], flap[j], lower[j]]);
    body.face(crown, [flap[i], ridge[i], ridge[j], flap[j]]);
    body.face(crown, [ridge[j], ridge[i], crease]);
  }
  part("octagon", brass, 0, .126, -.100, .05, .014, .05, Math.PI / 2);
}

function infantry(sculpt: Sculpture, type: Infantry) {
  const { body, enamel } = sculpt;
  const longCoat = type === "cloak" || type === "mindBender";
  const cloth = type === "dagger" || type === "swordsman" ? officerBlue : pikeGrey;
  plinth(sculpt, .49);
  for (const side of [-1, 1]) {
    const x = side * .061;
    body.part("octagon", officerBlue, x, .235, .004, .087, .154, .099);
    body.part("bevel", leather, x, .166, -.02, .098, .09, .137);
    body.part("octagon", cloth, side * .123, .396, -.004, .082, .15, .093, -.18, 0, side * .13);
    body.part("octagon", skin, side * .138, .326, -.023, .063, .064, .066);
  }

  body.part("hip", cloth, 0, longCoat ? .337 : .343, .012,
    longCoat ? .299 : .258, longCoat ? .241 : .159, .202);
  body.part("bevel", cloth, 0, .413, .006, .220, .165, .164);
  enamel.part("octagon", enamelLight, 0, .353, .003, .239, .035, .184);
  body.part("octagon", madder, 0, .493, .001, .153, .037, .129);
  const cap = type === "archer" ? "alpine"
    : type === "mindBender" || type === "swordsman" ? "officer" : "field";
  cappedHead(body, cap, .557, -.004);

  switch (type) {
    case "warrior":
      body.beam(walnut, [.141, .277, -.078], [.19, .638, -.099], .05);
      body.part("bevel", brass, .188, .603, -.096, .086, .102, .076, 0, 0, -.13);
      body.beam(ivory, [-.093, .467, -.082], [.074, .356, -.088], .034, .016);
      break;
    case "swordsman":
      sabre(body, .147, .348, .373, 1);
      body.part("bevel", madder, 0, .361, -.088, .177, .038, .018, 0, 0, -.08);
      break;
    case "defender":
      pavise(sculpt);
      body.beam(wood, [.162, .126, .014], [.173, .663, -.032], .029);
      body.part("gem", steel, .174, .708, -.038, .069, .139, .043);
      break;
    case "archer":
      bow(sculpt);
      break;
    case "mindBender":
      body.beam(walnut, [.168, .128, -.083], [.172, .666, -.083], .034);
      body.part("octagon", brass, .172, .641, -.083, .084, .059, .084);
      body.part("gem", ivory, .172, .713, -.083, .102, .135, .102);
      break;
    case "cloak":
      enamel.part("hip", enamelShade, 0, .379, .059, .327, .260, .206, .11);
      body.part("octagon", officerBlue, 0, .510, .012, .189, .074, .163);
      break;
    case "dagger":
      sabre(body, .142, .303, .164, 1);
      sabre(body, -.142, .316, .155, -1);
      break;
  }
}

function cavalry(sculpt: Sculpture, knight: boolean) {
  const { body, enamel } = sculpt;
  plinth(sculpt, .524, .648);
  const horse = knight ? "#c7c5b5" : "#9d7151";
  for (const x of [-.081, .081]) {
    for (const z of [-.134, .141]) {
      const hoof = z + (x > 0 ? .025 : -.025);
      body.beam(horse, [x, .327, z], [x, .157, hoof], .065);
      body.box(leather, x, .142, hoof, .07, .043, .083);
    }
  }
  body.part("bevel", horse, 0, .335, 0, .234, .169, .422);
  body.part("bevel", horse, 0, .454, -.155, .139, .272, .151, -.41);
  body.part("bevel", horse, 0, .548, -.232, .131, .121, .223, .16);
  body.part("bevel", leather, 0, .471, -.105, .062, .220, .106, -.42);
  for (const x of [-.04, .04])
    body.part("spire4", leather, x, .63, -.175, .045, .085, .052);
  body.part("bevel", leather, 0, .306, .221, .066, .167, .094, -.38);
  body.part("bevel", walnut, 0, .534, -.29, .137, .084, .074, .16);

  // A single broad saddlecloth carries the faction colour on the flank.
  enamel.part("bevel", enamelLight, 0, .37, .048, .249, .116, .226);
  body.part("bevel", officerBlue, 0, .519, .052, .185, .168, .142);
  body.part("octagon", madder, 0, .603, .045, .117, .03, .116);
  for (const side of [-1, 1]) {
    body.part("bevel", madder, side * .104, .421, .02, .066, .106, .101);
    body.part("bevel", leather, side * .124, .323, .006, .064, .143, .085, -.18);
    body.beam(officerBlue, [side * .091, .558, .039], [side * .103, .49, -.042], .063);
    body.part("octagon", skin, side * .105, .484, -.052, .05, .052, .052);
  }
  cappedHead(body, knight ? "lancer" : "hussar", .649, .044, .86);
  if (knight) {
    body.beam(wood, [.109, .334, .128], [.156, .729, -.236], .031);
    body.part("gem", steel, .160, .764, -.271, .056, .128, .052, -.76);
    enamel.part("bevel", enamelLight, .148, .671, -.142, .023, .073, .151, -.19);
  } else {
    for (const y of [.515, .556])
      body.box(brass, 0, y, -.024, .119, .017, .015);
    body.beam(walnut, [.102, .480, -.056], [.056, .540, -.260], .018);
  }
}

function siegeEngine(sculpt: Sculpture) {
  const { body, enamel } = sculpt;
  plinth(sculpt, .565, .615);
  for (const x of [-.192, .192]) {
    for (const z of [-.142, .149]) {
      body.part("octagon", ink, x, .205, z, .158, .061, .158, 0, 0, Math.PI / 2);
      body.part("octagon", brass, x * 1.15, .205, z, .08, .028, .08, 0, 0, Math.PI / 2);
    }
    body.beam(walnut, [x * .63, .229, .188], [x * .63, .48, .002], .045);
    body.beam(wood, [x * .63, .229, -.184], [x * .63, .48, .002], .049);
  }
  enamel.part("bevel", enamelLight, 0, .245, 0, .368, .095, .469);
  body.part("octagon", brass, 0, .466, .004, .083, .357, .083, 0, 0, Math.PI / 2);
  body.beam(wood, [0, .27, -.167], [0, .605, .136], .067);
  body.part("bevel", deepSteel, 0, .584, .124, .169, .052, .123, .36);
  body.part("gem", steel, 0, .628, .127, .13, .119, .126);
  body.part("bevel", brass, 0, .29, -.16, .166, .093, .095);
}

function giant(sculpt: Sculpture) {
  const { body, enamel } = sculpt;
  plinth(sculpt, .60);
  for (const side of [-1, 1]) {
    const leg = side * .099;
    body.part("bevel", officerBlue, leg, .283, .009, .139, .219, .154);
    body.part("bevel", leather, leg, .188, -.025, .151, .134, .178);
    body.part("bevel", pikeGrey, side * .209, .537, .006, .153, .237, .174, -.1, 0, side * .11);
    body.part("bevel", leather, side * .224, .391, -.024, .142, .107, .151);
  }
  body.part("hip", pikeGrey, 0, .445, .008, .346, .218, .235);
  body.part("bevel", pikeGrey, 0, .577, .004, .346, .222, .224);
  enamel.part("octagon", enamelLight, 0, .482, .003, .352, .051, .238);
  body.beam(ivory, [-.131, .65, -.100], [.12, .491, -.115], .049, .022);
  body.part("octagon", madder, 0, .697, 0, .194, .046, .177);
  cappedHead(body, "field", .766, -.008, 1.2);
}

type Vessel = "raft" | "dinghy" | "scout" | "bomber" | "rammer" | "juggernaut" | "pirate";
type HullSection = [number, number, number][];

// Width, length and deck height in tiles. The two capital ships deliberately
// share a weight class; small craft keep a lower silhouette at board scale.
const vesselHulls = {
  dinghy: { width: .175, length: .426, deck: .103 },
  pirate: { width: .211, length: .563, deck: .127 },
  rammer: { width: .160, length: .683, deck: .112 },
  scout: { width: .206, length: .735, deck: .153 },
  bomber: { width: .339, length: .972, deck: .226 },
  juggernaut: { width: .350, length: .994, deck: .239 },
};

const armor = "#48585e";
const armorLight = "#83908d";
const cabin = "#dbd1b8";
const teak = "#aa9270";

function navalHull({ body, enamel }: Sculpture, type: keyof typeof vesselHulls) {
  const {width, length, deck} = vesselHulls[type];
  const paddle = type === "scout" || type === "rammer";
  const wooden = paddle || type === "dinghy" || type === "pirate";
  // The lighter sailboats taper to a narrow stem. Keep a separate hull profile
  // for the other ships, with paired corners defining their rounded bow.
  const stations = paddle ? [
    [.035, -.5, .036], [.29, -.433, .023], [.59, -.329, .013],
    [.84, -.211, .006], [1, -.09, 0], [1, .15, 0],
    [.91, .31, .003], [.69, .444, .009], [.47, .5, .014],
  ] : [
    [.24, -.5, .011], [.54, -.487, .010], [.79, -.440, .006], [.97, -.312, .002],
    [1, -.165, 0], [1, .205, 0], [.92, .362, .002], [.71, .465, .004], [.41, .5, .004],
  ];
  function section(beam: number, keelLength: number, y: number, sheer: number): HullSection {
    const half: HullSection = stations.map(([w,z,rise]) =>
      [beam * w * width / 2, y + rise * sheer, z * length * keelLength]);
    return [...half, ...half.map(([x,h,z]): [number,number,number] => [-x,h,z]).reverse()];
  }
  function band(target: Miniature, lower: HullSection, upper: HullSection, tone: string) {
    for (let i = 0; i < lower.length; i++) {
      const j = (i + 1) % lower.length;
      target.face(tone, [lower[i], upper[i], upper[j], lower[j]]);
    }
  }
  const sole = section(.62, .89, .016, .15);
  const bilge = section(.93, .977, deck * .36, .28);
  const waterline = section(1, 1, deck * .5, .4);
  const side = section(.99, 1, deck * .86, .82);
  const rail = section(.94, .999, deck, 1);
  band(body, sole, bilge, wooden ? walnut : "#915e4c");
  band(body, bilge, waterline, wooden ? wood : "#374448");
  band(body, waterline, side, wooden ? walnut : armor);
  band(enamel, side, rail, enamelLight);
  body.face(ink, sole);
  const floor: [number, number, number] = [0, deck, 0];
  for (let i = 0; i < rail.length; i++)
    body.face(wooden ? wood : teak, [floor, rail[(i + 1) % rail.length], rail[i]]);
  return deck;
}

function funnel(body: Miniature, z: number, foot: number, top: number, width: number, rake = 0) {
  const height = top - foot;
  const crownZ = z + Math.sin(rake) * height * .5;
  body.part("octagon", armorLight, 0, foot + .013, z, width * 1.25, .033, width * 1.42);
  body.part("drum", "#c6a171", 0, foot + height * .50, z, width, height, width * 1.17, rake);
  body.part("drum", ink, 0, top - .023, crownZ, width * 1.05, .048, width * 1.23, rake);
  body.part("drum", "#272e31", 0, top + .001, crownZ, width * .73, .006, width * .91, rake);
}

function militaryMast(body: Miniature, z: number, foot: number, top: number, span: number) {
  body.beam(armor, [0, foot, z], [0, top, z], .013);
  body.part("octagon", cabin, 0, top - .089, z, span * .49, .031, .066);
  body.box(armor, 0, top - .043, z, span, .013, .014);
}

function pilothouse({body, enamel}: Sculpture, z: number, foot: number, width: number, depth: number, height: number) {
  body.part("bevel", cabin, 0, foot + height * .37, z, width * .88, height * .75, depth * .92);
  body.part("bevel", ink, 0, foot + height * .78, z, width, height * .22, depth);
  enamel.part("bevel", enamelLight, 0, foot + height * .97, z, width * 1.09, height * .16, depth * 1.05);
}

function deckTurret(body: Miniature, z: number, foot: number, direction: number, paired: boolean) {
  const width = paired ? .154 : .160;
  body.part("octagon", armor, 0, foot + .017, z, width * 1.09, .044, .137);
  body.part("octagon", armorLight, 0, foot + .060, z, width, .066, .129);
  for (const x of paired ? [-.028, .028] : [0]) {
    const bore = paired ? .029 : .044;
    body.part("octagon", armor, x, foot + .080, z + direction * .093,
      bore, .147, bore, Math.PI / 2 - direction * .10);
  }
}

function paddleWheels({ body, enamel }: Sculpture, width: number, radius: number, z: number) {
  const height = radius + .019;
  for (const side of [-1, 1]) {
    const hub = side * (width / 2 + .032);
    // Leave the wheel open between its axle and paddles. The exposed rim and
    // bright paddle tips read as a wheel in a single tile's silhouette.
    body.part("octagon", brass, hub, height, z, .077, .048, .077, 0, 0, Math.PI / 2);
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      const nextAngle = angle + Math.PI / 4;
      const outer: [number, number, number] = [
        hub, height + Math.cos(angle) * radius, z + Math.sin(angle) * radius,
      ];
      const rim = hub + side * .024;
      body.beam(walnut, [hub, height, z], outer, .016, .022);
      body.box(wood, ...outer, .058, .020, .040, angle);
      body.beam(brass, [rim, outer[1], outer[2]],
        [rim, height + Math.cos(nextAngle) * radius, z + Math.sin(nextAngle) * radius], .011);
    }
    enamel.part("octagon", enamelLight, hub + side * .029, height, z,
      .040, .008, .040, 0, 0, Math.PI / 2);
  }
}

type SailPoint = [number, number, number];

function sailCloth(body: Miniature, corners: SailPoint[], center: SailPoint) {
  const shades = ["#ece1c6", "#dfcca7", "#d2b78b", "#e9d9b5"];
  for (let i = 0; i < corners.length; i++) {
    const front = [corners[i], corners[(i + 1) % corners.length], center];
    // Players can see either face as the ship turns to follow its route.
    body.face(shades[i], front);
    body.face(shades[i], front.reverse());
  }
}

function paddleSailboat(sculpt: Sculpture, deck: number, type: "scout" | "rammer") {
  const { body } = sculpt;
  paddleWheels(sculpt, vesselHulls[type].width, type === "scout" ? .103 : .091, .058);
  if (type === "scout") {
    const mast = -.022;
    const throat: SailPoint = [0, .490, mast];
    const peak: SailPoint = [.098, .542, .109];
    const clew: SailPoint = [.154, .252, .241];
    const tack: SailPoint = [0, .268, mast];
    body.beam(walnut, [0, deck, mast], [0, .513, mast], .024);
    body.beam(wood, throat, peak, .019);
    body.beam(wood, tack, clew, .019);
    sailCloth(body, [throat, peak, clew, tack], [.138, .381, .086]);
    sailCloth(body, [[0, .466, mast], [-.107, .225, -.264], [0, .251, mast - .032]],
      [-.035, .305, -.128]);
    pilothouse(sculpt, .205, deck, .117, .095, .063);
    body.beam(wood, [-.063, deck + .053, -.217], [0, deck + .060, -.252], .020);
    body.beam(wood, [.063, deck + .053, -.217], [0, deck + .060, -.252], .020);
    body.beam(armor, [0, deck + .039, -.183], [0, deck + .068, -.293], .026);
    return;
  }

  const yardLeft: SailPoint = [-.112, .406, -.098];
  const yardRight: SailPoint = [.112, .385, -.118];
  body.beam(walnut, [0, deck, -.111], [0, .438, -.092], .022);
  body.beam(wood, yardLeft, yardRight, .018);
  sailCloth(body, [yardLeft, yardRight, [.089, .203, -.154], [-.081, .210, -.165]],
    [.004, .300, -.167]);
  body.part("hip", walnut, 0, deck + .021, -.208, .094, .043, .139);
  body.part("bevel", brass, 0, deck + .030, -.249, .036, .032, .087);
  body.part("bevel", teak, 0, deck + .021, .184, .095, .047, .121);
}

function capitalShip(sculpt: Sculpture, type: "bomber" | "juggernaut", deck: number) {
  const {body, enamel} = sculpt;
  const flagship = type === "juggernaut";
  const width = vesselHulls[type].width;
  // A raised battery deck, not a stack of floating cabins. Boat deck, long
  // funnels and fore/aft stations make the hull read as one continuous ship.
  body.part("bevel", armorLight, 0, deck + .033, .009, width * .87, .084, .506);
  for (const side of [-1, 1]) {
    for (const z of [-.15, 0, .15]) {
      body.part("octagon", armor, side * width * .408, deck + .038, z, .048, .049, .072);
      body.box(ink, side * width * .472, deck + .044, z, .009, .016, .030);
    }
  }
  body.part("bevel", cabin, 0, deck + .085, .009, width * .89, .025, .492);
  body.part("bevel", teak, 0, deck + .100, .009, width * .80, .011, .477);
  const upper = deck + .105;
  pilothouse(sculpt, -.156, upper, width * .59, .111, .090);
  militaryMast(body, -.164, upper + .081, flagship ? .655 : .619, flagship ? .187 : .161);
  if (flagship) {
    funnel(body, -.026, upper, .557, .086);
    funnel(body, .098, upper, .555, .083);
  } else {
    // The bombardment ship has a single broad, raked uptake. Alongside the
    // flagship its role reads from above, even when the guns are foreshortened.
    funnel(body, .028, upper, .538, .123, .095);
    body.part("bevel", armorLight, 0, upper + .026, .149, .090, .054, .067);
  }
  for (const side of [-1, 1]) {
    const x = side * width * .328;
    body.part("hip", cabin, x, upper + .024, .051, .052, .042, .15, Math.PI);
    body.part("bevel", wood, x, upper + .044, .051, .035, .008, .101);
  }
  militaryMast(body, .196, upper, flagship ? .575 : .494, flagship ? .157 : .105);
  deckTurret(body, -.310, deck + .007, -1, flagship);
  deckTurret(body, .307, deck + .007, 1, flagship);
  if (flagship) {
    body.part("octagon", cabin, 0, upper + .031, .193, .109, .061, .096);
    enamel.part("bevel", enamelLight, 0, upper + .069, .193, .129, .025, .096);
  }
}

function navy(sculpt: Sculpture, type: Vessel) {
  const { body, enamel } = sculpt;
  if (type === "raft") {
    for (let i = -2; i <= 2; i++) {
      const trim = Math.abs(i) * .02;
      body.part("octagon", i % 2 ? wood : walnut, i * .060, .051, trim, .068, .448 - trim, .074, Math.PI / 2);
    }
    for (const z of [-.135, .136]) body.box(brass, 0, .09, z, .30, .019, .027);
    enamel.part("bevel", enamelLight, 0, .111, .017, .224, .036, .189);
    body.part("bevel", wood, .021, .153, .069, .093, .054, .081);
    body.beam(walnut, [-.052, .108, .093], [-.052, .291, .093], .019);
    enamel.box(enamelLight, -.052, .267, .130, .015, .050, .079);
    return;
  }

  const deck = navalHull(sculpt, type);
  switch (type) {
    case "scout":
    case "rammer":
      paddleSailboat(sculpt, deck, type);
      break;
    case "bomber":
    case "juggernaut":
      capitalShip(sculpt, type, deck);
      break;
    case "dinghy":
      for (const z of [-.090, .078]) body.box(ivory, 0, deck + .015, z, .139, .024, .034);
      body.part("hip", ink, 0, deck + .065, .039, .099, .111, .096);
      enamel.part("spire", enamelLight, 0, deck + .131, .036, .111, .069, .096);
      body.beam(wood, [-.084, deck + .025, -.103], [-.054, deck + .037, .118], .012);
      break;
    case "pirate":
      body.beam(walnut, [0, deck, .041], [0, .404, .033], .024);
      body.beam(brass, [-.103, .373, .038], [.093, .387, .034], .017);
      enamel.part("bevel", enamelLight, 0, .303, .028, .192, .143, .028, -.11, .13, .073);
      body.box(ivory, 0, .303, .008, .025, .138, .012, -.11, .13, -.46);
      body.part("bevel", ink, 0, deck + .035, .166, .121, .057, .066);
      break;
  }
}

function carve(type: UnitType) {
  const sculpt: Sculpture = { body: new Miniature(), enamel: new Miniature() };
  switch (type) {
    case "rider":
    case "knight":
      cavalry(sculpt, type === "knight");
      break;
    case "catapult":
      siegeEngine(sculpt);
      break;
    case "giant":
      giant(sculpt);
      break;
    case "raft":
    case "dinghy":
    case "scout":
    case "rammer":
    case "bomber":
    case "juggernaut":
    case "pirate":
      navy(sculpt, type);
      break;
    default:
      infantry(sculpt, type);
  }
  return { body: sculpt.body.finish(), enamel: sculpt.enamel.finish() };
}

// Keep one geometry pair per unit type. A colour change never duplicates the
// geometry; silhouettes and ownership still read clearly after an action.
const carvings = new Map<UnitType, ReturnType<typeof carve>>();

export function danubianUnit(type: UnitType) {
  let geometry = carvings.get(type);
  if (!geometry) {
    geometry = carve(type);
    carvings.set(type, geometry);
  }
  return geometry;
}
