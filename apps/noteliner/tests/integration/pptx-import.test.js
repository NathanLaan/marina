// PPTX import integration test.
//
// Builds a synthetic .pptx package in memory (no PowerPoint required), then
// drives the real ImportService against it with a stubbed projectService.
// Stubs are scoped to the methods the importer actually calls — keeps the
// test independent of git and on-disk state so it runs anywhere Node does.
//
// Run: node tests/integration/pptx-import.test.js

const path = require('path');
const JSZip = require('jszip');

const { ImportService } = require('../../src/main/import-service');

const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PRES_NS = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const DRAW_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';

let passed = 0, failed = 0;
const failures = [];

function assert(name, ok, detail) {
  if (ok) { console.log(`  PASS  ${name}`); passed++; }
  else {
    console.log(`  FAIL  ${name}${detail ? '\n        ' + detail : ''}`);
    failed++; failures.push(name);
  }
}

function assertEq(name, actual, expected) {
  const ok = actual === expected;
  if (ok) assert(name, true);
  else assert(name, false, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function assertContains(name, haystack, needle) {
  assert(name, haystack.includes(needle), `missing substring: ${JSON.stringify(needle)}`);
}

// Pre-baked 1x1 transparent PNG so the importer has something real to
// extract; size is not the point of the assertion, presence is.
const PNG_1X1 = Buffer.from(
  '89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C489' +
  '0000000D49444154789C63F86F0000050100013E5FB7AD0000000049454E44AE426082',
  'hex'
);

function presentationXml(rIds) {
  const sldIds = rIds.map((rid, i) => `<p:sldId id="${256 + i}" r:id="${rid}"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="${PRES_NS}" xmlns:r="${REL_NS}" xmlns:a="${DRAW_NS}">
  <p:sldIdLst>${sldIds}</p:sldIdLst>
</p:presentation>`;
}

function presentationRels(targets) {
  const rels = targets.map((target, i) =>
    `<Relationship Id="rId${i + 1}" Type="${REL_NS}/slide" Target="${target}"/>`
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
}

function slideXml({ title, paragraphs = [], pics = [], hidden = false }) {
  const titleSp = title ? `
    <p:sp>
      <p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr><a:spLocks/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
      <p:spPr/>
      <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${title}</a:t></a:r></a:p></p:txBody>
    </p:sp>` : '';

  const bodyParas = paragraphs.map((p) => {
    const pPr = p.bullet === false ? '<a:pPr><a:buNone/></a:pPr>'
              : p.bullet === true ? `<a:pPr lvl="${p.lvl || 0}"><a:buChar char="•"/></a:pPr>`
              : (p.lvl != null ? `<a:pPr lvl="${p.lvl}"/>` : '');
    return `<a:p>${pPr}<a:r><a:t>${p.text}</a:t></a:r></a:p>`;
  }).join('');
  const bodySp = paragraphs.length ? `
    <p:sp>
      <p:nvSpPr><p:cNvPr id="3" name="Content Placeholder 2"/><p:cNvSpPr><a:spLocks/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>
      <p:spPr/>
      <p:txBody><a:bodyPr/><a:lstStyle/>${bodyParas}</p:txBody>
    </p:sp>` : '';

  const picXml = pics.map((p, i) => `
    <p:pic>
      <p:nvPicPr><p:cNvPr id="${10 + i}" name="Picture ${i + 1}" descr="${p.alt || ''}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
      <p:blipFill><a:blip r:embed="${p.rid}"/></p:blipFill>
      <p:spPr/>
    </p:pic>`).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="${PRES_NS}" xmlns:r="${REL_NS}" xmlns:a="${DRAW_NS}"${hidden ? ' show="0"' : ''}>
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr/>
    ${titleSp}${bodySp}${picXml}
  </p:spTree></p:cSld>
</p:sld>`;
}

function slideRels({ picRels = [], notesTarget = null }) {
  const items = [];
  for (const p of picRels) {
    items.push(`<Relationship Id="${p.rid}" Type="${REL_NS}/image" Target="../media/${p.filename}"/>`);
  }
  if (notesTarget) {
    items.push(`<Relationship Id="rIdNotes" Type="${REL_NS}/notesSlide" Target="${notesTarget}"/>`);
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.join('')}</Relationships>`;
}

function notesSlideXml(paragraphs) {
  const paras = paragraphs.map((t) =>
    `<a:p><a:r><a:t>${t}</a:t></a:r></a:p>`
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:p="${PRES_NS}" xmlns:r="${REL_NS}" xmlns:a="${DRAW_NS}">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr/>
    <p:sp>
      <p:nvSpPr><p:cNvPr id="3" name="Notes"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>
      <p:spPr/>
      <p:txBody><a:bodyPr/><a:lstStyle/>${paras}</p:txBody>
    </p:sp>
  </p:spTree></p:cSld>
</p:notes>`;
}

async function buildSamplePptx() {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
</Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`);
  zip.file('ppt/presentation.xml', presentationXml(['rId1', 'rId2', 'rId3', 'rId4']));
  zip.file('ppt/_rels/presentation.xml.rels', presentationRels([
    'slides/slide1.xml',
    'slides/slide2.xml',
    'slides/slide3.xml',
    'slides/slide4.xml',
  ]));

  // 1: title + bullets
  zip.file('ppt/slides/slide1.xml', slideXml({
    title: 'Agenda',
    paragraphs: [
      { text: 'Sales recap', lvl: 0 },
      { text: 'Product launch', lvl: 0 },
      { text: 'Q&amp;A', lvl: 0 },
    ],
  }));
  zip.file('ppt/slides/_rels/slide1.xml.rels', slideRels({}));

  // 2: no title, plain paragraph, image, speaker notes
  zip.file('ppt/slides/slide2.xml', slideXml({
    paragraphs: [{ text: 'Revenue grew 12% QoQ.', bullet: false }],
    pics: [{ rid: 'rId10', alt: 'Revenue chart' }],
  }));
  zip.file('ppt/slides/_rels/slide2.xml.rels', slideRels({
    picRels: [{ rid: 'rId10', filename: 'image1.png' }],
    notesTarget: '../notesSlides/notesSlide2.xml',
  }));
  zip.file('ppt/notesSlides/notesSlide2.xml', notesSlideXml(['Hand off to Priya.']));
  zip.file('ppt/media/image1.png', PNG_1X1);

  // 3: hidden, with title
  zip.file('ppt/slides/slide3.xml', slideXml({
    title: 'Internal metrics',
    paragraphs: [
      { text: 'Churn 4.1%', lvl: 0 },
      { text: 'LTV up 8%', lvl: 0 },
    ],
    hidden: true,
  }));
  zip.file('ppt/slides/_rels/slide3.xml.rels', slideRels({}));

  // 4: nested bullets
  zip.file('ppt/slides/slide4.xml', slideXml({
    title: 'Next steps',
    paragraphs: [
      { text: 'Ship beta', lvl: 0 },
      { text: 'Dogfood', lvl: 1 },
      { text: 'TestFlight', lvl: 1 },
      { text: 'Hire engineers', lvl: 0 },
    ],
  }));
  zip.file('ppt/slides/_rels/slide4.xml.rels', slideRels({}));

  return await zip.generateAsync({ type: 'nodebuffer' });
}

function stubProjectService() {
  const captured = { attachments: [], writes: [] };
  const svc = {
    projectPath: '/tmp/fake-project',
    async createFile(name) {
      return { id: 'file-abc123', filename: `${name}.md`, name };
    },
    async addAttachment(fileId, buffer, originalName) {
      captured.attachments.push({ fileId, originalName, size: buffer.length });
      const ext = path.extname(originalName);
      const filename = `att-${captured.attachments.length}${ext}`;
      return { filename };
    },
    async writeFile(filename, content) {
      captured.writes.push({ filename, content });
    },
  };
  return { svc, captured };
}

async function main() {
  const fs = require('fs');
  const tmpPath = path.join(require('os').tmpdir(), `pptx-import-test-${process.pid}.pptx`);
  fs.writeFileSync(tmpPath, await buildSamplePptx());

  try {
    console.log('=== happy path ===');
    const { svc, captured } = stubProjectService();
    const importer = new ImportService(svc);
    const result = await importer.import(tmpPath);
    const md = captured.writes[0]?.content || '';

    assertEq('slide count in stats', result.stats.slides, 4);
    assertEq('image count in stats', result.stats.images, 1);
    assertEq('no warnings', result.stats.warnings.length, 0);
    assertEq('attached files', captured.attachments.length, 1);

    assertContains('h1 with "(Imported YYYY-MM-DD)"', md, '(Imported ');
    assert('h1 has date in ISO form', /^# .+\(Imported \d{4}-\d{2}-\d{2}\)$/m.test(md));

    assertContains('slide 1 heading with title', md, '## Slide 1: Agenda');
    assertContains('slide 1 bullet "Sales recap"', md, '- Sales recap');
    assertContains('slide 1 amp decoded', md, '- Q&A');

    assertContains('slide 2 heading (no title)', md, '\n## Slide 2\n');
    assertContains('slide 2 plain paragraph', md, 'Revenue grew 12% QoQ.');
    assertContains('slide 2 attachment ref', md, '![](./_attachments/att-1.png)');

    assertContains('slide 2 notes header', md, '### Notes');
    assertContains('slide 2 notes body', md, 'Hand off to Priya.');

    assertContains('slide 3 hidden + title', md, '## Slide 3: HIDDEN: Internal metrics');

    assertContains('slide 4 nested bullet (lvl 0)', md, '- Ship beta');
    assertContains('slide 4 nested bullet (lvl 1)', md, '  - Dogfood');
    assertContains('slide 4 nested bullet (lvl 1) #2', md, '  - TestFlight');

    console.log('\n=== legacy .ppt rejection ===');
    try {
      await importer.import('/tmp/foo.ppt');
      assert('rejects .ppt', false, 'did not throw');
    } catch (err) {
      assert('rejects .ppt', /Legacy \.ppt files are not supported/.test(err.message),
        `wrong message: ${err.message}`);
    }

    console.log('\n=== unsupported extension ===');
    try {
      await importer.import('/tmp/foo.odt');
      assert('rejects .odt', false, 'did not throw');
    } catch (err) {
      assert('rejects .odt', /Unsupported file type/.test(err.message),
        `wrong message: ${err.message}`);
    }
  } finally {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('Failures:'); failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
