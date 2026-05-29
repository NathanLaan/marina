<script>
  import { themeState } from '../theme/index.svelte.js';

  let { state = themeState } = $props();
</script>

<select
  class="scale-select"
  aria-label="UI scale"
  value={state.scale}
  onchange={(e) => state.setScale(e.currentTarget.value)}
>
  {#each state.scaleList as scale (scale.id)}
    <option value={scale.id}>{scale.label}</option>
  {/each}
</select>

<style>
  .scale-select {
    width: 100%;
    padding: 10px 14px;
    background: var(--bg-button);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 14px;
    transition: background 0.15s;
  }

  .scale-select:hover {
    background: var(--bg-button-hover);
  }

  .scale-select:focus {
    outline: 1px solid var(--accent);
  }

  .scale-select option {
    background: var(--bg-surface);
    color: var(--text-primary);
  }
</style>
