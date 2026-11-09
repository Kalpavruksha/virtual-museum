import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { L, EXHIBITS, room, placeOnWall } from './layout.js';
import { loadTexture, labelTexture, plaqueTexture, tileBox, getCanvasNormalMap } from './materials.js';

const H = L.wallHeight;
const goldMat = new THREE.MeshStandardMaterial({ color: 0x9e7f38, metalness: 0.75, roughness: 0.28 });
const matteMat = new THREE.MeshStandardMaterial({ color: 0xefe8d8, roughness: 0.92 });
const pedMat = new THREE.MeshStandardMaterial({ color: 0x18181c, roughness: 0.35, metalness: 0.08 });
const brassMat = new THREE.MeshStandardMaterial({ color: 0xc8a452, metalness: 0.85, roughness: 0.22 });
const fixtureMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff6dc });
const hiMat = new THREE.LineBasicMaterial({ color: 0xe8c36a });

function spot(parent, from, to, intensity = 28, castShadow = false) {
  // Soft, warm museum spotlight (3200K gallery pool with 82% feathering)
  const s = new THREE.SpotLight(0xffeed8, intensity, 12, Math.PI / 5.2, 0.82, 1.8);
  s.position.copy(from);
  s.target.position.copy(to);
  if (castShadow) {
    s.castShadow = true;
    s.shadow.mapSize.width = 1024;
    s.shadow.mapSize.height = 1024;
    s.shadow.camera.near = 0.5;
    s.shadow.camera.far = 12;
    s.shadow.bias = -0.001;
  }
  parent.add(s, s.target);

  // Ceiling track fixture
  const fx = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.16, 12), fixtureMat);
  fx.position.copy(from);
  // Visually glowing bulb inside the fixture
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), bulbMat);
  bulb.position.copy(from);
  parent.add(fx, bulb);
}

function highlight(w, h, d = 0.12) {
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), hiMat);
  e.visible = false;
  return e;
}

const box = (x, z, w, d) => ({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });

async function frameArt(ex) {
  const r = room(ex.room), [mw, mh] = ex.maxSize;
  const { tex, aspect } = await loadTexture(ex.src, ex.title, mw / mh);
  let w = mw, h = w / aspect;
  if (h > mh) { h = mh; w = h * aspect; }
  const g = new THREE.Group(), y = ex.y ?? L.artCenterY, p = placeOnWall(L, r, ex.wall, ex.at, 0.01);
  g.position.set(p.x, y, p.z);
  g.rotation.y = p.theta;

  const m = 0.08, fr = 0.07, D = 0.09;
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(w + 2 * m, h + 2 * m), matteMat);
  mat.position.z = D / 2 - 0.01;

  const art = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({
      map: tex,
      normalMap: getCanvasNormalMap(),
      normalScale: new THREE.Vector2(0.24, 0.24),
      roughness: 0.45,
      metalness: 0.02
    })
  );
  art.position.z = D / 2;
  g.add(mat, art);

  const W = w + 2 * m + 2 * fr, Hh = h + 2 * m + 2 * fr;
  // Tier 1: Outer classic gold frame
  for (const [bw, bh, bx, by] of [
    [W, fr, 0, (Hh - fr) / 2],
    [W, fr, 0, -(Hh - fr) / 2],
    [fr, Hh, (W - fr) / 2, 0],
    [fr, Hh, -(W - fr) / 2, 0]
  ]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, D), goldMat);
    b.position.set(bx, by, D / 2 - 0.005);
    b.castShadow = true;
    g.add(b);
  }

  // Tier 2: Raised decorative gold bead moulding
  const beadFr = fr * 0.38, beadW = W - fr * 0.8, beadH = Hh - fr * 0.8, beadD = D * 1.28;
  for (const [bw, bh, bx, by] of [
    [beadW, beadFr, 0, (beadH - beadFr) / 2],
    [beadW, beadFr, 0, -(beadH - beadFr) / 2],
    [beadFr, beadH, (beadW - beadFr) / 2, 0],
    [beadFr, beadH, -(beadW - beadFr) / 2, 0]
  ]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, beadD), goldMat);
    b.position.set(bx, by, beadD / 2 - 0.003);
    g.add(b);
  }

  // Tier 3: Burnished dark walnut liner between frame and matte
  const linerFr = 0.018, linerW = W - fr * 1.5, linerH = Hh - fr * 1.5;
  const linerMat = new THREE.MeshStandardMaterial({ color: 0x1f1712, roughness: 0.65 });
  for (const [bw, bh, bx, by] of [
    [linerW, linerFr, 0, (linerH - linerFr) / 2],
    [linerW, linerFr, 0, -(linerH - linerFr) / 2],
    [linerFr, linerH, (linerW - linerFr) / 2, 0],
    [linerFr, linerH, -(linerW - linerFr) / 2, 0]
  ]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, D * 0.88), linerMat);
    b.position.set(bx, by, D / 2 - 0.005);
    g.add(b);
  }

  const pl = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.21),
    new THREE.MeshStandardMaterial({ map: plaqueTexture(ex.title, ex.artist, ex.year), roughness: 0.4 })
  );
  pl.position.set(W / 2 + 0.38, -0.1, 0.012);
  g.add(pl);

  spot(g, new THREE.Vector3(0, H - 0.3 - y, 2.2), new THREE.Vector3(0, 0, 0), 28, false);

  const hi = highlight(W + 0.06, Hh + 0.06);
  hi.position.z = D / 2;
  g.add(hi);
  g.userData = { exhibit: ex, highlight: hi };
  return { object: g };
}

