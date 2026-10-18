<script>
  import { game } from '../lib/game.svelte.js';
  // The DNA suggests a name (rolled from the seed); the player can change it.
  let name = $state(game.pet?.genome.name ?? 'Pochi');
  async function done(e) {
    e.preventDefault();
    await game.rename(name || game.pet.genome.name);
    game.naming = false;
    game.say('Hi! ♥', 2600);
  }
</script>

<div class="wrap">
  <form class="box" onsubmit={done}>
    <h2>It hatched! 🎉</h2>
    <p>What will you call your new {game.pet?.genome.speciesLabel ?? 'pet'}?</p>
    <input bind:value={name} maxlength="14" aria-label="Pet name" />
    <button>That's the one!</button>
  </form>
</div>

<style>
  .wrap { position: fixed; inset: 0; display: grid; place-items: center; background: rgba(40, 20, 40, 0.35); z-index: 30; padding: 16px; animation: fade 0.3s; }
  @keyframes fade { from { opacity: 0; } }
  .box { width: 100%; max-width: 360px; background: var(--sheet); border-radius: 24px; padding: 20px; text-align: center; box-shadow: 0 6px 0 var(--shadow); }
  h2 { margin: 0 0 4px; }
  p { margin: 0 0 14px; font-weight: 700; color: var(--ink-soft); }
  input { width: 100%; font: inherit; font-size: 20px; font-weight: 800; text-align: center; padding: 12px; border-radius: 14px; border: 3px solid var(--shadow); background: var(--card); color: var(--ink); box-sizing: border-box; }
  button { margin-top: 14px; width: 100%; border: 0; border-radius: 16px; padding: 14px; font-size: 17px; font-weight: 800; background: #ff8fab; color: #fff; box-shadow: 0 4px 0 #d4607f; }
</style>
