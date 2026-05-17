<script>
  let {
    icon,             // Font Awesome class name, e.g. 'fa-plus' (without the 'fas ' prefix)
    iconStyle = 'fas',
    active = false,
    disabled = false,
    onclick,
    title,
    label,            // accessible label; falls back to title
    extraClass = '',  // hook for app-specific states like 'sync-pending'
  } = $props();
</script>

<button
  class="toolbar-btn {extraClass}"
  class:active
  {disabled}
  {onclick}
  {title}
  aria-label={label || title}
>
  <i class="{iconStyle} {icon}"></i>
</button>

<style>
  .toolbar-btn {
    position: relative;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    color: var(--text-secondary);
    font-size: 16px;
    transition: background 0.15s, color 0.15s;
  }

  .toolbar-btn:hover:not(:disabled) {
    background: var(--bg-button);
    color: var(--text-primary);
  }

  .toolbar-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .toolbar-btn:disabled:hover {
    background: none;
    color: var(--text-secondary);
  }

  .toolbar-btn.active {
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
    color: var(--accent);
  }
</style>
