import type { ReactNode } from "react";
import type { BufferGeometry } from "three";
import { BUILDINGS } from "../game/data/config";
import type { MonumentId, Tile } from "../game/types";
import type { BuildingVisualTier } from "./buildingVisualTier";
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
const mooringDeck = 0.141;
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

export function portGangway(rise: number, tier: BuildingVisualTier) {
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

export function waterMonument(type: MonumentId, tier: BuildingVisualTier) {
  const m = new Miniature(), y = monumentDeck[type];
  switch (type) {
    case "altarOfPeace":
      roundFoot(m,0,0,0.34+tier*0.045,0.34+tier*0.045,y,gravel);
      if (tier>=2) for (const s of [-1,1]) {
        roundFoot(m,s*0.212,-0.161,0.183,0.243,y,turf);
      }
      for (const s of [-1,1]) roundFoot(m,s*0.081,0.20,0.093,0.085,y*0.55,gravel);
      break;
    case "emperorTomb": {
      const r = 0.215 + tier*0.027;
      islet(m,[[-r,-r*0.63],[-r*1.11,r*0.19],[-r*0.79,r*0.84],[r*0.21,r*0.97],
        [r*0.93,r*0.70],[r*1.06,-r*0.20],[r*0.83,-r*0.87],[-r*0.46,-r*0.93]],y,"#aba890",footing);
      m.part("crown",footing,-r*0.87,0.016,r*0.69,0.122,0.052,0.091,0,0.38);
      break;
    }
    case "eyeOfGod":
      roundFoot(m,0,0,0.212+tier*0.016,0.212+tier*0.016,y,stone);
      for (const s of [-1,1]) {
        roundFoot(m,s*0.214,0,tier===3 ? 0.156 : 0.055,tier===3 ? 0.184 : 0.063,y,footing);
        m.beam(iron,[0,y-0.016,0],[s*0.214,y-0.024,0],0.028);
      }
      break;
    case "gateOfPower":
      for (const s of [-1,1]) {
        const x = s*(0.107+tier*0.027), r=0.071+tier*0.004;
        islet(m,[[x-r,-0.096],[x-r,0.094],[x,0.165],[x+r,0.09],[x+r,-0.098],[x,-0.157]],y,gravel,footing);
      }
      break;
    case "grandBazaar": {
      const width=0.28+tier*0.046;
      jetty(m,0,-0.106,width+(tier>=2 ? 0.164 : 0),tier===3 ? 0.314 : 0.200,y);
      jetty(m,0,0.140,width+(tier===3 ? 0.211 : 0),0.137,y);
      for (const s of [-1,1]) jetty(m,s*width*0.41,0.054,0.047,0.076,y);
      break;
    }
    case "parkOfFortune": {
      const east = tier>=2 ? 0.236 : 0.18, west = tier===3 ? -0.297 : -0.195;
      islet(m,[[west,-0.102],[west-0.013,0.114],[west+0.026,0.231],[-0.114,0.259],
        [-0.009,0.192],[0.128,0.226],[0.251,0.127],[0.223,-0.009],
        [east,-0.153],[east-0.073,-0.231],[0.024,-0.184],[-0.133,-0.182]],y,turf,sand);
      m.part("crown",stone,west,0.009,0.126,0.059,0.035,0.091);
      break;
    }
    case "towerOfWisdom":
      roundFoot(m,0,0,0.252+tier*0.053,0.252+tier*0.053,y,gravel);
      for (const s of [-1,1]) {
        m.part("hip",footing,s*0.142,0.015,-0.177,0.075,0.054,0.132,0,s*0.61);
        if (tier===3) roundFoot(m,s*0.203,-0.077,0.143,0.296,y,stone);
      }
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
