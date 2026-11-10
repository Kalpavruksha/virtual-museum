import * as THREE from 'three';
import { L, EXHIBITS, room, placeOnWall } from './layout.js';

export function createMinimap(canvas) {
  const g = canvas.getContext('2d');
  const S = 5.0;
  // Bounds accommodate enlarged History Room ([-13, 13] x [-54, -34]) and Entrance Hall ([-7, 7] x [-6, 6])
  const x0 = -14.5, z0 = 7.5; // metres → px
  canvas.width = Math.round(29 * S);  // 145 px
  canvas.height = Math.round(63 * S); // 315 px

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
      return { x: p.x, z: p.z, type: ex.type, id: ex.id };
    } else if (ex.pos) {
      return { x: ex.pos[0], z: ex.pos[1], type: ex.type, id: ex.id };
    }
    return null;
  }).filter(Boolean);

  // Harry Potter Marauder's Map Footsteps Tracking System
  const footsteps = [];
  let lastStepPos = null;
  let nextFoot = 'right';
  const STEP_STRIDE = 0.42;    // Distance between footsteps (metres)
  const LATERAL_OFFSET = 0.16; // Left/right foot displacement from center path
  const MAX_STEP_AGE = 4500;   // Footstep trail duration (ms)

  // Draw authentic Marauder's Map single shoe print
  function drawMarauderFootprint(ctx, cx, cz, angle, isLeft, alpha) {
    if (alpha <= 0.02) return;
    ctx.save();
    ctx.translate(cx, cz);
    ctx.rotate(angle);

    const scale = S / 5.0;
    const ink = `rgba(235, 195, 115, ${alpha})`;
    const shadow = `rgba(32, 22, 12, ${alpha * 0.9})`;

    const toeShift = isLeft ? -0.35 * scale : 0.35 * scale;
    const toeTilt = isLeft ? -0.10 : 0.10;

    // Sole (ball & toes)
    ctx.beginPath();
    ctx.fillStyle = ink;
    ctx.strokeStyle = shadow;
    ctx.lineWidth = 0.6;
    ctx.ellipse(toeShift, -3.2 * scale, 1.8 * scale, 2.9 * scale, toeTilt, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Heel
    ctx.beginPath();
    ctx.fillStyle = ink;
    ctx.strokeStyle = shadow;
    ctx.lineWidth = 0.6;
    ctx.ellipse(0, 2.2 * scale, 1.4 * scale, 1.6 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

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
      g.fillStyle = 'rgba(232, 195, 106, 0.75)';
      g.font = '700 8.5px "Aniron", Georgia, serif';
      g.textAlign = 'center';
      g.fillText(roomLabels[r.id] || r.id, rx + rw / 2, rz + 12);
    });

    // Draw doorways connecting rooms
    L.rooms.forEach(r => {
      for (const d of r.doors || []) {
        if (d.wall === 'south') {
          const dx = X(r.center[0] + d.at - d.width / 2);
          const dz = Z(r.center[1] - r.size[1] / 2);
          g.fillStyle = 'rgba(20, 18, 15, 1)';
          g.fillRect(dx, dz - 2, d.width * S, 4);
        }
      }
    });

    // Draw exhibit markers
    exhibitDots.forEach(d => {
      const isSpecial = d.id === 'elder_wand' || d.id === 'one_ring';
      g.fillStyle = isSpecial ? '#ffd880' : (typeColors[d.type] || '#c9a84c');
      g.beginPath();
      g.arc(X(d.x), Z(d.z), isSpecial ? 2.8 : 2.2, 0, Math.PI * 2);
      g.fill();
      if (isSpecial) {
        g.strokeStyle = 'rgba(0,0,0,0.8)';
        g.lineWidth = 0.6;
        g.stroke();
      }
    });

    // Player position & orientation
    const px = cam.position.x;
    const pz = cam.position.z;
    const yaw = cam.rotation.y;
    const now = performance.now();

    // Track movement and generate Marauder's Map footsteps
    if (!lastStepPos) {
      lastStepPos = { x: px, z: pz, time: now };
    } else {
      const dist = Math.hypot(px - lastStepPos.x, pz - lastStepPos.z);
      if (dist >= STEP_STRIDE) {
        const dx = px - lastStepPos.x;
        const dz = pz - lastStepPos.z;
        // Direction angle in 2D map space (X right, Z down/south)
        const moveAngle = Math.atan2(dx, -dz);

        // Perpendicular lateral offset for left vs right foot
        const perpAngle = moveAngle + (nextFoot === 'left' ? -Math.PI / 2 : Math.PI / 2);
        const stepX = px + Math.cos(perpAngle) * LATERAL_OFFSET;
        const stepZ = pz - Math.sin(perpAngle) * LATERAL_OFFSET;

        footsteps.push({
          x: stepX,
          z: stepZ,
          angle: moveAngle,
          foot: nextFoot,
          time: now
        });

        nextFoot = (nextFoot === 'left' ? 'right' : 'left');
        lastStepPos = { x: px, z: pz, time: now };
      }
    }

    // Prune expired footsteps
    while (footsteps.length > 0 && (now - footsteps[0].time > MAX_STEP_AGE)) {
      footsteps.shift();
    }

    // Render footsteps trail
    for (const step of footsteps) {
      const age = now - step.time;
      const alpha = Math.max(0, 1 - (age / MAX_STEP_AGE)) * 0.85;
      drawMarauderFootprint(g, X(step.x), Z(step.z), step.angle, step.foot === 'left', alpha);
    }

    // Player current orientation angle on canvas
    const pCanvasAngle = -yaw;

    // Soft forward vision / torch FOV wedge
    g.save();
    g.translate(X(px), Z(pz));
    g.rotate(pCanvasAngle);
    g.fillStyle = 'rgba(232, 195, 106, 0.16)';
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, 18, -Math.PI / 2 - 0.40, -Math.PI / 2 + 0.40);
    g.closePath();
    g.fill();
    g.restore();

    // Current player standing feet
    const leftPerp = pCanvasAngle - Math.PI / 2;
    const rightPerp = pCanvasAngle + Math.PI / 2;
    const pLeftX = X(px + Math.sin(leftPerp) * 0.15);
    const pLeftZ = Z(pz + Math.cos(leftPerp) * 0.15);
    const pRightX = X(px + Math.sin(rightPerp) * 0.15);
    const pRightZ = Z(pz + Math.cos(rightPerp) * 0.15);

    drawMarauderFootprint(g, pLeftX, pLeftZ, pCanvasAngle, true, 0.95);
    drawMarauderFootprint(g, pRightX, pRightZ, pCanvasAngle, false, 0.95);

    // Marauder's Map "Visitor" parchment ribbon tag
    const tagX = X(px);
    const tagY = Z(pz) - 12;
    const tagW = 38, tagH = 11;

    g.fillStyle = 'rgba(16, 12, 8, 0.88)';
    g.strokeStyle = 'rgba(232, 195, 106, 0.75)';
    g.lineWidth = 0.8;
    g.beginPath();
    g.roundRect(tagX - tagW / 2, tagY - tagH / 2, tagW, tagH, 3);
    g.fill();
    g.stroke();

    g.fillStyle = '#ffd880';
    g.font = '600 7.5px "Aniron", Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('Visitor', tagX, tagY);
  };
}
