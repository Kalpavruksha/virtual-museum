// WebAudio helper: synthesised architectural footsteps, surface acoustics, and quiet gallery tone.
let ctx, master, noiseBuf;
let isMuted = false;
let normalVolume = 0.65;

export function initAudio() {
  if (ctx) {
    resumeAudio();
    return;
  }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = isMuted ? 0 : normalVolume;
  master.connect(ctx.destination);

  // Generate 1 second of white noise buffer
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  // Gentle, warm gallery room tone (filtered Brownian/pink ambience)
  const roomSrc = ctx.createBufferSource();
  roomSrc.buffer = noiseBuf;
  roomSrc.loop = true;

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 180;

  const roomGain = ctx.createGain();
  roomGain.gain.value = 0.028;

  roomSrc.connect(lowpass).connect(roomGain).connect(master);
  roomSrc.start();
}

export function resumeAudio() {
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

export function setMuted(muted) {
  isMuted = !!muted;
  if (master && ctx) {
    master.gain.setValueAtTime(isMuted ? 0 : normalVolume, ctx.currentTime);
  }
  // Also mute/unmute any global audio elements
  document.querySelectorAll('audio, video').forEach(el => {
    el.muted = isMuted;
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

export function getAudioContext() {
  return ctx;
}
