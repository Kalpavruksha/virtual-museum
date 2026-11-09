import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function createInteraction({ camera, targets, blockers, controls, player, prompt, panel }) {
  const ray = new THREE.Raycaster();
  ray.far = 4.8;
  const all = [...targets, ...blockers];
  let current = null, open = false;

  const btnInteract = document.getElementById('btnInteract');
  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.matchMedia('(pointer: coarse)').matches;

  const owner = o => {
    let cur = o;
    while (cur && !cur.userData?.exhibit) cur = cur.parent;
    return cur;
  };

  const $ = s => panel.querySelector(s);

  const roomNames = {
    hall: 'Grand Entrance Hall',
    paintings: 'Paintings Gallery',
    music: 'Music & Instruments Hall',
    history: 'History & Science Room'
  };

  // Interactive 3D Model Viewer for Inspection Modal
  let modalRenderer, modalScene, modalCamera, modalPivot, modalAnimId;
  const modelWrap = $('#p-model-wrap');
  const canvas = $('#p-canvas');

  function initModalViewer() {
    if (modalRenderer) return;
    modalRenderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    modalRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    modalRenderer.toneMappingExposure = 1.25;
    modalRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    modalScene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(modalRenderer);
    modalScene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    modalScene.environmentIntensity = 1.6;

    modalCamera = new THREE.PerspectiveCamera(45, 1, 0.05, 50);

    // Studio lighting matching Sketchfab 3D viewer
    const amb = new THREE.AmbientLight(0xfff8ee, 0.7);
    const key = new THREE.DirectionalLight(0xfff5e6, 2.8);
    key.position.set(3, 4, 3);
    const fill = new THREE.DirectionalLight(0xffffff, 1.6);
    fill.position.set(-3, 1, -2);
    const rim = new THREE.DirectionalLight(0xffeedd, 2.2);
    rim.position.set(0, 3, -4);
    const bounce = new THREE.DirectionalLight(0xdfa030, 1.2);
    bounce.position.set(0, -3, 2);
    modalScene.add(amb, key, fill, rim, bounce);

    // Interactive Drag to Rotate & Scroll to Zoom
    let dragging = false, lastX = 0, lastY = 0;
    let userInteracting = false, idleTimer = null;

    const onDown = e => {
      dragging = true;
      userInteracting = true;
      clearTimeout(idleTimer);
      lastX = e.clientX ?? (e.touches && e.touches[0].clientX) ?? 0;
      lastY = e.clientY ?? (e.touches && e.touches[0].clientY) ?? 0;
    };
    const onMove = e => {
      if (!dragging || !modalPivot) return;
      const cx = e.clientX ?? (e.touches && e.touches[0].clientX) ?? 0;
      const cy = e.clientY ?? (e.touches && e.touches[0].clientY) ?? 0;
      const dx = cx - lastX, dy = cy - lastY;
      lastX = cx; lastY = cy;
      modalPivot.rotation.y += dx * 0.01;
      modalPivot.rotation.x = THREE.MathUtils.clamp(modalPivot.rotation.x + dy * 0.01, -1.2, 1.2);
    };
    const onUp = () => {
      dragging = false;
      idleTimer = setTimeout(() => { userInteracting = false; }, 2500);
    };
    let initPinchDist = 0;
    const onTouchStartModal = e => {
      if (e.touches && e.touches.length === 2) {
        initPinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      } else {
        onDown(e);
      }
    };
    const onTouchMoveModal = e => {
      if (e.touches && e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const delta = (initPinchDist - dist) * 0.008;
        initPinchDist = dist;
        modalCamera.position.z = THREE.MathUtils.clamp(modalCamera.position.z + delta, 0.8, 5.0);
      } else {
        onMove(e);
      }
    };

    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('touchstart', onTouchStartModal, { passive: true });
    window.addEventListener('touchmove', onTouchMoveModal, { passive: true });
    window.addEventListener('touchend', onUp, { passive: true });

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      modalCamera.position.z = THREE.MathUtils.clamp(modalCamera.position.z + e.deltaY * 0.002, 0.8, 5.0);
    }, { passive: false });

    // Store interaction state for loop
    modalScene.userData = { isUserInteracting: () => userInteracting };
  }

  function startModelViewer(ex) {
    initModalViewer();
    modelWrap.style.display = 'block';

    if (modalPivot) {
      modalScene.remove(modalPivot);
      modalPivot = null;
    }

    modalPivot = new THREE.Group();
    modalScene.add(modalPivot);

    const rect = modelWrap.getBoundingClientRect();
    const w = rect.width || 360, h = rect.height || 380;
    modalRenderer.setSize(w, h, false);
    modalCamera.aspect = w / h;
    modalCamera.updateProjectionMatrix();

    const isRing = ex.id === 'one_ring';
    modalCamera.position.set(0, 0, isRing ? 2.35 : 2.6);

    const loader = new GLTFLoader();
    try {
      const draco = new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
      loader.setDRACOLoader(draco);
    } catch (_) {}

    loader.load(ex.src, gltf => {
      if (!open || !modalPivot) return;
      const m = gltf.scene;

      m.traverse(child => {
        if (child.isMesh) {
          if (isRing) {
            const geom = child.geometry;
            if (geom && geom.index && geom.index.count >= 61440) {
              geom.clearGroups();
              geom.addGroup(0, 24576, 0);     // Material 0: Rims (8,192 triangles)
              geom.addGroup(24576, 36864, 1); // Material 1: Inscription band with dark engraved lettering (12,288 triangles)

              const texLoader = new THREE.TextureLoader();
              const diffTex = texLoader.load('/assets/models/one-ring/textures/ring_bronze_diffuse.png');
              diffTex.colorSpace = THREE.SRGBColorSpace;
              diffTex.wrapS = THREE.RepeatWrapping;

              const bumpTex = texLoader.load('/assets/models/one-ring/textures/ring_engrave_bump.png');
              bumpTex.wrapS = THREE.RepeatWrapping;

              const roughTex = texLoader.load('/assets/models/one-ring/textures/ring_engrave_roughness.png');
              roughTex.wrapS = THREE.RepeatWrapping;

              // Polished bronze-gold for rims (seamless match with texture background)
              const rimMat = new THREE.MeshStandardMaterial({
                color: 0xc8963e,        // Warm polished antique bronze-gold
                metalness: 0.90,        // High metallic luster for realistic reflections
                roughness: 0.16,        // Smooth polished surface
                envMapIntensity: 2.2
              });

              // Bronze-gold band with dark engraved lettering carved into the surface
              const bandMat = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                map: diffTex,
                bumpMap: bumpTex,
                bumpScale: 0.025,       // Recessed engraved 3D depth
                roughnessMap: roughTex,
                metalness: 0.90,
                roughness: 0.16,
                envMapIntensity: 2.2
              });

              child.material = [rimMat, bandMat];
            } else if (child.material) {
              child.material.metalness = 0.90;
              child.material.roughness = 0.16;
              child.material.color.setHex(0xc8963e);
            }
          }
        }
      });

      const b = new THREE.Box3().setFromObject(m);
      const size = new THREE.Vector3();
      b.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const s = (isRing ? 0.72 : 1.6) / Math.max(maxDim, 0.001);
      m.scale.setScalar(s);

      const b2 = new THREE.Box3().setFromObject(m);
      const center = new THREE.Vector3();
      b2.getCenter(center);
      m.position.sub(center);

      if (isRing) {
        // Tilted ~22 degrees pitch down matching Sketchfab reference screenshot
        // Outer inscription and inner inscription are both immediately in clear view!
        modalPivot.rotation.x = 0.38;
        modalPivot.rotation.y = 0;
        modalPivot.rotation.z = 0;

        const ringGlow = new THREE.PointLight(0xffe29a, 2.8, 2.2, 2);
        ringGlow.position.set(0, 0, 0);
        modalPivot.add(ringGlow);
      }

      modalPivot.add(m);
    });

    cancelAnimationFrame(modalAnimId);
    const loop = () => {
      if (!open) return;
      modalAnimId = requestAnimationFrame(loop);
      if (modalPivot) {
        // Only auto-spin when user is not manually rotating to inspect
        if (!modalScene.userData?.isUserInteracting?.()) {
          modalPivot.rotation.y += 0.005;
        }
      }
      modalRenderer.render(modalScene, modalCamera);
    };
    loop();
  }

  function stopModelViewer() {
    cancelAnimationFrame(modalAnimId);
    if (modalPivot) {
      modalScene.remove(modalPivot);
      modalPivot = null;
    }
    if (modelWrap) modelWrap.style.display = 'none';
  }

  function update() {
    let found = null;
    const isControlActive = (player ? player.isActive() : controls.isLocked) && !open;

    if (isControlActive) {
      ray.setFromCamera({ x: 0, y: 0 }, camera);
      const hit = ray.intersectObjects(all, true)[0];
      if (hit) found = owner(hit.object);
    }

    if (found !== current) {
      if (current && current.userData?.highlight) current.userData.highlight.visible = false;
      if (found && found.userData?.highlight) found.userData.highlight.visible = true;
      current = found;
    }

    if (btnInteract) {
      btnInteract.classList.toggle('can-interact', !!current);
    }

    prompt.style.opacity = current ? 1 : 0;
    prompt.style.transform = current ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(8px)';
    if (current) {
      const isTouch = isTouchDevice || document.body.classList.contains('is-touch-device');
      prompt.textContent = isTouch
        ? `Tap artwork or press Interact · ${current.userData.exhibit.title}`
        : `Press E to inspect · ${current.userData.exhibit.title}`;
    }
  }

  function show(ex) {
    if (!ex) return;
    open = true;
    player?.setModalOpen?.(true);
    controls.unlock();

    $('#p-title').textContent = ex.title;
    $('#p-meta').textContent = `${ex.artist} · ${ex.year}`;
    $('#p-desc').textContent = ex.description;
    $('#p-lic').textContent = `${ex.type.toUpperCase()} · ${ex.license || 'Public Domain'}`;
    $('#p-type-badge').textContent = ex.type.toUpperCase();
    $('#p-room-badge').textContent = roomNames[ex.room] || ex.room;

    // Media element handling
    const img = $('#p-img');
    const audioWrap = $('#p-audio-wrap');
    const audioEl = $('#p-audio');
    const videoWrap = $('#p-video-wrap');
    const videoEl = $('#p-video');

    img.style.display = 'none';
    audioWrap.style.display = 'none';
    videoWrap.style.display = 'none';
    stopModelViewer();

    if (ex.type === 'image') {
      img.src = ex.src;
      img.style.display = 'block';
    } else if (ex.type === 'audio') {
      if (ex.thumb) {
        img.src = ex.thumb;
        img.style.display = 'block';
      }
      // Audio plays via 3D proximity at listening station
      audioWrap.style.display = 'none';
    } else if (ex.type === 'video') {
      videoEl.src = ex.src;
      videoWrap.style.display = 'block';
      videoEl.play().catch(() => {});
    } else if (ex.type === 'model') {
      startModelViewer(ex);
    }

    const inscrWrap = $('#p-inscription-wrap');
    if (inscrWrap) inscrWrap.style.display = (ex.id === 'one_ring') ? 'block' : 'none';

    panel.classList.add('show');
  }

  function close() {
    if (!open) return;
    open = false;
    panel.classList.remove('show');
    stopModelViewer();
    player?.setModalOpen?.(false);

    const inscrWrap = $('#p-inscription-wrap');
    if (inscrWrap) inscrWrap.style.display = 'none';

    // Pause and reset any modal playback
    const audioEl = $('#p-audio');
    if (audioEl) {
      audioEl.pause();
      audioEl.currentTime = 0;
      audioEl.removeAttribute('src');
    }
    const videoEl = $('#p-video');
    if (videoEl) {
      videoEl.pause();
      videoEl.currentTime = 0;
      videoEl.removeAttribute('src');
    }

    const isTouch = isTouchDevice || document.body.classList.contains('is-touch-device');
    if (!isTouch) {
      controls.lock();
    }
  }

  function interact() {
    if (open) {
      close();
    } else if (current) {
      show(current.userData.exhibit);
    } else {
      // Find nearest exhibit in front
      ray.setFromCamera({ x: 0, y: 0 }, camera);
      const hit = ray.intersectObjects(all, true)[0];
      if (hit) {
        const found = owner(hit.object);
        if (found) show(found.userData.exhibit);
      }
    }
  }

  function tapSelect(clientX, clientY) {
    if (open) return false;
    const mouse = {
      x: (clientX / window.innerWidth) * 2 - 1,
      y: -(clientY / window.innerHeight) * 2 + 1
    };
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(all, true)[0];
    if (hit) {
      const found = owner(hit.object);
      if (found) {
        show(found.userData.exhibit);
        return true;
      }
    }
    return false;
  }

  // Bind dedicated mobile interact button
  if (btnInteract) {
    const onInteractTap = e => {
      e.preventDefault();
      e.stopPropagation();
      interact();
    };
    btnInteract.addEventListener('touchstart', onInteractTap, { passive: false });
    btnInteract.addEventListener('click', onInteractTap);
  }

  addEventListener('keydown', e => {
    if (e.code === 'KeyE') {
      if (open) close();
      else if (current) show(current.userData.exhibit);
    }
    if ((e.code === 'Escape' || e.key === 'Escape') && open) {
      e.preventDefault();
      close();
    }
  });

  // Clicking an exhibit in focus opens it directly
  window.addEventListener('click', e => {
    if (open) return;
    if (e.target.tagName === 'BUTTON' || panel.contains(e.target) || e.target.closest('#mobileControls')) return;
    if (current) {
      show(current.userData.exhibit);
    } else {
      const mouse = {
        x: (e.clientX / innerWidth) * 2 - 1,
        y: -(e.clientY / innerHeight) * 2 + 1
      };
      ray.setFromCamera(mouse, camera);
      const hit = ray.intersectObjects(all, true)[0];
      if (hit) {
        const found = owner(hit.object);
        if (found) show(found.userData.exhibit);
      }
    }
  });

  $('#p-close')?.addEventListener('click', close);
  $('#p-x')?.addEventListener('click', close);

  // Clicking backdrop outside the modal card also closes it
  panel.addEventListener('click', e => {
    if (e.target === panel) close();
  });

  return { update, isOpen: () => open, close, show, interact, tapSelect };
}
