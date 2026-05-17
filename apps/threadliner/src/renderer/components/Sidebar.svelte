<script>
  import { feeds, selectedFeedId, selectFeed, tags, selectedFeedTagIds, assignTagToFeed, unassignTagFromFeed } from '../stores/app.js';

  let { width = $bindable(240) } = $props();

  let isResizing = $state(false);

  function startResize(e) {
    isResizing = true;
    const startX = e.clientX;
    const startWidth = width;

    function onMouseMove(e) {
      const delta = e.clientX - startX;
      width = Math.max(180, Math.min(500, startWidth + delta));
    }

    function onMouseUp() {
      isResizing = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function handleFeedClick(feedId) {
    selectFeed(feedId);
  }

  function handleTagToggle(tagId) {
    if ($selectedFeedId === null) return;
    if ($selectedFeedTagIds.includes(tagId)) {
      unassignTagFromFeed($selectedFeedId, tagId);
    } else {
      assignTagToFeed($selectedFeedId, tagId);
    }
  }
</script>

<div class="sidebar" style="width: {width}px" class:resizing={isResizing}>
  <div class="sidebar-header">
    <h2>Feeds</h2>
  </div>
  <div class="feed-list">
    {#if $feeds.length === 0}
      <p class="empty-text">No feeds added yet.</p>
    {:else}
      {#each $feeds as feed (feed.id)}
        <button
          class="feed-item"
          class:active={$selectedFeedId === feed.id}
          onclick={() => handleFeedClick(feed.id)}
        >
          <span class="feed-title">{feed.title}</span>
          {#if feed.unread_count > 0}
            <span class="unread-badge">{feed.unread_count}</span>
          {/if}
        </button>
      {/each}
    {/if}
  </div>
  {#if $tags.length > 0}
    <div class="tags-section">
      <div class="tags-header">
        <h2>Tags</h2>
      </div>
      <div class="tags-list">
        {#each $tags as tag (tag.id)}
          <button
            class="tag-toggle"
            class:assigned={$selectedFeedTagIds.includes(tag.id)}
            disabled={$selectedFeedId === null}
            onclick={() => handleTagToggle(tag.id)}
          >
            <i class="fas" class:fa-square-check={$selectedFeedTagIds.includes(tag.id)} class:fa-square={!$selectedFeedTagIds.includes(tag.id)}></i>
            <span class="tag-name">{tag.name}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="resize-handle" onmousedown={startResize}></div>
</div>

<style>
  .sidebar {
    position: relative;
    display: flex;
    flex-direction: column;
    background-color: var(--bg-surface);
    border-right: 1px solid var(--border);
    flex-shrink: 0;
    overflow: hidden;
  }

  .sidebar.resizing {
    user-select: none;
  }

  .sidebar-header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-base);
  }

  .sidebar-header h2 {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .feed-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }

  .feed-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 8px 16px;
    text-align: left;
    font-size: 13px;
    color: var(--text-primary);
    border-radius: 0;
    transition: background-color 0.1s;
  }

  .feed-item:hover {
    background-color: var(--bg-item-hover);
  }

  .feed-item.active {
    background-color: var(--bg-selected);
    outline: 1px solid var(--accent);
    outline-offset: -1px;
    color: var(--text-primary);
  }

  .feed-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .unread-badge {
    flex-shrink: 0;
    min-width: 20px;
    height: 18px;
    padding: 0 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 600;
    background-color: var(--accent);
    color: var(--accent-on);
    border-radius: 9px;
    margin-left: 8px;
  }

  .empty-text {
    padding: 16px;
    color: var(--text-muted);
    font-size: 13px;
    text-align: center;
  }

  .tags-section {
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    max-height: 40%;
    flex-shrink: 0;
  }

  .tags-header {
    padding: 12px 16px;
    background: var(--bg-base);
  }

  .tags-header h2 {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .tags-list {
    overflow-y: auto;
    padding: 0 0 4px 0;
  }

  .tag-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 16px;
    text-align: left;
    font-size: 13px;
    color: var(--text-muted);
    border-radius: 0;
    transition: background-color 0.1s, color 0.1s;
  }

  .tag-toggle:hover:not(:disabled) {
    background-color: var(--bg-item-hover);
    color: var(--text-primary);
  }

  .tag-toggle:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .tag-toggle.assigned {
    color: var(--accent);
  }

  .tag-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .resize-handle {
    position: absolute;
    right: -3px;
    top: 0;
    bottom: 0;
    width: 6px;
    cursor: col-resize;
    z-index: 10;
  }

  .resize-handle:hover {
    background-color: var(--accent);
    opacity: 0.3;
  }
</style>
