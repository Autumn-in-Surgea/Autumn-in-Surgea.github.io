import type { MonumentId } from "../../../game/types";
import type { BuildingVisualTier as Tier } from "../../../scene/buildingVisualTier";
import type { Miniature } from "../../../scene/miniature";
import { crate, rural } from "./ruralKit";

type Point = [number, number, number];

// Ridge, under-eaves and upturned corner tiles are visible from the board camera.
// Slice a shallow hipped roof into sloping tile courses, including the four end hips.
function tiledRoof(m: Miniature, x: number, y: number, z: number, w: number, d: number, rise: number, tile: string) {
  const ridge = w*.30;
  m.box(rural.timber, x, y-.007, z, w*.91, .020, d*.90);
  for (const side of [-1, 1]) {
    const pitch: Point[][] = [
      [[-ridge,rise,0],[0,rise,0],[ridge,rise,0]],
      [[-w*.43,rise*.25,side*d*.33],[0,rise*.25,side*d*.33],[w*.43,rise*.25,side*d*.33]],
      [[-w*.5,.010,side*d*.5],[0,0,side*d*.5],[w*.5,.010,side*d*.5]],
    ].map(row => row.map(([u,v,j]):Point => [x+u,y+v,z+j]));
    for (let i=1; i<pitch.length; i++) for (let j=0; j<2; j++) {
      const face=[pitch[i-1][j],pitch[i][j],pitch[i][j+1],pitch[i-1][j+1]];
      m.face(tile,side>0 ? face : face.reverse());
    }
    for (let j=0; j<2; j++) m.beam(rural.iron,pitch[2][j],pitch[2][j+1],.012,.014);
  }
  for (const side of [-1,1]) {
    const crown:Point=[x+side*ridge,y+rise,z];
    const back:Point=[x+side*w*.5,y+.010,z-d*.5];
    const front:Point=[x+side*w*.5,y+.010,z+d*.5];
    m.face(tile,side>0 ? [crown,front,back] : [crown,back,front]);
    m.beam(rural.slate, crown, back, .012);
    m.beam(rural.slate, crown, front,.012);
  }
  m.box(rural.iron,x,y+rise+.004,z,2*ridge+.020,.014,.019);
}

function stall(m: Miniature, x: number, z: number, w: number, h: number, canvas: string, owner: string) {
  // Sewn cloth droops between the ridge, the stitched middle seam and the valance.
  const apron = z+.078, eave=h-.028;
  for (const side of [-1, 1]) {
    m.box(rural.timber,x+side*w*.46,h/2,z-.020,.015,h,.018);
    m.box(rural.timber,x+side*w*.46,eave/2,apron,.012,eave,.012);
    m.beam(rural.endgrain,[x+side*w*.46,h,z-.02],[x+side*w*.46,eave,apron],.012);
  }
  m.box(rural.board,x,eave-.002,apron,w+.012,.012,.013);
  const strips = 5;
  for (let i=0; i<strips; i++) {
    const left=x+w*(i/strips-.5),right=left+w/strips;
    const tone = i===1 ? owner : canvas;
    m.face(tone,[[left,h,z-.044],[left,h-.033,z+.028],[right,h-.033,z+.028],[right,h,z-.044]]);
    m.face(tone,[[left,h-.033,z+.028],[left,eave,apron],[right,eave,apron],[right,h-.033,z+.028]]);
    m.face(tone,[[left,eave,apron],[left+.004,eave-.017,apron+.002],
      [right-.004,eave-.017,apron+.002],[right,eave,apron]]);
  }
  // Baskets are deliberately forward of the cloth. The open table reads in silhouette.
  for (const side of [-1,1]) m.box(rural.board,x+side*w*.34,.034,z+.079,.026,.068,.063);
  m.box(rural.endgrain,x,.074,z+.079,w*.86,.015,.092);
  for (const side of [-1,1]) {
    const bx=x+side*w*.204;
    m.part("hip",rural.timber,bx,.091,z+.084,w*.32,.025,.067,Math.PI);
    m.part("crown", side<0 ? "#ad7456" : "#909663", bx,.109,z+.083,w*.24,.027,.048);
  }
}

