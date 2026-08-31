<script>
  import { onMount, onDestroy } from 'svelte';
  import { projectState } from '../stores/project.svelte.js';
  import { themeState } from '@marina/desktop-ui/theme';
  import { logState } from '../stores/log.svelte.js';
  import { EditorView, basicSetup } from 'codemirror';
  import { keymap } from '@codemirror/view';
  import { indentWithTab, selectAll } from '@codemirror/commands';
  import { markdown } from '@codemirror/lang-markdown';
  import { languages } from '@codemirror/language-data';
  import { EditorState, EditorSelection, Compartment } from '@codemirror/state';
  import { oneDark } from '@codemirror/theme-one-dark';
  import { openSearchPanel } from '@codemirror/search';
  import { autocompletion } from '@codemirror/autocomplete';
  import ContextMenu from './ContextMenu.svelte';
  import {
    toOrderedList, toUnorderedList, indentAsSubList, classifySpan,
  } from '../lib/listEdits.js';

  const lightTheme = EditorView.theme({
    '&': { backgroundColor: '#ffffff', color: '#1a1a1a' },
    '.cm-content': { caretColor: '#1a1a1a' },
    '.cm-cursor': { borderLeftColor: '#1a1a1a' },
    '.cm-activeLine': { backgroundColor: 'rgba(0, 0, 0, 0.04)' },
    '.cm-selectionMatch': { backgroundColor: 'rgba(50, 120, 220, 0.15)' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: 'rgba(50, 120, 220, 0.2)' },
    '.cm-gutters': { backgroundColor: '#f5f5f5', color: '#999999', borderRight: '1px solid #e0e0e0' },
    '.cm-activeLineGutter': { backgroundColor: 'rgba(0, 0, 0, 0.06)' },
    '.cm-foldPlaceholder': { backgroundColor: '#e8e8e8', color: '#666666' },
  }, { dark: false });

  let {
    onTogglePreview,
    showPreview,
    onToggleHistory,
    showHistory,
    onGitConfigRequired = () => {},
    onSaveToHtml = () => {},
    onSaveToPdf = () => {},
    onSaveToMarkdown = () => {},
  } = $props();

  let contextMenu = $state(null);

  const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
  const MAX_SIZE = 30 * 1024 * 1024;

  let editorContainer;
  let editorView = null;
  let saveTimeout = null;
  let currentFileId = null;
  let currentTheme = null;
  let isUpdating = false;
  let spellCheckEnabled = true;
  let unsubscribeSpellCheck = null;

  // Compartment so we can flip .cm-content's spellcheck attribute without
  // tearing down and rebuilding the editor (which would drop scroll/cursor).
  const spellCheckCompartment = new Compartment();

  function spellCheckExtension(enabled) {
    return EditorView.contentAttributes.of({ spellcheck: enabled ? 'true' : 'false' });
  }

  // Custom theme overrides
  const customTheme = EditorView.theme({
    '&': { height: '100%', fontSize: '14px' },
    '.cm-scroller': { overflow: 'auto' },
    '.cm-content': { padding: '16px 0' },
    '.cm-line': { padding: '0 16px' },
    '.cm-lineNumbers': { minWidth: '44px' },
  });

  const LIGHT_EDITOR_THEMES = new Set(['light', 'lightPurple', 'lightMulberry']);

  function getEditorTheme() {
    return LIGHT_EDITOR_THEMES.has(themeState.current) ? lightTheme : oneDark;
  }

  function wikilinkCompletions(context) {
    // Match "[[" followed by any chars that aren't "]" — the opened wikilink.
    const match = context.matchBefore(/\[\[[^\]]*/);
    if (!match) return null;
    const typed = match.text.slice(2).toLowerCase();
    const currentId = projectState.selectedFileId;
    const options = projectState.index.files
      .filter(f => f.id !== currentId && f.name.toLowerCase().includes(typed))
      .slice(0, 50)
      .map(f => ({
        label: f.name,
        type: 'text',
        // Custom apply so we (a) skip inserting `]]` if closeBrackets already did,
        // and (b) place the cursor after the closing `]]` rather than inside them.
        apply: (view, _completion, from, to) => {
          const afterText = view.state.doc.sliceString(to, to + 2);
          const hasClose = afterText === ']]';
          const insert = hasClose ? f.name : `${f.name}]]`;
          const cursorAfter = from + f.name.length + 2;
          view.dispatch({
            changes: { from, to, insert },
            selection: { anchor: cursorAfter },
          });
        },
      }));
    if (options.length === 0) return null;
    return { from: match.from + 2, options, validFor: /^[^\]]*$/ };
  }

  // Wrap each selection range in a Markdown emphasis marker (`**` for bold,
  // `*` for italic). If a range is already wrapped in that exact marker, the
  // markers are stripped instead, so the shortcut toggles. With an empty
  // selection the paired markers are inserted and the caret parked between
  // them, ready for the user to type the emphasized text.
  function toggleMarker(marker) {
    return (view) => {
      const len = marker.length;
      const tr = view.state.changeByRange((range) => {
        const { from, to } = range;
        if (from !== to
            && view.state.sliceDoc(Math.max(0, from - len), from) === marker
            && view.state.sliceDoc(to, to + len) === marker) {
          return {
            changes: [
              { from: from - len, to: from, insert: '' },
              { from: to, to: to + len, insert: '' },
            ],
            range: EditorSelection.range(from - len, to - len),
          };
        }
        if (from === to) {
          return {
            changes: { from, insert: marker + marker },
            range: EditorSelection.cursor(from + len),
          };
        }
        return {
          changes: [
            { from, insert: marker },
            { from: to, insert: marker },
          ],
          range: EditorSelection.range(from + len, to + len),
        };
      });
      view.dispatch(tr, { scrollIntoView: true, userEvent: 'input' });
      return true;
    };
  }

  // Line-oriented list commands. A pure lib/listEdits function rewrites the
  // lines the selection touches (or, with a bare caret, just the caret's line),
  // and the whole span goes back as ONE change — so the action is a single undo
  // step, and the transformed lines end up selected, ready for the other list
  // button to act on the same block.
  function applyListEdit(fn) {
    return (view) => {
      const { state } = view;
      const sel = state.selection.main;
      const doc = state.doc;
      const fromLine = doc.lineAt(sel.from).number;
      const toLine = doc.lineAt(sel.to).number;
      const lines = doc.toString().split('\n');

      const edit = fn(lines, fromLine, toLine);
      if (!edit.changed) return false;

      const from = doc.line(fromLine).from;
      const to = doc.line(toLine).to;
      const insert = edit.lines.join('\n');

      // With a caret rather than a selection, shift it by however much the
      // marker grew or shrank so it stays on the same character instead of
      // snapping to column 0.
      let selection;
      if (sel.empty) {
        const col = sel.head - from;
        const delta = edit.lines[0].length - lines[fromLine - 1].length;
        selection = EditorSelection.cursor(
          from + Math.max(0, Math.min(col + delta, edit.lines[0].length))
        );
      } else {
        selection = EditorSelection.range(from, from + insert.length);
      }

      view.dispatch({
        changes: { from, to, insert },
        selection,
        scrollIntoView: true,
        userEvent: 'input.format.list',
      });
      return true;
    };
  }

  const orderedListCommand = applyListEdit(toOrderedList);
  const unorderedListCommand = applyListEdit(toUnorderedList);

  // Indent is a single-line action even with a selection active — it nests the
  // line holding the caret, not the whole span.
  function indentSubListCommand(view) {
    const { state } = view;
    const doc = state.doc;
    const sel = state.selection.main;
    const line = doc.lineAt(sel.head);

    const edit = indentAsSubList(doc.toString().split('\n'), line.number);
    if (!edit.changed) return false;

    const insert = edit.lines[0];
    const col = sel.head - line.from;
    const delta = insert.length - line.text.length;

    view.dispatch({
      changes: { from: line.from, to: line.to, insert },
      selection: EditorSelection.cursor(
        line.from + Math.max(0, Math.min(col + delta, insert.length))
      ),
      scrollIntoView: true,
      userEvent: 'input.format.list',
    });
    return true;
  }

  function runListCommand(command) {
    if (!editorView) return;
    editorView.focus();
    command(editorView);
  }

  const handleOrderedList = () => runListCommand(orderedListCommand);
  const handleUnorderedList = () => runListCommand(unorderedListCommand);
  const handleIndentSubList = () => runListCommand(indentSubListCommand);

  // Keeps a toolbar click from blurring the editor, so the selection stays
  // highlighted while the command runs.
  function keepEditorFocus(e) {
    e.preventDefault();
  }

  // The lines the list buttons would act on: the selection when there is one,
  // otherwise the caret's line. Drives the buttons' active state.
  const listKind = $derived.by(() => {
    const range = projectState.selectionRange;
    const fromLine = range ? range.fromLine : (projectState.cursorLine || 1);
    const toLine = range ? range.toLine : fromLine;
    return classifySpan((projectState.editorContent || '').split('\n'), fromLine, toLine);
  });

  function createEditor() {
    if (editorView) {
      editorView.destroy();
    }

    const startState = EditorState.create({
      doc: projectState.editorContent || '',
      extensions: [
        basicSetup,
        keymap.of([
          indentWithTab,
          { key: 'Mod-Shift-f', run: openSearchPanel },
          { key: 'Mod-b', run: toggleMarker('**') },
          { key: 'Mod-i', run: toggleMarker('*') },
        ]),
        markdown({ codeLanguages: languages }),
        autocompletion({ override: [wikilinkCompletions] }),
        getEditorTheme(),
        customTheme,
        spellCheckCompartment.of(spellCheckExtension(spellCheckEnabled)),
        EditorView.domEventHandlers({
          mouseup(event, view) {
            if (event.detail !== 3) return false;
            const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
            if (pos == null) return false;
            const line = view.state.doc.lineAt(pos);
            view.dispatch({ selection: { anchor: line.from, head: line.to } });
            return true;
          },
          keydown(event, view) {
            // Use event.code (physical key) so the shortcut survives layouts
            // where Alt+key produces a different character (notably macOS).
            if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
              let insert;
              if (event.code === 'Period') insert = '→';
              else if (event.code === 'Comma') insert = '←';
              else return false;
              event.preventDefault();
              view.dispatch(view.state.replaceSelection(insert));
              return true;
            }

            // Ctrl/Cmd+Shift+7 / +8 for the list commands. Matched on code for
            // the same reason: Shift+7 is "&" on a US layout and something else
            // again elsewhere, so a keymap binding on the character would only
            // work for some users.
            if ((event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey) {
              let command;
              if (event.code === 'Digit7') command = orderedListCommand;
              else if (event.code === 'Digit8') command = unorderedListCommand;
              else return false;
              event.preventDefault();
              command(view);
              return true;
            }

            return false;
          }
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !isUpdating) {
            const content = update.state.doc.toString();
            projectState.editorContent = content;
            projectState.saveStatus = 'unsaved';
            scheduleSave(content);
          }
          if (update.selectionSet || update.docChanged) {
            const sel = update.state.selection.main;
            const line = update.state.doc.lineAt(sel.head);
            projectState.cursorLine = line.number;
            projectState.cursorCol = sel.head - line.from + 1;
            projectState.selectionLength = Math.abs(sel.to - sel.from);
            // Line span drives line-oriented commands (e.g. wrapping a
            // selection as speaker notes); null means "just a caret".
            projectState.selectionRange = sel.from === sel.to
              ? null
              : {
                  fromLine: update.state.doc.lineAt(sel.from).number,
                  toLine: update.state.doc.lineAt(sel.to).number,
                };
          }
        }),
        EditorView.lineWrapping
      ]
    });

    editorView = new EditorView({
      state: startState,
      parent: editorContainer
    });
  }

  function scheduleSave(content) {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      const file = projectState.selectedFile;
      if (file) {
        projectState.saveStatus = 'saving';
        const result = await window.api.writeFile(file.filename, content);
        if (result && result.error === 'git_config_required') {
          projectState.saveStatus = 'unsaved';
          onGitConfigRequired();
        } else {
          projectState.saveStatus = 'saved';
        }
      }
    }, 500);
  }

  function updateEditorContent(content) {
    if (!editorView) return;
    isUpdating = true;
    editorView.dispatch({
      changes: {
        from: 0,
        to: editorView.state.doc.length,
        insert: content || ''
      }
    });
    isUpdating = false;
  }

  function getExtension(name) {
    const dot = name.lastIndexOf('.');
    return dot >= 0 ? name.slice(dot).toLowerCase() : '';
  }

  function isImage(name) {
    return IMAGE_EXTENSIONS.includes(getExtension(name));
  }

  function insertMarkdownReference(attachment) {
    if (!editorView) return;
    const path = `./_attachments/${attachment.filename}`;
    const ref = isImage(attachment.originalName)
      ? `![${attachment.originalName}](${path})`
      : `[${attachment.originalName}](${path})`;
    const pos = editorView.state.selection.main.head;
    editorView.dispatch({
      changes: { from: pos, insert: ref + '\n' }
    });
  }

  async function processFiles(files) {
    if (!projectState.selectedFileId) return;
    for (const file of files) {
      if (file.size > MAX_SIZE) {
        logState.add(`Attachment rejected: ${file.name} exceeds 30MB limit`);
        continue;
      }
      try {
        const buffer = await file.arrayBuffer();
        const attachment = await window.api.addAttachment(
          projectState.selectedFileId, buffer, file.name
        );
        projectState.addAttachment(projectState.selectedFileId, attachment);
        insertMarkdownReference(attachment);
      } catch (err) {
        logState.add(`Attachment failed: ${err.message}`);
      }
    }
  }

  function handlePaste(e) {
    const files = e.clipboardData?.files;
    if (files && files.length > 0 && projectState.selectedFileId) {
      e.preventDefault();
      processFiles(files);
    }
  }

  function handleDragOver(e) {
    if (projectState.selectedFileId) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }

  function handleDrop(e) {
    // Internal file drags are intercepted in capture phase (interceptInternalDrops).
    // This handler only processes external file drops (attachments).
    if (!projectState.selectedFileId) return;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      e.preventDefault();
      processFiles(files);
    }
  }

  // Capture-phase interceptor for internal file drags from FileTree.
  // Runs BEFORE CodeMirror's own drop handler, which would otherwise insert the UUID as text.
  function interceptInternalDrops(node) {
    function isInternalDrag(e) {
      const types = e.dataTransfer?.types;
      // Internal drags carry text/plain (the file UUID) but no Files
      return types && types.includes('text/plain') && !types.includes('Files');
    }

    function onDragOver(e) {
      if (!projectState.selectedFileId) return;
      if (isInternalDrag(e)) {
        e.preventDefault();
        e.stopPropagation();
        // Must match FileTree's effectAllowed='move'. Browsers reject the drop
        // if dropEffect doesn't match effectAllowed.
        e.dataTransfer.dropEffect = 'move';
      }
    }

    function onDrop(e) {
      if (!projectState.selectedFileId) return;
      if (!isInternalDrag(e)) return;

      const fileId = e.dataTransfer.getData('text/plain');
      if (!fileId) return;

      const file = projectState.index.files.find(f => f.id === fileId);
      if (!file || file.id === projectState.selectedFileId) {
        // Still prevent default so the UUID isn't inserted
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      if (!editorView) return;
      const ref = `[${file.name}](./${file.filename})`;
      const pos = editorView.posAtCoords({ x: e.clientX, y: e.clientY }) ?? editorView.state.selection.main.head;
      editorView.dispatch({ changes: { from: pos, insert: ref } });
      editorView.focus();
    }

    node.addEventListener('dragover', onDragOver, true);
    node.addEventListener('drop', onDrop, true);
    return {
      destroy() {
        node.removeEventListener('dragover', onDragOver, true);
        node.removeEventListener('drop', onDrop, true);
      }
    };
  }

  function handleSelectAll() {
    if (!editorView) return;
    editorView.focus();
    selectAll(editorView);
  }

  function handleCopy() {
    if (!editorView) return;
    editorView.focus();
    document.execCommand('copy');
  }

  function handleCut() {
    if (!editorView) return;
    editorView.focus();
    document.execCommand('cut');
  }

  async function handlePasteFromClipboard() {
    if (!editorView) return;
    editorView.focus();
    try {
      const text = await navigator.clipboard.readText();
      if (text == null) return;
      const { from, to } = editorView.state.selection.main;
      editorView.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
      });
    } catch {
      document.execCommand('paste');
    }
  }

  function handleContextMenu(e) {
    e.preventDefault();
    const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
    contextMenu = {
      x: e.clientX / zoom,
      y: e.clientY / zoom,
      items: [
        { label: 'Select All', icon: 'fa-object-group', shortcut: 'Ctrl+A', action: handleSelectAll },
        { separator: true },
        { label: 'Cut', icon: 'fa-scissors', shortcut: 'Ctrl+X', action: handleCut },
        { label: 'Copy', icon: 'fa-copy', shortcut: 'Ctrl+C', action: handleCopy },
        { label: 'Paste', icon: 'fa-paste', shortcut: 'Ctrl+V', action: handlePasteFromClipboard },
        { separator: true },
        // Unconditional: with no selection these act on the caret's line.
        { label: 'Ordered List', icon: 'fa-list-ol', shortcut: 'Ctrl+Shift+7', action: handleOrderedList },
        { label: 'Unordered List', icon: 'fa-list-ul', shortcut: 'Ctrl+Shift+8', action: handleUnorderedList },
        { separator: true },
        { label: 'Save to HTML', icon: 'fa-file-code', action: onSaveToHtml },
        { label: 'Save to PDF', icon: 'fa-file-pdf', action: onSaveToPdf },
        { label: 'Save to Markdown', icon: 'fa-file-lines', action: onSaveToMarkdown },
      ]
    };
  }

  function applySpellCheck(enabled) {
    spellCheckEnabled = enabled;
    if (editorView) {
      editorView.dispatch({
        effects: spellCheckCompartment.reconfigure(spellCheckExtension(enabled)),
      });
    }
  }

  onMount(async () => {
    currentTheme = themeState.current;

    // Read the initial pref synchronously-ish before creating the editor so
    // the compartment starts with the right value. If the IPC call hasn't
    // settled by the time we build, createEditor falls back to the default
    // (true) and the broadcast below corrects it.
    if (window.api?.getUIPrefs) {
      try {
        const prefs = await window.api.getUIPrefs();
        spellCheckEnabled = prefs?.spellCheckEnabled !== false;
      } catch { /* ignore */ }
    }

    createEditor();

    if (window.api?.onSpellCheckChanged) {
      unsubscribeSpellCheck = window.api.onSpellCheckChanged((v) => applySpellCheck(!!v));
    }
  });

  // Recreate editor when theme changes
  $effect(() => {
    const theme = themeState.current;
    if (currentTheme !== null && theme !== currentTheme) {
      currentTheme = theme;
      if (editorContainer) createEditor();
    }
  });

  onDestroy(() => {
    if (editorView) editorView.destroy();
    if (saveTimeout) clearTimeout(saveTimeout);
    if (unsubscribeSpellCheck) unsubscribeSpellCheck();
  });

  // Watch for scroll-to-line requests from outline
  $effect(() => {
    const req = projectState.scrollToLine;
    if (req && editorView) {
      const lineCount = editorView.state.doc.lines;
      const lineNum = Math.min(req.line, lineCount);
      const line = editorView.state.doc.line(lineNum);
      editorView.dispatch({
        selection: { anchor: line.from },
        effects: EditorView.scrollIntoView(line.from, { y: 'start' })
      });
      editorView.focus();
    }
  });

  // Watch for file selection and content changes
  $effect(() => {
    const fileId = projectState.selectedFileId;
    const content = projectState.editorContent;

    if (fileId !== currentFileId) {
      currentFileId = fileId;
    }

    // Update editor only when content differs (avoids circular updates from user typing)
    if (editorView) {
      const current = editorView.state.doc.toString();
      if (current !== (content || '')) {
        updateEditorContent(content);
      }
    }
  });
