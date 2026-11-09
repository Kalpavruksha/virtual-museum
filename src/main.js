import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { L, allColliders } from './layout.js';
import { buildArchitecture } from './architecture.js';
import { buildExhibits } from './exhibits.js';
import { createPlayer } from './player.js';
import { createInteraction } from './interaction.js';
import { createMinimap } from './minimap.js';
import { initAudio, toggleMute, isAudioMuted, setMuted, resumeAudio } from './audio.js';

const $ = id => document.getElementById(id);

// Real LoadingManager progress tracking
const loadingBar = $('loadingBar');
const loadingText = $('loadingText');
THREE.DefaultLoadingManager.onProgress = (url, loaded, total) => {
  const pct = Math.min(100, Math.round((loaded / total) * 100));
  if (loadingBar) loadingBar.style.width = pct + '%';
  if (loadingText) loadingText.textContent = `Preparing the galleries · ${pct}%`;
};
THREE.DefaultLoadingManager.onLoad = () => {
  setTimeout(() => {
    $('loading')?.classList.add('hide');
  }, 200);
};
THREE.DefaultLoadingManager.onError = url => {
  console.warn('Asset loading warning:', url);
};

// Safety timeout: never freeze loading screen for more than 1.8s
setTimeout(() => {
  $('loading')?.classList.add('hide');
}, 1800);

// Tapping loading screen directly bypasses it
$('loading')?.addEventListener('pointerdown', () => $('loading')?.classList.add('hide'));
$('loading')?.addEventListener('touchstart', () => $('loading')?.classList.add('hide'), { passive: true });

// Device & Hardware Capability Detection
const isMobileDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.matchMedia('(pointer: coarse)').matches;
if (isMobileDevice) {
  document.body.classList.add('is-touch-device');
}

const savedQ = localStorage.getItem('museum_quality');
const urlQ = new URLSearchParams(location.search).get('q');
const qualitySetting = urlQ || savedQ || (isMobileDevice ? 'auto' : 'high'); // low | medium | high | auto

function resolveQuality(setting) {
  if (setting === 'auto') {
    if (isMobileDevice) {
      return { id: 'low', pr: 1.0, bloom: false, reflector: false, shadows: false, antialias: false };
    }
    return { id: 'high', pr: Math.min(window.devicePixelRatio, 1.5), bloom: true, reflector: true, reflectorRes: 512, shadows: true, antialias: true };
  }
  return {
    low: { id: 'low', pr: 1.0, bloom: false, reflector: false, shadows: false, antialias: false },
    medium: { id: 'medium', pr: Math.min(window.devicePixelRatio, 1.25), bloom: false, reflector: false, shadows: true, antialias: true },
    high: { id: 'high', pr: Math.min(window.devicePixelRatio, isMobileDevice ? 1.5 : 2.0), bloom: true, reflector: true, reflectorRes: isMobileDevice ? 512 : 1024, shadows: true, antialias: true }
  }[setting] || { id: 'low', pr: 1.0, bloom: false, reflector: false, shadows: false, antialias: false };
}

const Q = resolveQuality(qualitySetting);

// Update active state and bind click handlers for quality buttons
function updateQualityUI(currentQ) {
  document.querySelectorAll('.q-btn').forEach(btn => {
    if (btn.dataset.q === currentQ) btn.classList.add('active');
    else btn.classList.remove('active');
  });
}
updateQualityUI(qualitySetting);

document.querySelectorAll('.q-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const newQ = btn.dataset.q;
    if (newQ !== qualitySetting) {
      localStorage.setItem('museum_quality', newQ);
      const url = new URL(location.href);
      url.searchParams.set('q', newQ);
      location.href = url.toString();
    }
  });
});

const renderer = new THREE.WebGLRenderer({ antialias: Q.antialias !== false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Q.pr);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
if (Q.shadows) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c0b0a);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.9;
scene.add(new THREE.HemisphereLight(0xfff5e6, 0x241c14, 0.32));

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 120);
camera.position.set(L.spawn.pos[0], 1.6, L.spawn.pos[1]);
camera.lookAt(L.spawn.lookAt[0], 1.6, L.spawn.lookAt[1]);