function produceExchange(m: Miniature, x: number, z: number, tier: Tier, owner: string, bazaar: boolean) {
  const w=.27+tier*.081, d=.147, bays=tier+1;
  const bay=w/bays, h=.130+tier*.029, eave=h+.015;
  const front=z+d/2, back=z-d/2;
  const roof="#75828b";

  // The raised dock, trestles and open bays form a produce exchange. Goods can pass
  // straight out of the rail-sided hall onto the forecourt, underneath a sheet canopy.
  m.box(rural.brick,x,.014,z+.024,w+.018,.028,d+.066);
  m.box(rural.board,x,.034,z+.024,w+.030,.012,d+.079);
  m.box(rural.board,x,h*.51,back,w,.84*h,.022);
  m.box(rural.timber,x,h-.009,back,w+.013,.019,.031);
  for (let i=0;i<=bays;i++) {
    const post=x-w*.50+bay*i;
    m.box(rural.timber,post,(h+.027)/2,front-.012,.019,h-.017,.024);
    if(i===0 || i===bays) {
      m.box(rural.clay,post,h*.52,z,.023,h*.78,d*.93);
    }
  }
  m.box(rural.timber,x,h+.003,front-.010,w+.034,.022,.029);
  for (let i=0;i<bays;i++) {
    const center=x-w/2+bay*(i+.5);
    m.box(rural.shade,center,h*.60,back+.014,bay*.61,h*.55,.012);
    m.box(rural.brick,center,.061,front+.022,bay*.69,.044,.070);
    m.box(rural.endgrain,center,.085,front+.022,bay*.77,.010,.074);
    m.part("crown",i%2 ? "#aec08a" : "#ae7759",center,.100,front+.032,bay*.62,.030,.048);
  }

  if (bazaar) {
    // Each trading family occupies one vaulted bay. The scalloped roofline
    // reads across the public aisle; it differs from the exchange's rail shed.
    for(let i=0;i<bays;i++) {
      const start=x-w/2+i*bay, left=start-.006, span=bay+.012;
      for(let k=0;k<4;k++) {
        const x0=left+span*k/4, x1=left+span*(k+1)/4;
        const y0=eave+.070*Math.sin(k*Math.PI/4);
        const y1=eave+.070*Math.sin((k+1)*Math.PI/4);
        const pigment=i%2 ? "#998368" : "#7a9086";
        m.face(pigment,[[x0,y0,back-.017],[x0,y0,front+.014],[x1,y1,front+.014],[x1,y1,back-.017]]);
        m.face(rural.endgrain,[[x0,y0-.012,front+.014],[x1,y1-.012,front+.014],
          [x1,y1,front+.014],[x0,y0,front+.014]]);
      }
      m.box(rural.timber,start,eave,z,.012,.016,d+.035);
    }
  } else {
    // A glazed ridge monitor lights the sorting floor without filling the loading bays.
    const pitch=Math.atan2(.040,d/2);
    for(const side of [-1,1]) {
      m.box(roof,x,eave+.020,z+side*d*.26,w+.041,.014,Math.hypot(.040,d*.50)+.010,side*pitch);
    }
    m.box("#527075",x,eave+.052,z,w*.73,.029,.042);
    m.box(rural.slate,x,eave+.070,z,w*.77,.013,.059);
  }
  m.box(rural.canvas,x,h-.012,front+.031,w+.034,.012,.086,.17);
  m.box(owner,x,h-.023,front+.073,w*.20,.015,.008);
  for (const side of [-1,1]) {
    m.beam(rural.timber,[x+side*w*.47,h-.047,front],[x+side*w*.47,h-.022,front+.067],.011);
  }
}

function market(m: Miniature, tier: Tier, owner: string, bazaar: boolean) {
  if (bazaar) {
    produceExchange(m,-.035,-.111,tier,owner,true);
    stall(m,.078,.112,.169+tier*.013,.114+tier*.021,rural.canvas,owner);
    if(tier>=2) crate(m,.173,0,-.092,.067);
    if(tier===3) stall(m,-.140,.108,.166,.158,rural.reed,owner);
    return;
  }
  produceExchange(m,-.032,-.108,tier,owner,false);
  // Freestanding weighing table, produce baskets and a handcart at the head of the lane.
  m.box(rural.board,.117,.033,.115,.101,.066,.067);
  m.box(rural.iron,.114,.076,.117,.073,.023,.049);
  m.box(rural.iron,.102,.109,.113,.010,.064,.010);
  m.beam(rural.brass,[.067,.132,.113],[.142,.126,.113],.008);
  m.part("hip",rural.brass,.140,.111,.114,.036,.014,.032,Math.PI);
  crate(m,-.041,0,.125,.083);
  if(tier>=2) {
    crate(m,-.125,0,.100,.077);
    crate(m,-.113,.054,.103,.062);
    // Iron wheels and handles give the delivery barrow a different outline from a stall.
    for(const side of [-1,1]) {
      m.part("octagon",rural.iron,.206+side*.046,.030,.033,.059,.011,.059,0,0,Math.PI/2);
      m.beam(rural.timber,[.206+side*.029,.038,.005],[.206+side*.036,.063,.143],.009);
    }
    m.part("hip",rural.board,.206,.058,.055,.091,.039,.083,Math.PI);
  }
  if(tier===3) {
    stall(m,-.203,.153,.160,.143,rural.sage,owner);
    m.part("octagon",rural.clay,.031,.039,.191,.063,.078,.067);
    m.part("octagon",rural.iron,.031,.061,.191,.065,.008,.070);
  }
}

function bench(m: Miniature, x: number, z: number, w: number) {
  for (const sign of [-1,1]) m.box(rural.stone, x + sign*w*.34, .018, z, .021, .036, .044);
  m.box(rural.board, x, .041, z, w, .015, .048);
}

function steppingStone(m: Miniature, x: number, z: number) {
  m.part("octagon", rural.stone, x, .007, z, .092, .014, .044, 0, -.13);
}

function sapling(m: Miniature, x: number, z: number, h: number) {
  m.part("octagon", rural.timber, x, h*.25, z, .027, h*.5, .029);
  m.part("foliage", rural.sage, x, h*.72, z, h*.60, h*.56, h*.56);
}

function lantern(m: Miniature, x: number, z: number, h: number) {
  m.part("octagon",rural.stone,x,h*.34,z,.037,h*.68,.039);
  m.box(rural.shade,x,h*.73,z,.051,h*.24,.047);
  m.box(rural.canvas,x,h*.73,z+.024,.027,h*.14,.005);
  m.part("hip",rural.slate,x,h*.91,z,.067,h*.20,.061);
}

function plainShrine(m: Miniature, tier: Tier, owner: string) {
  const x=-.035, z=-.040, h=.127+tier*.032;
  // A timber-framed wayside chapel on a narrow threshold of dressed brick.
  m.box(rural.brick,x,.018,z,.242,.036,.143);
  m.box(rural.plaster,x,h*.50+.022,z-.024,.201,h-.020,.090);
  m.box(rural.shade,x,h*.49+.017,z+.025,.116,h*.77,.012);
  for (const side of [-1,1]) {
    m.box(rural.timber,x+side*.098,h*.51+.014,z+.034,.021,h,.032);
    m.box(rural.brick,x+side*.093,.041,z+.041,.040,.024,.062);
    m.beam(rural.board,[x+side*.094,h-.019,z+.036],[x+side*.068,h+.010,z+.036],.013);
  }
  m.box(rural.board,x,h+.011,z+.033,.239,.023,.047);
  m.box(owner,x,h+.011,z+.058,.063,.018,.006);
  tiledRoof(m,x,h+.034,z,.300,.209,.049,"#687b80");
  m.part("octagon",rural.clay,x,.043,z+.049,.085,.040,.067);
  m.part("crown",rural.plaster,x,.083,z+.042,.052,.052,.048);
  m.part("octagon",rural.stone,x,.011,z+.101,.175,.022,.058);
  steppingStone(m,x+.014,.133);
  if (tier>=2) lantern(m,.145,.055,.100);
  if (tier===3) {
    bench(m,-.107,.155,.130);
    m.box(rural.brick,.133,.021,-.077,.087,.042,.062);
    m.part("foliage","#84966c",.133,.060,-.077,.099,.050,.075);
  }
}

