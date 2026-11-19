import type { UnitType } from "../../../game/types";
import { Miniature } from "../../../scene/miniature";
import { carveDreadnoughtDeck } from "./dreadnought";
import { carveLightVessel, foldedPennant } from "./lightVessels";

// Sculpt the walnut, ivory and metal once. A second mesh carries the enamel
// inlay so every faction shares the same carving, including exhausted pieces.
const ink = "#344247";
const walnut = "#624937";
const wood = "#ab825a";
const brass = "#c9a45c";
const ivory = "#efdfbc";
const steel = "#b9cccb";
const deepSteel = "#60767a";
const enamelLight = "#ffffff";

type Sculpture = { body: Miniature; enamel: Miniature };
type Infantry = "warrior" | "defender" | "archer" | "swordsman" | "mindBender" | "cloak" | "dagger";
type Point = [number, number, number];

function plinth({ body, enamel }: Sculpture, diameter: number) {
  const sections = 24;
  const ring = (radius: number, y: number) => Array.from({ length: sections }, (_, i): Point => {
    const angle = 2 * Math.PI * i / sections;
    return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
  });
  const radius = diameter / 2;
  const base = ring(radius, 0);
  const edge = ring(radius, .096);
  const shoulder = ring(radius, .112);
  const lip = ring(radius - .006, .118);
  const inner = ring(radius - .024, .118);
  enamel.face(enamelLight, base);
  for (let i = 0; i < sections; i++) {
    const next = (i + 1) % sections;
    enamel.face(enamelLight, [base[i], edge[i], edge[next], base[next]]);
    enamel.face(enamelLight, [[0, .118, 0], inner[next], inner[i]]);
    body.face("#b98c46", [edge[i], shoulder[i], shoulder[next], edge[next]]);
    body.face("#ebcc82", [shoulder[i], lip[i], lip[next], shoulder[next]]);
    body.face("#dfb65f", [lip[i], inner[i], inner[next], lip[next]]);
  }
}

function entrenchingSpade(body: Miniature) {
  const foot: Point = [.246, .315, -.030];
  const grip: Point = [.192, .620, .061];
  body.beam(wood, foot, grip, .036, .033);
  body.beam(deepSteel, [.243, .299, -.036], [.239, .367, -.014], .052, .039);
  const left: Point = [.130, .674, .065];
  const right: Point = [.232, .694, .072];
  body.beam(walnut, grip, left, .025);
  body.beam(walnut, grip, right, .025);
  body.beam(harness, left, right, .028);

  const outline: Point[] = [[.169, .309, -.034], [.303, .333, -.038], [.326, .273, -.049],
    [.311, .213, -.069], [.268, .177, -.081], [.218, .197, -.074], [.179, .253, -.053]];
  const back: Point = [.246, .266, -.033];
  const dish: Point = [.253, .261, -.080];
  for (let i = 0; i < outline.length; i++) {
    const next = (i + 1) % outline.length;
    body.face(i < 2 ? "#849b8d" : steel, [outline[next], outline[i], back]);
    body.face(i < 2 ? steel : "#e0ebdf", [outline[i], outline[next], dish]);
  }
}

function fieldRifle(body: Miniature, butt: Point, muzzle: Point, kind: "carbine" | "marksman" | "bayonet" = "carbine") {
  const dx = muzzle[0] - butt[0], dy = muzzle[1] - butt[1], dz = muzzle[2] - butt[2];
  const flat = Math.hypot(dx, dz), length = Math.hypot(flat, dy);
  const point = (t: number, up = 0, side = 0): Point => [
    butt[0] + dx * t - dx * dy / (length * flat) * up - dz / flat * side,
    butt[1] + dy * t + flat / length * up,
    butt[2] + dz * t - dz * dy / (length * flat) * up + dx / flat * side,
  ];
  const stock = [[0, .050, .024], [.15, .063, .032], [.38, .033, .025], [.67, .021, .019]]
    .map(([t, width, depth]) => [point(t, -width, -depth), point(t, width * .62, -depth),
      point(t, width * .62, depth), point(t, -width, depth)]);
  body.face(deepSteel, stock[0].slice().reverse());
  for (let r = 1; r < stock.length; r++) {
    for (let i = 0; i < 4; i++) {
      const next = (i + 1) % 4;
      const [a, b, c, d] = [stock[r - 1][i], stock[r][i], stock[r][next], stock[r - 1][next]];
      body.face(i === 1 ? "#d3a16e" : wood, [a, c, b]);
      body.face(i === 1 ? wood : walnut, [a, d, c]);
    }
  }
  body.face(walnut, stock[stock.length - 1]);
  body.beam(ink, point(.33), muzzle, .032, .031);
  body.beam(deepSteel, point(.44, .012, -.016), point(.98, .012, -.016), .014);
  body.beam(steel, point(.62), point(.71), .044, .047);
  body.beam(ink, point(.39), point(.47, -.029), .049, .042);
  if (kind === "marksman") {
    body.beam(steel, point(.40, .01), point(.40, .060), .023);
    body.beam(steel, point(.63, .009), point(.63, .060), .023);
    body.beam("#293b45", point(.26, .068), point(.73, .068), .037);
    body.beam("#849d9c", point(.26, .068), point(.33, .068), .049);
    body.beam("#9db3ad", point(.66, .068), point(.76, .068), .048);
    body.beam("#263b4b", point(.76, .068), point(.775, .068), .032);
  } else if (kind === "bayonet") {
    const edge = point(.94, .077), spine = point(.95, -.028);
    const tip = point(1.47, .030), ridge = point(1.10, .027, -.029);
    const reverse = point(1.14, .028, .023);
    body.face("#f1f5e6", [edge, tip, ridge]);
    body.face(steel, [ridge, tip, spine]);
    body.face(steel, [spine, tip, reverse]);
    body.face("#f1f5e6", [reverse, tip, edge]);
    body.face(deepSteel, [edge, ridge, spine, reverse]);
  }
}

