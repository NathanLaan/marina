<script>
  // `shortcuts` is `[{ section, action, keys }]`. The component groups them
  // by section in input order. If nothing matches the consumer doesn't have
  // anything wired up yet, render a friendly empty state instead.
  let {
    shortcuts = [],
    emptyMessage = 'No keyboard shortcuts registered.',
  } = $props();
</script>

<div class="shortcuts-list">
  {#if shortcuts.length === 0}
    <p class="empty">{emptyMessage}</p>
  {:else}
    {#each shortcuts as shortcut, i (shortcut.section + '|' + shortcut.keys + '|' + i)}
      {#if i === 0 || shortcut.section !== shortcuts[i - 1].section}
        <div class="shortcut-section">{shortcut.section}</div>
      {/if}
      <div class="shortcut-row">
        <span class="shortcut-action">{shortcut.action}</span>
        <kbd class="shortcut-keys">{shortcut.keys}</kbd>
      </div>
    {/each}
  {/if}
</div>

<style>
  .shortcuts-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .empty {
    color: var(--text-muted);
    font-size: 13px;
    padding: 12px;
  }

  .shortcut-section {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    padding: 12px 12px 4px;
  }

  .shortcut-section:first-child {
    padding-top: 0;
  }

  .shortcut-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-radius: 6px;
  }

  .shortcut-row:nth-child(odd) {
    background: var(--bg-base);
  }

  .shortcut-action {
    font-size: 13px;
    color: var(--text-primary);
  }

  .shortcut-keys {
    font-size: 12px;
    font-family: var(--font-mono, monospace);
    color: var(--text-secondary);
    background: var(--bg-button);
    padding: 3px 8px;
    border-radius: 4px;
    border: 1px solid var(--border);
  }
</style>