function groveShrine(m: Miniature, tier: Tier, owner: string) {
  const x=.087,z=.098,h=.141+tier*.026;
  // Bell and external striker face the clearing. All living trees are supplied by the forest tile.
  for (const side of [-1,1]) {
    const post=x+side*.123;
    m.part("octagon",rural.stone,post,.021,z,.047,.042,.056);
    m.box(rural.timber,post,h/2+.014,z,.029,h-.012,.049);
    m.beam(rural.board,[post,h-.059,z+.010],[post-side*.046,h+.001,z+.010],.019);
    m.box(rural.board,post,h+.003,z,.063,.017,.068);
  }
  m.box(rural.timber,x,h+.014,z,.302,.031,.055);
  tiledRoof(m,x,h+.043,z-.021,.326,.128,.037,"#6d7870");
  m.box(rural.iron,x,h-.009,z+.016,.013,.043,.018);
  m.part("crown","#65867b",x,h-.046,z+.019,.068,.046,.064);
  m.part("octagon","#668077",x,h-.082,z+.019,.088,.064,.083);
  m.part("hip","#62776a",x,h-.114,z+.019,.116,.032,.107);
  m.part("octagon",rural.brass,x,h-.129,z+.019,.118,.013,.110);
  m.box(owner,x+.112,h*.56,z+.026,.022,.053,.007);
  m.part("octagon",rural.timber,x+.094,h-.094,z+.036,.025,.119,.025,Math.PI/2);
  m.beam(rural.shade,[x+.094,h+.007,z],[x+.094,h-.091,z+.061],.007);
  steppingStone(m,x+.015,.231);
  if (tier>=2) {
    lantern(m,-.097,.171,.102);
    steppingStone(m,.025,.282);
  }
  if (tier===3) {
    m.box(rural.timber,.268,.057,.104,.020,.114,.022);
    m.box(rural.board,.268,.111,.104,.082,.056,.014);
    m.box(rural.slate,.268,.142,.104,.089,.013,.027);
  }
}

function mountainShrine(m: Miniature, tier: Tier, owner: string) {
  const x=.073,z=.130, h=.127+tier*.031;
  // A rock-cut niche first, then a short retaining wall and terrace steps.
  // The slopes behind it consist of the original peaks, supplied by the terrain.
  m.part("bevel",rural.stone,x,h*.51,z-.023,.162,h,.080);
  m.box(rural.shade,x,h*.54,z+.019,.083,h*.69,.009);
  for(const sign of [-1,1]) {
    m.part("bevel",rural.brick,x+sign*.061,h*.61,z+.017,.030,h*.83,.049);
    m.box(rural.slate,x+sign*.060,h+.002,z+.016,.046,.017,.057);
  }
  m.part("hip","#806e62",x,h+.027,z-.004,.210,.039,.117);
  m.box(rural.plaster,x,h+.053,z-.009,.147,.017,.090);
  m.part("crown",rural.plaster,x,h*.50,z+.028,.045,.067,.039);
  m.box(owner,x,.036,z+.061,.048,.016,.009);
  for (let i=0;i<3;i++) {
    m.part("bevel",i%2 ? "#939283":rural.stone,x+.018*i,.027-.009*i,z+.063+i*.041,
      .146+i*.008,.054-.018*i,.060,0,-i*.06);
  }
  for (const [u,v,s] of [[-.127,-.014,.072],[-.181,-.030,.059],[.110,-.027,.060]]) {
    m.part("bevel",rural.stone,x+u,.021,z+v,s,.042,.056,0,u);
  }
  if (tier>=2) {
    m.box(rural.timber,x-.149,.071,z+.009,.015,.142,.014);
    m.beam(rural.timber,[x-.149,.139,z+.009],[x-.093,.139,z+.009],.012);
    m.box(rural.canvas,x-.118,.113,z+.011,.042,.048,.009);
  }
  if (tier===3) lantern(m,x+.132,z+.086,.098);
}

function waterShrine(m: Miniature, tier: Tier, owner: string) {
  const x=-.039,z=-.034,eave=.144+tier*.027;
  for (const u of [-.095,.095]) for (const v of [-.058,.062]) {
    m.part("octagon",rural.timber,x+u,.051,z+v,.035,.102,.036);
    m.box(rural.board,x+u,(eave+.054)/2,z+v,.019,eave-.047,.021);
    m.beam(rural.timber,[x+u,.038,z+v],[x+u*.54,.068,z+v],.013);
  }
  m.box(rural.timber,x,.058,z,.238,.028,.162);
  for(let i=0;i<6;i++) m.box(i%2 ? rural.board : "#a18a6f",x,.078,z+(i-2.5)*.028,.246,.014,.026);
  m.box(rural.timber,x,eave,z,.238,.021,.147);
  tiledRoof(m,x,eave+.019,z,.271,.191,.047,"#6a827b");
  m.part("octagon",rural.stone,x,.099,z,.066,.027,.061);
  m.part("octagon",rural.canvas,x,.136,z,.062,.055,.060);
  m.part("hip",rural.iron,x,.170,z,.070,.022,.068);
  m.box(owner,x,eave,z+.075,.065,.017,.008);
  for (const u of [-.057,0,.057]) m.box(rural.board,x+u,eave-.037,z-.058,.008,.063,.008);
  if(tier>=2) {
    for(const v of [.008,.134]) m.part("octagon",rural.timber,.162,.045,v,.025,.090,.025);
    for(let i=0;i<4;i++) m.box(rural.board,.114,.075,.017+i*.031,.136,.017,.029);
    m.beam(rural.iron,[.162,.082,.008],[.162,.081,.134],.007);
  }
  if(tier===3) {
    m.box(rural.board,.122,.057,.160,.087,.014,.038);
    for(const u of [.085,.159]) m.beam(rural.timber,[u,.006,.199],[u,.073,.139],.013);
    m.box(rural.board,.122,.029,.181,.073,.011,.014);
    lantern(m,.076,-.077,.117);
  }
}

