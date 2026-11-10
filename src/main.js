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
import { initAudio, toggleMute, isAudioMuted, setMuted, resumeAudio, suspendAudio } from './audio.js';
import {
  registerServiceWorker,
  checkAssetCache,
  preloadAndCacheAssets,
  STANDARD_ASSETS,
  HIGH_ASSETS
} from './cache.js';
import { createPerfHud } from './perf-hud.js';
import { createLightPool } from './light-pool.js';
import { downgradeMaterials } from './materials.js';

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
const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isSmallTouch = (('ontouchstart' in window) || (navigator.maxTouchPoints > 0)) && window.matchMedia && window.matchMedia('(pointer: coarse)').matches && (window.innerWidth <= 1024 || window.innerHeight <= 600);
const isMobileDevice = isMobileUA || isSmallTouch || document.documentElement.classList.contains('mobile-device');
if (isMobileDevice) {
  document.body.classList.add('is-touch-device');
}

const savedMobileExp = localStorage.getItem('museum_mobile_exp') || 'standard';
let mobileExp = savedMobileExp;

const savedQ = localStorage.getItem('museum_quality');
const urlQ = new URLSearchParams(location.search).get('q');
const defaultMobileQ = mobileExp === 'high' ? 'high' : 'low';
const qualitySetting = urlQ || savedQ || (isMobileDevice ? defaultMobileQ : 'high'); // low | medium | high | auto

function resolveQuality(setting) {
  if (setting === 'auto') {
    if (isMobileDevice) {
      return { id: 'low', pr: 1.0, bloom: false, reflector: false, shadows: false, antialias: false, lightPool: true };
    }
    return { id: 'high', pr: Math.min(window.devicePixelRatio, 1.5), bloom: true, reflector: true, reflectorRes: 512, shadows: true, antialias: true, lightPool: false };
  }
  return {
    low: { id: 'low', pr: 1.0, bloom: false, reflector: false, shadows: false, antialias: false, lightPool: true },
    medium: { id: 'medium', pr: Math.min(window.devicePixelRatio, isMobileDevice ? 1.0 : 1.25), bloom: false, reflector: false, shadows: !isMobileDevice, antialias: true, lightPool: isMobileDevice },
    high: { id: 'high', pr: Math.min(window.devicePixelRatio, isMobileDevice ? 1.15 : 2.0), bloom: !isMobileDevice, reflector: !isMobileDevice, reflectorRes: isMobileDevice ? 256 : 1024, shadows: !isMobileDevice, antialias: true, lightPool: isMobileDevice }
  }[setting] || { id: 'low', pr: 1.0, bloom: false, reflector: false, shadows: false, antialias: false, lightPool: true };
}

const Q = resolveQuality(qualitySetting);

// Update active state and bind click handlers for quality buttons
function updateQualityUI(currentQ) {
  document.querySelectorAll('.q-btn').forEach(btn => {
    if (btn.dataset.q === currentQ) btn.classList.add('active');
    else btn.classList.remove('active');
  });
  const startCurrentQBadge = $('startCurrentQBadge');
  if (startCurrentQBadge) {
    startCurrentQBadge.textContent = (currentQ || 'AUTO').toUpperCase();
  }
}
updateQualityUI(qualitySetting);

