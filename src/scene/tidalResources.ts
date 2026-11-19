import { Miniature } from "./miniature";

type Point = [number, number, number];

// Broad planes carry the back, silver flank and belly even at board scale.
function trout(m: Miniature, x: number, z: number, size: number, heading: number, golden: boolean) {
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
  const flank = golden
    ? ["#687562", "#ae996e", "#c9baa0", "#c9baa0", "#a28f64", "#5e786f"]
    : ["#405e62", "#8aa5a3", "#bdc3b8", "#bdc3b8", "#769493", "#4e6e74"];
  for (let i = 1; i < rings.length; i++) {
    for (let j = 0; j < flank.length; j++) {
      const next = (j + 1) % flank.length;
      face(flank[j], rings[i-1][j], rings[i-1][next], rings[i][next], rings[i][j]);
    }
  }
  face("#6a8b82", ...rings[0].slice().reverse());
  face("#a0ae99", ...rings[rings.length - 1]);

  // The two copper lobes have separate tips and meet at the caudal wrist.
  const wrist: Point = [-0.109, 0.082, 0];
  const notch: Point = [-0.17, 0.079, 0];
  for (const side of [-1, 1]) {
    const root: Point = [-0.121, 0.082, side * 0.012];
    const top: Point = [-0.198, 0.145, 0];
    const bottom: Point = [-0.195, 0.031, 0];
    const tailFaces: Point[][] = [[root, top, wrist], [root, notch, top], [root, bottom, notch], [root, wrist, bottom]];
    for (const corners of tailFaces) face(golden ? "#aa7d5f" : "#936551", ...(side === 1 ? corners : corners.reverse()));
    const eye = point([0.125, 0.09, side * 0.037]);
    m.part("gem", "#314842", ...eye, 0.02*size, 0.021*size, 0.008*size, 0, heading);
  }
  // A narrow gill plate follows the sloping cheek on both sides of the head.
  for (const side of [-1, 1]) {
    const gill: Point[] = [[0.09,0.128,side*0.004],[0.085,0.102,side*0.039],
      [0.094,0.093,side*0.047],[0.097,0.116,side*0.018]];
    face("#c1ac83", ...gill);
    face("#c1ac83", ...gill.reverse());
  }

  // A folded enamel fin has a raised spine, a swept tip and two distinct
  // planes under the fixed camera. Small fins balance the tail on either flank.
  const finRoot: Point = [-0.069, 0.108, 0], finFront: Point = [0.027, 0.127, 0];
  const peak: Point = [-0.034, 0.175, 0], back: Point = [-0.053, 0.162, 0];
  for (const side of [-1, 1]) {
    const ridge: Point = [-0.023, 0.138, side*0.008];
    const fan = [[finRoot, back, ridge], [back, peak, ridge], [peak, finFront, ridge], [finRoot, ridge, finFront]];
    for (const [i, corners] of fan.entries()) {
      face(i === 2 ? "#b69372" : "#947257", ...(side < 0 ? corners.reverse() : corners));
    }
    const shoulder: Point = [0.067, 0.083, side*0.047];
    const tip: Point = [0.013, 0.055, side*0.091], root: Point = [0.088, 0.077, side*0.04];
    const fold: Point = [0.051, 0.079, side*0.066];
    for (const [i, corners] of [[shoulder, tip, fold], [fold, tip, root]].entries()) {
      const exterior = side < 0 ? corners.reverse() : corners;
      face(i ? "#9b775b" : "#bba080", ...exterior);
      face("#92705b", ...exterior.slice().reverse());
    }
  }
}

export function fishShoal() {
  const m = new Miniature();
  trout(m, -0.117, -0.079, 0.7, 0.57, false);
  trout(m, 0.097, -0.133, 0.56, 0.3, true);
  trout(m, 0.082, 0.085, 0.65, 0.63, false);
  trout(m, -0.10, 0.139, 0.50, 0.77, true);
  return m.finish();
}

