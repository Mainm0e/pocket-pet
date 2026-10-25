// Game sounds. Every sound is made in code by lib/synth.js (no audio files), which
// loads on the first tap: browsers block audio until a gesture anyway.
// UI-only: nothing here touches game state.

const KEY = 'pocketpet.muted';
let muted = false;
let synth = null;
try {
  muted = localStorage.getItem(KEY) === '1';
} catch {
  /* storage blocked: default to sound on */
}

/** Recent sound names asked to play (even when muted). Tests read it as window.__sfx with ?dev. */
export const played = [];

/** Call once at startup: loads the synth and unlocks audio on the first tap or key press. */
export function unlockOnGesture() {
  const go = () => {
    removeEventListener('pointerdown', go, true);
    removeEventListener('keydown', go, true);
    import('./synth.js')
      .then((m) => m.init(muted) && (synth = m))
      .catch(() => {});
  };
  addEventListener('pointerdown', go, true);
  addEventListener('keydown', go, true);
}

export const isMuted = () => muted;

export function setMuted(m) {
  muted = !!m;
  try {
    localStorage.setItem(KEY, muted ? '1' : '0');
  } catch {
    /* fine: just not remembered */
  }
  synth?.setMuted(muted);
}

/** Play a named sound now (or `delay` seconds from now). Does nothing when muted, unsupported or not loaded yet. */
export function sfx(name, delay = 0) {
  if (played.push(name) > 500) played.shift();
  if (!muted) synth?.play(name, delay);
}
