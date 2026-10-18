<script>
  let { care, onclick } = $props();
  const ICONS = [
    ['happiness', '♥', '#ff6b8a'],
    ['comfort', '☁', '#7fb8ff'],
    ['health', '✚', '#5ccf8a'],
    ['fitness', '⚑', '#ffa53a'],
    ['energy', '⚡', '#f5c542'],
  ];
</script>

<button class="meters" {onclick} aria-label="Open stats">
  {#each ICONS as [k, icon, color]}
    <span class="row" class:low={care[k] < 30}>
      <b style="color:{color}">{icon}</b>
      <span class="bar"><i style="width:{care[k]}%; background:{color}"></i></span>
    </span>
  {/each}
</button>

<style>
  .meters {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 8px 10px;
    border-radius: 16px;
    border: 0;
    background: var(--card);
    box-shadow: 0 3px 0 var(--shadow);
    width: 104px;
  }
  .row { display: flex; align-items: center; gap: 6px; }
  .row b { width: 12px; font-size: 11px; text-align: center; line-height: 1; }
  .bar { flex: 1; height: 6px; border-radius: 4px; background: var(--track); overflow: hidden; }
  .bar i { display: block; height: 100%; border-radius: 4px; transition: width 0.6s; }
  .low .bar { animation: blink 1s ease-in-out infinite; }
  @keyframes blink { 50% { opacity: 0.4; } }
</style>
