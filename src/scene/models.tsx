import * as THREE from "three";
export { terrainHeight } from "./terrainElevation";

// Original geometric assets. Shared GPU resources live for the application lifetime.
export const geometry = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cone: new THREE.ConeGeometry(1, 1, 5),
  pyramid: new THREE.ConeGeometry(1, 1, 4),
  triangle: new THREE.ConeGeometry(1, 1, 3),
  octa: new THREE.IcosahedronGeometry(1, 0),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 8),
  disc: new THREE.CylinderGeometry(1, 1, 1, 24),
  sphere: new THREE.SphereGeometry(1, 8, 6),
  ring: new THREE.RingGeometry(0.35, 0.39, 32),
  bow: new THREE.TorusGeometry(0.5, 0.06, 4, 12, Math.PI),
};
const materials = new Map<string, THREE.MeshStandardMaterial>();
export function material(color: string, opacity = 1, emissive = false) {
  const key = `${color}:${opacity}:${emissive}`;
  if (!materials.has(key))
    materials.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.86,
        metalness: 0.03,
        flatShading: true,
        transparent: opacity < 1,
        opacity,
        depthWrite: opacity === 1,
        emissive: emissive ? color : "#000000",
        emissiveIntensity: emissive ? 0.25 : 0,
      }),
    );
  return materials.get(key)!;
}
type PieceProps = {
  position?: [number, number, number];
  scale?: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
  shape?: keyof typeof geometry;
  opacity?: number;
  shadow?: boolean;
};
export function Piece({
  position,
  scale,
  rotation,
  color = "#eee9d9",
  shape = "box",
  opacity = 1,
  shadow = false,
}: PieceProps) {
  return (
    <mesh
      geometry={geometry[shape]}
      material={material(color, opacity)}
      position={position}
      scale={scale}
      rotation={rotation}
      castShadow={shadow}
      receiveShadow
      dispose={null}
    />
  );
}
export { TerrainDetails, Resources, CityModel, BuildingModel, RuinModel, LighthouseModel, WorldModelLibrary } from "./worldModels";
export { UnitModel } from "./unitModels";
