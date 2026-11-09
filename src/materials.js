import * as THREE from 'three';
const loader = new THREE.TextureLoader();
const cache = {};

function canvasTex(draw, size = 512) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const rnd = (a, b) => a + Math.random() * (b - a);

const PROC = {
  marble: () => canvasTex((g, s) => {
    g.fillStyle = '#d8d3cb'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = `rgba(90,85,80,${rnd(0.04, 0.16)})`; g.lineWidth = rnd(0.5, 2.5); g.beginPath();
      let x = rnd(0, s), y = rnd(0, s); g.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += rnd(-90, 90); y += rnd(-90, 90); g.quadraticCurveTo(x + rnd(-40, 40), y + rnd(-40, 40), x, y); }
      g.stroke();
    }
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3; g.strokeRect(0, 0, s, s); // tile seams
  }),
  parquet: () => canvasTex((g, s) => {
    const cols = 8, w = s / cols, len = s / 2;
    for (let c = 0; c < cols; c++) for (let r = 0; r < 2; r++) {
      const l = rnd(40, 58); g.fillStyle = `hsl(28,${rnd(45, 55)}%,${l - 14}%)`;
      g.fillRect(c * w, r * len + (c % 2) * len / 2 - len / 2, w - 1, len - 1);
      g.fillRect(c * w, r * len + (c % 2) * len / 2 + len / 2, w - 1, len - 1);
    }
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(30,15,5,${rnd(0.02, 0.07)})`; g.fillRect(rnd(0, s), rnd(0, s), rnd(1, 3), rnd(6, 30)); }
  }),
  plaster: color => () => canvasTex((g, s) => {
    g.fillStyle = color; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},${rnd(0.01, 0.035)})`; g.fillRect(rnd(0, s), rnd(0, s), rnd(1, 3), rnd(1, 3)); }
  }),
};

const DEFS = {
  marble:      { tex: PROC.marble, tile: 3, rough: 0.12, metal: 0.0, env: 0.9 },
  parquet:     { tex: PROC.parquet, tile: 2, rough: 0.35, metal: 0.0, env: 0.5 },
  plasterWarm: { tex: PROC.plaster('#cbb99f'), tile: 4, rough: 0.9, metal: 0, env: 0.3 },
  plasterDark: { tex: PROC.plaster('#5a3a3c'), tile: 4, rough: 0.9, metal: 0, env: 0.3 },
  plasterCool: { tex: PROC.plaster('#3d4652'), tile: 4, rough: 0.9, metal: 0, env: 0.3 },
  trim:        { tex: PROC.plaster('#e7e0d3'), tile: 2, rough: 0.6, metal: 0, env: 0.3 },
  ceiling:     { tex: PROC.plaster('#ece8e0'), tile: 4, rough: 0.95, metal: 0, env: 0.2 },
};

/** Procedural material first (always works); swaps in real PBR maps from /assets/textures/<name>/ if they exist. */
export function getMaterial(name) {
  if (cache[name]) return cache[name];
  const d = DEFS[name];
  const m = new THREE.MeshStandardMaterial({ map: d.tex(), roughness: d.rough, metalness: d.metal, envMapIntensity: d.env });
  m.userData.tile = d.tile; cache[name] = m;
  const base = `/assets/textures/${name}/`;
  const tryLoad = (file, slot, srgb) => loader.load(base + file, t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    m[slot] = t; if (slot === 'roughnessMap') m.roughness = 1; m.needsUpdate = true;
  }, undefined, () => {});
  tryLoad('diff.jpg', 'map', true); tryLoad('nor.jpg', 'normalMap', false); tryLoad('rough.jpg', 'roughnessMap', false);
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
