const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const JSZip = require('jszip');
const { DOMParser } = require('@xmldom/xmldom');

const MAX_DOC_SIZE = 100 * 1024 * 1024; // 100MB — reject up front
const MAX_ATTACHMENT_SIZE = 30 * 1024 * 1024;

const CONTENT_TYPE_EXT = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/bmp': '.bmp',
  'image/tiff': '.tiff',
};

const EXT_CONTENT_TYPE = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
};

// Word uses "Heading 1".."Heading 9"; we only support H1-H6 in markdown.
const STYLE_MAP = [
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Heading 4'] => h4:fresh",
  "p[style-name='Heading 5'] => h5:fresh",
  "p[style-name='Heading 6'] => h6:fresh",
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  "p[style-name='Quote'] => blockquote:fresh",
  "p[style-name='Intense Quote'] => blockquote:fresh",
];

class ImportService {
  constructor(projectService) {
    this.projectService = projectService;
  }

  // Dispatch by extension. Keeps the IPC handler agnostic so future formats
  // can be added by extending this switch and the dialog filter.
  async import(sourcePath) {
    if (!sourcePath || !path.isAbsolute(sourcePath)) {
      throw new Error('Invalid source path');
    }
    const ext = path.extname(sourcePath).toLowerCase();
    switch (ext) {
      case '.docx': return this.importDocx(sourcePath);
      case '.pptx': return this.importPptx(sourcePath);
      case '.ppt':
        throw new Error(
          'Legacy .ppt files are not supported. Open in PowerPoint or ' +
          'LibreOffice Impress and re-save as .pptx, then try again.'
        );
      default:
        throw new Error(`Unsupported file type: ${ext || '(none)'}`);
    }
  }

  async importDocx(sourcePath) {
    if (!this.projectService.projectPath) {
      throw new Error('No project is open');
    }
    if (!fs.existsSync(sourcePath)) {
      throw new Error('Source file does not exist');
    }

    const stat = fs.statSync(sourcePath);
    if (stat.size > MAX_DOC_SIZE) {
      throw new Error(`Document exceeds ${MAX_DOC_SIZE / 1024 / 1024}MB limit`);
    }

    const buffer = fs.readFileSync(sourcePath);
    const sourceName = path.basename(sourcePath, path.extname(sourcePath));

    // Create the note first so we have a fileId to attach images to.
    // Start body empty so we can overwrite with the converted content.
    const entry = await this.projectService.createFile(sourceName, [], { body: '' });

    const stats = { images: 0, tablesStripped: 0, warnings: [] };

    let result;
    try {
      result = await mammoth.convertToMarkdown(
        {
          buffer,
          transformDocument: (doc) => this.stripTables(doc, stats),
          convertImage: mammoth.images.imgElement(async (image) => {
            return await this.handleMammothImage(image, entry.id, stats);
          }),
        },
        { styleMap: STYLE_MAP }
      );
    } catch (err) {
      // If conversion fails after we created the note, leave it in place with an
      // empty body — safer than trying to delete (which would add another commit)
      // and lets the user see what landed before asking to retry.
      throw new Error(`Conversion failed: ${err.message}`);
    }

    for (const msg of result.messages || []) {
      if (msg.type === 'warning' || msg.type === 'error') {
        stats.warnings.push(msg.message);
      }
    }

    const markdown = this.postProcess(result.value, sourceName);
    await this.projectService.writeFile(entry.filename, markdown);

    return { entry, stats };
  }

  // ───────────────────────────── PPTX ─────────────────────────────
  //
  // .pptx is an Office Open XML package: a ZIP of XML files with a
  // `ppt/media/` folder for embedded images. We walk slides in the order
  // declared by `ppt/presentation.xml` (NOT lexical filename order — a
  // reordered deck keeps filename `slide1.xml` but moves its rId).
  //
  // For each slide we produce:
  //   ## Slide N[: [HIDDEN: ]Title]   ← header
  //   <body paragraphs and bullet lists>
  //   <image attachments>
  //   ### Notes                       ← if speaker notes present
  //   <notes paragraphs>
  //
  // Formatting (bold/italic/colour) is intentionally dropped — only the
  // bullet/paragraph distinction and indent levels are preserved.

