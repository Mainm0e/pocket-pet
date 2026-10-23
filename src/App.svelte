<script>
  import { game } from './lib/game.svelte.js';
  import Room from './components/Room.svelte';
  import Quiz from './components/Quiz.svelte';
  import Naming from './components/Naming.svelte';
  import Evolution from './components/Evolution.svelte';
  import DevPanel from './components/DevPanel.svelte';
  import SeedLab from './components/SeedLab.svelte';

  const params = new URLSearchParams(location.search);
  const dev = params.has('dev');
  const lab = params.has('lab') || params.has('gallery');
  game.load();

  // Re-sync when the player comes back; the server works out what happened meanwhile.
  $effect(() => {
    const onVis = () => document.visibilityState === 'visible' && game.load();
    document.addEventListener('visibilitychange', onVis);
    const iv = setInterval(() => document.visibilityState === 'visible' && game.load(), 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(iv);
    };
  });
</script>

{#if lab}
  <SeedLab />
{:else if !game.s}
  <div class="loading">♥</div>
{:else if !game.pet}
  <Quiz />
{:else}
  <Room />
{/if}

{#if game.naming}<Naming />{/if}
{#if game.evolution && game.pet}<Evolution />{/if}
{#if game.battleOpen && game.pet}
  <!-- the match screen loads on demand -->
  {#await import('./components/Battle.svelte') then { default: Battle }}<Battle />{/await}
{/if}
{#if dev}<DevPanel />{/if}

<style>
  .loading { position: fixed; inset: 0; display: grid; place-items: center; font-size: 48px; color: #ff8fab; animation: beat 0.8s infinite; }
  @keyframes beat { 50% { transform: scale(1.2); } }
</style>
