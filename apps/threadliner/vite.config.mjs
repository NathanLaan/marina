import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [svelte()],
  root: 'src/renderer',
  base: './',
  server: {
    port: 5251,
    strictPort: true,
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
});
