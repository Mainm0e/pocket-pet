<script>
  import { untrack } from 'svelte';
  import { game } from '../lib/game.svelte.js';
  import { sfx, played } from '../lib/sound.js';
  import { lookOf } from '../species/index.js';
  import Meters from './Meters.svelte';
  import Sheet from './Sheet.svelte';
  import MoreSheet from './MoreSheet.svelte';
  import StatsSheet from './StatsSheet.svelte';
  import PetCard from './PetCard.svelte';
  import Decorate from './Decorate.svelte';

  let pet = $derived(game.pet);
  let canvas;
  let stage = $state(null);
  let failed = $state(false);
  let anchor = $state({ x: -999, y: -999 });
  let firstRoom = true;
  const egg = $derived(pet?.stage === 'egg');

  // The 3D room loads on demand (Three.js is its own chunk).
  $effect(() => {
    let st;
    let live = true;
    import('../three/stage.js')
      .then(({ createStage }) =>
        createStage(canvas, {
          onTapPet: tapPet,
          onTapPoop: (id) => game.act('clean', id),
          onTapItem: tapItem,
          onAnchor: (a) => (anchor = a),
          onSelect: (id) => (selected = id),
          onItemMoved: (id, x, z) => decorate?.moved(id, x, z),
          onSound: sfx,
        })
      )
      .then((s) => {
        if (!live) return s.dispose();
        st = s;
        stage = s;
        if (new URLSearchParams(location.search).has('dev')) {
          window.__stage = s; // for tests
          window.__sfx = played;
        }
      })
      .catch(() => (failed = true));
    return () => {
      live = false;
      st?.dispose();
    };
  });

  // Show what the server says: the pet's look, the room, and effects.
  $effect(() => {
    if (stage && pet) stage.setPet(lookOf($state.snapshot(pet)));
  });
  $effect(() => {
    if (!stage || !pet) return;
    stage.setRoom({
      asleep: pet.asleep,
      weather: game.s.weather,
      poops: $state.snapshot(pet.poops),
      temperament: pet.dna.temperament,
      care: $state.snapshot(pet.care),
      bond: pet.bond,
      instant: firstRoom,
    });
    firstRoom = false;
  });
  // The room layout: the saved one, or the draft while decorating.
  let selected = $state(null);
  let decorate = $state(null);
  $effect(() => {
    if (stage && !game.decorating) stage.setLayout($state.snapshot(game.s.room));
  });
  $effect(() => {
    stage?.setEditMode(game.decorating);
  });
  $effect(() => {
    const f = game.fx;
    if (stage && f) untrack(() => stage.play(f.name));
  });
  $effect(() => {
    stage?.setPaused(!!(game.battleOpen || game.evolution));
  });
  // The welcome back waits until the pet is actually on screen (the model loads in the background).
  $effect(() => {
    const g = game.greet;
    if (!g || !stage || anchor.x <= -999 || game.battleOpen) return;
    untrack(() => {
      game.greet = null;
      setTimeout(() => {
        game.play(g.fx, 4000);
        game.say(g.line, 2600);
      }, 500);
    });
  });

  // Idle chatter that hints at needs.
  $effect(() => {
    const iv = setInterval(() => {
      if (!pet || pet.stage === 'egg' || pet.asleep || game.bubble || game.fx || game.sheet || game.decorating) return;
      if (Math.random() < 0.55) return;
      const c = pet.care;
      const hungry = game.s.now - pet.lastFed > 6 * 3600_000;
      const lines = [];
      if (hungry || c.health < 35) lines.push("I'm hungry...");
      if (c.energy < 25) lines.push('So sleepy...');
      if (c.happiness < 40) lines.push('Play with me?');
      if (pet.poops.length >= 2) lines.push('Ew, messy!');
      if (pet.wish && !pet.wish.done && Math.random() < 0.5) lines.push(pet.wish.ask);
      if (c.comfort < 30) lines.push('I feel icky... bath?');
      if (!lines.length) {
        lines.push(pet.genome.species === 'shiba' ? 'Wan!' : 'Puni puni!', 'Hehe', '*wiggle*', 'I like it here!');
        if (game.s.weather === 'rain') lines.push(pet.dna.quirk === 'loves_rain' ? 'Rain! Rain!' : 'Pitter patter...');
        if (game.s.night) lines.push(pet.dna.quirk === 'night_owl' ? 'Night time is the best!' : "It's dark out...");
      }
      game.say(lines[Math.floor(Math.random() * lines.length)], 2600);
    }, 8000);
    return () => clearInterval(iv);
  });

  // Tapping furniture: some do real care actions (checked by the server), the rest are just fun.
  const WEATHER_LINES = { sun: ['What a sunny day!', 'So bright out there!'], cloudy: ['Cloudy today...', 'Fluffy clouds!'], rain: ['Pitter patter!', 'Rain, rain!'] };
  function tapItem(kind, id) {
    if (!pet || pet.stage === 'egg' || game.decorating) return;
    if (pet.asleep && kind !== 'bed') return game.say('Zzz...');
    switch (kind) {
      case 'bowl':
        return game.act('feed');
      case 'ball':
        return game.act('play');
      case 'bed':
        return game.act('sleep');
      case 'lamp': {
        const room = $state.snapshot(game.s.room);
        const lamp = room.items.find((i) => i.id === id);
        if (lamp) lamp.on = lamp.on === false;
        return game.saveRoom(room);
      }
      case 'window': {
        const night = game.s.night;
        const lines = night ? ['Look at the stars!', 'The moon is out!'] : WEATHER_LINES[game.s.weather] ?? WEATHER_LINES.sun;
        return setTimeout(() => game.say(lines[Math.floor(Math.random() * lines.length)], 2400), 900);
      }
      case 'plant':
        return game.say('Sniff sniff...', 1600);
      case 'toybox':
        return game.say('Toys!', 1400);
      case 'cushion':
        return setTimeout(() => game.say('Comfy!', 1600), 900);
      default:
        return null;
    }
  }

  function tapPet() {
    if (pet.stage === 'egg') return game.hatchTap();
    if (pet.asleep) return game.say('Zzz...');
    game.play('squish', 600);
    game.act('pat'); // pats grow the bond a little (the server caps it)
    // a pet that doesn't know you well yet is a bit jumpy about it
    const lines = pet.bond < 25 && Math.random() < 0.5 ? ['Eep!', 'Oh!', '...!'] : pet.bond >= 75 ? ['Hehe!', 'I love pats!', 'More, more!', '♥'] : ['Hehe!', 'Squish!', 'That tickles!', 'More pats!'];
    game.say(lines[Math.floor(Math.random() * lines.length)], 1400);
  }
