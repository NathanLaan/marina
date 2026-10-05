// Rewrites `_attachments/` references in rendered HTML to the `attachment://`
// custom protocol registered by the host (main.js / the Tauri build), which
// serves files out of the open project's _attachments folder. Keeps the
// renderer free of filesystem paths.
//
// Extracted from Preview.svelte so the slide renderer, history panel, and
// attachment thumbnails resolve images exactly the same way.

// An explicit `localhost` host: Electron only reads the path, but the Tauri
// build parses the URL as an http::Uri, which rejects an empty authority.
export function attachmentUrl(filename) {
  return `attachment://localhost/${encodeURIComponent(filename)}`;
}

export function resolveAttachmentUrls(rawHtml) {
  return rawHtml.replace(
    /(?:src|href)="\.?\/?_attachments\/([^"]+)"/g,
    (match, filename) => match.replace(`./_attachments/${filename}`, attachmentUrl(filename))
      .replace(`_attachments/${filename}`, attachmentUrl(filename))
  );
}
