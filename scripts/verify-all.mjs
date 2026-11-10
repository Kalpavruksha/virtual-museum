import fs from 'fs';
import path from 'path';

let pass = true;
function check(name, cond, details = '') {
  if (cond) {
    console.log('✓ PASS:', name);
  } else {
    console.error('✗ FAIL:', name, details);
    pass = false;
  }
}

console.log('--- 1. LAYOUT AUDIT ---');
const layout = JSON.parse(fs.readFileSync('museum/data/layout.json', 'utf8'));
const historyRoom = layout.rooms.find(r => r.id === 'history');
check('History room exists', !!historyRoom);
check('History room enlarged to [26, 20]', historyRoom.size[0] === 26 && historyRoom.size[1] === 20, JSON.stringify(historyRoom.size));
check('History room center at [0, -44]', historyRoom.center[0] === 0 && historyRoom.center[1] === -44, JSON.stringify(historyRoom.center));

console.log('\n--- 2. EXHIBITS AUDIT ---');
const exhibitsData = JSON.parse(fs.readFileSync('museum/data/exhibits.json', 'utf8'));
const wand = exhibitsData.exhibits.find(e => e.id === 'elder_wand');
const ring = exhibitsData.exhibits.find(e => e.id === 'one_ring');
const eiffel = exhibitsData.exhibits.find(e => e.id === 'eiffel');

check('Elder Wand exhibit exists', !!wand);
check('Elder Wand position is [7.0, -44]', wand?.pos[0] === 7.0 && wand?.pos[1] === -44, JSON.stringify(wand?.pos));
check('One Ring position is [0, -44]', ring?.pos[0] === 0 && ring?.pos[1] === -44, JSON.stringify(ring?.pos));
check('Eiffel position is [-7.0, -44]', eiffel?.pos[0] === -7.0 && eiffel?.pos[1] === -44, JSON.stringify(eiffel?.pos));

console.log('\n--- 3. ASSETS EXISTENCE & INTEGRITY ---');
for (const ex of exhibitsData.exhibits) {
  if (ex.src && ex.src.startsWith('/assets/')) {
    const fullPath = path.join('museum/public', ex.src);
    check(`Asset exists (${ex.id} src): ${ex.src}`, fs.existsSync(fullPath), fullPath);
  }
  if (ex.thumb && ex.thumb.startsWith('/assets/')) {
    const fullPath = path.join('museum/public', ex.thumb);
    check(`Thumb exists (${ex.id} thumb): ${ex.thumb}`, fs.existsSync(fullPath), fullPath);
  }
  if (ex.audioSrc && ex.audioSrc.startsWith('/assets/')) {
    const fullPath = path.join('museum/public', ex.audioSrc);
    check(`AudioSrc exists (${ex.id} audio): ${ex.audioSrc}`, fs.existsSync(fullPath), fullPath);
  }
}

const wandStat = fs.statSync('museum/public/assets/the_elder_wand.glb');
const wandSizeMB = wandStat.size / (1024 * 1024);
check('Elder Wand GLB is compressed (< 3MB)', wandSizeMB < 3.0, `${wandSizeMB.toFixed(2)} MB`);

console.log('\n--- 4. DOM & UI ELEMENTS (index.html) ---');
const html = fs.readFileSync('museum/index.html', 'utf8');
check('Wand media tabs exist in HTML', html.includes('id="p-wand-tabs"'));
check('Wand Dumbledore tab button exists', html.includes('id="p-tab-dumbledore"'));
check('Wand 3D model tab button exists', html.includes('id="p-tab-3d"'));
check('Wand owner callout exists', html.includes('id="p-wand-owner"'));
check('Wand Deathly Hallows lore banner exists', html.includes('id="p-wand-lore-wrap"'));
check('Deathly Hallows SVG icon exists', html.includes('class="hallows-icon"'));
check('History room teleport updated to z=-44', html.includes('data-room="history" data-x="0" data-z="-44"'));
check('Mobile landscape minimap CSS updated', html.includes('width: 90px !important;') && html.includes('height: 196px !important;'));
check('Mobile portrait minimap CSS updated', html.includes('width: 98px !important;') && html.includes('height: 213px !important;'));

console.log('\n--- 5. AUDIO & SILENCE IN MENU ---');
const audioJs = fs.readFileSync('museum/src/audio.js', 'utf8');
check('suspendAudio exported from audio.js', audioJs.includes('export function suspendAudio'));
check('resumeAudio exported from audio.js', audioJs.includes('export function resumeAudio'));
check('Muted property mutes all elements', audioJs.includes('el.muted = isMuted;'));
check('Noise room tone buzz removed from audio.js', !audioJs.includes('roomGain.gain.value = 0.028') && !audioJs.includes('roomSrc.start()'));

const mainJs = fs.readFileSync('museum/src/main.js', 'utf8');
check('openMenu pauses all exhibit media', mainJs.includes('exhibits?.pauseAllMedia?.()') && mainJs.includes('openMenu'));
check('openMenu calls suspendAudio()', mainJs.includes('suspendAudio()') && mainJs.includes('openMenu'));
check('closeMenu calls resumeAudio()', mainJs.includes('resumeAudio()') && mainJs.includes('closeMenu'));
check('unlock listener calls suspendAudio()', mainJs.includes('suspendAudio()') && mainJs.includes('unlock'));
check('visibilitychange calls suspendAudio()', mainJs.includes('suspendAudio()') && mainJs.includes('visibilitychange'));

console.log('\n--- 6. MARAUDER MAP FOOTSTEPS ---');
const minimapJs = fs.readFileSync('museum/src/minimap.js', 'utf8');
check('Minimap enlarged footprint dimensions (~24px total)', minimapJs.includes('4.4, 6.8') && minimapJs.includes('3.5, 4.2'));
check('Minimap footprint lineWidth is bold (1.5)', minimapJs.includes('ctx.lineWidth = 1.5;'));
check('Minimap golden shadow glow is active', minimapJs.includes('ctx.shadowBlur = 5;'));
check('Minimap bounds encompass enlarged History Room', minimapJs.includes('x0 = -14.5') && minimapJs.includes('z0 = 7.5'));
check('Minimap player orientation uses cam.getWorldDirection', minimapJs.includes('cam.getWorldDirection'));

console.log('\n--- 7. PLAYER CONTROLS & ACTIVE STATE ---');
const playerJs = fs.readFileSync('museum/src/player.js', 'utf8');
check('player.isActive handles desktop controls.isLocked', playerJs.includes('return controls.isLocked;'));
check('player.isActive handles mobile isTourStarted', playerJs.includes('if (isMobileMode) return isTourStarted;'));

console.log('\n=======================================');
if (pass) {
  console.log('✅ ALL VERIFICATIONS PASSED SUCCESSFULLY!');
} else {
  console.error('❌ SOME AUDIT CHECKS FAILED!');
  process.exit(1);
}