const capBlue = "#4d7087";
const officerBlue = "#2b465f";
const collarRed = "#94483f";
const bootLeather = "#322c31";
const harness = "#d0a978";
const warmCanvas = "#dfc299";
const skin = "#edc4a3";

type CapStyle = "field" | "officer" | "alpine";

function cappedHead(body: Miniature, style: CapStyle, y: number, z = 0,
  scale = 1, beard?: string) {
  const part = (shape: Parameters<Miniature["part"]>[0], color: string,
    x: number, dy: number, dz: number, w: number, h: number, d: number, rx = 0, ry = 0, rz = 0) =>
    body.part(shape, color, x * scale, y + dy * scale, z + dz * scale,
      w * scale, h * scale, d * scale, rx, ry, rz);

  part("bevel", skin, 0, .005, -.009, .124, .125, .123);
  if (beard) part("bevel", beard, 0, -.042, -.054, .096, .053, .058, .16);

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
      const [a, b, c, d] = [rings[ring - 1][i], rings[ring][i], rings[ring][j], rings[ring - 1][j]];
      body.face(wool, [a, b, c]);
      body.face(wool, [a, c, d]);
    }
  }
  body.face(wool, rings[rings.length - 1].slice().reverse());
  body.part("octagon", collarRed, 0, waist + .151 * scale, z, .108 * scale, .026 * scale, .107 * scale);
  body.part("bevel", bootLeather, 0, waist + .003 * scale, z, .160 * scale, .028 * scale, .145 * scale);
  body.box(harness, 0, waist + .003 * scale, z - .076 * scale, .037 * scale, .025 * scale, .014 * scale);
  // Folded lapels and a darted seam catch light without thick raised blocks.
  const front = (x: number, y: number, dz: number): Point => [x * scale, waist + y * scale, z + dz * scale];
  for (const side of [-1, 1]) {
    const collar = front(side * .043, .151, -.062);
    const shoulder = front(side * .079, .117, -.083);
    const tip = front(side * .014, .067, -.080);
    const fold = front(side * .046, .114, -.091);
    const outer = [collar, shoulder, fold];
    const inner = [collar, fold, tip];
    body.face("#7993a4", side === -1 ? outer.reverse() : outer);
    body.face(wool, side === -1 ? inner.reverse() : inner);
  }
  for (const y of [.036, .058])
    body.part("gem", brass, 0, waist + y * scale, z - .073 * scale, .012 * scale, .015 * scale, .011 * scale);
}

function arm(body: Miniature, wool: string, from: Point, elbow: Point, hand: Point, scale = 1, glove = skin) {
  body.beam(wool, from, elbow, .061 * scale, .072 * scale);
  body.beam(wool, elbow, hand, .055 * scale, .059 * scale);
  body.part("bevel", wool, ...from, .074 * scale, .061 * scale, .075 * scale);
  body.part("octagon", glove, ...hand, .045 * scale, .053 * scale, .048 * scale);
}

const infantryUniforms: Record<Infantry, [coat: string, cap: string, trousers: string]> = {
  warrior: ["#b89e5e", "#8c793f", "#6f6546"],
  archer: ["#406554", "#30483b", "#3e5146"],
  defender: ["#6caa9e", "#526d63", "#506960"],
  swordsman: ["#903e46", "#67414a", "#50434b"],
  mindBender: ["#dfd5b5", "#b9ab87", "#586367"],
  cloak: ["#4c4a61", "#333548", "#363849"],
  dagger: ["#b8673f", "#83513c", "#644d45"],
};

