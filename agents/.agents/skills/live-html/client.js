// live-html page. Renders the doc, turns selections into draft comments,
// sends approved drafts, and re-renders in place when the doc changes so
// drafts (also kept in localStorage) survive the agent's edits.

'use strict';

const docEl = document.getElementById('lh-doc');
const fileEl = document.getElementById('lh-file');
const dirEl = document.getElementById('lh-dir');
const connectionEl = document.getElementById('lh-connection');
const draftsEl = document.getElementById('lh-drafts');
const draftsEmptyEl = document.getElementById('lh-drafts-empty');
const draftCountEl = document.getElementById('lh-draft-count');
const pendingEl = document.getElementById('lh-pending');
const generalButton = document.getElementById('lh-general');
const sendButton = document.getElementById('lh-send');
const sendLabelEl = document.getElementById('lh-send-label');
const statusEl = document.getElementById('lh-status');
const activityEl = document.getElementById('lh-activity');
const appliedEl = document.getElementById('lh-applied');
const changesEl = document.getElementById('lh-changes');
const changesTextEl = document.getElementById('lh-changes-text');
const jumpButton = document.getElementById('lh-jump');
const dismissButton = document.getElementById('lh-dismiss');
const addButton = document.getElementById('lh-add');

const MAX_SOURCE_CHARS = 2000;
const MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
const GENERAL_LABEL = 'General comment — whole document';
const SEND_KEYS = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘⏎' : 'Ctrl+⏎';
const CONNECTION = {
  connecting: { label: 'Connecting…', title: '' },
  live: { label: 'Live', title: 'The page updates as the file changes' },
  reconnecting: { label: 'Reconnecting…', title: 'Server unreachable — it may have stopped' },
};

const state = {
  doc: null,
  lines: [],
  drafts: [],
  blockSources: null,
  changedBlocks: [],
  jumpIndex: 0,
  pendingBatches: [],
  selection: null,
  hoveredKey: null,
  sending: false,
};

let mermaidLoader = null;
let diagramCount = 0;

// ---- startup and live updates ----

async function start() {
  for (const kbd of document.querySelectorAll('kbd.lh-mod')) {
    kbd.textContent = SEND_KEYS;
  }

  setDoc(await fetchJson('/doc'));
  state.drafts = loadDrafts();
  renderDoc();

  for (const draft of state.drafts) {
    addDraftCard(draft);
  }

  refreshDrafts();
  await refreshAnnotations();
  connectEvents();
}

function connectEvents() {
  const events = new EventSource('/events');
  let connected = true;

  events.addEventListener('doc', () => refreshDoc().catch(reportError));
  events.addEventListener('annotations', () => refreshAnnotations().catch(reportError));
  events.addEventListener('open', () => {
    setConnection('live');

    if (!connected) {
      connected = true;
      refreshDoc().catch(reportError);
      refreshAnnotations().catch(reportError);
    }
  });
  events.addEventListener('error', () => {
    connected = false;
    setConnection('reconnecting');
  });
}

function setConnection(name) {
  connectionEl.dataset.state = name;
  connectionEl.textContent = CONNECTION[name].label;
  connectionEl.title = CONNECTION[name].title;
}

async function refreshDoc() {
  const doc = await fetchJson('/doc');

  if (doc.markdown === state.doc.markdown) {
    return;
  }

  setDoc(doc);
  announceChanges(renderDoc());
  refreshDrafts();
  saveDrafts();
}

async function refreshAnnotations() {
  const { sent, applying } = await fetchJson('/annotations');
  const current = [...sent, ...applying];
  const currentIds = new Set(current.map((batch) => batch.id));
  const applied = state.pendingBatches
    .filter((batch) => !currentIds.has(batch.id))
    .reduce((count, batch) => count + batch.comments.length, 0);

  state.pendingBatches = current;
  renderPending(sent, applying);

  if (applied > 0) {
    appliedEl.textContent = `✓ Agent applied ${plural(applied, 'comment')}`;
    appliedEl.hidden = false;
    refreshActivity();
  }
}

