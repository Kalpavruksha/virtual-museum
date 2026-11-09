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
import { initAudio } from './audio.js';

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
  }, 400);
};

const savedQ = localStorage.getItem('museum_quality');
const urlQ = new URLSearchParams(location.search).get('q');
const quality = urlQ || savedQ || 'high'; // ?q=low|medium|high

// Update active state and bind click handlers for quality buttons
document.querySelectorAll('.q-btn').forEach(btn => {
  if (btn.dataset.q === quality) btn.classList.add('active');
  else btn.classList.remove('active');

  btn.addEventListener('click', e => {
    e.stopPropagation();
    const newQ = btn.dataset.q;
    if (newQ !== quality) {
      localStorage.setItem('museum_quality', newQ);
      const url = new URL(location.href);
      url.searchParams.set('q', newQ);
      location.href = url.toString();
    }
  });
});
const Q = {
  low: { pr: 1, bloom: false, reflector: false, shadows: false },
  medium: { pr: Math.min(devicePixelRatio, 1.5), bloom: false, reflector: true, reflectorRes: 512, shadows: true },
  high: { pr: Math.min(devicePixelRatio, 2), bloom: true, reflector: true, reflectorRes: 1024, shadows: true }
}[quality] || { pr: 1, bloom: true, reflector: true, reflectorRes: 1024, shadows: true };

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
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
scene.environmentIntensity = 0.42;
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

const { colliders, blockers } = buildArchitecture(scene, Q);
const exhibits = await buildExhibits(scene, colliders);
const player = createPlayer(camera, renderer.domElement, colliders);
const interaction = createInteraction({
  camera,
  targets: exhibits.targets,
  blockers,
  controls: player.controls,
  prompt: $('prompt'),
  panel: $('panel')
});
const drawMap = createMinimap($('minimap'));

$('loading')?.classList.add('hide');

const enterMuseum = () => {
  initAudio();
  exhibits.startMedia();
  player.controls.lock();
};
$('start').addEventListener('click', enterMuseum);
$('startBtn')?.addEventListener('click', e => {
  e.stopPropagation();
  enterMuseum();
});
player.controls.addEventListener('lock', () => {
  $('start').classList.add('hide');
  exhibits.startMedia();
});
player.controls.addEventListener('unlock', () => {
  if (!interaction.isOpen()) {
    $('start').classList.remove('hide');
    exhibits.pauseAllMedia();
  }
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer?.setSize(innerWidth, innerHeight);
});

window.__museum = {
  camera,
  teleport: (x, z, yaw = 0) => {
    camera.position.set(x, 1.6, z);
    camera.rotation.set(0, yaw, 0);
  },
  colliders
};

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const isPaused = !player.controls.isLocked && !interaction.isOpen();
  player.update(dt);
  interaction.update();
  exhibits.update(camera, dt, isPaused);
  drawMap(camera);
  composer ? composer.render() : renderer.render(scene, camera);
});