function star(m: Miniature, x: number, z: number, size: number, heading: number, coral: boolean) {
  const cos = Math.cos(heading), sin = Math.sin(heading);
  function place([a, y, b]: Point): Point {
    return [x + size * (a * cos + b * sin), y * size, z + size * (-a * sin + b * cos)];
  }
  const [side, dark, base, light, tip, dots] = coral
    ? ["#764539", "#93584b", "#a86953", "#ba7b62", "#c4896d", "#dac09a"]
    : ["#6e4851", "#85535d", "#995f6b", "#ac7480", "#ba8890", "#cfadaf"];
  const hub = place([0, 0.103, 0]);
  const lengths = [0.35, 0.315, 0.34, 0.327, 0.36];
  const angles = [0.16, 1.38, 2.67, 3.93, 5.16];
  const bend = [0.063, -0.052, 0.068, 0.037, -0.059];
  function radial(angle: number, r: number, y: number, offset = 0): Point {
    return place([r*Math.cos(angle) - offset*Math.sin(angle), y, r*Math.sin(angle) + offset*Math.cos(angle)]);
  }
  // Positive yaw in the board plane is clockwise when viewed from above.
  function top(color: string, a: Point, b: Point, c: Point) {
    const up = (b[2] - a[2])*(c[0] - a[0]) - (b[0] - a[0])*(c[2] - a[2]);
    m.face(color, up >= 0 ? [a,b,c] : [a,c,b]);
  }
  function edge(a: Point, b: Point) {
    m.face(side, [a, b, [b[0],0.012*size,b[2]], [a[0],0.012*size,a[2]]]);
  }

  const valleys = angles.map((angle,i) => radial((angle + (angles[i+1] ?? angles[0] + 2*Math.PI))/2, 0.108, 0.044));
  for (let i = 0; i < angles.length; i++) {
    const angle = angles[i], length = lengths[i];
    let left = valleys[(i + 4) % 5], right = valleys[i], spine = radial(angle,0.084,0.096);
    top(light, hub, left, spine);
    top(base, hub, spine, right);
    for (const [u, half, h] of [[0.46,0.056,0.078],[0.73,0.036,0.06],[0.92,0.021,0.038]]) {
      const shift = bend[i]*u*u;
      const l = radial(angle,length*u,0.025,shift-half);
      const r = radial(angle,length*u,0.026,shift+half);
      const crest = radial(angle,length*u,h,shift);
      top(dark, left, spine, crest);
      top(base, left, crest, l);
      top(tip, spine, right, r);
      top(light, spine, r, crest);
      edge(left, l);
      edge(r, right);
      left = l; right = r; spine = crest;
    }
    const end = radial(angle,length,0.022,bend[i]);
    top(base, left, spine, end);
    top(tip, spine, right, end);
    edge(left,end); edge(end,right);
    if (coral) for (const [u, y, w] of [[0.31,0.092,0.048],[0.56,0.074,0.041]]) {
      m.part("gem", dots, ...radial(angle,length*u,y,bend[i]*u*u), w*size,w*size*0.56,w*size,0,angle+heading);
    }
  }
  // Five grooves meet around a shallow central rosette.
  const inner = angles.map(angle => radial(angle, 0.042, 0.111));
  const outer = angles.map((angle,i) => radial(angle, 0.077, 0.092, bend[i]*0.025));
  const centre = place([0, 0.118, 0]);
  for (let i = 0; i < angles.length; i++) {
    const next = (i+1) % angles.length;
    top(dots, centre, inner[i], inner[next]);
    top(dark, inner[i], outer[i], inner[next]);
    top(light, inner[next], outer[i], outer[next]);
  }
}

export function seaStar() {
  const m = new Miniature();
  star(m, -0.107, -0.053, 0.69, 0.18, true);
  star(m, 0.161, 0.141, 0.45, -0.31, false);
  return m.finish();
}
