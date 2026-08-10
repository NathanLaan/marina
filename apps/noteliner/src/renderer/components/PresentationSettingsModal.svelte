<script>
  // Presentation settings for the open note. Everything here is stored in the
  // note's own `presentation:` frontmatter block, so a deck carries its
  // settings with it — no sidecar, no app-level state to get out of sync.

  import { projectState } from '../stores/project.svelte.js';
  import { ASPECTS, DEFAULT_PRESENTATION } from '../lib/slides.js';

  let { onClose = () => {} } = $props();

  // Snapshot on open: edits apply on Save, so Cancel really cancels.
  const current = projectState.presentation ?? DEFAULT_PRESENTATION;
  let theme = $state(current.theme);
  let aspect = $state(current.aspect);
  let slideLevel = $state(String(current.slideLevel));
  let header = $state(current.header);
  let footer = $state(current.footer);
  let slideNumbers = $state(current.slideNumbers);
  let firstSlideTitle = $state(current.firstSlideTitle);
  let saving = $state(false);
  let error = $state('');

  const THEMES = [
    { id: 'dark', name: 'Dark' },
    { id: 'light', name: 'Light' },
  ];

  const SLIDE_LEVELS = [
    { value: '0', label: 'Only --- separators' },
    { value: '1', label: '# starts a slide' },
    { value: '2', label: '## and above (recommended)' },
    { value: '3', label: '### and above' },
  ];

  const slideCount = $derived(projectState.deck?.slides.length ?? 0);

  async function handleSave() {
    saving = true;
    error = '';
    const res = await projectState.setPresentation(projectState.selectedFileId, {
      theme,
      aspect,
      slideLevel: Number(slideLevel),
      header,
      footer,
      slideNumbers,
      firstSlideTitle,
    });
    saving = false;
    if (res?.error) {
      error = res.error === 'git_config_required'
        ? 'Set your git name and email in Project Settings first.'
        : res.error;
      return;
    }
    onClose();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSave();
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="modal-overlay"
  onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}
  onkeydown={handleKeydown}
  role="dialog"
  aria-modal="true"
  tabindex="-1"
>
  <div class="modal presentation-modal">
    <div class="modal-header">
      <h2>Presentation Settings</h2>
    </div>
    <div class="modal-body">
      <div class="field-row">
        <div class="field">
          <label for="pres-theme">Theme:</label>
          <select id="pres-theme" bind:value={theme}>
            {#each THEMES as t (t.id)}
              <option value={t.id}>{t.name}</option>
            {/each}
          </select>
        </div>
        <div class="field">
          <label for="pres-aspect">Aspect Ratio:</label>
          <select id="pres-aspect" bind:value={aspect}>
            {#each Object.keys(ASPECTS) as a (a)}
              <option value={a}>{a}</option>
            {/each}
          </select>
        </div>
      </div>

      <div class="field">
        <label for="pres-level">New slide starts at:</label>
        <select id="pres-level" bind:value={slideLevel}>
          {#each SLIDE_LEVELS as l (l.value)}
            <option value={l.value}>{l.label}</option>
          {/each}
        </select>
        <p class="field-help">
          Currently {slideCount} slide{slideCount === 1 ? '' : 's'}.
          A <code>---</code> line always starts a new slide.
        </p>
      </div>

      <div class="field-row">
        <div class="field">
          <label for="pres-header">Header:</label>
          <input id="pres-header" type="text" bind:value={header} placeholder="(none)" />
        </div>
        <div class="field">
          <label for="pres-footer">Footer:</label>
          <input id="pres-footer" type="text" bind:value={footer} placeholder="(none)" />
        </div>
      </div>
      <p class="field-help">
        Placeholders: <code>{'{{name}}'}</code> <code>{'{{date}}'}</code>
        <code>{'{{page}}'}</code> <code>{'{{total}}'}</code>
      </p>

      <label class="checkbox-row">
        <input type="checkbox" bind:checked={slideNumbers} />
        <span>Show slide numbers</span>
      </label>
      <label class="checkbox-row">
        <input type="checkbox" bind:checked={firstSlideTitle} />
        <span>Style a leading <code># heading</code> as a title slide</span>
      </label>

      {#if error}
        <p class="error">{error}</p>
      {/if}

      <div class="modal-footer">
        <button class="cancel-btn" onclick={onClose}>Cancel</button>
        <button class="ok-btn" onclick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .presentation-modal {
    max-width: 520px;
    height: auto;
    margin: auto;
    width: 100%;
  }

  .field {
    margin-bottom: 14px;
    flex: 1;
    min-width: 0;
  }

  .field-row {
    display: flex;
    gap: 12px;
  }

  .field label {
    display: block;
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 4px;
  }

  .field input,
  .field select {
    width: 100%;
    padding: 8px 12px;
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 14px;
    outline: none;
    box-sizing: border-box;
  }

  .field input:focus,
  .field select:focus {
    border-color: var(--input-border-focus);
  }

  .field-help {
    margin: 4px 0 12px;
    font-size: 11px;
    color: var(--text-muted);
  }

  .checkbox-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    font-size: 13px;
    color: var(--text-primary);
    cursor: pointer;
  }

  .checkbox-row input {
    accent-color: var(--accent);
  }

  .error {
    margin: 8px 0;
    font-size: 12px;
    color: var(--danger, #e05252);
  }

  code {
    background: var(--code-bg);
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 0.9em;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
  }

  .cancel-btn {
    padding: 8px 20px;
    color: var(--text-muted);
    border-radius: 6px;
    transition: color 0.15s;
  }

  .cancel-btn:hover {
    color: var(--text-secondary);
  }

  .ok-btn {
    padding: 8px 24px;
    background: var(--bg-selected);
    outline: 1px solid var(--accent);
    color: var(--accent);
    border-radius: 6px;
    transition: background 0.15s, color 0.15s;
  }

  .ok-btn:hover:not(:disabled) {
    background: var(--accent);
    color: var(--accent-on);
  }

  .ok-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