function videoScreen(ex) {
  const r = room(ex.room), [w, h] = ex.size, y = ex.y ?? 2.4, p = placeOnWall(L, r, ex.wall, ex.at, 0.01);
  const g = new THREE.Group();
  g.position.set(p.x, y, p.z);
  g.rotation.y = p.theta;

  const video = document.createElement('video');
  video.src = ex.src;
  video.loop = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  video.muted = true; // guarantees instant autoplay approval in modern browsers
  video.volume = 0;

  const screenMat = new THREE.MeshBasicMaterial({ map: labelTexture(ex.title, 'loading…', w / h), toneMapped: false });
  video.addEventListener('loadeddata', () => {
    const t = new THREE.VideoTexture(video);
    t.colorSpace = THREE.SRGBColorSpace;
    screenMat.map = t;
    screenMat.needsUpdate = true;
  });
  video.addEventListener('error', () => {
    screenMat.map = labelTexture(ex.title, 'add ' + ex.src, w / h);
    screenMat.needsUpdate = true;
  });

  const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), screenMat);
  screen.position.z = 0.125;

  const bezel = new THREE.Mesh(new THREE.BoxGeometry(w + 0.25, h + 0.25, 0.12), fixtureMat);
  bezel.position.z = 0.05;

  const glow = new THREE.PointLight(0xa5c2ff, 7, 10, 2);
  glow.position.z = 1.5;
  g.add(bezel, screen, glow);

  const hi = highlight(w + 0.3, h + 0.3, 0.2);
  hi.position.z = 0.06;
  g.add(hi);
  g.userData = { exhibit: ex, highlight: hi };
  const pos = g.position.clone();

  return {
    object: g,
    media: {
      start: () => video.play().catch(() => {}),
      pause: () => {
        video.pause();
      },
      update: d => {
        // Tight, focused screening range: directly in front of the screen (within 4.8m)
        // Does NOT bleed into The One Ring (at 7.2m away)
        const maxDist = 4.8;
        if (d < maxDist) {
          video.muted = false;
          video.volume = THREE.MathUtils.clamp(1 - d / maxDist, 0, 1) * 0.85;
          if (video.paused) video.play().catch(() => {});
        } else {
          video.volume = 0;
        }
      },
      pos
    }
  };
}

