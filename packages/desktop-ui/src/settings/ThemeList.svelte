<script>
  import { themeState } from '../theme/index.svelte.js';

  let { state = themeState } = $props();
</script>

<select
  class="theme-select"
  aria-label="Theme"
  value={state.current}
  onchange={(e) => state.set(e.currentTarget.value)}
>
  {#each state.list as t (t.id)}
    <option value={t.id} style="background-color: {t.colors.accent}; color: {t.colors.accentOn};">
      {t.name}
    </option>
  {/each}
</select>

<style>
  .theme-select {
    width: 100%;
    padding: 10px 14px;
    background: var(--bg-button);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 14px;
    transition: background 0.15s;
  }

  .theme-select:hover {
    background: var(--bg-button-hover);
  }

  .theme-select:focus {
    outline: 1px solid var(--accent);
  }

  .theme-select option {
    background: var(--bg-surface);
    color: var(--text-primary);
  }
</style>
