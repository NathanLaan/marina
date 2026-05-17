<script>
  // Vertical icon column. The library only owns the chrome — consumers fill
  // it with <ToolbarButton>/<ToolbarDivider>/<ToolbarSpacer> in whatever
  // order makes sense for their app.
  let { children } = $props();
</script>

<div class="toolbar">
  {#if children}{@render children()}{/if}
</div>

<style>
  .toolbar {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 48px;
    background: var(--bg-overlay);
    border-right: 1px solid var(--border);
    padding: 8px 0;
    flex-shrink: 0;
    gap: 4px;
  }
</style>
