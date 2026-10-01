'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const { openState, addBatch, listBatches, writeServerInfo } = require('../state');
const { makeDoc, runWatch, stopProcess, delay } = require('./helpers');

const COMMENT = { quote: 'Hello', comment: 'Louder', heading: 'Doc', lines: [3, 3], source: 'Hello world.' };

test('waits for a batch, prints its comments, and claims it', async () => {
  const mdPath = makeDoc();
  const state = openState(mdPath);
  const watch = runWatch(mdPath);

  await delay(300);
  assert.equal(watch.child.exitCode, null, 'should still be waiting');

  addBatch(state, [COMMENT]);
  const { code, report } = await watch.done;

  assert.equal(code, 0);
  assert.deepEqual(report, { doc: mdPath, serverStopped: false, comments: [COMMENT] });
  assert.equal(listBatches(state, 'inbox').length, 0);
  assert.equal(listBatches(state, 'claimed').length, 1);
});

test('re-arming marks the previously claimed batch applied', async () => {
  const mdPath = makeDoc();
  const state = openState(mdPath);
  addBatch(state, [COMMENT]);
  await runWatch(mdPath).done;

  const { report } = await runWatch(mdPath, ['--once']).done;

  assert.deepEqual(report.comments, []);
  assert.equal(listBatches(state, 'claimed').length, 0);
  assert.equal(listBatches(state, 'done').length, 1);
});

test('--once returns pending comments without waiting', async () => {
  const mdPath = makeDoc();
  addBatch(openState(mdPath), [COMMENT]);

  const { report } = await runWatch(mdPath, ['--once']).done;
  assert.deepEqual(report.comments, [COMMENT]);
});

test('reports serverStopped once the server process is gone', async () => {
  const mdPath = makeDoc();
  const fakeServer = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)']);
  writeServerInfo(openState(mdPath), { pid: fakeServer.pid, port: 1, url: 'http://127.0.0.1:1/', doc: mdPath });

  const watch = runWatch(mdPath);
  await delay(600);
  await stopProcess(fakeServer);

  const { report } = await watch.done;
  assert.deepEqual(report, { doc: mdPath, serverStopped: true, comments: [] });
});

test('fails fast for a missing doc', async () => {
  const { code, stderr } = await runWatch('/nonexistent/doc.md').done;

  assert.equal(code, 1);
  assert.match(stderr, /no such file/);
});
