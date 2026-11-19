import type { NationId } from "../../nations/types";

type Point = readonly [x: number, y: number];
type Path = readonly Point[];

export const STORY_SIZE = 64;

// The inland arc is compact and opens into two seas. The broad fields south of
// the central river sit between the plateau, the Sanshan passes and the east coast.
export const LAND: readonly Path[] = [
  // West Continent, clockwise from the northwestern basin.
  [
    [12, 17], [13, 15.5], [16, 14.5], [20, 15.2], [24, 16], [28, 15.5], [32, 14], [36, 13.2],
    [38, 13.2], [40, 14], [39, 16], [38.5, 18], [34.5, 20], [31.5, 22], [30.5, 24], [33, 26],
    [36, 27], [38.5, 28], [40, 29], [41, 32], [41, 34], [39, 37], [38, 40], [36.8, 41.5],
    [33, 42], [31, 44], [30, 46], [30, 48], [30.7, 51], [30, 54], [28, 57], [26, 59],
    [23, 59], [21, 57.5], [20, 56], [18, 54], [17.2, 51], [17, 48], [15, 46], [13, 44],
    [10, 43], [8.2, 41], [8.2, 39], [9, 37], [10, 35], [12, 33], [14, 31], [15.5, 29],
    [16.5, 27], [17, 25], [15.8, 23], [13.3, 21], [12, 19],
  ],
  // Northern island of the eastern arc.
  [
    [56.2, 7.5], [58.8, 6.6], [60.6, 8.4], [61.5, 11], [60.6, 13.6], [58.8, 15.4], [56.2, 15.4],
    [55.3, 13.6], [53.5, 12.8], [53.5, 10.1], [55.3, 9.2],
  ],
  // Main island of the eastern arc.
  [
    [57.8, 20.4], [59.6, 18.7], [61.3, 20.4], [61.2, 24], [61.3, 26.6], [61.2, 31.9], [61.3, 34.5],
    [59.6, 38], [58.7, 39.8], [55.2, 39.8], [55.2, 41.6], [52.5, 43.3], [49.9, 43.3], [48.1, 41.6],
    [48.1, 39.8], [49.9, 38], [51.7, 38], [51.7, 36.3], [53.4, 36.3], [55.2, 32.8], [54.3, 31],
    [56.1, 29.2], [56.1, 26.6], [55.2, 24.8], [56.1, 23.1],
  ],
  // Southern island of the eastern arc.
  [[45.4, 49.2], [47.1, 46.6], [48.9, 46.6], [51.5, 49.2], [51.5, 52.8], [49.8, 54.5],
   [47.1, 54.5], [45.4, 52.8], [44.5, 51]],
  // Southern island chain and the offshore rock at the Chunzhou shelf.
  [[34, 56], [36, 53], [39, 53], [42, 55], [41, 58], [38, 60], [36, 60], [33, 58]],
  [[33, 50], [35, 48], [37, 50], [36, 52], [34, 52]],
  [[38, 48], [41, 46], [44, 48], [43, 51], [41, 53], [38, 52]],
  [[27, 61], [30, 60], [32, 61], [31, 63], [28, 63]],
  [[34, 45], [36, 43], [38, 44], [39, 46], [37, 47], [34, 47]],
];

export const WATER: readonly Path[] = [
  // An isolated pond in the northwestern basin.
  [[13.6, 18.5], [15.6, 18.5], [16.4, 19.6], [15, 20.3], [13.6, 19.8]],
  // Two small pools in the northern steppe.
  [[23.6, 18.6], [24.4, 18.6], [24.4, 19.4], [23.6, 19.4]],
  [[26.6, 18.6], [28.4, 18.6], [28.1, 19.4], [26.6, 19.4]],
  // Isolated shallow pools on the eastern peninsula.
  [[31.6, 19.6], [32.4, 19.6], [32.4, 20.4], [31.6, 20.4]],
  [[29.6, 21.6], [30.4, 21.6], [30.4, 22.4], [29.6, 22.4]],
  // Plateau lake.
  [[10, 38], [12, 37], [14, 38], [14, 40], [12, 41], [10, 40]],
];

