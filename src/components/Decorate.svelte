<script>
  // Decorate mode: the pet waits while you rearrange the room. Changes are a draft
  // until "Done", then the server checks and saves the layout.
  import { game } from '../lib/game.svelte.js';
  import { ROOM_ITEMS, WALLS, FLOORS, RUGS, sanitizeRoom } from '../server/room.js';
  import { WALL_STYLES, RUG_STYLES, LABELS } from '../three/roomStyles.js';

  let { stage, selected = null } = $props();
  let draft = $state(structuredClone($state.snapshot(game.s.room)));
  let tab = $state('furniture');
  let saving = $state(false);
  const ICON = { bed: '🛏️', bowl: '🥣', ball: '⚽', plant: '🪴', lamp: '💡', cushion: '🟣', toybox: '🧸', rug: '🟦' };
  const FLOOR_SWATCH = { oak: '#EDC28E', maple: '#F6DEB8', checker: 'repeating-conic-gradient(#FFD3DF 0 25%, #fff 0 50%) 0 0 / 16px 16px', tatami: '#D9DDA0' };

  let sel = $derived(draft.items.find((i) => i.id === selected) ?? null);
  const count = (kind) => draft.items.filter((i) => i.kind === kind).length;

  function push() {
    stage?.setLayout($state.snapshot(draft));
  }
  push();

  /** Called by the room when an item has been dragged. */
  export function moved(id, x, z) {
    const it = draft.items.find((i) => i.id === id);
    if (!it) return;
    it.x = x;
    it.z = z;
    push();
  }
  function add(kind) {
    if (count(kind) >= ROOM_ITEMS[kind].limit) return;
    const [x, z] = stage?.spotFor(kind) ?? [0, 0];
    let n = 1;
    while (draft.items.some((i) => i.id === kind + n)) n++;
    const item = { id: kind + n, kind, x, z, rot: 0 };
    if (kind === 'lamp') item.on = true;
    draft.items.push(item);
    push();
    stage?.select(item.id);
  }
  function rotate() {
    if (!sel) return;
    sel.rot = +((sel.rot + Math.PI / 4) % (Math.PI * 2)).toFixed(3);
    push();
  }
  function remove() {
    if (!sel || ROOM_ITEMS[sel.kind].required) return;
    draft.items = draft.items.filter((i) => i !== sel);
    stage?.select(null);
    push();
  }
  function style(key, value) {
    draft[key] = value;
    push();
  }
  async function done() {
    saving = true;
    await game.saveRoom(sanitizeRoom($state.snapshot(draft)));
    saving = false;
    game.decorating = false;
  }
  function cancel() {
    game.decorating = false; // the room shows the saved layout again
  }
</script>

<div class="top">
  <button class="ghost" onclick={cancel}>Cancel</button>
  <div class="title">
    <b>Decorate</b>
    <small>{sel ? `${ROOM_ITEMS[sel.kind].label} selected: drag to move` : 'Tap furniture, then drag it'}</small>
  </div>
  <button class="done" onclick={done} disabled={saving}>Done</button>
</div>

