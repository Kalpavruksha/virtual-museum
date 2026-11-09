import { L, EXHIBITS, room, placeOnWall } from './layout.js';

export function createMinimap(canvas) {
  const g = canvas.getContext('2d'), S = 5.2, x0 = -10, z0 = 8; // metres → px
  canvas.width = Math.round(20 * S);
  canvas.height = Math.round(58 * S);

  const X = x => (x - x0) * S;
  const Z = z => (z0 - z) * S;

  const roomLabels = {
    hall: 'Entrance',
    paintings: 'Paintings',
    music: 'Music',
    history: 'History'
  };

  const typeColors = {
    image: '#c9a84c',  // Gold
    audio: '#44ddbb',  // Cyan/Teal
    video: '#5599ff',  // Blue
    model: '#ff8844'   // Amber
  };

  // Pre-calculate exhibit map positions
  const exhibitDots = EXHIBITS.map(ex => {
    if (ex.wall) {
      const r = room(ex.room);
      const p = placeOnWall(L, r, ex.wall, ex.at, 0.2);
      return { x: p.x, z: p.z, type: ex.type };
    } else if (ex.pos) {
      return { x: ex.pos[0], z: ex.pos[1], type: ex.type };
    }
    return null;
  }).filter(Boolean);

  return function draw(cam) {
    g.clearRect(0, 0, canvas.width, canvas.height);

    // Draw rooms
    L.rooms.forEach(r => {
      const [cx, cz] = r.center, [w, d] = r.size;
      const rx = X(cx - w / 2), rz = Z(cz + d / 2), rw = w * S, rd = d * S;

      // Room floor tint
      g.fillStyle = 'rgba(20, 18, 15, 0.88)';
      g.fillRect(rx, rz, rw, rd);

      // Gold gallery border
      g.strokeStyle = 'rgba(184, 151, 90, 0.7)';
      g.lineWidth = 1.5;
      g.strokeRect(rx, rz, rw, rd);

      // Room name label
      g.fillStyle = 'rgba(232, 195, 106, 0.6)';
      g.font = '600 9px Inter, sans-serif';
      g.textAlign = 'center';
      g.fillText(roomLabels[r.id] || r.id, rx + rw / 2, rz + 13);
    });

    // Draw doorways
    L.rooms.forEach(r => {
      for (const d of r.doors || []) {
        if (d.wall === 'south') {
          const dx = X(r.center[0] + d.at - d.width / 2);
          const dz = Z(r.center[1] + r.size[1] / 2);
          g.fillStyle = 'rgba(20, 18, 15, 1)';
          g.fillRect(dx, dz - 2, d.width * S, 4);
        }
      }
    });

    // Draw exhibit markers
    exhibitDots.forEach(d => {
      g.fillStyle = typeColors[d.type] || '#c9a84c';
      g.beginPath();
      g.arc(X(d.x), Z(d.z), 2.2, 0, Math.PI * 2);
      g.fill();
    });

    // Draw player with FOV cone
    const px = X(cam.position.x), pz = Z(cam.position.z), yaw = cam.rotation.y;
    g.save();
    g.translate(px, pz);
    g.rotate(-yaw);

    // FOV wedge
    g.fillStyle = 'rgba(232, 195, 106, 0.18)';
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, 14, -Math.PI / 2 - 0.45, -Math.PI / 2 + 0.45);
    g.closePath();
    g.fill();

    // Player position marker
    g.fillStyle = '#f5dfa0';
    g.beginPath();
    g.arc(0, 0, 3, 0, Math.PI * 2);
    g.fill();

    // Direction arrow
    g.strokeStyle = '#f5dfa0';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, -6);
    g.stroke();

    g.restore();
  };
}
