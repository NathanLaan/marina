const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = '_templates';

// Manages reusable note templates stored as plain markdown under
// {project}/_templates/. Templates are NOT indexed notes — they never appear
// in noteliner.json, search, or the link graph — but they DO get committed to
// git like everything else, so they version and sync with the project.
//
// On create, a template's body runs through substitute(): a small set of
// {{...}} placeholders are replaced with the new note's title and the current
// date/time. Unknown placeholders are left untouched.
class TemplateService {
  constructor(projectService) {
    this.projectService = projectService;
  }

  get projectPath() {
    return this.projectService.projectPath;
  }

  dir() {
    return path.join(this.projectPath, TEMPLATES_DIR);
  }

  // Turn a slugged filename into a readable display name:
  // "meeting-notes.md" -> "Meeting Notes".
  prettify(filename) {
    const base = filename.replace(/\.md$/i, '');
    return base
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // [{ id, name, kind }] for every *.md in _templates/, sorted by display name.
  // id is the on-disk filename — the stable handle the renderer passes back.
  //
  // `kind` comes from the template's own frontmatter (`kind: deck | slide`) and
  // defaults to 'note', so every pre-existing template keeps its behaviour. The
  // New File dialog uses it to show only templates matching the chosen type;
  // createFile strips the field so it never lands in the created note.
  list() {
    if (!this.projectPath) return [];
    const dir = this.dir();
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith('.md'))
      .map((f) => ({ id: f, name: this.prettify(f), kind: this.kindOf(dir, f) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // Frontmatter read is cheap here — templates are a handful of small files.
  kindOf(dir, filename) {
    try {
      const raw = fs.readFileSync(path.join(dir, filename), 'utf-8');
      const kind = this.projectService.frontmatter.parse(raw).data?.kind;
      return kind === 'deck' || kind === 'slide' ? kind : 'note';
    } catch {
      return 'note';
    }
  }

  // Replace the supported placeholders. Kept deliberately small and
  // documented in helpContent.js so the two stay in sync.
  substitute(text, { title } = {}) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const date = `${yyyy}-${mm}-${dd}`;
    const time = `${hh}:${min}`;
    const vars = {
      title: title || '',
      date,
      time,
      datetime: `${date} ${time}`,
    };
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) =>
      Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match
    );
  }

  // Read a template by id and return its placeholder-substituted body, or
  // null if it doesn't exist. Strips a single trailing newline-free guarantee:
  // callers treat the result as a ready-to-write note body.
  bodyFor(id, vars = {}) {
    if (!this.projectPath || !id) return null;
    // Guard against path traversal — id must be a bare filename in _templates/.
    const safe = path.basename(id);
    const filePath = path.join(this.dir(), safe);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return this.substitute(raw, vars);
  }

  // Write `body` as a template named `name` (slugged to a filename) and commit
  // it. Returns the saved { id, name }. Overwrites an existing same-named
  // template so "save again" updates in place rather than piling up dupes.
  async save(name, body) {
    if (!this.projectPath) throw new Error('No project open');
    const trimmed = (name || '').trim();
    if (!trimmed) throw new Error('Template name cannot be empty');
    const dir = this.dir();
    fs.mkdirSync(dir, { recursive: true });
    const slug = this.projectService.slugify(trimmed);
    const filename = `${slug || 'template'}.md`;
    fs.writeFileSync(path.join(dir, filename), body ?? '', 'utf-8');

    await this.projectService.gitService.commit(this.projectPath, `Save template ${trimmed}`);
    this.projectService.gitService.schedulePush(this.projectPath);

    return { id: filename, name: this.prettify(filename) };
  }
}

module.exports = { TemplateService };
