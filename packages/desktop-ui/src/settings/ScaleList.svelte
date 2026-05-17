<script>
  import { themeState } from '../theme/index.svelte.js';

  let { state = themeState } = $props();
</script>

<div class="scale-list">
  {#each state.scaleList as scale (scale.id)}
    <button
      class="scale-option"
      class:active={state.scale === scale.id}
      onclick={() => state.setScale(scale.id)}
    >
      {scale.label}
    </button>
  {/each}
</div>

<style>
  .scale-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .scale-option {
    padding: 8px 14px;
    background: var(--bg-button);
    color: var(--text-primary);
    border-radius: 6px;
    font-size: 13px;
    transition: background 0.15s;
  }

  .scale-option:hover {
    background: var(--bg-button-hover);
  }

  .scale-option.active {
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
    color: var(--accent);
  }
</style>
