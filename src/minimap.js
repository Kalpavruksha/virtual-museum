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
  let lastStepCanvasX = null, lastStepCanvasY = null;
  let nextFoot = 'right';
  const STEP_STRIDE_PX = 4.2;   // Stride in canvas px (~0.84 metres)
  const FOOT_SPREAD_PX = 3.6;   // Lateral spacing between left and right feet in canvas px
  const MAX_STEP_AGE = 5500;    // Footstep trail duration (ms)
  const camDir = new THREE.Vector3();

  // Draw authentic Harry Potter Marauder's Map shoe print (large, bold & vibrant)
  function drawMarauderFootprint(ctx, cx, cz, angle, isLeft, alpha) {
    if (alpha <= 0.02) return;
    ctx.save();
    ctx.translate(cx, cz);
    ctx.rotate(angle);

    const ink = `rgba(255, 220, 125, ${alpha})`;
    const rim = `rgba(32, 16, 6, ${Math.min(1, alpha * 1.2)})`;

    const toeShift = isLeft ? -1.0 : 1.0;
    const toeTilt = isLeft ? -0.14 : 0.14;

    // Golden parchment luminous glow for high visibility on dark floors
    ctx.shadowColor = `rgba(255, 215, 90, ${alpha * 0.75})`;
    ctx.shadowBlur = 5;

    // Sole (ball of foot & toes) - ~14px long x 9px wide
    ctx.beginPath();
    ctx.fillStyle = ink;
    ctx.strokeStyle = rim;
    ctx.lineWidth = 1.5;
    ctx.ellipse(toeShift, -7.2, 4.4, 6.8, toeTilt, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Heel - ~8px long x 7px wide
    ctx.beginPath();
    ctx.fillStyle = ink;
    ctx.strokeStyle = rim;
    ctx.lineWidth = 1.5;
    ctx.ellipse(0, 5.4, 3.5, 4.2, 0, 0, Math.PI * 2);
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

    // Current player position in canvas pixels
    const pCanvasX = X(cam.position.x);
    const pCanvasY = Z(cam.position.z);
    const now = performance.now();

    // Track movement and generate Marauder's Map footsteps
    if (lastStepCanvasX === null) {
      lastStepCanvasX = pCanvasX;
      lastStepCanvasY = pCanvasY;
    } else {
      const cdx = pCanvasX - lastStepCanvasX;
      const cdy = pCanvasY - lastStepCanvasY;
      const dist = Math.hypot(cdx, cdy);

      if (dist >= STEP_STRIDE_PX) {
        // Angle pointing along movement direction on canvas
        const moveAngle = Math.atan2(cdx, -cdy);

        // Perpendicular offset for alternating left vs right foot
        const perpX = Math.cos(moveAngle);
        const perpY = Math.sin(moveAngle);
        const sideMult = nextFoot === 'left' ? -1 : 1;

        const stepX = pCanvasX + perpX * (FOOT_SPREAD_PX * sideMult);
        const stepY = pCanvasY + perpY * (FOOT_SPREAD_PX * sideMult);

        footsteps.push({
          x: stepX,
          y: stepY,
          angle: moveAngle,
          foot: nextFoot,
          time: now
        });

        nextFoot = (nextFoot === 'left' ? 'right' : 'left');
        lastStepCanvasX = pCanvasX;
        lastStepCanvasY = pCanvasY;
      }
    }

    // Prune expired footsteps
    while (footsteps.length > 0 && (now - footsteps[0].time > MAX_STEP_AGE)) {
      footsteps.shift();
    }

    // Render footsteps trail
    for (const step of footsteps) {
      const age = now - step.time;
      const alpha = Math.max(0, 1 - (age / MAX_STEP_AGE)) * 0.90;
      drawMarauderFootprint(g, step.x, step.y, step.angle, step.foot === 'left', alpha);
    }

    // Camera forward vector in 3D mapped to canvas orientation
    cam.getWorldDirection(camDir);
    const playerAngle = Math.atan2(camDir.x, camDir.z);

    // Soft forward vision / torch FOV wedge
    g.save();
    g.translate(pCanvasX, pCanvasY);
    g.rotate(playerAngle);
    g.fillStyle = 'rgba(232, 195, 106, 0.18)';
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, 22, -Math.PI / 2 - 0.42, -Math.PI / 2 + 0.42);
    g.closePath();
    g.fill();
    g.restore();

    // Current player standing feet
    const perpX = Math.cos(playerAngle);
    const perpY = Math.sin(playerAngle);
    const pLeftX = pCanvasX - perpX * FOOT_SPREAD_PX;
    const pLeftY = pCanvasY - perpY * FOOT_SPREAD_PX;
    const pRightX = pCanvasX + perpX * FOOT_SPREAD_PX;
    const pRightY = pCanvasY + perpY * FOOT_SPREAD_PX;

    drawMarauderFootprint(g, pLeftX, pLeftY, playerAngle, true, 1.0);
    drawMarauderFootprint(g, pRightX, pRightY, playerAngle, false, 1.0);

    // Marauder's Map "Visitor" parchment ribbon tag
    const tagX = pCanvasX;
    const tagY = pCanvasY - 18;
    const tagW = 44, tagH = 13;

    g.save();
    g.shadowColor = 'rgba(232, 195, 106, 0.45)';
    g.shadowBlur = 6;
    g.fillStyle = 'rgba(16, 12, 8, 0.92)';
    g.strokeStyle = 'rgba(232, 195, 106, 0.85)';
    g.lineWidth = 1.0;
    g.beginPath();
    g.roundRect(tagX - tagW / 2, tagY - tagH / 2, tagW, tagH, 3);
    g.fill();
    g.stroke();
    g.restore();

    g.fillStyle = '#ffd880';
    g.font = '700 8px "Aniron", Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('Visitor', tagX, tagY);
  };
}
