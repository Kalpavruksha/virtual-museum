import * as THREE from 'three';

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

    if (ex.type === 'image') {
      img.src = ex.src;
      img.style.display = 'block';
    } else if (ex.type === 'audio') {
      if (ex.thumb) {
        img.src = ex.thumb;
        img.style.display = 'block';
      }
      // Audio is already playing smoothly via 3D proximity at the listening station!
      // Do not restart or create overlapping audio.
      audioWrap.style.display = 'none';
    } else if (ex.type === 'video') {
      videoEl.src = ex.src;
      videoWrap.style.display = 'block';
      videoEl.play().catch(() => {});
    } else if (ex.type === 'model') {
      const thumb = ex.thumb || (ex.id === 'one_ring' ? '/assets/images/one_ring.png' : '/assets/images/eiffel.jpg');
      img.src = thumb;
      img.style.display = 'block';
      // The One Ring's violin audio is already playing smoothly via 3D proximity near the monument!
      // Do not restart audioEl on every 'E' press.
      audioWrap.style.display = 'none';
    }

    panel.classList.add('show');
  }

  function close() {
    if (!open) return;
    open = false;
    panel.classList.remove('show');

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
