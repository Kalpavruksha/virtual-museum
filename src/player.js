import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { resolve } from './geometry.js';
import { footstep } from './audio.js';

export function createPlayer(camera, dom, colliders) {
  const controls = new PointerLockControls(camera, dom);
  const keys = {}, vel = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3();
  const R = 0.35, EYE = 1.6; let bob = 0, stepDist = 0;
  addEventListener('keydown', e => { keys[e.code] = true; });
  addEventListener('keyup', e => { keys[e.code] = false; });

  function update(dt) {
    if (!controls.isLocked) { vel.set(0, 0, 0); return; }
    camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize(); right.set(-fwd.z, 0, fwd.x);
    const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const sprint = keys.ShiftLeft || keys.ShiftRight, speed = sprint ? 4.6 : 2.4;
    const wish = new THREE.Vector3().addScaledVector(fwd, f).addScaledVector(right, s);
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);
    vel.lerp(wish, Math.min(1, 9 * dt));                       // smooth acceleration
    const pos = { x: camera.position.x + vel.x * dt, z: camera.position.z + vel.z * dt };
    resolve(pos, R, colliders);                                 // walls, columns, pedestals
    const moved = Math.hypot(pos.x - camera.position.x, pos.z - camera.position.z);
    camera.position.x = pos.x; camera.position.z = pos.z;
    const spd = moved / Math.max(dt, 1e-4);
    bob += moved * (sprint ? 2.6 : 3.2);
    camera.position.y = EYE + Math.sin(bob * 2) * 0.018 * Math.min(1, spd / 2);
    const surface = (pos.z > -6 || pos.z < -34) ? 'marble' : 'parquet';
    stepDist += moved; if (stepDist > (sprint ? 1.5 : 1.05)) { stepDist = 0; footstep(sprint, surface); }
  }
  return { controls, update };
}
