'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { render } = require('../markdown');

test('tags top-level blocks with their 1-based source lines', () => {
  const html = render('# Title\n\nFirst paragraph\nstill first.\n\n- a\n- b\n');

  assert.match(html, /<h1 data-ls="1" data-le="1" id="title">Title<\/h1>/);
  assert.match(html, /<p data-ls="3" data-le="4">First paragraph\nstill first\.<\/p>/);
  assert.match(html, /<ul data-ls="6" data-le="7">/);
});

test('counts front matter lines and shows it as a muted code block', () => {
  const html = render('---\ntitle: Plan\n---\n# Heading\n');

  assert.match(html, /<pre data-ls="1" data-le="3" class="frontmatter"><code>title: Plan<\/code><\/pre>/);
  assert.match(html, /<h1 data-ls="4" data-le="4"/);
});

test('gives headings unique anchor ids and drops closing hashes', () => {
  const html = render('## Open questions ##\n\n## Open questions\n\nSetext\n===\n');

  assert.match(html, /<h2 [^>]*id="open-questions">Open questions<\/h2>/);
  assert.match(html, /<h2 [^>]*id="open-questions-1">/);
  assert.match(html, /<h1 data-ls="5" data-le="6" id="setext">Setext<\/h1>/);
});

test('leaves snake_case identifiers alone while rendering emphasis', () => {
  const html = render('Use snake_case_name with **bold**, *em*, _em_ and ~~gone~~.');

  assert.match(html, /snake_case_name/);
  assert.match(html, /<strong>bold<\/strong>, <em>em<\/em>, <em>em<\/em> and <del>gone<\/del>/);
});

test('keeps markup inside code spans literal', () => {
  const html = render('Run `**not bold** <b>` now.');

  assert.match(html, /<code>\*\*not bold\*\* &lt;b&gt;<\/code>/);
});

test('renders fenced code with its language and escapes it', () => {
  const html = render('```ts\nconst a = "<b>";\n```\n\n~~~~\n```\nnested\n```\n~~~~\n');

  assert.match(html, /<pre data-ls="1" data-le="3"><code class="language-ts">const a = &quot;&lt;b&gt;&quot;;<\/code><\/pre>/);
  assert.match(html, /<pre data-ls="5" data-le="9"><code>```\nnested\n```<\/code><\/pre>/);
});

test('runs an unclosed fence to the end of the document', () => {
  const html = render('```\nstill code\n\n# not a heading\n');

  assert.match(html, /<code>still code\n\n# not a heading\n<\/code>/);
  assert.doesNotMatch(html, /<h1/);
});

test('renders tables with alignment, escaped pipes, and pipes inside code', () => {
  const html = render('| Name | Score |\n|:-----|------:|\n| `a|b` | 1 \\| 2 |\n');

  assert.match(html, /<div data-ls="1" data-le="3" class="table">/);
  assert.match(html, /<th class="align-left">Name<\/th><th class="align-right">Score<\/th>/);
  assert.match(html, /<td class="align-left"><code>a\|b<\/code><\/td><td class="align-right">1 \| 2<\/td>/);
});

test('does not mistake a setext underline for a table', () => {
  const html = render('Title | sub\n---\n');

  assert.match(html, /<h2 [^>]*>Title \| sub<\/h2>/);
  assert.doesNotMatch(html, /<table>/);
});

test('nests lists by indentation, including two spaces under an ordered item', () => {
  const html = render('1. one\n  - nested\n    - deeper\n2. two\n');

  assert.match(html, /<ol data-ls="1" data-le="4"><li>one<ul><li>nested<ul><li>deeper<\/li><\/ul><\/li><\/ul><\/li><li>two<\/li><\/ol>/);
});

test('renders task items and ordered start numbers', () => {
  const html = render('- [ ] todo\n- [x] done\n\n3. third\n4. fourth\n');

  assert.match(html, /<li class="task"><input type="checkbox" disabled> todo<\/li>/);
  assert.match(html, /<li class="task"><input type="checkbox" disabled checked> done<\/li>/);
  assert.match(html, /<ol data-ls="4" data-le="5" start="3">/);
});

test('wraps items in paragraphs only when the list is loose', () => {
  assert.match(render('- a\n- b\n'), /<li>a<\/li><li>b<\/li>/);
  assert.match(render('- a\n\n- b\n'), /<li><p>a<\/p><\/li><li><p>b<\/p><\/li>/);
});

test('folds lazy continuation lines into the list item', () => {
  const html = render('- item text\nwraps here\n- next\n');

  assert.match(html, /<li>item text\nwraps here<\/li><li>next<\/li>/);
});

test('renders block quotes and GitHub alerts', () => {
  const html = render('> plain\n\n> [!WARNING]\n> Mind the gap.\n');

  assert.match(html, /<blockquote data-ls="1" data-le="1"><p>plain<\/p><\/blockquote>/);
  assert.match(html, /<blockquote data-ls="3" data-le="4" class="alert alert-warning"><p class="alert-title">Warning<\/p><p>Mind the gap\.<\/p><\/blockquote>/);
});

test('resolves inline, reference, and bare links', () => {
  const html = render('[inline](https://a.example/(x)) [ref][r] [r] https://b.example/a_b_c.\n\n[r]: https://r.example "Title"\n');

  assert.match(html, /<a href="https:\/\/a\.example\/\(x\)" target="_blank" rel="noopener noreferrer">inline<\/a>/);
  assert.equal(html.match(/<a href="https:\/\/r\.example" title="Title"/g).length, 2);
  assert.match(html, /<a href="https:\/\/b\.example\/a_b_c"[^>]*>https:\/\/b\.example\/a_b_c<\/a>\./);
});

test('neutralises script URLs in links', () => {
  const html = render('[click](javascript:alert(1)) ![x](data:text/html,hi)');

  assert.match(html, /<a href="#">click<\/a>/);
  assert.match(html, /<img src="#" alt="x">/);
});

test('passes raw HTML through and hides comments', () => {
  const html = render('<details>\n<summary>More</summary>\n\nInside **md**\n\n</details>\n\n<!-- note\nto self -->\nPress <kbd>Ctrl</kbd> &nbsp; AT&T\n');

  assert.match(html, /<details data-ls="1" data-le="2">\n<summary>More<\/summary>/);
  assert.match(html, /<p data-ls="4" data-le="4">Inside <strong>md<\/strong><\/p>/);
  assert.doesNotMatch(html, /note/);
  assert.match(html, /Press <kbd>Ctrl<\/kbd> &nbsp; AT&amp;T/);
});

test('turns two trailing spaces or a backslash into a line break', () => {
  assert.match(render('one  \ntwo\\\nthree'), /one<br>two<br>three/);
});
