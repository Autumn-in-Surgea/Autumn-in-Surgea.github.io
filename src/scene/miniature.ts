import * as THREE from "three";

type Point = [number, number, number];

// Each prototype occupies a unit box, including its cap. Sculptors can specify
// a physical width rather than switching between a radius and a diameter.
function unitBounds(geometry: THREE.BufferGeometry) {
  geometry.computeBoundingBox();
  const size = geometry.boundingBox!.getSize(new THREE.Vector3());
  return geometry.scale(1 / size.x, 1 / size.y, 1 / size.z);
}

function bevelBox() {
  const footprint = new THREE.Shape();
  const cut = 0.1;
  const corners: [number, number][] = [
    [-0.5 + cut, -0.5], [0.5 - cut, -0.5], [0.5, -0.5 + cut], [0.5, 0.5 - cut],
    [0.5 - cut, 0.5], [-0.5 + cut, 0.5], [-0.5, 0.5 - cut], [-0.5, -0.5 + cut],
  ];
  footprint.moveTo(...corners[0]);
  for (const corner of corners.slice(1)) footprint.lineTo(...corner);
  footprint.closePath();
  const geometry = new THREE.ExtrudeGeometry(footprint, {
    depth: 0.9, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.035, bevelSegments: 1,
  }).rotateX(-Math.PI / 2).center();
  return unitBounds(geometry);
}

const prototypes = {
  box: new THREE.BoxGeometry(1, 1, 1),
  bevel: bevelBox(),
  disc: new THREE.CylinderGeometry(0.5, 0.5, 1, 20),
  octagon: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  drum: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  spire: new THREE.ConeGeometry(0.5, 1, 8),
  spire4: unitBounds(new THREE.ConeGeometry(0.5, 1, 4).rotateY(Math.PI / 4)),
  hip: unitBounds(new THREE.CylinderGeometry(0.19, 0.5, 1, 4).rotateY(Math.PI / 4)),
  gem: new THREE.OctahedronGeometry(0.5),
  crown: unitBounds(new THREE.DodecahedronGeometry(0.5)),
};

export const miniatureMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.72,
  metalness: 0.1,
  flatShading: true,
});

// Bake a coloured assembly into a single indexed mesh. No model part needs its
// own material, draw call, raycast, or React component after the sculpt is built.
export class Miniature {
  private positions: number[] = [];
  private normals: number[] = [];
  private colors: number[] = [];
  private indices: number[] = [];
  private matrix = new THREE.Matrix4();
  private normalMatrix = new THREE.Matrix3();
  private point = new THREE.Vector3();
  private origin = new THREE.Vector3();
  private edge = new THREE.Vector3();
  private rotation = new THREE.Quaternion();
  private euler = new THREE.Euler();
  private color = new THREE.Color();

  part(shape: keyof typeof prototypes, color: string, x: number, y: number, z: number,
    width: number, height: number, depth: number, rx = 0, ry = 0, rz = 0) {
    this.matrix.makeRotationFromEuler(this.euler.set(rx, ry, rz));
    this.matrix.scale(this.point.set(width, height, depth));
    this.matrix.setPosition(x, y, z);
    this.append(prototypes[shape], color);
  }

  box(color: string, x: number, y: number, z: number,
    width: number, height: number, depth: number, rx = 0, ry = 0, rz = 0) {
    this.part("box", color, x, y, z, width, height, depth, rx, ry, rz);
  }

  beam(color: string, from: Point, to: Point, width: number, depth = width) {
    const difference = this.point.set(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
    const length = difference.length();
    if (length < 0.00001) return;
    this.rotation.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, difference.normalize());
    this.matrix.makeRotationFromQuaternion(this.rotation);
    this.matrix.scale(this.point.set(width, length, depth));
    this.matrix.setPosition((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2);
    this.append(prototypes.box, color);
  }

  /** A flat-shaded convex face in model space, with an outward-facing winding. */
  face(color: string, points: Point[]) {
    if (points.length < 3) return;
    this.point.fromArray(points[1]).sub(this.origin.fromArray(points[0]));
    this.point.cross(this.edge.fromArray(points[2]).sub(this.origin)).normalize();
    const start = this.positions.length / 3;
    this.color.set(color);
    for (const p of points) {
      this.positions.push(...p);
      this.normals.push(this.point.x, this.point.y, this.point.z);
      this.colors.push(this.color.r, this.color.g, this.color.b);
    }
    for (let i = 1; i < points.length-1; i++) this.indices.push(start, start+i, start+i+1);
  }

  private append(geometry: THREE.BufferGeometry, color: string) {
    const positions = geometry.getAttribute("position");
    const normals = geometry.getAttribute("normal");
    const base = this.positions.length / 3;
    this.normalMatrix.getNormalMatrix(this.matrix);
    this.color.set(color);
    for (let i = 0; i < positions.count; i++) {
      this.point.fromBufferAttribute(positions, i).applyMatrix4(this.matrix);
      this.positions.push(this.point.x, this.point.y, this.point.z);
      this.point.fromBufferAttribute(normals, i).applyNormalMatrix(this.normalMatrix);
      this.normals.push(this.point.x, this.point.y, this.point.z);
      this.colors.push(this.color.r, this.color.g, this.color.b);
    }
    const index = geometry.index;
    const count = index ? index.count : positions.count;
    for (let i = 0; i < count; i++) this.indices.push(base + (index ? index.getX(i) : i));
  }

  finish() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setIndex(this.indices);
    geometry.computeBoundingSphere();
    return geometry;
  }
}
