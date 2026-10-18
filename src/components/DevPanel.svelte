<script>
  // Prototype tool (open with ?dev): jump the server clock forward to test growth.
  import { api } from '../lib/api.js';
  import { game } from '../lib/game.svelte.js';
  let open = $state(false);
  const H = 3600_000;
  const warp = async (ms) => game.apply(await api.devWarp(ms));
  async function reset() {
    if (!confirm('Erase all pets and start over?')) return;
    game.apply(await api.devReset());
  }
</script>

<div class="dev">
  <button class="toggle" onclick={() => (open = !open)}>DEV</button>
  {#if open}
    <div class="panel">
      <span>Clock +{Math.round((game.s?.devOffset ?? 0) / H)}h</span>
      <button onclick={() => warp(H)}>+1h</button>
      <button onclick={() => warp(6 * H)}>+6h</button>
      <button onclick={() => warp(24 * H)}>+1 day</button>
      <button onclick={reset}>Reset</button>
      <a href="/?lab&dev">Seed Lab</a>
    </div>
  {/if}
</div>

<style>
  .dev { position: fixed; left: 50%; transform: translateX(-50%); top: calc(4px + env(safe-area-inset-top)); z-index: 50; display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .toggle { font-size: 10px; font-weight: 900; border: 0; border-radius: 6px; padding: 3px 8px; background: #222; color: #7f7; opacity: 0.6; }
  .panel { display: flex; gap: 4px; align-items: center; background: #222; color: #fff; padding: 6px; border-radius: 10px; font-size: 12px; flex-wrap: wrap; justify-content: center; max-width: 92vw; }
  .panel a { color: #7f7; font-weight: 800; padding: 6px 8px; }
  .panel button { border: 0; border-radius: 6px; padding: 6px 8px; font-weight: 800; background: #444; color: #fff; }
</style>
