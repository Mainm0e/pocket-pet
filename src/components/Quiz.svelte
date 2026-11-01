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
        <p class="step-label">Question {step + 1}<span>of {QUIZ.length}</span></p>
        <div class="dots" role="progressbar" aria-label="Quiz progress" aria-valuemin="1" aria-valuemax={QUIZ.length} aria-valuenow={step + 1}>
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
    overflow-y: auto;
    padding: max(24px, env(safe-area-inset-top)) 20px max(24px, env(safe-area-inset-bottom));
    background:
      radial-gradient(ellipse at 50% 34%, color-mix(in srgb, #ff8fab 13%, transparent), transparent 42%),
      radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--card) 76%, transparent), transparent 58%),
      var(--wall);
    transition: opacity 0.5s;
  }
  .leaving { opacity: 0; }
  .intro, .q { width: 100%; max-width: 460px; text-align: center; animation: in 0.35s ease-out; }
  .intro { display: grid; justify-items: center; }
  @keyframes in { from { opacity: 0; transform: translateY(16px); } }
  .season {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: 8px 12px;
    border: 1px solid color-mix(in srgb, var(--ink-soft) 22%, transparent);
    border-radius: 999px;
    color: var(--ink);
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.02em;
  }
  .season::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: #ff8fab; box-shadow: 0 0 0 3px color-mix(in srgb, #ff8fab 20%, transparent); }
  .egg {
    position: relative;
    isolation: isolate;
    width: min(220px, 58vw);
    aspect-ratio: 1;
    margin: 18px auto 10px;
    animation: rock 3s ease-in-out infinite;
    transform-origin: 50% 72%;
  }
  .egg::before {
    content: '';
    position: absolute;
    inset: 12%;
    z-index: -1;
    border-radius: 50%;
    background: color-mix(in srgb, var(--card) 78%, transparent);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--ink-soft) 12%, transparent), 0 18px 48px color-mix(in srgb, #ff8fab 17%, transparent);
  }
  .egg :global(canvas) { display: block; width: 100%; height: 100%; }
  @keyframes rock { 25% { transform: rotate(-4deg) translateY(-2px); } 75% { transform: rotate(4deg) translateY(-2px); } }
  h1 { max-width: 13ch; margin: 4px 0 0; font-size: clamp(28px, 7vw, 36px); line-height: 1.08; }
  h2 { font-size: 25px; line-height: 1.2; margin: 18px 0 22px; min-height: 2.4em; display: flex; align-items: center; justify-content: center; }
  p { font-weight: 700; color: var(--ink-soft); }
  .intro > p:not(.season) { max-width: 34ch; margin: 12px 0 18px; font-size: 16px; line-height: 1.5; }
  .fine { margin: 6px 0 0 !important; font-size: 12px; }
  .go, .opt {
    display: block;
    width: 100%;
    border: 0;
    border-radius: 16px;
    padding: 17px 18px;
    font-size: 18px;
    font-weight: 800;
    color: var(--ink);
    background: var(--card);
    box-shadow: 0 4px 0 color-mix(in srgb, var(--shadow) 82%, var(--ink));
    margin: 8px 0;
    transition: transform 140ms ease, box-shadow 140ms ease, background 140ms ease;
  }
  .go { background: #ff8fab; color: #351d2c; box-shadow: 0 4px 0 #c95d78; }
  .go:hover { background: #ff9db7; transform: translateY(-2px); box-shadow: 0 6px 0 #c95d78; }
  .go:active, .opt:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--shadow); }
  .q { max-width: 500px; }
  .step-label { display: flex; justify-content: center; gap: 5px; margin: 0 0 10px; color: var(--ink); font-size: 13px; font-weight: 800; }
  .step-label span { color: var(--ink-soft); font-weight: 700; }
  .dots { display: flex; justify-content: center; gap: 7px; }
  .dots i { flex: 1; max-width: 42px; height: 5px; border-radius: 9px; background: color-mix(in srgb, var(--ink-soft) 25%, transparent); }
  .dots i.on { background: #ff8fab; }
  .opt { text-align: left; padding: 18px 20px; }
  .opt:hover { background: color-mix(in srgb, var(--card) 86%, #ff8fab); transform: translateY(-2px); }
  .go:focus-visible, .opt:focus-visible { outline: 3px solid #ff8fab; outline-offset: 4px; }
  @media (max-height: 680px) {
    .quiz { padding-top: 16px; padding-bottom: 16px; }
    .egg { width: min(170px, 44vw); margin: 8px auto 2px; }
    h1 { font-size: 28px; }
    .intro > p:not(.season) { margin: 8px 0 12px; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }
</style>