function peaceAltar(m: Miniature, tier: Tier, owner: string) {
  const h = .066 + tier*.025;
  m.part("hip", rural.stone, 0,h/2,0,.150,h,.124);
  m.part("octagon", rural.brick,0,.010,0,.185,.020,.151);
  m.part("octagon", rural.stone,0,h-.006,0,.143,.023,.128);
  m.box(rural.iron,0,h*.40,.051,.067,.033,.010);
  m.box(owner,0,h*.40,.059,.053,.022,.007);
  // A single pale bird, poised with both wings open above the inscription.
  m.part("crown", rural.canvas, 0,h+.050,.007, .059,.083,.120, -.30);
  m.part("crown", rural.plaster, 0,h+.088,.057, .045,.050,.055);
  m.part("gem", rural.endgrain, 0,h+.086,.090, .027,.022,.043);
  for (const sign of [-1,1]) {
    m.part("hip", rural.plaster, sign*.057,h+.084,-.011,.040,.105,.086, .08,0,-sign*.90);
    m.part("gem", rural.canvas, sign*.104,h+.120,-.023,.035,.056,.056, 0,0,-sign*.81);
  }
  if (tier>=2) {
    steppingStone(m,0,.127);
    for(const side of [-1,1]) m.part("crown","#88966e",side*.078,.021,-.064,.038,.042,.043);
  }
  if (tier===3) {
    bench(m,-.147,-.081,.106);
    m.part("octagon",rural.clay,-.129,.019,-.034,.045,.038,.041);
    m.part("gem",rural.canvas,-.129,.051,-.034,.040,.045,.038);
  }
}

function tomb(m: Miniature, tier: Tier, owner: string) {
  const h = .138 + tier*.039;
  m.part("octagon",rural.stone,-.015,.019,-.035,.302,.038,.222);
  m.part("foliage","#7f896b",-.015,.077,-.041,.290,.102,.204);
  m.part("bevel",rural.stone,.012,h*.5,.059,.122,h,.053);
  m.box(rural.plaster,.012,h*.55,.087,.081,h*.69,.012);
  m.part("hip",rural.slate,.012,h+.012,.062,.138,.029,.069);
  for (const x of [-.034,.058]) m.box(rural.iron,x,h*.64,.095,.007,.54*h,.008);
  for(let i=0;i<3;i++) m.box(rural.slate,.012,h*(.70-i*.12),.094,.034-i*.004,.006,.007);
  m.box(owner,.012,.031,.095,.056,.018,.009);
  m.part("bevel",rural.stone,.012,.016,.104,.119,.032,.055);
  if (tier >= 2) steppingStone(m,.018,.138);
  if (tier === 3) {
    for (const x of [-.100,.100]) m.part("octagon", rural.stone,x,.028,.115,.039,.056,.042);
  }
}

function observatory(m: Miniature, tier: Tier, owner: string) {
  const r = .085 + tier*.014, h = .099 + tier*.022;
  m.part("hip", rural.stone, 0,.037,0,.132,.074,.122);
  m.part("octagon", rural.iron, 0,(.071+h)/2,0,.037,h-.071,.037);
  // A meridian and a tilted optical tube leave the centre visibly open.
  for (let i=0; i<12; i++) {
    const angle = i*Math.PI/6, next = (i+1)*Math.PI/6;
    m.beam(rural.brass, [r*Math.cos(angle),h+r*Math.sin(angle),0],
      [r*Math.cos(next),h+r*Math.sin(next),0], .016,.020);
  }
  m.beam(rural.iron, [-.043,h-.030,-.068],[.039,h+.027,.078],.035,.039);
  m.part("octagon",owner,.039,h+.027,.079,.046,.023,.046,Math.PI/2-.35,0,-.53);
  // Graduations cut into the horizontal compass table tie the ring to its foot.
  m.part("octagon",rural.brass,0,.063,0,.135,.013,.107);
  for (const side of [-1,1]) m.box(rural.slate,side*.042,.072,.003,.012,.006,.050);
  if(tier>=2) {
    // A second meridian seen at an angle is hollow, like the actual setting circle.
    for(let i=0;i<10;i++) {
      const point=(j:number): Point => {
        const ang=j*Math.PI/5;
        return [r*.85*Math.cos(ang),h+r*.33*Math.sin(ang),r*.63*Math.sin(ang)];
      };
      m.beam(rural.iron,point(i),point(i+1),.010);
    }
  }
  if(tier===3) {
    for (const side of [-1,1]) {
      m.part("octagon",rural.stone,side*.104,.018,0,.036,.036,.049);
      m.beam(rural.iron,[side*.104,.032,0],[side*r,h,0],.014);
    }
  }
}