  async importPptx(sourcePath) {
    if (!this.projectService.projectPath) {
      throw new Error('No project is open');
    }
    if (!fs.existsSync(sourcePath)) {
      throw new Error('Source file does not exist');
    }

    const stat = fs.statSync(sourcePath);
    if (stat.size > MAX_DOC_SIZE) {
      throw new Error(`Document exceeds ${MAX_DOC_SIZE / 1024 / 1024}MB limit`);
    }

    const buffer = fs.readFileSync(sourcePath);
    const sourceName = path.basename(sourcePath, path.extname(sourcePath));

    let zip;
    try {
      zip = await JSZip.loadAsync(buffer);
    } catch (err) {
      throw new Error(`Not a valid .pptx archive: ${err.message}`);
    }
    if (!zip.file('ppt/presentation.xml')) {
      throw new Error('Not a valid .pptx file (missing ppt/presentation.xml)');
    }

    // Create the note up front so attachments have a fileId target.
    const entry = await this.projectService.createFile(sourceName, [], { body: '' });
    const stats = { slides: 0, images: 0, warnings: [] };

    let slidePaths;
    try {
      slidePaths = await this.pptxResolveSlideOrder(zip);
    } catch (err) {
      throw new Error(`Failed to resolve slide order: ${err.message}`);
    }

    const importedDate = new Date().toISOString().slice(0, 10);
    const out = [`# ${sourceName} (Imported ${importedDate})`, ''];

    for (let i = 0; i < slidePaths.length; i++) {
      stats.slides += 1;
      const slideNum = i + 1;
      try {
        const slideMd = await this.pptxRenderSlide(zip, slidePaths[i], slideNum, entry.id, stats);
        out.push(slideMd);
      } catch (err) {
        stats.warnings.push(`Slide ${slideNum}: ${err.message}`);
        out.push(`## Slide ${slideNum}`, '', `_[Slide ${slideNum} failed to import: ${err.message}]_`, '');
      }
    }

    const markdown = this.postProcessPptx(out.join('\n'));
    await this.projectService.writeFile(entry.filename, markdown);

    return { entry, stats };
  }

  // Slide order comes from `<p:sldIdLst>` in presentation.xml — each
  // `<p:sldId>` has an `r:id` whose target is the slide's xml path.
  // Filename order (slide1, slide2…) is NOT canonical: PowerPoint
  // preserves filenames on reorder and only updates the rels.
  async pptxResolveSlideOrder(zip) {
    const presXml = await zip.file('ppt/presentation.xml').async('string');
    const presDoc = new DOMParser({ errorHandler: () => {} }).parseFromString(presXml, 'text/xml');
    const sldIds = presDoc.getElementsByTagName('p:sldId');

    const relsXml = await zip.file('ppt/_rels/presentation.xml.rels').async('string');
    const relsDoc = new DOMParser({ errorHandler: () => {} }).parseFromString(relsXml, 'text/xml');
    const relsById = new Map();
    const rels = relsDoc.getElementsByTagName('Relationship');
    for (let i = 0; i < rels.length; i++) {
      relsById.set(rels[i].getAttribute('Id'), rels[i].getAttribute('Target'));
    }

    const paths = [];
    for (let i = 0; i < sldIds.length; i++) {
      const rId = sldIds[i].getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
        || sldIds[i].getAttribute('r:id');
      const target = relsById.get(rId);
      if (!target) continue;
      // Targets are relative to ppt/ — e.g. "slides/slide1.xml".
      paths.push(this.resolveZipPath('ppt/', target));
    }
    return paths;
  }

  // ZIP relationships use POSIX-style relative paths. Normalize without
  // letting `..` escape the package root.
  resolveZipPath(baseDir, target) {
    if (target.startsWith('/')) return target.replace(/^\/+/, '');
    const baseParts = baseDir.split('/').filter(Boolean);
    const targetParts = target.split('/');
    for (const p of targetParts) {
      if (p === '..') baseParts.pop();
      else if (p !== '.' && p !== '') baseParts.push(p);
    }
    return baseParts.join('/');
  }

