<script>
  import { game } from '../lib/game.svelte.js';
  import { QUIZ } from '../server/dna.js';
  import PetThumb from './PetThumb.svelte';
  import { decode } from '../server/genome/index.js';

  let step = $state(-1); // -1 = intro
  let answers = $state([]);
  let leaving = $state(false);
  // A placeholder egg for the intro; the real DNA is rolled by the server.
  const previewEgg = { genome: decode('MYSTERY'), stage: 'egg', hatchTaps: 0, marks: [], form: {} };

  function answer(i) {
    answers = [...answers, i];
    if (step < QUIZ.length - 1) step++;
    else {
      leaving = true;
      setTimeout(() => game.startEgg(answers), 500);
    }
  }
</script>

<div class="quiz" class:leaving>
  {#if step < 0}
    <div class="intro">
      <p class="season">{game.s.season.name}</p>
      <div class="egg"><PetThumb look={previewEgg} yaw={0} alt="A mysterious egg" /></div>
      <h1>A mysterious egg appeared!</h1>
      <p>Answer a few silly questions. Your answers nudge what kind of mochi grows inside.</p>
      <button class="go" onclick={() => (step = 0)}>Let's go!</button>
      <p class="fine">No personal info. Just vibes.</p>
    </div>
  {:else}
    {#key step}
      <div class="q">
        <div class="dots">
          {#each QUIZ as _, i}<i class:on={i <= step}></i>{/each}
        </div>
        <h2>{QUIZ[step].q}</h2>
        {#each QUIZ[step].a as a, i}
          <button class="opt" onclick={() => answer(i)}>{a.text}</button>
        {/each}
      </div>
    {/key}
  {/if}
</div>

<style>
  .quiz {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    padding: calc(24px + env(safe-area-inset-top)) 16px calc(24px + env(safe-area-inset-bottom));
    background: radial-gradient(circle at 50% 30%, #fff6e8, var(--wall));
    transition: opacity 0.5s;
  }
  .leaving { opacity: 0; }
  .intro, .q { width: 100%; max-width: 420px; text-align: center; animation: in 0.35s ease-out; }
  @keyframes in { from { opacity: 0; transform: translateY(16px); } }
  .season { font-weight: 800; color: var(--ink-soft); letter-spacing: 0.04em; margin: 0; }
  .egg { width: 170px; margin: 8px auto; animation: rock 2.4s ease-in-out infinite; transform-origin: 50% 90%; }
  @keyframes rock { 25% { transform: rotate(-6deg); } 75% { transform: rotate(6deg); } }
  h1 { font-size: 26px; margin: 8px 0; }
  h2 { font-size: 24px; margin: 20px 0 24px; min-height: 2.6em; display: flex; align-items: center; justify-content: center; }
  p { font-weight: 700; color: var(--ink-soft); }
  .fine { font-size: 12px; }
  .go, .opt {
    display: block;
    width: 100%;
    border: 0;
    border-radius: 20px;
    padding: 18px;
    font-size: 18px;
    font-weight: 800;
    color: var(--ink);
    background: var(--card);
    box-shadow: 0 5px 0 var(--shadow);
    margin: 12px 0;
  }
  .go { background: #ff8fab; color: #fff; box-shadow: 0 5px 0 #d4607f; }
  .go:active, .opt:active { transform: translateY(4px); box-shadow: 0 1px 0 var(--shadow); }
  .dots { display: flex; justify-content: center; gap: 6px; }
  .dots i { width: 10px; height: 10px; border-radius: 50%; background: var(--shadow); }
  .dots i.on { background: #ff8fab; }
</style>
