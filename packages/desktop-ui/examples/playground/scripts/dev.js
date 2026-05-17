const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const isWindows = os.platform() === 'win32';

const vite = spawn('npx', ['vite'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'pipe',
  shell: true,
  detached: !isWindows,
});

let viteKilled = false;
function killVite() {
  if (viteKilled || !vite.pid) return;
  viteKilled = true;
  try {
    if (isWindows) {
      spawn('taskkill', ['/pid', String(vite.pid), '/f', '/t']);
    } else {
      process.kill(-vite.pid, 'SIGTERM');
    }
  } catch {
    // already gone
  }
}

vite.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);

  if (output.includes('Local:')) {
    console.log('\nStarting Electron...\n');
    const electron = spawn('npx', ['electron', '--class=DesktopUiPlayground', '.'], {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, NODE_ENV: 'development' },
    });

    electron.on('close', () => {
      killVite();
      process.exit();
    });
  }
});

vite.stderr.on('data', (data) => {
  process.stderr.write(data);
});

vite.on('close', (code) => {
  process.exit(code);
});

process.on('SIGINT',  () => { killVite(); process.exit(0); });
process.on('SIGTERM', () => { killVite(); process.exit(0); });
process.on('exit',    killVite);
