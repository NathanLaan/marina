<script>
  const sections = [
    {
      title: 'Getting started',
      items: [
        { name: 'Add a feed', body: 'Click <i class="fas fa-plus"></i> in the toolbar (or in the titlebar if the custom titlebar is enabled). Paste an RSS, Atom, or JSON Feed URL.' },
        { name: 'Refresh a feed', body: 'Select a feed in the sidebar, then click <i class="fas fa-arrows-rotate"></i> to pull its latest entries. The auto-sync engine commits and pushes changes in the background.' },
        { name: 'Mark entries read or unread', body: 'Select an entry and click <i class="fas fa-check-double"></i> to mark all read, or <i class="fas fa-rotate-left"></i> to mark all unread. With an entry selected, those buttons act on the single entry.' },
      ],
    },
    {
      title: 'Tags',
      items: [
        { name: 'Create tags', body: 'Open the Tags dialog from the toolbar (<i class="fas fa-tags"></i>). Add new tags from the action column on the left.' },
        { name: 'Assign tags', body: 'Select a feed in the sidebar, then click a tag in the Tags section below the feed list to toggle its assignment.' },
      ],
    },
    {
      title: 'Sync',
      items: [
        { name: 'Auto-sync', body: 'Every local change auto-commits and pushes after a debounce window. The Sync toolbar button tints accent when a push is queued.' },
        { name: 'Manual sync', body: 'Click <i class="fas fa-cloud-arrow-up"></i> to open the Sync drawer. From there you can Pull, Pull & Rebase, Push, or Reset from Remote.' },
        { name: 'Sync activity log', body: 'Open Settings → Sync to see the most recent commit/push/pull operations.' },
      ],
    },
    {
      title: 'Settings',
      items: [
        { name: 'Theme', body: 'Settings → UI. Three themes: Light, Dark, Midnight.' },
        { name: 'UI scale', body: 'Settings → UI. Or use <kbd>Ctrl</kbd>+<kbd>=</kbd> / <kbd>Ctrl</kbd>+<kbd>-</kbd> / <kbd>Ctrl</kbd>+<kbd>0</kbd> from anywhere in the app.' },
        { name: 'Custom titlebar', body: 'Settings → UI → Window. Replaces the OS frame with an in-app titlebar. Requires a restart to take effect.' },
        { name: 'Sync wait time', body: 'Settings → Sync. How long the auto-sync engine waits after a change before pushing.' },
      ],
    },
  ];
</script>

<div class="help-shell">
  <header class="help-header">
    <h1>Threadliner Help</h1>
    <p>RSS reader with Git-synced JSON storage.</p>
  </header>

  <main class="help-body">
    {#each sections as section}
      <section class="help-section">
        <h2>{section.title}</h2>
        <dl>
          {#each section.items as item}
            <dt>{item.name}</dt>
            <dd>{@html item.body}</dd>
          {/each}
        </dl>
      </section>
    {/each}
  </main>
</div>

<style>
  :global(html, body, #help) {
    height: 100%;
    overflow: hidden;
  }

  .help-shell {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-base);
    color: var(--text-primary);
    font-family: var(--font-sans);
  }

  .help-header {
    padding: 24px 32px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-surface);
  }

  .help-header h1 {
    font-size: 22px;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .help-header p {
    color: var(--text-muted);
    font-size: 13px;
  }

  .help-body {
    flex: 1;
    overflow-y: auto;
    padding: 24px 32px 48px;
    max-width: 820px;
    width: 100%;
    align-self: center;
    box-sizing: border-box;
  }

  .help-section {
    margin-bottom: 32px;
  }

  .help-section h2 {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin-bottom: 12px;
  }

  dl {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: 12px 24px;
  }

  dt {
    font-weight: 500;
    color: var(--text-primary);
    font-size: 14px;
  }

  dd {
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.55;
  }

  dd :global(i) {
    color: var(--accent);
    margin: 0 2px;
  }

  dd :global(kbd) {
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 1px 6px;
    background: var(--bg-button);
    border: 1px solid var(--border);
    border-radius: 3px;
    color: var(--text-secondary);
  }
</style>
