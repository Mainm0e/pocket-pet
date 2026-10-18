<script>
  // A still 3D picture of a pet (rendered offscreen, cached).
  let { look, yaw = 0.35, size = 320, silhouette = false, alt = '' } = $props();
  let url = $state(null);
  let el = $state(null);
  let seen = $state(false);
  // Only render when the picture is (nearly) on screen.
  $effect(() => {
    if (!el || seen) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (seen = true), { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  });
  $effect(() => {
    if (!seen) return;
    const l = $state.snapshot(look);
    let live = true;
    import('../three/thumbs.js').then(({ thumb }) => thumb(l, { yaw, size, silhouette })).then((u) => live && (url = u));
    return () => (live = false);
  });
</script>

{#if url}<img src={url} {alt} draggable="false" />{:else}<div class="ph" bind:this={el}></div>{/if}

<style>
  img, .ph { display: block; width: 100%; aspect-ratio: 1; object-fit: contain; }
  img { -webkit-user-drag: none; pointer-events: none; }
</style>
