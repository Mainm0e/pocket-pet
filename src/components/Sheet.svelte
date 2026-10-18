<script>
  let { title, onclose, children } = $props();
</script>

<div class="backdrop" onclick={onclose} role="presentation"></div>
<div class="sheet" role="dialog" aria-label={title}>
  <div class="grab"></div>
  <header>
    <h2>{title}</h2>
    <button class="x" onclick={onclose} aria-label="Close">✕</button>
  </header>
  <div class="body">{@render children()}</div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(40, 20, 40, 0.35);
    z-index: 20;
    animation: fade 0.2s;
  }
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    max-height: 86dvh;
    margin: 0 auto;
    max-width: 560px;
    display: flex;
    flex-direction: column;
    background: var(--sheet);
    border-radius: 26px 26px 0 0;
    box-shadow: 0 -6px 0 var(--shadow);
    z-index: 21;
    animation: up 0.28s cubic-bezier(0.2, 0.9, 0.3, 1.1);
    padding-bottom: env(safe-area-inset-bottom);
  }
  .grab { width: 44px; height: 5px; border-radius: 3px; background: var(--shadow); margin: 8px auto 0; }
  header { display: flex; align-items: center; justify-content: space-between; padding: 6px 18px 4px; }
  h2 { margin: 0; font-size: 20px; }
  .x {
    width: 36px; height: 36px; border-radius: 50%; border: 0;
    background: var(--card); color: var(--ink); font-size: 16px; font-weight: 900;
  }
  .body { overflow-y: auto; padding: 8px 16px 20px; overscroll-behavior: contain; }
  @keyframes up { from { transform: translateY(100%); } }
  @keyframes fade { from { opacity: 0; } }
</style>
