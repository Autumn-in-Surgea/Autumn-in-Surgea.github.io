// With Vite running, open /agent/scripts/fish-atlas.html. Assets and the
// baking renderer are development tools; none are imported by the game.
import * as THREE from "three";
import { resourceModel } from "../../src/scene/landscape";
import { miniatureMaterial } from "../../src/scene/miniature";

const pixels = 128, columns = 4, rows = 2, frames = columns * rows;
const atlas = document.querySelector<HTMLCanvasElement>("#atlas")!;
atlas.width = pixels * columns;
atlas.height = pixels * rows;
const image = atlas.getContext("2d")!;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(pixels, pixels, false);
renderer.setClearColor(0, 0);
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-0.44, 0.44, 0.44, -0.44, 0.1, 40);
const subject = new THREE.Vector3(0, 0.07, 0);
camera.position.set(13, 17, 13).add(subject);
camera.lookAt(subject);
camera.updateMatrixWorld();
const key = new THREE.DirectionalLight("#fff4dd", 1.8);
key.position.set(-7, 15, 8);
const fill = new THREE.DirectionalLight("#d4e2df", 0.3);
fill.position.set(8, 6, -10);
scene.add(key, fill, new THREE.AmbientLight("#f5f0e3", 0.65),
  new THREE.HemisphereLight("#dbe6df", "#677c72", 0.9));
const fish = new THREE.Mesh(resourceModel("fish"), miniatureMaterial);
scene.add(fish);
for (let frame = 0; frame < frames; frame++) {
  const phase = (frame / frames) * Math.PI * 2;
  fish.rotation.y = Math.sin(phase) * 0.19;
  fish.rotation.z = Math.sin(phase) * 0.045;
  fish.position.y = (1 - Math.cos(phase)) * 0.013;
  renderer.render(scene, camera);
  image.drawImage(renderer.domElement, (frame % columns) * pixels, Math.floor(frame / columns) * pixels);
}
const meshTriangles = renderer.info.render.triangles;

// Render the same first frame from the atlas, using a camera-facing quad
// with depth testing. Anchor, view direction and orthographic scale match the bake.
scene.remove(fish);
const texture = new THREE.CanvasTexture(atlas);
texture.colorSpace = THREE.SRGBColorSpace;
texture.repeat.set(1 / columns, 1 / rows);
texture.offset.set(0, 1 - 1 / rows);
const card = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.88),
  new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
card.quaternion.copy(camera.quaternion);
card.position.copy(subject);
scene.add(card);
renderer.render(scene, camera);
const cardTriangles = renderer.info.render.triangles;
const preview = document.querySelector<HTMLCanvasElement>("#preview")!;
preview.width = preview.height = pixels;
const player = preview.getContext("2d")!;
player.drawImage(renderer.domElement, 0, 0);
const link = document.querySelector<HTMLAnchorElement>("#download")!;
atlas.toBlob(blob => { if (blob) link.href = URL.createObjectURL(blob); }, "image/png");
document.querySelector("output")!.textContent =
  `每组鱼群每次绘制：多面网格 ${meshTriangles} 个三角形，图集贴片 ${cardTriangles} 个。图集 ${atlas.width} × ${atlas.height}，共 ${frames} 帧。`;
const start = performance.now();
let handle = 0;
let previousFrame = 0;
function play(now: number) {
  const frame = Math.floor((now - start) / 130) % frames;
  if (frame !== previousFrame) {
    texture.offset.set(frame % columns / columns, 1 - (Math.floor(frame / columns) + 1) / rows);
    renderer.render(scene, camera);
    player.clearRect(0, 0, pixels, pixels);
    player.drawImage(renderer.domElement, 0, 0);
    previousFrame = frame;
  }
  handle = requestAnimationFrame(play);
}
handle = requestAnimationFrame(play);
window.addEventListener("pagehide", () => cancelAnimationFrame(handle));
window.addEventListener("pageshow", event => { if (event.persisted) handle = requestAnimationFrame(play); });
