import type { UnitType } from "../../../game/types";
import { Miniature } from "../../../scene/miniature";
import { carveDreadnoughtDeck } from "./dreadnought";
import { carveLightVessel } from "./lightVessels";

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

function plinth({ enamel }: Sculpture, width: number, depth = width) {
  enamel.part("drum", "#ffffff", 0, .025, 0, width, .05, depth);
  enamel.part("drum", "#ffffff", 0, .055, 0, width * .99, .014, depth * .99);
  enamel.part("drum", "#ffffff", 0, .082, 0, width * .94, .042, depth * .94);
  enamel.part("drum", "#ffffff", 0, .109, 0, width * .83, .018, depth * .83);
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
type HullStation = readonly [beam: number, length: number, rise: number];

const bomberProfile: readonly HullStation[] = [
  [.24, -.5, .011], [.54, -.487, .010], [.79, -.440, .006], [.97, -.312, .002],
  [1, -.165, 0], [1, .205, 0], [.92, .362, .002], [.71, .465, .004], [.41, .5, .004],
];
const dreadnoughtProfile: readonly HullStation[] = [
  [.36, -.5, .021], [.66, -.475, .017], [.91, -.386, .010],
  [1, -.210, 0], [1, .254, 0], [.95, .385, .002], [.75, .473, .008], [.47, .5, .010],
];
const openBoatProfile: readonly HullStation[] = [
  [.16, -.5, .027], [.51, -.447, .015], [.81, -.324, .008],
  [1, -.117, 0], [.96, .169, .002], [.75, .393, .012], [.53, .5, .017],
];
const cutterProfile: readonly HullStation[] = [
  [.12, -.5, .028], [.42, -.438, .019], [.73, -.319, .006],
  [1, -.093, 0], [.97, .236, .004], [.84, .399, .016], [.70, .5, .030],
];

const vesselHulls = {
  dinghy: { width: .175, length: .426, deck: .097, stations: openBoatProfile },
  pirate: { width: .211, length: .563, deck: .127, stations: cutterProfile },
  bomber: { width: .270, length: .972, deck: .226, stations: bomberProfile },
  juggernaut: { width: .350, length: .994, deck: .239, stations: dreadnoughtProfile },
};

const armor = "#48585e";
const armorLight = "#83908d";
const teak = "#aa9270";

function navalHull({ body, enamel }: Sculpture, type: keyof typeof vesselHulls) {
  const { width, length, deck, stations } = vesselHulls[type];
  const wooden = type === "dinghy" || type === "pirate";
  function section(beam: number, keelLength: number, y: number, sheer: number): HullSection {
    const half: HullSection = stations.map(([w, z, rise]) =>
      [beam * w * width / 2, y + rise * sheer, z * length * keelLength]);
    return [...half, ...half.map(([x, h, z]): [number, number, number] => [-x, h, z]).reverse()];
  }
  function band(target: Miniature, lower: HullSection, upper: HullSection, tone: string) {
    for (let i = 0; i < lower.length; i++) {
      const j = (i + 1) % lower.length;
      target.face(tone, [lower[i], upper[i], upper[j], lower[j]]);
    }
  }
  const sole = section(.62, .89, .016, .15);
  const bilge = section(.93, .977, deck * .36, .28);
  const waterline = section(1, 1, deck * .50, .4);
  const upperSide = section(.99, 1, deck * .83, .82);
  const gunwale = section(.98, .999, deck * .92, .95);
  const rail = section(.94, .999, deck, 1);
  band(body, sole, bilge, wooden ? walnut : "#794936");
  band(body, bilge, waterline, wooden ? wood : "#293b47");
  band(body, waterline, upperSide, wooden ? walnut : type === "juggernaut" ? "#445d6b" : armor);
  band(enamel, upperSide, gunwale, enamelLight);
  band(body, gunwale, rail, wooden ? "#c09b63" : "#9eadae");
  body.face(ink, sole);
  const floor: [number, number, number] = [0, deck, 0];
  for (let i = 0; i < rail.length; i++)
    body.face(wooden ? wood : teak, [floor, rail[(i + 1) % rail.length], rail[i]]);
  return deck;
}

function bombardmentDeck({ body, enamel }: Sculpture, deck: number) {
  // Low casemate, one oversized forward gun and a wide raked stack.
  body.part("bevel", "#5a7079", 0, deck + .032, .012, .224, .063, .434);
  body.part("bevel", "#b2aba0", 0, deck + .071, -.102, .172, .025, .201);
  body.part("hip", armorLight, 0, deck + .106, -.118, .144, .062, .126);
  body.box("#253541", 0, deck + .124, -.177, .107, .017, .013);
  enamel.part("bevel", enamelLight, 0, deck + .14, -.118, .142, .019, .116);
  body.part("octagon", "#4a5d65", 0, deck + .026, -.309, .180, .054, .146);
  body.part("bevel", "#bcc4bc", 0, deck + .070, -.311, .156, .060, .126);
  body.beam(armor, [0, deck + .078, -.351], [0, deck + .110, -.478], .046);
  body.part("octagon", ink, 0, deck + .108, -.455, .052, .032, .050, Math.PI / 2);

  body.part("octagon", armorLight, 0, deck + .083, .043, .154, .042, .140);
  body.part("drum", "#bd985f", 0, deck + .182, .054, .119, .188, .128, .095);
  body.part("drum", "#303b3c", 0, deck + .267, .064, .128, .053, .136, .095);
  body.part("drum", "#232a30", 0, deck + .291, .066, .097, .007, .103, .095);
  body.beam(armor, [0, deck + .144, -.117], [0, .601, -.117], .016);
  body.beam(armor, [-.061, .548, -.117], [.061, .548, -.117], .012);
  for (const side of [-1, 1]) {
    for (const z of [-.135, -.038, .147]) {
      body.part("bevel", "#91a2a5", side * .105, deck + .030, z, .023, .050, .058);
      body.box(ink, side * .118, deck + .040, z, .006, .012, .031);
    }
    body.part("hip", "#ded0b1", side * .082, deck + .077, .174, .043, .040, .126, Math.PI);
    body.box(wood, side * .082, deck + .097, .174, .021, .008, .093);
  }
  body.part("bevel", armor, 0, deck + .030, .315, .104, .061, .087);
  body.beam(armorLight, [0, deck + .068, .321], [0, deck + .077, .426], .025);
  body.box(teak, 0, deck + .013, .420, .092, .021, .044);
}

function raftDeck({ body, enamel }: Sculpture) {
  for (let i = -2; i <= 2; i++) {
    const trim = Math.abs(i) * .024;
    body.part("octagon", i % 2 ? wood : walnut, i * .060, .051, trim, .068, .448 - trim, .074, Math.PI / 2);
  }
  for (const z of [-.140, .133]) {
    body.box(wood, 0, .094, z, .305, .026, .044);
    for (const x of [-.116, .110]) {
      body.box(ivory, x, .109, z - .012, .018, .016, .066, 0, -.24);
      body.box(brass, x + .015, .109, z + .010, .018, .016, .061, 0, .10);
    }
  }
  for (const x of [-.067, 0, .067]) {
    body.box(teak, x, .106, -.017, .066, .016, .216);
  }
  body.part("bevel", walnut, .051, .144, .044, .081, .068, .076);
  body.box(brass, .051, .182, .044, .071, .010, .011);
  body.part("octagon", "#a18051", -.012, .136, .092, .057, .051, .065, 0, 0, .22);
  body.beam(walnut, [-.071, .101, .071], [-.071, .302, .071], .017);
  enamel.face(enamelLight, [[-.070,.293,.068], [-.070,.235,.068], [-.060,.268,.183]]);
  enamel.face(enamelLight, [[-.060,.268,.183], [-.070,.235,.068], [-.070,.293,.068]]);
  body.beam(walnut, [.081,.109,.090], [.181,.059,.191], .012);
  body.part("bevel", wood, .169, .057, .181, .038, .012, .086, 0, .50);
}

function dinghyDeck({ body, enamel }: Sculpture, deck: number) {
  for (const z of [-.085, .080])
    body.box(ivory, 0, deck + .015, z, .136, .024, .033);
  body.part("bevel", "#c0a078", 0, deck + .012, -.013, .110, .020, .102);
  for (const side of [-1, 1]) {
    body.beam(walnut, [side*.019, deck + .027, -.040], [side*.111, .061, .096], .012);
    body.part("bevel", wood, side*.110, .060, .101, .028, .013, .061, 0, -side * .46);
    body.box(brass, side*.077, deck + .026, .025, .019, .025, .018);
  }
  // A hooded figure and covered gear give the rowboat a low silhouette.
  body.part("hip", ink, 0, deck + .061, .035, .086, .103, .088);
  enamel.part("spire", enamelLight, 0, deck + .120, .033, .098, .068, .088);
  body.part("bevel", "#57483a", 0, deck + .020, -.132, .073, .035, .070);
}

function pirateDeck({ body, enamel }: Sculpture, deck: number) {
  body.part("bevel", walnut, 0, deck + .030, .164, .148, .069, .156);
  enamel.part("bevel", enamelLight, 0, deck + .069, .164, .157, .018, .156);
  for (const side of [-1, 1]) {
    body.box(brass, side * .044, deck + .040, .245, .026, .018, .014);
    body.box("#272c36", side * .071, deck + .040, .010, .026, .026, .036);
    body.beam(armor, [side * .058, deck + .045, .010], [side * .106, deck + .051, .012], .019);
  }
  body.beam(walnut, [0, deck, .044], [0, .473, .038], .022);
  body.beam(walnut, [0, deck + .034, -.176], [0, .215, -.316], .016);
  body.beam(brass, [-.114, .375, .038], [.105, .390, .024], .016);
  const cloth: [number, number, number][] = [
    [-.105, .372, .037], [-.080, .200, -.006], [.087, .212, -.022], [.099, .385, .027],
  ];
  const crease: [number, number, number] = [.008, .278, -.058];
  for (let i = 0; i < cloth.length; i++) {
    const seam = [cloth[i], cloth[(i + 1) % cloth.length], crease];
    enamel.face(i % 2 ? "#8d8785" : "#cfc7b8", seam);
    enamel.face(i % 2 ? "#8d8785" : "#cfc7b8", seam.reverse());
  }
  body.face("#313b43", [[0,.467,.035], [0,.412,.035], [.065,.431,.105]]);
  body.face("#313b43", [[.065,.431,.105], [0,.412,.035], [0,.467,.035]]);
}

function navy(sculpt: Sculpture, type: Vessel) {
  switch (type) {
    case "raft":
      raftDeck(sculpt);
      break;
    case "scout":
    case "rammer":
      carveLightVessel(sculpt, type);
      break;
    case "bomber":
      bombardmentDeck(sculpt, navalHull(sculpt, type));
      break;
    case "juggernaut":
      carveDreadnoughtDeck(sculpt, navalHull(sculpt, type), vesselHulls[type].width);
      break;
    case "dinghy":
      dinghyDeck(sculpt, navalHull(sculpt, type));
      break;
    case "pirate":
      pirateDeck(sculpt, navalHull(sculpt, type));
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
