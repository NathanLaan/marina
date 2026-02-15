const { execFile } = require('child_process');
const path = require('path');

let logCallback = null;

function setLogCallback(cb) {
  logCallback = cb;
}

function exec(command, args, cwd) {
  const cmdString = command + ' ' + args.join(' ');
  if (logCallback) logCallback({ type: 'cmd-start', command: cmdString });

  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd, timeout: 60000 }, (error, stdout, stderr) => {
      if (error) {
        // Build a detailed error message with all available info
        const parts = [];
        if (stderr.trim()) parts.push(stderr.trim());
        if (stdout.trim() && !stderr.trim()) parts.push(stdout.trim());
        if (error.killed) parts.push('Process killed (timeout)');
        if (error.signal) parts.push('Signal: ' + error.signal);
        if (parts.length === 0) parts.push(error.message);
        const message = parts.join(' — ');
        if (logCallback) logCallback({ type: 'cmd-error', command: cmdString, message });
        reject(new Error(message));
      } else {
        if (logCallback) logCallback({ type: 'cmd-ok', command: cmdString, output: stdout.trim() });
        resolve(stdout.trim());
      }
    });
  });
}

async function isGitInstalled() {
  try {
    await exec('git', ['--version'], process.cwd());
    return true;
  } catch {
    return false;
  }
}

async function isGitRepo(dir) {
  try {
    await exec('git', ['rev-parse', '--git-dir'], dir);
    return true;
  } catch {
    return false;
  }
}

async function cloneRepo(remoteUrl, localDir) {
  // Clone into the directory
  const parent = path.dirname(localDir);
  const dirName = path.basename(localDir);
  await exec('git', ['clone', remoteUrl, dirName], parent);
  await configureUser(localDir);
}

async function configureUser(localDir) {
  // Set a local git user identity so commits work even without global config
  try {
    await exec('git', ['config', 'user.name'], localDir);
  } catch {
    await exec('git', ['config', 'user.name', 'Threadline'], localDir);
  }
  try {
    await exec('git', ['config', 'user.email'], localDir);
  } catch {
    await exec('git', ['config', 'user.email', 'threadline@localhost'], localDir);
  }
}

async function initRepo(localDir, remoteUrl) {
  await exec('git', ['init'], localDir);
  await configureUser(localDir);
  if (remoteUrl) {
    await exec('git', ['remote', 'add', 'origin', remoteUrl], localDir);
  }
  // Create initial commit so we have a branch
  await exec('git', ['commit', '--allow-empty', '-m', 'Initial commit'], localDir);
}

async function commitAll(dataDir, message) {
  // Stage all changes
  await exec('git', ['add', '-A'], dataDir);

  // Check if there's anything to commit
  try {
    await exec('git', ['diff', '--cached', '--quiet'], dataDir);
    // No changes staged — nothing to commit
    return false;
  } catch {
    // There are staged changes — proceed with commit
  }

  await exec('git', ['commit', '-m', message], dataDir);
  return true;
}

async function pull(dataDir) {
  // Check if remote exists
  try {
    await exec('git', ['remote', 'get-url', 'origin'], dataDir);
  } catch {
    // No remote configured — skip pull
    return { success: true, skipped: true };
  }

  try {
    // Fetch from remote
    await exec('git', ['fetch', 'origin'], dataDir);

    // Determine which remote branch exists
    let remoteBranch = null;
    try {
      await exec('git', ['rev-parse', '--verify', 'origin/main'], dataDir);
      remoteBranch = 'origin/main';
    } catch {
      try {
        await exec('git', ['rev-parse', '--verify', 'origin/master'], dataDir);
        remoteBranch = 'origin/master';
      } catch {
        // No remote branch yet — nothing to pull
        return { success: true, skipped: true };
      }
    }

    // Check if we're already up to date
    const localHead = await exec('git', ['rev-parse', 'HEAD'], dataDir);
    const remoteHead = await exec('git', ['rev-parse', remoteBranch], dataDir);
    if (localHead === remoteHead) {
      return { success: true };
    }

    // Check if remote is ancestor of local (we're ahead, no pull needed)
    try {
      await exec('git', ['merge-base', '--is-ancestor', remoteBranch, 'HEAD'], dataDir);
      // Remote is ancestor of local — we're ahead, no rebase needed
      return { success: true };
    } catch {
      // Remote has diverged or is ahead — need to rebase
    }

    // Rebase onto remote (avoids the double-fetch that git pull does)
    await exec('git', ['rebase', remoteBranch], dataDir);
    return { success: true };
  } catch (err) {
    // Abort any in-progress rebase to leave repo in clean state
    try {
      await exec('git', ['rebase', '--abort'], dataDir);
    } catch {
      // No rebase in progress — that's fine
    }
    return { success: false, error: err.message };
  }
}

async function push(dataDir) {
  try {
    await exec('git', ['remote', 'get-url', 'origin'], dataDir);
  } catch {
    return { success: true, skipped: true };
  }

  try {
    // Detect the current branch name
    const branch = await exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], dataDir);
    await exec('git', ['push', '-u', 'origin', branch], dataDir);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function getStatus(dataDir) {
  try {
    const output = await exec('git', ['status', '--porcelain'], dataDir);
    return {
      clean: output.length === 0,
      output,
    };
  } catch (err) {
    return { clean: true, error: err.message };
  }
}

async function getRemoteUrl(dataDir) {
  try {
    return await exec('git', ['remote', 'get-url', 'origin'], dataDir);
  } catch {
    return null;
  }
}

async function getBranch(dataDir) {
  try {
    return await exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], dataDir);
  } catch {
    return null;
  }
}

module.exports = {
  isGitInstalled,
  isGitRepo,
  cloneRepo,
  initRepo,
  configureUser,
  commitAll,
  pull,
  push,
  getStatus,
  getRemoteUrl,
  getBranch,
  setLogCallback,
};
