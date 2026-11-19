import type { Miniature } from "../../../scene/miniature";
import { bridgeDeckHeight, bridgePierOffset, mooringDeck, type BuildingVisualTier } from "../../../scene/buildingVisualTier";
import { crate, rural } from "./ruralKit";

function jetty(m: Miniature, x: number, z: number, w: number, d: number) {
  for (const side of [-1, 1]) for (const end of [-1, 1]) {
    m.part("octagon", rural.timber, x + side * (w / 2 - .029), mooringDeck / 2, z + end * (d / 2 - .028), .039, mooringDeck, .039);
  }
  m.box(rural.timber, x, mooringDeck - .026, z, w, .04, d);
  m.box(rural.board, x, mooringDeck - .006, z, w, .012, d);
}

function bollard(m: Miniature, x: number, z: number) {
  m.part("octagon", rural.iron, x, mooringDeck + .021, z, .036, .042, .036);
  m.box(rural.iron, x, mooringDeck + .042, z, .058, .014, .027);
}

// A bonded warehouse with open loading bays faces the crane. Its gabled end
// and the shading under the canopy remain visible at the normal board zoom.
function warehouse(m: Miniature, owner: string, tier: BuildingVisualTier) {
  const x = .145, z = -.105, w = .238 + tier * .026, d = .157;
  const left = x - w/2, right = x + w/2, front = z + d/2, back = z - d/2;
  const floor = mooringDeck, eave = floor + .088 + tier * .012, ridge = eave + .037;
  m.box(rural.brick, x, (floor + eave)/2, back, w, eave - floor, .018);
  m.box(rural.brick, x, floor + .016, z, w, .032, d);
  const panel = "#a28b70", roof = "#607881", flashing = "#869697";
  for (const side of [left,right]) {
    m.box(panel, side, (floor + eave)/2, z, .016, eave - floor, d);
    const face: [number, number, number][] = [[side,eave,front],[side,ridge,z],[side,eave,back]];
    m.face(panel, side === left ? face : face.reverse());
  }
  for (const sign of [-1, 1]) {
    const pitch = Math.atan2(ridge - eave, d / 2);
    m.box(roof, x, (ridge + eave)/2 + .004, z + sign * d/4, w + .028, .014,
      Math.hypot(d/2, ridge - eave) + .020, sign * pitch);
  }
  m.box(flashing, x, ridge + .010, z, w + .03, .009, .017);
  m.box(rural.shade, x, eave - .023, back + .011, w*.89, .028, .006);
  const bays = tier + 1;
  for (let i = 0; i <= bays; i++) {
    const post = left + (i/bays)*w;
    m.box(rural.timber, post, (floor + eave)/2, front, .018, eave-floor, .021);
    if (i === bays) continue;
    const bayX = post + w / bays * .56;
    if (i % 2 === 0) crate(m, bayX, floor + .032, z + .016, .050);
  }
  m.box(rural.timber, x, eave - .009, front, w + .013, .018, .021);
  m.box(owner, x + w*.24, eave - .007, front + .013, .048, .023, .006);
  m.box(rural.shade,right + .009,eave-.036,z,.008,.035,.068);
  m.box(rural.board,right + .015,eave-.036,z,.005,.038,.008);
  if (tier >= 2) {
    // A sloping awning covers the freight doors; its brackets stay open.
    m.box(flashing, x, eave-.029, front+.036, w*.82, .011, .087, .21);
    for (const end of [-1, 1]) m.beam(rural.iron, [x+end*w*.35,eave-.061,front],
      [x+end*w*.35,eave-.034,front+.063], .012);
  }
  if (tier === 3) {
    m.box(rural.shade, x, ridge + .01, z, w*.63, .035,.055);
    for (const end of [-1,0,1]) m.box(rural.board,x+end*w*.22,ridge+.014,z+.029,.009,.029,.008);
    m.box(roof, x, ridge+.033,z,w*.69,.014,.080);
  }
}

