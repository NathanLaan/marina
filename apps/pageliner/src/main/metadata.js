const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

// Extracts display metadata (title, author) and, where possible, a cover image
// from a document. EPUB is parsed properly (it's a ZIP with an OPF manifest);
// PDF degrades to a filename-derived title with no cover until the Phase 2
// pdf.js integration can read its document info. Everything is best-effort —
// any failure falls back to the filename so import never blocks.

function decodeEntities(s) {
  if (!s) return s;
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

function titleFromFilename(filePath) {
  return path.basename(filePath).replace(/\.[^.]+$/, '');
}

function extFromMediaType(mt, href) {
  const byHref = href && path.extname(href).replace(/^\./, '');
  if (byHref) return byHref.toLowerCase();
  if (!mt) return 'png';
  if (mt.includes('jpeg') || mt.includes('jpg')) return 'jpg';
  if (mt.includes('png')) return 'png';
  if (mt.includes('gif')) return 'gif';
  if (mt.includes('svg')) return 'svg';
  if (mt.includes('webp')) return 'webp';
  return 'png';
}

// Resolve an OPF-relative href against the OPF's own directory, normalized to
// the forward-slash paths JSZip uses internally.
function resolveZipPath(opfPath, href) {
  const dir = path.posix.dirname(opfPath.split(path.sep).join('/'));
  const joined = path.posix.normalize(path.posix.join(dir, href));
  return joined.replace(/^\.\//, '');
}

async function extractEpub(filePath) {
  const buf = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buf);

  // 1. META-INF/container.xml → OPF path
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) return { title: titleFromFilename(filePath), author: null, cover: null };
  const container = await containerFile.async('string');
  const opfMatch = container.match(/<rootfile[^>]*full-path="([^"]+)"/i);
  if (!opfMatch) return { title: titleFromFilename(filePath), author: null, cover: null };
  const opfPath = opfMatch[1];

  const opfFile = zip.file(opfPath);
  if (!opfFile) return { title: titleFromFilename(filePath), author: null, cover: null };
  const opf = await opfFile.async('string');

  // 2. Title + author from Dublin Core metadata.
  const titleMatch = opf.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i);
  const creatorMatch = opf.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i);
  const title = decodeEntities(titleMatch?.[1]) || titleFromFilename(filePath);
  const author = decodeEntities(creatorMatch?.[1]) || null;

  // 3. Cover: prefer <meta name="cover" content="id"> → manifest item; fall
  //    back to a manifest item flagged properties="cover-image".
  let coverHref = null, coverMediaType = null;
  const metaCover = opf.match(/<meta[^>]*name="cover"[^>]*content="([^"]+)"/i)
    || opf.match(/<meta[^>]*content="([^"]+)"[^>]*name="cover"/i);
  if (metaCover) {
    const id = metaCover[1];
    const item = opf.match(new RegExp(`<item[^>]*id="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`, 'i'));
    if (item) {
      coverHref = item[0].match(/href="([^"]+)"/i)?.[1] || null;
      coverMediaType = item[0].match(/media-type="([^"]+)"/i)?.[1] || null;
    }
  }
  if (!coverHref) {
    const propItem = opf.match(/<item[^>]*properties="[^"]*cover-image[^"]*"[^>]*>/i);
    if (propItem) {
      coverHref = propItem[0].match(/href="([^"]+)"/i)?.[1] || null;
      coverMediaType = propItem[0].match(/media-type="([^"]+)"/i)?.[1] || null;
    }
  }

  let cover = null;
  if (coverHref) {
    const coverEntry = zip.file(resolveZipPath(opfPath, decodeEntities(coverHref)));
    if (coverEntry) {
      const data = await coverEntry.async('nodebuffer');
      cover = { buffer: data, ext: extFromMediaType(coverMediaType, coverHref) };
    }
  }

  return { title, author, cover };
}

// Dispatch by extension. Returns { title, author, cover: {buffer, ext}|null }.
async function extract(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  try {
    if (ext === '.epub') return await extractEpub(filePath);
  } catch {
    // fall through to filename fallback
  }
  return { title: titleFromFilename(filePath), author: null, cover: null };
}

function formatFromExt(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.epub') return 'epub';
  if (ext === '.pdf') return 'pdf';
  return ext.replace(/^\./, '') || 'unknown';
}

module.exports = { extract, formatFromExt, titleFromFilename };
