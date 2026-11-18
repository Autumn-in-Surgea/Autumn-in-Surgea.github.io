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
  const x = -.146;
  const y = .404;
  const z = -.139;
  body.part("bevel", brass, x, y, z, .237, .342, .046);
  enamel.part("bevel", enamelShade, x, y, z - .022, .21, .312, .019);
  body.part("bevel", steel, x, y, z - .036, .033, .253, .014);
  body.part("octagon", brass, x, y + .018, z - .041, .06, .025, .06, Math.PI / 2);
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
  const grip: [number, number, number] = [.208, .421, -.158];
  const upper: [number, number, number] = [.118, .733, -.125];
  const lower: [number, number, number] = [.108, .153, -.125];
  const shoulder: [number, number, number] = [.229, .555, -.154];
  const foot: [number, number, number] = [.216, .287, -.154];
  body.beam(wood, grip, shoulder, .037);
  body.beam(brass, shoulder, upper, .028);
  body.beam(wood, grip, foot, .037);
  body.beam(brass, foot, lower, .028);
  body.beam(ivory, upper, lower, .012);
  body.beam(walnut, [-.076, .351, .121], [.061, .569, .146], .066, .060);
  body.beam(brass, [.041, .541, .149], [.064, .576, .149], .076, .063);
  for (const dx of [-.012, .021])
    body.beam(ivory, [.046 + dx, .561, .151], [.074 + dx, .649, .163], .014);
}

const pikeGrey = "#587c90";
const capBlue = "#4d7087";
const officerBlue = "#2b465f";
const trouserBlue = "#344c64";
const collarRed = "#94483f";
const bootLeather = "#322c31";
const harness = "#d0a978";
const warmCanvas = "#dfc299";
const skin = "#edc4a3";
const beardBrown = "#655149";

type CapStyle = "field" | "officer" | "alpine" | "hussar" | "lancer";
type Point = [number, number, number];

function cappedHead(body: Miniature, style: CapStyle, y: number, z = 0,
  scale = 1, beard?: string) {
  const part = (shape: Parameters<Miniature["part"]>[0], color: string,
    x: number, dy: number, dz: number, w: number, h: number, d: number, rx = 0, ry = 0, rz = 0) =>
    body.part(shape, color, x * scale, y + dy * scale, z + dz * scale,
      w * scale, h * scale, d * scale, rx, ry, rz);

  part("bevel", skin, 0, .005, -.009, .124, .125, .123);
  if (beard) part("bevel", beard, 0, -.042, -.054, .096, .053, .058, .16);

  if (style === "hussar" || style === "lancer") {
    const shako = style === "hussar";
    part("bevel", bootLeather, 0, .060, -.051, .148, .016, .143, .09);
    part("octagon", shako ? collarRed : officerBlue, 0, .108, .004,
      .145, shako ? .100 : .089, .145);
    if (shako) {
      part("octagon", officerBlue, 0, .166, .005, .166, .020, .157);
      part("gem", ivory, -.049, .171, -.027, .039, .093, .041, -.22, 0, -.18);
    } else {
      part("hip", "#556d82", 0, .157, .003, .143, .037, .141, Math.PI, .72);
      part("bevel", officerBlue, 0, .182, .003, .179, .015, .177, 0, .72);
    }
    return;
  }

  if (style === "officer") {
    part("octagon", bootLeather, 0, .062, -.043, .154, .018, .153, .10);
    part("octagon", collarRed, 0, .084, 0, .150, .024, .144);
    part("octagon", officerBlue, 0, .116, .006, .184, .048, .162, -.13);
    return;
  }

  // Short peak and folded side flaps, with seams picked out in a lighter wool.
  const alpine = style === "alpine";
  const crown = alpine ? "#61766f" : capBlue;
  const fold = alpine ? "#91a393" : "#86a8ba";
  part("bevel", bootLeather, 0, .062, -.059, .145, .019, .133, .15);
  const point = (x: number, dy: number, dz: number): Point =>
    [x * scale, y + dy * scale, z + dz * scale];
  const outline = [[-.045,-.075],[.045,-.075],[.074,-.049],[.076,.033],
    [.050,.070],[-.050,.070],[-.076,.033],[-.074,-.049]];
  const lower = outline.map(([x, dz]) => point(x, .068, dz));
  const flap = outline.map(([x, dz]) => point(x, .096 + dz * .13, dz));
  const ridge = outline.map(([x, dz]) => point(x * .75, .138 - dz * .18, dz * .93));
  const crease = point(0, .129, .006);
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    body.face(fold, [lower[i], flap[i], flap[j], lower[j]]);
    body.face(crown, [flap[i], ridge[i], ridge[j], flap[j]]);
    body.face(crown, [ridge[j], ridge[i], crease]);
  }
  if (alpine) part("bevel", "#a58b62", -.067, .125, .023, .021, .085, .027, .42, 0, -.3);
}

