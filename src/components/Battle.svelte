<script>
  import { untrack } from 'svelte';
  import { api } from '../lib/api.js';
  import { game } from '../lib/game.svelte.js';
  import { sfx } from '../lib/sound.js';
  import PetThumb from './PetThumb.svelte';
  import { lookOf } from '../species/index.js';
  import { MARKS, BATTLES_PER_DAY } from '../server/constants.js';
  import { moodLabel } from '../server/battle.js';
  import { BADGES } from '../server/index.js';

  let phase = $state('pick'); // pick | match | result
  let friends = $state([]);
  let board = $state([]);
  let battle = $state(null);
  let foe = $state(null);
  let rewards = $state(null);
  let queued = $state(null);
  let pops = $state([]); // floating texts over the court
  let log = $state('');
  let error = $state('');
  // what the court has shown so far (the server's battle state runs one touch ahead)
  let shown = $state({ you: 0, foe: 0, moodYou: 0, moodFoe: 0 });
  let canvas = $state();
  let court = null;
  let noCourt = $state(false);
  let popSeq = 0;
  let timer;

  let pet = $derived(game.pet);
  const inMatch = $derived(phase !== 'pick'); // the court stays up behind the result box
  const myName = () => pet.nickname || pet.genome.name;
  const nameOf = (s) => (s === 'you' ? myName() : foe.nickname);

  async function loadFriends() {
    const r = await api.opponents();
    friends = r.friends;
    board = r.board;
  }
  loadFriends();

  async function start(i) {
    error = '';
    const r = await api.startBattle(i);
    if (r.state) game.s = r.state;
    if (r.error) {
      error = r.error;
      return;
    }
    battle = r.battle;
    latest = r.battle;
    ahead = null;
    foe = r.foe;
    queued = null;
    shown = { you: battle.score.you, foe: battle.score.foe, moodYou: battle.you.mood, moodFoe: battle.foe.mood };
    log = `${foe.owner}'s ${foe.nickname} wants to play!`;
    phase = 'match';
  }

  // The court loads with the match (Three.js is its own chunk).
  $effect(() => {
    if (!inMatch || !canvas) return;
    let live = true;
    let c;
    untrack(() => {
      import('../three/court.js')
        .then(({ createCourt }) => createCourt(canvas, { onSound: sfx }))
        .then(async (made) => {
          c = made;
          if (!live) return c.dispose();
          await c.setPets(lookOf($state.snapshot(pet)), lookOf($state.snapshot(foe)), battle.rally.hitter);
          if (!live) return;
          c.setMoods({ you: shown.moodYou, foe: shown.moodFoe });
          court = c;
          if (new URLSearchParams(location.search).has('dev')) window.__court = c; // for tests
          timer = setTimeout(tick, 900);
        })
        .catch(() => {
          // no WebGL: the match still plays, as text
          noCourt = true;
          timer = setTimeout(tick, 900);
        });
    });
    return () => {
      live = false;
      clearTimeout(timer);
      court = null;
      c?.dispose();
    };
  });

  function pop(side, text, kind = '') {
    const at = court?.screenPos(side) ?? { x: side === 'you' ? 100 : 290, y: 200 };
    const p = { id: ++popSeq, text, kind, x: at.x, y: at.y };
    pops = [...pops, p];
    setTimeout(() => (pops = pops.filter((x) => x !== p)), 1100);
  }

  const POINT_TEXT = { ace: 'Ace!', kill: 'Spike!', drop: 'It drops in!', net: 'Net!', out: 'Out!' };

  /** One server event, at the moment the court shows it. */
  function onEvent(e) {
    if (e.type === 'command') {
      const n = nameOf(e.side);
      if (e.side === 'you') shown.moodYou = e.mood;
      else shown.moodFoe = e.mood;
      if (!e.ok) {
        pop(e.side, e.sulk ? 'Hmph!' : 'Not listening…', 'no');
        log = e.sulk ? `${n} sulks. Not today!` : `${n} isn't listening…`;
      } else {
        pop(e.side, e.cmd === 'cheer' ? 'Yeah!' : 'Phew…', e.cmd);
        const who = e.side === 'you' ? 'You' : foe.owner;
        log = e.cmd === 'cheer' ? `${who} cheered. ${n} perks up!` : `${who} said "easy now". ${n} takes a deep breath.`;
      }
    } else if (e.type === 'hit') {
      const n = nameOf(e.side);
      if (e.fault) log = `${n} hits it ${e.fault === 'net' ? 'into the net' : 'out'}!`;
      else log = e.shot === 'serve' ? `${n} serves!` : e.shot === 'spike' ? `${n} spikes it!` : `${n} bumps it over.`;
      if (e.shot === 'spike' && !e.fault) pop(e.side, 'Spike!', 'spike');
    } else if (e.type === 'miss') {
      log = `${nameOf(e.side)} can't reach it!`;
    } else if (e.type === 'point') {
      shown = { you: e.score.you, foe: e.score.foe, moodYou: e.mood.you, moodFoe: e.mood.foe };
      pop(e.side, POINT_TEXT[e.how] ?? 'Point!', e.side === 'you' ? 'good' : 'bad');
      log = `Point to ${nameOf(e.side)}! ${e.score.you}–${e.score.foe}`;
    } else if (e.type === 'end') {
      log = e.winner === 'you' ? `${myName()} wins the match!` : `${foe.nickname} wins this time!`;
      sfx(e.winner === 'you' ? 'win' : 'lose', 0.3);
    }
    court?.setMoods({ you: shown.moodYou, foe: shown.moodFoe });
  }

  // The next touch is fetched one step early, so the court knows whether the ball it is
  // about to send will be returned or missed. A command you press goes into the next fetch.
  let ahead = null;
  let latest = $state(null); // the newest server state: what a queued command will meet
  async function fetchStep() {
    const cmd = queued;
    queued = null;
    const r = await api.battleStep(battle.id, cmd);
    if (!r.error) latest = r.battle;
    return r;
  }

  async function tick() {
    if (!battle || battle.over) return;
    if (document.hidden) {
      timer = setTimeout(tick, 500); // wait for the player to come back
      return;
    }
    const r = ahead ?? (await fetchStep());
    ahead = null;
    if (r.error) {
      error = r.error;
      return;
    }
    if (!r.battle.over) {
      ahead = await fetchStep();
      if (ahead.error) ahead = null;
    }
    battle = r.battle;
    let ms = 900;
    if (court) ms = court.play(r.events, onEvent, ahead?.events);
    else r.events.forEach(onEvent);
    if (r.rewards) {
      rewards = r.rewards;
      game.s = r.state;
      timer = setTimeout(() => (phase = 'result'), ms + 900);
      return;
    }
    timer = setTimeout(tick, ms + 60);
  }

  const canCommand = $derived(!!latest && !latest.over && !latest.you.commanded);
  function command(c) {
    if (!canCommand || queued) return;
    queued = c;
    sfx('click');
  }

  function close() {
    clearTimeout(timer);
    game.battleOpen = false;
    game.load();
  }

  function again() {
    rewards = null;
    battle = null;
    phase = 'pick';
    loadFriends();
  }

  const moodPct = (m) => ((m + 1) / 2) * 100;
  const pct = (x) => `${Math.round(x * 100)}%`;
