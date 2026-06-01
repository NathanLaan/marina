<script>
  import { onMount } from 'svelte';

  let { onClose } = $props();

  let info = $state(null);            // { enabled, gitInstalled, repo, remoteUrl, branch }
  let remoteInput = $state('');
  let status = $state(null);          // { status, count?, ahead?, behind?, message? }
  let busy = $state(false);
  let message = $state('');
  let error = $state('');

  async function refresh() {
    try {
      info = await window.api.gitGetInfo();
      remoteInput = info?.remoteUrl || '';
    } catch (e) { error = e?.message || 'Failed to read sync info.'; }
  }

  onMount(refresh);

  function handleKeydown(e) { if (e.key === 'Escape') onClose(); }

  async function toggleEnabled(next) {
    busy = true; error = ''; message = '';
    try {
      if (next) {
        const res = await window.api.gitEnable();
        if (res?.error) { error = res.error; busy = false; return; }
        await window.api.setUIPrefs({ gitSyncEnabled: true });
      } else {
        await window.api.setUIPrefs({ gitSyncEnabled: false });
      }
      await refresh();
    } catch (e) { error = e?.message || 'Failed.'; }
    finally { busy = false; }
  }

  async function saveRemote() {
    busy = true; error = ''; message = '';
    try {
      const res = await window.api.gitSetRemote(remoteInput.trim() || null);
      if (res?.error) error = res.error;
      else { message = remoteInput.trim() ? 'Remote saved.' : 'Remote removed.'; await refresh(); }
    } catch (e) { error = e?.message || 'Failed.'; }
    finally { busy = false; }
  }

  async function syncNow() {
    busy = true; error = ''; message = '';
    try {
      const res = await window.api.gitSyncNow();
      status = res?.status || null;
      if (res?.error) error = res.error;
      else message = 'Synced.';
    } catch (e) { error = e?.message || 'Sync failed.'; }
    finally { busy = false; }
  }

  async function checkStatus() {
    busy = true; error = '';
    try { status = await window.api.gitGetStatus(); }
    catch (e) { error = e?.message || 'Failed.'; }
    finally { busy = false; }
  }

  function statusText(s) {
    if (!s) return '';
    switch (s.status) {
      case 'synced': return 'Up to date with remote.';
      case 'ahead': return `${s.count} commit(s) ahead — push to publish.`;
      case 'behind': return `${s.count} commit(s) behind — sync to update.`;
      case 'diverged': return `Diverged: ${s.ahead} ahead, ${s.behind} behind.`;
      case 'no-upstream': return 'No upstream yet — Sync Now to publish.';
      case 'no-repo': return 'Sync not set up.';
      case 'error': return `Error: ${s.message}`;
      default: return '';
    }
  }
</script>

<div class="modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) onClose(); }} onkeydown={handleKeydown} role="dialog" aria-modal="true" tabindex="-1">
  <div class="modal sync-modal">
    <div class="modal-header"><h2>Git Sync</h2></div>
    <div class="modal-body">
      {#if !info}
        <p class="muted">Loading…</p>
      {:else if !info.gitInstalled}
        <p class="warn"><i class="fas fa-triangle-exclamation"></i> Git is not installed or not on your PATH. Install Git to enable sync.</p>
      {:else}
        <p class="help">
          Sync versions your library index and reading state (positions, bookmarks,
          highlights) through a Git remote. Book files stay on this device — only
          metadata syncs, so other devices see the list and your progress.
        </p>

        <label class="toggle-row">
          <input type="checkbox" checked={info.enabled} disabled={busy} onchange={(e) => toggleEnabled(e.currentTarget.checked)} />
          <span>Enable Git sync</span>
        </label>

        {#if info.enabled}
          <div class="field">
            <label for="remote">Remote URL</label>
            <div class="remote-row">
              <input id="remote" type="text" placeholder="git@github.com:you/library.git" bind:value={remoteInput} disabled={busy} />
              <button class="btn" onclick={saveRemote} disabled={busy}>Save</button>
            </div>
            {#if info.branch}<div class="meta">Branch: <code>{info.branch}</code></div>{/if}
          </div>

          <div class="actions">
            <button class="btn primary" onclick={syncNow} disabled={busy}>
              {#if busy}<i class="fas fa-spinner fa-spin"></i>{:else}<i class="fas fa-rotate"></i>{/if} Sync Now
            </button>
            <button class="btn" onclick={checkStatus} disabled={busy}>Check status</button>
          </div>

          {#if status}<div class="status-line">{statusText(status)}</div>{/if}
        {/if}
      {/if}

      {#if message}<div class="ok">{message}</div>{/if}
      {#if error}<div class="err">{error}</div>{/if}

      <div class="modal-footer">
        <button class="btn" onclick={onClose}>Close</button>
      </div>
    </div>
  </div>
</div>

<style>
  .sync-modal { max-width: 520px; width: 100%; height: auto; margin: auto; }
  .help, .muted { font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 14px; }
  .warn { font-size: 13px; color: #d08700; line-height: 1.5; }
  .warn i { margin-right: 6px; }

  .toggle-row { display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--text-primary); margin-bottom: 14px; cursor: pointer; }

  .field { margin-bottom: 14px; }
  .field label { display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
  .remote-row { display: flex; gap: 8px; }
  .field input {
    flex: 1;
    padding: 8px 12px;
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 13px;
    box-sizing: border-box;
  }
  .field input:focus { border-color: var(--input-border-focus); outline: none; }
  .meta { font-size: 12px; color: var(--text-muted); margin-top: 6px; }
  .meta code { font-family: 'SF Mono', monospace; }

  .actions { display: flex; gap: 8px; margin-bottom: 10px; }
  .btn {
    padding: 8px 16px;
    background: var(--bg-button);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-primary);
    cursor: pointer;
    font-size: 13px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .btn:hover:not(:disabled) { background: var(--bg-button-hover); }
  .btn:disabled { opacity: 0.5; cursor: default; }
  .btn.primary { background: var(--bg-selected); outline: 1px solid var(--accent); color: var(--accent); }
  .btn.primary:hover:not(:disabled) { background: var(--accent); color: var(--accent-on); }

  .status-line { font-size: 13px; color: var(--text-secondary); margin: 8px 0; }
  .ok { font-size: 13px; color: #2ea043; margin-top: 8px; }
  .err { font-size: 13px; color: #e0484d; margin-top: 8px; }

  .modal-footer { display: flex; justify-content: flex-end; margin-top: 12px; }
</style>
