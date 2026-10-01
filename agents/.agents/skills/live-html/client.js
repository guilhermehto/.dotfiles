// live-html page. Renders the doc, turns selections into draft comments,
// sends approved drafts, and re-renders in place when the doc changes so
// drafts (also kept in localStorage) survive the agent's edits.

'use strict';

const docEl = document.getElementById('lh-doc');
const fileEl = document.getElementById('lh-file');
const connectionEl = document.getElementById('lh-connection');
const draftsEl = document.getElementById('lh-drafts');
const draftsEmptyEl = document.getElementById('lh-drafts-empty');
const pendingEl = document.getElementById('lh-pending');
const generalButton = document.getElementById('lh-general');
const sendButton = document.getElementById('lh-send');
const statusEl = document.getElementById('lh-status');
const changesEl = document.getElementById('lh-changes');
const changesTextEl = document.getElementById('lh-changes-text');
const jumpButton = document.getElementById('lh-jump');
const addButton = document.getElementById('lh-add');

const MAX_SOURCE_CHARS = 2000;
const MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
const GENERAL_LABEL = 'General comment — whole document';

const state = {
  doc: null,
  lines: [],
  drafts: [],
  blockSources: null,
  changedBlocks: [],
  jumpIndex: 0,
  pendingBatches: [],
  selection: null,
  sending: false,
};

let mermaidLoader = null;
let diagramCount = 0;

// ---- startup and live updates ----

async function start() {
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
    connectionEl.hidden = true;

    if (!connected) {
      connected = true;
      refreshDoc().catch(reportError);
      refreshAnnotations().catch(reportError);
    }
  });
  events.addEventListener('error', () => {
    connected = false;
    connectionEl.hidden = false;
  });
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
    setStatus(`✓ Agent applied ${plural(applied, 'comment')}.`, 'ok');
  }
}

function setDoc(doc) {
  state.doc = doc;
  state.lines = doc.markdown.replace(/\r\n?/g, '\n').split('\n');
  fileEl.textContent = doc.name;
  fileEl.title = doc.path;
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

  renderDiagrams().catch(reportError);
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
    block.classList.add('lh-changed');
  }

  return changed;
}

function announceChanges(changed) {
  state.changedBlocks = changed;
  state.jumpIndex = 0;
  changesEl.hidden = changed.length === 0;
  changesTextEl.textContent = `Doc updated — ${plural(changed.length, 'block')} changed.`;
}

function jumpToNextChange() {
  const blocks = state.changedBlocks.filter((block) => block.isConnected);

  if (!blocks.length) {
    return;
  }

  blocks[state.jumpIndex % blocks.length].scrollIntoView({ block: 'center', behavior: 'smooth' });
  state.jumpIndex += 1;
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

  const rect = range.getBoundingClientRect();
  state.selection = anchor;
  addButton.style.left = `${window.scrollX + rect.left}px`;
  addButton.style.top = `${window.scrollY + rect.bottom + 6}px`;
  addButton.hidden = false;
}

function hideAddButton() {
  addButton.hidden = true;
  state.selection = null;
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

function addDraftCard(draft) {
  const card = document.createElement('div');
  card.className = 'lh-card';
  card.dataset.key = draft.key;
  card.innerHTML = `
    <div class="lh-quote"></div>
    <textarea rows="2" placeholder="What should change? ⏎ approve · ⇧⏎ newline · ⌘⏎ send"></textarea>
    <div class="lh-row">
      <label><input type="checkbox"> Approve</label>
      <span class="lh-hint"></span>
      <button class="lh-delete" type="button" title="Delete draft">×</button>
    </div>`;

  const quoteEl = card.querySelector('.lh-quote');
  const textarea = card.querySelector('textarea');
  const checkbox = card.querySelector('input[type="checkbox"]');

  quoteEl.textContent = draft.quote || GENERAL_LABEL;
  quoteEl.classList.toggle('general', !draft.quote);
  textarea.value = draft.comment;

  textarea.addEventListener('input', () => {
    draft.comment = textarea.value;

    if (!draft.comment.trim()) {
      draft.approved = false;
    }

    paintCard(card, draft);
    saveDrafts();
  });
  textarea.addEventListener('keydown', (event) => {
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
      textarea.blur();
    }
  });
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

  draftsEl.append(card);
  paintCard(card, draft);
}

