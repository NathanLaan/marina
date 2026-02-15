import { writable } from 'svelte/store';

export const syncStatus = writable('idle');
export const lastSyncTime = writable(null);
export const lastError = writable(null);
export const syncConfig = writable({ dataDir: null, remoteUrl: null });

let pollInterval = null;

export async function loadSyncConfig() {
  try {
    const config = await window.api.getSyncConfig();
    syncConfig.set(config);
  } catch {
    // Ignore
  }
}

export async function pollSyncStatus() {
  try {
    const status = await window.api.getSyncStatus();
    syncStatus.set(status.status);
    lastSyncTime.set(status.lastSyncTime);
    lastError.set(status.lastError);
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