const infantryHands: Record<Infantry, [Point, Point]> = {
  warrior: [[-.065, .558, -.141], [.088, .423, -.127]],
  archer: [[-.030, .538, -.218], [.090, .500, -.034]],
  defender: [[-.106, .368, -.046], [.223, .454, .013]],
  swordsman: [[-.013, .494, -.085], [.054, .435, -.014]],
  mindBender: [[-.152, .475, -.095], [.097, .391, -.076]],
  cloak: [[-.068, .469, -.181], [.068, .464, -.180]],
  dagger: [[-.151, .514, -.124], [.095, .386, -.069]],
};

export const rifleMuzzle: Point = [-.045, .571, -.423];

function medicalCase(body: Miniature) {
  const side = -.158;
  body.part("bevel", "#ede7ce", side, .350, -.113, .156, .181, .130);
  body.part("bevel", "#b3a78a", side, .421, -.113, .157, .050, .133);
  body.beam(bootLeather, [side - .040, .461, -.098], [side + .038, .461, -.098], .023);
  body.beam(bootLeather, [side - .040, .431, -.098], [side - .040, .461, -.098], .017);
  body.beam(bootLeather, [side + .038, .431, -.098], [side + .038, .461, -.098], .017);
  body.box(collarRed, side, .344, -.180, .091, .075, .012);
  body.box(collarRed, side - .079, .344, -.113, .012, .075, .062);
  body.box(ivory, side, .345, -.188, .055, .021, .010);
  body.box(ivory, side, .345, -.188, .021, .052, .010);
  body.box(brass, side, .406, -.181, .029, .028, .016);
}

function binoculars(body: Miniature) {
  body.box(ink, 0, .493, -.210, .104, .046, .098);
  for (const side of [-1, 1]) {
    const x = side * .055;
    body.part("octagon", "#303747", x, .498, -.208, .077, .151, .077, Math.PI / 2);
    body.part("octagon", brass, x, .498, -.281, .091, .031, .091, Math.PI / 2);
    body.part("octagon", "#556d93", x, .498, -.299, .066, .014, .066, Math.PI / 2);
    body.part("octagon", "#a6a9ae", x, .498, -.133, .053, .032, .053, Math.PI / 2);
  }
}

function fightingKnife(body: Miniature) {
  body.beam(walnut, [-.091, .444, -.120], [-.191, .556, -.128], .039, .034);
  body.beam(brass, [-.223, .538, -.124], [-.163, .581, -.131], .025, .043);
  const lower: Point = [-.214, .548, -.131], upper: Point = [-.174, .579, -.132];
  const edge: Point = [-.328, .590, -.152], tip: Point = [-.433, .730, -.155];
  const ridge: Point = [-.255, .598, -.168], back: Point = [-.270, .615, -.112];
  body.face(steel, [lower, edge, ridge]);
  body.face("#f1ecd7", [ridge, edge, tip]);
  body.face(steel, [upper, ridge, tip]);
  body.face(deepSteel, [upper, lower, ridge]);
  body.face(steel, [lower, back, edge]);
  body.face("#f1ecd7", [edge, back, tip]);
  body.face(steel, [tip, back, upper]);
  body.face(deepSteel, [back, lower, upper]);
}

function infantry(sculpt: Sculpture, type: Infantry) {
  const { body } = sculpt;
  const [wool, cap, trousers] = infantryUniforms[type];
  plinth(sculpt, .49);
  const longCoat = type === "mindBender" || type === "cloak";
  body.part("bevel", wool, 0, longCoat ? .409 : .441, .016,
    .166, longCoat ? .235 : .179, .142);
  body.part("bevel", wool, 0, .486, .010, .190, .088, .146);
  body.part("octagon", cap, 0, .537, -.003, .094, .024, .098);
  body.part("bevel", skin, 0, .586, -.009, .112, .109, .115);
  body.part("octagon", bootLeather, 0, .634, -.030, .156, .015, .147, .1);
  body.part(type === "cloak" || type === "defender" || type === "swordsman" ? "crown" : "bevel",
    cap, 0, .667, .002, .156, .083, .136, 0, .12);
  if (!longCoat) body.part("bevel", bootLeather, 0, .401, .014, .171, .026, .149);
  for (const side of [-1, 1]) {
    const x = side * .029;
    body.part("bevel", trousers, x, .275, .007, .057, .182, .073);
    body.part("bevel", bootLeather, x, .156, -.016, .060, .072, .102);
    const hand = infantryHands[type][side === -1 ? 0 : 1];
    arm(body, wool, [side * .079, .492, .010], [side * .104, .431, -.032], hand,
      .80, type === "cloak" ? bootLeather : skin);
  }

  switch (type) {
    case "warrior":
      fieldRifle(body, [.196, .270, -.112], [-.192, .680, -.166]);
      break;
    case "archer":
      fieldRifle(body, [.141, .485, .100], rifleMuzzle, "marksman");
      break;
    case "defender":
      entrenchingSpade(body);
      body.part("bevel", "#8b7953", -.075, .369, .041, .075, .071, .108);
      break;
    case "swordsman":
      fieldRifle(body, [.040, .329, .110], [.010, .622, -.247], "bayonet");
      break;
    case "mindBender":
      medicalCase(body);
      body.beam(collarRed, [.086, .497, -.081], [.100, .450, -.072], .034, .017);
      break;
    case "cloak":
      binoculars(body);
      body.part("octagon", cap, 0, .639, .002, .177, .017, .165, .10);
      break;
    case "dagger":
      fightingKnife(body);
      body.part("bevel", "#d8a07a", 0, .532, -.025, .118, .031, .101, .08, -.1, -.14);
      break;
  }
}

