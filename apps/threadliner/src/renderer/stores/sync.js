import { writable } from 'svelte/store';

export const syncStatus = writable('idle');
export const lastSyncTime = writable(null);
export const lastError = writable(null);
export const syncConfig = writable({ dataDir: null, remoteUrl: null });
export const syncLog = writable([]);

let pollInterval = null;
let lastLogId = 0;

export async function loadSyncConfig() {
  try {
    const config = await window.api.getSyncConfig();
    syncConfig.set(config);
  } catch {
    // Ignore
  }
}

export async function loadFullLog() {
  try {
    const entries = await window.api.getSyncLog();
    syncLog.set(entries);
    if (entries.length > 0) {
      lastLogId = entries[entries.length - 1].id;
    }
  } catch {
    // Ignore
  }
}

export async function pollSyncStatus() {
  try {
    const status = await window.api.getSyncStatus(lastLogId);
    syncStatus.set(status.status);
    lastSyncTime.set(status.lastSyncTime);
    lastError.set(status.lastError);
    if (status.logEntries && status.logEntries.length > 0) {
      lastLogId = status.logEntries[status.logEntries.length - 1].id;
      syncLog.update((existing) => {
        const merged = existing.concat(status.logEntries);
        if (merged.length > 200) {
          return merged.slice(merged.length - 200);
        }
        return merged;
      });
    }
  } catch {
    // Ignore
  }
}

export function startPolling() {
  stopPolling();
  pollSyncStatus();
  pollInterval = setInterval(pollSyncStatus, 2000);
}

export function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  lastLogId = 0;
}

export async function forcePush() {
  syncStatus.set('pushing');
  try {
    const result = await window.api.forcePush();
    syncStatus.set(result.status);
    lastSyncTime.set(result.lastSyncTime);
    lastError.set(result.lastError);
  } catch (err) {
    syncStatus.set('error');
    lastError.set(err.message);
  }
}

export async function forcePull() {
  syncStatus.set('pulling');
  try {
    await window.api.forcePull();
    await pollSyncStatus();
  } catch (err) {
    syncStatus.set('error');
    lastError.set(err.message);
  }
}
