// Centralised pdf.js setup. Vite's `?worker` suffix bundles pdf.worker as its
// own chunk and hands us a Worker *constructor* — importing it does not spawn a
// worker. We create the worker lazily on first use (ensurePdfWorker) so merely
// browsing the library or opening an EPUB never starts a PDF worker, and any
// worker hiccup is isolated to PDF reading rather than app startup.
import * as pdfjsLib from 'pdfjs-dist';
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';

let workerStarted = false;

export function ensurePdfWorker() {
  if (workerStarted) return;
  pdfjsLib.GlobalWorkerOptions.workerPort = new PdfjsWorker();
  workerStarted = true;
}

export { pdfjsLib };