export const RIDGES: readonly Path[] = [
  // Central Range on the north bank; the low pass opens to the Datai estuary.
  [[18, 26], [21, 25], [24, 24], [27, 25], [30, 27], [33, 27], [36, 28]],
  // The westward plateau and its southern escarpment above Changshou.
  [[8, 38], [10, 36], [13, 36], [16, 37], [17, 35], [18, 32]],
  [[8, 41], [10, 42], [12, 42], [13, 41], [15, 41]],
  // Northern and southern walls of the northwestern basin.
  [[13, 16], [16, 15], [19, 15], [20, 16]],
  [[11, 20], [14, 22], [17, 23], [19, 22], [22, 22], [23, 23]],
  // Low ridges along the northern steppe and coastline.
  [[20, 16], [23, 16], [26, 16], [28, 16]],
  [[32, 14], [34, 13]],
  [[38, 13], [39, 15]],
  // Eastern continental peninsula.
  [[37, 18], [35, 19], [32, 21]],
  // Sanshan folds between Changshou and the northern coast of Ida.
  [[15, 47], [17, 45], [19, 46], [21, 47], [24, 47], [27, 46]],
  // The south-central peninsula and its spine.
  [[18, 50], [20, 51], [22, 52], [25, 53], [26, 55], [24, 58]],
  // Eastern arc.
  [[56.2, 8.4], [57.9, 9.2], [58.8, 11.9], [57.9, 13.6]],
  [[58.7, 20.4], [58.7, 24], [57.8, 26.6], [58.7, 29.2], [57.8, 31.9], [57.8, 34.5],
   [56.1, 37.2], [54.3, 38.9], [51.7, 41.6]],
  [[47.1, 48.4], [48.9, 49.2], [49.8, 51.9], [48.9, 53.6]],
  [[36, 55], [38, 56], [38, 58]],
];

export const RIVERS: readonly Path[] = [
  // From Zhongjing's divide to the sea, immediately north of Datai.
  [[19, 28], [21, 28], [21, 29], [25, 29], [25, 30], [28, 30], [28, 29], [32, 29],
   [32, 30], [35, 30], [35, 29], [40, 29]],
  // North River beside Fenghua.
  [[26, 17], [31, 17], [31, 16], [39, 16]],
  // The Chunzhou river reaches the sea north of its city.
  [[25, 39], [28, 39], [28, 40], [31, 40], [31, 39], [34, 39], [34, 40], [38, 40]],
  // Westward drainage across the low hills of the southern peninsula.
  [[27, 47], [27, 48], [25, 48], [25, 50], [20, 50], [20, 52], [17, 52]],
];

export interface StoryCity {
  x: number;
  y: number;
  name: string;
  region: string;
  capitalOfCivilization?: NationId;
}

type CityAnchor = readonly [x: number, y: number, name: string, capital?: NationId];

// Region labels are geographic. Opening ownership is declared only at the five capitals.
const districts: Readonly<Record<string, readonly CityAnchor[]>> = {
  "西北盆地": [
    [16, 16, "定衡", "determia"],
    [13, 17, "石渠"],
    [19, 18, "关朔"],
  ],
  "北部草原": [
    [23, 17, "怀远"],
  ],
  "东北海湾": [
    [36, 15, "丰化", "nosta"],
    [37, 18, "海陵"],
    [33, 18, "关津"],
    [33, 15, "澄浦"],
  ],
  "东岸半岛": [
    [30, 23, "烟津"],
  ],
  "帝国中原": [
    [29, 31, "望川"],
    [18, 28, "中京", "imperia"],
    [22, 31, "砾都"],
    [25, 32, "扬浦"],
    [28, 34, "岑阳"],
    [23, 24, "嘉原"],
    [34, 28, "台西"],
    [38, 30, "大台"],
    [19, 24, "漠海"],
    [29, 27, "枕江"],
    [32, 32, "丹阳"],
    [24, 36, "柳梁"],
    [37, 34, "岚港"],
    [40, 33, "辽汀"],
    [19, 34, "孤泉"],
  ],
  "西部高原": [
    [9, 39, "青棠"],
  ],
  "帝国南境": [
    [29, 38, "曲阳"],
    [36, 41, "春州"],
    [18, 44, "长守"],
    [32, 41, "章陆"],
    [23, 40, "南渡"],
    [18, 40, "渚台"],
    [27, 41, "东溆"],
  ],
  "南方半岛": [
    [27, 49, "榕潭"],
    [23, 51, "麦港"],
    [23, 54, "绯川", "ida"],
    [23, 46, "雨津"],
  ],
  "南方岛链": [
    [37, 56, "砂屿"],
    [40, 49, "琉汀"],
  ],
  "东方列岛": [
    [58, 10, "北汐"],
    [58, 21, "松津"],
    [59, 27, "镜川"],
    [61, 30, "千华", "rina"],
    [56, 34, "汐浦"],
    [53, 37, "青濑"],
    [47, 51, "桐华"],
  ],
};

export const STORY_CITIES: readonly StoryCity[] = Object.entries(districts).flatMap(([region, anchors]) =>
  anchors.map(([x, y, name, capitalOfCivilization]) => ({ x, y, name, region, capitalOfCivilization })),
);
