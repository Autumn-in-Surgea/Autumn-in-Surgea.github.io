import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../dist/", import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, "manifest.webmanifest"), "utf8"));
const worker = await readFile(path.join(root, "sw.js"), "utf8");
const html = await readFile(path.join(root, "index.html"), "utf8");
assert.equal(manifest.display, "standalone");
assert.equal(manifest.start_url, "./");
assert.equal(manifest.scope, "./");
assert.equal(manifest.id, "./");
assert.match(html, /rel="manifest"/);
assert.equal(manifest.name, "西陆秋色 · Autumn in Surgea");
assert.equal(manifest.short_name, "西陆秋色");
assert.ok(html.includes(`<title>${manifest.name}</title>`));
const entries = new Map();
for (const match of worker.matchAll(/\{url:"([^"]+)",revision:(null|"[^"]+")\}/g)) {
  assert.ok(!/^(https?:|\/)/.test(match[1]), `Precache must work in a subdirectory: ${match[1]}`);
  if (entries.has(match[1])) assert.equal(entries.get(match[1]), match[2], `Conflicting cache revision: ${match[1]}`);
  entries.set(match[1], match[2]);
}
assert.ok(entries.has("index.html"), "HTML must be available on an offline cold start");
assert.ok([...entries.keys()].some((file) => /^assets\/ai\.worker-.+\.js$/.test(file)), "AI worker is missing from offline cache");
for (const font of ["genryu-dan", "resource-han-rounded-40"]) {
  assert.ok(
    [...entries.keys()].some((file) => file.startsWith(`assets/${font}-`) && file.endsWith(".woff2")),
    `Missing offline font: ${font}`,
  );
}
for (const license of ["genryu-OFL.txt", "resource-han-rounded-OFL.txt"]) {
  assert.ok(entries.has(`licenses/${license}`), `Missing bundled font license: ${license}`);
}
for (const entry of await readdir(root, { recursive: true })) {
  const file = entry.split(path.sep).join("/");
  if (!/\.(js|css|html|png|svg|ico|json|webmanifest|woff2?|wasm|mp3|wav|ogg)$/.test(file)) continue;
  // A service worker and its importScripts dependencies use the browser's SW script cache.
  if (file === "sw.js" || /^workbox-[^/]+\.js$/.test(file)) continue;
  assert.ok(entries.has(file), `Build asset missing from precache: ${file}`);
}
async function verifyIcon(src, sizes) {
  const url = src.replace(/^\.\//, "");
  assert.ok(entries.has(url), `Icon missing from offline cache: ${url}`);
  const bytes = await readFile(path.join(root, url));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `Invalid PNG: ${url}`);
  assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`, sizes, `Wrong icon size: ${url}`);
}
for (const [purpose, sizes] of [["any", "192x192"], ["any", "512x512"], ["maskable", "512x512"]]) {
  assert.ok(
    manifest.icons.some(icon => icon.purpose === purpose && icon.sizes === sizes),
    `Missing ${sizes} ${purpose} icon in manifest`,
  );
}
for (const icon of manifest.icons) await verifyIcon(icon.src, icon.sizes);
for (const [relation, sizes] of [["icon", "32x32"], ["apple-touch-icon", "180x180"]]) {
  const tag = html.match(new RegExp(`<link\\b[^>]*\\brel="${relation}"[^>]*>`))?.[0];
  const src = tag?.match(/\bhref="([^"]+)"/)?.[1];
  assert.ok(src, `Missing link for ${relation}`);
  assert.ok(tag.includes(`sizes="${sizes}"`), `Missing size for ${relation}`);
  await verifyIcon(src, sizes);
}
console.log(`PWA build verified: ${entries.size} local assets, AI worker, standalone manifest, installation icons, relative URLs.`);
