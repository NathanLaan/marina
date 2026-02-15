const gitSync = require('./git-sync');

let dataDir = null;
let waitTimeMs = 10000; // default 10 seconds
let pushTimer = null;
let lastSyncTime = null;
let status = 'idle'; // idle | committing | waiting | pulling | pushing | error
let lastError = null;
let statusListeners = [];

// Log buffer
const MAX_LOG_ENTRIES = 200;
let logEntries = [];
let logIdCounter = 0;

// Operation queue to serialize all git operations
let operationQueue = Promise.resolve();

function addLogEntry(level, message, detail) {
  logIdCounter++;
  const entry = {
    id: logIdCounter,
    timestamp: Date.now(),
    level,
    message,
    detail: detail || null,
  };
  logEntries.push(entry);
  if (logEntries.length > MAX_LOG_ENTRIES) {
    logEntries = logEntries.slice(logEntries.length - MAX_LOG_ENTRIES);
  }
}

// Commands to filter out of the log (plumbing / noise)
const FILTERED_COMMANDS = ['config user.', 'rev-parse --git-dir'];

function init(dir, waitTimeSeconds) {
  dataDir = dir;
  if (waitTimeSeconds) {
    waitTimeMs = waitTimeSeconds * 1000;
  }
  status = 'idle';
  lastError = null;
  operationQueue = Promise.resolve();
  logEntries = [];
  logIdCounter = 0;

  gitSync.setLogCallback((event) => {
    // Filter out plumbing commands
    if (FILTERED_COMMANDS.some((f) => event.command.includes(f))) return;

    if (event.type === 'cmd-start') {
      addLogEntry('info', '$ ' + event.command);
    } else if (event.type === 'cmd-ok') {
      if (event.output) {
        addLogEntry('info', event.output);
      }
    } else if (event.type === 'cmd-error') {
      addLogEntry('error', event.message);
    }
  });
}

function getStatus(sinceLogId) {
  const result = {
    status,
    lastSyncTime,
    lastError,
    waitTimeMs,
    remainingMs: pushTimer ? getRemainingTime() : null,
  };
  if (sinceLogId) {
    result.logEntries = logEntries.filter((e) => e.id > sinceLogId);
  } else {
    result.logEntries = [];
  }
  return result;
}

function getFullLog() {
  return logEntries.slice();
}

// Track when the timer started and duration for countdown
let timerStartedAt = null;
let timerDuration = null;

function getRemainingTime() {
  if (!timerStartedAt || !timerDuration) return null;
  const elapsed = Date.now() - timerStartedAt;
  return Math.max(0, timerDuration - elapsed);
}

const STATUS_LOG_MESSAGES = {
  committing: 'Committing changes...',
  pulling: 'Pulling from remote...',
  pushing: 'Pushing to remote...',
  waiting: 'Waiting to push...',
  idle: 'Sync complete',
};

function setStatus(newStatus, error) {
  status = newStatus;
  lastError = error || null;
  if (error) {
    addLogEntry('error', error);
  } else if (STATUS_LOG_MESSAGES[newStatus]) {
    addLogEntry('info', STATUS_LOG_MESSAGES[newStatus]);
  }
  notifyListeners();
}

function notifyListeners() {
  for (const listener of statusListeners) {
    try { listener(getStatus()); } catch { /* ignore */ }
  }
}

function onStatusChange(listener) {
  statusListeners.push(listener);
  return () => {
    statusListeners = statusListeners.filter((l) => l !== listener);
  };
}

// Enqueue a git operation so they run sequentially, never concurrently
function enqueue(fn) {
  operationQueue = operationQueue.then(fn, fn);
  return operationQueue;
}

function notifyChange(commitMessage) {
  if (!dataDir) return;

  return enqueue(async () => {
    setStatus('committing');
    try {
      const committed = await gitSync.commitAll(dataDir, commitMessage);
      if (!committed) {
        setStatus('idle');
        return;
      }
    } catch (err) {
      setStatus('error', 'Commit failed: ' + err.message);
      return;
    }

    // Reset the push debounce timer
    schedulePush();
  });
}

function schedulePush() {
  if (pushTimer) {
    clearTimeout(pushTimer);
  }

  timerStartedAt = Date.now();
  timerDuration = waitTimeMs;
  setStatus('waiting');

  pushTimer = setTimeout(() => {
    pushTimer = null;
    timerStartedAt = null;
    timerDuration = null;
    enqueue(executePush);
  }, waitTimeMs);
}

async function executePush() {
  if (!dataDir) return;

  // Commit any pending changes that arrived while we were queued
  setStatus('committing');
  try {
    await gitSync.commitAll(dataDir, 'Auto-commit before sync');
  } catch {
    // Nothing to commit — that's fine
  }

  // Pull first
  setStatus('pulling');
  const pullResult = await gitSync.pull(dataDir);
  if (!pullResult.success) {
    setStatus('error', 'Pull failed: ' + pullResult.error);
    return;
  }

  // Push
  setStatus('pushing');
  const pushResult = await gitSync.push(dataDir);
  if (!pushResult.success) {
    setStatus('error', 'Push failed: ' + pushResult.error);
    return;
  }

  lastSyncTime = new Date().toISOString();
  setStatus('idle');
}

function forcePush() {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
    timerStartedAt = null;
    timerDuration = null;
  }

  return enqueue(async () => {
    // Commit any uncommitted changes first
    setStatus('committing');
    try {
      await gitSync.commitAll(dataDir, 'Manual sync');
    } catch {
      // May have nothing to commit — that's fine
    }

    await executePush();
  });
}

function forcePull() {
  if (!dataDir) return Promise.resolve({ success: false, error: 'Not initialized' });

  return enqueue(async () => {
    setStatus('pulling');
    const pullResult = await gitSync.pull(dataDir);
    if (!pullResult.success) {
      setStatus('error', 'Pull failed: ' + pullResult.error);
      return { success: false, error: pullResult.error };
    }

    setStatus('idle');
    return { success: true };
  });
}

function updateWaitTime(seconds) {
  waitTimeMs = seconds * 1000;
}

function destroy() {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  timerStartedAt = null;
  timerDuration = null;
  statusListeners = [];
  gitSync.setLogCallback(null);
}

module.exports = {
  init,
  getStatus,
  getFullLog,
  onStatusChange,
  notifyChange,
  forcePush,
  forcePull,
  updateWaitTime,
  destroy,
};
