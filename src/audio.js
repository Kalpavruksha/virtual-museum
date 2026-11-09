// Tiny WebAudio helper: synthesised footsteps + quiet room tone. No audio files needed.
let ctx, master, noiseBuf;
export function initAudio() {
  if (ctx) return; ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
  const g = ctx.createGain(); g.gain.value = 0.035; src.connect(lp).connect(g).connect(master); src.start();
}
export function footstep(sprint = false) {
  if (!ctx) return; const t = ctx.currentTime;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.7 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 450 + Math.random() * 250; f.Q.value = 0.8;
  const g = ctx.createGain(); g.gain.setValueAtTime(sprint ? 0.32 : 0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  s.connect(f).connect(g).connect(master); s.start(t, Math.random() * 0.5, 0.14);
}
