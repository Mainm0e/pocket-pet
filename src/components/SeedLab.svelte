<script>
  // Seed Lab (open with ?lab): design and explore pets from seed codes.
  import { decode, normalizeCode, randomCode } from '../server/genome/index.js';
  import { SHOWCASE } from '../server/genome/showcase.js';
  import { TRAITS, TRAIT_INFO, MARKS, MUTATIONS } from '../server/constants.js';
  import PetThumb from './PetThumb.svelte';

  const q = new URLSearchParams(location.search);
  let text = $state(q.get('seed') || 'MO1-DAIFUKU');
  let stage = $state(q.get('stage') || 'adult');
  let top = $state(q.get('top') || 'tough');
  let second = $state(q.get('second') || 'calm');
  let vivid = $state(0.85);
  let marks = $state([]);
  let canvas;
  let viewer = $state(null);

  let genome = $derived(decode(text));
  let look = $derived({
    genome,
    stage,
    form: { top: stage === 'teen' || stage === 'adult' ? top : null, second: stage === 'adult' ? second : null },
    marks,
    vivid,
    hatchTaps: 2,
    mood: vivid < 0.3 ? 'sad' : 'ok',
  });

  $effect(() => {
    let v;
    import('../three/viewer.js').then(async ({ createViewer }) => {
      v = await createViewer(canvas, { spin: !q.has('yaw'), yaw: q.has('yaw') ? +q.get('yaw') : 0.25 });
      viewer = v;
    });
    return () => v?.dispose();
  });
  // Rebuild only after typing / sliding pauses; sculpting happens in a worker.
  let busy = $state(false);
  $effect(() => {
    const l = $state.snapshot(look);
    if (!viewer) return;
    const t = setTimeout(async () => {
      busy = true;
      await viewer.setLook(l);
      busy = false;
    }, 180);
    return () => clearTimeout(t);
  });
  $effect(() => {
    if (second === top) second = TRAITS.find((t) => t !== top);
  });

  const dev = q.has('dev');
  async function adopt() {
    if (!confirm(`Replace your current pet with a fresh ${genome.code} egg?`)) return;
    const { api } = await import('../lib/api.js');
    await api.devAdopt(genome.code);
    location.href = '/?dev';
  }
  const toggleMark = (m) => (marks = marks.includes(m) ? marks.filter((x) => x !== m) : [...marks, m]);
  const showcase = Object.entries(SHOWCASE).map(([k, code]) => ({ k, code }));
  let variety = $state(Array.from({ length: 8 }, () => randomCode()));
  const pick = (code) => {
    text = code;
    scrollTo({ top: 0, behavior: 'smooth' });
  };
  const thumbLook = (code) => ({ genome: decode(code), stage: 'adult', form: { top: 'tough', second: 'calm' }, marks: [], vivid: 0.85, mood: 'ok' });
</script>

