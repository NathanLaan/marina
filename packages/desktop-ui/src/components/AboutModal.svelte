<script>
  // Generic About dialog. Consumers pass:
  // - appName, version, description, repoUrl, repoLabel — the static content
  // - iconSvg (string of raw SVG markup) OR iconClass (Font Awesome class) —
  //   the icon shown in the right-hand column. If neither is given, the
  //   header row is rendered without an icon block.
  // - updateState (optional) — the runed object exposed by an auto-updater
  //   integration. If absent, the update-related UI is hidden entirely.
  let {
    onClose,
    appName,
    version,
    description = '',
    repoUrl,
    repoLabel,
    iconSvg,
    iconClass,
    updateState,
  } = $props();

  function focusOnMount(node) {
    node.focus();
  }

  function handleKeydown(e) {
    // Enter is handled by the focused button; don't close on it.
    if (e.key === 'Escape') onClose();
  }

  function openRepo(e) {
    if (!repoUrl) return;
    e.preventDefault();
    window.api?.openExternal?.(repoUrl);
  }

  const statusLine = $derived.by(() => {
    if (!updateState) return '';
    switch (updateState.state) {
      case 'checking':    return 'Checking for updates…';
      case 'available':   return `Version ${updateState.version} is available.`;
      case 'downloading': return `Downloading update… ${Math.round(updateState.percent || 0)}%`;
      case 'downloaded':  return `Version ${updateState.version} is ready to install.`;
      case 'unavailable': return updateState.reason === 'dev'
                                  ? 'Updates are disabled in development builds.'
                                  : 'You are running the latest version.';
      case 'error':       return `Update error: ${updateState.error}`;
      default:            return '';
    }
  });
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
      <button class="modal-close-btn" onclick={onClose} aria-label="Close" title="Close (Esc)">
        <i class="fas fa-xmark"></i>
      </button>
    </div>
    <div class="modal-body">
      <div class="header-row">
        <div class="header-left">
          <p class="app-name">{appName}</p>
          <div class="version-row">
            <p class="version">Version {version}</p>
            {#if updateState}
              <button
                class="update-btn"
                onclick={() => updateState.check?.()}
                disabled={updateState.state === 'checking' || updateState.state === 'downloading'}
                title="Check for Updates"
              >
                <i class="fas fa-arrows-rotate" class:spin={updateState.state === 'checking'}></i>
                Check
              </button>
            {/if}
          </div>
          {#if statusLine}
            <p class="update-status" class:is-error={updateState?.state === 'error'}>{statusLine}</p>
          {/if}
          {#if updateState?.state === 'available'}
            <div class="update-actions">
              <button class="primary-btn" onclick={() => updateState.download?.()}>Download</button>
            </div>
          {:else if updateState?.state === 'downloaded'}
            <div class="update-actions">
              <button class="primary-btn" onclick={() => updateState.install?.()}>Restart and Install</button>
            </div>
          {/if}
          {#if (updateState?.state === 'available' || updateState?.state === 'downloaded') && updateState?.notes}
            <details class="release-notes">
              <summary>Release notes</summary>
              <div class="release-notes-body">{@html typeof updateState.notes === 'string' ? updateState.notes : ''}</div>
            </details>
          {/if}
          {#if description}
            <p class="desc">{description}</p>
          {/if}
          {#if repoUrl}
            <p class="repo-link"><a href={repoUrl} onclick={openRepo}>{repoLabel || repoUrl}</a></p>
          {/if}
        </div>
        {#if iconSvg}
          <div class="app-icon" role="img" aria-label={appName}>{@html iconSvg}</div>
        {:else if iconClass}
          <div class="app-icon icon-fa" role="img" aria-label={appName}>
            <i class="fas {iconClass}"></i>
          </div>
        {/if}
      </div>
      <div class="modal-footer">
        <button class="close-btn" onclick={onClose}>OK</button>
      </div>
    </div>
  </div>
</div>

<style>
  .about-overlay {
    align-items: flex-end;
    justify-content: center;
  }

  .about-modal {
    width: 50%;
    height: 50%;
    min-width: 480px;
    min-height: 380px;
  }

  .about-modal :global(.modal-body) {
    display: flex;
    flex-direction: column;
  }

  .modal-footer {
    margin-top: auto;
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
  }

  /* SVG-driven icon: scale the imported markup to the container. */
  .app-icon :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }

  /* Font-Awesome-driven icon: filled tile so a single glyph reads as a logo. */
  .app-icon.icon-fa {
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

  .version-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  .version {
    color: var(--text-muted);
    margin: 0;
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .update-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 6px;
    background: var(--bg-button);
    color: var(--text-primary);
    font-size: 12px;
    transition: background 0.15s, color 0.15s;
    flex-shrink: 0;
  }

  .update-btn:hover:not(:disabled) {
    background: var(--bg-selected);
    color: var(--accent);
  }

  .update-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .update-btn .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .update-status {
    color: var(--text-secondary);
    font-size: 13px;
    margin-bottom: 12px;
  }

  .update-status.is-error {
    color: var(--danger, #c33);
  }

  .update-actions {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .primary-btn {
    padding: 6px 14px;
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
    color: var(--accent);
    border-radius: 6px;
    transition: background 0.15s, color 0.15s;
  }

  .primary-btn:hover {
    background: var(--accent);
    color: var(--accent-on);
  }

  .release-notes {
    margin-bottom: 12px;
    font-size: 13px;
  }

  .release-notes summary {
    cursor: pointer;
    color: var(--accent);
    user-select: none;
  }

  .release-notes-body {
    margin-top: 8px;
    padding: 8px 12px;
    background: var(--bg-overlay);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-secondary);
    max-height: 160px;
    overflow-y: auto;
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
