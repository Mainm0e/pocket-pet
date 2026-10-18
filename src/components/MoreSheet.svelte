<script>
  import { game } from '../lib/game.svelte.js';
  const run = (action) => {
    game.sheet = null;
    setTimeout(() => game.act(action), 150);
  };
</script>

<div class="grid">
  <button onclick={() => run('train')}><span>🏋️</span><b>Train</b><small>Builds Strong</small></button>
  <button onclick={() => run('bath')}><span>🛁</span><b>Bath</b><small>Builds Calm</small></button>
  <button onclick={() => { game.sheet = null; game.battleOpen = true; }}>
    <span>⚔️</span><b>Battle</b><small>{game.pet.battlesLeft} left today</small>
  </button>
  <button onclick={() => (game.sheet = 'card')}><span>🪪</span><b>Pet card</b><small>DNA & marks</small></button>
  <button class="wide" onclick={() => { game.sheet = null; game.decorating = true; }}>
    <span>🛋️</span><b>Decorate room</b><small>Move furniture, pick colours</small>
  </button>
</div>

<style>
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  button {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    padding: 16px 8px; border-radius: 20px; border: 0;
    background: var(--card); color: var(--ink); box-shadow: 0 4px 0 var(--shadow);
  }
  button:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--shadow); }
  .wide { grid-column: 1 / -1; }
  span { font-size: 34px; }
  b { font-size: 16px; }
  small { color: var(--ink-soft); font-weight: 700; font-size: 12px; }
</style>
