// WebAudio helper: synthesised architectural footsteps, surface acoustics, and silent gallery background.
let ctx, master, noiseBuf;
let isMuted = false;
let normalVolume = 0.65;

export function initAudio() {
  if (ctx) {
    if (!isMuted) resumeAudio();
    return;
  }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = isMuted ? 0 : normalVolume;
  master.connect(ctx.destination);

  // Generate 1 second of white noise buffer for realistic dynamic footstep synthesis
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  if (isMuted) {
    suspendAudio();
  }
}

export function suspendAudio() {
  if (ctx && ctx.state === 'running') {
    ctx.suspend().catch(() => {});
  }
}

export function resumeAudio() {
  if (isMuted) return;
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

export function setMuted(muted) {
  isMuted = !!muted;
  if (master && ctx) {
    master.gain.setValueAtTime(isMuted ? 0 : normalVolume, ctx.currentTime);
  }
  if (isMuted) {
    suspendAudio();
  } else {
    resumeAudio();
  }
  // Mute/unmute all DOM audio & video elements
  document.querySelectorAll('audio, video').forEach(el => {
    el.muted = isMuted;
    if (isMuted) {
      try { el.pause(); } catch (_) {}
    }
  });
  return isMuted;
}

export function toggleMute() {
  return setMuted(!isMuted);
}

export function isAudioMuted() {
  return isMuted;
}

/** Footstep sound with surface variation (marble vs parquet) and sprint cadence */
export function footstep(sprint = false, surface = 'parquet') {
  if (isMuted || !ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;

  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;

  const isMarble = surface === 'marble';
  src.playbackRate.value = isMarble ? 1.05 + Math.random() * 0.3 : 0.72 + Math.random() * 0.35;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = isMarble ? 650 + Math.random() * 250 : 380 + Math.random() * 200;
  filter.Q.value = isMarble ? 1.2 : 0.85;

  const gain = ctx.createGain();
  const vol = sprint ? (isMarble ? 0.36 : 0.3) : (isMarble ? 0.22 : 0.18);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + (isMarble ? 0.16 : 0.11));

  src.connect(filter).connect(gain).connect(master);
  src.start(t, Math.random() * 0.5, 0.15);
}

/** Synthesises a rich celestial vault unlatch mechanism & magical harmonic chime */
export function playVaultUnlockSound() {
  if (isMuted || !ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  const t = ctx.currentTime;

  // 1. Mechanical vault lock release (deep resonant clunk)
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'triangle';
  osc1.frequency.setValueAtTime(160, t);
  osc1.frequency.exponentialRampToValueAtTime(40, t + 0.28);
  gain1.gain.setValueAtTime(0.40, t);
  gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  osc1.connect(gain1).connect(master);
  osc1.start(t);
  osc1.stop(t + 0.30);

  // 2. Ascending magical celestial chord (A major sparkling arpeggio)
  const chord = [440, 554.37, 659.25, 880, 1108.73];
  chord.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const noteTime = t + 0.14 + idx * 0.075;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, noteTime);
    g.gain.setValueAtTime(0.22, noteTime);
    g.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.75);
    osc.connect(g).connect(master);
    osc.start(noteTime);
    osc.stop(noteTime + 0.80);
  });
}

export function getAudioContext() {
  return ctx;
}
