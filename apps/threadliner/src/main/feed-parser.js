const RSSParser = require('rss-parser');

const RSS_ACCEPT = 'application/feed+json, application/json, application/rss+xml, application/atom+xml, application/xml, text/xml, */*';

const parser = new RSSParser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Threadline/0.1.0',
    'Accept': RSS_ACCEPT,
  },
});

async function fetchRaw(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Threadline/0.1.0',
      'Accept': RSS_ACCEPT,
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch feed: HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const body = await response.text();
  return { contentType, body };
}

function isJsonFeed(contentType, body) {
  if (contentType.includes('application/feed+json') || contentType.includes('application/json')) {
    try {
      const parsed = JSON.parse(body);
      return parsed.version && parsed.version.startsWith('https://jsonfeed.org/version/');
    } catch {
      return false;
    }
  }

  // Also try parsing if content-type is ambiguous but body looks like JSON
  if (body.trimStart().startsWith('{')) {
    try {
      const parsed = JSON.parse(body);
      return parsed.version && parsed.version.startsWith('https://jsonfeed.org/version/');
    } catch {
      return false;
    }
  }

  return false;
}

function parseJsonFeed(body) {
  const feed = JSON.parse(body);

  return {
    title: feed.title || null,
    description: feed.description || null,
    link: feed.home_page_url || null,
    feedUrl: feed.feed_url || null,
    items: (feed.items || []).map((item) => ({
      id: item.id || null,
      title: item.title || null,
      link: item.url || item.external_url || null,
      content: item.content_html || item.content_text || null,
      summary: item.summary || null,
      author: extractJsonFeedAuthor(item, feed),
      isoDate: item.date_published || item.date_modified || null,
    })),
  };
}

function extractJsonFeedAuthor(item, feed) {
  // JSON Feed v1.1 uses "authors" array, v1 uses "author" object
  if (item.authors && item.authors.length > 0) {
    return item.authors.map((a) => a.name).filter(Boolean).join(', ') || null;
  }
  if (item.author && item.author.name) {
    return item.author.name;
  }
  // Fall back to feed-level author
  if (feed.authors && feed.authors.length > 0) {
    return feed.authors.map((a) => a.name).filter(Boolean).join(', ') || null;
  }
  if (feed.author && feed.author.name) {
    return feed.author.name;
  }
  return null;
}

async function fetchAndParse(url) {
  const { contentType, body } = await fetchRaw(url);

  if (isJsonFeed(contentType, body)) {
    return parseJsonFeed(body);
  }

  // Fall back to RSS/Atom XML parsing
  const feed = await parser.parseString(body);
  return feed;
}

function normalizeEntries(items) {
  return items.map((item) => ({
    guid: item.guid || item.id || item.link || item.title || String(Date.now()),
    title: item.title || null,
    link: item.link || null,
    content: item['content:encoded'] || item.content || item.summary || null,
    author: item.creator || item.author || null,
    publishedAt: item.isoDate || item.pubDate || null,
  }));
}

module.exports = {
  fetchAndParse,
  normalizeEntries,
};
