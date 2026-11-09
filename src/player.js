import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { resolve } from './geometry.js';
import { footstep } from './audio.js';

export function createPlayer(camera, dom, colliders) {
  const controls = new PointerLockControls(camera, dom);
  const keys = {}, vel = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3();
  const R = 0.35, EYE = 1.6;
  let bob = 0, stepDist = 0;

  addEventListener('keydown', e => { keys[e.code] = true; });
  addEventListener('keyup', e => { keys[e.code] = false; });

  // Touch / Mobile Input Handling
  let moveTouchId = null, lookTouchId = null;
  let joyOrigin = { x: 0, y: 0 }, joyOffset = { x: 0, y: 0 };
  let lastLookPos = { x: 0, y: 0 };
  let isMobileTouch = false;

  const joyBase = document.getElementById('joyBase');
  const joyThumb = document.getElementById('joyThumb');
  const showJoy = (x, y) => {
    if (!joyBase) return;
    joyBase.style.left = `${x}px`;
    joyBase.style.top = `${y}px`;
    joyBase.style.display = 'block';
    if (joyThumb) joyThumb.style.transform = 'translate(-50%, -50%)';
  };
  const updateJoy = (ox, oy, maxRadius = 45) => {
    if (!joyThumb) return;
    joyThumb.style.transform = `translate(calc(-50% + ${ox * maxRadius}px), calc(-50% + ${oy * maxRadius}px))`;
  };
  const hideJoy = () => {
    if (joyBase) joyBase.style.display = 'none';
  };

  dom.addEventListener('touchstart', e => {
    isMobileTouch = true;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.clientX < window.innerWidth / 2 && moveTouchId === null) {
        moveTouchId = t.identifier;
        joyOrigin = { x: t.clientX, y: t.clientY };
        joyOffset = { x: 0, y: 0 };
        showJoy(t.clientX, t.clientY);
      } else if (t.clientX >= window.innerWidth / 2 && lookTouchId === null) {
        lookTouchId = t.identifier;
        lastLookPos = { x: t.clientX, y: t.clientY };
      }
    }
  }, { passive: true });

  dom.addEventListener('touchmove', e => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === moveTouchId) {
        const dx = t.clientX - joyOrigin.x;
        const dy = t.clientY - joyOrigin.y;
        const maxRadius = 45;
        const dist = Math.hypot(dx, dy);
        const clampDist = Math.min(dist, maxRadius);
        const angle = Math.atan2(dy, dx);
        joyOffset = {
          x: (Math.cos(angle) * clampDist) / maxRadius,
          y: (Math.sin(angle) * clampDist) / maxRadius
        };
        updateJoy(joyOffset.x, joyOffset.y, maxRadius);
      } else if (t.identifier === lookTouchId) {
        const dx = t.clientX - lastLookPos.x;
        const dy = t.clientY - lastLookPos.y;
        lastLookPos = { x: t.clientX, y: t.clientY };

        // Pitch & Yaw for touch look
        camera.rotation.y -= dx * 0.0032;
        camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x - dy * 0.0032, -1.35, 1.35);
      }
    }
  }, { passive: true });

  const endTouch = e => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === moveTouchId) {
        moveTouchId = null;
        joyOffset = { x: 0, y: 0 };
        hideJoy();
      } else if (t.identifier === lookTouchId) {
        lookTouchId = null;
      }
    }
  };
  dom.addEventListener('touchend', endTouch, { passive: true });
  dom.addEventListener('touchcancel', endTouch, { passive: true });

  function update(dt) {
    const isControlActive = controls.isLocked || isMobileTouch;
    if (!isControlActive) {
      vel.set(0, 0, 0);
      return;
    }

    camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();
    right.set(-fwd.z, 0, fwd.x);

    // Combine keyboard and virtual touch joystick
    const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - joyOffset.y;
    const s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joyOffset.x;
    const sprint = keys.ShiftLeft || keys.ShiftRight;
    const speed = sprint ? 4.6 : 2.4;

    const wish = new THREE.Vector3().addScaledVector(fwd, f).addScaledVector(right, s);
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);
    vel.lerp(wish, Math.min(1, 9 * dt));

    const pos = { x: camera.position.x + vel.x * dt, z: camera.position.z + vel.z * dt };
    resolve(pos, R, colliders);

    const moved = Math.hypot(pos.x - camera.position.x, pos.z - camera.position.z);
    camera.position.x = pos.x;
    camera.position.z = pos.z;

    const spd = moved / Math.max(dt, 1e-4);
    bob += moved * (sprint ? 2.6 : 3.2);
    camera.position.y = EYE + Math.sin(bob * 2) * 0.018 * Math.min(1, spd / 2);

    const surface = (pos.z > -6 || pos.z < -34) ? 'marble' : 'parquet';
    stepDist += moved;
    if (stepDist > (sprint ? 1.5 : 1.05)) {
      stepDist = 0;
      footstep(sprint, surface);
    }
  }

  return { controls, update };
}