function horseTorso(body: Miniature, color: string) {
  const stations: [z: number, width: number, belly: number, back: number][] = [
    [-.210, .072, .287, .407], [-.117, .115, .248, .435],
    [.013, .102, .264, .413], [.133, .114, .252, .422], [.216, .072, .286, .386],
  ];
  const rings = stations.map(([z, w, bottom, top]): Point[] => {
    const flank = bottom + (top - bottom) * .47;
    return [[-.62 * w, bottom, z], [.62 * w, bottom, z], [w, flank, z],
      [.41 * w, top, z], [-.41 * w, top, z], [-w, flank, z]];
  });
  body.face(color, rings[0].slice().reverse());
  for (let i = 1; i < rings.length; i++) {
    const front = rings[i - 1], back = rings[i];
    for (let j = 0; j < front.length; j++) {
      const next = (j + 1) % front.length;
      body.face(color, [front[j], front[next], back[next]]);
      body.face(color, [front[j], back[next], back[j]]);
    }
  }
  body.face(color, rings[rings.length - 1]);
}

function cavalrySabre(body: Miniature) {
  const guard: Point = [.152, .573, -.077];
  body.beam(bootLeather, [.114, .519, -.034], guard, .036);
  body.beam(brass, [.109, .554, -.077], [.202, .576, -.063], .025);
  const spine: Point[] = [[.142, .584, -.077], [.179, .647, -.108], [.226, .737, -.144], [.308, .858, -.158]];
  const edge: Point[] = [[.182, .582, -.071], [.224, .629, -.101], [.266, .715, -.137], spine[3]];
  const ridge = spine.slice(0, -1).map(([x, y, z], i): Point => [
    (x + edge[i][0]) / 2, (y + edge[i][1]) / 2, (z + edge[i][2]) / 2 - .016,
  ]);
  for (let i = 0; i < ridge.length - 1; i++) {
    const next = i + 1;
    body.face(steel, [spine[i], spine[next], ridge[next], ridge[i]]);
    body.face("#f9f3d7", [ridge[i], ridge[next], edge[next], edge[i]]);
    body.face("#cbd7d2", [spine[i], edge[i], edge[next], spine[next]]);
  }
  const tip = spine[3];
  body.face(steel, [spine[2], tip, ridge[2]]);
  body.face("#f9f3d7", [ridge[2], tip, edge[2]]);
  body.face("#cbd7d2", [spine[2], edge[2], tip]);
}

function horseAndSaddle(sculpt: Sculpture, knight: boolean) {
  const { body, enamel } = sculpt;
  plinth(sculpt, .648);
  const horse = knight ? "#c9c5b5" : "#8f593d";
  for (const x of [-.081, .081]) {
    for (const z of [-.134, .141]) {
      const hoof = z + (x > 0 ? .025 : -.025);
      body.beam(horse, [x, .327, z], [x, .157, hoof], .065);
      body.box(bootLeather, x, .142, hoof, .07, .043, .083);
    }
  }
  horseTorso(body, horse);
  body.part("hip", horse, 0, .455, -.154, .154, .273, .156, -.41);
  body.part("crystal", horse, 0, .539, -.237, .129, .108, .216, 1.11);
  const mane: Point[] = [[0, .418, -.067], [0, .593, -.154], [0, .546, -.078]];
  body.face(bootLeather, mane);
  body.face(walnut, mane.slice().reverse());
  for (const x of [-.04, .04])
    body.part("spire4", horse, x, .618, -.177, .032, .073, .041);
  body.part("crystal", bootLeather, 0, .306, .221, .054, .196, .082, -.38);
  body.part("bevel", bootLeather, 0, .534, -.286, .133, .047, .032, .24);
  body.part("bevel", bootLeather, 0, .430, .079, .144, .042, .149);

  enamel.part("bevel", enamelLight, 0, .377, .052, .245, .097, .225);
  body.part("bevel", walnut, 0, .431, .046, .169, .035, .154);
}

