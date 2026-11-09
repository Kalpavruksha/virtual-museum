import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { L, EXHIBITS, room, placeOnWall } from './layout.js';
import { loadTexture, labelTexture, plaqueTexture, tileBox } from './materials.js';

const H = L.wallHeight;
const goldMat = new THREE.MeshStandardMaterial({ color: 0x9a7a35, metalness: 0.7, roughness: 0.35 });
const matteMat = new THREE.MeshStandardMaterial({ color: 0xefe8d8, roughness: 0.9 });
const pedMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1f, roughness: 0.3, metalness: 0.1 });
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
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 })
  );
  art.position.z = D / 2;
  g.add(mat, art);

  const W = w + 2 * m + 2 * fr, Hh = h + 2 * m + 2 * fr;
  for (const [bw, bh, bx, by] of [
    [W, fr, 0, (Hh - fr) / 2],
    [W, fr, 0, -(Hh - fr) / 2],
    [fr, Hh, (W - fr) / 2, 0],
    [fr, Hh, -(W - fr) / 2, 0]
  ]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, D), goldMat);
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
      update: d => { video.volume = THREE.MathUtils.clamp(1 - d / 12, 0, 1) * 0.8; },
      pos
    }
  };
}

function pedestal(scene, x, z, w, hgt) {
  const p = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, w), pedMat);
  p.position.set(x, hgt / 2, z);
  p.castShadow = true;
  p.receiveShadow = true;
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
      update: d => {
        if (!started) return;
        if (d < 8) {
          audio.volume = THREE.MathUtils.clamp((8 - d) / 6, 0, 1) * 0.85;
          if (audio.paused) audio.play().catch(() => {});
        } else if (!audio.paused) {
          audio.pause();
        }
      }
    }
  };
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

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, ex.height + 0.3, 1.1),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.15,
      roughness: 0.03,
      metalness: 0,
      depthWrite: false
    })
  );
  glass.position.set(x, ped + (ex.height + 0.3) / 2, z);
  g.add(glass);

  const holder = new THREE.Group();
  holder.position.set(x, ped + 0.02, z);
  g.add(holder);
  holder.add(proceduralEiffel(ex.height));

  const draco = new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
  new GLTFLoader().setDRACOLoader(draco).load(
    ex.src,
    gltf => {
      holder.clear();
      const m = gltf.scene;
      m.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      const b = new THREE.Box3().setFromObject(m);
      const s = ex.height / (b.max.y - b.min.y);
      m.scale.setScalar(s);
      b.setFromObject(m);
      m.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
      holder.add(m);
    },
    undefined,
    () => {}
  );

  const pl = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.35),
    new THREE.MeshStandardMaterial({ map: plaqueTexture(ex.title, ex.artist, ex.year) })
  );
  pl.position.set(x, 0.55, z + 0.602);
  g.add(pl);

  // Spotlight with soft contact shadow
  spot(g, new THREE.Vector3(x, H - 0.3, z + 0.6), new THREE.Vector3(x, ped + ex.height / 2, z), 48, true);

  const hi = highlight(1.3, ped + ex.height + 0.4, 1.3);
  hi.position.set(x, (ped + ex.height + 0.4) / 2, z);
  g.add(hi);
  g.userData = { exhibit: ex, highlight: hi };

  return { object: g, collider: box(x, z, 1.2, 1.2) };
}

export async function buildExhibits(scene, colliders) {
  const targets = [], medias = [];
  const makers = { image: frameArt, video: videoScreen, audio: audioStation, model: modelPedestal };
  const built = await Promise.all(EXHIBITS.map(async ex => makers[ex.type](ex)));
  for (const b of built) {
    scene.add(b.object);
    targets.push(b.object);
    if (b.collider) colliders.push(b.collider);
    if (b.media) medias.push(b.media);
  }
  return {
    targets,
    startMedia: () => medias.forEach(m => m.start()),
    update: cam => medias.forEach(m => m.update(cam.position.distanceTo(m.pos))),
  };
}
