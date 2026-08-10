// Rewrites `_attachments/` references in rendered HTML to the `attachment://`
// custom protocol registered in main.js, which serves files out of the open
// project's _attachments folder. Keeps the renderer free of filesystem paths.
//
// Extracted from Preview.svelte so the slide renderer resolves images exactly
// the same way the note preview does.
export function resolveAttachmentUrls(rawHtml) {
  return rawHtml.replace(
    /(?:src|href)="\.?\/?_attachments\/([^"]+)"/g,
    (match, filename) => match.replace(`./_attachments/${filename}`, `attachment:///${encodeURIComponent(filename)}`)
      .replace(`_attachments/${filename}`, `attachment:///${encodeURIComponent(filename)}`)
  );
}
