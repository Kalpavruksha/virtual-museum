import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const cache = {};

function canvasTex(draw, size = 512, srgb = true) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const rnd = (a, b) => a + Math.random() * (b - a);

/** Generates a seamless PBR normal map from a grayscale height generator */
function generateNormalMap(heightFn, size = 512, strength = 2.5) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  // Build height grid
  const hGrid = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      hGrid[y * size + x] = heightFn(x, y, size);
    }
  }

  // Calculate central-difference normals
  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size, yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size, xp = (x + 1) % size;
      const dx = (hGrid[y * size + xp] - hGrid[y * size + xm]) * strength;
      const dy = (hGrid[yp * size + x] - hGrid[ym * size + x]) * strength;
      const dz = 1.0;
      const len = Math.hypot(dx, dy, dz);

      const idx = (y * size + x) * 4;
      data[idx]     = Math.floor(((dx / len) * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.floor(((-dy / len) * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.floor(((dz / len) * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

const PROC = {
  marbleDiff: () => canvasTex((g, s) => {
    g.fillStyle = '#e5dfd5'; g.fillRect(0, 0, s, s);
    // Subtle marble clouds
    for (let i = 0; i < 30; i++) {
      g.fillStyle = `rgba(180,172,160,${rnd(0.04, 0.12)})`;
      g.beginPath();
      g.arc(rnd(0, s), rnd(0, s), rnd(40, 140), 0, Math.PI * 2);
      g.fill();
    }
    // Deep marble veins
    for (let i = 0; i < 48; i++) {
      g.strokeStyle = `rgba(75,70,65,${rnd(0.05, 0.2)})`;
      g.lineWidth = rnd(0.6, 2.8);
      g.beginPath();
      let x = rnd(0, s), y = rnd(0, s);
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += rnd(-80, 80); y += rnd(-80, 80);
        g.quadraticCurveTo(x + rnd(-40, 40), y + rnd(-40, 40), x, y);
      }
      g.stroke();
    }
    // Polished tile grid seams
    g.strokeStyle = 'rgba(40,36,32,0.35)'; g.lineWidth = 4; g.strokeRect(0, 0, s, s);
  }),
  marbleNor: () => generateNormalMap((x, y, s) => {
    // Bevel along tile boundary
    const edgeDist = Math.min(x, s - 1 - x, y, s - 1 - y);
    const seam = edgeDist < 6 ? edgeDist / 6 : 1.0;
    // Micro noise
    const noise = Math.sin(x * 0.05) * Math.cos(y * 0.05) * 0.08;
    return seam + noise;
  }, 512, 3.2),
  marbleRough: () => canvasTex((g, s) => {
    g.fillStyle = '#1e1e1e'; g.fillRect(0, 0, s, s); // 0.12 polished sheen
    g.strokeStyle = '#bbbbbb'; g.lineWidth = 4; g.strokeRect(0, 0, s, s); // rough grout seam
  }, 512, false),

  parquetDiff: () => canvasTex((g, s) => {
    const cols = 8, w = s / cols, len = s / 2;
    for (let c = 0; c < cols; c++) for (let r = 0; r < 2; r++) {
      const l = rnd(40, 56);
      g.fillStyle = `hsl(28,${rnd(42, 54)}%,${l - 12}%)`;
      g.fillRect(c * w, r * len + (c % 2) * len / 2 - len / 2, w - 1, len - 1);
      g.fillRect(c * w, r * len + (c % 2) * len / 2 + len / 2, w - 1, len - 1);
    }
    // Wood grain streaks
    for (let i = 0; i < 1200; i++) {
      g.fillStyle = `rgba(25,12,4,${rnd(0.02, 0.08)})`;
      g.fillRect(rnd(0, s), rnd(0, s), rnd(1, 2.5), rnd(8, 36));
    }
    // Subtle plank bevel outline
    g.strokeStyle = 'rgba(15,8,3,0.35)'; g.lineWidth = 1.5;
    for (let c = 0; c <= cols; c++) {
      g.beginPath(); g.moveTo(c * w, 0); g.lineTo(c * w, s); g.stroke();
    }
  }),
  parquetNor: () => generateNormalMap((x, y, s) => {
    const cols = 8, w = s / cols;
    const px = x % w;
    const bevel = Math.min(px, w - px) < 2 ? 0.3 : 1.0;
    const grain = Math.sin(x * 1.5) * 0.06 + Math.sin(y * 0.1) * 0.04;
    return bevel + grain;
  }, 512, 2.0),
  parquetRough: () => canvasTex((g, s) => {
    g.fillStyle = '#505050'; g.fillRect(0, 0, s, s); // ~0.32 semi-gloss
    for (let i = 0; i < 600; i++) {
      g.fillStyle = `rgba(180,180,180,${rnd(0.02, 0.06)})`;
      g.fillRect(rnd(0, s), rnd(0, s), rnd(2, 4), rnd(8, 25));
    }
  }, 512, false),

  plasterDiff: color => () => canvasTex((g, s) => {
    g.fillStyle = color; g.fillRect(0, 0, s, s);
    // Subtle stippling
    for (let i = 0; i < 8000; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${rnd(0.012, 0.04)})`;
      g.fillRect(rnd(0, s), rnd(0, s), rnd(1, 2.5), rnd(1, 2.5));
    }
  }),
  plasterNor: () => generateNormalMap((x, y) => {
    return Math.sin(x * 0.4) * Math.cos(y * 0.4) * 0.08 + Math.sin(x * 0.8 + y * 0.6) * 0.04;
  }, 512, 1.8),
  plasterRough: () => canvasTex((g, s) => {
    g.fillStyle = '#dedede'; g.fillRect(0, 0, s, s); // 0.88 matte
  }, 256, false),
};

const DEFS = {
  marble:      { diff: PROC.marbleDiff, nor: PROC.marbleNor, roughTex: PROC.marbleRough, tile: 3, rough: 0.12, metal: 0.02, env: 1.0 },
  parquet:     { diff: PROC.parquetDiff, nor: PROC.parquetNor, roughTex: PROC.parquetRough, tile: 2, rough: 0.32, metal: 0.01, env: 0.7 },
  plasterWarm: { diff: PROC.plasterDiff('#cdbba2'), nor: PROC.plasterNor, roughTex: PROC.plasterRough, tile: 4, rough: 0.9, metal: 0, env: 0.3 },
  plasterDark: { diff: PROC.plasterDiff('#563739'), nor: PROC.plasterNor, roughTex: PROC.plasterRough, tile: 4, rough: 0.9, metal: 0, env: 0.3 },
  plasterCool: { diff: PROC.plasterDiff('#39424e'), nor: PROC.plasterNor, roughTex: PROC.plasterRough, tile: 4, rough: 0.9, metal: 0, env: 0.3 },
  trim:        { diff: PROC.plasterDiff('#eae3d7'), nor: PROC.plasterNor, roughTex: PROC.plasterRough, tile: 2, rough: 0.5, metal: 0.05, env: 0.4 },
  ceiling:     { diff: PROC.plasterDiff('#ede9e2'), nor: PROC.plasterNor, roughTex: PROC.plasterRough, tile: 4, rough: 0.95, metal: 0, env: 0.2 },
};

/** Procedural PBR material first (albedo, normal, roughness); auto-swaps file PBR if present in /assets/textures/ */
export function getMaterial(name) {
  if (cache[name]) return cache[name];
  const d = DEFS[name];
  const m = new THREE.MeshStandardMaterial({
    map: d.diff(),
    normalMap: d.nor ? d.nor() : null,
    roughnessMap: d.roughTex ? d.roughTex() : null,
    roughness: d.rough,
    metalness: d.metal,
    envMapIntensity: d.env,
  });
  m.userData.tile = d.tile;
  cache[name] = m;

  // Optional local file override if user drops files into /assets/textures/<name>/
  const base = `/assets/textures/${name}/`;
  const tryLoad = (file, slot, srgb) => loader.load(base + file, t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    m[slot] = t;
    m.needsUpdate = true;
  }, undefined, () => {});
  tryLoad('diff.jpg', 'map', true);
  tryLoad('nor.jpg', 'normalMap', false);
  tryLoad('rough.jpg', 'roughnessMap', false);

  return m;
}

/** Box whose UVs are in world metres so textures never stretch. */
export function tileBox(w, h, d, tile = 2) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, nr = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const ax = Math.abs(nr.getX(i)), ay = Math.abs(nr.getY(i));
    const [su, sv] = ax > 0.5 ? [d, h] : ay > 0.5 ? [w, d] : [w, h];
    uv.setXY(i, uv.getX(i) * su / tile, uv.getY(i) * sv / tile);
  }
  return g;
}

export function tilePlane(w, h, tile = 2) {
  const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * h / tile);
  return g;
}

export function loadTexture(src, label, aspect = 1.4) {
  return new Promise(res => {
    loader.load(src, t => {
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      res({ tex: t, aspect: t.image.width / t.image.height, missing: false });
    }, undefined, () => res({ tex: labelTexture(label, 'missing: ' + src, aspect), aspect, missing: true }));
  });
}

export function labelTexture(title, sub, aspect = 1.4) {
  const c = document.createElement('canvas'); c.width = 800; c.height = Math.round(800 / aspect);
  const g = c.getContext('2d'); g.fillStyle = '#2a2622'; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#b8975a'; g.lineWidth = 6; g.strokeRect(20, 20, c.width - 40, c.height - 40);
  g.fillStyle = '#b8975a'; g.textAlign = 'center'; g.font = '40px Georgia, serif'; g.fillText(title, c.width / 2, c.height / 2 - 10, c.width - 80);
  g.font = '22px monospace'; g.fillText(sub, c.width / 2, c.height / 2 + 40, c.width - 80);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function plaqueTexture(title, artist, year) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d'); g.fillStyle = '#15130f'; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = '#b8975a'; g.lineWidth = 4; g.strokeRect(8, 8, 496, 240);
  g.textAlign = 'center'; g.fillStyle = '#e8d9b0'; g.font = 'bold 34px Georgia, serif'; g.fillText(title, 256, 90, 470);
  g.fillStyle = '#b8975a'; g.font = '28px Georgia, serif'; g.fillText(artist, 256, 150, 470);
  g.font = 'italic 26px Georgia, serif'; g.fillText(year, 256, 200, 470);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