  async pptxRenderSlide(zip, slidePath, slideNum, fileId, stats) {
    const slideFile = zip.file(slidePath);
    if (!slideFile) throw new Error(`missing ${slidePath}`);
    const slideXml = await slideFile.async('string');
    const slideDoc = new DOMParser({ errorHandler: () => {} }).parseFromString(slideXml, 'text/xml');

    const sldEl = slideDoc.getElementsByTagName('p:sld')[0];
    const hidden = sldEl?.getAttribute('show') === '0';

    // Resolve the slide's relationships up-front so we can map <p:pic>
    // r:embed → media path and discover the linked notesSlide.
    const slideDir = slidePath.substring(0, slidePath.lastIndexOf('/'));
    const relsPath = `${slideDir}/_rels/${slidePath.split('/').pop()}.rels`;
    const slideRels = await this.pptxLoadRels(zip, relsPath);

    const { title, bodyLines, imageRels } = await this.pptxParseShapes(
      zip, slideDoc, slideRels, fileId, stats
    );

    // Build the heading per the requirement: include slide number always,
    // prefix HIDDEN: when not shown, and append the title when one exists.
    const headingParts = [`Slide ${slideNum}`];
    const suffix = [];
    if (hidden) suffix.push('HIDDEN');
    if (title) suffix.push(title);
    const heading = suffix.length ? `## ${headingParts[0]}: ${suffix.join(': ')}` : `## ${headingParts[0]}`;

    const lines = [heading, ''];
    if (bodyLines.length) {
      lines.push(...bodyLines, '');
    }
    for (const filename of imageRels) {
      lines.push(`![](./_attachments/${filename})`, '');
    }

    const notesRel = slideRels.find((r) =>
      r.type === 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide'
    );
    if (notesRel) {
      const notesPath = this.resolveZipPath(`${slideDir}/`, notesRel.target);
      const notesLines = await this.pptxParseNotes(zip, notesPath, stats);
      if (notesLines.length) {
        lines.push('### Notes', '', ...notesLines, '');
      }
    }

    return lines.join('\n');
  }

  async pptxLoadRels(zip, relsPath) {
    const file = zip.file(relsPath);
    if (!file) return [];
    const xml = await file.async('string');
    const doc = new DOMParser({ errorHandler: () => {} }).parseFromString(xml, 'text/xml');
    const out = [];
    const els = doc.getElementsByTagName('Relationship');
    for (let i = 0; i < els.length; i++) {
      out.push({
        id: els[i].getAttribute('Id'),
        type: els[i].getAttribute('Type'),
        target: els[i].getAttribute('Target'),
      });
    }
    return out;
  }

  // Walk top-level shape containers (<p:spTree>) in slide order. We emit
  // body content in shape order so the document reads roughly top-to-bottom
  // even though PowerPoint's XYZ positioning is ignored.
  async pptxParseShapes(zip, slideDoc, slideRels, fileId, stats) {
    let title = '';
    const bodyLines = [];
    const imageRels = [];

    const spTree = slideDoc.getElementsByTagName('p:spTree')[0];
    if (!spTree) return { title, bodyLines, imageRels };

    for (let i = 0; i < spTree.childNodes.length; i++) {
      const node = spTree.childNodes[i];
      if (node.nodeType !== 1) continue; // ELEMENT_NODE
      const name = node.nodeName;

      if (name === 'p:sp') {
        const phType = this.pptxGetPlaceholderType(node);
        const isTitle = phType === 'title' || phType === 'ctrTitle';
        const isBodyPh = phType === 'body' || phType === 'subTitle' || phType === '';
        const txBody = node.getElementsByTagName('p:txBody')[0];
        if (!txBody) continue;

        if (isTitle && !title) {
          // Concatenate all runs into a single line; PPTX titles often
          // span multiple `<a:p>` for layout reasons.
          title = this.pptxExtractTitleText(txBody);
          continue;
        }

        const paragraphs = txBody.getElementsByTagName('a:p');
        for (let j = 0; j < paragraphs.length; j++) {
          const line = this.pptxRenderParagraph(paragraphs[j], { defaultBullet: isBodyPh });
          if (line !== null) bodyLines.push(line);
        }
      } else if (name === 'p:pic') {
        const filename = await this.pptxExtractPic(zip, node, slideRels, fileId, stats);
        if (filename) imageRels.push(filename);
      } else if (name === 'p:graphicFrame') {
        // Tables, charts, SmartArt. Skipped with a warning.
        stats.warnings.push('Skipped embedded graphic frame (table/chart/SmartArt)');
      }
      // p:grpSp (groups) and p:cxnSp (connectors) are ignored — nested
      // groups would need recursion, but content is rare and authors
      // who care can flatten before importing.
    }

    return { title, bodyLines, imageRels };
  }

