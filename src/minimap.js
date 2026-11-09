import { L } from './layout.js';
export function createMinimap(canvas) {
  const g = canvas.getContext('2d'), S = 6, x0 = -10, z0 = 8; // metres → px
  canvas.width = 20 * S; canvas.height = 58 * S;
  const X = x => (x - x0) * S, Z = z => (z0 - z) * S;
  return function draw(cam) {
    g.clearRect(0, 0, canvas.width, canvas.height);
    L.rooms.forEach(r => {
      const [cx, cz] = r.center, [w, d] = r.size;
      g.fillStyle = 'rgba(20,18,14,0.75)'; g.fillRect(X(cx - w / 2), Z(cz + d / 2), w * S, d * S);
      g.strokeStyle = '#b8975a'; g.lineWidth = 1.5; g.strokeRect(X(cx - w / 2), Z(cz + d / 2), w * S, d * S);
    });
    const px = X(cam.position.x), pz = Z(cam.position.z), yaw = cam.rotation.y;
    g.save(); g.translate(px, pz); g.rotate(-yaw); g.fillStyle = '#e8c36a';
    g.beginPath(); g.moveTo(0, -7); g.lineTo(4.5, 5); g.lineTo(-4.5, 5); g.closePath(); g.fill(); g.restore();
  };
}
