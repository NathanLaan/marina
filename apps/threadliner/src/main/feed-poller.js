const dataStore = require('./data-store');
const feedParser = require('./feed-parser');

const ALLOWED_INTERVALS = [1, 5, 10, 30, 60];
const DEFAULT_INTERVAL_MIN = 10;

let intervalMs = DEFAULT_INTERVAL_MIN * 60 * 1000;
let timer = null;
let inFlight = false;
let listeners = [];

function normalizeInterval(minutes) {
  const n = parseInt(minutes, 10);
  return ALLOWED_INTERVALS.includes(n) ? n : DEFAULT_INTERVAL_MIN;
}

function emit(payload) {
  for (const listener of listeners) {
    try { listener(payload); } catch { /* ignore */ }
  }
}

async function pollOnce() {
  if (inFlight) return;
  inFlight = true;
  try {
    const feeds = dataStore.getAllFeeds();
    const updatedFeeds = [];
    let totalInserted = 0;

    for (const feed of feeds) {
      try {
        const parsed = await feedParser.fetchAndParse(feed.url);
        const entries = feedParser.normalizeEntries(parsed.items || []);
        const inserted = dataStore.insertEntries(feed.id, entries);
        if (inserted > 0) {
          totalInserted += inserted;
          updatedFeeds.push({ id: feed.id, title: feed.title, inserted });
        }
      } catch (err) {
        // Per-feed failures are non-fatal; surface via listener so the caller
        // can log without aborting the rest of the poll cycle.
        emit({ type: 'feed-error', feedId: feed.id, title: feed.title, error: err?.message || String(err) });
      }
    }

    if (totalInserted > 0) {
      emit({ type: 'poll-updated', totalInserted, updatedFeeds });
    } else {
      emit({ type: 'poll-idle' });
    }
  } finally {
    inFlight = false;
  }
}

function start() {
  stop();
  timer = setInterval(pollOnce, intervalMs);
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function setIntervalMinutes(minutes) {
  const normalized = normalizeInterval(minutes);
  intervalMs = normalized * 60 * 1000;
  if (timer) start();
}

function getIntervalMinutes() {
  return Math.round(intervalMs / 60000);
}

function addListener(fn) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

function destroy() {
  stop();
  listeners = [];
}

module.exports = {
  ALLOWED_INTERVALS,
  DEFAULT_INTERVAL_MIN,
  pollOnce,
  start,
  stop,
  setIntervalMinutes,
  getIntervalMinutes,
  addListener,
  destroy,
};
