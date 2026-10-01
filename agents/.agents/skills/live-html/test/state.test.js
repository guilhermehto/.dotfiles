'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  openState,
  addBatch,
  listBatches,
  claimPending,
  finishClaimed,
  writeServerInfo,
  readServerInfo,
  clearServerInfo,
} = require('../state');
const { makeDoc } = require('./helpers');

const comment = (text) => ({ quote: 'q', comment: text, heading: '', lines: null, source: '' });

test('batches advance inbox -> claimed -> done in send order', () => {
  const state = openState(makeDoc());
  const first = addBatch(state, [comment('first')], new Date('2026-01-01T00:00:00Z'));
  const second = addBatch(state, [comment('second')], new Date('2026-01-01T00:00:01Z'));

  assert.deepEqual(listBatches(state, 'inbox').map((batch) => batch.id), [first.id, second.id]);

  const claimed = claimPending(state);
  assert.deepEqual(claimed.map((batch) => batch.comments[0].comment), ['first', 'second']);
  assert.equal(listBatches(state, 'inbox').length, 0);
  assert.equal(listBatches(state, 'claimed').length, 2);

  assert.equal(finishClaimed(state), 2);
  assert.equal(listBatches(state, 'claimed').length, 0);
  assert.equal(listBatches(state, 'done').length, 2);
});

test('ignores half-written temp files', () => {
  const state = openState(makeDoc());
  fs.writeFileSync(path.join(state.stages.inbox, '.partial.json.123.tmp'), '{');

  assert.deepEqual(claimPending(state), []);
});

test('keeps state per document and out of git', () => {
  const mdPath = makeDoc();
  const other = path.join(path.dirname(mdPath), 'other.md');
  fs.writeFileSync(other, '# Other\n');

  const state = openState(mdPath);
  addBatch(openState(other), [comment('for other')]);

  assert.equal(listBatches(state, 'inbox').length, 0);
  assert.equal(fs.readFileSync(path.join(path.dirname(mdPath), '.live-html', '.gitignore'), 'utf8'), '*\n');
});

test('only the owning process clears server info', () => {
  const state = openState(makeDoc());
  writeServerInfo(state, { pid: 111, port: 1, url: 'http://127.0.0.1:1/', doc: state.doc });

  clearServerInfo(state, 222);
  assert.equal(readServerInfo(state).pid, 111);

  clearServerInfo(state, 111);
  assert.equal(readServerInfo(state), null);
});