function pedestal(scene, x, z, w, hgt) {
  const p = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, w), pedMat);
  p.position.set(x, hgt / 2, z);
  p.castShadow = true;
  p.receiveShadow = true;
  scene.add(p);

  // Plinth base moulding
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.08, w + 0.12), pedMat);
  plinth.position.set(x, 0.04, z);
  plinth.receiveShadow = true;
  scene.add(plinth);

  // Slim polished brass rail around top perimeter
  const rw = w + 0.02, rh = 0.024, rd = 0.024;
  for (const [bx, bz, bw, bd] of [
    [x, z + w / 2, rw, rd],
    [x, z - w / 2, rw, rd],
    [x + w / 2, z, rd, rw],
    [x - w / 2, z, rd, rw]
  ]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(bw, rh, bd), brassMat);
    rail.position.set(bx, hgt + rh / 2, bz);
    scene.add(rail);
  }

  return p;
}

function audioStation(ex) {
  const [x, z] = ex.pos, g = new THREE.Group();
  g.add(pedestal(g, x, z, 0.9, 1.0));

  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.28, 0.12, 24),
    new THREE.MeshStandardMaterial({ color: 0xb8975a, metalness: 0.8, roughness: 0.3, emissive: 0x3a2a08 })
  );
  top.position.set(x, 1.06, z);
  top.castShadow = true;
  g.add(top);

  const pl = new THREE.Mesh(
    new THREE.PlaneGeometry(0.6, 0.3),
    new THREE.MeshStandardMaterial({ map: plaqueTexture(ex.title, ex.artist, ex.year) })
  );
  pl.position.set(x, 0.65, z + 0.452);
  g.add(pl);

  // Spotlight with soft contact shadow
  spot(g, new THREE.Vector3(x, H - 0.3, z + 0.4), new THREE.Vector3(x, 1, z), 36, true);

  const hi = highlight(1.0, 1.2, 1.0);
  hi.position.set(x, 0.6, z);
  g.add(hi);
  g.userData = { exhibit: ex, highlight: hi };

  const audio = new Audio(ex.src);
  audio.loop = true;
  audio.volume = 0;
  let started = false;

  return {
    object: g,
    collider: box(x, z, 0.9, 0.9),
    media: {
      pos: new THREE.Vector3(x, 1, z),
      start: () => { started = true; },
      pause: () => {
        if (!audio.paused) audio.pause();
      },
      update: d => {
        if (!started) return;
        // Intimate listening station range: only when near to that pedestal (within 3.4m)
        const maxDist = 3.4;
        if (d < maxDist) {
          const vol = THREE.MathUtils.clamp((maxDist - d) / (maxDist - 0.4), 0, 1) * 0.8;
          audio.volume = vol;
          if (audio.paused && vol > 0.02) audio.play().catch(() => {});
        } else {
          audio.volume = 0;
          if (!audio.paused) audio.pause();
        }
      }
    }
  };
}

// Procedural ring stand-in while .glb is loading
function proceduralRing(radius = 0.27, tube = 0.052) {
  const g = new THREE.Group();
  const ringGeom = new THREE.TorusGeometry(radius, tube, 24, 48);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xdfb140,
    metalness: 0.94,
    roughness: 0.2,
    emissive: 0x4a3205
  });
  const mesh = new THREE.Mesh(ringGeom, ringMat);
  mesh.rotation.x = 0.52;
  mesh.castShadow = true;
  g.add(mesh);
  return g;
}

// Procedural stand-in used until a real .glb is loaded
function proceduralEiffel(height) {
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: 0x6b5a48, metalness: 0.6, roughness: 0.5 });
  const strut = (a, b, r = 0.012) => {
    const dir = new THREE.Vector3().subVectors(b, a), len = dir.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), mat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    m.castShadow = true;
    g.add(m);
  };
  const half = y => 0.5 * Math.pow(1 - y / height, 1.8) + 0.03;
  const ring = y => [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => new THREE.Vector3(sx * half(y), y, sz * half(y)));
  const levels = [0, 0.18, 0.4, 0.62, 0.85, 1].map(k => k * height);
  for (let i = 0; i < levels.length - 1; i++) {
    const a = ring(levels[i]), b = ring(levels[i + 1]);
    for (let k = 0; k < 4; k++) {
      strut(a[k], b[k]);
      strut(b[k], b[(k + 1) % 4]);
      strut(a[k], b[(k + 1) % 4], 0.006);
    }
  }
  for (const k of [0.4, 0.62]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(half(k * height) * 2.4, 0.02, half(k * height) * 2.4), mat);
    p.position.y = k * height;
    p.castShadow = true;
    g.add(p);
  }
  return g;
}

