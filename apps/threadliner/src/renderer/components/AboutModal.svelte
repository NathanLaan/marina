<script>
  import { onMount } from 'svelte';

  let { onClose } = $props();

  let version = $state('');

  onMount(async () => {
    try {
      version = await window.api.getAppVersion();
    } catch {
      version = 'x.x.x';
    }
  });

  function focusOnMount(node) {
    node.focus();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') onClose();
  }

  function openRepo(e) {
    e.preventDefault();
    window.api?.openExternal?.('https://github.com/NathanLaan/threadline');
  }
</script>

<div
  class="modal-overlay about-overlay"
  use:focusOnMount
  onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}
  onkeydown={handleKeydown}
  role="dialog"
  aria-modal="true"
  tabindex="-1"
>
  <div class="modal about-modal">
    <div class="modal-header">
      <h2>About</h2>
    </div>
    <div class="modal-body">
      <div class="header-row">
        <div class="header-left">
          <p class="app-name">Threadliner</p>
          <p class="version">Version {version}</p>
          <p class="desc">A desktop RSS reader built with Electron, Svelte, and Git-synced JSON.</p>
          <p class="repo-link"><a href="https://github.com/NathanLaan/threadline" onclick={openRepo}>github.com/NathanLaan/threadline</a></p>
        </div>
        <div class="app-icon" role="img" aria-label="Threadliner">
          <i class="fas fa-rss"></i>
        </div>
      </div>
      <div class="modal-footer">
        <button class="close-btn" onclick={onClose}>OK</button>
      </div>
    </div>
  </div>
</div>

<style>
  /* About modal: 50% × 50% of the overlay's padded area, pinned to the bottom.
     The shared .modal class still applies the slide-up animation — overriding
     size/position here doesn't affect it. */
  .about-overlay {
    align-items: flex-end;
    justify-content: center;
  }

  .about-modal {
    width: 50%;
    height: 50%;
    min-width: 480px;
    min-height: 320px;
  }

  /* Flex-column the body so the OK button can be promoted to the bottom via
     margin-top: auto. The .modal-footer rule below keeps it right-aligned. */
  .about-modal :global(.modal-body) {
    display: flex;
    flex-direction: column;
  }

  .header-row {
    display: flex;
    align-items: flex-start;
    gap: 24px;
    margin-bottom: 8px;
  }

  .header-left {
    flex: 1;
    min-width: 0;
  }

  .app-icon {
    width: 96px;
    height: 96px;
    flex-shrink: 0;
    border-radius: 18px;
    background: var(--accent);
    color: var(--accent-on);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 44px;
  }

  .app-name {
    font-size: 22px;
    font-weight: 400;
    color: var(--text-primary);
    margin-bottom: 6px;
  }

  .version {
    color: var(--text-muted);
    margin-bottom: 16px;
  }

  .desc {
    color: var(--text-secondary);
    margin-bottom: 16px;
    line-height: 1.5;
  }

  .repo-link {
    margin-bottom: 24px;
  }

  .repo-link a {
    color: var(--accent);
    text-decoration: none;
  }

  .repo-link a:hover {
    text-decoration: underline;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    margin-top: auto;
  }

  .close-btn {
    padding: 8px 24px;
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
    color: var(--accent);
    border-radius: 6px;
    transition: background 0.15s, color 0.15s;
  }

  .close-btn:hover {
    background: var(--accent);
    color: var(--accent-on);
  }
</style>