<div class="lab">
  <header>
    <h1>Seed Lab</h1>
    <p>Any text is a seed. Same seed, same DNA, forever.</p>
  </header>

  <form class="seed" onsubmit={(e) => e.preventDefault()}>
    <input bind:value={text} aria-label="Seed code" spellcheck="false" />
    <button type="button" onclick={() => (text = randomCode())}>Random</button>
  </form>
  {#if dev}
    <button class="adopt" onclick={adopt}>Hatch this seed as my pet (dev)</button>
  {/if}
  <p class="code"><code>{genome.code}</code> · {genome.speciesLabel} gen {genome.gen}{#if genome.speciesOdds !== null && genome.speciesOdds < 0.001} (1 in {Math.round(1 / genome.speciesOdds).toLocaleString('en')} eggs){/if} · <b class="tier {genome.tier}">{genome.tier} · {genome.points} pts</b></p>

  <div class="view"><canvas bind:this={canvas}></canvas>{#if busy}<span class="busy">sculpting…</span>{/if}</div>

  <div class="controls">
    <div class="chips">
      {#each ['egg', 'baby', 'teen', 'adult'] as s}
        <button class:on={stage === s} onclick={() => (stage = s)}>{s}</button>
      {/each}
    </div>
    {#if stage === 'teen' || stage === 'adult'}
      <label>Top trait (body)
        <select bind:value={top}>{#each TRAITS as t}<option value={t}>{TRAIT_INFO[t].label}</option>{/each}</select>
      </label>
    {/if}
    {#if stage === 'adult'}
      <label>Second trait (feature)
        <select bind:value={second}>{#each TRAITS.filter((t) => t !== top) as t}<option value={t}>{TRAIT_INFO[t].label}</option>{/each}</select>
      </label>
    {/if}
    <label>Care (colour vividness) <input type="range" min="0" max="1" step="0.05" bind:value={vivid} /></label>
    <div class="chips">
      {#each Object.entries(MARKS) as [m, info]}
        <button class:on={marks.includes(m)} onclick={() => toggleMark(m)}>{info.label}</button>
      {/each}
    </div>
  </div>

  <h2>DNA strand</h2>
  <p class="strand">{#each genome.list as g}<span title={g.gene}>{g.codon}</span>{/each}</p>
  <div class="genes">
    {#each genome.list as g}
      <div class="gene" class:rare={g.points >= 2}>
        <small>{g.gene} · {g.codon}</small>
        <b>{g.label}</b>
        <small>{g.odds}%{g.points ? ` · +${g.points}` : ''} · shows at {g.shows}</small>
      </div>
    {/each}
    {#each genome.mutations as m}
      <div class="gene rare"><small>Mutation</small><b>{MUTATIONS[m].label}</b><small>1.5%</small></div>
    {/each}
  </div>
  <h2>Fine DNA <small>{genome.fine.print}</small></h2>
  <p class="fine">
    {#each Object.entries(genome.fine) as [k, v]}{#if k !== 'print'}<span>{k} {typeof v === 'number' ? v.toFixed(2) : v}</span>{/if}{/each}
  </p>

  <h2>Rare showcase</h2>
  <div class="grid">
    {#each showcase as s}
      <button onclick={() => pick(s.code)}><PetThumb look={thumbLook(s.code)} /><small>{s.k.replace('_', ' ')}</small></button>
    {/each}
  </div>
  <h2>Random litter <button class="mini" onclick={() => (variety = variety.map(() => randomCode()))}>Reroll</button></h2>
  <div class="grid">
    {#each variety as code (code)}
      <button onclick={() => pick(code)}><PetThumb look={thumbLook(code)} /><small>{code}</small></button>
    {/each}
  </div>
</div>

<style>
  .lab { max-width: 760px; margin: 0 auto; padding: calc(16px + env(safe-area-inset-top)) 16px 40px; height: 100dvh; overflow-y: auto; box-sizing: border-box; }
  h1 { margin: 0; }
  header p { margin: 4px 0 12px; color: var(--ink-soft); font-weight: 700; }
  h2 { font-size: 16px; margin: 20px 0 8px; display: flex; gap: 8px; align-items: center; }
  h2 small { font-family: ui-monospace, 'JetBrains Mono', monospace; color: var(--ink-soft); }
  .seed { display: flex; gap: 8px; }
  .seed input { flex: 1; min-width: 0; font: 700 18px ui-monospace, 'JetBrains Mono', monospace; padding: 12px; border-radius: 14px; border: 2px solid var(--shadow); background: var(--card); color: var(--ink); text-transform: uppercase; }
  .seed button, .mini { border: 0; border-radius: 14px; padding: 0 16px; font-weight: 800; background: var(--card); color: var(--ink); box-shadow: 0 3px 0 var(--shadow); }
  .mini { padding: 4px 10px; font-size: 12px; }
  .adopt { margin-top: 8px; width: 100%; border: 0; border-radius: 14px; padding: 12px; font-weight: 800; background: #222; color: #7f7; }
  .code { font-weight: 700; color: var(--ink-soft); }
  .tier { padding: 2px 8px; border-radius: 999px; background: #e3e6ee; color: #444; }
  .tier.Uncommon { background: #cdefd9; color: #1d5a35; }
  .tier.Rare { background: #d3e2ff; color: #1d3a7a; }
  .tier.Epic { background: #e6d6ff; color: #4a2a8a; }
  .tier.Legendary { background: #ffe39a; color: #6a4a00; }
  .view { aspect-ratio: 1; max-height: 56vh; margin: 0 auto; border-radius: 24px; background: radial-gradient(circle at 50% 40%, #fff, #f6e6ea); box-shadow: 0 4px 0 var(--shadow); }
  .view { position: relative; }
  canvas { width: 100%; height: 100%; display: block; touch-action: none; }
  .busy { position: absolute; right: 12px; bottom: 10px; font: 600 12px ui-monospace, 'JetBrains Mono', monospace; color: #8a7280; }
  .controls { display: grid; gap: 10px; margin-top: 12px; }
  .controls label { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-weight: 800; font-size: 14px; }
  select { font: inherit; padding: 6px 10px; border-radius: 10px; border: 2px solid var(--shadow); background: var(--card); color: var(--ink); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chips button { border: 0; border-radius: 999px; padding: 8px 12px; font-weight: 800; font-size: 13px; text-transform: capitalize; background: var(--card); color: var(--ink); box-shadow: 0 2px 0 var(--shadow); min-height: 36px; }
  .chips button.on { background: #ff8fab; color: #fff; }
  .strand { font: 700 13px ui-monospace, 'JetBrains Mono', monospace; display: flex; flex-wrap: wrap; gap: 4px; margin: 0; }
  .strand span { background: var(--card); padding: 3px 5px; border-radius: 6px; }
  .genes { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
  .gene { background: var(--card); border-radius: 14px; padding: 8px 10px; display: flex; flex-direction: column; box-shadow: 0 2px 0 var(--shadow); }
  .gene.rare { outline: 2px solid #ffd34d; }
  .gene small { font-size: 11px; color: var(--ink-soft); font-weight: 700; }
  .fine { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; }
  .fine span { font: 600 12px ui-monospace, 'JetBrains Mono', monospace; background: var(--card); padding: 4px 8px; border-radius: 8px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; }
  .grid button { border: 0; background: var(--card); border-radius: 16px; padding: 4px; box-shadow: 0 2px 0 var(--shadow); color: var(--ink); }
  .grid small { font: 600 11px ui-monospace, 'JetBrains Mono', monospace; display: block; padding-bottom: 4px; text-transform: capitalize; }
</style>