export function port(m: Miniature, owner: string, tier: BuildingVisualTier) {
  // Built out from the bank. The gangway lands at (-.06, -.148) between
  // the crane track and the shed. Piles and fenders stand in the native sea.
  const length = .66 + .045 * tier;
  jetty(m, 0, -.084, length, .253);
  const fingerX = -.192, tip = .207 + tier * .035;
  jetty(m, fingerX, (.040 + tip)/2, .140, tip - .040);
  bollard(m, fingerX, tip - .036);
  for (const x of [-.26,.038,.286]) {
    m.part("octagon", rural.timber, x, mooringDeck*.43,.052, .033,mooringDeck*.85,.038);
  }

  warehouse(m, owner, tier);
  const foot = -.181, hookX = -.102 + .020 * tier, hookZ = .119;
  const mast = .096 + (tier-1)*.064, head = mooringDeck + mast, peak = head + .031;
  m.part("drum", rural.iron, foot, mooringDeck + .016, -.022, .102,.032,.092);
  m.part("octagon", rural.timber, foot, mooringDeck + mast/2,-.022,.040,mast,.040);
  m.beam(rural.board,[foot,head-.022,-.022],[hookX,peak,hookZ],.027);
  m.beam(rural.iron,[foot,head-.059,-.022],[hookX-.023,peak-.009,hookZ-.030],.014);
  m.beam(rural.iron,[foot,head,-.024],[hookX,peak+.006,hookZ],.009);
  m.beam(rural.shade,[hookX,peak,hookZ],[hookX,peak-.059,hookZ],.009);
  crate(m,hookX,peak-.099,hookZ,.056);
  crate(m,-.235,mooringDeck,.105,.068);
  if (tier >= 2) {
    // Tramway laid along the quay, with a loaded low wagon alongside the shed.
    for (const z of [.006,.038]) m.box(rural.iron,.030,mooringDeck+.004,z,.458,.009,.009);
    m.box(rural.timber,.136,mooringDeck+.019,.024,.093,.022,.054);
    crate(m,.137,mooringDeck+.030,.024,.054);
    m.part("octagon",rural.iron,foot+.043,mooringDeck+.039,-.023,.062,.070,.062,0,0,Math.PI/2);
  }
  if (tier === 3) {
    jetty(m,.212,.122,.129,.162);
    bollard(m,.213,.168);
    crate(m,.20,mooringDeck,.087,.073);
    m.beam(rural.iron,[foot-.058,mooringDeck+.021,-.064],[foot,head-.018,-.026],.018);
  }
}

export function bridge(m: Miniature, owner: string, tier: BuildingVisualTier) {
  const edge = bridgePierOffset(tier);
  const frame = tier === 1 ? rural.timber : rural.iron;
  const deck = bridgeDeckHeight;
  m.box(tier === 1 ? rural.board : rural.stone, 0, deck - .013, 0, edge * 2 + .011, .026, 1);
  // Transverse floor beams and the board joints show where the span carries its load.
  for (let i = -3; i <= 3; i++) {
    const z = i * .139;
    m.box(frame, 0, deck - .039, z, 2*edge+.031, .033, .026);
    if (tier === 1) m.box(rural.timber,0,deck+.001,z,2*edge-.012,.002,.007);
  }
  for (const side of [-1, 1]) {
    const x = side * edge;
    m.box(frame, x, deck - .034, 0, .032, .046, .99);
    for (const z of [-.376, .376]) {
      m.part("bevel", tier === 1 ? rural.timber : rural.stone, x, deck / 2, z, .059, deck, .103);
    }
    const bays = tier + 2;
    const rail = deck + .06 + (tier - 1) * .018;
    for (let i = 0; i <= bays; i++) {
      const z = -.466 + i * .932 / bays;
      const peak = tier === 3 ? .039 * Math.sin(Math.PI * i / bays) : 0;
      const y = rail + peak;
      m.box(frame, x, (deck + y) / 2, z, .017, y - deck, .018);
      if (i === 0) continue;
      const lastZ = z - .932 / bays;
      const lastY = rail + (tier === 3 ? .039 * Math.sin(Math.PI * (i - 1) / bays) : 0);
      m.beam(frame, [x, lastY, lastZ], [x, y, z], .019);
      if (tier >= 2) {
        // Plate-girder panels on the second span grow into a full arched truss.
        m.box(frame, x + side*.008, deck+.011, z, .013, .034, .039);
        const leftRises = i <= bays / 2;
        m.beam(rural.iron, [x, leftRises ? deck : lastY, lastZ], [x, leftRises ? y : deck, z], .012);
      }
    }
    m.box(owner, x + side * .015, deck - .022, .342, .006, .021, .055);
  }
}