function cavalry(sculpt: Sculpture, knight: boolean) {
  horseAndSaddle(sculpt, knight);
  const { body } = sculpt;
  const wool = knight ? "#855178" : "#4282aa";
  fieldJacket(body, wool, .466, .052, .76);
  for (const side of [-1, 1]) {
    body.part("bevel", knight ? "#423b50" : "#767257", side * .082, .423, .023, .056, .104, .084, -.23);
    body.part("bevel", bootLeather, side * .108, .345, .003, .049, .105, .065, -.18);
    body.part("octagon", deepSteel, side * .126, .298, -.017, .039, .021, .048);
  }
  arm(body, wool, [-.071, .545, .052], [-.097, .505, .024], [-.093, .483, -.044], .73, warmCanvas);
  body.beam(bootLeather, [-.091, .481, -.052], [-.072, .528, -.273], .013);
  if (knight) {
    cappedHead(body, "officer", .605, .041, .80);
    body.part("hip", steel, 0, .721, .053, .096, .051, .123, 0, 0, -.09);
    const ridge: Point = [0, .513, -.035];
    const collar: Point = [0, .574, -.018];
    for (const side of [-1, 1]) {
      const shoulder: Point = [side * .073, .549, -.014];
      const rib: Point = [side * .063, .478, -.013];
      const waist: Point = [0, .469, -.018];
      for (const [paint, ...panel] of [[steel, collar, shoulder, ridge],
        ["#8da0ae", shoulder, rib, ridge], [deepSteel, rib, waist, ridge]] as [string, Point, Point, Point][]) {
        body.face(paint, side === -1 ? panel : panel.reverse());
      }
    }
    arm(body, wool, [.073, .546, .050], [.110, .509, .034], [.121, .528, -.039], .75, warmCanvas);
    cavalrySabre(body);
  } else {
    cappedHead(body, "field", .605, .04, .80);
    body.part("drum", "#aea889", 0, .439, .195, .208, .052, .070, 0, 0, Math.PI / 2);
    arm(body, wool, [.071, .545, .052], [.103, .505, .044], [.153, .477, .009], .73, warmCanvas);
    fieldRifle(body, [.152, .421, .215], [.181, .726, -.313]);
  }
}

function fieldGunWheel(body: Miniature, side: number) {
  const radius = .151, hubY = .277, hubZ = .062;
  const point = (x: number, r: number, i: number): Point => {
    const angle = i * Math.PI / 8;
    return [side * x, hubY + Math.cos(angle) * r, hubZ + Math.sin(angle) * r];
  };
  const panel = (tone: string, corners: Point[]) => body.face(tone, side === 1 ? corners : corners.reverse());
  for (let i = 0; i < 16; i++) {
    const j = i + 1;
    panel(ink, [point(.201, radius, i), point(.201, radius, j), point(.229, radius, j), point(.229, radius, i)]);
    panel("#977247", [point(.229, radius, i), point(.229, radius, j), point(.229, .108, j), point(.229, .108, i)]);
    panel(walnut, [point(.229, .108, i), point(.229, .108, j), point(.201, .108, j), point(.201, .108, i)]);
    panel(deepSteel, [point(.201, .108, i), point(.201, .108, j), point(.201, radius, j), point(.201, radius, i)]);
  }
  for (let i = 0; i < 16; i += 2)
    body.beam(wood, [side * .215, hubY, hubZ], point(.215, .121, i), .024, .023);
  body.part("octagon", brass, side * .218, hubY, hubZ, .071, .037, .071, 0, 0, Math.PI / 2);
  body.part("gem", steel, side * .243, hubY, hubZ, .014, .033, .033);
}

export const fieldGunMuzzle: Point = [0, .580, -.405];

function barrelCollar(body: Miniature, muzzle: Point, radius: number, opening: number, depth: number, pitch: number) {
  const [x, y, z] = muzzle;
  const lift = Math.sin(pitch), forward = Math.cos(pitch);
  const rim = (r: number, recess: number) => Array.from({ length: 8 }, (_, i): Point => {
    const angle = Math.PI * i / 4;
    const height = Math.sin(angle) * r;
    return [x + Math.cos(angle) * r, y + height * forward - recess * lift, z + height * lift + recess * forward];
  });
  const front = rim(radius, 0), back = rim(radius, depth);
  const lip = rim(opening, 0), throat = rim(opening * .9, depth * .45);
  for (let i = 0; i < front.length; i++) {
    const j = (i + 1) % front.length;
    body.face(deepSteel, [front[i], front[j], back[j], back[i]]);
    body.face(steel, [front[i], lip[i], lip[j], front[j]]);
    body.face("#323e45", [lip[i], throat[i], throat[j], lip[j]]);
  }
  body.face("#1f2630", throat.reverse());
}

