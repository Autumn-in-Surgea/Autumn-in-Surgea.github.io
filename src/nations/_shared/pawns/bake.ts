import * as THREE from "three";

export interface BoardUnitGeometry {
  body: THREE.BufferGeometry;
  enamel: THREE.BufferGeometry;
}

// The board draws the sculpt and owner-painted parts separately. Bake local
// transforms, material groups and vertex paint once, before the first draw.
class Layer {
  private positions: number[] = [];
  private normals: number[] = [];
  private colors: number[] = [];
  private indices: number[] = [];

  append(mesh: THREE.Mesh, enamel: boolean) {
    const geometry = mesh.geometry;
    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    const paint = geometry.getAttribute("color");
    const index = geometry.getIndex();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const groups = Array.isArray(mesh.material) ? geometry.groups : [
      { start: 0, count: index?.count ?? position.count, materialIndex: 0 },
    ];
    const matrix = mesh.matrixWorld;
    const mirrored = matrix.determinant() < 0;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
    const point = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const color = new THREE.Color();

    for (const group of groups) {
      const material = materials[group.materialIndex ?? 0] as THREE.MeshStandardMaterial;
      const sides = material.side === THREE.DoubleSide ? [1, -1] : [material.side === THREE.BackSide ? -1 : 1];
      for (const side of sides) {
        const reverse = mirrored !== (side < 0);
        const vertices = new Map<number, number>();
        const end = group.start + group.count;
        for (let tri = group.start; tri < end; tri += 3) {
          for (let corner = 0; corner < 3; corner++) {
            const offset = tri + (reverse && corner > 0 ? 3 - corner : corner);
            const source = index ? index.getX(offset) : offset;
            let target = vertices.get(source);
            if (target === undefined) {
              target = this.positions.length / 3;
              vertices.set(source, target);
              point.fromBufferAttribute(position, source).applyMatrix4(matrix);
              direction.fromBufferAttribute(normal, source).applyNormalMatrix(normalMatrix).multiplyScalar(side);
              this.positions.push(point.x, point.y, point.z);
              this.normals.push(direction.x, direction.y, direction.z);
              color.setRGB(1, 1, 1);
              if (!enamel) {
                if (paint) color.setRGB(paint.getX(source), paint.getY(source), paint.getZ(source));
                if (material.color) color.multiply(material.color);
              }
              this.colors.push(color.r, color.g, color.b);
            }
            this.indices.push(target);
          }
        }
      }
    }
  }

  finish() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setIndex(this.indices);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }
}

export function bakeUnit(root: THREE.Group): BoardUnitGeometry {
  root.updateMatrixWorld(true);
  const body = new Layer(), enamel = new Layer();
  function visit(part: THREE.Object3D, ownerPaint: boolean) {
    if (!part.visible) return;
    const tinted = ownerPaint || part.userData.factionEnamel === true;
    if (part instanceof THREE.Mesh) (tinted ? enamel : body).append(part, tinted);
    for (const child of part.children) visit(child, tinted);
  }
  visit(root, false);
  return { body:body.finish(), enamel:enamel.finish() };
}
