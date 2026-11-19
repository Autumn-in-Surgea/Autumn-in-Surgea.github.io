import type { Miniature } from "../../scene/miniature";
import { brick, cobalt, copper, ivory, masonry, terracotta } from "../../scene/architecturalPalette";
import {
  commercialBlock, cornerBank, laneGate, shippingExchange, steppedPress, terrace, tradingBank,
  type Roofline, type TerraceRoof,
} from "../_shared/danubian/bundDistricts";
import { facade } from "../_shared/danubian/cityMasonry";

const sandstone = "#d0a37b";
const rose = "#df9c83";
const glazedGreen = "#527a61";
const greyGreen = "#8da292";
const slate = "#4c6478";
const slateViolet = "#625175";
const kilnRed = "#9b4b3a";
const coal = "#465260";

type LowLot = [
  x: number, z: number, width: number, depth: number, height: number,
  wall: string, roof: string, profile: TerraceRoof | "market",
];
type HighLot = [
  x: number, z: number, width: number, depth: number, height: number,
  wall: string, profile: Roofline, roof: string,
];

// Warehouses open to the quays. Broad red ridges give way to packed
// workers' terraces along the side alleys.
const riverWarehouses: LowLot[] = [
  [-.238, .376, .421, .172, .134, brick, kilnRed, "ridge"],
  [ .235, .370, .411, .181, .157, rose, terracotta, "ridge"],
  [-.388, .115, .148, .245, .108, rose, terracotta, "crowSteps"],
  [-.393,-.151, .137, .239, .126, brick, kilnRed, "court"],
  [ .381, .132, .172, .225, .133, sandstone, slate, "crowSteps"],
  [ .394,-.146, .151, .263, .167, rose, terracotta, "ridge"],
  [-.332,-.386, .253, .160, .153, sandstone, terracotta, "ridge"],
  [-.077,-.381, .223, .158, .117, brick, kilnRed, "ridge"],
  [ .170,-.380, .229, .171, .127, rose, terracotta, "court"],
  [ .390,-.385, .155, .162, .125, brick, kilnRed, "crowSteps"],
  [-.175, .116, .182, .156, .100, rose, kilnRed, "ridge"],
  [ .142, .038, .218, .294, .180, masonry, slate, "mansard"],
];

// A formal square and a bank dome sit behind slate mansards and stone
// corner pavilions. The gap in the facing row is the entry to the square.
const bankSquare: LowLot[] = [
  [-.375, .379, .177, .171, .143, sandstone, cobalt, "turret"],
  [-.174, .380, .182, .161, .133, ivory, cobalt, "mansard"],
  [ .106, .382, .230, .168, .127, masonry, cobalt, "mansard"],
  [ .361, .382, .198, .173, .180, ivory, cobalt, "turret"],
  [-.397, .123, .126, .272, .138, ivory, slate, "mansard"],
  [-.381,-.160, .158, .256, .168, sandstone, slate, "turret"],
  [ .398, .138, .124, .242, .126, masonry, slate, "mansard"],
  [ .392,-.155, .138, .267, .132, ivory, slate, "court"],
  [-.348,-.377, .225, .174, .162, masonry, cobalt, "mansard"],
  [-.120,-.382, .194, .158, .127, sandstone, slate, "court"],
  [ .114,-.377, .224, .179, .160, ivory, cobalt, "mansard"],
  [ .365,-.384, .183, .160, .110, masonry, cobalt, "mansard"],
  [-.202, .145, .153, .131, .138, masonry, slate, "court"],
];