function fieldArtillery(sculpt: Sculpture) {
  const { body, enamel } = sculpt;
  plinth(sculpt, .615);
  body.beam(ink, [-.215, .277, .062], [.215, .277, .062], .050);
  body.part("bevel", "#505548", 0, .304, .030, .255, .076, .160);
  const tint = "#79856d";
  for (const side of [-1, 1]) {
    fieldGunWheel(body, side);
    body.beam(deepSteel, [side * .082, .297, .052], [side * .102, .155, .265], .040, .047);
    body.part("bevel", ink, side * .103, .144, .271, .058, .041, .067);
    const shoulder: Point = [side * .131, .480, -.037];
    const edge: Point = [side * .157, .388, -.048];
    const foot: Point = [side * .128, .277, -.079];
    const seam: Point = [side * .043, .296, -.090];
    const neck: Point = [side * .052, .444, -.060];
    const ridge: Point = [side * .092, .382, -.074];
    const plates: [string, Point, Point, Point][] = [
      [tint, shoulder, edge, ridge], [deepSteel, edge, foot, ridge],
      [tint, foot, seam, ridge], ["#7c9197", seam, neck, ridge], [steel, neck, shoulder, ridge],
    ];
    for (const [tone, ...plate] of plates) {
      body.face(tone, side === 1 ? plate : plate.reverse());
      const backing = plate.map(([x, y, z]): Point => [x, y, z + .007]);
      body.face(deepSteel, backing.reverse());
    }
    body.beam(ink, foot, edge, .013);
    body.beam(brass, neck, shoulder, .010);
    for (const [x, y, z] of [shoulder, foot])
      body.part("gem", brass, x, y, z - .007, .016, .017, .016);
    enamel.part("gem", enamelLight, side * .100, .337, -.088, .036, .032, .011);
  }
  body.part("bevel", deepSteel, 0, .421, .021, .147, .152, .173, -.22);
  body.part("octagon", "#655641", 0, .515, -.074, .118, .290, .118, 1.79);
  body.part("octagon", deepSteel, 0, .543, -.231, .087, .238, .087, 1.79);
  body.part("octagon", brass, 0, .537, -.188, .107, .027, .107, 1.79);
  barrelCollar(body, fieldGunMuzzle, .066, .043, .073, .22);
  body.part("bevel", "#9b8966", 0, .186, .197, .121, .076, .100);
  body.beam(harness, [-.040, .224, .149], [-.040, .224, .247], .012);
  body.beam(harness, [.040, .224, .149], [.040, .224, .247], .012);
}

