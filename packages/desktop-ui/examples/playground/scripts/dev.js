const { spawn, execFileSync } = require('child_process');
const path = require('path');
const os = require('os');

const isWindows = os.platform() === 'win32';
const APP_ROOT = path.resolve(__dirname, '..');

// Bundle the preload first — it require()s @marina/desktop-ui/preload which
// only resolves once esbuild has inlined it.
console.log('Bundling preload...');
execFileSync('npx', [
  'esbuild',
  'src/main/preload.js',
  '--bundle',
  '--platform=node',
  '--target=node20',
  '--external:electron',
  '--outfile=dist/preload.cjs',
], { cwd: APP_ROOT, stdio: 'inherit', shell: isWindows });

const vite = spawn('npx', ['vite'], {
  cwd: APP_ROOT,
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
      cwd: APP_ROOT,
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