function modelPedestal(ex) {
  const [x, z] = ex.pos, g = new THREE.Group(), ped = 1.0;
  g.add(pedestal(g, x, z, 1.2, ped));

  const isRing = ex.id === 'one_ring';
  const vitrineH = isRing ? 0.95 : (ex.height + 0.35);
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(1.12, vitrineH, 1.12),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.2,
      roughness: 0.04,
      metalness: 0.0,
      transmission: 0.88,
      thickness: 0.3,
      ior: 1.52,
      depthWrite: false
    })
  );
  glass.position.set(x, ped + vitrineH / 2, z);
  g.add(glass);

  // Brass corner clips on the glass vitrine
  for (const cx of [x - 0.55, x + 0.55]) {
    for (const cz of [z - 0.55, z + 0.55]) {
      const clip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.04), brassMat);
      clip.position.set(cx, ped + vitrineH - 0.035, cz);
      g.add(clip);
    }
  }

  const holder = new THREE.Group();
  const baseY = isRing ? (ped + vitrineH / 2) : (ped + 0.02);
  holder.position.set(x, baseY, z);
  g.add(holder);

  // Initial stand-in while GLTF loads
  if (isRing) {
    holder.add(proceduralRing(0.19, 0.038));
  } else {
    holder.add(proceduralEiffel(ex.height));
  }

  const loader = new GLTFLoader();
  try {
    const draco = new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    loader.setDRACOLoader(draco);
  } catch (_) {}

  loader.load(
    ex.src,
    gltf => {
      holder.clear();
      const m = gltf.scene;
      m.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (isRing) {
            // Split geometry into pure gold ring body and glowing fiery Tengwar inscription
            const geom = child.geometry;
            if (geom && geom.index && geom.index.count >= 61440) {
              geom.clearGroups();
              geom.addGroup(0, 24576, 0);     // Material 0: Ring body (8,192 triangles)
              geom.addGroup(24576, 36864, 1); // Material 1: The Words / Inscription (12,288 triangles)

              const texLoader = new THREE.TextureLoader();
              const fieryTex = texLoader.load('/assets/models/one-ring/textures/one_ring_inscription_fiery.png');
              fieryTex.colorSpace = THREE.SRGBColorSpace;
              fieryTex.wrapS = THREE.RepeatWrapping;

              // Polished 24K gold body
              const bodyMat = new THREE.MeshStandardMaterial({
                color: 0xdfaf37,
                metalness: 0.95,
                roughness: 0.12,
                envMapIntensity: 2.2
              });

              // Fiery glowing Tengwar script words with high-res texture map
              const runeMat = new THREE.MeshStandardMaterial({
                color: 0xff3b00,        // Fiery red-orange
                emissive: 0xff4500,     // Glowing fiery Tengwar script
                emissiveIntensity: 3.8, // Bright incandescent Mordor glow
                emissiveMap: fieryTex,
                map: fieryTex,
                metalness: 0.2,
                roughness: 0.25
              });

              child.material = [bodyMat, runeMat];
            } else if (child.material) {
              child.material.metalness = 0.96;
              child.material.roughness = 0.16;
              child.material.envMapIntensity = 2.4;
            }
          }
        }
      });

      // Fit to target size along maximum dimension
      const b = new THREE.Box3().setFromObject(m);
      const size = new THREE.Vector3();
      b.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const targetSize = ex.targetSize || ex.height;
      const s = targetSize / Math.max(maxDim, 0.001);
      m.scale.setScalar(s);

      // Recompute bounding box after scale
      const b2 = new THREE.Box3().setFromObject(m);
      const center = new THREE.Vector3();
      b2.getCenter(center);

      if (isRing) {
        // Center ring precisely at origin of holder
        m.position.sub(center);
        // Tilt ring ~30 deg on X and diagonal tilt on Z to angle the fiery runes directly at player's eyes
        m.rotation.x = 0.52;
        m.rotation.z = 0.14;

        // Aura point light at center of the One Ring
        const ringGlow = new THREE.PointLight(0xff6600, 3.5, 2.2, 2);
        ringGlow.position.set(0, 0, 0);
        holder.add(ringGlow);
      } else {
        // Center on X and Z, place base directly on the pedestal surface
        m.position.set(-center.x, -b2.min.y, -center.z);
      }

      holder.add(m);
    },
    undefined,
    err => {
      console.warn(`Could not load model for ${ex.id}:`, err);
    }
  );

  const pl = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.35),
    new THREE.MeshStandardMaterial({ map: plaqueTexture(ex.title, ex.artist, ex.year) })
  );
  pl.position.set(x, 0.55, z + 0.602);
  g.add(pl);

  // Spotlight with soft contact shadow
  const spotTargetY = isRing ? baseY : (ped + ex.height / 2);
  spot(g, new THREE.Vector3(x, H - 0.3, z + 0.6), new THREE.Vector3(x, spotTargetY, z), isRing ? 60 : 48, true);

  const hiHeight = isRing ? (vitrineH + 0.1) : (ex.height + 0.4);
  const hi = highlight(1.3, ped + hiHeight, 1.3);
  hi.position.set(x, (ped + hiHeight) / 2, z);
  g.add(hi);
  g.userData = { exhibit: ex, highlight: hi };

  let media;
  const audioSrc = ex.audioSrc || (isRing ? '/assets/audio/the_one_ring_violin.mp3' : null);
  if (audioSrc) {
    const ringAudio = new Audio(audioSrc);
    ringAudio.loop = true;
    ringAudio.volume = 0;
    ringAudio.preload = 'auto';
    let started = false;

    media = {
      pos: new THREE.Vector3(x, 1, z),
      start: () => {
        started = true;
        // Prime audio during user click gesture so browser never blocks it
        ringAudio.play().then(() => {
          if (ringAudio.volume === 0 && !started) ringAudio.pause();
        }).catch(() => {});
      },
      pause: () => {
        if (!ringAudio.paused) ringAudio.pause();
      },
      update: d => {
        if (!started) return;
        // Monument viewing range: plays as you approach and watch the monument (within 5.8m)
        const maxDist = 5.8;
        if (d < maxDist) {
          const vol = THREE.MathUtils.clamp((maxDist - d) / (maxDist - 0.8), 0, 1) * 0.85;
          ringAudio.volume = vol;
          if (ringAudio.paused && vol > 0.01) ringAudio.play().catch(() => {});
        } else {
          ringAudio.volume = 0;
          if (!ringAudio.paused) ringAudio.pause();
        }
      }
    };
  }

  const rotator = {
    holder,
    isRing,
    baseY,
    speed: isRing ? 0.75 : 0.25,
    time: Math.random() * 10
  };

  return { object: g, collider: box(x, z, 1.2, 1.2), rotator, media };
}