function armoredCar(sculpt: Sculpture, openHatch = false) {
  const { body, enamel } = sculpt;
  plinth(sculpt, .60);
  const plate = "#596c83", plateLight = "#90a1b5", hatch = "#415369";
  const angledPlate = (tone: string, points: Point[]) => {
    body.face(tone, [points[0], points[1], points[2]]);
    body.face(tone, [points[0], points[2], points[3]]);
  };
  for (const z of [-.177, .175]) {
    body.beam(ink, [-.188, .208, z], [.188, .208, z], .038);
    for (const side of [-1, 1]) {
      const x = side * .201;
      body.part("drum", "#303440", x, .207, z, .171, .069, .171, 0, 0, Math.PI / 2);
      body.part("drum", deepSteel, side * .238, .207, z, .109, .015, .109, 0, 0, Math.PI / 2);
      body.part("octagon", brass, side * .248, .207, z, .043, .015, .043, 0, 0, Math.PI / 2);
      body.part("bevel", hatch, x, .307, z, .100, .042, .196, 0, 0, .06 * side);
    }
  }
  body.part("bevel", ink, 0, .257, .006, .432, .071, .562);
  const corners = [[-.102, -.273], [.102, -.273], [.170, -.205], [.190, .142],
    [.141, .250], [-.141, .250], [-.190, .142], [-.170, -.205]];
  const rings = [
    corners.map(([x, z]): Point => [x, .289, z]),
    corners.map(([x, z]): Point => [x * 1.12, .371, z]),
    corners.map(([x, z]): Point => [x * .85, z < -.115 ? .418 : .505, z * .94]),
  ];
  for (let band = 0; band < rings.length - 1; band++) {
    for (let i = 0; i < corners.length; i++) {
      const next = (i + 1) % corners.length;
      const face = [rings[band][i], rings[band + 1][i], rings[band + 1][next], rings[band][next]];
      angledPlate(band === 0 ? hatch : i % 2 === 0 ? plateLight : plate, face);
    }
  }
  const roof = rings[2];
  angledPlate(plateLight, [roof[7], roof[6], roof[3], roof[2]]);
  angledPlate("#718b93", [roof[6], roof[5], roof[4], roof[3]]);
  angledPlate(plate, [roof[7], roof[2], roof[1], roof[0]]);
  body.part("bevel", walnut, 0, .356, -.276, .173, .102, .021);
  body.box(ink, 0, .356, -.290, .150, .084, .011);
  for (const x of [-.053, -.026, 0, .026, .053])
    body.box(brass, x, .356, -.297, .009, .074, .010);
  for (const side of [-1, 1]) {
    body.part("octagon", brass, side * .148, .388, -.246, .062, .038, .062, Math.PI / 2);
    body.part("gem", ivory, side * .148, .388, -.269, .043, .046, .015);
    const shoulder: Point = [side * .167, .476, -.131];
    const cheek: Point = [side * .205, .389, -.132];
    const rear: Point = [side * .210, .391, .130];
    const strip: Point[] = [[side * .209, .377, -.124], [side * .202, .401, -.125],
      [side * .211, .402, .130], [side * .215, .378, .135]];
    enamel.face(enamelLight, side === 1 ? strip : strip.reverse());
    for (const y of [.416, .438])
      body.beam(ink, [side * .179, y, -.097], [side * .194, y - .004, -.176], .011);
    const triangularWindow = [shoulder, cheek, rear];
    body.face("#415865", side === 1 ? triangularWindow.reverse() : triangularWindow);
    body.part("bevel", walnut, side * .184, .325, .053, .040, .076, .132, 0, .11);
  }

  const turretZ = .081;
  body.part("octagon", ink, 0, .514, turretZ, .284, .031, .254);
  const ring = (radius: number, height: number) => Array.from({ length: 8 }, (_, i): Point => {
    const angle = i * Math.PI / 4 + Math.PI / 8;
    return [Math.cos(angle) * radius, height, turretZ + Math.sin(angle) * radius * .9];
  });
  const foot = ring(.124, .523), belt = ring(.146, .628), roofline = ring(.105, .718);
  for (let i = 0; i < foot.length; i++) {
    const j = (i + 1) % foot.length;
    angledPlate(i % 2 ? hatch : plate, [foot[i], belt[i], belt[j], foot[j]]);
    angledPlate(i % 2 ? plate : plateLight, [belt[i], roofline[i], roofline[j], belt[j]]);
  }
  body.face(plateLight, roofline.slice().reverse());
  if (openHatch) {
    body.part("octagon", ink, -.017, .722, .105, .158, .015, .140);
    body.part("octagon", hatch, -.017, .762, .178, .149, .017, .107, .99);
  } else {
    body.part("octagon", hatch, -.017, .728, .105, .133, .033, .105);
  }
  body.part("bevel", ink, 0, .622, -.058, .143, .087, .066);
  body.part("octagon", hatch, 0, .622, -.171, .086, .262, .086, Math.PI / 2);
  body.part("octagon", steel, 0, .622, -.200, .110, .036, .110, Math.PI / 2);
  barrelCollar(body, [0, .622, -.335], .061, .039, .048, 0);
  const poleX = openHatch ? .128 : .067;
  body.beam(brass, [poleX, openHatch ? .675 : .690, .126], [poleX, .805, .126], .014);
  foldedPennant(enamel, [poleX, .805, .126], [poleX + .017, .772, .251], .034);
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
      target.face(tone, [lower[i], upper[i], upper[j]]);
      target.face(tone, [lower[i], upper[j], lower[j]]);
    }
  }
  const sole = section(.62, .89, .016, .15);
  const bilge = section(.93, .977, deck * .36, .28);
  const waterline = section(1, 1, deck * .50, .4);
  const upperSide = section(.99, 1, deck * .78, .80);
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
  foldedPennant(enamel, [0, .600, -.117], [.015, .576, -.027], .041);
  for (const side of [-1, 1]) {
    for (const z of [-.135, -.038, .147]) {
      body.part("bevel", "#91a2a5", side * .105, deck + .030, z, .023, .050, .058);
      body.box(ink, side * .118, deck + .040, z, .006, .012, .031);
    }
    body.part("hip", "#ded0b1", side * .082, deck + .077, .174, .043, .040, .126, Math.PI);
    body.box(wood, side * .082, deck + .097, .174, .021, .008, .093);
    const brace: Point[] = [[side * .099, deck + .071, -.057], [side * .115, deck + .023, -.008],
      [side * .114, deck + .024, .099]];
    body.face("#9baaa6", side < 0 ? brace : brace.reverse());
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
  for (const side of [-1, 1]) {
    const stripe: Point[] = [[side * .145, .085, -.156], [side * .145, .102, -.151],
      [side * .145, .103, .153], [side * .145, .085, .170]];
    enamel.face(enamelLight, side > 0 ? stripe : stripe.reverse());
  }
  for (const x of [-.067, 0, .067]) {
    body.box(teak, x, .106, -.017, .066, .016, .216);
  }
  body.part("bevel", walnut, .051, .144, .044, .081, .068, .076);
  body.box(brass, .051, .182, .044, .071, .010, .011);
  body.part("octagon", "#a18051", -.012, .136, .092, .057, .051, .065, 0, 0, .22);
  body.beam(walnut, [-.071, .101, .071], [-.071, .302, .071], .017);
  foldedPennant(enamel, [-.070, .296, .068], [-.060, .268, .183], .056);
  body.beam(walnut, [.081,.109,.090], [.181,.059,.191], .012);
  body.part("bevel", wood, .169, .057, .181, .038, .012, .086, 0, .50);
}

