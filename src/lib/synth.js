// The Web Audio synth behind lib/sound.js. Its own chunk: loaded on the first tap,
// so the sound code never weighs down the first page load.

let ctx = null;
let out = null;
let noiseBuf = null;
const VOLUME = 0.5;

export function init(muted) {
  const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.connect(ctx.destination);
  out = ctx.createGain();
  out.gain.value = muted ? 0 : VOLUME;
  out.connect(comp);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  ctx.resume?.();
  return true;
}

export function setMuted(m) {
  out?.gain.setTargetAtTime(m ? 0 : VOLUME, ctx.currentTime, 0.02);
}

export function play(name, delay) {
  if (!ctx || !SOUNDS[name]) return;
  if (ctx.state !== 'running') return void ctx.resume?.();
  SOUNDS[name](ctx.currentTime + 0.01 + delay);
}

// ---------- building blocks ----------

/** One enveloped oscillator note. `to` slides the pitch, `vib` adds wobble. */
function tone(t, freq, { dur = 0.15, type = 'sine', vol = 0.3, to = null, attack = 0.005, vib = 0 } = {}) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  if (vib) {
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = 18;
    lg.gain.value = freq * vib;
    lfo.connect(lg).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** A filtered noise burst (crunches, splashes, whooshes). */
function noise(t, { dur = 0.1, freq = 1500, q = 1, type = 'bandpass', vol = 0.3, to = null, attack = 0 } = {}) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  if (attack) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
  } else g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(out);
  s.start(t, Math.random() * 0.3);
  s.stop(t + dur + 0.02);
}

const notes = (t, freqs, step, opts) => freqs.forEach((f, i) => tone(t + i * step, f, opts));
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------- the sounds ----------

