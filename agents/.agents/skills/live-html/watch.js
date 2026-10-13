// live-html watcher: hands the agent the next batch of approved comments.
//
//   node watch.js <file.md> [--once]
//
// Starting it means "the previous comments are applied": batches claimed by
// the last run move to done/ and the page shows them as applied. It then
// waits for the inbox, claims what is there, prints it as JSON and exits — in
// the background, that exit is what wakes the agent. --once skips the wait.
// It also exits when the server is gone, so a closed session isn't watched
// forever.
//
// ponytail: polls rather than fs.watch — a readdir every 400ms is free for a
// plain OS process and sidesteps fs.watch's macOS quirks (EMFILE, missed
// atomic-saves).

'use strict';

const fs = require('fs');
const path = require('path');
const { openState, claimPending, finishClaimed, readServerInfo, isProcessAlive } = require('./state');

const POLL_MS = 400;
const SERVER_START_GRACE_MS = 30 * 1000;

function main() {
  const args = process.argv.slice(2);
  const mdArg = args.find((arg) => !arg.startsWith('--'));
  const once = args.includes('--once');

  if (!mdArg) {
    console.error('usage: node watch.js <file.md> [--once]');
    process.exit(1);
  }

  const mdPath = path.resolve(mdArg);

  if (!fs.existsSync(mdPath)) {
    console.error(`no such file: ${mdPath}`);
    process.exit(1);
  }

  const state = openState(mdPath);
  const startedAt = Date.now();
  let serverSeen = false;

  finishClaimed(state);

  const poll = () => {
    const batches = claimPending(state);

    if (batches.length > 0 || once) {
      report(mdPath, batches, false);
      return;
    }

    const serverRunning = isServerRunning(state);
    serverSeen = serverSeen || serverRunning;

    // Grace period: the agent may launch the server and the watcher together.
    if (!serverRunning && (serverSeen || Date.now() - startedAt > SERVER_START_GRACE_MS)) {
      report(mdPath, [], true);
      return;
    }

    setTimeout(poll, POLL_MS);
  };

  poll();
}

function isServerRunning(state) {
  const info = readServerInfo(state);
  return Boolean(info) && isProcessAlive(info.pid);
}

function report(mdPath, batches, serverStopped) {
  const comments = batches.flatMap((batch) => batch.comments);
  console.log(JSON.stringify({ doc: mdPath, serverStopped, comments }, null, 2));
}

main();
