import * as THREE from 'three';

export function createLightPool(scene, size = 6) {
  const lights = Array.from({ length: size }, () => {
    const l = new THREE.SpotLight(0xfff2dd, 0, 18, Math.PI / 3, 0.85, 2);
    l.castShadow = false;
    scene.add(l, l.target);
    return l;
  });
  let tick = 0;
  return {
    lights,
    // spots = [{ pos: Vector3, target: Vector3, intensity }], built once from exhibits
    update(camera, spots) {
      if (!spots || spots.length === 0) return;
      if (tick++ % 10) return; // about 6 times per second is plenty
      const nearest = spots
        .map(s => ({ s, d: s.pos.distanceToSquared(camera.position) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, size);
      lights.forEach((l, i) => {
        const s = nearest[i]?.s;
        if (!s) {
          l.intensity = 0;
          return;
        }
        l.position.copy(s.pos);
        l.target.position.copy(s.target);
        // Slightly boosted intensity so painting areas clearly stand out against ambient light
        l.intensity = s.intensity * 1.15;
      });
    },
  };
}
