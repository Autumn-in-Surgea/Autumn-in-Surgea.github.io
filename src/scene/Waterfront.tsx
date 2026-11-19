import type { ReactNode } from "react";
import type { BufferGeometry } from "three";
import { BUILDINGS } from "../game/data/config";
import type { MonumentId, Tile } from "../game/types";
import { facilityLayoutTier, mooringDeck, type BuildingVisualTier } from "./buildingVisualTier";
import { Miniature } from "./miniature";
import { terrainHeight } from "./terrainElevation";
import { useTerritoryMaterial } from "./territoryMaterials";

interface ShoreProps {
  tile: Tile;
  tiles: readonly Tile[];
  size: number;
  explored: ReadonlySet<number>;
}

const timber = "#877052", iron = "#58645f", stone = "#adad91", footing = "#777e70";
const sand = "#ae9a73", turf = "#92a26c", gravel = "#c2b89b";
const tide = -0.009;
const cardinal = [[0,-1],[-1,0],[0,1],[1,0]] as const;

// Face the back of the existing pier (-Z) toward a known bank. Prefer the
// shallowest gangway; equally good banks keep the same grid-based tie break.
export function portShore({ tile, tiles, size, explored }: ShoreProps) {
  let bank: { rotation: number; rise: number } | undefined;
  for (const [dx,dz] of cardinal) {
    const x = tile.x+dx, y = tile.y+dz;
    if (x<0 || y<0 || x>=size || y>=size) continue;
    const id = y*size+x;
    if (!explored.has(id)) continue;
    const next = tiles[id];
    if (next.terrain === "deep" || next.terrain === "shallow") continue;
    const rise = terrainHeight(next)-terrainHeight(tile);
    if (!bank || rise < bank.rise)
      bank = { rotation: Math.atan2(-dx,-dz), rise };
  }
  return bank;
}

export function portGangway(rise: number, stage: BuildingVisualTier) {
  const tier = facilityLayoutTier(stage);
  const m = new Miniature();
  // The landing enters the strip between the warehouse and the crane. Its
  // walking surface meets the pier at one end and the tile seam at the other.
  const x = -0.060, w = 0.097 + 0.008*tier;
  const start = -0.148, end = -0.50, landing = rise+0.003;
  const y = (t: number) => mooringDeck+(landing-mooringDeck)*t;
  const z = (t: number) => start+(end-start)*t;
  const rails = tier > 1;
  for (const side of [-1,1]) {
    const a = x+side*w/2;
    m.beam(iron,[a,y(0)-0.018,z(0)+0.003],[a,y(1)-0.018,z(1)+0.006],0.018);
    for (const t of [0.29,0.82]) {
      const top = y(t)+(rails ? 0.044 : 0.007);
      m.part("octagon", timber, a,(top+tide)/2,z(t),0.022,top-tide,0.022);
    }
    if (rails)
      m.beam(tier === 3 ? "#a98d59" : timber,[a,y(0.29)+0.042,z(0.29)],[a,y(0.82)+0.042,z(0.82)],0.011);
  }
  const tint = tier === 3 ? "#b8ad90" : "#b29570";
  for (let i=0; i<8; i++) {
    const t0 = i/8, t1 = (i+1)/8;
    m.face(i%3 ? tint : "#a99477", [
      [x-w/2,y(t0),z(t0)], [x+w/2,y(t0),z(t0)],
      [x+w/2,y(t1),z(t1)], [x-w/2,y(t1),z(t1)],
    ]);
  }
  if (stage === 3) {
    // Rails are flush with the walking deck and meet the quay freight line.
    for (const gauge of [-.031,.031])
      m.beam(iron, [x+gauge,y(0)+.003,z(0)], [x+gauge,y(1)+.003,z(1)+.006], .007);
  }
  return m.finish();
}

type Shoreline = ReadonlyArray<readonly [x: number,z: number]>;

