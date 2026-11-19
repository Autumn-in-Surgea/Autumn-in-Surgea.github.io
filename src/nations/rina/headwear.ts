import * as THREE from "three";
import { ellipse, shell, band, part } from "../_shared/pawns/millinery";

const uniformFelt = new THREE.MeshStandardMaterial({
  name: "Rina · deep sea felt",
  color: "#326b67",
  roughness: 0.9,
});
const innerFelt = new THREE.MeshStandardMaterial({
  name: "Rina · shaded sea felt",
  color: "#275654",
  roughness: 0.91,
});
const braid = new THREE.MeshStandardMaterial({
  name: "Rina · antique-gold braid",
  color: "#b7a16b",
  roughness: 0.71,
  metalness: 0.13,
});

// Annular brim of a cocked felt hat. Its front and rear leaves roll up
// towards the blocked crown, while the two ends come to long rounded tips.
function brimPoint(t: number, theta: number, layer = 0) {
  const s = Math.sin(theta),
    c = Math.cos(theta),
    ac = Math.abs(c),
    ax = Math.abs(s);
  const front = (c + 1) * 0.5;
  const curl = t * t * (3 - 2 * t);
  const width = 0.32 + 0.307 * t;
  const depth = 0.259 + 0.101 * Math.sin(Math.PI * t) - 0.044 * t;
  const x = width * s;
  const z = Math.sign(c) * depth * ac ** 1.24;
  const edgePeak = 0.428 - 0.106 * front;
  const softDip = 0.038 * Math.exp(-(((ax - 0.84) / 0.16) ** 2));
  const tipLift = 0.039 * ax ** 10;
  const edgeY = 0.072 + (edgePeak - 0.072) * ac ** 2.3 - softDip + tipLift + 0.022 * x;
  const y = 0.044 + (edgeY - 0.044) * curl - 0.043 * Math.sin(Math.PI * t) * (1 - ac * 0.17);
  return [x + layer * 0.006 * s, y - layer * 0.004 * (1 - curl), z + layer * 0.009 * c];
}
export function rina() {
  const hat = new THREE.Group();
  hat.name = "Rina — sea officer bicorne";
  hat.scale.setScalar(0.92);
  const sculpt = new THREE.Group();
  sculpt.rotation.y = 0.38;
  hat.add(sculpt);
  sculpt.add(
    band(
      "Fitted oval felt crown",
      [
        [-0.029, 0.32, 0.251],
        [-0.018, 0.332, 0.263],
        [0.041, 0.339, 0.267],
        [0.093, 0.337, 0.267],
        [0.157, 0.323, 0.259],
        [0.214, 0.302, 0.242],
        [0.262, 0.274, 0.221],
        [0.301, 0.232, 0.191],
        [0.328, 0.177, 0.153],
        [0.345, 0.108, 0.097],
        [0.349, 0.039, 0.034],
      ],
      innerFelt,
      56,
    ),
  );
  const outer = [0, 0.08, 0.18, 0.29, 0.4, 0.53, 0.65, 0.76, 0.86, 0.92, 0.962, 0.984, 1];
  const samples = [
    ...outer.map((t) => [t, 1]),
    [1.001, 0.7],
    [1.002, 0.22],
    [1.0, -0.42],
    [0.99, -0.7],
    ...outer
      .slice(0, -1)
      .reverse()
      .map((t) => [t, -0.72]),
  ];
  const mat: number[] = [];
  const rings = samples.map(([t, layer], i) => {
    if (i) mat.push(Math.min(t, samples[i - 1][0]) >= 0.962 ? 2 : layer >= 0 ? 0 : 1);
    return ellipse(72, (theta) => brimPoint(t, theta, layer));
  });
  sculpt.add(shell("Two cocked and bound leaves", rings, [uniformFelt, innerFelt, braid], mat, false));
  // Pleated dark silk cockade pinned on the starboard half of the near leaf.
  const t = 0.76,
    theta = 0.47;
  const v = (t: number, theta: number) => new THREE.Vector3(...brimPoint(t, theta, 1));
  const station = v(t, theta);
  const east = v(t, theta + 0.005)
    .sub(v(t, theta - 0.005))
    .normalize();
  const up = v(t + 0.005, theta)
    .sub(v(t - 0.005, theta))
    .normalize();
  const outward = east.clone().cross(up).normalize();
  const rosetteRings = [
    [0.004, 0.059],
    [0.01, 0.064],
    [0.019, 0.047],
    [0.021, 0.023],
    [0.015, 0.008],
  ].map(([depth, r], i) =>
    ellipse(40, (angle) => {
      const radius = r * (1 + 0.058 * Math.cos(10 * angle));
      const lift = depth + Math.cos(10 * angle) * 0.003 * (i < 3 ? 1 : 0);
      return [radius * Math.sin(angle), lift, radius * Math.cos(angle)];
    }),
  );
  const cockade = shell("Silk cockade", rosetteRings, innerFelt);
  cockade.position.copy(station).addScaledVector(outward, 0.005);
  cockade.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), outward);
  sculpt.add(cockade);
  const button = part("Cockade pin", new THREE.SphereGeometry(1, 14, 10), braid);
  button.position.copy(station).addScaledVector(outward, 0.027);
  button.quaternion.copy(cockade.quaternion);
  button.scale.set(0.026, 0.011, 0.026);
  sculpt.add(button);
  return hat;
}
