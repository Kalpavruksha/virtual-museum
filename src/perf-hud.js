export function createPerfHud(renderer, scene) {
  if (!new URLSearchParams(location.search).has('debug')) return () => {};
  const el = document.createElement('pre');
  el.style.cssText = 'position:fixed;left:6px;top:6px;z-index:9999;margin:0;padding:6px 8px;font:11px/1.3 monospace;color:#9f9;background:rgba(0,0,0,.65);pointer-events:none;border-radius:4px;border:1px solid rgba(153,255,153,0.3)';
  document.body.appendChild(el);
  let frames = 0, last = performance.now(), cpu = 0;
  return (frameMs) => {
    frames++; cpu += frameMs;
    const now = performance.now();
    if (now - last < 1000) return;
    const i = renderer.info;
    let lights = 0, shadows = 0;
    scene.traverse(o => { if (o.isLight) { lights++; if (o.castShadow) shadows++; } });
    el.textContent =
`fps ${frames}   cpu ${(cpu / frames).toFixed(1)} ms/frame
draw calls ${i.render.calls}   tris ${(i.render.triangles / 1000).toFixed(0)}k
geometries ${i.memory.geometries}   textures ${i.memory.textures}
lights ${lights}   shadow-casting ${shadows}
pixelRatio ${renderer.getPixelRatio().toFixed(2)}`;
    frames = 0; cpu = 0; last = now;
  };
}