// The top and side courses share each cut of the shore. The points trace a
// star-shaped contour about its centre so even a lobed island has a solid cap.
function islet(m: Miniature, contour: Shoreline, top: number, ground: string, edge: string) {
  const cx = contour.reduce((sum,p)=>sum+p[0],0)/contour.length;
  const cz = contour.reduce((sum,p)=>sum+p[1],0)/contour.length;
  const bottom = (x: number,z: number): [number,number,number] =>
    [cx+(x-cx)*1.12,tide,cz+(z-cz)*1.12];
  for (let i=0;i<contour.length;i++) {
    const [x,z] = contour[i], [a,b] = contour[(i+1)%contour.length];
    m.face(ground, [[cx,top,cz],[x,top,z],[a,top,b]]);
    m.face(edge, [bottom(x,z),bottom(a,b),[a,top,b],[x,top,z]]);
  }
}

function roundFoot(m: Miniature, x: number, z: number, w: number, d: number, top: number, color: string) {
  m.part("octagon", footing, x,(top+tide)/2,z,w,top-tide,d);
  m.part("octagon", color, x,top-0.005,z,w*1.05,0.010,d*1.05);
}

function jetty(m: Miniature, x: number, z: number, w: number, d: number, deck: number) {
  for (const side of [-1,1]) for (const end of [-1,1])
    m.part("octagon", timber, x+w*0.42*side,(deck+tide)*0.5,z+d*0.40*end,0.027,deck-tide,0.027);
  m.box("#977a55",x,deck-0.010,z,w,0.020,d);
  for (let i=1;i<4;i++) m.box("#ab9067",x+w*(i/4-0.5),deck-0.001,z,0.007,0.002,d-0.006);
}

const monumentDeck: Record<MonumentId,number> = {
  altarOfPeace: 0.034, emperorTomb: 0.048, eyeOfGod: 0.063, gateOfPower: 0.044,
  grandBazaar: 0.076, parkOfFortune: 0.031, towerOfWisdom: 0.046,
};

