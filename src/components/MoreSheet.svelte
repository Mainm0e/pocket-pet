<script>
  import { game } from '../lib/game.svelte.js';
  import { isMuted, setMuted, sfx } from '../lib/sound.js';
  let muted = $state(isMuted());
  // reminders load on demand (they're not needed to play)
  const canRemind = 'Notification' in window && 'serviceWorker' in navigator && 'caches' in window;
  const loadReminders = () => import('../lib/reminders.js');
  let reminding = $state(false);
  if (canRemind) loadReminders().then((m) => (reminding = m.isOn()));
  async function toggleReminders() {
    const reminders = await loadReminders();
    if (reminding) {
      await reminders.turnOff();
      reminding = false;
      return;
    }
    const r = await reminders.turnOn();
    reminding = r === 'on';
    if (r === 'denied') game.showToast('Notifications are blocked. Allow them in your browser settings.');
    else if (r === 'on') game.showToast("We'll remind you when your pet needs you 🔔");
  }
  const toggleSound = () => {
    setMuted(!muted);
    muted = isMuted();
    sfx('pop');
  };
  const run = (action) => {
    game.sheet = null;
    setTimeout(() => game.act(action), 150);
  };
</script>

<div class="grid">
  <button onclick={() => run('train')}><span>🏋️</span><b>Train</b><small>Builds Strong</small></button>
  <button onclick={() => run('bath')}><span>🛁</span><b>Bath</b><small>Builds Calm</small></button>
  <button onclick={() => { game.sheet = null; game.battleOpen = true; }}>
    <span>🏐</span><b>Volleyball</b><small>{game.pet.battlesLeft} left today</small>
  </button>
  <button onclick={() => (game.sheet = 'card')}><span>🪪</span><b>Pet card</b><small>DNA & marks</small></button>
  <button class="wide" onclick={() => { game.sheet = null; game.decorating = true; }}>
    <span>🛋️</span><b>Decorate room</b><small>Move furniture, pick colours</small>
  </button>
  <button class="sound" class:wide={!canRemind} onclick={toggleSound} aria-pressed={!muted} aria-label={muted ? 'Sound off. Turn sound on' : 'Sound on. Turn sound off'}>
    <span>{muted ? '🔇' : '🔊'}</span><b>Sound {muted ? 'off' : 'on'}</b>
  </button>
  {#if canRemind}
    <button class="sound reminders" onclick={toggleReminders} aria-pressed={reminding} aria-label={reminding ? 'Reminders on. Turn reminders off' : 'Reminders off. Turn reminders on'}>
      <span>{reminding ? '🔔' : '🔕'}</span><b>Reminders {reminding ? 'on' : 'off'}</b>
    </button>
  {/if}
</div>

<style>
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  button {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    padding: 16px 8px; border-radius: 20px; border: 0;
    background: var(--card); color: var(--ink); box-shadow: 0 4px 0 var(--shadow);
  }
  button:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--shadow); }
  .wide { grid-column: 1 / -1; }
  .sound { flex-direction: row; justify-content: center; gap: 10px; padding: 10px 8px; }
  .sound span { font-size: 24px; }
  span { font-size: 34px; }
  b { font-size: 16px; }
  small { color: var(--ink-soft); font-weight: 700; font-size: 12px; }
</style>