</script>

<div class="battle">
  {#if phase === 'pick'}
    <div class="pick">
      <header>
        <h2>Beach volleyball 🏐</h2>
        <button class="x" onclick={close} aria-label="Close">✕</button>
      </header>
      <p class="left">
        {pet.battlesLeft} of {BATTLES_PER_DAY} matches left today · 1 vs 1, first to {game.s.matchPoints} · just for bragging rights
      </p>
      <p class="bond">
        <span aria-hidden="true">♥</span> {pet.bondLabel}: {myName()} listens to you about <b>{pct(pet.obey)}</b> of the time.
        <small>Care for it every day to grow your bond.</small>
      </p>
      {#if error}<p class="error">{error}</p>
      {:else if pet.asleep}<p class="error">Shh... {myName()} is asleep. Wake them up to play.</p>
      {:else if pet.battlesLeft <= 0}<p class="error">That's all the matches for today. See you tomorrow!</p>{/if}
      <div class="friends">
        {#each friends as f, i}
          <div class="friend">
            <div class="mini"><PetThumb look={lookOf(f)} size={160} alt={f.title} /></div>
            <div class="who">
              <b>{f.owner}'s {f.nickname}</b>
              <small>{f.title} · {f.dna.temperament}</small>
              <small class="pow">
                Power {Math.round(f.playStats.power)} · Speed {Math.round(f.playStats.speed)} · Receive {Math.round(f.playStats.receive)} · Focus {Math.round(f.playStats.focus)}
              </small>
            </div>
            <button class="fight" disabled={pet.battlesLeft <= 0 || pet.asleep} onclick={() => start(i)} aria-label="Play against {f.owner}'s {f.nickname}">Play!</button>
          </div>
        {/each}
      </div>
      <h3>{game.s.season.name} · friends leaderboard</h3>
      <ol class="board">
        {#each board as row, i}
          <li class:you={row.you}><span>{i + 1}. {row.name}</span><b>{row.wins} wins</b></li>
        {/each}
      </ol>
    </div>
  {:else}
    <div class="match">
      <canvas bind:this={canvas} class="court" aria-label="Volleyball court: {myName()} against {foe.nickname}"></canvas>
      {#if noCourt}<p class="nocourt">This device can't show the 3D court, but the match goes on!</p>{/if}

      <header class="score" aria-live="polite">
        <div class="team">
          <b>{myName()}</b>
          <span class="meter" title="Mood: {moodLabel(shown.moodYou)}"><i style="left:{moodPct(shown.moodYou)}%"></i></span>
          <small>{moodLabel(shown.moodYou)}</small>
        </div>
        <div class="nums"><span>{shown.you} – {shown.foe}</span><small>first to {game.s.matchPoints}</small></div>
        <div class="team right">
          <b>{foe.nickname}</b>
          <span class="meter" title="Mood: {moodLabel(shown.moodFoe)}"><i style="left:{moodPct(shown.moodFoe)}%"></i></span>
          <small>{moodLabel(shown.moodFoe)}</small>
        </div>
      </header>

      {#each pops as p (p.id)}<span class="pop {p.kind}" style="left:{p.x}px; top:{p.y}px">{p.text}</span>{/each}

      <div class="bottom">
        <p class="log">{log}</p>
        <div class="moves">
          {#each [['cheer', '📣', 'Cheer', 'Pumps it up'], ['calm', '🍃', 'Calm', 'Back to focus']] as [c, icon, label, hint]}
            <button
              disabled={!canCommand || (queued && queued !== c)}
              class:queued={queued === c}
              onclick={() => command(c)}
              aria-label="{label}: {hint}"
            ><span>{icon}</span><b>{label}</b><small>{queued === c ? 'Ready!' : canCommand ? hint : 'Next point'}</small></button>
          {/each}
        </div>
        <p class="tip">
          Nervous? Cheer. Too excited? Calm. ♥ {pet.bondLabel}: listens ~{pct(battle.you.obey)} · one command per point
        </p>
      </div>
    </div>

    {#if phase === 'result'}
      <div class="result">
        <div class="box">
          <h2>{rewards.winner === 'you' ? 'Victory! 🎉' : 'Good game!'}</h2>
          <p class="final">{shown.you} – {shown.foe}</p>
          <p>
            {rewards.winner === 'you'
              ? `${myName()} is bouncing with pride.`
              : `${myName()} had fun anyway. Next time!`}
          </p>
          {#if rewards.wish}<p class="reward">💖 Wish granted: it wanted a match! Bond +3</p>{/if}
          {#if rewards.bond > 0}<p class="reward">♥ Playing together grew your bond</p>{/if}
          {#each rewards.marks as m}<p class="reward">✨ New memory mark: <b>{MARKS[m].label}</b></p>{/each}
          {#each rewards.badges as b}<p class="reward">🏅 New badge: <b>{BADGES[b].label}</b></p>{/each}
          <p class="rec">Record {rewards.record.wins}W · {rewards.record.losses}L · streak {rewards.record.streak}</p>
          <div class="btns">
            {#if pet.battlesLeft > 0}<button class="alt" onclick={again}>Another</button>{/if}
            <button onclick={close}>Back home</button>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .battle {
    position: fixed;
    inset: 0;
    z-index: 30;
    background: linear-gradient(#bfe6ff 0 55%, #f1d9a4 55% 100%);
    overflow: hidden;
    animation: fade 0.25s;
  }
  @keyframes fade { from { opacity: 0; } }
  .pick {
    position: absolute;
    inset: 0;
    overflow-y: auto;
    background: var(--sheet);
    padding: calc(12px + env(safe-area-inset-top)) 16px calc(20px + env(safe-area-inset-bottom));
  }
  header { display: flex; justify-content: space-between; align-items: center; }
  h2 { margin: 0; }
  h3 { margin: 22px 0 8px; font-size: 15px; }
  .x { width: 44px; height: 44px; border-radius: 50%; border: 0; background: var(--card); color: var(--ink); font-weight: 900; font-size: 16px; }
  .left { color: var(--ink-soft); font-weight: 700; font-size: 13px; margin: 6px 0 10px; }
  .bond { background: var(--card); border-radius: 14px; padding: 10px 12px; margin: 0 0 12px; font-weight: 700; font-size: 14px; box-shadow: 0 3px 0 var(--shadow); }
  .bond span { color: #ff6b9a; }
  .bond small { display: block; color: var(--ink-soft); font-size: 12px; }
  .error { background: #ffe0e6; color: #a02848; padding: 8px 12px; border-radius: 12px; font-weight: 800; }
  .friends { display: grid; gap: 10px; }
  .friend { display: flex; align-items: center; gap: 10px; background: var(--card); border-radius: 18px; padding: 8px 10px; box-shadow: 0 3px 0 var(--shadow); }
  .mini { width: 70px; height: 70px; flex-shrink: 0; }
  .who { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .who small { color: var(--ink-soft); font-weight: 700; font-size: 12px; text-transform: capitalize; }
  .who .pow { text-transform: none; font-size: 11px; }
  .fight { border: 0; border-radius: 14px; min-height: 44px; padding: 10px 14px; font-weight: 800; background: #ff8fab; color: #fff; box-shadow: 0 3px 0 #d4607f; }
  .fight:disabled { opacity: 0.4; }
  .board { list-style: none; padding: 0; margin: 0; display: grid; gap: 4px; }
  .board li { display: flex; justify-content: space-between; background: var(--card); padding: 8px 12px; border-radius: 12px; font-weight: 700; font-size: 14px; }
  .board li.you { background: #fff3b0; color: #4a3a00; }

  .match { position: absolute; inset: 0; color: #2b2b3a; }
  .court { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
  .nocourt { position: absolute; top: 40%; left: 16px; right: 16px; text-align: center; font-weight: 800; }
  .score {
    position: absolute; left: 0; right: 0; top: 0;
    padding: calc(10px + env(safe-area-inset-top)) 10px 0;
    display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px; align-items: start;
  }
  .team { background: rgba(255, 255, 255, 0.92); border-radius: 16px; padding: 6px 10px; display: flex; flex-direction: column; gap: 3px; min-width: 0; box-shadow: 0 3px 0 rgba(0, 0, 0, 0.1); }
  .team b { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .team small { font-size: 11px; font-weight: 800; color: #6a5a6a; }
  .team.right { text-align: right; }
  .meter { position: relative; display: block; height: 8px; border-radius: 6px; background: linear-gradient(90deg, #6aa8ff, #5ccf8a 40% 60%, #ff9a4a); }
  .meter i { position: absolute; top: -3px; width: 6px; height: 14px; margin-left: -3px; border-radius: 3px; background: #2b2b3a; border: 1px solid #fff; transition: left 0.5s; }
  .nums { background: #2b2b3a; color: #fff; border-radius: 16px; padding: 4px 12px; font-size: 26px; font-weight: 900; text-align: center; font-variant-numeric: tabular-nums; display: flex; flex-direction: column; align-items: center; }
  .nums span { white-space: nowrap; }
  .nums small { font-size: 10px; font-weight: 700; opacity: 0.75; }
  .pop { position: absolute; transform: translate(-50%, -100%); font-weight: 900; font-size: 20px; color: #fff; text-shadow: 0 2px 0 #333, 0 0 6px #333; animation: popup 1.1s ease-out forwards; white-space: nowrap; pointer-events: none; z-index: 3; }
  .pop.spike { color: #ffd34d; font-size: 24px; }
  .pop.good { color: #8fe06a; font-size: 26px; }
  .pop.bad { color: #ff8fab; font-size: 22px; }
  .pop.cheer { color: #ffd34d; }
  .pop.calm { color: #8fd0ff; }
  .pop.no { color: #ffffff; font-size: 16px; }
  @keyframes popup { from { transform: translate(-50%, -80%) scale(0.6); } 25% { transform: translate(-50%, -110%) scale(1.1); } to { transform: translate(-50%, -190%); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .pop { animation: none; } .meter i { transition: none; } }
  .bottom { position: absolute; left: 0; right: 0; bottom: 0; padding: 0 12px calc(12px + env(safe-area-inset-bottom)); }
  .log { text-align: center; font-weight: 800; background: rgba(255, 255, 255, 0.92); border-radius: 14px; padding: 8px 12px; margin: 0 0 8px; min-height: 1.4em; font-size: 14px; }
  .moves { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .moves button { border: 0; border-radius: 18px; min-height: 64px; padding: 6px 4px; background: #fff; color: #2b2b3a; box-shadow: 0 4px 0 rgba(0, 0, 0, 0.15); display: flex; flex-direction: column; align-items: center; }
  .moves button span { font-size: 24px; line-height: 1.1; }
  .moves button small { font-size: 11px; font-weight: 700; color: #6a5a6a; }
  .moves button:disabled { opacity: 0.45; }
  .moves button.queued { background: #fff3b0; transform: translateY(3px); box-shadow: 0 1px 0 rgba(0, 0, 0, 0.15); opacity: 1; }
  .tip { margin: 8px 0 0; text-align: center; font-size: 11px; font-weight: 800; color: #5a4a3a; }

  .result { position: absolute; inset: 0; background: rgba(40, 20, 40, 0.45); display: grid; place-items: center; padding: 16px; animation: fade 0.3s; z-index: 5; }
  .box { width: 100%; max-width: 360px; background: var(--sheet); color: var(--ink); border-radius: 24px; padding: 20px; text-align: center; box-shadow: 0 6px 0 var(--shadow); }
  .box p { font-weight: 700; color: var(--ink-soft); }
  .box .final { font-size: 30px; font-weight: 900; color: var(--ink); margin: 4px 0; }
  .box .reward { background: #fff3c4; color: #5a4310; border-radius: 12px; padding: 8px; }
  .rec { font-size: 13px; }
  .btns { display: flex; gap: 8px; }
  .btns button { flex: 1; border: 0; border-radius: 16px; padding: 14px; font-size: 16px; font-weight: 800; background: #ff8fab; color: #fff; box-shadow: 0 4px 0 #d4607f; }
  .btns .alt { background: var(--card); color: var(--ink); box-shadow: 0 4px 0 var(--shadow); }
</style>