  pptxGetPlaceholderType(spNode) {
    const phs = spNode.getElementsByTagName('p:ph');
    if (phs.length === 0) return null;
    return phs[0].getAttribute('type') || '';
  }

  pptxExtractTitleText(txBody) {
    const runs = txBody.getElementsByTagName('a:t');
    const parts = [];
    for (let i = 0; i < runs.length; i++) {
      parts.push(runs[i].textContent || '');
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  // Returns a single Markdown line (string) or null for empty paragraphs.
  // `defaultBullet`: when the containing shape is a body-text placeholder,
  // PPTX treats paragraphs as bulleted unless `<a:buNone/>` overrides.
  // Title and non-placeholder text frames default to plain paragraphs.
  pptxRenderParagraph(pNode, { defaultBullet }) {
    const runs = pNode.getElementsByTagName('a:t');
    const parts = [];
    for (let i = 0; i < runs.length; i++) {
      parts.push(runs[i].textContent || '');
    }
    const text = parts.join('').replace(/\s+/g, ' ').trim();
    if (!text) return null;

    const pPr = pNode.getElementsByTagName('a:pPr')[0];
    const lvl = pPr ? Math.min(parseInt(pPr.getAttribute('lvl') || '0', 10), 6) : 0;

    let bullet = defaultBullet;
    if (pPr) {
      if (pPr.getElementsByTagName('a:buNone').length > 0) bullet = false;
      else if (pPr.getElementsByTagName('a:buChar').length > 0 ||
               pPr.getElementsByTagName('a:buAutoNum').length > 0) {
        bullet = true;
      }
    }

    if (bullet) {
      return `${'  '.repeat(lvl)}- ${text}`;
    }
    return text;
  }

  async pptxExtractPic(zip, picNode, slideRels, fileId, stats) {
    const blips = picNode.getElementsByTagName('a:blip');
    if (blips.length === 0) return null;
    const rId = blips[0].getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed')
      || blips[0].getAttribute('r:embed');
    if (!rId) return null;
    const rel = slideRels.find((r) => r.id === rId);
    if (!rel) return null;

    // Relationship targets on slides are relative to ppt/slides/.
    const mediaPath = this.resolveZipPath('ppt/slides/', rel.target);
    const zipEntry = zip.file(mediaPath);
    if (!zipEntry) {
      stats.warnings.push(`Missing embedded image: ${mediaPath}`);
      return null;
    }
    const ext = path.extname(mediaPath).toLowerCase();
    const contentType = EXT_CONTENT_TYPE[ext] || '';
    const buffer = await zipEntry.async('nodebuffer');
    const altText = this.pptxGetPicAltText(picNode);
    return await this.attachImageBuffer(buffer, contentType, fileId, stats, altText);
  }

  pptxGetPicAltText(picNode) {
    const nvProps = picNode.getElementsByTagName('p:cNvPr')[0];
    if (!nvProps) return '';
    return nvProps.getAttribute('descr') || nvProps.getAttribute('title') || '';
  }

  async pptxParseNotes(zip, notesPath, stats) {
    const file = zip.file(notesPath);
    if (!file) return [];
    const xml = await file.async('string');
    const doc = new DOMParser({ errorHandler: () => {} }).parseFromString(xml, 'text/xml');
    const lines = [];
    // Body shapes inside notesSlide are <p:sp> with placeholder type "body".
    // The slide-thumbnail placeholder (`type="sldImg"`) has no useful text.
    const sps = doc.getElementsByTagName('p:sp');
    for (let i = 0; i < sps.length; i++) {
      const phType = this.pptxGetPlaceholderType(sps[i]);
      if (phType === 'sldImg') continue;
      const txBody = sps[i].getElementsByTagName('p:txBody')[0];
      if (!txBody) continue;
      const paragraphs = txBody.getElementsByTagName('a:p');
      for (let j = 0; j < paragraphs.length; j++) {
        const line = this.pptxRenderParagraph(paragraphs[j], { defaultBullet: false });
        if (line !== null) lines.push(line);
      }
    }
    return lines;
  }

  postProcessPptx(markdown) {
    let md = markdown || '';
    // Drop any empty-src image refs left over from skipped attachments.
    md = md.replace(/!\[[^\]]*\]\(\s*\)\n?/g, '');
    // Collapse 3+ blank lines.
    md = md.replace(/\n{3,}/g, '\n\n');
    // Trim trailing whitespace per line.
    md = md.split('\n').map((l) => l.replace(/[ \t]+$/, '')).join('\n');
    // Trim leading/trailing blank lines, leave a single trailing newline.
    md = md.replace(/^\n+/, '').replace(/\n+$/, '\n');
    return md;
  }

  // ─────────────────────────── shared ─────────────────────────────

  stripTables(doc, stats) {
    const walk = (node) => {
      if (!node || !node.children) return node;
      const kept = [];
      for (const child of node.children) {
        if (child.type === 'table') {
          stats.tablesStripped += 1;
          // Replace with a paragraph placeholder so context isn't lost.
          kept.push({
            type: 'paragraph',
            styleId: null,
            styleName: null,
            numbering: null,
            alignment: null,
            children: [{ type: 'text', value: '[Table omitted during import]' }],
          });
          continue;
        }
        kept.push(walk(child));
      }
      node.children = kept;
      return node;
    };
    return walk(doc);
  }

  // Mammoth image handler — adapts mammoth's image stream to the shared
  // buffer-attach path. Returns the `{ src, alt }` object mammoth expects.
  async handleMammothImage(image, fileId, stats) {
    const contentType = (image.contentType || '').toLowerCase();
    let buffer;
    try {
      buffer = await image.read();
    } catch (err) {
      stats.warnings.push(`Failed to read embedded image: ${err.message}`);
      return { src: '' };
    }
    const filename = await this.attachImageBuffer(buffer, contentType, fileId, stats, image.altText || '');
    if (!filename) return { src: '' };
    return { src: `./_attachments/${filename}`, alt: image.altText || '' };
  }

  // Shared attachment path used by both Word and PowerPoint imports.
  // Returns the saved filename (relative to `_attachments/`), or null on
  // skip. All decisions about what to skip live here so the importers
  // stay symmetric.
  async attachImageBuffer(buffer, contentType, fileId, stats, _altText) {
    stats.images += 1;
    const ct = (contentType || '').toLowerCase();

    if (ct === 'image/x-emf' || ct === 'image/x-wmf' ||
        ct === 'image/emf' || ct === 'image/wmf') {
      stats.warnings.push(`Unsupported image format skipped: ${ct}`);
      return null;
    }

    const ext = CONTENT_TYPE_EXT[ct] || '.bin';
    if (ext === '.bin') {
      stats.warnings.push(`Unknown image content type: ${ct || '(none)'}`);
    }

    if (!buffer || buffer.length === 0) {
      stats.warnings.push('Empty image skipped');
      return null;
    }
    if (buffer.length > MAX_ATTACHMENT_SIZE) {
      stats.warnings.push('Image exceeded 30MB limit, skipped');
      return null;
    }

    const originalName = `image-${Date.now().toString(36)}-${stats.images}${ext}`;
    try {
      const attachment = await this.projectService.addAttachment(fileId, buffer, originalName);
      return attachment.filename;
    } catch (err) {
      stats.warnings.push(`Failed to attach image: ${err.message}`);
      return null;
    }
  }

  postProcess(markdown, sourceName) {
    let md = markdown || '';

    // Mammoth may emit images whose src we set to '' (skipped). Remove those.
    md = md.replace(/!\[[^\]]*\]\(\s*\)\n?/g, '');

    // Collapse runs of 3+ blank lines to 2.
    md = md.replace(/\n{3,}/g, '\n\n');

    // Trim trailing whitespace on each line.
    md = md.split('\n').map(l => l.replace(/[ \t]+$/, '')).join('\n');

    // Ensure the doc starts with an H1 derived from the source filename if
    // mammoth didn't emit one.
    if (!/^#\s/m.test(md.split('\n').slice(0, 5).join('\n'))) {
      md = `# ${sourceName}\n\n${md.replace(/^\n+/, '')}`;
    }

    // Trim leading/trailing blank lines.
    md = md.replace(/^\n+/, '').replace(/\n+$/, '\n');

    return md;
  }
}

module.exports = { ImportService };