const SOUNDS = {
  // a crunchy bite plus a little "nom" voice
  chomp(t) {
    noise(t, { dur: 0.06, freq: rnd(1600, 2200), q: 0.8, vol: 0.4 });
    noise(t + 0.07, { dur: 0.05, freq: rnd(2200, 2800), q: 1, vol: 0.25 });
    tone(t, 170, { dur: 0.07, type: 'triangle', to: 90, vol: 0.3 });
    const f = rnd(330, 400);
    tone(t + 0.12, f, { dur: 0.09, type: 'triangle', to: f * 1.3, vol: 0.16, attack: 0.02 });
    tone(t + 0.22, f * 1.2, { dur: 0.1, type: 'triangle', to: f * 0.95, vol: 0.14, attack: 0.02 });
  },
  gulp(t) {
    tone(t, 520, { dur: 0.13, to: 180, vol: 0.3 });
    tone(t + 0.02, 1040, { dur: 0.08, to: 400, vol: 0.06 });
  },
  giggle(t) {
    const base = rnd(620, 760);
    for (let i = 0; i < 4; i++) tone(t + i * 0.085, base * (1 + i * 0.07), { dur: 0.07, to: base * (1.25 + i * 0.07), vol: 0.18, vib: 0.03 });
  },
  squish(t) {
    tone(t, rnd(420, 500), { dur: 0.18, type: 'sine', to: 160, vol: 0.35 });
    noise(t, { dur: 0.12, freq: 600, to: 250, q: 2, vol: 0.15 });
  },
  pop(t) {
    tone(t, 900, { dur: 0.06, to: 300, vol: 0.3 });
  },
  crack(t) {
    noise(t, { dur: 0.05, freq: 3000, q: 2, vol: 0.4 });
    noise(t + 0.04, { dur: 0.08, freq: 1800, q: 2, vol: 0.3 });
    tone(t, 220, { dur: 0.1, type: 'triangle', to: 120, vol: 0.2 });
  },
  hatch(t) {
    SOUNDS.crack(t);
    notes(t + 0.12, [523, 659, 784, 1047, 1319], 0.07, { dur: 0.25, type: 'triangle', vol: 0.22 });
    tone(t + 0.5, 1568, { dur: 0.5, vol: 0.12, vib: 0.01 });
  },
  levelup(t) {
    notes(t, [392, 523, 659, 784], 0.11, { dur: 0.22, type: 'square', vol: 0.09 });
    notes(t + 0.46, [523, 659, 784, 1047], 0, { dur: 0.9, type: 'triangle', vol: 0.16 });
    notes(t + 0.46, [1047, 1319, 1568, 2093], 0.06, { dur: 0.4, vol: 0.07 });
  },
  chime(t) {
    notes(t, [880, 1319], 0.09, { dur: 0.35, type: 'triangle', vol: 0.18 });
  },
  // the happy hop: a short rising "bwip"
  jump(t) {
    const f = rnd(380, 460);
    tone(t, f, { dur: 0.13, to: f * 2.3, vol: 0.2 });
    tone(t + 0.01, f * 2, { dur: 0.08, type: 'triangle', to: f * 3.6, vol: 0.05 });
  },
  // a soft squishy landing
  pat(t) {
    tone(t, rnd(130, 160), { dur: 0.07, to: 70, vol: 0.16 });
    noise(t, { dur: 0.05, freq: 350, type: 'lowpass', vol: 0.12 });
  },
  step(t) {
    tone(t, rnd(200, 240), { dur: 0.04, type: 'triangle', to: 140, vol: 0.1 });
    noise(t, { dur: 0.03, freq: 2500, q: 1, vol: 0.04 });
  },
  // a soft airy breath in, then a gentle little whistle out
  snore(t) {
    noise(t, { dur: 1, freq: 500, to: 1100, q: 0.8, vol: 0.035, attack: 0.5 });
    tone(t + 0.1, 150, { dur: 0.85, to: 190, vol: 0.035, attack: 0.45 });
    const w = rnd(900, 1050);
    tone(t + 1.15, w, { dur: 0.7, to: w * 0.75, vol: 0.04, attack: 0.2 });
    noise(t + 1.1, { dur: 0.6, freq: 1400, to: 700, q: 0.8, vol: 0.02, attack: 0.15 });
  },
  boing(t) {
    tone(t, 160, { dur: 0.3, type: 'sine', to: 520, vol: 0.32, vib: 0.06 });
  },
  hup(t) {
    tone(t, 150, { dur: 0.12, type: 'square', to: 220, vol: 0.08 });
    noise(t, { dur: 0.08, freq: 500, q: 1, vol: 0.12 });
  },
  bubble(t) {
    const f = rnd(500, 900);
    tone(t, f, { dur: 0.08, to: f * 2.2, vol: 0.18 });
  },
  splash(t) {
    noise(t, { dur: 0.45, freq: 1200, to: 4000, q: 0.6, vol: 0.3 });
  },
  sparkle(t) {
    for (let i = 0; i < 4; i++) tone(t + i * 0.06, rnd(1800, 2800), { dur: 0.16, vol: 0.07 });
  },
  refuse(t) {
    tone(t, 330, { dur: 0.13, type: 'triangle', vol: 0.2 });
    tone(t + 0.16, 247, { dur: 0.2, type: 'triangle', vol: 0.2, to: 220 });
  },
  sleep(t) {
    notes(t, [659, 523, 392], 0.22, { dur: 0.4, type: 'sine', vol: 0.15 });
  },
  wake(t) {
    notes(t, [392, 523, 659], 0.12, { dur: 0.25, type: 'triangle', vol: 0.16 });
  },
  rustle(t) {
    noise(t, { dur: 0.35, freq: 3500, q: 0.5, type: 'highpass', vol: 0.12 });
  },
  click(t) {
    tone(t, 1200, { dur: 0.03, type: 'square', vol: 0.05 });
  },
  // volleyball
  serve(t) {
    tone(t, 300, { dur: 0.1, type: 'triangle', to: 180, vol: 0.32 });
    noise(t, { dur: 0.05, freq: 1200, q: 1, vol: 0.22 });
  },
  bump(t) {
    tone(t, rnd(220, 260), { dur: 0.09, type: 'triangle', to: 150, vol: 0.28 });
    noise(t, { dur: 0.04, freq: 800, q: 1, vol: 0.15 });
  },
  spike(t) {
    noise(t, { dur: 0.07, freq: 2200, q: 0.7, vol: 0.45 });
    tone(t, 420, { dur: 0.12, type: 'triangle', to: 140, vol: 0.38 });
    noise(t + 0.03, { dur: 0.2, freq: 900, to: 3000, q: 3, vol: 0.12 });
  },
  thud(t) {
    tone(t, 110, { dur: 0.12, to: 60, vol: 0.3 });
    noise(t, { dur: 0.1, freq: 400, type: 'lowpass', vol: 0.25 });
  },
  whistle(t) {
    tone(t, 2300, { dur: 0.32, vol: 0.08, vib: 0.03, attack: 0.02 });
  },
  cheer(t) {
    notes(t, [523, 659, 784, 1047], 0.06, { dur: 0.16, type: 'triangle', vol: 0.15 });
    SOUNDS.giggle(t + 0.25);
  },
  calm(t) {
    noise(t, { dur: 0.6, freq: 1500, to: 600, q: 0.6, vol: 0.06, attack: 0.15 });
    notes(t + 0.1, [659, 523], 0.2, { dur: 0.45, vol: 0.1, attack: 0.05 });
  },
  aww(t) {
    tone(t, 520, { dur: 0.4, type: 'triangle', to: 330, vol: 0.12, vib: 0.02, attack: 0.03 });
  },
  // match end
  win(t) {
    notes(t, [523, 523, 523, 659, 784], 0.1, { dur: 0.16, type: 'square', vol: 0.08 });
    notes(t + 0.55, [523, 659, 784, 1047], 0, { dur: 0.8, type: 'triangle', vol: 0.15 });
  },
  lose(t) {
    notes(t, [392, 370, 349], 0.22, { dur: 0.3, type: 'triangle', vol: 0.16 });
    tone(t + 0.66, 330, { dur: 0.6, type: 'triangle', vol: 0.16, vib: 0.02 });
  },
};
