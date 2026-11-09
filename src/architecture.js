import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { L, wallFrame, wallPieces, pieceAABB, wallsToBuild } from './layout.js';
import { getMaterial, tileBox, tilePlane } from './materials.js';

export function buildArchitecture(scene, options = {}) {
  const colliders = [], blockers = [], H = L.wallHeight, th = L.wallThickness;
  const trim = getMaterial('trim');
  const skyMat = new THREE.MeshBasicMaterial({ color: 0xfff6e4, toneMapped: false });

  // Atmospheric sunbeam material
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfff4dc,
    transparent: true,
    opacity: 0.024,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  L.rooms.forEach(r => {
    const [cx, cz] = r.center, [w, d] = r.size;

    // Base PBR floor
    const floorMat = getMaterial(r.floor);
    const floor = new THREE.Mesh(tilePlane(w, d, floorMat.userData.tile), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, 0, cz);
    floor.receiveShadow = true;
    scene.add(floor);

    // Planar Reflector for polished marble rooms
    if (r.floor === 'marble' && options.reflector !== false) {
      try {
        const res = options.reflectorRes || 1024;
        const reflector = new Reflector(new THREE.PlaneGeometry(w - 0.1, d - 0.1), {
          clipBias: 0.003,
          textureWidth: res,
          textureHeight: res,
          color: 0x423c34, // warm tinted stone reflection
          multisample: 2
        });
        reflector.rotation.x = -Math.PI / 2;
        reflector.position.set(cx, 0.003, cz);
        scene.add(reflector);
      } catch (e) {
        console.warn('Reflector failed, using standard floor:', e);
      }
    }

    // Ceiling
    const ceil = new THREE.Mesh(tilePlane(w, d, 4), getMaterial('ceiling'));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(cx, H, cz);
    scene.add(ceil);

    // Skylight panels (emissive) + soft room light + volumetric beams
    const n = Math.max(1, Math.round(d / 5));
    for (let i = 0; i < n; i++) {
      const zPos = cz - d / 2 + (i + 0.5) * d / n;

      // Emissive skylight panel
      const s = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.45, 2.2), skyMat);
      s.rotation.x = Math.PI / 2;
      s.position.set(cx, H - 0.02, zPos);
      scene.add(s);

      // Soft architectural point light
      const l = new THREE.PointLight(0xfff2dc, 16, 18, 2);
      l.position.set(cx, H - 0.6, zPos);
      scene.add(l);

      // Ethereal light beam shaft
      const beamGeo = new THREE.CylinderGeometry(w * 0.22, w * 0.3, H - 0.5, 16, 1, true);
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(cx, (H - 0.5) / 2, zPos);
      scene.add(beam);
    }

    // Walls
    for (const wall of wallsToBuild(L, r)) {
      const f = wallFrame(r, wall), mat = getMaterial(r.wall), tile = mat.userData.tile;
      for (const p of wallPieces(L, r, wall)) {
        const sl = p.s1 - p.s0, sc = (p.s0 + p.s1) / 2, h = p.y1 - p.y0;
        const m = new THREE.Mesh(tileBox(sl, h, th, tile), mat);
        m.position.set(f.bx + f.t.x * sc, p.y0 + h / 2, f.bz + f.t.z * sc);
        m.rotation.y = f.theta;
        m.receiveShadow = true;
        scene.add(m);
        blockers.push(m);
        if (p.collide) colliders.push(pieceAABB(L, r, wall, p));

        // Baseboard moulding on both faces (full-height wall pieces)
        if (p.y0 === 0) for (const side of [1, -1]) {
          const b = new THREE.Mesh(tileBox(sl, 0.16, 0.05, 1), trim);
          b.position.set(m.position.x + f.n.x * side * (th / 2 + 0.025), 0.08, m.position.z + f.n.z * side * (th / 2 + 0.025));
          b.rotation.y = f.theta;
          b.receiveShadow = true;
          scene.add(b);
        }
      }

      // Crown moulding along the whole wall, both faces
      for (const side of [1, -1]) {
        const c = new THREE.Mesh(tileBox(f.len + th, 0.22, 0.12, 1), trim);
        c.position.set(f.bx + f.n.x * side * (th / 2 + 0.06), H - 0.11, f.bz + f.n.z * side * (th / 2 + 0.06));
        c.rotation.y = f.theta;
        scene.add(c);
      }
    }

    // Pillars / Columns
    for (const [x, z] of r.columns || []) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, H, 28), getMaterial('marble'));
      col.position.set(x, H / 2, z);
      col.castShadow = true;
      col.receiveShadow = true;
      scene.add(col);
      blockers.push(col);

      const cap = new THREE.Mesh(tileBox(1.1, 0.2, 1.1, 1), trim);
      cap.position.set(x, H - 0.1, z);
      scene.add(cap);

      const base = new THREE.Mesh(tileBox(1.1, 0.25, 1.1, 1), trim);
      base.position.set(x, 0.125, z);
      base.receiveShadow = true;
      scene.add(base);
    }
  });

  // --- Gallery Benches (Paintings Gallery) ---
  const benchWoodMat = new THREE.MeshStandardMaterial({ color: 0x241810, roughness: 0.38 });
  const benchLeatherMat = new THREE.MeshStandardMaterial({ color: 0x1a1614, roughness: 0.72 });
  const benchMetalMat = new THREE.MeshStandardMaterial({ color: 0x997a38, metalness: 0.85, roughness: 0.25 });

  const benchPositions = [
    { x: -3.8, z: -13 },
    { x: 3.8, z: -13 }
  ];

  benchPositions.forEach(bp => {
    const bg = new THREE.Group();
    bg.position.set(bp.x, 0, bp.z);

    // Dark walnut wooden plinth / base
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.08, 2.3), benchWoodMat);
    base.position.y = 0.04;
    base.castShadow = true;
    base.receiveShadow = true;
    bg.add(base);

    // Turned brass legs
    for (const lx of [-0.36, 0.36]) {
      for (const lz of [-1.0, 1.0]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.02, 0.32, 12), benchMetalMat);
        leg.position.set(lx, 0.24, lz);
        leg.castShadow = true;
        bg.add(leg);
      }
    }

    // Padded leather cushion
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.14, 2.22), benchLeatherMat);
    cushion.position.y = 0.47;
    cushion.castShadow = true;
    cushion.receiveShadow = true;
    bg.add(cushion);

    scene.add(bg);
    blockers.push(bg);

    // Collision box
    colliders.push({
      minX: bp.x - 0.45,
      maxX: bp.x + 0.45,
      minZ: bp.z - 1.15,
      maxZ: bp.z + 1.15
    });
  });

  // --- Grand Entrance Hall Inscription Sign ---
  function createMuseumSign() {
    const sg = new THREE.Group();
    sg.position.set(0, 4.35, -5.78);

    const tabletMat = new THREE.MeshStandardMaterial({ color: 0x2a241e, roughness: 0.4, metalness: 0.1 });
    const tablet = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.9, 0.06), tabletMat);
    tablet.castShadow = true;
    sg.add(tablet);

    const signGold = new THREE.MeshStandardMaterial({ color: 0xb8975a, metalness: 0.8, roughness: 0.3 });
    const border = new THREE.Mesh(new THREE.BoxGeometry(4.72, 1.02, 0.08), signGold);
    border.position.z = -0.01;
    sg.add(border);

    const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#161310'; g.fillRect(0, 0, 1024, 256);
    g.strokeStyle = '#c9a84c'; g.lineWidth = 4; g.strokeRect(16, 16, 992, 224);
    g.fillStyle = '#f5dfa0'; g.textAlign = 'center';
    g.font = 'bold 50px Georgia, serif';
    g.fillText('M U S É E   D E S   B E A U X - A R T S', 512, 95);
    g.font = 'italic 32px Georgia, serif'; g.fillStyle = '#c9a84c';
    g.fillText('Collection Permanente · Masterpieces of Art', 512, 160);
    g.font = '22px Inter, sans-serif'; g.fillStyle = '#8e7d65';
    g.fillText('VIRTUAL MUSEUM · MCMXXVI', 512, 206);

    const signTex = new THREE.CanvasTexture(c);
    signTex.colorSpace = THREE.SRGBColorSpace;
    const signFace = new THREE.Mesh(
      new THREE.PlaneGeometry(4.5, 0.8),
      new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.4, metalness: 0.15 })
    );
    signFace.position.z = 0.032;
    sg.add(signFace);

    const signLight = new THREE.PointLight(0xfff2dc, 8, 8, 2);
    signLight.position.set(0, 0, 1.2);
    sg.add(signLight);

    scene.add(sg);
  }
  createMuseumSign();

  return { colliders, blockers };
}
