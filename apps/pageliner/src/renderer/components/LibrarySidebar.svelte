<script>
  import { libraryState } from '../stores/library.svelte.js';
  import { commandRegistry } from '@marina/desktop-ui/command-palette';

  const counts = $derived(libraryState.counts);

  const items = $derived([
    { id: 'all',  label: 'All Books', icon: 'fa-layer-group', count: counts.all },
    { id: 'epub', label: 'EPUB',      icon: 'fa-book',        count: counts.epub },
    { id: 'pdf',  label: 'PDF',       icon: 'fa-file-pdf',    count: counts.pdf },
  ]);

  function select(id) {
    libraryState.formatFilter = id;
    // Clicking a Library section is a navigation intent: leave reader mode (if
    // open) and show the filtered library grid. No-op when already in the library.
    libraryState.clearSelection();
  }
</script>

<nav class="lib-sidebar">
  <div class="scroll">
    <div class="group-label">Library</div>
    <ul>
      {#each items as item (item.id)}
        <li>
          <button
            class="nav-item"
            class:active={libraryState.formatFilter === item.id}
            onclick={() => select(item.id)}
          >
            <i class="fas {item.icon}"></i>
            <span class="nav-label">{item.label}</span>
            <span class="nav-count">{item.count}</span>
          </button>
        </li>
      {/each}
    </ul>
  </div>

  <div class="footer">
    <button class="foot-btn" title="Settings (Ctrl+,)" onclick={() => commandRegistry.run('app.settings')}>
      <i class="fas fa-gear"></i>
      <span>Settings</span>
    </button>
    <button class="foot-btn icon" title="About" onclick={() => commandRegistry.run('app.about')}>
      <i class="fas fa-circle-info"></i>
    </button>
  </div>
</nav>

<style>
  .lib-sidebar {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  .scroll {
    flex: 1;
    overflow-y: auto;
    padding: 10px 8px;
  }
  .group-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-faint);
    padding: 4px 8px 8px;
  }
  ul { list-style: none; padding: 0; margin: 0; }
  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 10px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--text-secondary);
    font-size: 13px;
    cursor: pointer;
    text-align: left;
    transition: background 0.12s, color 0.12s;
  }
  .nav-item:hover { background: var(--bg-item-hover); color: var(--text-primary); }
  .nav-item.active { background: var(--bg-selected); color: var(--accent); }
  .nav-item i { width: 16px; text-align: center; font-size: 12px; }
  .nav-label { flex: 1; }
  .nav-count {
    font-size: 11px;
    color: var(--text-muted);
    background: var(--bg-button);
    border-radius: 10px;
    padding: 1px 8px;
  }
  .nav-item.active .nav-count { color: var(--accent); }

  .footer {
    flex-shrink: 0;
    display: flex;
    gap: 6px;
    padding: 8px;
    border-top: 1px solid var(--border);
  }
  .foot-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--text-secondary);
    font-size: 13px;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
  }
  .foot-btn:not(.icon) { flex: 1; }
  .foot-btn:hover { background: var(--bg-item-hover); color: var(--text-primary); }
  .foot-btn i { width: 16px; text-align: center; font-size: 13px; }
</style>
