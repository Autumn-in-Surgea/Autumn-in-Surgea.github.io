import * as THREE from "three";
import { ellipse, shell, band } from "../_shared/pawns/millinery";

const wool = new THREE.MeshStandardMaterial({
  name: "Ida · scarlet fulled wool",
  color: "#ac364c",
  roughness: 0.94,
});
const oxblood = new THREE.MeshStandardMaterial({
  name: "Ida · oxblood leather",
  color: "#773542",
  roughness: 0.7,
});
export function ida() {
  const hat = new THREE.Group();
  hat.name = "Ida — atelier beret";
  hat.add(
    band(
      "Supple oxblood headband",
      [
        [-0.023, 0.31, 0.243],
        [-0.019, 0.322, 0.252],
        [-0.007, 0.33, 0.256],
        [0.049, 0.336, 0.259],
        [0.069, 0.333, 0.256],
        [0.085, 0.319, 0.245],
      ],
      oxblood,
    ),
  );
  // A Basque beret has one seamless knitted plate. The low temple is pulled
  // out and down while the opposite side is pushed back onto the headband.
  const profile = [
    // height, radius x/z, lateral shift, drape weight
    [0.043, 0.311, 0.24, -0.01, 0.12],
    [0.052, 0.338, 0.262, -0.017, 0.34],
    [0.065, 0.364, 0.278, -0.035, 0.57],
    [0.084, 0.397, 0.293, -0.059, 0.81],
    [0.114, 0.42, 0.311, -0.077, 0.94],
    [0.15, 0.438, 0.324, -0.081, 1],
    [0.188, 0.436, 0.333, -0.08, 0.96],
    [0.22, 0.414, 0.325, -0.082, 0.87],
    [0.247, 0.378, 0.298, -0.083, 0.76],
    [0.267, 0.325, 0.259, -0.083, 0.57],
    [0.279, 0.254, 0.2, -0.078, 0.36],
    [0.278, 0.181, 0.144, -0.072, 0.19],
    [0.264, 0.107, 0.088, -0.068, 0.07],
    [0.246, 0.045, 0.039, -0.066, 0.02],
    [0.244, 0.016, 0.014, -0.065, 0],
  ];
  const crown = profile.map(([y, rx, rz, dx, weight]) =>
    ellipse(48, (t) => {
      const s = Math.sin(t),
        c = Math.cos(t);
      // Two broad pressure folds at the low temple. The rest stays taut.
      const wave = Math.exp(5.3 * (Math.cos(t + 1.1) - 1)) - 0.68 * Math.exp(7 * (Math.cos(t + 0.65) - 1));
      const x = dx + rx * s + 0.012 * s * wave * weight;
      const z = rz * c - 0.014 * weight + 0.012 * c * wave * weight;
      // A hand-pushed swale crosses the front quarter of the plateau and
      // releases toward the soft lip; its ends taper away into the wool.
      const deck = THREE.MathUtils.smoothstep(y, 0.16, 0.246);
      const foldZ = (z - 0.092 - 0.27 * x) / 0.059,
        foldX = (x + 0.063) / 0.22;
      const swale = 0.043 * deck * Math.exp(-0.5 * (foldZ * foldZ + foldX * foldX));
      return [
        x,
        y +
          0.179 * rx * s +
          0.03 * rz * c -
          0.05 * wave * weight -
          0.034 * Math.max(-s, 0) ** 2 * weight -
          swale,
        z,
      ];
    }),
  );
  hat.add(shell("Hand-blocked scarlet plateau", crown, wool));
  const stem = [
    [-0.065, 0.238, -0.001, 0.021],
    [-0.065, 0.255, -0.001, 0.021],
    [-0.061, 0.277, -0.003, 0.019],
    [-0.052, 0.296, -0.005, 0.017],
    [-0.045, 0.31, -0.005, 0.015],
    [-0.045, 0.314, -0.005, 0.01],
  ].map(([x, y, z, r]) => ellipse(12, (t) => [x + r * Math.sin(t), y, z + 0.84 * r * Math.cos(t)]));
  hat.add(shell("Short knitted cabillou", stem, wool));
  return hat;
}