function setDoc(doc) {
  state.doc = doc;
  state.lines = doc.markdown.replace(/\r\n?/g, '\n').split('\n');
  fileEl.textContent = doc.name;
  fileEl.title = doc.path;
  // LRM marks keep the slashes in place inside the right-to-left box that
  // ellipsizes the start of the path.
  dirEl.textContent = `\u200E${doc.path.slice(0, -doc.name.length - 1)}\u200E`;
  dirEl.title = doc.path;
  document.title = `${doc.name} — live-html`;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options });

  if (!response.ok) {
    throw new Error(`${response.status} ${await response.text()}`);
  }

  return response.json();
}

// ---- doc rendering ----

function renderDoc() {
  docEl.innerHTML = window.LiveHtmlMarkdown.render(state.doc.markdown);
  resolveRelativeImages();

  const changed = markChangedBlocks();

  for (const draft of state.drafts) {
    highlight(draft);
  }

  renderDiagrams().catch((error) => setStatus(error.message, 'warn'));
  return changed;
}

function resolveRelativeImages() {
  for (const img of docEl.querySelectorAll('img[src]')) {
    const src = img.getAttribute('src');

    if (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(src)) {
      continue;
    }

    img.src = `/files?path=${encodeURIComponent(safeDecode(src.split(/[?#]/)[0]))}`;
  }
}

function safeDecode(text) {
  try {
    return decodeURI(text);
  } catch {
    return text;
  }
}

function topLevelBlocks() {
  return [...docEl.children].filter((element) => element.dataset.ls);
}

function blockSource(block) {
  return state.lines.slice(Number(block.dataset.ls) - 1, Number(block.dataset.le)).join('\n');
}

function markChangedBlocks() {
  const blocks = topLevelBlocks();
  const sources = blocks.map(blockSource);
  const previous = state.blockSources;
  state.blockSources = new Set(sources);

  if (!previous) {
    return [];
  }

  const changed = blocks.filter((_, index) => !previous.has(sources[index]));

  for (const block of changed) {
    block.classList.add('lh-changed', 'lh-flash');
  }

  return changed;
}

function announceChanges(changed) {
  state.changedBlocks = changed;
  state.jumpIndex = 0;
  changesTextEl.textContent = changed.length ? `Doc updated · ${plural(changed.length, 'block')} changed` : 'Doc updated';
  changesEl.hidden = false;
  refreshJumpButton();
  refreshActivity();
}

function refreshJumpButton() {
  const count = state.changedBlocks.length;

  jumpButton.hidden = count === 0;
  jumpButton.textContent = count === 1 ? 'Show ↓' : `Next ↓ ${(state.jumpIndex % count) + 1}/${count}`;
}

function jumpToNextChange() {
  const blocks = state.changedBlocks.filter((block) => block.isConnected);

  if (!blocks.length) {
    return;
  }

  const block = blocks[state.jumpIndex % blocks.length];
  block.scrollIntoView({ block: 'center', behavior: 'smooth' });
  flash(block);
  state.jumpIndex += 1;
  refreshJumpButton();
}

function flash(block) {
  block.classList.remove('lh-flash');
  // Forces a style flush so re-adding the class restarts the animation.
  block.getBoundingClientRect();
  block.classList.add('lh-flash');
}

function refreshActivity() {
  activityEl.hidden = appliedEl.hidden && changesEl.hidden;
}

function dismissActivity() {
  for (const block of docEl.querySelectorAll('.lh-changed')) {
    block.classList.remove('lh-changed', 'lh-flash');
  }

  state.changedBlocks = [];
  appliedEl.hidden = true;
  changesEl.hidden = true;
  refreshActivity();
}

function loadMermaid() {
  if (!mermaidLoader) {
    mermaidLoader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = MERMAID_URL;
      script.onload = () => {
        const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'default' });
        resolve(window.mermaid);
      };
      script.onerror = () => reject(new Error('mermaid unavailable (offline?) — diagrams shown as source'));
      document.head.append(script);
    });
  }

  return mermaidLoader;
}