export async function buildExhibits(scene, colliders) {
  const targets = [], medias = [], rotators = [];
  const makers = { image: frameArt, video: videoScreen, audio: audioStation, model: modelPedestal };
  const built = await Promise.all(EXHIBITS.map(async ex => makers[ex.type](ex)));
  for (const b of built) {
    scene.add(b.object);
    targets.push(b.object);
    if (b.collider) colliders.push(b.collider);
    if (b.media) medias.push(b.media);
    if (b.rotator) rotators.push(b.rotator);
  }
  return {
    targets,
    startMedia: () => medias.forEach(m => m.start && m.start()),
    pauseAllMedia: () => medias.forEach(m => m.pause && m.pause()),
    update: (cam, dt = 0.016, isPaused = false) => {
      if (isPaused) {
        medias.forEach(m => m.pause && m.pause());
      } else {
        medias.forEach(m => m.update && m.update(cam.position.distanceTo(m.pos)));
      }
      rotators.forEach(r => {
        r.time += dt;
        r.holder.rotation.y += dt * r.speed;
        if (r.isRing) {
          // Smooth vertical hovering bob
          r.holder.position.y = r.baseY + Math.sin(r.time * 2.2) * 0.038;
          // Subtle gyroscopic wobble
          r.holder.rotation.z = Math.sin(r.time * 1.5) * 0.06;
        }
      });
    },
  };
}
