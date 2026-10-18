<script>
  import { api } from '../lib/api.js';
  import { game } from '../lib/game.svelte.js';
  import PetThumb from './PetThumb.svelte';
  import { lookOf } from '../species/index.js';
  import { MARKS } from '../server/constants.js';
  import { BADGES } from '../server/index.js';

  const STEP_MS = 850;
  let phase = $state('pick'); // pick | fight | result
  let friends = $state([]);
  let board = $state([]);
  let battle = $state(null);
  let foe = $state(null);
  let rewards = $state(null);
  let queued = $state(null);
  let pops = $state([]); // floating texts
  let anim = $state({ you: null, foe: null });
  let log = $state('');
  let error = $state('');
  let popSeq = 0;
  let timer;

  let pet = $derived(game.pet);

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
    foe = r.foe;
    queued = null;
    log = `${foe.owner}'s ${foe.nickname} wants to play!`;
    phase = 'fight';
    timer = setTimeout(tick, 1200);
  }

  function pop(side, text, kind = '') {
    const p = { id: ++popSeq, side, text, kind };
    pops = [...pops, p];
    setTimeout(() => (pops = pops.filter((x) => x !== p)), 900);
  }
  function animate(side, name) {
    anim = { ...anim, [side]: name };
    setTimeout(() => anim[side] === name && (anim = { ...anim, [side]: null }), 420);
  }
  const other = (s) => (s === 'you' ? 'foe' : 'you');
  const nameOf = (s) => (s === 'you' ? pet.nickname || pet.genome.name : foe.nickname);
  const MOVE_TEXT = { cheer: 'Cheer!', shield: 'Shield up!', snack: 'Snack!' };

  async function tick() {
    const move = queued;
    queued = null;
    const r = await api.battleStep(battle.id, move);
    if (r.error) {
      error = r.error;
      return;
    }
    battle = r.battle;
    for (const e of r.events) {
      if (e.type === 'move') {
        if (e.ignored) {
          pop(e.side, 'Hmph!', 'grumpy');
          log = `${nameOf(e.side)} is too grumpy to listen...`;
        } else {
          pop(e.side, MOVE_TEXT[e.move] + (e.heal ? ` +${e.heal}` : ''), e.move);
          log = `${nameOf(e.side)} used ${e.move}!`;
        }
      } else if (e.type === 'hit') {
        animate(e.side, 'lunge');
        animate(other(e.side), 'hurt');
        pop(other(e.side), `-${e.dmg}`, e.crit ? 'crit' : 'dmg');
        log = e.crit ? `Critical bonk from ${nameOf(e.side)}!` : `${nameOf(e.side)} bonks for ${e.dmg}!`;
      } else if (e.type === 'miss') {
        animate(e.side, 'lunge');
        animate(other(e.side), 'dodge');
        pop(other(e.side), 'Dodged!');
        log = `${nameOf(other(e.side))} dodged!`;
      } else if (e.type === 'block') {
        animate(e.side, 'lunge');
        pop(other(e.side), 'Blocked!', 'shield');
        log = `${nameOf(other(e.side))}'s shield blocked it!`;
      }
    }
    if (r.rewards) {
      rewards = r.rewards;
      game.s = r.state;
      log = rewards.winner === 'you' ? `${nameOf('you')} wins!` : `${foe.nickname} wins this time!`;
      timer = setTimeout(() => (phase = 'result'), 1400);
      return;
    }
    timer = setTimeout(tick, STEP_MS);
  }

  $effect(() => () => clearTimeout(timer));

  function useMove(m) {
    if (!battle.you.moves[m] || queued) return;
    queued = m;
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

  const hpPct = (f) => Math.max(0, (f.hp / f.stats.hp) * 100);
</script>

<div class="battle">
  {#if phase === 'pick'}
    <div class="pick">
      <header>
        <h2>Friendly battle</h2>
        <button class="x" onclick={close} aria-label="Close">✕</button>
      </header>
      <p class="left">{pet.battlesLeft} of 5 battles left today · rewards are just for bragging</p>
      {#if error}<p class="error">{error}</p>
      {:else if pet.asleep}<p class="error">Shh... {pet.nickname || pet.genome.name} is asleep. Wake them up to battle.</p>
      {:else if pet.battlesLeft <= 0}<p class="error">That's all the battles for today. See you tomorrow!</p>{/if}
      <div class="friends">
        {#each friends as f, i}
          <div class="friend">
            <div class="mini"><PetThumb look={lookOf(f)} size={160} alt={f.title} /></div>
            <div class="who">
              <b>{f.owner}'s {f.nickname}</b>
              <small>{f.title} · {f.dna.temperament}</small>
              <small class="pow">HP {Math.round(f.battleStats.hp)} · ATK {Math.round(f.battleStats.atk)} · DEF {Math.round(f.battleStats.def)}</small>
            </div>
            <button class="fight" disabled={pet.battlesLeft <= 0 || pet.asleep} onclick={() => start(i)}>Battle!</button>
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
  {:else if phase === 'fight' || phase === 'result'}
    <div class="arena">
      <div class="side foe">
        <div class="hud">
          <b>{foe.nickname}</b><small>{foe.title}</small>
          <span class="hp"><i style="width:{hpPct(battle.foe)}%"></i></span>
          <small>{battle.foe.hp}/{battle.foe.stats.hp}</small>
        </div>
        <div class="fighter anim-{anim.foe}" class:shielded={battle.foe.shielded}>
          <PetThumb look={lookOf(foe)} yaw={-0.7} alt={foe.title} />
          {#each pops.filter((p) => p.side === 'foe') as p, i (p.id)}<span class="pop {p.kind}" style="top:{10 + i * 18}%">{p.text}</span>{/each}
        </div>
      </div>
      <div class="side you">
        <div class="fighter anim-{anim.you}" class:shielded={battle.you.shielded} class:cheered={battle.you.cheered}>
          <PetThumb look={lookOf(pet)} yaw={0.7} alt={pet.title} />
          {#each pops.filter((p) => p.side === 'you') as p, i (p.id)}<span class="pop {p.kind}" style="top:{10 + i * 18}%">{p.text}</span>{/each}
        </div>
        <div class="hud">
          <b>{pet.nickname || pet.genome.name}</b><small>{pet.title}</small>
          <span class="hp"><i style="width:{hpPct(battle.you)}%"></i></span>
          <small>{battle.you.hp}/{battle.you.stats.hp}</small>
        </div>
      </div>
      <p class="log">{log}</p>
      <div class="moves">
        {#each [['cheer', '📣', 'Cheer', 'Next hit stronger'], ['shield', '🛡️', 'Shield', 'Block next hit'], ['snack', '🍪', 'Snack', 'Heal 30%']] as [m, icon, label, hint]}
          <button
            disabled={!battle.you.moves[m] || battle.over}
            class:queued={queued === m}
            onclick={() => useMove(m)}
          ><span>{icon}</span><b>{label}</b><small>{battle.you.moves[m] ? hint : 'Used'}</small></button>
        {/each}
      </div>
    </div>

    {#if phase === 'result'}
      <div class="result">
        <div class="box">
          <h2>{rewards.winner === 'you' ? 'Victory! 🎉' : 'Good game!'}</h2>
          <p>
            {rewards.winner === 'you'
              ? `${pet.nickname || pet.genome.name} is bouncing with pride.`
              : `${pet.nickname || pet.genome.name} had fun anyway. Next time!`}
          </p>
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
    background: linear-gradient(#bfe6ff 0 52%, #a6dc86 52% 100%);
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
  .x { width: 38px; height: 38px; border-radius: 50%; border: 0; background: var(--card); color: var(--ink); font-weight: 900; font-size: 16px; }
  .left { color: var(--ink-soft); font-weight: 700; font-size: 13px; margin: 6px 0 12px; }
  .error { background: #ffe0e6; color: #a02848; padding: 8px 12px; border-radius: 12px; font-weight: 800; }
  .friends { display: grid; gap: 10px; }
  .friend { display: flex; align-items: center; gap: 10px; background: var(--card); border-radius: 18px; padding: 8px 10px; box-shadow: 0 3px 0 var(--shadow); }
  .mini { width: 70px; height: 70px; flex-shrink: 0; }
  .who { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .who small { color: var(--ink-soft); font-weight: 700; font-size: 12px; text-transform: capitalize; }
  .who .pow { text-transform: none; }
  .fight { border: 0; border-radius: 14px; padding: 10px 12px; font-weight: 800; background: #ff8fab; color: #fff; box-shadow: 0 3px 0 #d4607f; }
  .fight:disabled { opacity: 0.4; }
  .board { list-style: none; padding: 0; margin: 0; display: grid; gap: 4px; }
  .board li { display: flex; justify-content: space-between; background: var(--card); padding: 8px 12px; border-radius: 12px; font-weight: 700; font-size: 14px; }
  .board li.you { background: #fff3b0; color: #4a3a00; }

  .arena { position: absolute; inset: 0; display: flex; flex-direction: column; padding: calc(14px + env(safe-area-inset-top)) 14px calc(14px + env(safe-area-inset-bottom)); color: #2b2b3a; }
  .side { display: flex; align-items: center; gap: 8px; flex: 1; min-height: 0; }
  .side { justify-content: space-between; }
  .hud { background: rgba(255, 255, 255, 0.9); border-radius: 16px; padding: 8px 12px; min-width: 130px; max-width: 46vw; box-shadow: 0 3px 0 rgba(0, 0, 0, 0.1); display: flex; flex-direction: column; }
  .hud small { font-size: 11px; font-weight: 700; color: #6a5a6a; }
  .hp { display: block; height: 10px; border-radius: 6px; background: #e8dde4; overflow: hidden; margin: 4px 0 2px; }
  .hp i { display: block; height: 100%; background: linear-gradient(90deg, #5ccf8a, #8fe06a); transition: width 0.4s; }
  .fighter { position: relative; width: min(42vw, 30vh, 200px); aspect-ratio: 1; flex-shrink: 0; }
  .fighter.shielded::after { content: ''; position: absolute; inset: -4%; border-radius: 50%; border: 4px solid rgba(90, 170, 255, 0.8); background: rgba(150, 200, 255, 0.2); animation: pulse 1s infinite; }
  .fighter.cheered { filter: drop-shadow(0 0 10px #ffd34d); }
  @keyframes pulse { 50% { transform: scale(1.05); } }
  .you .anim-lunge { animation: lungeR 0.4s ease-out; }
  .foe .anim-lunge { animation: lungeL 0.4s ease-out; }
  @keyframes lungeR { 40% { transform: translate(18%, -12%); } }
  @keyframes lungeL { 40% { transform: translate(-18%, 12%); } }
  .anim-hurt { animation: hurt 0.4s ease-out; }
  @keyframes hurt { 20%, 60% { transform: translateX(-6%); filter: brightness(1.8); } 40%, 80% { transform: translateX(6%); } }
  .anim-dodge { animation: dodge 0.4s ease-out; }
  @keyframes dodge { 40% { transform: translateY(-20%) scale(0.9); } }
  .pop { position: absolute; left: 50%; top: 10%; transform: translateX(-50%); font-weight: 900; font-size: 22px; color: #fff; text-shadow: 0 2px 0 #333, 0 0 6px #333; animation: popup 0.9s ease-out forwards; white-space: nowrap; pointer-events: none; }
  .pop.crit { color: #ffd34d; font-size: 28px; }
  .pop.dmg { color: #ff6b8a; }
  .pop.snack { color: #8fe06a; }
  .pop.shield { color: #8fd0ff; }
  .pop.cheer { color: #ffd34d; }
  @keyframes popup { from { transform: translate(-50%, 10px) scale(0.6); } 30% { transform: translate(-50%, -10px) scale(1.1); } to { transform: translate(-50%, -40px); opacity: 0; } }
  .log { text-align: center; font-weight: 800; background: rgba(255, 255, 255, 0.9); border-radius: 14px; padding: 8px 12px; margin: 6px 0 10px; min-height: 1.4em; }
  .moves { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .moves button { border: 0; border-radius: 18px; padding: 8px 4px; background: #fff; color: #2b2b3a; box-shadow: 0 4px 0 rgba(0, 0, 0, 0.15); display: flex; flex-direction: column; align-items: center; }
  .moves button span { font-size: 26px; }
  .moves button small { font-size: 10px; font-weight: 700; color: #6a5a6a; }
  .moves button:disabled { opacity: 0.4; }
  .moves button.queued { background: #fff3b0; transform: translateY(3px); box-shadow: 0 1px 0 rgba(0, 0, 0, 0.15); }

  .result { position: absolute; inset: 0; background: rgba(40, 20, 40, 0.45); display: grid; place-items: center; padding: 16px; animation: fade 0.3s; }
  .box { width: 100%; max-width: 360px; background: var(--sheet); color: var(--ink); border-radius: 24px; padding: 20px; text-align: center; box-shadow: 0 6px 0 var(--shadow); }
  .box p { font-weight: 700; color: var(--ink-soft); }
  .box .reward { background: #fff3c4; color: #5a4310; border-radius: 12px; padding: 8px; }
  .rec { font-size: 13px; }
  .btns { display: flex; gap: 8px; }
  .btns button { flex: 1; border: 0; border-radius: 16px; padding: 14px; font-size: 16px; font-weight: 800; background: #ff8fab; color: #fff; box-shadow: 0 4px 0 #d4607f; }
  .btns .alt { background: var(--card); color: var(--ink); box-shadow: 0 4px 0 var(--shadow); }
</style>