function fieldJacket(body: Miniature, wool: string, waist: number, z: number, scale = 1) {
  const outline = [[-.36, -.5], [.36, -.5], [.5, -.33], [.5, .33],
    [.36, .5], [-.36, .5], [-.5, .33], [-.5, -.33]];
  const profile = [
    [-.064, .188, .143], [0, .150, .127], [.105, .204, .151], [.143, .175, .132],
  ];
  const rings = profile.map(([y, w, d]) => outline.map(([x, dz]): Point =>
    [x * w * scale, waist + y * scale, z + dz * d * scale]));
  body.face(wool, rings[0]);
  for (let ring = 1; ring < rings.length; ring++) {
    for (let i = 0; i < outline.length; i++) {
      const j = (i + 1) % outline.length;
      body.face(wool, [rings[ring - 1][i], rings[ring][i], rings[ring][j], rings[ring - 1][j]]);
    }
  }
  body.face(wool, rings[rings.length - 1].slice().reverse());
  body.part("octagon", collarRed, 0, waist + .151 * scale, z, .108 * scale, .026 * scale, .107 * scale);
  body.part("bevel", bootLeather, 0, waist + .003 * scale, z, .160 * scale, .028 * scale, .145 * scale);
  body.box(harness, 0, waist + .003 * scale, z - .076 * scale, .037 * scale, .025 * scale, .014 * scale);
  body.box(harness, 0, waist + .071 * scale, z - .077 * scale, .011 * scale, .075 * scale, .011 * scale);
}

function fieldLegs(body: Miniature, waist: number, scale = 1) {
  const floor = .119;
  const shin = floor + .089 * scale;
  // Match the centre spacing to the sole width so the boots meet at the seam.
  for (const side of [-1, 1]) {
    const x = side * .035 * scale;
    body.part("bevel", trouserBlue, x, (waist + shin) / 2, 0,
      .069 * scale, waist - shin, .082 * scale, .065);
    body.part("bevel", bootLeather, x, floor + .064 * scale, -.013 * scale,
      .068 * scale, .105 * scale, .074 * scale);
    body.part("bevel", bootLeather, x, floor + .022 * scale, -.028 * scale,
      .070 * scale, .041 * scale, .111 * scale);
    body.part("bevel", harness, x, shin + .005 * scale, -.016 * scale,
      .067 * scale, .017 * scale, .077 * scale);
  }
}

function arm(body: Miniature, wool: string, from: Point, elbow: Point, hand: Point, scale = 1, glove = skin) {
  body.beam(wool, from, elbow, .061 * scale, .072 * scale);
  body.beam(wool, elbow, hand, .055 * scale, .059 * scale);
  body.part("bevel", wool, ...from, .074 * scale, .061 * scale, .075 * scale);
  body.part("octagon", glove, ...hand, .045 * scale, .053 * scale, .048 * scale);
}