export function waterMonument(type: MonumentId, stage: BuildingVisualTier) {
  const tier = facilityLayoutTier(stage);
  const m = new Miniature(), y = monumentDeck[type];
  if (stage === 3) {
    // Follow the actual outer walls, planted walks and landing piles. One
    // continuous land cap avoids coincident surfaces in the older foundations.
    switch (type) {
      case "altarOfPeace":
        islet(m, [[-.275,-.265],[-.283,.022],[-.209,.115],[-.079,.182],[.093,.182],
          [.259,.078],[.280,-.187],[.232,-.273]], y, gravel, footing);
        break;
      case "emperorTomb":
        islet(m, [[-.274,-.345],[-.312,-.093],[-.280,.210],[-.175,.327],
          [.145,.323],[.278,.227],[.297,-.069],[.229,-.348]], y, "#aba890", footing);
        m.part("crown",footing,-.251,.014,.218,.113,.054,.090,0,.35);
        break;
      case "eyeOfGod":
        islet(m, [[-.362,-.326],[-.362,-.031],[-.211,.027],[-.118,.105],
          [.123,.120],[.155,.165],[.258,.163],[.260,.026],[.118,-.050],
          [.105,-.116],[.010,-.141],[-.037,-.323]], y, stone, footing);
        break;
      case "gateOfPower":
        for (const side of [-1,1]) {
          const landing: [number,number][] = [[.091,-.175],[.095,.033],[.163,.169],
            [.249,.126],[.279,.025],[.393,.014],[.394,-.186],[.290,-.217],[.162,-.206]];
          const contour = side === 1 ? landing : landing.map(([x,z]): [number,number] => [-x,z]).reverse();
          islet(m,contour,y,gravel,footing);
        }
        break;
      case "grandBazaar":
        // Edge-to-edge landings share one walking level without overlapping planks.
        jetty(m,-.045,-.256,.700,.266,y);
        jetty(m,.025,-.051,.560,.144,y);
        jetty(m,-.325,.047,.140,.340,y);
        jetty(m,-.015,.142,.480,.150,y);
        jetty(m,.050,.044,.067,.046,y);
        break;
      case "parkOfFortune":
        islet(m, [[-.265,-.344],[-.312,-.113],[-.307,.147],[-.221,.253],
          [-.042,.281],[.223,.253],[.303,.174],[.273,-.131],[.216,-.344]],y,turf,sand);
        break;
      case "towerOfWisdom":
        islet(m, [[-.361,-.293],[-.366,-.079],[-.235,-.048],[-.149,.089],
          [-.053,.135],[.134,.130],[.170,.017],[.285,-.005],[.290,-.232],
          [.108,-.235],[-.053,-.271]],y,gravel,footing);
        break;
    }
    return m.finish();
  }
  switch (type) {
    case "altarOfPeace": {
      // A single landing carries the bird, its path, and the bench added at tier three.
      const west = tier === 3 ? -.224 : -.111;
      const front = tier >= 2 ? .171 : .096;
      islet(m, [[west,-.110],[west,.029],[-.077,front],[.087,front],
        [.121,.033],[.090,-.121]], y, gravel, footing);
      break;
    }
    case "emperorTomb": {
      const r = 0.190 + tier*0.014;
      islet(m,[[-r,-r*0.63],[-r*1.11,r*0.19],[-r*0.79,r*0.84],[r*0.21,r*0.97],
        [r*0.93,r*0.70],[r*1.06,-r*0.20],[r*0.83,-r*0.87],[-r*0.46,-r*0.93]],y,"#aba890",footing);
      m.part("crown",footing,-r*0.87,0.016,r*0.69,0.122,0.052,0.091,0,0.38);
      break;
    }
    case "eyeOfGod":
      roundFoot(m, 0, 0, .218 + tier * .023, .171 + tier * .012, y, stone);
      break;
    case "gateOfPower":
      for (const s of [-1,1]) {
        const x = s*(0.107+tier*0.027), r=0.071+tier*0.004;
        islet(m,[[x-r,-0.096],[x-r,0.094],[x,0.165],[x+r,0.09],[x+r,-0.098],[x,-0.157]],y,gravel,footing);
      }
      break;
    case "grandBazaar": {
      const backWidth = .325 + .086 * tier;
      jetty(m, -.035, -.099, backWidth, .245, y);
      jetty(m, tier === 3 ? -.015 : .073, .141, tier === 3 ? .444 : .222, .145, y);
      jetty(m, .050, .027, .066, .102, y);
      break;
    }
    case "parkOfFortune": {
      // Follow the planting and fountain at the front of the island; leave open water around it.
      const west = tier >= 2 ? -.188 : -.148;
      const east = tier === 3 ? .189 : .154;
      islet(m, [[west,-.098],[west,.118],[-.115,.152],[.024,.185],[.138,.157],
        [east,.078],[east,-.127],[.064,-.161],[-.114,-.146]], y, turf, sand);
      break;
    }
    case "towerOfWisdom":
      roundFoot(m, tier === 3 ? .021 : 0, 0, .218 + tier * .032, .189 + tier * .017, y, gravel);
      break;
  }
  return m.finish();
}

const shared = new Map<string,BufferGeometry>();
function sharedGeometry(key: string, build: () => BufferGeometry) {
  let shape = shared.get(key);
  if (!shape) { shape=build(); shared.set(key,shape); }
  return shape;
}

export function Waterfront({ children, tier, ...props }: ShoreProps & { tier: BuildingVisualTier; children: ReactNode }) {
  const material = useTerritoryMaterial();
  const { building,terrain } = props.tile;
  if (terrain !== "shallow" && terrain !== "deep") return <>{children}</>;
  if (building === "port") {
    const shore = portShore(props);
    if (!shore) return <>{children}</>;
    const gangway = sharedGeometry(`gangway:${tier}:${shore.rise}`, ()=>portGangway(shore.rise,tier));
    return <group rotation={[0,shore.rotation,0]}>
      {children}
      <mesh name="port-gangway" geometry={gangway} material={material} castShadow receiveShadow dispose={null} />
    </group>;
  }
  if (!building || !BUILDINGS[building].monument) return <>{children}</>;
  const monument = building as MonumentId;
  const bed = sharedGeometry(`shore:${monument}:${tier}`, ()=>waterMonument(monument,tier));
  return <>
    <mesh name="monument-waterline" geometry={bed} material={material} castShadow receiveShadow dispose={null} />
    <group position-y={monumentDeck[monument]}>{children}</group>
  </>;
}
