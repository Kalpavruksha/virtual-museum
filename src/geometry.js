// Pure maths (no three.js) so the validator and the game share the same truth.
const THETA = { north: 0, south: Math.PI, east: -Math.PI / 2, west: Math.PI / 2 };

export const wallLength = (r, wall) => (wall === 'north' || wall === 'south' ? r.size[0] : r.size[1]);

// Frame of a wall: theta = rotation.y for things facing into the room,
// n = inward normal, t = tangent (left→right as seen from inside), b = point on the wall's centre line.
export function wallFrame(r, wall) {
  const th = THETA[wall];
  const n = { x: Math.sin(th), z: Math.cos(th) };
  const t = { x: Math.cos(th), z: -Math.sin(th) };
  const half = wall === 'north' || wall === 'south' ? r.size[1] / 2 : r.size[0] / 2;
  return { theta: th, n, t, bx: r.center[0] - n.x * half, bz: r.center[1] - n.z * half, len: wallLength(r, wall) };
}

// World position + rotation for something hung on the inner face of a wall.
export function placeOnWall(L, r, wall, at, off = 0) {
  const f = wallFrame(r, wall);
  const d = L.wallThickness / 2 + off;
  return { x: f.bx + f.n.x * d + f.t.x * at, z: f.bz + f.n.z * d + f.t.z * at, theta: f.theta };
}

// Doors that cut a wall. Rooms are stacked along -Z, so a room's NORTH wall is the next room's SOUTH wall.
export function doorsFor(L, r, wall) {
  const i = L.rooms.indexOf(r);
  if (wall === 'south') return r.doors.filter(d => d.wall === 'south');
  if (wall === 'north') {
    const next = L.rooms[i + 1];
    return next ? next.doors.filter(d => d.wall === 'south').map(d => ({ ...d, at: -d.at })) : [];
  }
  return [];
}

// Splits a wall into slab pieces (s0..s1 along tangent, y0..y1). Lintels above doors don't collide.
export function wallPieces(L, r, wall, doors = doorsFor(L, r, wall)) {
  const H = L.wallHeight, th = L.wallThickness, len = wallLength(r, wall);
  const ds = [...doors].sort((a, b) => a.at - b.at);
  const out = []; let cur = -len / 2 - th / 2;
  for (const d of ds) {
    out.push({ s0: cur, s1: d.at - d.width / 2, y0: 0, y1: H, collide: true });
    out.push({ s0: d.at - d.width / 2, s1: d.at + d.width / 2, y0: d.height, y1: H, collide: false });
    cur = d.at + d.width / 2;
  }
  out.push({ s0: cur, s1: len / 2 + th / 2, y0: 0, y1: H, collide: true });
  return out.filter(p => p.s1 - p.s0 > 1e-3);
}

export function pieceAABB(L, r, wall, p) {
  const f = wallFrame(r, wall), th = L.wallThickness;
  const sc = (p.s0 + p.s1) / 2, sl = p.s1 - p.s0;
  const cx = f.bx + f.t.x * sc, cz = f.bz + f.t.z * sc;
  const hx = Math.abs(f.t.x) * sl / 2 + Math.abs(f.n.x) * th / 2;
  const hz = Math.abs(f.t.z) * sl / 2 + Math.abs(f.n.z) * th / 2;
  return { minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz };
}

export function wallsToBuild(L, r) {
  const last = L.rooms[L.rooms.length - 1] === r;
  return last ? ['south', 'east', 'west', 'north'] : ['south', 'east', 'west'];
}

export function allColliders(L) {
  const boxes = [];
  for (const r of L.rooms) {
    for (const w of wallsToBuild(L, r))
      for (const p of wallPieces(L, r, w)) if (p.collide) boxes.push(pieceAABB(L, r, w, p));
    for (const [x, z] of r.columns || []) boxes.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4 });
  }
  return boxes;
}

// Circle-vs-AABB push-out. Mutates and returns pos {x,z}.
export function resolve(pos, radius, boxes) {
  for (let pass = 0; pass < 2; pass++)
    for (const b of boxes) {
      const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (d2 > 1e-9) { const d = Math.sqrt(d2), k = (radius - d) / d; pos.x += dx * k; pos.z += dz * k; }
      else {
        const l = pos.x - b.minX, r = b.maxX - pos.x, t = pos.z - b.minZ, bt = b.maxZ - pos.z, m = Math.min(l, r, t, bt);
        if (m === l) pos.x = b.minX - radius; else if (m === r) pos.x = b.maxX + radius;
        else if (m === t) pos.z = b.minZ - radius; else pos.z = b.maxZ + radius;
      }
    }
  return pos;
}
