<script>
  let {
    label,
    checked = false,
    disabled = false,
    onchange,
  } = $props();

  function toggle() {
    if (disabled) return;
    onchange?.(!checked);
  }
</script>

<button
  class="toggle-option"
  class:active={checked}
  {disabled}
  onclick={toggle}
>
  <span class="toggle-radio">
    {#if checked}
      <i class="fas fa-square-check"></i>
    {:else}
      <i class="far fa-square"></i>
    {/if}
  </span>
  {label}
</button>

<style>
  .toggle-option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: var(--bg-button);
    color: var(--text-primary);
    border-radius: 6px;
    font-size: 14px;
    text-align: left;
    width: 100%;
    transition: background 0.15s;
  }

  .toggle-option:hover:not(:disabled) {
    background: var(--bg-button-hover);
  }

  .toggle-option.active {
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
  }

  .toggle-option:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .toggle-radio {
    color: var(--text-muted);
    font-size: 15px;
    width: 18px;
    text-align: center;
  }

  .toggle-option.active .toggle-radio {
    color: var(--accent);
  }
</style>