function gate(m: Miniature, tier: Tier, owner: string) {
  // These foot centres also determine the separate islets when built over water.
  const dx=.107+tier*.027, eave=.116+tier*.035;
  for (const sign of [-1,1]) {
    m.part("bevel", rural.stone, sign*dx,eave/2,0,.068,eave,.093);
    m.box(rural.slate,sign*dx,eave-.019,0,.080,.022,.103);
    if (tier>=2) m.box(rural.brick,sign*dx,.015,0,.088,.030,.111);
  }
  // Individual voussoirs, cut on radial joints, leave a true arched opening.
  const rise=.068;
  const radius=dx+.004, thickness=.039;
  function corner(angle:number,outer:boolean,z:number):Point {
    return [Math.cos(angle)*(radius+(outer ? thickness : 0)),
      eave+Math.sin(angle)*(rise+(outer ? thickness : 0)),z];
  }
  for(let i=0;i<7;i++) {
    const a=i*Math.PI/7+.007,b=(i+1)*Math.PI/7-.007;
    const material=i===3 ? rural.plaster : i%2===0 ? rural.stone : "#aaa692";
    const outerA=corner(a,true,.045), outerB=corner(b,true,.045);
    const innerA=corner(a,false,.045), innerB=corner(b,false,.045);
    m.face(material,[innerA,outerA,outerB,innerB]);
    m.face(material,[outerA,corner(a,true,-.045),corner(b,true,-.045),outerB]);
    m.face(rural.shade,[innerB,corner(b,false,-.045),corner(a,false,-.045),innerA]);
    m.face(material,[corner(b,false,-.045),corner(b,true,-.045),corner(a,true,-.045),corner(a,false,-.045)]);
  }
  m.box(owner,0,eave+rise+.025,.047,.036,.018,.006);
  for(const sign of [-1,1]) {
    for(let i=1;i<3;i++) m.box(rural.brick,sign*dx,eave*i/3,.049,.045,.007,.008);
    if(tier===3) lantern(m,sign*dx,.089,.086);
  }
}

function garden(m: Miniature, tier: Tier, owner: string) {
  const h=.169+tier*.039;
  sapling(m,-.080,-.074,h);
  m.part("crown","#82956f",-.110,h*.72,-.091,h*.47,h*.30,h*.43,0,.38);
  m.part("crown","#738d69",-.052,h*.61,-.058,h*.32,h*.28,h*.37,0,-.2);
  const x=.053, z=.072, w=.130+tier*.021;
  m.part("drum",rural.stone,x,.024,z,w,.048,w);
  m.part("drum","#729394",x,.048,z,w*.79,.008,w*.79);
  m.part("octagon",rural.stone,x,.078,z,.037,.059,.038);
  m.part("hip",rural.slate,x,.106,z,.072,.026,.071,Math.PI);
  m.part("gem","#86a6a3",x,.139,z,.030,.052,.028);
  m.box(owner,x,.030,z+w*.48,.032,.017,.009);
  m.part("octagon",rural.stone,x,.008,z,w+.036,.015,w+.037);
  if(tier>=2) {
    bench(m,-.105,.091,.103);
    for (const u of [-.113,-.080]) m.part("gem","#a1a76d",u,.029,-.031,.047,.053,.051);
  }
  if(tier===3) {
    sapling(m,.112,-.094,.154);
    m.part("crown","#879575",.100,.115,-.095,.073,.062,.075);
    lantern(m,.106,-.017,.103);
  }
}

function readingTower(m: Miniature, tier: Tier, owner: string) {
  const h=.085+tier*.039;
  m.part("bevel", rural.brick, 0,h/2,0,.143,h,.132);
  m.part("bevel",rural.stone,0,.012,0,.171,.024,.154);
  m.box(rural.shade,0,h*.40,.068,.044,h*.69,.008);
  m.box(rural.plaster,0,h*.75,.069,.064,.013,.011);
  for(const z of [-.031,.030]) m.box(rural.shade,.073,h*.60,z,.009,.039,.023);
  m.box(rural.stone,0,h,0,.172,.025,.154);
  for (const x of [-.055,.055]) for (const z of [-.048,.048]) {
    m.box(rural.timber,x,h+.047,z,.017,.088,.017);
  }
  m.box(rural.plaster,0,h+.045,0,.096,.057,.016);
  m.box(owner,0,h+.041,.010,.042,.024,.007);
  m.box(rural.board,0,h+.083,0,.177,.019,.158);
  for(const x of [-.053,.053]) m.beam(rural.timber,[x,h+.047,.047],[x*.58,h+.081,.047],.010);
  tiledRoof(m,0,h+.097,0,.214,.187,.047,"#63787d");
  if (tier>=2) for (const x of [-.032,.032]) m.box(rural.shade,x,h*.79,.068,.021,.025,.009);
  if (tier===3) bench(m,.111,-.013,.077);
}

export function civicGround(m: Miniature, type: MonumentId | "market" | "temple" | "forestTemple" | "mountainTemple" | "waterTemple", owner: string, tier: Tier) {
  switch (type) {
    case "market": case "grandBazaar": return market(m,tier,owner,type === "grandBazaar");
    case "temple": return plainShrine(m,tier,owner);
    case "forestTemple": return groveShrine(m,tier,owner);
    case "mountainTemple": return mountainShrine(m,tier,owner);
    case "waterTemple": return waterShrine(m,tier,owner);
    case "altarOfPeace": return peaceAltar(m,tier,owner);
    case "emperorTomb": return tomb(m,tier,owner);
    case "eyeOfGod": return observatory(m,tier,owner);
    case "gateOfPower": return gate(m,tier,owner);
    case "parkOfFortune": return garden(m,tier,owner);
    case "towerOfWisdom": return readingTower(m,tier,owner);
  }
}

// The original tier-three sculpture remains the heart of a mature district.
// Place the new halls around its working front; the ground in between becomes
// an actual street, precinct or garden, rather than a podium under the model.
function masonryHall(m: Miniature, x: number, z: number, w: number, d: number, eave: number, tile: string, plaster = rural.plaster) {
  m.box(rural.stone,x,.018,z,w+.012,.036,d+.014);
  m.box(plaster,x,(eave+.026)/2,z,w,eave-.026,d);
  m.box(rural.timber,x,eave-.008,z,w+.014,.019,d+.015);
  const count=w>.25 ? 4 : 2;
  for(let i=0;i<count;i++) {
    const u=x+w*((i+.5)/count-.5);
    m.box(rural.shade,u,eave*.52,z+d*.5+.003,w*.53/count,eave*.52,.006);
    m.box(rural.board,u,eave*.48,z+d*.5+.008,.010,eave*.46,.005);
  }
  m.box(rural.shade,x+w*.5+.003,eave*.56,z,.006,eave*.34,d*.55);
  tiledRoof(m,x,eave+.014,z,w+.042,d+.039,.050,tile);
}

