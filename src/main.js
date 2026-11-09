import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
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
const quality = new URLSearchParams(location.search).get('q') || 'high';   // ?q=low|medium|high
const Q = {
  low: { pr: 1, bloom: false, reflector: false, shadows: false },
  medium: { pr: Math.min(devicePixelRatio, 1.5), bloom: false, reflector: true, reflectorRes: 512, shadows: true },
  high: { pr: Math.min(devicePixelRatio, 2), bloom: true, reflector: true, reflectorRes: 1024, shadows: true }
}[quality] || { pr: 1, bloom: true, reflector: true, reflectorRes: 1024, shadows: true };

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Q.pr); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
if (Q.shadows) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0c0b0a);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.42;
scene.add(new THREE.HemisphereLight(0xfff5e6, 0x241c14, 0.32));

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 120);
camera.position.set(L.spawn.pos[0], 1.6, L.spawn.pos[1]); camera.lookAt(L.spawn.lookAt[0], 1.6, L.spawn.lookAt[1]);

let composer;
if (Q.bloom) {
  composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.16, 0.65, 0.92)); composer.addPass(new OutputPass());
}

const { colliders, blockers } = buildArchitecture(scene, Q);
const exhibits = await buildExhibits(scene, colliders);
const player = createPlayer(camera, renderer.domElement, colliders);
const interaction = createInteraction({ camera, targets: exhibits.targets, blockers, controls: player.controls, prompt: $('prompt'), panel: $('panel') });
const drawMap = createMinimap($('minimap'));

$('loading').classList.add('hide');
const enterMuseum = () => { initAudio(); exhibits.startMedia(); player.controls.lock(); };
$('start').addEventListener('click', enterMuseum);
$('startBtn')?.addEventListener('click', e => { e.stopPropagation(); enterMuseum(); });
player.controls.addEventListener('lock', () => $('start').classList.add('hide'));
player.controls.addEventListener('unlock', () => { if (!interaction.isOpen()) $('start').classList.remove('hide'); });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer?.setSize(innerWidth, innerHeight);
});
window.__museum = { camera, teleport: (x, z, yaw = 0) => { camera.position.set(x, 1.6, z); camera.rotation.set(0, yaw, 0); }, colliders }; // debug hook

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  player.update(dt); interaction.update(); exhibits.update(camera); drawMap(camera);
  composer ? composer.render() : renderer.render(scene, camera);
});
