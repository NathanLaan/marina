// Rasterize an SVG to a PNG at a given size using a headless Electron
// BrowserWindow. Run via `electron scripts/rasterize-icon.js <svg> <png> [size]`.
//
// We use Electron because it's already a dev dep of every app in this monorepo
// and ships with Chromium — no extra install step, no ImageMagick required.
// The window is offscreen + transparent so the captured PNG has no chrome.

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const [svgArg, pngArg, sizeArg] = process.argv.slice(2);
if (!svgArg || !pngArg) {
  console.error('usage: electron rasterize-icon.js <input.svg> <output.png> [size=512]');
  process.exit(1);
}
const size = parseInt(sizeArg || '512', 10);
const svgPath = path.resolve(svgArg);
const pngPath = path.resolve(pngArg);

if (!fs.existsSync(svgPath)) {
  console.error(`rasterize-icon: source not found: ${svgPath}`);
  process.exit(1);
}

const svg = fs.readFileSync(svgPath, 'utf8');

// Wrap the SVG in a minimal HTML doc that stretches it to fill the viewport.
// Using a data: URL avoids any filesystem permission shenanigans.
const html = `<!doctype html><html><head><style>
  html, body { margin: 0; padding: 0; background: transparent; }
  svg { display: block; width: 100vw; height: 100vh; }
</style></head><body>${svg}</body></html>`;

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: size,
    height: size,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: { offscreen: true },
  });

  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

  // capturePage() can race with the first paint on some platforms; a small
  // wait lets fonts and the SVG finish rendering before we snapshot.
  await new Promise((r) => setTimeout(r, 200));

  const image = await win.webContents.capturePage();
  fs.mkdirSync(path.dirname(pngPath), { recursive: true });
  fs.writeFileSync(pngPath, image.toPNG());

  console.log(`rasterize-icon: wrote ${pngPath} (${size}x${size})`);
  app.quit();
});
