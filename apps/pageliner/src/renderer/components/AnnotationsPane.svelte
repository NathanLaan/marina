<script>
  // Shared Bookmarks + Highlights list, used inside both readers' PaneHost
  // sidebars. The reader owns the data and the jump/delete behaviour; this is
  // purely presentational.
  let {
    bookmarks = [],
    highlights = [],
    showHighlights = true,
    onJump,
    onDelete,
  } = $props();
</script>

<div class="annotations">
  <div class="section">
    <div class="section-head">Bookmarks</div>
    {#if bookmarks.length === 0}
      <div class="empty">No bookmarks yet.</div>
    {:else}
      <ul>
        {#each bookmarks as b (b.id)}
          <li>
            <button class="row" onclick={() => onJump?.(b)} title={b.label}>
              <i class="fas fa-bookmark"></i>
              <span class="row-label">{b.label}</span>
            </button>
            <button class="del" title="Remove bookmark" onclick={() => onDelete?.(b)}>
              <i class="fas fa-xmark"></i>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  {#if showHighlights}
    <div class="section">
      <div class="section-head">Highlights</div>
      {#if highlights.length === 0}
        <div class="empty">Select text while reading to highlight it.</div>
      {:else}
        <ul>
          {#each highlights as h (h.id)}
            <li>
              <button class="row hl" onclick={() => onJump?.(h)} title={h.text}>
                <span class="swatch"></span>
                <span class="row-label">{h.text}</span>
              </button>
              <button class="del" title="Remove highlight" onclick={() => onDelete?.(h)}>
                <i class="fas fa-xmark"></i>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</div>

<style>
  .annotations { padding: 4px 0; }
  .section { padding: 4px 0 8px; }
  .section-head {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-faint);
    padding: 8px 10px 4px;
  }
  .empty { padding: 4px 10px 8px; color: var(--text-muted); font-size: 12px; }

  ul { list-style: none; padding: 0; margin: 0; }
  li { display: flex; align-items: center; }

  .row {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    text-align: left;
    padding: 5px 4px 5px 10px;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
  }
  .row:hover { color: var(--text-primary); }
  .row i { color: var(--accent); font-size: 11px; }
  .row-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .swatch {
    width: 11px;
    height: 11px;
    flex-shrink: 0;
    border-radius: 2px;
    background: rgba(240, 200, 0, 0.55);
    border: 1px solid rgba(180, 150, 0, 0.6);
  }

  .del {
    flex-shrink: 0;
    width: 26px;
    height: 26px;
    border: none;
    background: transparent;
    color: var(--text-faint);
    cursor: pointer;
    font-size: 11px;
    border-radius: 4px;
  }
  li:hover .del { color: var(--text-secondary); }
  .del:hover { background: var(--bg-item-hover); color: #e0484d; }
</style>
