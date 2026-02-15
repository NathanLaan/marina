<script>
  import { feeds, selectedFeedId, selectFeed } from '../stores/app.js';

  export let width = 240;

  let isResizing = false;

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
          on:click={() => handleFeedClick(feed.id)}
        >
          <span class="feed-title">{feed.title}</span>
          {#if feed.unread_count > 0}
            <span class="unread-badge">{feed.unread_count}</span>
          {/if}
        </button>
      {/each}
    {/if}
  </div>
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="resize-handle" on:mousedown={startResize}></div>
</div>

<style>
  .sidebar {
    position: relative;
    display: flex;
    flex-direction: column;
    background-color: var(--color-sidebar-bg);
    border-right: 1px solid var(--color-border);
    flex-shrink: 0;
    overflow: hidden;
  }

  .sidebar.resizing {
    user-select: none;
  }

  .sidebar-header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border);
  }

  .sidebar-header h2 {
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-text-muted);
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
    color: var(--color-text);
    border-radius: 0;
    transition: background-color 0.1s;
  }

  .feed-item:hover {
    background-color: var(--color-surface-hover);
  }

  .feed-item.active {
    background-color: var(--color-surface-active);
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
    background-color: var(--color-accent);
    color: white;
    border-radius: 9px;
    margin-left: 8px;
  }

  .empty-text {
    padding: 16px;
    color: var(--color-text-muted);
    font-size: 13px;
    text-align: center;
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
    background-color: var(--color-accent);
    opacity: 0.3;
  }
</style>