</script>

<div class="editor-wrapper">
  <div class="editor-toolbar">
    {#if projectState.selectedFile}
      <span class="file-name">{projectState.selectedFile.name}</span>
    {:else}
      <span class="no-file">No file selected</span>
    {/if}
    <div class="editor-actions">
      <button
        class="editor-btn"
        class:active={listKind === 'ordered'}
        onmousedown={keepEditorFocus}
        onclick={handleOrderedList}
        title="Ordered List (Ctrl+Shift+7)"
        aria-label="Ordered List"
      >
        <i class="fas fa-list-ol"></i>
      </button>
      <button
        class="editor-btn"
        class:active={listKind === 'unordered'}
        onmousedown={keepEditorFocus}
        onclick={handleUnorderedList}
        title="Unordered List (Ctrl+Shift+8)"
        aria-label="Unordered List"
      >
        <i class="fas fa-list-ul"></i>
      </button>
      <button
        class="editor-btn"
        onmousedown={keepEditorFocus}
        onclick={handleIndentSubList}
        title="Indent as Sub-list"
        aria-label="Indent as Sub-list"
      >
        <i class="fas fa-indent"></i>
      </button>
      <span class="editor-divider"></span>
      <button
        class="editor-btn"
        class:active={showHistory}
        onclick={onToggleHistory}
        title="Toggle History (Ctrl+H)"
      >
        <i class="fas fa-clock-rotate-left"></i>
      </button>
      <button
        class="editor-btn"
        class:active={showPreview}
        onclick={onTogglePreview}
        title="Toggle Preview (Ctrl+P)"
      >
        <i class="fas fa-eye"></i>
      </button>
    </div>
  </div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="editor-container" bind:this={editorContainer} use:interceptInternalDrops onpaste={handlePaste} ondragover={handleDragOver} ondrop={handleDrop} oncontextmenu={handleContextMenu}></div>
</div>

{#if contextMenu}
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    items={contextMenu.items}
    onClose={() => contextMenu = null}
  />
{/if}

<style>
  .editor-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-surface);
  }

  .editor-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    min-height: 44px;
    box-sizing: border-box;
    background: var(--bg-base);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .file-name {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }

  .no-file {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    font-style: italic;
  }

  .editor-actions {
    display: flex;
    gap: 4px;
  }

  .editor-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    color: var(--text-muted);
    font-size: 13px;
  }

  .editor-btn:hover {
    background: var(--bg-button);
    color: var(--text-primary);
  }

  .editor-btn.active {
    color: var(--accent);
  }

  .editor-divider {
    width: 1px;
    height: 18px;
    background: var(--border);
    margin: 0 2px;
    flex-shrink: 0;
  }

  .editor-container {
    flex: 1;
    overflow: hidden;
  }

  .editor-container :global(.cm-editor) {
    height: 100%;
  }
</style>
