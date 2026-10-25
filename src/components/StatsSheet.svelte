<script>
  import { TRAIT_INFO, TRAITS, BOND } from '../server/constants.js';
  let { pet } = $props();
  const CARE = [
    ['happiness', 'Happiness', '#ff6b8a'],
    ['comfort', 'Comfort', '#7fb8ff'],
    ['health', 'Health', '#5ccf8a'],
    ['fitness', 'Fitness', '#ffa53a'],
    ['energy', 'Energy', '#f5c542'],
  ];
  const TRAIT_COLORS = { tough: '#e88a5c', playful: '#ff8fc8', strong: '#d65c5c', calm: '#6bbf8a' };
  let maxTrait = $derived(Math.max(30, ...TRAITS.map((t) => pet.traits[t])));
  const fmtTime = (ms) => {
    const h = Math.ceil(ms / 3600_000);
    return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h`;
  };
</script>

<section>
  <h3>Care <small>slowly drifts down, never to zero</small></h3>
  {#each CARE as [k, label, color]}
    <div class="row">
      <span class="label">{label}</span>
      <span class="bar"><i style="width:{pet.care[k]}%; background:{color}"></i></span>
      <span class="num">{Math.round(pet.care[k])}</span>
    </div>
  {/each}
</section>

<section>
  <h3>Growth traits <small>{Math.floor(pet.traitTotal)}/{pet.traitCap} · {Math.floor(pet.dailyTraitLeft)} more today</small></h3>
  {#each TRAITS as t}
    <div class="row">
      <span class="label">
        {TRAIT_INFO[t].label}
        {#if pet.dna.talent === t}<b class="talent" title="Talent: grows 1.5x faster">★</b>{/if}
      </span>
      <span class="bar"><i style="width:{(pet.traits[t] / maxTrait) * 100}%; background:{TRAIT_COLORS[t]}"></i></span>
      <span class="num">{Math.floor(pet.traits[t])}</span>
    </div>
    <p class="from">from {TRAIT_INFO[t].from.toLowerCase()}</p>
  {/each}
</section>

{#if pet.growth}
  <section>
    <h3>Next stage: {pet.growth.next[0].toUpperCase() + pet.growth.next.slice(1)}</h3>
    <div class="row"><span class="label">Age</span><span class="bar"><i style="width:{pet.growth.age * 100}%; background:#b28cff"></i></span><span class="num">{Math.round(pet.growth.age * 100)}%</span></div>
    <div class="row"><span class="label">Traits</span><span class="bar"><i style="width:{pet.growth.traits * 100}%; background:#b28cff"></i></span><span class="num">{Math.round(pet.growth.traits * 100)}%</span></div>
    <p class="hint">
      {#if pet.growth.readyIn > 0}Old enough in {fmtTime(pet.growth.readyIn)}.{/if}
      {#if pet.growth.traitsNeeded > 0}{pet.growth.traitsNeeded} more trait points needed.{/if}
      {#if pet.growth.readyIn <= 0 && pet.growth.traitsNeeded <= 0}Ready to evolve!{/if}
      Its top trait will decide its new shape.
    </p>
  </section>
{/if}

<section>
  <h3>Bond <small>{pet.bondLabel}</small></h3>
  <div class="row">
    <span class="label">♥ Bond</span>
    <span class="bar"><i style="width:{pet.bond}%; background:#ff6b9a"></i></span>
    <span class="num">{Math.floor(pet.bond)}</span>
  </div>
  <p class="hint">
    Listens to you in matches about {Math.round(pet.obey * 100)}% of the time.
    Grows with daily care, pats, visits and playing together (up to {BOND.DAILY_CAP} a day), and fades if your pet is neglected.
  </p>
</section>

<section>
  <h3>Volleyball <small>mood {pet.mood >= 0 ? '+' : ''}{Math.round(pet.mood * 100)}%</small></h3>
  <div class="bstats">
    {#each [['Power', 'power'], ['Speed', 'speed'], ['Receive', 'receive'], ['Focus', 'focus']] as [l, k]}
      <div><small>{l}</small><b>{Math.round(pet.playStats[k])}</b></div>
    {/each}
  </div>
  <p class="hint">Power from Strong, Speed from Playful, Receive from Tough, Focus from Calm.</p>
</section>

<style>
  section { margin-bottom: 18px; }
  h3 { margin: 0 0 8px; font-size: 16px; display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  h3 small { color: var(--ink-soft); font-size: 12px; font-weight: 700; }
  .row { display: flex; align-items: center; gap: 10px; margin: 6px 0; }
  .label { width: 86px; font-weight: 800; font-size: 14px; }
  .bar { flex: 1; height: 12px; border-radius: 8px; background: var(--track); overflow: hidden; }
  .bar i { display: block; height: 100%; border-radius: 8px; transition: width 0.6s; }
  .num { width: 30px; text-align: right; font-weight: 800; font-variant-numeric: tabular-nums; }
  .from { margin: -4px 0 4px 96px; font-size: 11px; color: var(--ink-soft); font-weight: 700; }
  .talent { color: #f5b400; }
  .hint { font-size: 13px; color: var(--ink-soft); font-weight: 700; margin: 6px 0 0; }
  .bstats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .bstats div { background: var(--card); border-radius: 14px; padding: 8px; text-align: center; box-shadow: 0 3px 0 var(--shadow); }
  .bstats small { display: block; font-size: 11px; color: var(--ink-soft); font-weight: 800; }
  .bstats b { font-size: 20px; }
</style>
