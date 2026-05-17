<script>
  import { createEventDispatcher, onMount } from 'svelte';

  const dispatch = createEventDispatcher();

  let version = '';

  onMount(async () => {
    try {
      version = await window.api.getAppVersion();
    } catch {
      version = 'x.x.x';
    }
  });

  function handleKeydown(e) {
    if (e.key === 'Escape') dispatch('close');
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="modal-overlay" on:mousedown|self={() => dispatch('close')} on:keydown={handleKeydown}>
  <div class="modal">
    <div class="modal-header">
      <h3>About</h3>
      <button class="close-btn" on:click={() => dispatch('close')}>
        <i class="fas fa-times"></i>
      </button>
    </div>

    <div class="modal-body">
      <div class="app-icon">
        <i class="fas fa-rss"></i>
      </div>
      <div class="app-name">ThreadLine</div>
      <div class="app-version">Version {version}</div>
      <div class="app-description">A desktop RSS reader built with Electron, Svelte, and Git-synced JSON.</div>
      <a
        class="github-link"
        href="https://github.com/NathanLaan/threadline"
        target="_blank"
        rel="noopener noreferrer"
      >
        <i class="fab fa-github"></i> github.com/NathanLaan/threadline
      </a>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal {
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    width: 360px;
    max-width: 90vw;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-border);
  }

  h3 {
    font-size: 16px;
    font-weight: 600;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    color: var(--color-text-muted);
    font-size: 14px;
  }

  .close-btn:hover {
    background-color: var(--color-surface-hover);
    color: var(--color-text);
  }

  .modal-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32px 20px;
    gap: 8px;
  }

  .app-icon {
    width: 56px;
    height: 56px;
    border-radius: 14px;
    background-color: var(--color-accent);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    margin-bottom: 8px;
  }

  .app-name {
    font-size: 20px;
    font-weight: 700;
    color: var(--color-text);
  }

  .app-version {
    font-size: 13px;
    color: var(--color-text-muted);
  }

  .app-description {
    font-size: 13px;
    color: var(--color-text-muted);
    text-align: center;
    margin-top: 4px;
    line-height: 1.5;
  }

  .github-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 12px;
    font-size: 13px;
    color: var(--color-accent);
    text-decoration: none;
  }

  .github-link:hover {
    text-decoration: underline;
  }
</style>