function infantry(sculpt: Sculpture, type: Infantry) {
  const { body, enamel } = sculpt;
  const wool = type === "dagger" || type === "swordsman" ? officerBlue
    : type === "archer" ? "#53726d" : type === "mindBender" ? "#577494" : pikeGrey;
  plinth(sculpt, .49);
  fieldLegs(body, .437);
  fieldJacket(body, wool, .438, .008);

  const hands: Record<Infantry, [Point, Point]> = {
    warrior: [[-.102, .387, -.072], [.148, .418, -.087]],
    swordsman: [[-.116, .389, -.045], [.151, .419, -.094]],
    defender: [[-.134, .413, -.112], [.155, .428, -.068]],
    archer: [[-.080, .482, -.139], [.208, .421, -.158]],
    mindBender: [[-.104, .388, -.059], [.162, .437, -.095]],
    cloak: [[-.105, .384, -.026], [.112, .395, -.039]],
    dagger: [[-.147, .367, -.094], [.143, .362, -.094]],
  };
  for (const side of [-1, 1]) {
    const hand = hands[type][side === -1 ? 0 : 1];
    arm(body, wool, [side * .091, .548, .009], [side * .127, .466, .008], hand);
    body.part("bevel", warmCanvas, side * .076, .568, .009, .044, .015, .065, 0, 0, side * -.15);
  }

  const hasLongCoat = type === "cloak" || type === "mindBender";
  if (hasLongCoat) {
    for (const side of [-1, 1])
      body.part("bevel", wool, side * .068, .371, .021, .085, .157, .153, .035, 0, side * .10);
  }
  const cap = type === "archer" ? "alpine"
    : type === "mindBender" || type === "swordsman" ? "officer" : "field";
  const beard = type === "swordsman" ? beardBrown : type === "mindBender" ? "#aaa094" : undefined;
  cappedHead(body, cap, .644, 0, 1, beard);

  switch (type) {
    case "warrior":
      body.beam(walnut, [.144, .324, -.083], [.182, .659, -.121], .031);
      body.part("bevel", steel, .200, .641, -.122, .098, .075, .049, 0, 0, -.13);
      body.part("bevel", ivory, .242, .636, -.122, .021, .061, .043, 0, 0, -.13);
      body.beam(warmCanvas, [-.071, .553, -.072], [.059, .449, -.076], .024, .015);
      body.part("bevel", harness, -.085, .422, .074, .061, .062, .067);
      break;
    case "swordsman":
      sabre(body, .151, .394, .360, 1);
      body.beam(bootLeather, [-.104, .430, .017], [-.153, .272, .093], .033, .028);
      break;
    case "defender":
      pavise(sculpt);
      body.beam(wood, [.146, .136, -.025], [.168, .712, -.101], .028);
      body.part("gem", steel, .169, .748, -.106, .059, .116, .039);
      break;
    case "archer":
      bow(sculpt);
      body.beam(warmCanvas, [.074, .547, -.072], [-.062, .448, -.079], .022, .015);
      break;
    case "mindBender":
      body.beam(walnut, [.161, .138, -.089], [.162, .738, -.096], .032);
      body.part("octagon", brass, .162, .711, -.096, .068, .043, .065);
      body.part("gem", ivory, .162, .759, -.096, .090, .104, .090);
      body.beam(warmCanvas, [.045, .548, -.074], [.080, .453, -.079], .024, .016);
      break;
    case "cloak":
      enamel.part("hip", enamelShade, 0, .445, .061, .275, .255, .174, .10);
      body.part("bevel", officerBlue, 0, .560, .065, .136, .090, .131);
      break;
    case "dagger":
      sabre(body, .143, .337, .169, 1);
      sabre(body, -.147, .342, .157, -1);
      body.part("bevel", collarRed, 0, .509, -.077, .109, .029, .021, 0, 0, -.08);
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
      body.box(bootLeather, x, .142, hoof, .07, .043, .083);
    }
  }
  body.part("bevel", horse, 0, .335, 0, .234, .169, .422);
  body.part("bevel", horse, 0, .454, -.155, .139, .272, .151, -.41);
  body.part("bevel", horse, 0, .548, -.232, .131, .121, .223, .16);
  body.beam(bootLeather, [0, .396, -.080], [0, .583, -.160], .049, .070);
  for (const x of [-.04, .04])
    body.part("spire4", horse, x, .618, -.177, .032, .073, .041);
  body.part("bevel", bootLeather, 0, .306, .221, .054, .169, .082, -.38);
  body.part("bevel", bootLeather, 0, .535, -.285, .137, .055, .033, .24);
  body.part("bevel", brass, 0, .518, -.311, .143, .012, .014);
  body.part("bevel", bootLeather, 0, .430, .079, .144, .042, .149);

  // A single broad saddlecloth carries the faction colour on the flank.
  enamel.part("bevel", enamelLight, 0, .37, .048, .249, .116, .226);
  const wool = knight ? "#355b74" : officerBlue;
  fieldJacket(body, wool, .466, .052, .97);
  for (const side of [-1, 1]) {
    body.part("bevel", knight ? trouserBlue : collarRed, side * .087, .425, .021, .062, .109, .100, -.25);
    body.part("bevel", bootLeather, side * .120, .340, .004, .054, .123, .068, -.18);
    body.part("bevel", brass, side * .136, .294, -.020, .026, .029, .052);
    arm(body, wool, [side * .094, .566, .052], [side * .136, .504, .038],
      [side * .109, .485, -.053], .93, warmCanvas);
    body.beam(bootLeather, [side * .109, .485, -.053], [side * .063, .518, -.276], .013);
    body.part("bevel", harness, side * .081, .583, .052, .036, .015, .065);
  }
  cappedHead(body, knight ? "lancer" : "hussar", .657, .040, .94);
  if (knight) {
    body.beam(wood, [.109, .334, .128], [.156, .729, -.236], .031);
    body.part("gem", steel, .160, .764, -.271, .056, .128, .052, -.76);
    enamel.part("bevel", enamelLight, .148, .671, -.142, .023, .073, .151, -.19);
  } else {
    for (const y of [.509, .531, .553])
      body.box(harness, 0, y, -.024, .111, .010, .018);
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
  const { body } = sculpt;
  plinth(sculpt, .60);
  fieldLegs(body, .563, 1.57);
  fieldJacket(body, "#4e7283", .560, .003, 1.55);
  for (const side of [-1, 1]) {
    arm(body, pikeGrey, [side * .151, .735, .007], [side * .180, .598, .019],
      [side * .175, .467, -.055], 1.53, bootLeather);
    body.part("bevel", brass, side * .134, .758, .004, .077, .032, .073);
    body.part("bevel", steel, side * .179, .477, -.084, .083, .069, .034);
  }
  body.beam(warmCanvas, [-.112, .741, -.116], [.091, .568, -.121], .037, .024);
  body.part("bevel", walnut, .111, .542, .126, .117, .101, .087);
  cappedHead(body, "field", .857, -.004, 1.24, beardBrown);
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