function pilgrimGallery(m: Miniature, x: number, z: number, w: number, d: number, h: number, tile: string) {
  // Repeated transverse bents and knees make an open shelter even at low zoom.
  for(const u of [-w*.43,0,w*.43]) for(const v of [-d*.34,d*.34]) {
    m.part("octagon",rural.stone,x+u,.022,z+v,.039,.044,.041);
    m.box(rural.timber,x+u,h*.5+.017,z+v,.022,h-.012,.025);
    m.beam(rural.board,[x+u,h-.029,z+v],[x+u,h,z+v*.36],.013);
  }
  m.box(rural.board,x,h,z,w,.020,d*.76);
  tiledRoof(m,x,h+.025,z,w+.043,d+.049,.041,tile);
}

function packingHouse(m: Miniature, owner: string) {
  // An auction office and hoist sit at the head of the potato and grain dock.
  const z=-.286;
  masonryHall(m,-.078,z,.364,.132,.234,"#738186",rural.brick);
  m.box(rural.stone,.194,.014,z,.153,.028,.139);
  m.box(rural.timber,.194,.194,z,.087,.340,.092);
  for(const u of [-.039,.039]) m.box(rural.plaster,.194+u,.280,z+.046,.014,.124,.013);
  m.box(rural.shade,.194,.289,z+.050,.051,.065,.009);
  m.box(owner,.194,.224,z+.051,.044,.023,.009);
  m.part("hip",rural.slate,.194,.382,z,.142,.053,.143);
  m.beam(rural.timber,[.194,.327,z],[.320,.327,-.182],.021);
  m.beam(rural.iron,[.317,.327,-.182],[.317,.146,-.182],.007);
  m.box(rural.board,.317,.120,-.182,.060,.050,.058);
  m.box(rural.board,.339,.018,-.022,.098,.036,.202);
  for(const v of [-.071,.020]) crate(m,.333,.036,v,.081);
  m.box(rural.stone,.079,.013,-.218,.185,.026,.044);
}

function coveredBazaar(m: Miniature, owner: string) {
  const z=-.300, w=.463;
  // High clerestory behind the lower shop vaults and one transverse arcade
  // turn the parallel rows into a market with a continuous pedestrian circuit.
  m.box(rural.stone,-.012,.019,z,w+.034,.038,.146);
  m.box(rural.brick,-.012,.122,z-.044,w,.205,.058);
  for(let i=0;i<5;i++) {
    const x=-.207+i*.097;
    m.box(rural.plaster,x,.140,z+.040,.025,.246,.031);
    m.part("bevel",rural.stone,x,.031,z+.038,.046,.062,.045);
    if(i<4) m.box(rural.board,x+.048,.070,z+.027,.078,.085,.040);
  }
  m.box(rural.timber,-.012,.255,z+.040,w+.032,.024,.042);
  m.box(rural.canvas,-.012,.272,z,w+.054,.020,.168,.22);
  m.box("#5d7772",-.012,.309,z-.023,w*.70,.055,.075);
  for(const x of [-.115,-.012,.091]) m.box(rural.canvas,x,.313,z+.017,.049,.028,.006);
  m.part("hip",rural.sage,-.012,.359,z-.023,w*.79,.072,.120);
  m.box(owner,-.012,.247,z+.065,.070,.030,.008);
  // The narrow western row faces the courtyard and shares its wharf on water.
  for(const v of [-.071,.045,.157]) {
    m.box(rural.timber,-.344,.050,v,.076,.100,.086);
    m.box(rural.endgrain,-.319,.110,v,.123,.018,.092);
    m.part("crown",rural.reed,-.311,.130,v,.053,.027,.061);
  }
  for (const v of [-.100,.084,.190]) m.box(rural.timber,-.353,.111,v,.016,.221,.019);
  m.box("#9d856b",-.336,.213,.042,.118,.016,.327,0,0,-.16);
}

function pilgrimageCourt(m: Miniature, owner: string) {
  masonryHall(m,-.050,-.252,.342,.172,.284,"#667983");
  pilgrimGallery(m,-.265,.027,.122,.256,.133,"#797e78");
  pilgrimGallery(m,.237,-.036,.105,.213,.141,"#797e78");
  for(const x of [-.075,.071]) {
    m.part("octagon",rural.stone,x,.040,.255,.047,.080,.047);
    m.box(rural.timber,x,.091,.255,.027,.103,.026);
  }
  m.box(rural.board,-.002,.140,.255,.202,.025,.042);
  m.box(owner,-.005,.119,.255,.080,.025,.015);
  steppingStone(m,-.001,.313);
}

function woodlandPriory(m: Miniature, owner: string) {
  // Dense native conifers remain on the northern/western side. Occupy the
  // two sides of the existing bell clearing where the approach opens out.
  const x=.312,z=.098;
  masonryHall(m,x,z,.130,.250,.176,"#757869","#a19c81");
  m.box(rural.brick,.274,.036,.245,.078,.072,.053);
  m.box(rural.board,.274,.087,.245,.082,.027,.056);
  const left=-.142,right=.096, front=.320;
  for(const u of [left,right]) {
    m.part("bevel",rural.stone,u,.036,front,.057,.072,.068);
    m.box(rural.timber,u,.164,front,.034,.255,.041);
    m.box(rural.board,u,.259,front,.071,.021,.065);
    m.beam(rural.board,[u,.222,front],[u===left ? u+.054 : u-.054,.280,front],.019);
  }
  m.box(rural.timber,-.023,.284,front,.321,.026,.059);
  tiledRoof(m,-.023,.305,front,.345,.118,.042,"#6c7e79");
  m.box(owner,-.023,.252,front,.076,.040,.013);
  lantern(m,-.193,.267,.147);
  steppingStone(m,-.019,.389);
}

