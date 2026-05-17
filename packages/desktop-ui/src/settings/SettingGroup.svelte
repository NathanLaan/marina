<script>
  let { label, help, children } = $props();
</script>

<div class="setting-group">
  {#if label}<span class="setting-label">{label}</span>{/if}
  {#if help}<p class="setting-help">{help}</p>{/if}
  {#if children}{@render children()}{/if}
</div>

<style>
  .setting-group {
    margin-bottom: 24px;
  }

  .setting-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    display: block;
    margin-bottom: 10px;
  }

  .setting-help {
    margin: 0 2px 10px;
    font-size: 12px;
    line-height: 1.4;
    color: var(--text-muted);
  }
</style>
