<script>
  import { themeState } from '../theme/index.svelte.js';

  let { state = themeState } = $props();
</script>

<div class="theme-list">
  {#each state.list as t (t.id)}
    <button
      class="theme-option"
      class:active={state.current === t.id}
      onclick={() => state.set(t.id)}
    >
      <span class="theme-radio">
        {#if state.current === t.id}
          <i class="fas fa-circle-check"></i>
        {:else}
          <i class="far fa-circle"></i>
        {/if}
      </span>
      {t.name}
    </button>
  {/each}
</div>

<style>
  .theme-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .theme-option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: var(--bg-button);
    color: var(--text-primary);
    border-radius: 6px;
    font-size: 14px;
    text-align: left;
    transition: background 0.15s;
  }

  .theme-option:hover {
    background: var(--bg-button-hover);
  }

  .theme-option.active {
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
  }

  .theme-radio {
    color: var(--text-muted);
    font-size: 15px;
    width: 18px;
    text-align: center;
  }

  .theme-option.active .theme-radio {
    color: var(--accent);
  }
</style>
