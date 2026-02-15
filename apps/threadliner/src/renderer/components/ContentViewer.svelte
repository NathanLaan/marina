<script>
  import { selectedEntry } from '../stores/app.js';
  import DOMPurify from 'dompurify';

  function sanitize(html) {
    if (!html) return '';
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'hr',
        'ul', 'ol', 'li',
        'a', 'strong', 'em', 'b', 'i', 'u', 's',
        'blockquote', 'pre', 'code',
        'img', 'figure', 'figcaption',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'div', 'span',
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel', 'width', 'height'],
      ADD_ATTR: ['target'],
    });
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  }

  $: sanitizedContent = $selectedEntry ? sanitize($selectedEntry.content) : '';
</script>

<div class="content-viewer">
  {#if $selectedEntry}
    <article class="article">
      <header class="article-header">
        <h1 class="article-title">{$selectedEntry.title || '(Untitled)'}</h1>
        <div class="article-meta">
          {#if $selectedEntry.author}
            <span class="article-author">
              <i class="fas fa-user"></i> {$selectedEntry.author}
            </span>
          {/if}
          {#if $selectedEntry.published_at}
            <span class="article-date">
              <i class="fas fa-calendar"></i> {formatDate($selectedEntry.published_at)}
            </span>
          {/if}
          {#if $selectedEntry.link}
            <a class="article-link" href={$selectedEntry.link} target="_blank" rel="noopener noreferrer">
              <i class="fas fa-external-link-alt"></i> View Original
            </a>
          {/if}
        </div>
      </header>

      {#if sanitizedContent}
        <div class="article-content">
          {@html sanitizedContent}
        </div>
      {:else if $selectedEntry.link}
        <div class="no-content">
          <p>This entry has no inline content.</p>
          <a class="read-link" href={$selectedEntry.link} target="_blank" rel="noopener noreferrer">
            Read on the original site <i class="fas fa-arrow-right"></i>
          </a>
        </div>
      {:else}
        <div class="no-content">
          <p>No content available for this entry.</p>
        </div>
      {/if}
    </article>
  {:else}
    <div class="empty-state">
      <i class="fas fa-rss fa-3x"></i>
      <p>Select an entry to read</p>
    </div>
  {/if}
</div>

<style>
  .content-viewer {
    flex: 1;
    overflow-y: auto;
    background-color: var(--color-bg);
    min-width: 0;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 16px;
    color: var(--color-text-muted);
  }

  .empty-state p {
    font-size: 15px;
  }

  .article {
    max-width: 720px;
    margin: 0 auto;
    padding: 32px 24px;
  }

  .article-header {
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--color-border);
  }

  .article-title {
    font-size: 24px;
    font-weight: 700;
    line-height: 1.3;
    margin-bottom: 12px;
    color: var(--color-text);
  }

  .article-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    font-size: 13px;
    color: var(--color-text-muted);
  }

  .article-meta i {
    margin-right: 4px;
    font-size: 11px;
  }

  .article-link {
    color: var(--color-accent);
    text-decoration: none;
  }

  .article-link:hover {
    text-decoration: underline;
  }

  .article-content {
    font-size: 15px;
    line-height: 1.7;
    color: var(--color-text);
  }

  .article-content :global(h1),
  .article-content :global(h2),
  .article-content :global(h3),
  .article-content :global(h4) {
    margin-top: 24px;
    margin-bottom: 12px;
    font-weight: 600;
    line-height: 1.3;
  }

  .article-content :global(h1) { font-size: 22px; }
  .article-content :global(h2) { font-size: 19px; }
  .article-content :global(h3) { font-size: 16px; }

  .article-content :global(p) {
    margin-bottom: 16px;
  }

  .article-content :global(a) {
    color: var(--color-accent);
    text-decoration: none;
  }

  .article-content :global(a:hover) {
    text-decoration: underline;
  }

  .article-content :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: 6px;
    margin: 16px 0;
  }

  .article-content :global(blockquote) {
    border-left: 3px solid var(--color-accent);
    padding-left: 16px;
    margin: 16px 0;
    color: var(--color-text-muted);
    font-style: italic;
  }

  .article-content :global(pre) {
    background-color: var(--color-surface);
    padding: 16px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 16px 0;
    font-family: var(--font-mono);
    font-size: 13px;
  }

  .article-content :global(code) {
    font-family: var(--font-mono);
    font-size: 0.9em;
    background-color: var(--color-surface);
    padding: 2px 6px;
    border-radius: 3px;
  }

  .article-content :global(pre code) {
    background: none;
    padding: 0;
  }

  .article-content :global(ul),
  .article-content :global(ol) {
    margin: 12px 0;
    padding-left: 24px;
  }

  .article-content :global(li) {
    margin-bottom: 6px;
  }

  .article-content :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
  }

  .article-content :global(th),
  .article-content :global(td) {
    border: 1px solid var(--color-border);
    padding: 8px 12px;
    text-align: left;
  }

  .article-content :global(th) {
    background-color: var(--color-surface);
    font-weight: 600;
  }

  .no-content {
    text-align: center;
    padding: 48px 24px;
    color: var(--color-text-muted);
  }

  .no-content p {
    margin-bottom: 16px;
  }

  .read-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-accent);
    text-decoration: none;
    font-weight: 500;
  }

  .read-link:hover {
    text-decoration: underline;
  }
</style>
