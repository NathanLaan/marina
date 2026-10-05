#!/usr/bin/env node
// Bundles an app's Electron preload.js into a self-contained IIFE for the
// Tauri build, with `electron` aliased to ../src/tauri-shim/electron.js.
// Invoked from each app's src-tauri/build.rs.
//
//   node bundle-tauri-preload.mjs <preload.js> <outfile>

import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const [entry, outfile] = process.argv.slice(2);
if (!entry || !outfile) {
  console.error('usage: bundle-tauri-preload.mjs <preload.js> <outfile>');
  process.exit(2);
}

const result = await build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  alias: { electron: path.join(here, '..', 'src', 'tauri-shim', 'electron.js') },
  legalComments: 'none',
  metafile: true,
  logLevel: 'warning',
});

// build.rs re-runs when any bundled input changes.
for (const input of Object.keys(result.metafile.inputs)) {
  console.log(path.resolve(input));
}
