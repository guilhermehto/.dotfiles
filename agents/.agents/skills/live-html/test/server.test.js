'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { openState, listBatches, claimPending, finishClaimed } = require('../state');
const { makeDoc, startServer, stopProcess, request, postComments, openEventStream } = require('./helpers');

async function serve(t, markdown) {
  const mdPath = makeDoc(markdown);
  const server = await startServer(mdPath);
  t.after(() => stopProcess(server.child));
  return { mdPath, server };
}

const COMMENT = { quote: 'Hello', comment: 'Make it louder', heading: 'Doc', lines: [3, 3], source: 'Hello world.' };

test('serves the markdown with its path and name', async (t) => {
  const { mdPath, server } = await serve(t, '# Hello\n');
  const response = await request(`${server.url}doc`);

  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), { path: mdPath, name: 'doc.md', markdown: '# Hello\n' });
});

test('serves the page under a CSP that only allows its own scripts', async (t) => {
  const { server } = await serve(t);
  const response = await request(server.url);

  assert.equal(response.status, 200);
  assert.match(response.headers['content-security-policy'], /script-src 'self' https:\/\/cdn\.jsdelivr\.net;/);
  assert.match(response.body, /<script src="\/client\.js"><\/script>/);
});

test('stores every send as its own inbox batch', async (t) => {
  const { mdPath, server } = await serve(t);

  assert.equal((await postComments(server, [COMMENT])).status, 200);
  assert.equal((await postComments(server, [{ ...COMMENT, comment: 'Second', lines: 'bogus' }])).status, 200);

  const batches = listBatches(openState(mdPath), 'inbox');
  assert.deepEqual(batches.map((batch) => batch.comments[0]), [COMMENT, { ...COMMENT, comment: 'Second', lines: null }]);
});

test('lists sent and claimed batches for the page', async (t) => {
  const { server } = await serve(t);
  await postComments(server, [COMMENT]);

  const { sent, applying } = JSON.parse((await request(`${server.url}annotations`)).body);
  assert.deepEqual(sent.map((batch) => batch.comments), [[COMMENT]]);
  assert.deepEqual(applying, []);
});

test('rejects comments without instruction text', async (t) => {
  const { server } = await serve(t);
  const response = await postComments(server, [{ ...COMMENT, comment: '   ' }]);

  assert.equal(response.status, 400);
});

test('rejects cross-origin and non-JSON posts', async (t) => {
  const { mdPath, server } = await serve(t);

  assert.equal((await postComments(server, [COMMENT], { origin: 'https://evil.example' })).status, 403);
  assert.equal((await postComments(server, [COMMENT], { 'content-type': 'text/plain' })).status, 415);
  assert.equal(listBatches(openState(mdPath), 'inbox').length, 0);
});

test('rejects requests addressed to a non-local host', async (t) => {
  const { server } = await serve(t);
  const response = await request(`${server.url}doc`, { headers: { host: `evil.example:${server.port}` } });

  assert.equal(response.status, 403);
});

test('pushes a doc event when the markdown changes', async (t) => {
  const { mdPath, server } = await serve(t);
  const events = await openEventStream(server);
  t.after(() => events.close());

  fs.writeFileSync(mdPath, '# Changed\n');
  await events.waitFor('event: doc');
});

test('pushes an annotations event when a batch arrives', async (t) => {
  const { server } = await serve(t);
  const events = await openEventStream(server);
  t.after(() => events.close());

  await postComments(server, [COMMENT]);
  await events.waitFor('event: annotations');
});

test('pushes an annotations event at every stage a batch moves through', async (t) => {
  const { mdPath, server } = await serve(t);
  const state = openState(mdPath);
  const events = await openEventStream(server);
  t.after(() => events.close());

  await postComments(server, [COMMENT]);
  await events.waitFor('event: annotations', 1);

  claimPending(state);
  await events.waitFor('event: annotations', 2);

  finishClaimed(state);
  await events.waitFor('event: annotations', 3);
});

test('reuses the running server for the same doc', async (t) => {
  const { mdPath, server } = await serve(t);
  const second = await startServer(mdPath);
  const exitCode = await new Promise((resolve) => second.child.on('exit', resolve));

  assert.equal(exitCode, 0);
  assert.match(second.output(), new RegExp(`already serving doc\\.md at ${server.url}`));
});

test('moves to the next port when the requested one is taken', async (t) => {
  const { server } = await serve(t);
  const other = await startServer(makeDoc(), String(server.port));
  t.after(() => stopProcess(other.child));

  assert.ok(other.port > server.port, `expected a port above ${server.port}, got ${other.port}`);
});

test('serves images next to the doc and nothing else', async (t) => {
  const { mdPath, server } = await serve(t);
  fs.writeFileSync(path.join(path.dirname(mdPath), 'diagram.png'), 'png-bytes');

  const image = await request(`${server.url}files?path=diagram.png`);
  assert.equal(image.status, 200);
  assert.equal(image.headers['content-type'], 'image/png');
  assert.equal(image.body, 'png-bytes');

  assert.equal((await request(`${server.url}files?path=doc.md`)).status, 415);
  assert.equal((await request(`${server.url}files?path=missing.png`)).status, 404);
});

test('removes its server.json on shutdown', async (t) => {
  const { mdPath, server } = await serve(t);
  const serverFile = openState(mdPath).serverFile;

  assert.equal(JSON.parse(fs.readFileSync(serverFile, 'utf8')).url, server.url);

  await stopProcess(server.child);
  assert.equal(fs.existsSync(serverFile), false);
});

test('refuses to start for a missing file', async () => {
  await assert.rejects(startServer('/nonexistent/doc.md'), /no such file/);
});