// Stepped shophouses form narrow brick lanes with a long eastern guild
// house and a pair of masonry portals at the street openings.
const guildLanes: LowLot[] = [
  [-.380, .374, .169, .173, .179, sandstone, glazedGreen, "crowSteps"],
  [-.191, .375, .179, .182, .130, brick, kilnRed, "crowSteps"],
  [ .005, .385, .173, .153, .161, masonry, terracotta, "crowSteps"],
  [ .286, .380, .341, .176, .159, sandstone, glazedGreen, "crowSteps"],
  [-.400, .099, .128, .281, .139, rose, kilnRed, "court"],
  [-.391,-.159, .147, .179, .164, masonry, kilnRed, "crowSteps"],
  [ .379, .011, .179, .471, .205, brick, kilnRed, "crowSteps"],
  [-.347,-.372, .226, .172, .160, brick, terracotta, "crowSteps"],
  [-.094,-.377, .249, .165, .129, sandstone, glazedGreen, "crowSteps"],
  [ .260,-.380, .390, .166, .141, masonry, glazedGreen, "ridge"],
  [-.087, .115, .249, .130, .119, brick, terracotta, "ridge"],
  [ .158,-.112, .226, .208, .181, masonry, terracotta, "turret"],
];

// Long glazed halls run into open-air stalls. Their shallow roofs and
// weathered green paint are visible across the block from the board camera.
const produceMarket: LowLot[] = [
  [-.253, .384, .382, .157, .118, greyGreen, copper, "market"],
  [ .233, .372, .443, .176, .140, masonry, glazedGreen, "market"],
  [-.391, .077, .144, .420, .134, ivory, copper, "market"],
  [-.383,-.204, .168, .108, .106, masonry, slate, "court"],
  [ .384, .073, .162, .408, .135, greyGreen, glazedGreen, "market"],
  [ .394,-.204, .146, .107, .124, ivory, slate, "court"],
  [-.327,-.387, .272, .163, .122, sandstone, terracotta, "ridge"],
  [-.055,-.384, .238, .169, .146, ivory, glazedGreen, "court"],
  [ .204,-.371, .258, .190, .114, sandstone, terracotta, "mansard"],
  [ .398,-.378, .110, .166, .131, greyGreen, slate, "ridge"],
  [-.158, .133, .247, .112, .099, ivory, glazedGreen, "market"],
  [ .163,-.013, .198, .284, .155, sandstone, copper, "market"],
];

const lowRiseDistricts = [riverWarehouses, bankSquare, guildLanes, produceMarket] as const;

function market(m: Miniature, x: number, z: number, w: number, d: number, h: number, wall: string, roof: string) {
  const y = facade(m, x, z, w, d, h, wall, Math.max(2, Math.round(w / .055)), 2);
  const northSouth = d > w;
  const length = (northSouth ? d : w) + .01;
  const span = (northSouth ? w : d) + .01;
  const roofPoint = (along: number, side: number): [number, number, number] => {
    const angle = Math.PI * side / 8;
    const rise = Math.sin(angle) * .079;
    const run = Math.cos(angle) * span / 2;
    return northSouth ? [x + run, y + rise, z + along] : [x + along, y + rise, z - run];
  };
  for (let i = 0; i < 8; i++) {
    const l = roofPoint(-length / 2, i), r = roofPoint(length / 2, i);
    const nextL = roofPoint(-length / 2, i + 1), nextR = roofPoint(length / 2, i + 1);
    m.face(i === 3 || i === 4 ? "#9dc6c8" : roof, [l, nextL, nextR, r]);
    for (const along of [-.38, -.14, .14, .38])
      m.beam(roof, roofPoint(length * along, i), roofPoint(length * along, i + 1), .006);
  }
  m.face(slate, Array.from({ length: 9 }, (_, i) => roofPoint(length / 2, i)));
  m.face(slate, Array.from({ length: 9 }, (_, i) => roofPoint(-length / 2, 8 - i)));
}

// The elevator works and glass trading halls flank a wide trade street.
const exchangeBoulevard: HighLot[] = [
  [-.292,-.377, .339, .166, .504, sandstone, "parapet", copper],
  [ .027,-.369, .253, .179, .588, masonry, "setback", copper],
  [ .323,-.370, .292, .184, .475, sandstone, "galleria", copper],
  [-.330,-.106, .244, .280, .491, rose, "galleria", copper],
  [-.333, .153, .258, .191, .549, masonry, "parapet", copper],
  [-.350, .374, .239, .174, .331, sandstone, "galleria", copper],
  [-.072, .372, .271, .179, .386, ivory, "galleria", copper],
  [ .288, .368, .341, .190, .366, sandstone, "mansard", slate],
  [ .160, .137, .180, .219, .484, brick, "parapet", copper],
  [ .390, .141, .136, .222, .404, greyGreen, "galleria", copper],
];

