<script>
  import PetThumb from './PetThumb.svelte';
  import { lookOf } from '../species/index.js';
  import { game } from '../lib/game.svelte.js';
  import { TEMPERAMENTS, QUIRKS, MUTATIONS, MARKS, TRAIT_INFO } from '../server/constants.js';
  import { BADGES } from '../server/index.js';
  let { pet, compact = false } = $props();
  const CARD_HUE = { red: 28, cream: 38, blacktan: 300, sesame: 22, white: 330, peach: 10, mint: 155, lavender: 260,
    plain: 30, sakura: 340, matcha: 100, yuzu: 48, kinako: 35, ube: 265, mango: 32, choco: 20, starry: 232 };
  const ORDER = ['egg', 'baby', 'teen', 'adult'];
  let g = $derived(pet.genome);
  // Growing is discovery: genes show up as the pet reaches the stage that reveals them.
  const revealed = (gene) => ORDER.indexOf(pet.stage) >= ORDER.indexOf(gene.shows);
  let copied = $state(false);
  let editing = $state(false);
  let draft = $state('');

  const age = (ms) => {
    const d = Math.floor(ms / 86400_000);
    const h = Math.floor((ms % 86400_000) / 3600_000);
    return d ? `${d}d ${h}h` : `${h}h`;
  };
  async function copy() {
    try {
      await navigator.clipboard.writeText(pet.dnaString);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {}
  }
  async function saveName() {
    await game.rename(draft);
    editing = false;
  }
</script>

<div class="card" style="--h:{CARD_HUE[g.genes.flavor ?? g.genes.coat] ?? 330}">
  <div class="art"><PetThumb look={lookOf(pet)} alt={pet.title} /></div>
  <div class="id">
    {#if editing}
      <form onsubmit={(e) => { e.preventDefault(); saveName(); }}>
        <input bind:value={draft} maxlength="14" aria-label="Pet name" />
        <button>Save</button>
      </form>
    {:else}
      <h2>{pet.nickname || pet.genome.name}
        {#if !compact}<button class="edit" onclick={() => { draft = pet.nickname; editing = true; }} aria-label="Rename">✎</button>{/if}
      </h2>
    {/if}
    <p class="title">{pet.title}</p>
    <span class="chip">{pet.stage}</span>
    {#if pet.stage !== 'baby' && pet.stage !== 'egg'}<span class="chip tier {g.tier}">{g.tier}</span>{/if}
    {#if g.speciesOdds !== null && g.speciesOdds < 0.001}<span class="chip tier Legendary">1 in {Math.round(1 / g.speciesOdds).toLocaleString('en')} {g.speciesLabel}</span>{/if}
  </div>
  <button class="dna" onclick={copy} title="Copy DNA">
    <code>{pet.dnaString}</code>
    <small>{copied ? 'Copied!' : 'Tap to copy · one of a kind'}</small>
  </button>
</div>

<dl class="facts">
  <div><dt>Talent</dt><dd>{TRAIT_INFO[pet.dna.talent].label} <small>grows 1.5x faster</small></dd></div>
  <div><dt>Temperament</dt><dd>{TEMPERAMENTS[pet.dna.temperament].label} <small>{TEMPERAMENTS[pet.dna.temperament].desc}</small></dd></div>
  <div><dt>Quirk</dt><dd>{QUIRKS[pet.dna.quirk].label} <small>{QUIRKS[pet.dna.quirk].desc}</small></dd></div>
  {#if pet.form.top}
    <div><dt>Form</dt><dd>{TRAIT_INFO[pet.form.top].label} body{#if pet.form.second} · {TRAIT_INFO[pet.form.second].label} feature{/if}</dd></div>
  {/if}
  {#each g.mutations as m}
    <div><dt>Mutation</dt><dd>✨ {MUTATIONS[m].label} <small>{MUTATIONS[m].desc}</small></dd></div>
  {/each}
</dl>

{#if !compact}
  <h3>Genes <small>{g.speciesLabel} · gen {g.gen} · {g.fine.print}</small></h3>
  <p class="strand">{#each g.list as gene}<span class:hidden={!revealed(gene)}>{revealed(gene) ? gene.codon : '??'}</span>{/each}</p>
  <div class="genes">
    {#each g.list as gene}
      <div class="gene" class:locked={!revealed(gene)} class:rare={revealed(gene) && gene.points >= 2}>
        <small>{gene.gene}</small>
        <b>{revealed(gene) ? gene.label : '???'}</b>
        <small>{revealed(gene) ? `${gene.odds}% of pets` : `shows at ${gene.shows}`}</small>
      </div>
    {/each}
  </div>
{/if}

{#if !compact}
  <h3>Memory marks</h3>
  <div class="marks">
    {#each Object.entries(MARKS) as [id, m]}
      <div class="mark" class:locked={!pet.marks.includes(id)}>
        <b>{pet.marks.includes(id) ? m.label : '???'}</b>
        <small>{m.desc}</small>
      </div>
    {/each}
    {#each pet.badges as b}
      <div class="mark badge"><b>🏅 {BADGES[b].label}</b><small>{BADGES[b].desc}</small></div>
    {/each}
  </div>

  <h3>Record</h3>
  <div class="record">
    <div><b>{pet.battle.wins}</b><small>wins</small></div>
    <div><b>{pet.battle.losses}</b><small>losses</small></div>
    <div><b>{pet.battle.bestStreak}</b><small>best streak</small></div>
    <div><b>{age(pet.ageMs)}</b><small>age</small></div>
  </div>
{/if}

<style>
  .card {
    border-radius: 22px;
    padding: 14px;
    background: linear-gradient(160deg, hsl(var(--h) 80% 92%), hsl(calc(var(--h) + 40) 80% 88%));
    box-shadow: 0 4px 0 var(--shadow);
    color: #3a2a3a;
    display: grid;
    grid-template-columns: 130px 1fr;
    gap: 4px 12px;
    align-items: center;
  }
  .art { width: 130px; aspect-ratio: 1; overflow: visible; }

  h2 { margin: 0; font-size: 22px; display: flex; gap: 6px; align-items: center; }
  .edit { border: 0; background: rgba(255, 255, 255, 0.6); border-radius: 50%; width: 28px; height: 28px; font-size: 14px; color: inherit; }
  .title { margin: 2px 0 6px; font-weight: 800; opacity: 0.8; }
  form { display: flex; gap: 6px; }
  input { width: 100%; min-width: 0; font: inherit; font-weight: 800; padding: 6px 10px; border-radius: 10px; border: 2px solid rgba(0, 0, 0, 0.15); }
  form button { border: 0; border-radius: 10px; padding: 0 10px; font-weight: 800; background: #fff; color: inherit; }
  .chip { display: inline-block; padding: 2px 10px; border-radius: 999px; background: rgba(255, 255, 255, 0.7); font-size: 12px; font-weight: 800; text-transform: capitalize; margin-right: 4px; }
  .chip.tier.Uncommon { background: #cdefd9; }
  .chip.tier.Rare { background: #d3e2ff; }
  .chip.tier.Epic { background: #e6d6ff; }
  .chip.tier.Legendary { background: #ffe39a; }
  h3 small { font: 600 11px ui-monospace, 'JetBrains Mono', monospace; color: var(--ink-soft); margin-left: 6px; }
  .strand { font: 700 12px ui-monospace, 'JetBrains Mono', monospace; display: flex; flex-wrap: wrap; gap: 3px; margin: 0 0 8px; }
  .strand span { background: var(--card); padding: 2px 4px; border-radius: 5px; }
  .strand span.hidden { opacity: 0.4; }
  .genes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .gene { background: var(--card); border-radius: 12px; padding: 6px 8px; display: flex; flex-direction: column; box-shadow: 0 2px 0 var(--shadow); min-width: 0; }
  .gene b { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gene small { font-size: 10px; color: var(--ink-soft); font-weight: 700; }
  .gene.locked { opacity: 0.5; }
  .gene.rare { outline: 2px solid #ffd34d; }
  .dna {
    grid-column: 1 / -1;
    border: 0;
    background: rgba(255, 255, 255, 0.65);
    border-radius: 12px;
    padding: 8px 10px;
    text-align: left;
    color: inherit;
  }
  code { display: block; font-size: 12px; word-break: break-all; font-weight: 700; }
  .dna small { font-size: 11px; opacity: 0.7; font-weight: 700; }
  .facts { margin: 14px 0; display: grid; gap: 8px; }
  .facts div { background: var(--card); border-radius: 14px; padding: 8px 12px; display: flex; gap: 10px; box-shadow: 0 2px 0 var(--shadow); }
  dt { width: 96px; flex-shrink: 0; font-weight: 800; color: var(--ink-soft); font-size: 13px; }
  dd { margin: 0; font-weight: 800; font-size: 14px; }
  dd small { display: block; font-weight: 700; color: var(--ink-soft); font-size: 12px; }
  h3 { margin: 16px 0 8px; font-size: 16px; }
  .marks { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .mark { background: var(--card); border-radius: 14px; padding: 8px 10px; box-shadow: 0 2px 0 var(--shadow); }
  .mark b { display: block; font-size: 13px; }
  .mark small { font-size: 11px; color: var(--ink-soft); font-weight: 700; }
  .mark.locked { opacity: 0.5; }
  .mark.badge { background: #fff3c4; color: #5a4310; }
  .mark.badge small { color: #8a6a20; }
  .record { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .record div { background: var(--card); border-radius: 14px; padding: 8px 4px; text-align: center; box-shadow: 0 2px 0 var(--shadow); }
  .record b { display: block; font-size: 18px; }
  .record small { font-size: 11px; color: var(--ink-soft); font-weight: 700; }
  @media (max-width: 360px) {
    .card { grid-template-columns: 100px 1fr; }
    .art { width: 100px; }
  }
</style>
