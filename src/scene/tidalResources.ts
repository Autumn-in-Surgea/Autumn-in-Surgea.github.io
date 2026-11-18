import { Miniature } from "./miniature";

type Point = [number, number, number];

// Broad planes carry the back, silver flank and belly even at board scale.
function trout(m: Miniature, x: number, z: number, size: number, heading: number) {
  const cos = Math.cos(heading), sin = Math.sin(heading);
  function point([a, b, c]: Point): Point {
    return [x + size * (a * cos + c * sin), 0.009 + size * b, z + size * (-a * sin + c * cos)];
  }
  function face(color: string, ...corners: Point[]) {
    m.face(color, corners.map(point));
  }

  // Sections run from the narrow tail wrist to the wedge-shaped nose.
  const sections: [number, number, number, number][] = [
    [-0.115, 0.083, 0.017, 0.016], [-0.056, 0.082, 0.043, 0.037],
    [0.033, 0.081, 0.057, 0.051], [0.098, 0.078, 0.046, 0.046],
    [0.146, 0.077, 0.032, 0.033], [0.18, 0.073, 0.009, 0.013],
  ];
  const rings = sections.map(([a, mid, h, w]): Point[] => [
    [a, mid + h, 0], [a, mid + h * 0.36, w * 0.95],
    [a, mid - h * 0.26, w], [a, mid - h, 0],
    [a, mid - h * 0.26, -w], [a, mid + h * 0.36, -w * 0.95],
  ]);
  const flank = ["#75988a", "#c5d0b4", "#dfd8b0", "#dfd8b0", "#b1c6b0", "#6b9486"];
  for (let i = 1; i < rings.length; i++) {
    for (let j = 0; j < flank.length; j++) {
      const next = (j + 1) % flank.length;
      face(flank[j], rings[i-1][j], rings[i-1][next], rings[i][next], rings[i][j]);
    }
  }
  face("#68867d", ...rings[0].slice().reverse());
  face("#a9bba3", ...rings[rings.length - 1]);

  // The two copper lobes have separate tips and meet at the caudal wrist.
  const wrist: Point = [-0.109, 0.082, 0];
  const notch: Point = [-0.17, 0.079, 0];
  for (const side of [-1, 1]) {
    const root: Point = [-0.121, 0.082, side * 0.012];
    const top: Point = [-0.198, 0.145, 0];
    const bottom: Point = [-0.195, 0.031, 0];
    const tailFaces: Point[][] = [[root, top, wrist], [root, notch, top], [root, bottom, notch], [root, wrist, bottom]];
    for (const corners of tailFaces) face("#bc8059", ...(side === 1 ? corners : corners.reverse()));
    const eye = point([0.125, 0.09, side * 0.037]);
    m.part("gem", "#394f4e", ...eye, 0.02*size, 0.021*size, 0.008*size, 0, heading);
  }
  // A narrow gill plate follows the sloping cheek on both sides of the head.
  for (const side of [-1, 1]) {
    const gill: Point[] = [[0.09,0.128,side*0.004],[0.085,0.102,side*0.039],
      [0.094,0.093,side*0.047],[0.097,0.116,side*0.018]];
    face("#d9c18c", ...gill);
    face("#d9c18c", ...gill.reverse());
  }

  const dorsal: Point[] = [[-0.071, 0.112, 0], [0.022, 0.123, 0], [-0.039, 0.173, 0]];
  face("#a68059", ...dorsal);
  face("#b99369", ...dorsal.reverse());
  const pectoral: Point[] = [[0.063, 0.079, 0.048], [0.032, 0.067, 0.078], [0.085, 0.085, 0.042]];
  face("#b89362", ...pectoral);
  face("#aa8259", ...pectoral.reverse());
}

export function fishShoal() {
  const m = new Miniature();
  trout(m, -0.053, -0.063, 1, 0.59);
  trout(m, 0.076, 0.126, 0.69, Math.PI + 0.35);
  return m.finish();
}

export function seaStar() {
  const m = new Miniature();
  const hub: Point = [0, 0.103, 0];
  const lengths = [0.35, 0.315, 0.34, 0.327, 0.36];
  const angles = [0.16, 1.38, 2.67, 3.93, 5.16];
  const bend = [0.063, -0.052, 0.068, 0.037, -0.059];
  function radial(angle: number, r: number, y: number, offset = 0): Point {
    return [r*Math.cos(angle) - offset*Math.sin(angle), y, r*Math.sin(angle) + offset*Math.cos(angle)];
  }
  // Positive yaw in the board plane is clockwise when viewed from above.
  function top(color: string, a: Point, b: Point, c: Point) {
    const up = (b[2] - a[2])*(c[0] - a[0]) - (b[0] - a[0])*(c[2] - a[2]);
    m.face(color, up >= 0 ? [a,b,c] : [a,c,b]);
  }
  function edge(a: Point, b: Point) {
    m.face("#a55e4b", [a, b, [b[0],0.012,b[2]], [a[0],0.012,a[2]]]);
  }

  const valleys = angles.map((angle,i) => radial((angle + (angles[i+1] ?? angles[0] + 2*Math.PI))/2, 0.108, 0.044));
  for (let i = 0; i < angles.length; i++) {
    const angle = angles[i], length = lengths[i];
    let left = valleys[(i + 4) % 5], right = valleys[i], spine = radial(angle,0.084,0.096);
    top("#e2a16e", hub, left, spine);
    top("#da9163", hub, spine, right);
    for (const [u, half, h] of [[0.46,0.056,0.078],[0.73,0.036,0.06],[0.92,0.021,0.038]]) {
      const shift = bend[i]*u*u;
      const l = radial(angle,length*u,0.025,shift-half);
      const r = radial(angle,length*u,0.026,shift+half);
      const crest = radial(angle,length*u,h,shift);
      top("#d9875a", left, spine, crest);
      top("#de9766", left, crest, l);
      top("#edb07b", spine, right, r);
      top("#e7a370", spine, r, crest);
      edge(left, l);
      edge(r, right);
      left = l; right = r; spine = crest;
    }
    const tip = radial(angle,length,0.022,bend[i]);
    top("#df9367", left, spine, tip);
    top("#efb780", spine, right, tip);
    edge(left,tip); edge(tip,right);
    for (const [u, y, w] of [[0.31,0.092,0.037],[0.50,0.079,0.032],[0.70,0.065,0.024]]) {
      m.part("crown","#f2d19b",...radial(angle,length*u,y,bend[i]*u*u),w,w*0.56,w,0,angle);
    }
  }
  m.part("crown", "#edb17c", 0.002,0.101,-0.005, 0.085,0.038,0.073,0,0.36);
  return m.finish();
}
