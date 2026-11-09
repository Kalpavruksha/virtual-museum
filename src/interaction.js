import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export function createInteraction({ camera, targets, blockers, controls, prompt, panel }) {
  const ray = new THREE.Raycaster();
  ray.far = 4.8;
  const all = [...targets, ...blockers];
  let current = null, open = false;

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
    modalRenderer.toneMappingExposure = 1.2;
    modalRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    modalScene = new THREE.Scene();
    modalCamera = new THREE.PerspectiveCamera(45, 1, 0.05, 50);

    const amb = new THREE.AmbientLight(0xfff5e6, 0.95);
    const key = new THREE.DirectionalLight(0xffeedd, 2.4);
    key.position.set(3, 4, 3);
    const fill = new THREE.DirectionalLight(0x88bbff, 1.4);
    fill.position.set(-3, -1, -2);
    const spot = new THREE.SpotLight(0xffe2a0, 4.0, 10, Math.PI / 4, 0.6);
    spot.position.set(0, 3, 2);
    modalScene.add(amb, key, fill, spot);

    // Interactive Drag to Rotate & Scroll to Zoom
    let dragging = false, lastX = 0, lastY = 0;
    const onDown = e => {
      dragging = true;
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
    const onUp = () => { dragging = false; };
    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp, { passive: true });

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      modalCamera.position.z = THREE.MathUtils.clamp(modalCamera.position.z + e.deltaY * 0.002, 0.8, 5.0);
    }, { passive: false });
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
    modalCamera.position.set(0, 0.1, isRing ? 1.5 : 2.6);

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
              geom.addGroup(0, 24576, 0);     // Material 0: Ring body
              geom.addGroup(24576, 36864, 1); // Material 1: The Words / Inscription

              const texLoader = new THREE.TextureLoader();
              const fieryTex = texLoader.load('/assets/models/one-ring/textures/one_ring_inscription_fiery.png');
              fieryTex.colorSpace = THREE.SRGBColorSpace;
              fieryTex.wrapS = THREE.RepeatWrapping;

              const bodyMat = new THREE.MeshStandardMaterial({
                color: 0xdfaf37,
                metalness: 0.95,
                roughness: 0.12,
                envMapIntensity: 2.5
              });

              const runeMat = new THREE.MeshStandardMaterial({
                color: 0xff3b00,
                emissive: 0xff4500,
                emissiveIntensity: 4.8, // Bright glowing fiery runes in 3D close-up viewer
                emissiveMap: fieryTex,
                map: fieryTex,
                metalness: 0.2,
                roughness: 0.2
              });

              child.material = [bodyMat, runeMat];
            }
          }
        }
      });

      const b = new THREE.Box3().setFromObject(m);
      const size = new THREE.Vector3();
      b.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const s = (isRing ? 0.95 : 1.6) / Math.max(maxDim, 0.001);
      m.scale.setScalar(s);

      const b2 = new THREE.Box3().setFromObject(m);
      const center = new THREE.Vector3();
      b2.getCenter(center);
      m.position.sub(center);

      if (isRing) {
        modalPivot.rotation.x = 0.48; // Angle fiery runes toward viewer
        const ringGlow = new THREE.PointLight(0xff6600, 4.0, 2.5, 2);
        modalPivot.add(ringGlow);
      }

      modalPivot.add(m);
    });

    cancelAnimationFrame(modalAnimId);
    const loop = () => {
      if (!open) return;
      modalAnimId = requestAnimationFrame(loop);
      if (modalPivot) {
        modalPivot.rotation.y += 0.007; // gentle continuous rotation
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
    if (controls.isLocked && !open) {
      ray.setFromCamera({ x: 0, y: 0 }, camera);
      const hit = ray.intersectObjects(all, true)[0];
      if (hit) found = owner(hit.object);
    }
    if (found !== current) {
      if (current && current.userData?.highlight) current.userData.highlight.visible = false;
      if (found && found.userData?.highlight) found.userData.highlight.visible = true;
      current = found;
    }
    prompt.style.opacity = current ? 1 : 0;
    prompt.style.transform = current ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(8px)';
    if (current) {
      prompt.textContent = `Press E to inspect · ${current.userData.exhibit.title}`;
    }
  }

  function show(ex) {
    open = true;
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
      // Audio is already playing smoothly via 3D proximity at the listening station!
      audioWrap.style.display = 'none';
    } else if (ex.type === 'video') {
      videoEl.src = ex.src;
      videoWrap.style.display = 'block';
      videoEl.play().catch(() => {});
    } else if (ex.type === 'model') {
      // Show the ACTUAL interactive 3D model in the modal!
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

    controls.lock();
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
    if (e.target.tagName === 'BUTTON' || panel.contains(e.target)) return;
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

  return { update, isOpen: () => open, close };
}