// Diagram text lives in SVG, which the text index skips, so comments anchor
// only to the surrounding prose.
async function renderDiagrams() {
  const sources = [...docEl.querySelectorAll('pre > code.language-mermaid')];

  if (!sources.length) {
    return;
  }

  const mermaid = await loadMermaid();

  for (const code of sources) {
    const pre = code.parentElement;

    if (!pre.isConnected) {
      continue;
    }

    try {
      diagramCount += 1;
      const { svg } = await mermaid.render(`lh-diagram-${diagramCount}`, code.textContent);
      const box = document.createElement('div');
      box.className = 'lh-diagram';
      Object.assign(box.dataset, pre.dataset);
      box.innerHTML = svg;
      pre.replaceWith(box);
    } catch (error) {
      console.warn('mermaid could not render a diagram; leaving its source', error);
    }
  }
}

// ---- text anchoring ----

// Flat view of the doc's text, used both to turn a selection into
// (quote, offset) and to find that quote again after a re-render.
function textIndex() {
  const entries = [];
  let length = 0;
  const walker = document.createTreeWalker(docEl, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (node.parentElement.closest('svg') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    entries.push({ node, start: length });
    length += node.data.length;
  }

  return { entries, text: entries.map((entry) => entry.node.data).join('') };
}

function rangeToAnchor(range) {
  const index = textIndex();
  let start = null;
  let end = null;

  for (const entry of index.entries) {
    if (!range.intersectsNode(entry.node)) {
      continue;
    }

    const from = entry.node === range.startContainer ? range.startOffset : 0;
    const to = entry.node === range.endContainer ? range.endOffset : entry.node.data.length;

    if (start === null) {
      start = entry.start + from;
    }

    end = entry.start + to;
  }

  if (start === null) {
    return null;
  }

  const raw = index.text.slice(start, end);
  const quote = raw.trim();

  return quote ? { quote, offset: start + raw.indexOf(quote) } : null;
}

function locateQuote(text, quote, preferredOffset) {
  let best = -1;

  for (let at = text.indexOf(quote); at !== -1; at = text.indexOf(quote, at + 1)) {
    if (best === -1 || Math.abs(at - preferredOffset) < Math.abs(best - preferredOffset)) {
      best = at;
    }
  }

  return best;
}

function highlight(draft) {
  if (!draft.quote) {
    return;
  }

  const index = textIndex();
  const start = locateQuote(index.text, draft.quote, draft.offset);
  draft.lost = start === -1;

  if (draft.lost) {
    return;
  }

  draft.offset = start;
  const end = start + draft.quote.length;

  for (const entry of index.entries) {
    const nodeEnd = entry.start + entry.node.data.length;

    if (nodeEnd <= start || entry.start >= end || !entry.node.data.trim()) {
      continue;
    }

    wrapText(entry.node, Math.max(start - entry.start, 0), Math.min(end, nodeEnd) - entry.start, draft.key);
  }
}

function wrapText(node, from, to, key) {
  let target = node;

  if (from > 0) {
    target = target.splitText(from);
  }

  if (to - from < target.data.length) {
    target.splitText(to - from);
  }

  const mark = document.createElement('mark');
  mark.className = 'lh-mark';
  mark.dataset.key = key;
  target.replaceWith(mark);
  mark.append(target);
}

function marksFor(key) {
  return [...docEl.querySelectorAll(`mark.lh-mark[data-key="${CSS.escape(key)}"]`)];
}

function unhighlight(key) {
  for (const mark of marksFor(key)) {
    const parent = mark.parentNode;
    mark.replaceWith(...mark.childNodes);
    parent.normalize();
  }
}

// heading / lines / source tell the agent where to edit without searching.
function describeLocation(draft) {
  const marks = marksFor(draft.key);

  if (!marks.length) {
    return { heading: '', lines: null, source: '' };
  }

  const heading = headingBefore(marks[0]);
  const blocks = marks.map((mark) => mark.closest('[data-ls]')).filter(Boolean);

  if (!blocks.length) {
    return { heading, lines: null, source: '' };
  }

  const first = Math.min(...blocks.map((block) => Number(block.dataset.ls)));
  const last = Math.max(...blocks.map((block) => Number(block.dataset.le)));
  const source = state.lines.slice(first - 1, last).join('\n');

  return { heading, lines: [first, last], source: source.slice(0, MAX_SOURCE_CHARS) };
}

function headingBefore(node) {
  let text = '';

  for (const heading of docEl.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    if (!(heading.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)) {
      break;
    }

    text = heading.textContent.trim();
  }

  return text;
}

// ---- selection -> draft ----

function captureSelection() {
  const selection = window.getSelection();
  const range = selection.rangeCount && !selection.isCollapsed ? selection.getRangeAt(0) : null;
  const anchor = range && docEl.contains(range.commonAncestorContainer) ? rangeToAnchor(range) : null;

  if (!anchor) {
    hideAddButton();
    return;
  }

  state.selection = anchor;
  showAddButton(range);
}

// Sits under the end of the selection, where the pointer was released.
function showAddButton(range) {
  const lineRects = [...range.getClientRects()].filter((rect) => rect.width > 0);
  const rect = lineRects.length ? lineRects[lineRects.length - 1] : range.getBoundingClientRect();

  addButton.hidden = false;

  const width = addButton.offsetWidth;
  const left = Math.max(8, Math.min(rect.right - width / 2, document.documentElement.clientWidth - width - 8));
  addButton.style.left = `${window.scrollX + left}px`;
  addButton.style.top = `${window.scrollY + rect.bottom + 8}px`;
}

function hideAddButton() {
  addButton.hidden = true;
  state.selection = null;
}

function commentOnSelection() {
  if (state.selection) {
    createDraft(state.selection);
  }

  window.getSelection().removeAllRanges();
  hideAddButton();
}

function createDraft({ quote, offset }) {
  const draft = { key: newKey(), quote, offset, comment: '', approved: false, lost: false };

  state.drafts.push(draft);
  highlight(draft);
  addDraftCard(draft);
  refreshDrafts();
  saveDrafts();
  focusDraft(draft.key, { edit: true });
}

function newKey() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function deleteDraft(key) {
  state.drafts = state.drafts.filter((draft) => draft.key !== key);
  unhighlight(key);

  const card = cardFor(key);

  if (card) {
    card.remove();
  }

  refreshDrafts();
  saveDrafts();
}

// ---- draft cards ----

function cardFor(key) {
  return draftsEl.querySelector(`.lh-card[data-key="${CSS.escape(key)}"]`);
}

function quoteElement(quote) {
  const element = document.createElement('div');

  element.className = quote ? 'lh-quote' : 'lh-quote general';
  element.textContent = quote ? quote.replace(/\s+/g, ' ') : GENERAL_LABEL;
  element.title = quote;
  return element;
}

function addDraftCard(draft) {
  const card = document.createElement('div');
  card.className = 'lh-card';
  card.dataset.key = draft.key;
  card.innerHTML = `
    <div class="lh-lost" hidden>Quoted text is no longer in the doc. It will be sent without a location.</div>
    <textarea rows="1" placeholder="What should change?" aria-label="Comment"></textarea>
    <div class="lh-row">
      <label class="lh-approve"><input type="checkbox"><span>Approve</span></label>
      <span class="lh-hint"></span>
      <button class="lh-icon lh-delete" type="button" title="Delete draft" aria-label="Delete draft">×</button>
    </div>`;
  card.prepend(quoteElement(draft.quote));

  const textarea = card.querySelector('textarea');
  const checkbox = card.querySelector('input[type="checkbox"]');

  textarea.value = draft.comment;
  textarea.addEventListener('input', () => {
    draft.comment = textarea.value;

    if (!draft.comment.trim()) {
      draft.approved = false;
    }

    fitTextarea(textarea);
    paintCard(card, draft);
    saveDrafts();
  });
  textarea.addEventListener('keydown', (event) => handleDraftKey(event, card, draft));
  textarea.addEventListener('focus', () => activateDraft(draft.key));
  checkbox.addEventListener('change', () => {
    draft.approved = checkbox.checked && Boolean(draft.comment.trim());
    paintCard(card, draft);
    saveDrafts();
  });
  card.querySelector('.lh-delete').addEventListener('click', () => deleteDraft(draft.key));
  card.addEventListener('click', (event) => {
    if (!event.target.closest('textarea, input, button, label')) {
      focusDraft(draft.key);
    }
  });
  card.addEventListener('mouseenter', () => hoverDraft(draft.key));
  card.addEventListener('mouseleave', () => hoverDraft(null));

  draftsEl.append(card);
  fitTextarea(textarea);
  paintCard(card, draft);
}

function handleDraftKey(event, card, draft) {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.target.blur();

    if (!draft.comment.trim()) {
      deleteDraft(draft.key);
    }

    return;
  }

  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (draft.comment.trim()) {
    draft.approved = true;
    paintCard(card, draft);
    saveDrafts();
  }

  if (event.metaKey || event.ctrlKey) {
    sendApproved();
  } else {
    event.target.blur();
  }
}

