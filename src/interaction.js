import * as THREE from 'three';

export function createInteraction({ camera, targets, blockers, controls, prompt, panel }) {
  const ray = new THREE.Raycaster(); ray.far = 4.5;
  const all = [...targets, ...blockers]; let current = null, open = false;
  const owner = o => { while (o && !o.userData.exhibit) o = o.parent; return o; };
  const $ = s => panel.querySelector(s);

  function update() {
    let found = null;
    if (controls.isLocked && !open) {
      ray.setFromCamera({ x: 0, y: 0 }, camera);
      const hit = ray.intersectObjects(all, true)[0];
      if (hit) found = owner(hit.object);
    }
    if (found !== current) {
      if (current) current.userData.highlight.visible = false;
      if (found) found.userData.highlight.visible = true;
      current = found;
    }
    prompt.style.opacity = current ? 1 : 0;
    if (current) prompt.textContent = `Press E to view · ${current.userData.exhibit.title}`;
  }
  function show(ex) {
    open = true; controls.unlock();
    $('#p-title').textContent = ex.title; $('#p-meta').textContent = `${ex.artist} · ${ex.year}`;
    $('#p-desc').textContent = ex.description; $('#p-lic').textContent = `${ex.type} · ${ex.license || ''}`;
    panel.classList.add('show');
  }
  function close() { if (!open) return; open = false; panel.classList.remove('show'); controls.lock(); }
  addEventListener('keydown', e => {
    if (e.code === 'KeyE') { if (open) close(); else if (current) show(current.userData.exhibit); }
    if (e.code === 'Escape' && open) close();
  });
  $('#p-close').addEventListener('click', close);
  return { update, isOpen: () => open, close };
}
