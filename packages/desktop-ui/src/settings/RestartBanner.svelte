<script>
  let {
    message = 'Restart required to apply changes.',
    onRestart,
  } = $props();
</script>

<div class="restart-banner">
  <span>{message}</span>
  <button class="restart-btn" onclick={onRestart}>Restart now</button>
</div>

<style>
  .restart-banner {
    margin-top: 10px;
    padding: 10px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    background: var(--bg-selected);
    border: 1px solid var(--accent);
    border-radius: 6px;
    font-size: 13px;
    color: var(--text-primary);
  }

  .restart-btn {
    padding: 6px 14px;
    background: var(--accent);
    color: var(--accent-on);
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    transition: background 0.15s;
  }

  .restart-btn:hover {
    background: var(--accent-hover);
  }
</style>