<div class="panel">
  {#if sel}
    <div class="selbar">
      <span>{ICON[sel.kind]} {ROOM_ITEMS[sel.kind].label}</span>
      <button onclick={rotate} aria-label="Rotate">↻ Rotate</button>
      <button onclick={remove} disabled={ROOM_ITEMS[sel.kind].required} aria-label="Remove">✕ Remove</button>
    </div>
  {/if}
  <div class="tabs" role="tablist">
    {#each [['furniture', 'Furniture'], ['wall', 'Walls'], ['floor', 'Floor'], ['rug', 'Rugs']] as [id, label]}
      <button role="tab" aria-selected={tab === id} class:on={tab === id} onclick={() => (tab = id)}>{label}</button>
    {/each}
  </div>
  {#if tab === 'furniture'}
    <div class="items">
      {#each Object.entries(ROOM_ITEMS) as [kind, def]}
        <button class="item" disabled={count(kind) >= def.limit} onclick={() => add(kind)}>
          <span>{ICON[kind]}</span>
          <b>{def.label}</b>
          <small>{count(kind)}/{def.limit}{def.required ? ' · needed' : ''}</small>
        </button>
      {/each}
    </div>
  {:else if tab === 'wall'}
    <div class="swatches">
      {#each WALLS as w}
        <button class:on={draft.wall === w} onclick={() => style('wall', w)} aria-label={LABELS[w]}>
          <i style="background: repeating-linear-gradient(90deg, {WALL_STYLES[w][0]} 0 8px, {WALL_STYLES[w][1]} 8px 16px)"></i>{LABELS[w]}
        </button>
      {/each}
    </div>
  {:else if tab === 'floor'}
    <div class="swatches">
      {#each FLOORS as f}
        <button class:on={draft.floor === f} onclick={() => style('floor', f)} aria-label={LABELS[f]}><i style="background: {FLOOR_SWATCH[f]}"></i>{LABELS[f]}</button>
      {/each}
    </div>
  {:else}
    <div class="swatches">
      {#each RUGS as r}
        <button class:on={draft.rug === r} onclick={() => style('rug', r)} aria-label={LABELS[r]}><i style="background: {RUG_STYLES[r][0]}; box-shadow: inset 0 0 0 4px {RUG_STYLES[r][1]}"></i>{LABELS[r]}</button>
      {/each}
    </div>
  {/if}
  <p class="note">Your pet waits patiently while you decorate. Its day keeps going, so don't forget it!</p>
</div>

<style>
  .top {
    position: absolute; left: 0; right: 0; top: 0; z-index: 7;
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    padding: calc(10px + env(safe-area-inset-top)) 12px 8px;
  }
  .title { flex: 1; text-align: center; background: var(--card); border-radius: 16px; padding: 6px 10px; box-shadow: 0 3px 0 var(--shadow); color: var(--ink); min-width: 0; }
  .title b { display: block; font-size: 16px; }
  .title small { display: block; font-size: 11px; color: var(--ink-soft); font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ghost, .done { border: 0; border-radius: 14px; padding: 10px 14px; font-weight: 800; min-height: 44px; }
  .ghost { background: var(--card); color: var(--ink); box-shadow: 0 3px 0 var(--shadow); }
  .done { background: #ff8fab; color: #fff; box-shadow: 0 3px 0 #d4607f; }
  .panel {
    position: absolute; left: 0; right: 0; bottom: 0; z-index: 7;
    background: var(--sheet); border-radius: 22px 22px 0 0; box-shadow: 0 -4px 0 var(--shadow);
    padding: 10px 12px calc(12px + env(safe-area-inset-bottom)); max-width: 640px; margin: 0 auto;
  }
  .selbar { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-weight: 800; color: var(--ink); }
  .selbar span { flex: 1; }
  .selbar button { border: 0; border-radius: 12px; padding: 8px 12px; font-weight: 800; background: var(--card); color: var(--ink); box-shadow: 0 2px 0 var(--shadow); min-height: 40px; }
  .selbar button:disabled { opacity: 0.4; }
  .tabs { display: flex; gap: 6px; margin-bottom: 8px; }
  .tabs button { flex: 1; border: 0; border-radius: 999px; padding: 8px 0; font-weight: 800; font-size: 13px; background: var(--card); color: var(--ink); min-height: 36px; }
  .tabs button.on { background: #ff8fab; color: #fff; }
  .items { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .item { border: 0; border-radius: 14px; padding: 6px 2px; background: var(--card); color: var(--ink); box-shadow: 0 2px 0 var(--shadow); display: flex; flex-direction: column; align-items: center; min-height: 64px; }
  .item span { font-size: 22px; }
  .item b { font-size: 11px; }
  .item small { font-size: 10px; color: var(--ink-soft); font-weight: 700; }
  .item:disabled { opacity: 0.45; }
  .swatches { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
  .swatches button { border: 0; border-radius: 14px; padding: 6px 2px; background: var(--card); color: var(--ink); font-size: 11px; font-weight: 800; display: flex; flex-direction: column; align-items: center; gap: 4px; box-shadow: 0 2px 0 var(--shadow); min-height: 64px; }
  .swatches button.on { outline: 3px solid #ff8fab; }
  .swatches i { width: 34px; height: 34px; border-radius: 10px; display: block; }
  .note { margin: 8px 0 0; font-size: 11px; color: var(--ink-soft); font-weight: 700; text-align: center; }
</style>
