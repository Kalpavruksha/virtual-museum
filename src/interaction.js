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
      audioEl.src = ex.src;
      audioWrap.style.display = 'block';
      audioEl.play().catch(() => {});
    } else if (ex.type === 'video') {
      videoEl.src = ex.src;
      videoWrap.style.display = 'block';
      videoEl.play().catch(() => {});
    } else if (ex.type === 'model') {
      img.src = '/assets/images/vitruvian_man.jpg';
      img.style.display = 'none';
    }

    panel.classList.add('show');
  }

  function close() {
    if (!open) return;
    open = false;
    panel.classList.remove('show');

    // Pause any modal playback
    const audioEl = $('#p-audio');
    if (audioEl) { audioEl.pause(); audioEl.currentTime = 0; }
    const videoEl = $('#p-video');
    if (videoEl) { videoEl.pause(); videoEl.currentTime = 0; }

    controls.lock();
  }

  addEventListener('keydown', e => {
    if (e.code === 'KeyE') {
      if (open) close();
      else if (current) show(current.userData.exhibit);
    }
    if (e.code === 'Escape' && open) close();
  });

  $('#p-close')?.addEventListener('click', close);
  $('#p-x')?.addEventListener('click', close);

  // Clicking backdrop outside the modal card also closes it
  panel.addEventListener('click', e => {
    if (e.target === panel) close();
  });

  return { update, isOpen: () => open, close };
}
