// Run: npm run validate   — checks layout + exhibits + that the building is actually walkable.
import fs from 'node:fs';
import { wallLength, wallFrame, doorsFor, allColliders, resolve } from '../src/geometry.js';
const L = JSON.parse(fs.readFileSync('data/layout.json', 'utf8'));
const E = JSON.parse(fs.readFileSync('data/exhibits.json', 'utf8')).exhibits;
let errors = 0, warns = 0;
const err = m => { errors++; console.log('  ✗ ' + m); };
const warn = m => { warns++; console.log('  ! ' + m); };
const room = id => L.rooms.find(r => r.id === id);

console.log('Layout');
L.rooms.forEach((r, i) => {
  const n = L.rooms[i + 1];
  if (n) {
    if (r.size[0] !== n.size[0] || r.center[0] !== n.center[0]) err(`${r.id}/${n.id}: width/x must match (shared wall)`);
    if (Math.abs(r.center[1] - r.size[1] / 2 - (n.center[1] + n.size[1] / 2)) > 1e-6) err(`${r.id}/${n.id}: rooms must touch along z`);
  }
});

console.log('Exhibits');
const ids = new Set(), boxes = {};
for (const e of E) {
  if (ids.has(e.id)) err('duplicate id ' + e.id); ids.add(e.id);
  const r = room(e.room); if (!r) { err(`${e.id}: unknown room ${e.room}`); continue; }
  if (!['image', 'video', 'audio', 'model'].includes(e.type)) err(`${e.id}: bad type ${e.type}`);
  if (e.type === 'model' && !/\.(glb|gltf)$/i.test(e.src)) err(`${e.id}: type "model" needs .glb/.gltf (got ${e.src})`);
  if (e.type === 'image' && /\.(glb|gltf)$/i.test(e.src)) err(`${e.id}: image exhibit points to a model`);
  if (e.wall) {
    const len = wallLength(r, e.wall), w = (e.maxSize || e.size)[0];
    if (Math.abs(e.at) + w / 2 > len / 2 - 0.3) err(`${e.id}: sticks out past wall end`);
    for (const d of doorsFor(L, r, e.wall))
      if (Math.abs(e.at - d.at) < w / 2 + d.width / 2 + 0.2) err(`${e.id}: overlaps a doorway`);
    const key = r.id + e.wall; (boxes[key] ||= []).push(e);
  } else if (!e.pos) err(`${e.id}: needs wall+at or pos`);
  const p = e.src && ('public' + e.src);
  if (p && !fs.existsSync(p)) warn(`${e.id}: asset missing (${e.src}) → placeholder will be shown`);
}
for (const list of Object.values(boxes))
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j], wa = (a.maxSize || a.size)[0], wb = (b.maxSize || b.size)[0];
    if (Math.abs(a.at - b.at) < (wa + wb) / 2 + 0.6) err(`${a.id} and ${b.id} are too close on the same wall`);
  }

console.log('Walkability');
const boxesC = allColliders(L), R = 0.35, step = 0.25;
const blocked = (x, z) => { const p = { x, z }; resolve(p, R, boxesC); return Math.hypot(p.x - x, p.z - z) > 1e-3; };
const minX = -12, maxX = 12, minZ = -52, maxZ = 10;
const key = (i, j) => i + ',' + j, seen = new Set();
const s = L.spawn.pos, start = [Math.round((s[0] - minX) / step), Math.round((s[1] - minZ) / step)];
const q = [start]; seen.add(key(...start));
while (q.length) {
  const [i, j] = q.pop();
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const ni = i + di, nj = j + dj, x = minX + ni * step, z = minZ + nj * step, k = key(ni, nj);
    if (x < minX || x > maxX || z < minZ || z > maxZ || seen.has(k) || blocked(x, z)) continue;
    seen.add(k); q.push([ni, nj]);
  }
}
for (const r of L.rooms) {
  const x = r.center[0] + 2, z = r.center[1] + 1.5;
  const ok = seen.has(key(Math.round((x - minX) / step), Math.round((z - minZ) / step)));
  ok ? console.log(`  ✓ reachable: ${r.name}`) : err(`cannot walk from spawn to ${r.name}`);
}
let leak = false;
for (const [i, j] of seen) { }
for (const k of seen) { const [i, j] = k.split(',').map(Number); const x = minX + i * step, z = minZ + j * step;
  if (Math.abs(x) > 9.1 || z > 6.1 || z < -48.1) leak = true; }
leak ? err('player can leave the building!') : console.log('  ✓ player cannot leave the building');

console.log(`\n${errors} error(s), ${warns} warning(s)`);
process.exit(errors ? 1 : 0);
