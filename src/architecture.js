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

  // --- Room Portal Signs & Headings (Carved architectural tablets at beginning of each room) ---
  function createPortalSign(title, subtitle, desc, x, y, z, rotY = 0) {
    const sg = new THREE.Group();
    sg.position.set(x, y, z);
    sg.rotation.y = rotY;

    // Dark obsidian tablet backing
    const tabletMat = new THREE.MeshStandardMaterial({ color: 0x181512, roughness: 0.45, metalness: 0.1 });
    const tablet = new THREE.Mesh(new THREE.BoxGeometry(4.7, 1.0, 0.08), tabletMat);
    tablet.castShadow = true;
    sg.add(tablet);

    // Turned bronze-gold architectural moulding frame
    const signGold = new THREE.MeshStandardMaterial({ color: 0xb8975a, metalness: 0.82, roughness: 0.25 });
    const border = new THREE.Mesh(new THREE.BoxGeometry(4.82, 1.12, 0.10), signGold);
    border.position.z = -0.012;
    sg.add(border);

    // High-resolution Canvas texture with Aniron font
    const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#14120e'; g.fillRect(0, 0, 1024, 256);
    g.strokeStyle = '#c9a84c'; g.lineWidth = 4; g.strokeRect(14, 14, 996, 228);
    g.strokeStyle = 'rgba(201, 168, 76, 0.4)'; g.lineWidth = 1.5; g.strokeRect(22, 22, 980, 212);

    g.fillStyle = '#f5dfa0'; g.textAlign = 'center';
    g.font = 'bold 42px Aniron, Georgia, serif';
    g.fillText(title, 512, 90);

    g.fillStyle = '#c9a84c';
    g.font = '24px Aniron, Georgia, serif';
    g.fillText(subtitle, 512, 148);

    if (desc) {
      g.fillStyle = '#8e7d65';
      g.font = '19px Aniron, sans-serif';
      g.fillText(desc, 512, 194);
    }

    const signTex = new THREE.CanvasTexture(c);
    signTex.colorSpace = THREE.SRGBColorSpace;
    const signFace = new THREE.Mesh(
      new THREE.PlaneGeometry(4.6, 0.9),
      new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.35, metalness: 0.15 })
    );
    signFace.position.z = 0.042;
    sg.add(signFace);

    // Dedicated warm architectural point light
    const signLight = new THREE.PointLight(0xfff0d0, 6, 8, 2);
    signLight.position.set(0, 0, 0.9);
    sg.add(signLight);

    scene.add(sg);
  }

  // 1. Grand Entrance Hall (Main Entrance above South wall facing spawn, and north portal)
  createPortalSign(
    'GRAND ENTRANCE HALL',
    'Classical Antiquity · Architecture · Leonardo da Vinci',
    'PERMANENT COLLECTION · WING I',
    0, 4.35, 5.82, Math.PI
  );

  // 2. Paintings Gallery (Beginning of Paintings Room at Z = -6.0)
  createPortalSign(
    'PAINTINGS GALLERY',
    'Masterpieces of Light & Form · Renaissance to Surrealism',
    'VAN GOGH · DA VINCI · VERMEER · DALÍ · HOKUSAI',
    0, 4.35, -6.12, 0
  );
  // Reverse side of Paintings archway (facing back to Grand Entrance Hall)
  createPortalSign(
    'GRAND ENTRANCE HALL',
    'Classical Architecture · Leonardo da Vinci',
    'PERMANENT COLLECTION · WING I',
    0, 4.35, -5.88, Math.PI
  );

  // 3. Music & Instruments Hall (Beginning of Music Room at Z = -20.0)
  createPortalSign(
    'MUSIC & INSTRUMENTS HALL',
    'Ancient Relics · Acoustic Innovations · Master Symphonies',
    '40,000 BC FLUTES TO BEETHOVEN · WING III',
    0, 4.35, -20.12, 0
  );
  // Reverse side of Music archway (facing back to Paintings Gallery)
  createPortalSign(
    'PAINTINGS GALLERY',
    'Masterpieces of Light & Form',
    'WING II',
    0, 4.35, -19.88, Math.PI
  );

  // 4. History & Science Room (Beginning of History Room at Z = -34.0)
  createPortalSign(
    'HISTORY & SCIENCE ROOM',
    'Human Achievement · Space Exploration · The One Ring',
    'APOLLO 11 · EIFFEL TOWER · SAURON MASTER RING',
    0, 4.35, -34.12, 0
  );
  // Reverse side of History archway (facing back to Music Hall)
  createPortalSign(
    'MUSIC & INSTRUMENTS HALL',
    'Ancient Relics · Master Symphonies',
    'WING III',
    0, 4.35, -33.88, Math.PI
  );

  return { colliders, blockers };
}