function dinghyDeck({ body, enamel }: Sculpture, deck: number, withPilot = true) {
  for (const z of [-.085, .080])
    body.box(ivory, 0, deck + .015, z, .136, .024, .033);
  body.part("bevel", "#c0a078", 0, deck + .012, -.013, .110, .020, .102);
  for (const side of [-1, 1]) {
    body.beam(walnut, [side*.019, deck + .027, -.040], [side*.111, .061, .096], .012);
    const blade: Point[] = [[side * .095, .063, .090], [side * .130, .057, .111],
      [side * .118, .061, .140], [side * .113, .072, .106]];
    body.face(brass, side < 0 ? blade : blade.reverse());
    body.box(brass, side*.077, deck + .026, .025, .019, .025, .018);
  }
  // A hooded figure and covered gear give the rowboat a low silhouette.
  if (withPilot) {
    body.part("hip", ink, 0, deck + .061, .035, .086, .103, .088);
    body.part("spire", "#56686c", 0, deck + .120, .033, .098, .068, .088);
  }
  body.part("bevel", "#57483a", 0, deck + .020, -.132, .073, .035, .070);
  body.beam(walnut, [0, deck + .004, .118], [0, deck + .169, .131], .011);
  foldedPennant(enamel, [0, deck + .166, .131], [.013, deck + .155, .187], .030);
}

// National renderers put their dressed helmsman on this seat. Neutral boats
// continue to use the original hooded pilot.
export function carveUncrewedDinghy() {
  const sculpt = { body: new Miniature(), enamel: new Miniature() };
  dinghyDeck(sculpt, navalHull(sculpt, "dinghy"), false);
  return { body: sculpt.body.finish(), enamel: sculpt.enamel.finish() };
}

function pirateDeck({ body, enamel }: Sculpture, deck: number) {
  body.part("bevel", walnut, 0, deck + .030, .164, .148, .069, .156);
  enamel.part("bevel", enamelLight, 0, deck + .069, .164, .157, .018, .156);
  for (const side of [-1, 1]) {
    body.box(brass, side * .044, deck + .040, .245, .026, .018, .014);
    body.box("#272c36", side * .071, deck + .040, .010, .026, .026, .036);
    body.beam(armor, [side * .058, deck + .045, .010], [side * .106, deck + .051, .012], .019);
    const quarter: Point[] = [[side * .067, deck + .062, .226], [side * .094, deck + .013, .258],
      [side * .099, deck + .008, .125]];
    body.face(wood, side < 0 ? quarter : quarter.reverse());
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
    body.face(i % 2 ? "#aaa399" : "#cfc7b8", seam);
    body.face(i % 2 ? "#aaa399" : "#cfc7b8", seam.reverse());
  }
  foldedPennant(enamel, [0, .466, .035], [.049, .431, .116], .049);
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
      fieldArtillery(sculpt);
      break;
    case "giant":
      armoredCar(sculpt);
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

// Ground supports are shared across nations; national passengers and their
// uniforms are mounted separately. The gun carriage already has its own plinth.
type GroundSupport = "infantry" | "rider" | "knight" | "catapult" | "giant";
const supports = new Map<GroundSupport, ReturnType<typeof carve>>();

export function groundSupport(kind: GroundSupport) {
  if (kind === "catapult") return danubianUnit(kind);
  const existing = supports.get(kind);
  if (existing) return existing;
  const sculpt: Sculpture = { body: new Miniature(), enamel: new Miniature() };
  switch (kind) {
    case "rider":
    case "knight":
      horseAndSaddle(sculpt, kind === "knight");
      break;
    case "giant":
      armoredCar(sculpt, true);
      break;
    case "infantry":
      plinth(sculpt, .51);
      break;
  }
  const geometry = { body: sculpt.body.finish(), enamel: sculpt.enamel.finish() };
  supports.set(kind, geometry);
  return geometry;
}