document.querySelectorAll('.q-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const newQ = btn.dataset.q;
    if (newQ && newQ !== qualitySetting) {
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
renderer.toneMappingExposure = Q.id === 'low' ? 1.05 : 0.9;
if (Q.shadows) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c0b0a);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.9;

// Natural museum hemisphere ambient lighting (soft warm skylight + rich floor bounce)
const hemiGround = Q.id === 'low' ? 0x6a5c4a : 0x241c14;
const hemiIntensity = Q.id === 'low' ? 1.6 : 0.32;
scene.add(new THREE.HemisphereLight(0xfff5e6, hemiGround, hemiIntensity));

// Low/mobile mode replaced ~38 lights with a 6-light pool, so walls and floors need real ambient fill.
// Tune live with ?amb=3 (try 1.5 to 4). Default is 3.0 for low quality mode.
const ambParam = parseFloat(new URLSearchParams(location.search).get('amb'));
const AMB = !isNaN(ambParam) ? ambParam : (Q.id === 'low' ? 3.0 : 0);
if (AMB > 0) {
  scene.add(new THREE.AmbientLight(0xfff3e2, AMB));
}

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

// Preload Aniron font before building 3D canvas signage with timeout protection
try {
  await Promise.race([
    Promise.all([document.fonts.load('bold 42px Aniron'), document.fonts.load('24px Aniron')]),
    new Promise(r => setTimeout(r, 1200))
  ]);
} catch (_) {}

const { colliders, blockers } = buildArchitecture(scene, Q);
if (Q.id === 'low') {
  downgradeMaterials(scene);
  scene.traverse(o => {
    const m = o.material;
    if (m?.isMeshLambertMaterial && m.color && !m.map) m.color.multiplyScalar(1.5);
  });
}

const lightPool = Q.lightPool ? createLightPool(scene, 6) : null;

// Wire Player with mobile tap-to-select support
let exhibits = null;
let interaction = null;

const player = createPlayer(camera, renderer.domElement, colliders, {
  onTap: (x, y) => {
    if (interaction) interaction.tapSelect(x, y);
  }
});

// Load exhibits smoothly in parallel
const exhibitsPromise = buildExhibits(scene, colliders, Q);
exhibitsPromise.then(built => {
  exhibits = built;
  if (Q.id === 'low') {
    downgradeMaterials(scene);
    scene.traverse(o => {
      const m = o.material;
      if (m?.isMeshLambertMaterial && m.color && !m.map) m.color.multiplyScalar(1.5);
    });
  }
  console.log('[Exhibits] Built successfully. spots.length =', built.allExhibitSpots?.length || 0);

  interaction = createInteraction({
    camera,
    targets: exhibits.targets,
    blockers,
    controls: player.controls,
    player,
    prompt: $('prompt'),
    panel: $('panel')
  });

  // Ensure touch and pointer events on panel are isolated from 3D controls underneath
  const doCloseInspect = e => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    interaction?.close?.();
  };
  $('p-close')?.addEventListener('click', doCloseInspect);
  $('p-close')?.addEventListener('touchend', doCloseInspect, { passive: false });
  $('p-x')?.addEventListener('click', doCloseInspect);
  $('p-x')?.addEventListener('touchend', doCloseInspect, { passive: false });

  ['touchstart', 'touchmove', 'pointerdown'].forEach(ev => {
    $('panel')?.addEventListener(ev, e => e.stopPropagation(), { passive: true });
  });

  if (document.body.classList.contains('tour-active')) {
    exhibits.startMedia();
  }
  $('loading')?.classList.add('hide');
}).catch(err => {
  console.warn('Exhibits load warning:', err);
  $('loading')?.classList.add('hide');
});

