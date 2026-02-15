import { writable, derived } from 'svelte/store';

// Core data stores
export const feeds = writable([]);
export const entries = writable([]);

// Selection state
export const selectedFeedId = writable(null);
export const selectedEntryId = writable(null);

// UI state
export const isLoading = writable(false);
export const error = writable(null);
export const setupComplete = writable(false);

// Derived: currently selected feed object
export const selectedFeed = derived(
  [feeds, selectedFeedId],
  ([$feeds, $selectedFeedId]) => {
    if ($selectedFeedId === null) return null;
    return $feeds.find((f) => f.id === $selectedFeedId) || null;
  }
);

// Derived: currently selected entry object
export const selectedEntry = derived(
  [entries, selectedEntryId],
  ([$entries, $selectedEntryId]) => {
    if ($selectedEntryId === null) return null;
    return $entries.find((e) => e.id === $selectedEntryId) || null;
  }
);

// Actions
export async function checkSetup() {
  const complete = await window.api.isSetupComplete();
  setupComplete.set(complete);
  return complete;
}

export async function loadFeeds() {
  try {
    const result = await window.api.getFeeds();
    feeds.set(result);
  } catch (err) {
    error.set('Failed to load feeds: ' + err.message);
  }
}

export async function selectFeed(feedId) {
  selectedFeedId.set(feedId);
  selectedEntryId.set(null);
  if (feedId === null) {
    entries.set([]);
    return;
  }
  isLoading.set(true);
  try {
    const result = await window.api.getEntries(feedId);
    entries.set(result);
  } catch (err) {
    error.set('Failed to load entries: ' + err.message);
  } finally {
    isLoading.set(false);
  }
}

export async function selectEntry(entryId) {
  selectedEntryId.set(entryId);
  if (entryId === null) return;

  // Get the current feedId
  let currentFeedId;
  const unsub = selectedFeedId.subscribe((v) => (currentFeedId = v));
  unsub();

  if (!currentFeedId) return;

  // Mark as read
  try {
    await window.api.markRead(entryId, currentFeedId);
    entries.update((items) =>
      items.map((e) => (e.id === entryId ? { ...e, is_read: 1 } : e))
    );
    loadFeeds();
  } catch (err) {
    // Non-critical
  }
}

export async function addFeed(url) {
  isLoading.set(true);
  error.set(null);
  try {
    await window.api.addFeed(url);
    await loadFeeds();
  } catch (err) {
    error.set('Failed to add feed: ' + err.message);
    throw err;
  } finally {
    isLoading.set(false);
  }
}

export async function editFeed(id, data) {
  error.set(null);
  try {
    await window.api.editFeed(id, data);
    await loadFeeds();
  } catch (err) {
    error.set('Failed to edit feed: ' + err.message);
    throw err;
  }
}

export async function removeFeed(id) {
  error.set(null);
  try {
    await window.api.removeFeed(id);
    feeds.update((items) => items.filter((f) => f.id !== id));
    let currentFeedId;
    const unsub = selectedFeedId.subscribe((v) => (currentFeedId = v));
    unsub();
    if (currentFeedId === id) {
      selectedFeedId.set(null);
      selectedEntryId.set(null);
      entries.set([]);
    }
  } catch (err) {
    error.set('Failed to remove feed: ' + err.message);
  }
}

export async function refreshFeed(id) {
  isLoading.set(true);
  error.set(null);
  try {
    await window.api.refreshFeed(id);
    await loadFeeds();
    let currentFeedId;
    const unsub = selectedFeedId.subscribe((v) => (currentFeedId = v));
    unsub();
    if (currentFeedId === id) {
      const result = await window.api.getEntries(id);
      entries.set(result);
    }
  } catch (err) {
    error.set('Failed to refresh feed: ' + err.message);
  } finally {
    isLoading.set(false);
  }
}

// Mark all / mark single read/unread

export async function markAllRead(feedId) {
  error.set(null);
  try {
    await window.api.markAllRead(feedId);
    entries.update((items) =>
      items.map((e) => ({ ...e, is_read: 1 }))
    );
    loadFeeds();
  } catch (err) {
    error.set('Failed to mark all read: ' + err.message);
  }
}

export async function markAllUnread(feedId) {
  error.set(null);
  try {
    await window.api.markAllUnread(feedId);
    entries.update((items) =>
      items.map((e) => ({ ...e, is_read: 0 }))
    );
    loadFeeds();
  } catch (err) {
    error.set('Failed to mark all unread: ' + err.message);
  }
}

export async function markEntryRead(entryId, feedId) {
  try {
    await window.api.markRead(entryId, feedId);
    entries.update((items) =>
      items.map((e) => (e.id === entryId ? { ...e, is_read: 1 } : e))
    );
    loadFeeds();
  } catch (err) {
    // Non-critical
  }
}

export async function markEntryUnread(entryId, feedId) {
  try {
    await window.api.markUnread(entryId, feedId);
    entries.update((items) =>
      items.map((e) => (e.id === entryId ? { ...e, is_read: 0 } : e))
    );
    loadFeeds();
  } catch (err) {
    // Non-critical
  }
}