</script>

<div class="room">
  <canvas bind:this={canvas} aria-label="Your pet's room. Tap the pet to pat it, tap messes to clean them."></canvas>
  {#if failed}
    <p class="fail">This device can't show the 3D room (WebGL is off).</p>
  {/if}

  {#if game.bubble && anchor.x > -999}
    {#key game.bubble.id}
      <div class="bubble" style="left:{anchor.x}px; top:{anchor.y}px">{game.bubble.text}</div>
    {/key}
  {/if}

  {#if game.decorating}
    <Decorate bind:this={decorate} {stage} {selected} />
  {:else}
  <header class="top">
    <button class="name" onclick={() => !egg && (game.sheet = 'card')}>
      <strong>{pet.nickname || (egg ? 'Mystery egg' : pet.genome.speciesLabel)}</strong>
      <small>{pet.title}</small>
    </button>
    {#if !egg}
      <Meters care={pet.care} onclick={() => (game.sheet = 'stats')} />
    {/if}
  </header>

  {#if !egg && pet.wish}
    <button
      class="wish"
      class:done={pet.wish.done}
      data-kind={pet.wish.kind}
      onclick={() => game.say(pet.wish.done ? 'That was the best!' : pet.wish.ask, 2200)}
      aria-label={pet.wish.done ? "Today's wish is granted" : `Today's wish: ${pet.wish.label}`}
    >
      {#if pet.wish.done}
        💖 Wish granted!
      {:else}
        💭 Wants {pet.wish.label} {pet.wish.icon}{#if pet.wish.kind === 'pat'} <small>{pet.wish.pats}/{pet.wish.need}</small>{/if}
      {/if}
    </button>
  {/if}

  {#if game.toast}
    {#key game.toast.id}<div class="toast">{game.toast.text}</div>{/key}
  {/if}

  {#if egg}
    <div class="egg-hint">
      Tap the egg to help it hatch!
      <span class="dots">
        {#each Array(5) as _, i}<i class:on={i < pet.hatchTaps}></i>{/each}
      </span>
    </div>
  {:else}
    <nav class="actions">
      <button onclick={() => game.act('feed')}><span>🍙</span>Feed</button>
      <button onclick={() => game.act('play')}><span>🎾</span>Play</button>
      <button onclick={() => game.act('sleep')} class:active={pet.asleep}>
        <span>{pet.asleep ? '☀️' : '🌙'}</span>{pet.asleep ? 'Wake' : 'Sleep'}
      </button>
      <button onclick={() => (game.sheet = 'more')}><span>•••</span>More</button>
    </nav>
  {/if}
  {/if}
</div>

{#if game.sheet === 'more'}
  <Sheet title="More" onclose={() => (game.sheet = null)}><MoreSheet /></Sheet>
{:else if game.sheet === 'stats'}
  <Sheet title="Stats" onclose={() => (game.sheet = null)}><StatsSheet {pet} /></Sheet>
{:else if game.sheet === 'card'}
  <Sheet title="Pet card" onclose={() => (game.sheet = null)}><PetCard {pet} /></Sheet>
{/if}

<style>
  .room {
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: var(--wall);
    user-select: none;
    -webkit-user-select: none;
  }
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    touch-action: none;
  }
  .fail {
    position: absolute;
    top: 40%;
    left: 16px;
    right: 16px;
    text-align: center;
    font-weight: 800;
  }
  .bubble {
    position: absolute;
    transform: translate(-50%, calc(-100% - 10px));
    padding: 8px 14px;
    border-radius: 18px;
    background: var(--card);
    color: var(--ink);
    font-weight: 800;
    font-size: 15px;
    white-space: nowrap;
    box-shadow: 0 4px 0 var(--shadow);
    animation: pop 0.25s ease-out;
    z-index: 4;
    pointer-events: none;
  }
  .bubble::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -7px;
    border: 7px solid transparent;
    border-top-color: var(--card);
  }
  @keyframes pop {
    from { transform: translate(-50%, calc(-100% - 10px)) scale(0.4); opacity: 0; }
  }
  .top {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    padding: calc(10px + env(safe-area-inset-top)) 12px 0;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
    z-index: 6;
    pointer-events: none;
  }
  .top > :global(*) { pointer-events: auto; }
  .name {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 8px 14px;
    border-radius: 16px;
    border: 0;
    background: var(--card);
    color: var(--ink);
    box-shadow: 0 3px 0 var(--shadow);
    text-align: left;
    max-width: 58vw;
  }
  .name strong { font-size: 18px; }
  .name small { font-size: 12px; color: var(--ink-soft); font-weight: 700; }
  .wish {
    position: absolute;
    left: 12px;
    top: calc(78px + env(safe-area-inset-top));
    z-index: 6;
    min-height: 44px;
    padding: 6px 14px;
    border-radius: 999px;
    border: 0;
    background: var(--card);
    color: var(--ink);
    font-weight: 800;
    font-size: 13px;
    box-shadow: 0 3px 0 var(--shadow);
    max-width: calc(100vw - 24px);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    animation: float 3s ease-in-out infinite;
  }
  .wish small { color: var(--ink-soft); font-weight: 800; }
  .wish.done { background: #ffe3ef; color: #8a2050; animation: none; }
  @keyframes float { 50% { transform: translateY(-3px); } }
  @media (prefers-reduced-motion: reduce) { .wish { animation: none; } }
  .toast {
    position: absolute;
    left: 50%;
    top: calc(132px + env(safe-area-inset-top));
    transform: translateX(-50%);
    padding: 8px 16px;
    border-radius: 999px;
    background: var(--ink);
    color: var(--card);
    font-weight: 800;
    font-size: 14px;
    z-index: 8;
    white-space: nowrap;
    max-width: calc(100vw - 32px);
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .actions {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    justify-content: space-evenly;
    padding: 0 8px calc(14px + env(safe-area-inset-bottom));
    z-index: 6;
  }
  .actions button {
    width: 68px;
    height: 68px;
    border-radius: 50%;
    border: 0;
    background: var(--card);
    color: var(--ink);
    box-shadow: 0 5px 0 var(--shadow);
    font-size: 11px;
    font-weight: 800;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    transition: transform 0.08s;
    -webkit-tap-highlight-color: transparent;
  }
  .actions button span { font-size: 26px; line-height: 1.1; }
  .actions button:active { transform: translateY(4px); box-shadow: 0 1px 0 var(--shadow); }
  .actions button.active { background: #fff3b0; color: #3a2a3a; }
  .egg-hint {
    position: absolute;
    left: 50%;
    bottom: calc(28px + env(safe-area-inset-bottom));
    transform: translateX(-50%);
    padding: 10px 18px;
    border-radius: 999px;
    background: var(--card);
    font-weight: 800;
    color: var(--ink);
    box-shadow: 0 4px 0 var(--shadow);
    display: flex;
    gap: 10px;
    align-items: center;
    white-space: nowrap;
  }
  .dots { display: flex; gap: 4px; }
  .dots i { width: 9px; height: 9px; border-radius: 50%; background: var(--shadow); }
  .dots i.on { background: #ff8fab; }
</style>
