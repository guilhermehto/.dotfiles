// Markdown -> HTML for live-html. Pure and dependency-free so the same file
// runs in the browser and under `node --test`. Covers the GFM subset docs
// actually use. Every top-level block carries data-ls/data-le (1-based source
// lines) so a comment can point the agent at exact lines of the file.
(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.LiveHtmlMarkdown = api;
  }
})(globalThis, function () {
  'use strict';

  const FENCE_OPEN = /^( {0,3})(`{3,}|~{3,})(.*)$/;
  const ATX_HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
  const SETEXT_UNDERLINE = /^ {0,3}(?:=+|-+)[ \t]*$/;
  const THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
  const BLOCKQUOTE_PREFIX = /^ {0,3}> ?/;
  const LIST_ITEM = /^( *)([-*+]|\d{1,9}[.)])(?:([ \t]+)(.*))?$/;
  const INTERRUPTING_LIST_ITEM = /^ {0,3}(?:[-*+]|1[.)])[ \t]+\S/;
  const TASK_MARKER = /^\[([ xX])\](?:[ \t]+|$)/;
  const TABLE_DELIMITER_CELL = /^:?-+:?$/;
  const HTML_BLOCK_START = /^ {0,3}<\/?(?:address|article|aside|blockquote|center|details|dialog|div|dl|figcaption|figure|footer|form|h[1-6]|header|hr|main|nav|ol|p|picture|pre|section|summary|table|tbody|td|tfoot|th|thead|tr|ul)(?=[\s/>]|$)/i;
  const HTML_COMMENT_START = /^ {0,3}<!--/;
  const REFERENCE_DEFINITION = /^ {0,3}\[([^\]]+)\]:[ \t]*<?([^\s>]+)>?(?:[ \t]+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\)))?[ \t]*$/;
  const ALERT_MARKER = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*$/i;

  const CODE_SPAN = /(?<!`)(`+)(?!`)([\s\S]*?[^`])\1(?!`)/g;
  const HARD_BREAK = /(?: {2,}|\\)\n/g;
  const BACKSLASH_ESCAPE = /\\([!-/:-@[-`{-~])/g;
  const AUTOLINK = /<((?:https?|mailto|ftp):[^\s<>]*)>/gi;
  const INLINE_HTML = /<!--[\s\S]*?-->|<\/?[a-zA-Z][\w-]*(?:\s+[a-zA-Z_:][\w.:-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>/g;
  const LINK_DESTINATION = String.raw`\(\s*<?((?:[^\s()<>]|\([^\s()]*\))*)>?(?:\s+(?:"([^"]*)"|'([^']*)'))?\s*\)`;
  const IMAGE = new RegExp(String.raw`!\[([^\]]*)\]` + LINK_DESTINATION, 'g');
  const LINK = new RegExp(String.raw`\[((?:[^\[\]]|\[[^\[\]]*\])*)\]` + LINK_DESTINATION, 'g');
  const REFERENCE_LINK = /\[((?:[^[\]]|\[[^[\]]*\])+)\](?:\[([^[\]]*)\])?/g;
  const BARE_URL = /\bhttps?:\/\/[^\s<>"'\u0000]*[^\s<>"'\u0000.,:;!?)\]}*_~]/g;
  const STASH_TOKEN = /\u0000(\d+)\u0000/g;
  const URL_SCHEME = /^[a-z][a-z\d+.-]*:/i;

  const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  const BLOCK_PARSERS = [
    parseFence,
    parseHtmlComment,
    parseAtxHeading,
    parseThematicBreak,
    parseReferenceDefinition,
    parseTable,
    parseBlockquote,
    parseList,
    parseHtmlBlock,
  ];

  function render(markdown) {
    const lines = normalize(markdown).split('\n').map(expandLeadingTabs);
    const context = { references: collectReferences(lines), headingIds: new Map() };

    return parseBlocks(lines, context, { frontMatter: true })
      .filter((block) => block.html)
      .map((block) => withSourceLines(block.html, block.start + 1, block.end + 1))
      .join('\n');
  }

  function normalize(markdown) {
    return String(markdown).replace(/\r\n?/g, '\n').replace(/\u0000/g, '\uFFFD');
  }

  function expandLeadingTabs(line) {
    return line.replace(/^[ \t]+/, (indent) => indent.replace(/\t/g, '    '));
  }

  function withSourceLines(html, firstLine, lastLine) {
    return html.replace(/^<([a-zA-Z][\w-]*)/, `<$1 data-ls="${firstLine}" data-le="${lastLine}"`);
  }

  // ---- blocks ----

  function parseBlocks(lines, context, options = {}) {
    const blocks = [];
    let index = 0;

    if (options.frontMatter) {
      const frontMatter = parseFrontMatter(lines);

      if (frontMatter) {
        blocks.push(frontMatter);
        index = frontMatter.end + 1;
      }
    }

    while (index < lines.length) {
      if (isBlank(lines[index])) {
        index += 1;
        continue;
      }

      const block = parseBlock(lines, index, context);
      blocks.push(block);
      index = block.end + 1;
    }

    return blocks;
  }

  function parseBlock(lines, start, context) {
    for (const parse of BLOCK_PARSERS) {
      const block = parse(lines, start, context);

      if (block) {
        return block;
      }
    }

    return parseParagraph(lines, start, context);
  }

  function parseFrontMatter(lines) {
    if (lines[0].trimEnd() !== '---') {
      return null;
    }

    const end = lines.findIndex((line, index) => index > 0 && /^(?:---|\.\.\.)[ \t]*$/.test(line));

    if (end === -1) {
      return null;
    }

    const yaml = escapeHtml(lines.slice(1, end).join('\n'));
    return { type: 'frontmatter', start: 0, end, html: `<pre class="frontmatter"><code>${yaml}</code></pre>` };
  }

  function parseFence(lines, start) {
    const open = lines[start].match(FENCE_OPEN);

    if (!open || (open[2][0] === '`' && open[3].includes('`'))) {
      return null;
    }

    const [, indent, fence, info] = open;
    const closing = fenceCloser(fence);
    let end = start + 1;

    while (end < lines.length && !closing.test(lines[end])) {
      end += 1;
    }

    const code = lines
      .slice(start + 1, end)
      .map((line) => stripIndent(line, indent.length))
      .join('\n');
    const language = info.trim().split(/\s+/)[0];
    const languageClass = language ? ` class="language-${escapeHtml(language)}"` : '';

    return {
      type: 'code',
      start,
      end: Math.min(end, lines.length - 1),
      html: `<pre><code${languageClass}>${escapeHtml(code)}</code></pre>`,
    };
  }

  function fenceCloser(fence) {
    return new RegExp(`^ {0,3}${fence[0]}{${fence.length},}[ \\t]*$`);
  }

  function parseHtmlComment(lines, start) {
    if (!HTML_COMMENT_START.test(lines[start])) {
      return null;
    }

    let end = start;

    while (end < lines.length - 1 && !lines[end].includes('-->')) {
      end += 1;
    }

    return { type: 'comment', start, end, html: '' };
  }

  function parseAtxHeading(lines, start, context) {
    const match = lines[start].match(ATX_HEADING);

    if (!match) {
      return null;
    }

    return heading(match[1].length, match[2] || '', start, start, context);
  }

  function heading(level, text, start, end, context) {
    const inner = renderInline(text.trim(), context);
    const id = uniqueId(slugify(inner), context.headingIds);

    return { type: 'heading', start, end, html: `<h${level} id="${id}">${inner}</h${level}>` };
  }

  function slugify(html) {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&(?:amp|lt|gt|quot|#39);/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/\s/g, '-');
  }

  function uniqueId(slug, seen) {
    const base = slug || 'section';
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);

    return count ? `${base}-${count}` : base;
  }

  function parseThematicBreak(lines, start) {
    if (!THEMATIC_BREAK.test(lines[start])) {
      return null;
    }

    return { type: 'hr', start, end: start, html: '<hr>' };
  }

  function parseReferenceDefinition(lines, start) {
    if (!REFERENCE_DEFINITION.test(lines[start])) {
      return null;
    }

    return { type: 'definition', start, end: start, html: '' };
  }

  function parseTable(lines, start, context) {
    if (!isTableStart(lines[start], lines[start + 1])) {
      return null;
    }

    const headerCells = splitTableRow(lines[start]);
    const alignments = splitTableRow(lines[start + 1]).map(alignmentOf);
    const rows = [];
    let end = start + 1;

    while (end + 1 < lines.length && !isBlank(lines[end + 1]) && lines[end + 1].includes('|')) {
      rows.push(splitTableRow(lines[end + 1]));
      end += 1;
    }

    const cell = (tag, text, column) => {
      const alignClass = alignments[column] ? ` class="align-${alignments[column]}"` : '';
      return `<${tag}${alignClass}>${renderInline(text, context)}</${tag}>`;
    };
    const head = `<tr>${headerCells.map((text, column) => cell('th', text, column)).join('')}</tr>`;
    const body = rows
      .map((row) => `<tr>${alignments.map((_, column) => cell('td', row[column] || '', column)).join('')}</tr>`)
      .join('');
    const tbody = body ? `<tbody>${body}</tbody>` : '';

    return { type: 'table', start, end, html: `<div class="table"><table><thead>${head}</thead>${tbody}</table></div>` };
  }

  function isTableStart(header, delimiter) {
    if (delimiter === undefined || !header.includes('|') || !delimiter.includes('|')) {
      return false;
    }

    const delimiterCells = splitTableRow(delimiter);
    const isDelimiterRow = delimiterCells.every((cell) => TABLE_DELIMITER_CELL.test(cell));

    return isDelimiterRow && delimiterCells.length === splitTableRow(header).length;
  }

  function splitTableRow(line) {
    let row = line.trim();

    if (row.startsWith('|')) {
      row = row.slice(1);
    }

    if (row.endsWith('|') && !row.endsWith('\\|')) {
      row = row.slice(0, -1);
    }

    const cells = [];
    let cell = '';
    let inCode = false;

    for (let index = 0; index < row.length; index += 1) {
      const char = row[index];

      if (char === '\\' && row[index + 1] === '|') {
        cell += '|';
        index += 1;
      } else if (char === '|' && !inCode) {
        cells.push(cell.trim());
        cell = '';
      } else {
        inCode = char === '`' ? !inCode : inCode;
        cell += char;
      }
    }

    cells.push(cell.trim());
    return cells;
  }

  function alignmentOf(delimiterCell) {
    const left = delimiterCell.startsWith(':');
    const right = delimiterCell.endsWith(':');

    if (left && right) {
      return 'center';
    }

    if (right) {
      return 'right';
    }

    return left ? 'left' : '';
  }

  function parseBlockquote(lines, start, context) {
    if (!BLOCKQUOTE_PREFIX.test(lines[start])) {
      return null;
    }

    const inner = [];
    let end = start;

    while (end < lines.length) {
      const line = lines[end];

      if (BLOCKQUOTE_PREFIX.test(line)) {
        inner.push(line.replace(BLOCKQUOTE_PREFIX, ''));
      } else if (isLazyContinuation(line, lines[end + 1], inner)) {
        inner.push(line);
      } else {
        break;
      }

      end += 1;
    }

    const alert = inner[0].trim().match(ALERT_MARKER);
    const body = parseBlocks(alert ? inner.slice(1) : inner, context)
      .map((block) => block.html)
      .join('\n');

    if (!alert) {
      return { type: 'blockquote', start, end: end - 1, html: `<blockquote>${body}</blockquote>` };
    }

    const kind = alert[1].toLowerCase();
    const title = kind[0].toUpperCase() + kind.slice(1);
    const html = `<blockquote class="alert alert-${kind}"><p class="alert-title">${title}</p>${body}</blockquote>`;

    return { type: 'alert', start, end: end - 1, html };
  }

  function parseList(lines, start, context) {
    const first = matchListItem(lines[start]);

    if (!first) {
      return null;
    }

    const items = [];
    let index = start;
    let loose = false;

    while (index !== -1) {
      const item = collectListItem(lines, index, matchListItem(lines[index]));
      const next = skipBlankLines(lines, item.end + 1);
      const sibling = matchListItem(lines[next]);
      const continues = sibling !== null && sibling.kind === first.kind;

      items.push(item);
      loose = loose || item.loose || (continues && next > item.end + 1);
      index = continues ? next : -1;
    }

    const tag = first.ordered ? 'ol' : 'ul';
    const startAttribute = first.ordered && first.number !== 1 ? ` start="${first.number}"` : '';
    const body = items.map((item) => renderListItem(item, loose, context)).join('');

    return { type: 'list', start, end: items[items.length - 1].end, html: `<${tag}${startAttribute}>${body}</${tag}>` };
  }

  function matchListItem(line) {
    const match = line === undefined ? null : line.match(LIST_ITEM);

    if (!match || THEMATIC_BREAK.test(line)) {
      return null;
    }

    const [, indentText, marker, spacing = '', content = ''] = match;
    const indent = indentText.length;
    const ordered = /^\d/.test(marker);
    const gap = content ? Math.min(Math.max(spacing.length, 1), 4) : 1;
    const contentIndent = indent + marker.length + gap;

    return {
      indent,
      ordered,
      number: ordered ? parseInt(marker, 10) : null,
      kind: ordered ? marker.slice(-1) : marker,
      content,
      contentIndent,
      // Lenient on purpose: two spaces nest under "1." even though CommonMark
      // wants three, because hand-written docs do it all the time.
      childIndent: Math.min(contentIndent, indent + 2),
    };
  }

  function collectListItem(lines, start, marker) {
    const body = [marker.content];
    let end = start;
    let index = start + 1;
    let loose = false;
    // Every child line loses the same indent as the first one, so relative
    // nesting below it survives even when it is shallower than contentIndent.
    let dedent = null;

    while (index < lines.length) {
      const line = lines[index];

      if (isBlank(line)) {
        const next = skipBlankLines(lines, index);

        if (next >= lines.length || indentOf(lines[next]) < marker.childIndent) {
          break;
        }

        body.push(...lines.slice(index, next).map(() => ''));
        loose = true;
        index = next;
        continue;
      }

      if (indentOf(line) >= marker.childIndent) {
        dedent = dedent ?? Math.min(indentOf(line), marker.contentIndent);
        body.push(stripIndent(line, dedent));
      } else if (isLazyContinuation(line, lines[index + 1], body)) {
        body.push(line.trimStart());
      } else {
        break;
      }

      end = index;
      index += 1;
    }

    return { start, end, body, loose };
  }

  function renderListItem(item, loose, context) {
    const task = item.body[0].match(TASK_MARKER);
    const body = task ? [item.body[0].slice(task[0].length), ...item.body.slice(1)] : item.body;
    const inner = parseBlocks(body, context)
      .map((block) => (!loose && block.type === 'paragraph' ? block.inline : block.html))
      .join('');

    if (!task) {
      return `<li>${inner}</li>`;
    }

    const checked = task[1] === ' ' ? '' : ' checked';
    return `<li class="task"><input type="checkbox" disabled${checked}> ${inner}</li>`;
  }

  function parseHtmlBlock(lines, start) {
    if (!HTML_BLOCK_START.test(lines[start])) {
      return null;
    }

    let end = start;

    while (end + 1 < lines.length && !isBlank(lines[end + 1])) {
      end += 1;
    }

    return { type: 'html', start, end, html: lines.slice(start, end + 1).join('\n').trimStart() };
  }

  function parseParagraph(lines, start, context) {
    let end = start;

    while (end + 1 < lines.length) {
      const next = lines[end + 1];

      if (SETEXT_UNDERLINE.test(next)) {
        const level = next.trim()[0] === '=' ? 1 : 2;
        const text = lines
          .slice(start, end + 1)
          .map((line) => line.trim())
          .join(' ');

        return heading(level, text, start, end + 1, context);
      }

      if (startsBlock(next, lines[end + 2])) {
        break;
      }

      end += 1;
    }

    const text = lines
      .slice(start, end + 1)
      .map((line) => line.trimStart())
      .join('\n')
      .trimEnd();
    const inline = renderInline(text, context);

    return { type: 'paragraph', start, end, inline, html: `<p>${inline}</p>` };
  }

  function startsBlock(line, nextLine) {
    return (
      isBlank(line) ||
      FENCE_OPEN.test(line) ||
      ATX_HEADING.test(line) ||
      THEMATIC_BREAK.test(line) ||
      BLOCKQUOTE_PREFIX.test(line) ||
      HTML_BLOCK_START.test(line) ||
      HTML_COMMENT_START.test(line) ||
      INTERRUPTING_LIST_ITEM.test(line) ||
      isTableStart(line, nextLine)
    );
  }

  function isLazyContinuation(line, nextLine, body) {
    const previous = body[body.length - 1];

    return (
      !isBlank(line) &&
      previous !== undefined &&
      !isBlank(previous) &&
      !startsBlock(line, nextLine) &&
      !matchListItem(line)
    );
  }

  function collectReferences(lines) {
    const references = new Map();
    let openFence = null;

    for (const line of lines) {
      if (openFence) {
        openFence = openFence.test(line) ? null : openFence;
        continue;
      }

      const fence = line.match(FENCE_OPEN);

      if (fence) {
        openFence = fenceCloser(fence[2]);
        continue;
      }

      const definition = line.match(REFERENCE_DEFINITION);
      const label = definition && normalizeLabel(definition[1]);

      if (definition && !references.has(label)) {
        references.set(label, { href: definition[2], title: definition[3] ?? definition[4] ?? definition[5] });
      }
    }

    return references;
  }

  function normalizeLabel(label) {
    return label.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  function isBlank(line) {
    return /^\s*$/.test(line);
  }

  function indentOf(line) {
    return line.match(/^ */)[0].length;
  }

  function stripIndent(line, count) {
    return line.slice(Math.min(indentOf(line), count));
  }

  function skipBlankLines(lines, index) {
    let next = index;

    while (next < lines.length && isBlank(lines[next])) {
      next += 1;
    }

    return next;
  }

  // ---- inline ----

  // Constructs whose content must not be touched by later passes (code,
  // escapes, links, raw HTML) are swapped for NUL-delimited tokens first and
  // restored at the end. Input NULs are replaced in normalize(), so tokens
  // can't collide with document text.
  function renderInline(text, context) {
    const stash = [];
    const keep = (html) => `\u0000${stash.push(html) - 1}\u0000`;

    const tokenized = text
      .replace(CODE_SPAN, (_, ticks, code) => keep(`<code>${escapeHtml(trimCodeSpan(code))}</code>`))
      .replace(HARD_BREAK, () => keep('<br>'))
      .replace(BACKSLASH_ESCAPE, (_, char) => keep(escapeHtml(char)))
      .replace(AUTOLINK, (_, url) => keep(anchor(url, escapeHtml(url))))
      .replace(INLINE_HTML, (tag) => keep(tag))
      .replace(IMAGE, (_, alt, src, doubleQuoted, singleQuoted) => keep(image(alt, src, doubleQuoted ?? singleQuoted)))
      .replace(LINK, (_, label, href, doubleQuoted, singleQuoted) => {
        return keep(anchor(href, renderText(label), doubleQuoted ?? singleQuoted));
      })
      .replace(REFERENCE_LINK, (match, label, reference) => {
        const definition = context.references.get(normalizeLabel(reference || label));
        return definition ? keep(anchor(definition.href, renderText(label), definition.title)) : match;
      })
      .replace(BARE_URL, (url) => keep(anchor(url, escapeHtml(url))));

    return restore(renderText(tokenized), stash);
  }

  function renderText(text) {
    return applyEmphasis(escapeText(text));
  }

  // `_` only counts at word boundaries so snake_case identifiers survive.
  function applyEmphasis(html) {
    return html
      .replace(/\*\*([^\s*](?:[\s\S]*?[^\s*])?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^\p{L}\p{N}_])__([^\s_](?:[\s\S]*?[^\s_])?)__(?![\p{L}\p{N}_])/gu, '$1<strong>$2</strong>')
      .replace(/\*([^\s*](?:[^*]*?[^\s*])?)\*/g, '<em>$1</em>')
      .replace(/(^|[^\p{L}\p{N}_])_([^\s_](?:[^_]*?[^\s_])?)_(?![\p{L}\p{N}_])/gu, '$1<em>$2</em>')
      .replace(/~~([^\s~](?:[\s\S]*?[^\s~])?)~~/g, '<del>$1</del>');
  }

  function restore(html, stash) {
    let output = html;

    for (let pass = 0; pass < 5 && output.includes('\u0000'); pass += 1) {
      output = output.replace(STASH_TOKEN, (_, index) => stash[Number(index)]);
    }

    return output;
  }

  function trimCodeSpan(code) {
    const flat = code.replace(/\n/g, ' ');
    return /^ .*\S.* $/.test(flat) ? flat.slice(1, -1) : flat;
  }

  function anchor(href, labelHtml, title) {
    const url = safeUrl(href, false);
    const titleAttribute = title ? ` title="${escapeHtml(title)}"` : '';
    const targetAttribute = URL_SCHEME.test(url) ? ' target="_blank" rel="noopener noreferrer"' : '';

    return `<a href="${escapeHtml(url)}"${titleAttribute}${targetAttribute}>${labelHtml}</a>`;
  }

  function image(alt, src, title) {
    const titleAttribute = title ? ` title="${escapeHtml(title)}"` : '';
    return `<img src="${escapeHtml(safeUrl(src, true))}" alt="${escapeHtml(alt)}"${titleAttribute}>`;
  }

  function safeUrl(url, allowDataImage) {
    const compact = url.replace(/[\u0000- ]/g, '').toLowerCase();

    if (allowDataImage && compact.startsWith('data:image/')) {
      return url;
    }

    return /^(?:javascript|vbscript|data):/.test(compact) ? '#' : url;
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
  }

  // Like escapeHtml, but leaves entity references (&nbsp; &#8212;) intact.
  function escapeText(text) {
    return String(text).replace(/&(?!#?[a-zA-Z\d]+;)|[<>"']/g, (char) => HTML_ESCAPES[char]);
  }

  return { render };
});
