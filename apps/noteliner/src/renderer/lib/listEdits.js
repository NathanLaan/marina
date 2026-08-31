// List-level edits on a note's markdown.
//
// Every function here is pure: (lines, …) → { lines, changed }, where the
// returned `lines` replace only the span the caller asked about — never the
// whole document. Editor.svelte maps the 1-based line numbers to CodeMirror
// offsets and dispatches a single change, so each action is one undo step and
// the caret/selection can be placed deliberately. Keeping the rewriting here
// means it can be unit-tested with no editor, no DOM, and no Electron:
// tests/integration/list-edits.test.mjs.
//
// Recognizers follow CommonMark: a list marker must be followed by whitespace,
// or end the line (an empty item). That is what keeps `---` and `-Alpha` from
// being read as list items. `*` and `+` are recognized on input and normalized
// to `-` on output; `N)` is normalized to `N.`.
//
// Indentation is compared and rebuilt by character count, so a tab counts as
// one column. Mixing tabs and spaces in one list will indent by a surprising
// amount — the same caveat the editor's own Tab handling carries.

const UNORDERED_RE = /^(\s*)([-*+])(\s+|$)(.*)$/;
const ORDERED_RE = /^(\s*)(\d+)([.)])(\s+|$)(.*)$/;

function isBlank(line) {
  return /^\s*$/.test(String(line ?? ''));
}

function indentOf(line) {
  return String(line ?? '').match(/^(\s*)/)[1];
}

function bodyOf(line) {
  return String(line ?? '').slice(indentOf(line).length);
}

// null when the line is not a list item. `contentCol` is the column its text
// starts at — what a child has to reach to nest under it. An empty item (`-`
// with nothing after it) reports the column it *would* have, so indenting
// under it still produces a valid sub-list.
function parseItem(line) {
  const s = String(line ?? '');

  const u = s.match(UNORDERED_RE);
  if (u) {
    const [, indent, marker, space, text] = u;
    return {
      kind: 'unordered',
      indent,
      text,
      contentCol: indent.length + marker.length + Math.max(space.length, 1),
    };
  }

  const o = s.match(ORDERED_RE);
  if (o) {
    const [, indent, digits, delim, space, text] = o;
    return {
      kind: 'ordered',
      indent,
      text,
      contentCol: indent.length + digits.length + delim.length + Math.max(space.length, 1),
    };
  }

  return null;
}

// No trailing space on an empty item — `- ` would be invisible churn in the
// file and shows up as a diff for nothing.
function joinItem(indent, marker, text) {
  return text ? `${indent}${marker} ${text}` : `${indent}${marker}`;
}

// The lines of [fromLine, toLine], clamped to the document.
function sliceSpan(lines, fromLine, toLine) {
  const arr = Array.isArray(lines) ? lines : [];
  if (arr.length === 0) return [];
  const from = Math.max(1, Math.min(fromLine, arr.length));
  const to = Math.max(from, Math.min(toLine, arr.length));
  return arr.slice(from - 1, to);
}

function result(before, after) {
  const changed = after.length !== before.length || after.some((l, i) => l !== before[i]);
  return { lines: after, changed };
}

// 'ordered' / 'unordered' when every non-blank line in the span is that kind of
// item, 'none' when none of them is a list item at all (including an all-blank
// span), 'mixed' otherwise. Drives both the toggle direction and the toolbar
// buttons' active state.
export function classifySpan(lines, fromLine, toLine) {
  let ordered = false;
  let unordered = false;
  let plain = false;

  for (const line of sliceSpan(lines, fromLine, toLine)) {
    if (isBlank(line)) continue;
    const item = parseItem(line);
    if (!item) plain = true;
    else if (item.kind === 'ordered') ordered = true;
    else unordered = true;
  }

  if (!ordered && !unordered) return 'none';
  if (ordered && !unordered && !plain) return 'ordered';
  if (unordered && !ordered && !plain) return 'unordered';
  return 'mixed';
}

// Strip every list marker in the span, keeping each line's own indentation.
function stripSpan(span) {
  return span.map((line) => {
    if (isBlank(line)) return line;
    const item = parseItem(line);
    return item ? item.indent + item.text : line;
  });
}

export function toUnorderedList(lines, fromLine, toLine) {
  const span = sliceSpan(lines, fromLine, toLine);
  if (classifySpan(lines, fromLine, toLine) === 'unordered') {
    return result(span, stripSpan(span));
  }

  const next = span.map((line) => {
    if (isBlank(line)) return line;
    const item = parseItem(line);
    return item
      ? joinItem(item.indent, '-', item.text)
      : joinItem(indentOf(line), '-', bodyOf(line));
  });

  return result(span, next);
}

export function toOrderedList(lines, fromLine, toLine) {
  const span = sliceSpan(lines, fromLine, toLine);
  if (classifySpan(lines, fromLine, toLine) === 'ordered') {
    return result(span, stripSpan(span));
  }

  // One counter per indent level, on a stack. Returning to a shallower level
  // discards the deeper counters, so a later nested block restarts at 1 rather
  // than continuing the previous one. Blank lines don't advance any counter —
  // a blank line makes a list loose, it doesn't end it.
  const counters = [];

  const next = span.map((line) => {
    if (isBlank(line)) return line;
    const item = parseItem(line);
    const indent = item ? item.indent : indentOf(line);
    const text = item ? item.text : bodyOf(line);
    const width = indent.length;

    while (counters.length && counters[counters.length - 1].width > width) counters.pop();

    const top = counters[counters.length - 1];
    let n;
    if (top && top.width === width) n = ++top.n;
    else {
      counters.push({ width, n: 1 });
      n = 1;
    }

    return joinItem(indent, `${n}.`, text);
  });

  return result(span, next);
}

// Scanning upward, the nearest list item at the same indent that is still part
// of this list. null when the line is the first item at its level — a sub-list
// with no parent item above it is not what "indent" means, and renders as a
// stray nested list.
function precedingSibling(lines, idx, width) {
  for (let i = idx - 1; i >= 0; i--) {
    const line = lines[i];
    if (isBlank(line)) continue;              // a blank line doesn't end a list
    const item = parseItem(line);
    if (!item) return null;                   // plain text — the list ended here
    if (item.indent.length === width) return item;
    if (item.indent.length < width) return null;  // reached our parent first
    // Deeper: a descendant of an earlier sibling. Keep looking.
  }
  return null;
}

export function indentAsSubList(lines, line) {
  const arr = Array.isArray(lines) ? lines : [];
  const idx = line - 1;
  if (idx < 0 || idx >= arr.length) return { lines: [], changed: false };

  const current = arr[idx];
  if (isBlank(current)) return { lines: [current], changed: false };

  const item = parseItem(current);
  if (!item) {
    // Not in a list at all — start one at the line's own indentation.
    return result([current], [joinItem(indentOf(current), '-', bodyOf(current))]);
  }

  const parent = precedingSibling(arr, idx, item.indent.length);
  if (!parent) return { lines: [current], changed: false };

  // Indent to the parent's content column, not a fixed two spaces: `1. Alpha`
  // puts its text at column 3, and a two-space child of it is a lazy paragraph
  // continuation rather than a sub-list.
  const marker = item.kind === 'ordered' ? '1.' : '-';
  return result([current], [joinItem(' '.repeat(parent.contentCol), marker, item.text)]);
}
