import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type Highlight = "selection" | "target";
type Outline = Highlight | "hover" | "reachable";

const highlights = {
  selection: { rim: "#917031", light: "#fff4b1", glow: "#eaa540" },
  target: { rim: "#963c30", light: "#ffcbad", glow: "#ed6046" },
};

function squareBorder(radius: number, thickness: number) {
  const square = (r: number) => [
    new THREE.Vector2(-r, -r),
    new THREE.Vector2(r, -r),
    new THREE.Vector2(r, r),
    new THREE.Vector2(-r, r),
  ];
  const shape = new THREE.Shape(square(radius + thickness / 2));
  shape.holes.push(new THREE.Path(square(radius - thickness / 2).reverse()));
  return new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
}

const plainOutline = squareBorder(0.474, 0.027);
const plainMaterials = {
  reachable: new THREE.MeshBasicMaterial({ color: "#487d69", transparent: true, opacity: 0.86, depthWrite: false }),
  hover: new THREE.MeshBasicMaterial({ color: "#f6f0d9", transparent: true, opacity: 0.72, depthWrite: false }),
};
const squareGlow = new THREE.PlaneGeometry(1.13, 1.13).rotateX(-Math.PI / 2);
const ringGlow = new THREE.PlaneGeometry(0.98, 0.98).rotateX(-Math.PI / 2);
const ignoreRaycast = () => {};

function luminousMaterial(kind: Highlight, round: boolean) {
  const palette = highlights[kind];
  return new THREE.ShaderMaterial({
    uniforms: {
      rim: { value: new THREE.Color(palette.rim) },
      light: { value: new THREE.Color(palette.light) },
      glow: { value: new THREE.Color(palette.glow) },
      radius: { value: round ? 0.37 : 0.469 },
      rounded: { value: round ? 1 : 0 },
    },
    transparent: true,
    depthWrite: false,
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
      uniform float radius;
      uniform float rounded;
      varying vec2 tilePoint;
      void main() {
        float box = max(abs(tilePoint.x), abs(tilePoint.y));
        float distanceFromLine = abs(mix(box, length(tilePoint), rounded) - radius);
        float aa = clamp(fwidth(distanceFromLine) * 0.65, 0.001, 0.019);
        float core = 1.0 - smoothstep(0.008, 0.008 + aa, distanceFromLine);
        float edge = 1.0 - smoothstep(0.020, 0.020 + aa, distanceFromLine);
        float halo = 1.0 - smoothstep(0.010, 0.094, distanceFromLine);
        float opacity = max(edge * 0.85 + core * 0.13, halo * halo * 0.42);
        if (opacity < 0.004) discard;
        vec3 color = mix(mix(glow, rim, edge), light, core);
        gl_FragColor = vec4(color, opacity);
        #include <colorspace_fragment>
      }
    `,
  });
}

// All highlights share their buffers. The dim reach outline stays a simple ring,
// even when a long-range move lights up a large part of the board.
const squareMaterials = {
  selection: luminousMaterial("selection", false),
  target: luminousMaterial("target", false),
};
const ringMaterials = {
  selection: luminousMaterial("selection", true),
  target: luminousMaterial("target", true),
};

export function SquareOutline({ kind, height }: { kind: Outline; height: number }) {
  const glow = kind === "selection" || kind === "target";
  return (
    <mesh
      position={[0, height, 0]}
      geometry={glow ? squareGlow : plainOutline}
      material={glow ? squareMaterials[kind] : plainMaterials[kind]}
      renderOrder={glow ? 2 : 1}
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
    if (!ring.current || kind !== "selection" || age.current >= 0.32) return;
    age.current = reducedMotion ? 0.32 : Math.min(0.32, age.current + delta);
    const pulse = reducedMotion ? 0 : Math.sin((age.current / 0.32) * Math.PI);
    ring.current.scale.setScalar(1 + pulse * 0.09);
  });
  return (
    <mesh
      ref={ring}
      geometry={ringGlow}
      material={ringMaterials[kind]}
      position={[0, 0.035, 0]}
      renderOrder={3}
      raycast={ignoreRaycast}
      dispose={null}
    />
  );
}