function cliffHermitage(m: Miniature, owner: string) {
  // A two-level timber gallery hugs the outer right toe without replacing either peak.
  const x=.287,z=.147,w=.120,d=.193;
  for(const u of [-.043,.043]) for(const v of [-.070,.073]) {
    m.box(rural.timber,x+u,.098,z+v,.026,.196,.028);
    m.beam(rural.board,[x+u,.037,z+v],[x+u*.28,.121,z+v],.018);
  }
  m.box(rural.board,x,.139,z,w+.035,.026,d+.045);
  m.box(rural.plaster,x,.213,z-.024,w,.136,d*.69);
  for(const v of [-.045,.010]) m.box(rural.shade,x+w*.5+.002,.218,z+v,.006,.054,.039);
  m.box(owner,x,.212,z+.046,.036,.054,.006);
  tiledRoof(m,x,.285,z-.015,.178,.234,.054,"#756e65");
  for(const sign of [-1,1]) m.beam(rural.timber,[x+sign*.049,.010,.358],[x+sign*.049,.143,.250],.015);
  for(let i=0;i<5;i++) m.box(rural.stone,x,.016+.025*i,.356-i*.022,.111,.023,.030);
  m.part("bevel",rural.stone,-.083,.040,.229,.113,.080,.066);
  m.part("bevel",rural.stone,-.083,.145,.227,.080,.148,.037);
  m.box(rural.iron,-.083,.146,.247,.047,.073,.007);
}

function lakeSanctuary(m: Miniature, owner: string) {
  // Approach crosses a low footbridge to an octagonal lantern hall on its own piles.
  const x=-.203,z=-.225;
  for(let i=0;i<8;i++) {
    const a=i*Math.PI/4, u=x+.118*Math.sin(a),v=z+.107*Math.cos(a);
    m.part("octagon",rural.timber,u,.045,v,.027,.090,.029);
    m.box(rural.timber,u,.189,v,.018,.224,.020);
  }
  m.part("octagon",rural.board,x,.085,z,.297,.030,.271);
  m.part("drum",rural.plaster,x,.165,z,.138,.121,.126);
  m.part("octagon",rural.board,x,.238,z,.146,.028,.141);
  m.part("gem",rural.canvas,x,.262,z,.111,.055,.106);
  m.part("octagon",rural.timber,x,.291,z,.291,.028,.269);
  m.part("spire","#698176",x,.345,z,.329,.111,.302);
  m.part("octagon",rural.iron,x,.404,z,.039,.020,.036);
  m.box(owner,x,.278,z+.124,.068,.026,.012);
  for(let i=0;i<4;i++) {
    const u=-.164+i*.025,v=-.120+i*.018;
    m.box(rural.board,u,.077,v,.082,.013,.033,0,-.66);
  }
  for(const v of [-.103,.113]) m.part("octagon",rural.timber,.256,.056,v,.027,.112,.026);
  m.box(rural.board,.246,.077,.010,.081,.020,.264);
  m.box(rural.board,.201,.077,.090,.074,.020,.068);
  m.beam(rural.iron,[.256,.107,-.103],[.256,.105,.113],.009);
}

function memorialCourt(m: Miniature, owner: string) {
  const x=[-.215,-.171,0,.171,.215], z=[-.025,-.177,-.226,-.177,-.025], h=.227;
  for(let i=0;i<x.length;i++) {
    m.part("octagon",rural.stone,x[i],.022,z[i],.071,.044,.072);
    m.part("octagon",rural.plaster,x[i],h*.52,z[i],.036,h-.031,.038);
    m.part("octagon",rural.stone,x[i],h-.008,z[i],.059,.030,.058);
    if(i>0) {
      m.beam(rural.stone,[x[i-1],h,z[i-1]],[x[i],h,z[i]],.040,.055);
      m.beam(rural.slate,[x[i-1],h+.022,z[i-1]],[x[i],h+.022,z[i]],.014,.061);
    }
  }
  m.part("bevel",rural.stone,0,.149,-.221,.151,.297,.046);
  m.part("hip",rural.plaster,0,.305,-.221,.165,.046,.062);
  m.box(owner,0,.195,-.195,.077,.030,.008);
  for(const side of [-1,1]) {
    m.box(rural.timber,side*.154,.033,-.114,.069,.024,.075);
    m.part("foliage","#768870",side*.154,.085,-.114,.077,.091,.086);
  }
}

function imperialNecropolis(m: Miniature, owner: string) {
  // A burial chapel closes the long processional axis behind the older mound.
  masonryHall(m,-.039,-.228,.333,.158,.250,"#7c807a",rural.stone);
  m.box(rural.timber,-.043,.126,-.144,.141,.183,.013);
  m.box(owner,-.042,.200,-.134,.058,.030,.008);
  for(const sign of [-1,1]) {
    const x=sign*.180;
    // Narrow clipped cypresses and a pair of low funerary pylons mark entry.
    m.part("octagon",rural.timber,x,.065,.139,.028,.130,.030);
    m.part("whorl","#617b68",x,.214,.139,.094,.245,.102);
    m.part("whorl","#77866b",x-.007,.279,.139,.071,.155,.075);
    m.part("bevel",rural.stone,x,.052,.235,.065,.104,.069);
    m.part("hip",rural.slate,x,.117,.235,.078,.033,.080);
  }
  for(let i=0;i<3;i++) m.box(rural.stone,0,.009,.183+i*.047,.182+i*.022,.018,.040);
}