// Small tower lots give the hotels an uneven roofline of lanterns and
// mansards. One long red masonry hotel anchors the front street.
const hotelArcades: HighLot[] = [
  [-.346,-.369, .220, .178, .523, rose, "lantern", slateViolet],
  [-.111,-.371, .194, .174, .567, masonry, "lantern", cobalt],
  [ .117,-.369, .211, .170, .501, sandstone, "mansard", slate],
  [ .362,-.369, .187, .188, .558, brick, "setback", slateViolet],
  [-.353,-.126, .213, .252, .571, brick, "lantern", copper],
  [ .323,-.099, .298, .267, .550, masonry, "mansard", slate],
  [-.343, .136, .238, .202, .435, ivory, "mansard", slate],
  [ .350, .153, .265, .195, .450, rose, "lantern", slateViolet],
  [-.226, .375, .458, .171, .403, brick, "mansard", slate],
  [ .009, .137, .210, .206, .472, sandstone, "parapet", copper],
];

// Continuous commercial blocks mark the printer's lanes, with lower
// brick and slate shoulders either side of a longitudinal passage.
const mercantileBlocks: HighLot[] = [
  [-.229,-.370, .452, .181, .545, brick, "mansard", slate],
  [ .251,-.367, .405, .193, .560, sandstone, "parapet", coal],
  [-.333,-.046, .254, .381, .498, rose, "parapet", coal],
  [ .325,-.062, .273, .382, .567, brick, "mansard", slate],
  [-.339, .311, .237, .293, .466, sandstone, "mansard", slate],
  [ .339, .292, .244, .327, .508, rose, "parapet", coal],
];

// Pale stone stepped towers define the civic skyline. Their different tower
// rises frame the original central pyramid and face a broad exhibition hall.
const civicSkyline: HighLot[] = [
  [-.326,-.360, .276, .198, .633, ivory, "setback", glazedGreen],
  [-.037,-.368, .259, .162, .543, masonry, "parapet", glazedGreen],
  [ .303,-.351, .298, .213, .623, ivory, "setback", slateViolet],
  [-.351,-.038, .210, .403, .595, sandstone, "setback", copper],
  [ .371,-.036, .178, .376, .548, masonry, "lantern", glazedGreen],
  [-.351, .319, .213, .279, .452, ivory, "parapet", copper],
  [ .065, .363, .511, .201, .377, ivory, "galleria", copper],
  [ .404, .295, .143, .328, .447, sandstone, "setback", glazedGreen],
  [ .050, .131, .253, .196, .460, rose, "setback", slateViolet],
];
const highRiseDistricts = [exchangeBoulevard, hotelArcades, mercantileBlocks, civicSkyline] as const;

export function imperialBundCompanions(m: Miniature, stage: number, enamel: string, variant: number) {
  if (stage === 5) {
    for (const [x, z, w, d, h, wall, roof, profile] of lowRiseDistricts[variant] ?? lowRiseDistricts[0]) {
      if (profile === "market") market(m, x, z, w, d, h, wall, roof);
      else terrace(m, x, z, w, d, h, wall, roof, profile);
    }
    if (variant === 1) tradingBank(m, .177, .047, .243, .226, .237, copper);
    if (variant === 2) {
      laneGate(m, .139, .465, .073);
      laneGate(m, -.190, .207, .071);
    }
    return;
  }
  for (const lot of highRiseDistricts[variant] ?? highRiseDistricts[0]) commercialBlock(m, ...lot);
  if (variant === 0) shippingExchange(m, .310, -.111);
  if (variant === 1) cornerBank(m, .297, .362);
  if (variant === 2) {
    steppedPress(m, -.048, .130, enamel);
    tradingBank(m, -.011, .366, .376, .200, .402, copper);
  }
}
