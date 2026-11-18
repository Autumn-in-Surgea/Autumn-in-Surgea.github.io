import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { easeInOut } from "./motion";

type Highlight = "selection" | "target";
type Outline = Highlight | "hover" | "reachable";

const opacity = 0.7;
const highlights = {
  selection: { rim: "#af7b29", light: "#fff0a9", glow: "#eab351" },
  target: { rim: "#a53932", light: "#ff8f79", glow: "#ed6046" },
  reachable: { rim: "#245f4d", light: "#64e8be", glow: "#63bd8d" },
  hover: { rim: "#9a9178", light: "#f6f0d9", glow: "#f6f0d9" },
};
const highlightPlane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const ignoreRaycast = () => {};

// The dot and the rim share the same material, so 70% is their combined
// coverage even where their soft edges meet.
function luminousMaterial(kind: Outline, round = false) {
  const palette = highlights[kind];
  const dot = !round && (kind === "reachable" || kind === "target");
  return new THREE.ShaderMaterial({
    uniforms: {
      rim: { value: new THREE.Color(palette.rim) },
      light: { value: new THREE.Color(palette.light) },
      glow: { value: new THREE.Color(palette.glow) },
      opacity: { value: opacity },
      radius: { value: round ? 0.364 : 0.404 },
      thickness: { value: kind === "hover" ? 0.021 : 0.039 },
      rounded: { value: round ? 1 : 0 },
      dotRadius: { value: dot ? 0.093 : 0 },
      dotPosition: { value: new THREE.Vector2(kind === "target" ? 0.255 : 0, kind === "target" ? 0.255 : 0) },
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    vertexShader: `
      varying vec2 tilePoint;
      void main() {
        tilePoint = position.xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 rim;
      uniform vec3 light;
      uniform vec3 glow;
      uniform float opacity;
      uniform float radius;
      uniform float thickness;
      uniform float rounded;
      uniform float dotRadius;
      uniform vec2 dotPosition;
      varying vec2 tilePoint;
      void main() {
        float box = max(abs(tilePoint.x), abs(tilePoint.y));
        float distanceFromLine = abs(mix(box, length(tilePoint), rounded) - radius);
        float aa = clamp(fwidth(distanceFromLine) * 0.66, 0.003, 0.035);
        float core = 1.0 - smoothstep(thickness * 0.46, thickness * 0.46 + aa, distanceFromLine);
        float edge = 1.0 - smoothstep(thickness, thickness + aa, distanceFromLine);
        float halo = 1.0 - smoothstep(thickness, thickness + 0.046, distanceFromLine);
        float coverage = max(edge, halo * halo * 0.36);
        vec3 color = mix(mix(glow, rim, edge), light, core);

        if (dotRadius > 0.0) {
          float distanceToDot = length(tilePoint - dotPosition);
          float dotEdge = 1.0 - smoothstep(dotRadius - aa * 0.6, dotRadius + aa * 0.6, distanceToDot);
          float dotCore = 1.0 - smoothstep(dotRadius * 0.66, dotRadius * 0.66 + aa, distanceToDot);
          color = mix(color, mix(rim, light, dotCore), dotEdge);
          coverage = max(coverage, dotEdge);
        }

        if (coverage < 0.004) discard;
        gl_FragColor = vec4(color, coverage * opacity);
        #include <colorspace_fragment>
      }
    `,
  });
}

const squareMaterials = {
  selection: luminousMaterial("selection"),
  target: luminousMaterial("target"),
  reachable: luminousMaterial("reachable"),
  hover: luminousMaterial("hover"),
};
const ringMaterials = {
  selection: luminousMaterial("selection", true),
  target: luminousMaterial("target", true),
};

export function SquareOutline({ kind, height }: { kind: Outline; height: number }) {
  return (
    <mesh
      name={`tile-highlight-${kind}`}
      position={[0, height, 0]}
      geometry={highlightPlane}
      material={squareMaterials[kind]}
      renderOrder={2}
      raycast={ignoreRaycast}
      dispose={null}
    />
  );
}

export function SelectionHalo({
  kind,
  reducedMotion,
}: {
  kind: Highlight;
  reducedMotion: boolean;
}) {
  const ring = useRef<THREE.Mesh>(null);
  const age = useRef(0);

  useFrame((_, delta) => {
    if (!ring.current || kind !== "selection" || age.current >= 0.34) return;
    age.current = reducedMotion ? 0.34 : Math.min(0.34, age.current + Math.min(delta, 0.05));
    const pulse = easeInOut(age.current / 0.12) * (1 - easeInOut((age.current - 0.12) / 0.22));
    ring.current.scale.setScalar(1 + pulse * 0.075);
  });
  return (
    <mesh
      ref={ring}
      name={`unit-highlight-${kind}`}
      geometry={highlightPlane}
      material={ringMaterials[kind]}
      position={[0, 0.035, 0]}
      renderOrder={3}
      raycast={ignoreRaycast}
      dispose={null}
    />
  );
}
