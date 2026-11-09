import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { resolve } from './geometry.js';
import { footstep } from './audio.js';

export function createPlayer(camera, dom, colliders, options = {}) {
  // Ensure Euler order for clean FPS camera rotation
  camera.rotation.order = 'YXZ';

  const controls = new PointerLockControls(camera, dom);
  const keys = {};
  const vel = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const R = 0.35, EYE = 1.6;
  let bob = 0, stepDist = 0;

  // Desktop keyboard listeners
  addEventListener('keydown', e => { keys[e.code] = true; });
  addEventListener('keyup', e => { keys[e.code] = false; });

  // Mobile / Touch State
  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.matchMedia('(pointer: coarse)').matches;
  let isMobileMode = isTouchDevice;
  let isTourStarted = false;
  let isModalOpen = false;
  let isSprintActive = false;

  // Multi-Touch tracking
  let moveTouchId = null;
  let lookTouchId = null;
  let joyCenter = { x: 0, y: 0 };
  let joyVector = { x: 0, y: 0 }; // Normalized -1 to +1
  let lastLookPos = { x: 0, y: 0 };
  let lookStartPos = { x: 0, y: 0 };
  let lookStartTime = 0;

  // Tuned touch look sensitivity
  const lookSens = 0.0036;

  // DOM Elements
  const joyZone = document.getElementById('joyZone');
  const joyBase = document.getElementById('joyBase');
  const joyThumb = document.getElementById('joyThumb');
  const lookZone = document.getElementById('lookZone');
  const btnSprint = document.getElementById('btnSprint');

  if (isTouchDevice) {
    document.body.classList.add('is-touch-device');
  }

  // Helper to calculate joy base center in viewport coordinates
  function getJoyBaseCenter() {
    if (!joyBase) return { x: 80, y: window.innerHeight - 80 };
    const rect = joyBase.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  // --- Virtual Joystick Touch Handlers ---
  function handleJoyStart(touch) {
    moveTouchId = touch.identifier;
    joyCenter = getJoyBaseCenter();
    handleJoyMove(touch);
    joyBase?.classList.add('active');
  }

  function handleJoyMove(touch) {
    const dx = touch.clientX - joyCenter.x;
    const dy = touch.clientY - joyCenter.y;
    const maxR = 48;
    const dist = Math.hypot(dx, dy);
    const clampDist = Math.min(dist, maxR);
    const angle = Math.atan2(dy, dx);

    const nx = Math.cos(angle) * (clampDist / maxR);
    const ny = Math.sin(angle) * (clampDist / maxR);
    joyVector = { x: nx, y: ny };

    if (joyThumb) {
      const px = Math.cos(angle) * clampDist;
      const py = Math.sin(angle) * clampDist;
      joyThumb.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`;
    }
  }

  function handleJoyEnd() {
    moveTouchId = null;
    joyVector = { x: 0, y: 0 };
    if (joyThumb) {
      joyThumb.style.transform = 'translate(-50%, -50%)';
    }
    joyBase?.classList.remove('active');
  }

  // --- Camera Look Zone Handlers ---
  function handleLookStart(touch) {
    lookTouchId = touch.identifier;
    lastLookPos = { x: touch.clientX, y: touch.clientY };
    lookStartPos = { x: touch.clientX, y: touch.clientY };
    lookStartTime = performance.now();
  }

  function handleLookMove(touch) {
    const dx = touch.clientX - lastLookPos.x;
    const dy = touch.clientY - lastLookPos.y;
    lastLookPos = { x: touch.clientX, y: touch.clientY };

    // Apply pitch and yaw
    camera.rotation.y -= dx * lookSens;
    camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x - dy * lookSens, -1.38, 1.38);
  }

  function handleLookEnd(touch) {
    const moved = Math.hypot(touch.clientX - lookStartPos.x, touch.clientY - lookStartPos.y);
    const duration = performance.now() - lookStartTime;

    // Detect direct tap on screen (< 12px drag and < 280ms duration)
    if (moved < 12 && duration < 280 && options.onTap) {
      options.onTap(touch.clientX, touch.clientY);
    }
    lookTouchId = null;
  }

  // Bind Touch Listeners to Zones
  if (joyZone) {
    joyZone.addEventListener('touchstart', e => {
      e.preventDefault();
      isMobileMode = true;
      document.body.classList.add('is-touch-device');
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (moveTouchId === null) {
          handleJoyStart(e.changedTouches[i]);
          break;
        }
      }
    }, { passive: false });

    joyZone.addEventListener('touchmove', e => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === moveTouchId) {
          handleJoyMove(e.changedTouches[i]);
          break;
        }
      }
    }, { passive: false });

    const endJoy = e => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === moveTouchId) {
          handleJoyEnd();
          break;
        }
      }
    };
    joyZone.addEventListener('touchend', endJoy, { passive: true });
    joyZone.addEventListener('touchcancel', endJoy, { passive: true });
  }

  if (lookZone) {
    lookZone.addEventListener('touchstart', e => {
      e.preventDefault();
      isMobileMode = true;
      document.body.classList.add('is-touch-device');
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (lookTouchId === null) {
          handleLookStart(e.changedTouches[i]);
          break;
        }
      }
    }, { passive: false });

    lookZone.addEventListener('touchmove', e => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === lookTouchId) {
          handleLookMove(e.changedTouches[i]);
          break;
        }
      }
    }, { passive: false });

    const endLook = e => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === lookTouchId) {
          handleLookEnd(e.changedTouches[i]);
          break;
        }
      }
    };
    lookZone.addEventListener('touchend', endLook, { passive: true });
    lookZone.addEventListener('touchcancel', endLook, { passive: true });
  }

  // Mobile Sprint Button binding
  if (btnSprint) {
    const toggleSprint = e => {
      e.preventDefault();
      e.stopPropagation();
      isSprintActive = !isSprintActive;
      btnSprint.classList.toggle('active', isSprintActive);
    };
    btnSprint.addEventListener('touchstart', toggleSprint, { passive: false });
    btnSprint.addEventListener('click', toggleSprint);
  }

  function startTour() {
    isTourStarted = true;
    isModalOpen = false;
  }

  function setModalOpen(open) {
    isModalOpen = open;
    if (open) {
      handleJoyEnd();
      lookTouchId = null;
    }
  }

  function isActive() {
    if (isModalOpen) return false;
    return controls.isLocked || (isMobileMode && isTourStarted);
  }

  function update(dt) {
    if (!isActive()) {
      vel.set(0, 0, 0);
      return;
    }

    camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();
    right.set(-fwd.z, 0, fwd.x);

    // Keyboard Input
    let moveX = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    let moveZ = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);

    // Virtual Joystick Input (joyVector.y < 0 is pushed forward)
    if (moveTouchId !== null) {
      moveX += joyVector.x;
      moveZ -= joyVector.y;
    }

    const isRunning = keys.ShiftLeft || keys.ShiftRight || isSprintActive;
    const speed = isRunning ? 4.6 : 2.4;

    const wish = new THREE.Vector3().addScaledVector(fwd, moveZ).addScaledVector(right, moveX);
    if (wish.lengthSq() > 0) {
      if (wish.lengthSq() > 1) wish.normalize();
      wish.multiplyScalar(speed);
    }
    vel.lerp(wish, Math.min(1, 10 * dt));

    const pos = { x: camera.position.x + vel.x * dt, z: camera.position.z + vel.z * dt };
    resolve(pos, R, colliders);

    const moved = Math.hypot(pos.x - camera.position.x, pos.z - camera.position.z);
    camera.position.x = pos.x;
    camera.position.z = pos.z;

    const spd = moved / Math.max(dt, 1e-4);
    bob += moved * (isRunning ? 2.6 : 3.2);
    camera.position.y = EYE + Math.sin(bob * 2) * 0.018 * Math.min(1, spd / 2);

    const surface = (pos.z > -6 || pos.z < -34) ? 'marble' : 'parquet';
    stepDist += moved;
    if (stepDist > (isRunning ? 1.5 : 1.05)) {
      stepDist = 0;
      footstep(isRunning, surface);
    }
  }

  return {
    controls,
    update,
    startTour,
    setModalOpen,
    isActive,
    isMobile: () => isMobileMode,
    setSprint: s => { isSprintActive = !!s; btnSprint?.classList.toggle('active', isSprintActive); },
    getSprint: () => isSprintActive
  };
}
