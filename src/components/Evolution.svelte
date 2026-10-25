<script>
  import { game } from '../lib/game.svelte.js';
  import { sfx } from '../lib/sound.js';
  import PetThumb from './PetThumb.svelte';
  import { lookOf } from '../species/index.js';
  import PetCard from './PetCard.svelte';

  let { from, to } = game.evolution;
  let pet = $derived(game.pet);
  // Rebuild what the pet looked like before, so we can morph between the two.
  let before = $derived({
    ...pet,
    stage: from,
    form: { top: from === 'teen' ? pet.form.top : null, second: null },
  });
  let phase = $state('glow'); // glow -> flash -> reveal -> card
  $effect(() => {
    sfx('sparkle');
    const t1 = setTimeout(() => (phase = 'flash'), 2600);
    const t0 = setTimeout(() => sfx('levelup'), 2500);
    const t2 = setTimeout(() => (phase = 'reveal'), 3000);
    const t3 = setTimeout(() => to === 'adult' && (phase = 'card'), 5200);
    return () => [t0, t1, t2, t3].forEach(clearTimeout);
  });
  const LINES = { teen: 'is growing up!', adult: 'is all grown up!' };
</script>

<div class="evo {phase}">
  <div class="rays"></div>
  {#if phase === 'card'}
    <div class="card">
      <h2>Meet your adult!</h2>
      <PetCard {pet} compact />
      <button onclick={() => (game.evolution = null)}>Amazing!</button>
    </div>
  {:else}
    <p class="top">{pet.nickname || pet.genome.name} {LINES[to]}</p>
    <div class="stage">
      {#if phase === 'glow'}
        <div class="morph a"><PetThumb look={lookOf(before)} yaw={0} /></div>
        <div class="morph b"><PetThumb look={lookOf(pet)} yaw={0} /></div>
      {:else}
        <div class="final"><PetThumb look={lookOf(pet)} yaw={0.3} alt={pet.title} /></div>
      {/if}
    </div>
    {#if phase === 'reveal'}
      <h2 class="name">{pet.title}!</h2>
      {#if to === 'teen'}
        <button onclick={() => (game.evolution = null)}>Yay!</button>
      {/if}
    {/if}
  {/if}
  {#if phase === 'flash'}<div class="flash"></div>{/if}
</div>

<style>
  .evo {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: radial-gradient(circle, #3b2a6e, #140c2c);
    color: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 16px;
    overflow: hidden;
    animation: fade 0.5s;
  }
  @keyframes fade { from { opacity: 0; } }
  .rays {
    position: absolute;
    width: 200vmax;
    height: 200vmax;
    background: repeating-conic-gradient(rgba(255, 255, 255, 0.07) 0 10deg, transparent 10deg 20deg);
    animation: spin 20s linear infinite;
  }
  @keyframes spin { to { transform: rotate(1turn); } }
  .top { position: relative; font-size: 20px; font-weight: 800; }
  .stage { position: relative; width: min(64vw, 280px); aspect-ratio: 1; }
  .morph { position: absolute; inset: 0; filter: brightness(0) invert(1) drop-shadow(0 0 18px #fff); }
  .morph.a { animation: flickA 2.6s ease-in forwards; }
  .morph.b { animation: flickB 2.6s ease-in forwards; }
  @keyframes flickA {
    0%, 20% { opacity: 1; } 25% { opacity: 0; } 35% { opacity: 1; } 45% { opacity: 0; } 52% { opacity: 1; }
    60% { opacity: 0; } 66% { opacity: 1; } 72% { opacity: 0; } 77% { opacity: 1; } 82%, 100% { opacity: 0; }
  }
  @keyframes flickB {
    0%, 20% { opacity: 0; } 25% { opacity: 1; } 35% { opacity: 0; } 45% { opacity: 1; } 52% { opacity: 0; }
    60% { opacity: 1; } 66% { opacity: 0; } 72% { opacity: 1; } 77% { opacity: 0; } 82%, 100% { opacity: 1; transform: scale(1.08); }
  }
  .final { position: absolute; inset: 0; animation: boing 0.7s cubic-bezier(0.3, 1.6, 0.5, 1); }
  @keyframes boing { from { transform: scale(0.6); } }
  .flash { position: absolute; inset: 0; background: #fff; animation: flash 0.6s ease-out forwards; }
  @keyframes flash { from { opacity: 1; } to { opacity: 0; } }
  .name { position: relative; font-size: 30px; margin: 8px 0 16px; animation: boing 0.6s; text-shadow: 0 3px 0 rgba(0, 0, 0, 0.3); }
  button {
    position: relative;
    border: 0;
    border-radius: 18px;
    padding: 14px 40px;
    font-size: 18px;
    font-weight: 800;
    background: #ffd34d;
    color: #4a3200;
    box-shadow: 0 5px 0 #c99a10;
  }
  .card {
    position: relative;
    width: 100%;
    max-width: 440px;
    max-height: 100%;
    overflow-y: auto;
    background: var(--sheet);
    color: var(--ink);
    border-radius: 24px;
    padding: 16px;
    text-align: center;
    animation: boing 0.6s;
  }
  .card h2 { margin: 0 0 10px; }
  .card :global(.facts) { text-align: left; }
  @media (prefers-reduced-motion: reduce) {
    .rays { animation: none; }
  }
</style>