// A travelling portal serves two fingers. The loading basin stays visible
// through its legs, with a freight lift and transit shed on the eastern quay.
export function cargoTerminal(m: Miniature, owner: string) {
  const steel = "#536a74", plate = "#81959a", roof = "#788782";
  const deck = mooringDeck, top = .525;
  jetty(m, -.192, .354, .139, .084);
  jetty(m, .239, .250, .182, .096);
  jetty(m, .264, .345, .232, .094);
  jetty(m, .348, .124, .073, .171);
  for (const x of [-.192,.216]) {
    m.box(rural.iron,x,deck+.004,.302,.012,.008,.154);
    for (const z of [.256,.343]) {
      m.box(rural.shade,x,deck+.019,z,.043,.029,.045);
      m.beam(steel,[x,deck+.028,z],[x,top-.031,.302],.025,.032);
    }
    m.box(plate,x,top-.020,.302,.048,.021,.113);
    m.beam(plate,[x,deck+.133,.281],[x,deck+.133,.322],.013);
  }
  for (const z of [.279,.325]) {
    m.box(steel,.012,top+.027,z,.494,.016,.017);
    m.box(steel,.012,top-.011,z,.494,.014,.016);
    for (let i=0;i<6;i++) {
      const x=-.222+.078*i;
      m.beam(plate,[x,top+(i%2 ? .025 : -.009),z],[x+.078,top+(i%2 ? -.009 : .025),z],.011);
    }
  }
  const trolley = -.052;
  m.box(rural.iron,trolley,top+.041,.302,.065,.018,.071);
  m.box(owner,.173,top+.015,.329,.032,.022,.006);
  m.box("#a39172",.185,top-.053,.320,.074,.065,.063);
  m.box("#50646a",.182,top-.047,.353,.048,.026,.004);
  for (const x of [trolley-.019,trolley+.019])
    m.beam(rural.shade,[x,top-.013,.302],[x,.286,.302],.005);
  m.box(rural.timber,trolley,.272,.302,.093,.016,.064);
  crate(m,trolley,.278,.302,.064);
  // Freight staging alongside the travelling crane leaves the inside of the dock open.
  for (const x of [.290,.361]) for (const z of [.293,.375])
    m.box(rural.timber,x,deck+.046,z,.014,.091,.014);
  m.box(rural.brick,.363,deck+.048,.335,.014,.095,.104);
  m.box(roof,.325,deck+.104,.335,.103,.017,.124,0,0,.13);
  crate(m,.332,deck,.342,.065);
  bollard(m,.324,.373);
  for (const x of [-.246,.161]) m.part("octagon",rural.timber,x,.071,.386,.035,.139,.034);
}

// A riveted through-truss carries the span above its old low approach rails.
// Top chords meet the bank portals and leave the roadway clear under the ties.
export function throughTruss(m: Miniature) {
  const steel = "#526b74", flange = "#788d91", stone = "#989888";
  const deck = bridgeDeckHeight, edge = bridgePierOffset(3);
  const joints = [[-.398,.268],[-.256,.408],[-.086,.452],[.086,.452],[.256,.408],[.398,.268]] as const;
  for (const side of [-1,1]) {
    const x = side*edge;
    for (const z of [-.378,.378]) {
      m.part("bevel",stone,x,.067,z,.088,.129,.128);
      m.box("#b1ac97",x,deck-.016,z,.097,.029,.141);
    }
    for (let i=0;i<joints.length;i++) {
      const [z,y] = joints[i];
      m.beam(steel,[x,deck+.011,z],[x,y,z],.023);
      m.box(flange,x+side*.004,y,z,.034,.028,.037);
      if (i===0) continue;
      const [az,ay] = joints[i-1];
      m.beam(steel,[x,ay,az],[x,y,z],.032);
      m.beam(flange,[x,ay+.010,az],[x,y+.010,z],.022,.038);
      m.beam(steel,[x,i%2 ? ay : deck+.020,az],[x,i%2 ? deck+.020 : y,z],.018);
    }
  }
  for (const [z,y] of joints.slice(1,-1)) {
    m.beam(steel,[-edge,y-.007,z],[edge,y-.007,z],.021,.024);
    for (const side of [-1,1])
      m.beam(flange,[side*edge,y-.061,z],[side*(edge-.057),y-.007,z],.016);
  }
  for (const side of [-1,1]) {
    m.beam(flange,[side*edge,.447,-.086],[-side*edge,.447,.086],.012);
  }
}
