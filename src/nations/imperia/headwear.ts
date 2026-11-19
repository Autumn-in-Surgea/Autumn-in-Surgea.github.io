import * as THREE from "three";
import { solid, circular, assemble } from "../_shared/pawns/millinery";

const finish = (name: string, color: string, roughness: number, metalness = 0) =>
  new THREE.MeshStandardMaterial({
    name,
    color,
    roughness,
    metalness,
  });
const uniformFelt = finish("Copper broadcloth", "#9d604a", 0.93);
const warmLeather = finish("Oxblood leather", "#433432", 0.62);
const peakLeather = finish("Polished oxblood leather", "#433432", 0.36);
const gilt = finish("Brushed old brass", "#cba364", 0.38, 0.28);

export function imperia() {
  // A taller front bolster lifts the felt clear of the cap band. At the back
  // the unsupported cloth settles closer to the head, with one shallow pinch.
  const stations = [
    // half-width, half-depth, level, fore/aft tilt, shift towards peak
    [0.314, 0.25, 0.087, 0.004, 0],
    [0.331, 0.258, 0.101, 0.005, 0],
    [0.347, 0.272, 0.117, 0.011, 0.002],
    [0.367, 0.283, 0.144, 0.027, 0.002],
    [0.403, 0.314, 0.18, 0.052, 0.005],
    [0.424, 0.334, 0.2, 0.062, 0.007],
    [0.432, 0.341, 0.214, 0.065, 0.008],
    [0.435, 0.342, 0.221, 0.066, 0.008],
    [0.434, 0.342, 0.226, 0.066, 0.008],
    [0.429, 0.338, 0.231, 0.065, 0.008],
    [0.415, 0.326, 0.241, 0.064, 0.007],
    [0.366, 0.287, 0.258, 0.059, 0.003],
    [0.283, 0.219, 0.27, 0.048, -0.002],
    [0.165, 0.128, 0.271, 0.027, -0.007],
    [0.073, 0.058, 0.269, 0.012, -0.009],
    [0.012, 0.01, 0.268, 0.002, -0.011],
  ];
  const crownRings = stations.map(([w, d, y, tilt, z0], i) =>
    circular(56, (x, z, a) => {
      const lateralRoll = Math.max(0, Math.sin(a - 1.95));
      const settle = i > 2 && i < 13 ? 0.011 * Math.cos((i - 7) * 0.28) * lateralRoll ** 4 : 0;
      const seamEase =
        i >= 9 ? 0.022 * Math.exp(-(((w * x - 0.174) / 0.095) ** 2 + ((d * z + 0.168) / 0.12) ** 2)) : 0;
      return [
        x * (w - settle * 0.38),
        y + tilt * z - settle - seamEase - 0.011 * x * (w / 0.435),
        z * d + z0,
      ];
    }),
  );
  const cloth = solid("Raised broadcloth crown", uniformFelt, crownRings);
  const seamCurve = new THREE.CatmullRomCurve3(
    crownRings[8].map(([x, y, z]) => new THREE.Vector3(x * 1.005, y + 0.002, z * 1.005)),
    true,
  );
  const welt = new THREE.Mesh(new THREE.TubeGeometry(seamCurve, 84, 0.0052, 7, true), uniformFelt);
  welt.name = "Rolled cloth piping";
  welt.castShadow = welt.receiveShadow = true;
  const band = solid(
    "Inset leather band",
    warmLeather,
    [
      [0.307, 0.235, -0.029],
      [0.32, 0.247, -0.027],
      [0.329, 0.254, -0.019],
      [0.331, 0.257, -0.009],
      [0.33, 0.257, 0.002],
      [0.326, 0.255, 0.014],
      [0.329, 0.258, 0.084],
      [0.334, 0.261, 0.099],
      [0.335, 0.261, 0.109],
      [0.33, 0.257, 0.116],
    ].map(([w, d, y]) => circular(48, (x, z) => [x * w, y + 0.007 * z, z * d])),
  );
  // A pressed crescent peak, cupped from side to side with a rounded cut edge.
  const fair = Array.from({ length: 39 }, (_, i) => {
    const a = -1.71 + 3.42 * (1 - i / 38),
      x = Math.sin(a),
      z = Math.cos(a);
    const width = Math.max(0.015, Math.cos((a / 1.71) * Math.PI * 0.5)) ** 0.78;
    const outer = 0.171 * width;
    return [
      [0, -0.013],
      [0.36, -0.012],
      [0.93, -0.01],
      [1, -0.005],
      [1, 0.001],
      [0.975, 0.006],
      [0.88, 0.009],
      [0.52, 0.01],
      [0.14, 0.006],
      [0, 0.003],
    ].map(([t, thickness]) => {
      const r = t * outer;
      return [
        x * (0.326 + r * 0.66),
        0.021 + 0.014 * (1 - z) - 0.058 * width * t ** 1.17 + thickness,
        z * (0.25 + r) + 0.04 * t * width,
      ];
    });
  });
  const peak = solid("Cupped lacquered peak", peakLeather, fair);
  // One oval brass cockade. Both a rolled flange and central dome are spun into the same piece.
  const cockade = solid(
    "Domed brass cockade",
    gilt,
    [
      [0.72, -0.01],
      [0.94, -0.005],
      [1, 0.003],
      [0.95, 0.012],
      [0.83, 0.016],
      [0.73, 0.013],
      [0.64, 0.013],
      [0.53, 0.024],
      [0.35, 0.031],
      [0.07, 0.034],
    ].map(([radius, z]) =>
      circular(28, (x, y) => [
        x * 0.049 * radius,
        0.077 + y * 0.04 * radius,
        0.259 + z - 0.1 * y * 0.04 * radius,
      ]).reverse(),
    ),
  );
  return assemble("Imperial railway service cap", cloth, welt, band, peak, cockade);
}