// Cinematic Vignette Shader
const VignetteShader = {
  name: 'VignetteShader',
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: 1.05 },
    darkness: { value: 1.15 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float offset;
    uniform float darkness;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
      float dist = dot(uv, uv);
      color.rgb *= clamp(1.0 - dist * darkness, 0.0, 1.0);
      gl_FragColor = color;
    }
  `
};

let composer;
if (Q.bloom) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.15, 0.65, 0.92));
  composer.addPass(new ShaderPass(VignetteShader));
  composer.addPass(new OutputPass());
}

// Preload Aniron font before building 3D canvas signage
try {
  await document.fonts.load('bold 42px Aniron');
  await document.fonts.load('24px Aniron');
} catch (_) {}

const { colliders, blockers } = buildArchitecture(scene, Q);

// Wire Player with mobile tap-to-select support
let exhibits = null;
let interaction = null;

const player = createPlayer(camera, renderer.domElement, colliders, {
  onTap: (x, y) => {
    if (interaction) interaction.tapSelect(x, y);
  }
});

// Load exhibits smoothly in parallel
buildExhibits(scene, colliders).then(built => {
  exhibits = built;
  interaction = createInteraction({
    camera,
    targets: exhibits.targets,
    blockers,
    controls: player.controls,
    player,
    prompt: $('prompt'),
    panel: $('panel')
  });
  if (isEntered) {
    exhibits.startMedia();
  }
  $('loading')?.classList.add('hide');
}).catch(err => {
  console.warn('Exhibits load warning:', err);
  $('loading')?.classList.add('hide');
});

const drawMap = createMinimap($('minimap'));

// Adapt Start Screen text for mobile vs desktop immediately
if (isMobileDevice) {
  const startBtn = $('startBtn');
  if (startBtn) startBtn.textContent = 'Tap to enter';
  const keysEl = document.querySelector('.keys');
  if (keysEl) keysEl.textContent = 'Left joystick move · Drag right look · Tap or Interact to inspect';
}

const requestLandscape = async () => {
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    }
  } catch (_) {}
  try {
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock('landscape');
    }
  } catch (_) {}
};

const handleForceLandscape = async e => {
  e?.preventDefault?.();
  e?.stopPropagation?.();
  document.documentElement.classList.add('rotate-dismissed');
  await requestLandscape();
};

const handleDismissRotate = e => {
  e?.preventDefault?.();
  e?.stopPropagation?.();
  document.documentElement.classList.add('rotate-dismissed');
};

const btnForceLandscape = $('btnForceLandscape');
if (btnForceLandscape) {
  btnForceLandscape.addEventListener('pointerdown', handleForceLandscape);
  btnForceLandscape.addEventListener('touchstart', handleForceLandscape, { passive: false });
  btnForceLandscape.addEventListener('click', handleForceLandscape);
}

const btnDismissRotate = $('btnDismissRotate');
if (btnDismissRotate) {
  btnDismissRotate.addEventListener('pointerdown', handleDismissRotate);
  btnDismissRotate.addEventListener('touchstart', handleDismissRotate, { passive: false });
  btnDismissRotate.addEventListener('click', handleDismissRotate);
}

let lastEnterTime = 0;
const enterMuseum = () => {
  const now = performance.now();
  if (now - lastEnterTime < 250) return;
  lastEnterTime = now;

  document.body.classList.add('tour-active');
  $('loading')?.classList.add('hide');
  $('start')?.classList.add('hide');

  try { player.startTour(); } catch (_) {}
  try { initAudio(); resumeAudio(); } catch (_) {}
  try { exhibits?.startMedia?.(); } catch (_) {}

  if (isMobileDevice) {
    requestLandscape();
  } else {
    try { player.controls.lock(); } catch (_) {}
  }
};

const startEl = $('start');
const startBtn = $('startBtn');

const handleEnter = e => {
  e?.stopPropagation?.();
  enterMuseum();
};

if (startBtn) {
  startBtn.addEventListener('click', handleEnter);
  startBtn.addEventListener('touchstart', handleEnter, { passive: true });
}

if (startEl) {
  startEl.addEventListener('click', handleEnter);
  startEl.addEventListener('touchstart', e => {
    if (e.target === startEl || e.target.closest('#startBtn')) {
      handleEnter(e);
    }
  }, { passive: true });
}

player.controls.addEventListener('lock', () => {
  document.body.classList.add('tour-active');
  $('start').classList.add('hide');
  exhibits?.startMedia?.();
});

player.controls.addEventListener('unlock', () => {
  if (!interaction?.isOpen?.() && !player.isMobile()) {
    document.body.classList.remove('tour-active');
    $('start').classList.remove('hide');
    exhibits?.pauseAllMedia?.();
  }
});

// --- Mobile Museum Menu Modal Management ---
const menuModal = $('menuModal');
const openMenu = () => {
  if (interaction?.isOpen?.()) interaction.close();
  menuModal?.classList.add('show');
  player.setModalOpen(true);
};
const closeMenu = () => {
  menuModal?.classList.remove('show');
  player.setModalOpen(false);
};

$('btnMenu')?.addEventListener('click', e => {
  e.stopPropagation();
  openMenu();
});
$('menuCloseBtn')?.addEventListener('click', closeMenu);
$('menuResumeBtn')?.addEventListener('click', closeMenu);
menuModal?.addEventListener('click', e => {
  if (e.target === menuModal) closeMenu();
});

// Teleport buttons inside Museum Menu
document.querySelectorAll('.teleport-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const x = parseFloat(btn.dataset.x) || 0;
    const z = parseFloat(btn.dataset.z) || 0;
    const yaw = parseFloat(btn.dataset.yaw) || 0;
    camera.position.set(x, 1.6, z);
    camera.rotation.set(0, yaw, 0);
    closeMenu();
  });
});

// --- Sound Controls ---
function updateSoundUI() {
  const muted = isAudioMuted();
  const icon = muted ? '🔇' : '🔊';
  const soundIcon = $('soundIcon');
  if (soundIcon) soundIcon.textContent = icon;
  const menuSoundBtn = $('menuSoundBtn');
  if (menuSoundBtn) menuSoundBtn.innerHTML = `<span>${icon}</span> Sound: ${muted ? 'OFF' : 'ON'}`;
}

const handleSoundToggle = e => {
  e?.stopPropagation();
  toggleMute();
  updateSoundUI();
};
$('btnSound')?.addEventListener('click', handleSoundToggle);
$('menuSoundBtn')?.addEventListener('click', handleSoundToggle);

// --- Fullscreen Controls ---
function updateFsUI() {
  const isFs = !!document.fullscreenElement;
  const fsIcon = $('fsIcon');
  if (fsIcon) fsIcon.textContent = isFs ? '✕' : '⛶';
  const menuFsBtn = $('menuFsBtn');
  if (menuFsBtn) menuFsBtn.innerHTML = `<span>${isFs ? '✕' : '⛶'}</span> Fullscreen: ${isFs ? 'ON' : 'OFF'}`;
}

const handleFsToggle = e => {
  e?.stopPropagation();
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
};
$('btnFullscreen')?.addEventListener('click', handleFsToggle);
$('menuFsBtn')?.addEventListener('click', handleFsToggle);
document.addEventListener('fullscreenchange', updateFsUI);

// --- Responsive Window Resize & Orientation Change ---
function handleResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer?.setSize(innerWidth, innerHeight);
}
addEventListener('resize', handleResize);
addEventListener('orientationchange', () => {
  setTimeout(handleResize, 100);
  setTimeout(handleResize, 300);
});
if (window.screen?.orientation) {
  window.screen.orientation.addEventListener('change', () => {
    setTimeout(handleResize, 100);
    setTimeout(handleResize, 300);
  });
}

// --- Background Tab Throttling (battery & thermal savings) ---
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    exhibits?.pauseAllMedia?.();
  } else {
    resumeAudio();
    if (player.isActive()) {
      exhibits?.startMedia?.();
    }
  }
});

// Expose for testing & debug
window.__museum = {
  camera,
  teleport: (x, z, yaw = 0) => {
    camera.position.set(x, 1.6, z);
    camera.rotation.set(0, yaw, 0);
  },
  colliders,
  player,
  interaction
};

// Adaptive performance measurement
let frameCount = 0;
let lastFpsCheck = performance.now();
const fpsHistory = [];

function monitorAdaptivePerformance() {
  if (qualitySetting !== 'auto') return;
  frameCount++;
  const now = performance.now();
  if (now - lastFpsCheck >= 1000) {
    const fps = Math.round((frameCount * 1000) / (now - lastFpsCheck));
    frameCount = 0;
    lastFpsCheck = now;
    fpsHistory.push(fps);
    if (fpsHistory.length > 3) fpsHistory.shift();

    const avgFps = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;
    if (avgFps < 28 && renderer.getPixelRatio() > 1.0) {
      renderer.setPixelRatio(1.0);
    }
  }
}

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const isPaused = !player.isActive();

  player.update(dt);
  interaction?.update?.();
  exhibits?.update?.(camera, dt, isPaused);
  drawMap(camera);
  monitorAdaptivePerformance();

  composer ? composer.render() : renderer.render(scene, camera);
});