function fitTextarea(textarea) {
  const borders = textarea.offsetHeight - textarea.clientHeight;

  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight + borders}px`;
}

function paintCard(card, draft) {
  const hasText = Boolean(draft.comment.trim());
  const checkbox = card.querySelector('input[type="checkbox"]');

  checkbox.checked = draft.approved;
  checkbox.disabled = !hasText;
  card.querySelector('.lh-approve').title = hasText ? '' : 'Write a comment first';
  card.querySelector('.lh-approve span').textContent = draft.approved ? 'Approved' : 'Approve';
  card.querySelector('.lh-lost').hidden = !draft.lost;
  card.querySelector('.lh-hint').textContent = hintFor(draft, hasText);
  card.classList.toggle('approved', draft.approved);
  card.classList.toggle('lost', draft.lost);

  for (const mark of marksFor(draft.key)) {
    mark.classList.toggle('approved', draft.approved);
  }

  refreshSendButton();
}

function hintFor(draft, hasText) {
  if (draft.approved) {
    return `${SEND_KEYS} to send`;
  }

  return hasText ? '⏎ approve · ⇧⏎ new line' : 'Esc to discard';
}

function refreshDrafts() {
  for (const draft of state.drafts) {
    const card = cardFor(draft.key);

    if (card) {
      paintCard(card, draft);
    }
  }

  draftsEmptyEl.hidden = state.drafts.length > 0;
  draftCountEl.hidden = state.drafts.length === 0;
  draftCountEl.textContent = String(state.drafts.length);
  refreshSendButton();
}

function activateDraft(key) {
  for (const element of document.querySelectorAll('.lh-card.active, mark.lh-mark.active')) {
    element.classList.remove('active');
  }

  for (const mark of marksFor(key)) {
    mark.classList.add('active');
  }

  const card = cardFor(key);

  if (card) {
    card.classList.add('active');
  }
}

function focusDraft(key, { edit = false } = {}) {
  activateDraft(key);

  const marks = marksFor(key);
  const card = cardFor(key);

  if (card) {
    card.scrollIntoView({ block: 'nearest' });
  }

  if (edit && card) {
    card.querySelector('textarea').focus();
  } else if (marks.length) {
    marks[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

// Links a draft's highlight and its card while either is under the pointer.
function hoverDraft(key) {
  if (key === state.hoveredKey) {
    return;
  }

  setHover(state.hoveredKey, false);
  setHover(key, true);
  state.hoveredKey = key;
}

function setHover(key, hovered) {
  if (!key) {
    return;
  }

  for (const mark of marksFor(key)) {
    mark.classList.toggle('hover', hovered);
  }

  const card = cardFor(key);

  if (card) {
    card.classList.toggle('hover', hovered);
  }
}

// ---- sending ----

function approvedDrafts() {
  return state.drafts.filter((draft) => draft.approved && draft.comment.trim());
}

function refreshSendButton() {
  const count = approvedDrafts().length;

  sendButton.disabled = count === 0 || state.sending;
  sendButton.title = count ? '' : 'Approve a draft to send it';
  sendLabelEl.textContent = sendLabel(count);
}

function sendLabel(count) {
  if (state.sending) {
    return 'Sending…';
  }

  return count ? `Send ${plural(count, 'comment')}` : 'Send';
}

async function sendApproved() {
  const ready = approvedDrafts();

  if (!ready.length || state.sending) {
    return;
  }

  const comments = ready.map((draft) => ({ quote: draft.quote, comment: draft.comment.trim(), ...describeLocation(draft) }));
  state.sending = true;
  refreshSendButton();

  try {
    await fetchJson('/annotations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ comments }),
    });

    for (const draft of ready) {
      deleteDraft(draft.key);
    }

    setStatus('');
    appliedEl.hidden = true;
    refreshActivity();
  } catch (error) {
    setStatus(`Send failed: ${error.message}`, 'error');
  } finally {
    state.sending = false;
    refreshSendButton();
  }
}

// ---- pending (sent, not yet applied) ----

function renderPending(sent, applying) {
  pendingEl.replaceChildren(
    ...pendingGroup('Waiting for the agent', sent, ''),
    ...pendingGroup('Agent is applying', applying, 'lh-busy'),
  );
}

function pendingGroup(title, batches, headingClass) {
  const comments = batches.flatMap((batch) => batch.comments);

  if (!comments.length) {
    return [];
  }

  const heading = document.createElement('h2');
  const count = document.createElement('span');

  heading.className = headingClass;
  count.className = 'lh-count';
  count.textContent = String(comments.length);
  heading.append(title, count);

  const cards = comments.map((comment) => {
    const card = document.createElement('div');
    const body = document.createElement('div');

    card.className = 'lh-card';
    body.className = 'lh-comment';
    body.textContent = comment.comment;
    card.append(quoteElement(comment.quote), body);
    return card;
  });

  return [heading, ...cards];
}

// ---- persistence and status ----

function storageKey() {
  return `live-html:${state.doc.path}`;
}

function loadDrafts() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey()) || '[]');
    return saved.map((draft) => ({ ...draft, lost: false }));
  } catch (error) {
    console.warn('ignoring unreadable saved drafts', error);
    return [];
  }
}

function saveDrafts() {
  const saved = state.drafts.map(({ key, quote, offset, comment, approved }) => ({ key, quote, offset, comment, approved }));
  localStorage.setItem(storageKey(), JSON.stringify(saved));
}

function setStatus(message, tone = 'info') {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

function reportError(error) {
  setStatus(error.message, 'error');
}

function plural(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

// ---- wiring ----

function isTyping(target) {
  return Boolean(target.closest && target.closest('textarea, input, select, [contenteditable]'));
}

docEl.addEventListener('mouseup', () => setTimeout(captureSelection));
docEl.addEventListener('click', (event) => {
  const mark = event.target.closest('mark.lh-mark');

  if (mark && window.getSelection().isCollapsed) {
    focusDraft(mark.dataset.key);
  }
});
docEl.addEventListener('mouseover', (event) => {
  const mark = event.target.closest('mark.lh-mark');
  hoverDraft(mark ? mark.dataset.key : null);
});
docEl.addEventListener('mouseleave', () => hoverDraft(null));
document.addEventListener('selectionchange', () => {
  if (window.getSelection().isCollapsed) {
    hideAddButton();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    sendApproved();
    return;
  }

  if (addButton.hidden || isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }

  if (event.key.toLowerCase() === 'c') {
    event.preventDefault();
    commentOnSelection();
  } else if (event.key === 'Escape') {
    window.getSelection().removeAllRanges();
    hideAddButton();
  }
});
addButton.addEventListener('mousedown', (event) => event.preventDefault());
addButton.addEventListener('click', commentOnSelection);
generalButton.addEventListener('click', () => createDraft({ quote: '', offset: null }));
sendButton.addEventListener('click', sendApproved);
jumpButton.addEventListener('click', jumpToNextChange);
dismissButton.addEventListener('click', dismissActivity);

start().catch((error) => setStatus(`Failed to load: ${error.message}`, 'error'));