function paintCard(card, draft) {
  const hasText = Boolean(draft.comment.trim());
  const checkbox = card.querySelector('input[type="checkbox"]');

  checkbox.checked = draft.approved;
  checkbox.disabled = !hasText;
  card.classList.toggle('approved', draft.approved);
  card.classList.toggle('lost', draft.lost);
  card.querySelector('.lh-hint').textContent = hintFor(draft, hasText);
  refreshSendButton();
}

function hintFor(draft, hasText) {
  if (draft.lost) {
    return 'quoted text changed — highlight lost';
  }

  if (draft.approved) {
    return '✓ approved';
  }

  return hasText ? '⏎ to approve' : '';
}

function refreshDrafts() {
  for (const draft of state.drafts) {
    const card = cardFor(draft.key);

    if (card) {
      paintCard(card, draft);
    }
  }

  draftsEmptyEl.hidden = state.drafts.length > 0;
  refreshSendButton();
}

function focusDraft(key, { edit = false } = {}) {
  for (const element of document.querySelectorAll('.lh-card.active, mark.lh-mark.active')) {
    element.classList.remove('active');
  }

  const marks = marksFor(key);
  const card = cardFor(key);

  for (const mark of marks) {
    mark.classList.add('active');
  }

  if (card) {
    card.classList.add('active');
    card.scrollIntoView({ block: 'nearest' });
  }

  if (edit && card) {
    card.querySelector('textarea').focus();
  } else if (marks.length) {
    marks[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

// ---- sending ----

function approvedDrafts() {
  return state.drafts.filter((draft) => draft.approved && draft.comment.trim());
}

function refreshSendButton() {
  const count = approvedDrafts().length;
  sendButton.disabled = count === 0 || state.sending;
  sendButton.textContent = count ? `Send ${count} approved ►` : 'Send ►';
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

    setStatus(`Sent ${plural(comments.length, 'comment')} — waiting for the agent.`, 'ok');
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
    ...pendingGroup('Sent — waiting for the agent', sent),
    ...pendingGroup('Agent is applying…', applying),
  );
}

function pendingGroup(title, batches) {
  const comments = batches.flatMap((batch) => batch.comments);

  if (!comments.length) {
    return [];
  }

  const heading = document.createElement('h2');
  heading.textContent = `${title} (${comments.length})`;

  const cards = comments.map((comment) => {
    const card = document.createElement('div');
    const quote = document.createElement('div');
    const body = document.createElement('div');

    card.className = 'lh-card lh-pending';
    quote.className = comment.quote ? 'lh-quote' : 'lh-quote general';
    quote.textContent = comment.quote || GENERAL_LABEL;
    body.className = 'lh-comment';
    body.textContent = comment.comment;
    card.append(quote, body);
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

docEl.addEventListener('mouseup', () => setTimeout(captureSelection));
docEl.addEventListener('click', (event) => {
  const mark = event.target.closest('mark.lh-mark');

  if (mark && window.getSelection().isCollapsed) {
    focusDraft(mark.dataset.key);
  }
});
document.addEventListener('selectionchange', () => {
  if (window.getSelection().isCollapsed) {
    hideAddButton();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    sendApproved();
  }
});
addButton.addEventListener('mousedown', (event) => event.preventDefault());
addButton.addEventListener('click', () => {
  if (state.selection) {
    createDraft(state.selection);
  }

  window.getSelection().removeAllRanges();
  hideAddButton();
});
generalButton.addEventListener('click', () => createDraft({ quote: '', offset: null }));
sendButton.addEventListener('click', sendApproved);
jumpButton.addEventListener('click', jumpToNextChange);

start().catch((error) => setStatus(`Failed to load: ${error.message}`, 'error'));