// Pre-upload textures to GPU one every 40ms during start screen to eliminate navigation stutters
exhibitsPromise.then(() => {
  const queue = [];
  scene.traverse(o => {
    const t = o.material?.map;
    if (t && !queue.includes(t)) queue.push(t);
  });
  (function next() {
    const t = queue.shift();
    if (!t) return;
    try { renderer.initTexture(t); } catch (_) {}
    setTimeout(next, 40);
  })();
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
const enterMuseum = (isTouchTrigger = false) => {
  const now = performance.now();
  if (now - lastEnterTime < 250) return;
  lastEnterTime = now;

  document.body.classList.add('tour-active');
  document.documentElement.classList.add('tour-active');

  const mg = $('mobileGateway');
  if (mg) {
    mg.classList.add('hide');
    mg.style.setProperty('display', 'none', 'important');
    mg.style.setProperty('pointer-events', 'none', 'important');
  }
  const st = $('start');
  if (st) {
    st.classList.add('hide');
    st.style.setProperty('display', 'none', 'important');
  }
  const ld = $('loading');
  if (ld) {
    ld.classList.add('hide');
    ld.style.setProperty('display', 'none', 'important');
  }

  try { player.startTour(); } catch (_) {}
  try { initAudio(); resumeAudio(); } catch (_) {}
  try { exhibits?.startMedia?.(); } catch (_) {}

  if (isMobileDevice && isTouchTrigger) {
    requestLandscape();
  } else {
    try { player.controls.lock(); } catch (_) {}
  }
};

const startEl = $('start');
const startBtn = $('startBtn');

const handleEnterClick = e => {
  e?.stopPropagation?.();
  enterMuseum(false);
};

const handleEnterTouch = e => {
  e?.stopPropagation?.();
  enterMuseum(true);
};

if (startBtn) {
  startBtn.addEventListener('click', handleEnterClick);
  startBtn.addEventListener('touchend', handleEnterTouch);
}

if (startEl) {
  startEl.addEventListener('click', handleEnterClick);
}

// --- Dedicated Mobile-Only Preload, Local Cache & Experience Engine ---
if (isMobileDevice) {
  registerServiceWorker();

  const expStandardBtn = $('expStandardBtn');
  const expHighBtn = $('expHighBtn');
  const mobileEnterBtn = $('mobileEnterBtn');
  const statusEl = $('mgStatusText');
  const pctEl = $('mgPercentText');
  const barEl = $('mgProgressBar');
  const badgeText = $('mgBadgeText');
  const badgeEl = $('mgCacheBadge');
  const enterText = $('mgEnterText');

  function updateMobileExpUI(mode) {
    if (mode === 'high') {
      expHighBtn?.classList.add('active');
      expStandardBtn?.classList.remove('active');
    } else {
      expStandardBtn?.classList.add('active');
      expHighBtn?.classList.remove('active');
    }
  }
  updateMobileExpUI(mobileExp);

  const setExperience = newExp => {
    if (newExp === mobileExp) return;
    mobileExp = newExp;
    localStorage.setItem('museum_mobile_exp', newExp);
    updateMobileExpUI(newExp);

    const targetQ = newExp === 'high' ? 'high' : 'low';
    if (qualitySetting !== targetQ) {
      localStorage.setItem('museum_quality', targetQ);
      const url = new URL(location.href);
      url.searchParams.set('q', targetQ);
      location.href = url.toString();
      return;
    }
    startMobilePreload(newExp);
  };

  expStandardBtn?.addEventListener('click', e => {
    e.stopPropagation();
    setExperience('standard');
  });
  expHighBtn?.addEventListener('click', e => {
    e.stopPropagation();
    setExperience('high');
  });

  async function startMobilePreload(mode) {
    if (mobileEnterBtn) {
      mobileEnterBtn.disabled = true;
      mobileEnterBtn.classList.remove('ready');
    }
    if (enterText) enterText.textContent = 'PREPARING GALLERIES...';

    // Step 1: Check existing cache hits in browser CacheStorage
    if (statusEl) statusEl.textContent = 'Connecting to local vault...';
    let cacheStatus = { allCached: false };
    try {
      cacheStatus = await checkAssetCache(mode);
      if (cacheStatus.allCached) {
        if (badgeText) badgeText.textContent = '⚡ Loaded from phone storage (0ms delay)';
        if (badgeEl) badgeEl.style.color = '#ffd880';
      } else {
        if (badgeText) badgeText.textContent = '⚡ Saving locally in phone cache for future visits';
        if (badgeEl) badgeEl.style.color = 'var(--gold)';
      }
    } catch (_) {}

    // Step 2: Download & Cache essential assets (fast preload with 2.5s per-asset timeout)
    try {
      await preloadAndCacheAssets({
        mode,
        onProgress: ({ current, total, url, isHit, pct }) => {
          if (barEl) barEl.style.width = pct + '%';
          if (pctEl) pctEl.textContent = pct + '%';
          const file = url.split('/').pop();
          if (statusEl) {
            statusEl.textContent = isHit ? `Vault hit: ${file}` : `Caching: ${file}`;
          }
        }
      });
    } catch (err) {
      console.warn('[Cache] Preload notice:', err);
    }

    // Step 3: Scene ready!
    if (barEl) barEl.style.width = '100%';
    if (pctEl) pctEl.textContent = '100%';
    if (statusEl) statusEl.textContent = 'Galleries ready!';
    if (badgeText) {
      badgeText.textContent = cacheStatus.allCached
        ? '⚡ Instant zero-lag reload from phone storage (0ms)'
        : '⚡ 100% Cached locally in phone storage';
      if (badgeEl) badgeEl.style.color = '#ffd880';
    }
    if (mobileEnterBtn) {
      mobileEnterBtn.disabled = false;
      mobileEnterBtn.classList.add('ready');
    }
    if (enterText) enterText.textContent = '✦ ENTER MUSEUM ✦';

    // Step 4: Pre-warm GPU shaders asynchronously without delaying the user
    setTimeout(() => {
      try {
        renderer.compile(scene, camera);
      } catch (_) {}
    }, 50);
  }

  const triggerMobileEnter = e => {
    e?.stopPropagation?.();
    enterMuseum(true);
  };
  if (mobileEnterBtn) {
    mobileEnterBtn.addEventListener('click', triggerMobileEnter);
    mobileEnterBtn.addEventListener('touchend', triggerMobileEnter);
  }

  // Safety timer: unlock enter button after 2.0s MAXIMUM so mobile users NEVER wait
  setTimeout(() => {
    if (mobileEnterBtn && mobileEnterBtn.disabled) {
      mobileEnterBtn.disabled = false;
      mobileEnterBtn.classList.add('ready');
      if (enterText) enterText.textContent = '✦ ENTER MUSEUM ✦';
      if (barEl) barEl.style.width = '100%';
      if (pctEl) pctEl.textContent = '100%';
      if (statusEl) statusEl.textContent = 'Galleries ready!';
    }
  }, 2000);

  // Kick off preload & background caching
  startMobilePreload(mobileExp);
}

// Clicking canvas while tour is active re-locks mouse cursor on desktop
renderer.domElement.addEventListener('click', () => {
  if (!player.isMobile() && !interaction?.isOpen?.() && !player.controls.isLocked) {
    try { player.controls.lock(); } catch (_) {}
  }
});

player.controls.addEventListener('lock', () => {
  document.body.classList.add('tour-active');
  document.documentElement.classList.add('tour-active');
  const startEl = $('start');
  if (startEl) {
    startEl.classList.add('hide');
    startEl.style.setProperty('display', 'none', 'important');
  }
  if (!isAudioMuted()) {
    resumeAudio();
    exhibits?.startMedia?.();
  }
});

player.controls.addEventListener('unlock', () => {
  if (!interaction?.isOpen?.()) {
    if (!player.isMobile()) {
      document.body.classList.remove('tour-active');
      document.documentElement.classList.remove('tour-active');
      const startEl = $('start');
      if (startEl) {
        startEl.classList.remove('hide');
        startEl.style.display = 'flex';
        const startTitle = $('startTitle');
        if (startTitle) startTitle.textContent = 'TOUR PAUSED';
        const startSub = $('startSub');
        if (startSub) startSub.textContent = 'Select Graphics Quality or click below to resume';
        const startBtn = $('startBtn');
        if (startBtn) startBtn.textContent = '✦ RESUME TOUR ✦';
      }
    }
    exhibits?.pauseAllMedia?.();
    suspendAudio();
  }
});

// --- Mobile Museum Menu Modal Management ---
const menuModal = $('menuModal');
const openMenu = () => {
  if (interaction?.isOpen?.()) interaction.close();
  menuModal?.classList.add('show');
  player.setModalOpen(true);
  exhibits?.pauseAllMedia?.();
  suspendAudio();
};
const closeMenu = () => {
  menuModal?.classList.remove('show');
  player.setModalOpen(false);
  if (player.isActive() && !isAudioMuted()) {
    resumeAudio();
    exhibits?.startMedia?.();
  }
};

// Pressing M on desktop toggles Museum Menu (Wings travel, sound, options)
window.addEventListener('keydown', e => {
  if (e.code === 'KeyM' && !interaction?.isOpen?.()) {
    if (menuModal?.classList.contains('show')) {
      closeMenu();
    } else {
      try { player.controls.unlock(); } catch (_) {}
      openMenu();
    }
  }
});

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

// --- Responsive Window Resize & Orientation Change (Debounced, ignores duplicate sizes) ---
let rTimer, lastW = 0, lastH = 0;
function handleResize() {
  clearTimeout(rTimer);
  rTimer = setTimeout(() => {
    const w = innerWidth, h = innerHeight;
    if (w === lastW && h === lastH) return;
    lastW = w; lastH = h;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer?.setSize(w, h);
  }, 200);
}
addEventListener('resize', handleResize);
if (window.screen?.orientation) {
  window.screen.orientation.addEventListener('change', handleResize);
}

// --- Background Tab Throttling (battery & thermal savings) ---
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    exhibits?.pauseAllMedia?.();
    suspendAudio();
  } else {
    if (player.isActive() && !isAudioMuted() && !menuModal?.classList.contains('show')) {
      resumeAudio();
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
  interaction,
  lightPool,
  getExhibits: () => exhibits
};

// Step 8: Adaptive resolution in every mode (steps 1.5 -> 0.6), ignoring the first 4s
const PR_STEPS = [1.5, 1.25, 1.0, 0.85, 0.7, 0.6];
let prIdx = Math.max(0, PR_STEPS.findIndex(v => v <= Q.pr));
let aFrames = 0, aLast = performance.now(), aLow = 0;
const aStart = aLast;

function adaptive(now) {
  if (now - aStart < 4000) return; // ignore the first seconds of uploads and compiles
  aFrames++;
  if (now - aLast < 1000) return;
  const fps = (aFrames * 1000) / (now - aLast);
  aFrames = 0; aLast = now;
  aLow = fps < 40 ? aLow + 1 : 0;
  if (aLow >= 2 && prIdx < PR_STEPS.length - 1) {
    aLow = 0; prIdx++;
    const pr = Math.min(PR_STEPS[prIdx], devicePixelRatio);
    renderer.setPixelRatio(pr);
    composer?.setPixelRatio?.(pr);
  }
}

const hud = createPerfHud(renderer, scene);

let mapT = 0, intT = 0;
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t0 = performance.now();
  const dt = Math.min(clock.getDelta(), 0.05);
  const isPaused = !player.isActive();

  player.update(dt);
  if (t0 - intT > 120) {
    interaction?.update?.();
    intT = t0;
  }
  exhibits?.update?.(camera, dt, isPaused);
  if (lightPool && exhibits) {
    lightPool.update(camera, exhibits.allExhibitSpots);
  }
  if (t0 - mapT > 40) {
    drawMap(camera);
    mapT = t0;
  }
  adaptive(t0);

  composer ? composer.render() : renderer.render(scene, camera);
  hud(performance.now() - t0);
});