function meridianObservatory(m: Miniature, owner: string) {
  const x=-.191,z=-.178,r=.141, spring=.255;
  m.part("octagon",rural.stone,x,.021,z,r*2.07,.042,r*1.94);
  m.part("octagon",rural.plaster,x,spring*.52,z,r*1.80,spring-.033,r*1.74);
  m.part("octagon",rural.slate,x,spring-.013,z,r*1.98,.026,r*1.93);
  // The dome slit runs from the entrance to the zenith; an open dark segment
  // distinguishes the observing station from a domed garden pavilion.
  const longitude=(i:number,v:number):Point => {
    const a=i*Math.PI/6, c=Math.cos(v);
    return [x+r*c*Math.sin(a),spring+r*.89*Math.sin(v),z+r*c*Math.cos(a)];
  };
  for(let i=0;i<12;i++) {
    const paint=i===0 ? rural.shade : i%3===0 ? "#74918b" : "#607f7d";
    for(let band=0;band<3;band++) {
      const low=band*Math.PI/6,high=(band+1)*Math.PI/6;
      if(band<2) m.face(paint,[longitude(i,low),longitude(i+1,low),longitude(i+1,high),longitude(i,high)]);
      else m.face(paint,[longitude(i,low),longitude(i+1,low),[x,spring+r*.89,z]]);
    }
  }
  m.box(rural.shade,x,.112,z+.120,.062,.144,.010);
  m.box(owner,x,.168,z+.130,.038,.028,.008);
  m.box(rural.stone,-.066,.012,-.065,.096,.024,.104,0,-.40);
  m.part("octagon",rural.stone,.175,.055,.088,.058,.110,.061);
  m.part("disc",rural.brass,.175,.119,.088,.117,.022,.116);
  m.part("gem",rural.iron,.176,.148,.086,.022,.056,.054,0,.58,-.26);
}

function guardLodges(m: Miniature, owner: string) {
  for(const side of [-1,1]) {
    const x=side*.291,z=-.079;
    masonryHall(m,x,z,.126,.119,.174,"#777e7b",rural.brick);
    m.box(rural.board,side*.226,.054,.049,.068,.107,.029);
    const pole=side*.175;
    m.part("octagon",rural.stone,pole,.025,-.159,.055,.050,.054);
    m.box(rural.timber,pole,.202,-.159,.017,.360,.018);
    m.box(rural.brass,pole,.375,-.159,.088,.012,.017);
    m.box(owner,pole+side*.021,.324,-.159,.047,.096,.011);
    m.box(rural.canvas,pole+side*.021,.282,-.158,.048,.013,.012);
  }
}

function winterGarden(m: Miniature, owner: string) {
  const x=-.020,z=-.238,w=.376,d=.143,h=.155;
  m.box(rural.brick,x,.034,z,w,.068,d);
  for(const side of [-1,1]) {
    m.box("#88a5a1",x,.108,z+side*d*.45,w-.010,.093,.010);
    m.box(rural.sage,x,.141,z+side*d*.45,w,.015,.018);
  }
  // Cast-iron ribs repeat across an arched glasshouse; the gables carry a
  // short raised lantern over the centre of the winter collection.
  const profile=(i:number):[number,number] => {
    const a=i*Math.PI/6;
    return [h+.108*Math.sin(a),z-.079*Math.cos(a)];
  };
  for(let i=0;i<6;i++) {
    const [y0,z0]=profile(i),[y1,z1]=profile(i+1);
    m.face(i<3 ? "#6d9390" : "#91aaa0",[[x-w/2,y0,z0],[x-w/2,y1,z1],[x+w/2,y1,z1],[x+w/2,y0,z0]]);
    for(const u of [-w*.5,-w*.25,0,w*.25,w*.5])
      m.beam(rural.iron,[x+u,y0,z0],[x+u,y1,z1],.009);
  }
  for(let i=0;i<5;i++) {
    const u=x+w*(i/4-.5);
    m.box(rural.iron,u,h*.70,z+d*.48,.010,.133,.014);
  }
  m.box("#67877d",x,.272,z,.113,.054,.060);
  m.part("hip",rural.iron,x,.310,z,.139,.040,.094);
  m.box(owner,x,.101,z+d*.52,.060,.021,.006);
  for(const side of [-1,1]) {
    const u=side*.226;
    for(let i=0;i<2;i++) {
      const v=.022+i*.097;
      m.part("octagon",rural.clay,u,.018,v,.058,.036,.061);
      m.part("foliage","#79976e",u,.067,v,.076,.091,.067);
    }
  }
}

function academy(m: Miniature, owner: string) {
  // A two-wing library shares its reading court with the old tower.
  masonryHall(m,-.188,-.184,.258,.142,.193,"#697e83",rural.brick);
  masonryHall(m,.184,-.128,.128,.151,.159,"#778886");
  const x=-.263,z=-.195;
  m.part("octagon",rural.plaster,x,.279,z,.098,.181,.099);
  m.part("octagon",rural.stone,x,.360,z,.115,.023,.117);
  m.part("spire","#657e7b",x,.391,z,.126,.065,.127);
  m.box(rural.shade,x,.309,z+.049,.038,.046,.010);
  m.box(owner,x,.282,z+.052,.041,.016,.009);
  m.box(rural.stone,-.133,.0145,-.058,.152,.029,.071);
  m.box(rural.stone,.127,.0115,-.026,.092,.023,.066);
}

export function civicExpansion(m: Miniature, type: Parameters<typeof civicGround>[1], owner: string) {
  switch(type) {
    case "market": return packingHouse(m,owner);
    case "grandBazaar": return coveredBazaar(m,owner);
    case "temple": return pilgrimageCourt(m,owner);
    case "forestTemple": return woodlandPriory(m,owner);
    case "mountainTemple": return cliffHermitage(m,owner);
    case "waterTemple": return lakeSanctuary(m,owner);
    case "altarOfPeace": return memorialCourt(m,owner);
    case "emperorTomb": return imperialNecropolis(m,owner);
    case "eyeOfGod": return meridianObservatory(m,owner);
    case "gateOfPower": return guardLodges(m,owner);
    case "parkOfFortune": return winterGarden(m,owner);
    case "towerOfWisdom": return academy(m,owner);
  }
}
