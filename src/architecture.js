import * as THREE from 'three';
import { L, wallFrame, wallPieces, pieceAABB, wallsToBuild } from './layout.js';
import { getMaterial, tileBox, tilePlane } from './materials.js';

export function buildArchitecture(scene) {
  const colliders = [], blockers = [], H = L.wallHeight, th = L.wallThickness;
  const trim = getMaterial('trim');
  const skyMat = new THREE.MeshBasicMaterial({ color: 0xfff4dc, toneMapped: false });

  L.rooms.forEach(r => {
    const [cx, cz] = r.center, [w, d] = r.size;
    const floor = new THREE.Mesh(tilePlane(w, d, getMaterial(r.floor).userData.tile), getMaterial(r.floor));
    floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0, cz); scene.add(floor);

    const ceil = new THREE.Mesh(tilePlane(w, d, 4), getMaterial('ceiling'));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, H, cz); scene.add(ceil);
    // skylight panels (emissive) + one soft room light
    const n = Math.max(1, Math.round(d / 5));
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.45, 2.2), skyMat);
      s.rotation.x = Math.PI / 2; s.position.set(cx, H - 0.02, cz - d / 2 + (i + 0.5) * d / n); scene.add(s);
      const l = new THREE.PointLight(0xfff0d8, 14, 16, 2); l.position.set(cx, H - 0.6, s.position.z); scene.add(l);
    }

    for (const wall of wallsToBuild(L, r)) {
      const f = wallFrame(r, wall), mat = getMaterial(r.wall), tile = mat.userData.tile;
      for (const p of wallPieces(L, r, wall)) {
        const sl = p.s1 - p.s0, sc = (p.s0 + p.s1) / 2, h = p.y1 - p.y0;
        const m = new THREE.Mesh(tileBox(sl, h, th, tile), mat);
        m.position.set(f.bx + f.t.x * sc, p.y0 + h / 2, f.bz + f.t.z * sc); m.rotation.y = f.theta; scene.add(m);
        blockers.push(m);
        if (p.collide) colliders.push(pieceAABB(L, r, wall, p));
        // baseboard on both faces (only on full-height pieces)
        if (p.y0 === 0) for (const side of [1, -1]) {
          const b = new THREE.Mesh(tileBox(sl, 0.16, 0.05, 1), trim);
          b.position.set(m.position.x + f.n.x * side * (th / 2 + 0.025), 0.08, m.position.z + f.n.z * side * (th / 2 + 0.025));
          b.rotation.y = f.theta; scene.add(b);
        }
      }
      // crown moulding along the whole wall, both faces
      for (const side of [1, -1]) {
        const c = new THREE.Mesh(tileBox(f.len + th, 0.22, 0.12, 1), trim);
        c.position.set(f.bx + f.n.x * side * (th / 2 + 0.06), H - 0.11, f.bz + f.n.z * side * (th / 2 + 0.06));
        c.rotation.y = f.theta; scene.add(c);
      }
    }

    for (const [x, z] of r.columns || []) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, H, 24), getMaterial('marble'));
      col.position.set(x, H / 2, z); scene.add(col); blockers.push(col);
      const cap = new THREE.Mesh(tileBox(1.1, 0.2, 1.1, 1), trim); cap.position.set(x, H - 0.1, z); scene.add(cap);
      const base = new THREE.Mesh(tileBox(1.1, 0.25, 1.1, 1), trim); base.position.set(x, 0.125, z); scene.add(base);
    }
  });
  return { colliders, blockers };
}
