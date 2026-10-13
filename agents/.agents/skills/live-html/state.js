// live-html on-disk state, shared by server.js and watch.js.
//
//   <dir-of-md>/.live-html/<file-name>/
//     inbox/<batch>.json    sent from the page, not yet seen by the agent
//     claimed/<batch>.json  handed to the agent by watch.js
//     done/<batch>.json     applied (the agent re-armed watch.js)
//     server.json           { pid, port, url, doc } of the running server
//
// Every Send is its own batch file and stages advance by rename, so the
// server (adding) and the watcher (claiming) never read-modify-write a shared
// file and a second Send can't overwrite the first.

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STAGES = ['inbox', 'claimed', 'done'];

function openState(mdPath) {
  const root = path.join(path.dirname(mdPath), '.live-html');
  const dir = path.join(root, path.basename(mdPath));
  const stages = {};

  for (const stage of STAGES) {
    stages[stage] = path.join(dir, stage);
    fs.mkdirSync(stages[stage], { recursive: true });
  }

  const gitignore = path.join(root, '.gitignore');

  if (!fs.existsSync(gitignore)) {
    fs.writeFileSync(gitignore, '*\n');
  }

  return { doc: mdPath, dir, stages, serverFile: path.join(dir, 'server.json') };
}

function addBatch(state, comments, now = new Date()) {
  const id = `${now.toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}`;
  const batch = { id, doc: state.doc, sentAt: now.toISOString(), comments };

  writeJsonAtomic(path.join(state.stages.inbox, `${id}.json`), batch);
  return batch;
}

function listBatches(state, stage) {
  const dir = state.stages[stage];
  return batchFiles(dir)
    .map((file) => readJsonIfExists(path.join(dir, file)))
    .filter(Boolean);
}

function listBatchIds(state, stage) {
  return batchFiles(state.stages[stage]).map((file) => path.basename(file, '.json'));
}

function claimPending(state) {
  return moveBatches(state, 'inbox', 'claimed')
    .map((file) => readJsonIfExists(path.join(state.stages.claimed, file)))
    .filter(Boolean);
}

function finishClaimed(state) {
  return moveBatches(state, 'claimed', 'done').length;
}

function moveBatches(state, from, to) {
  const moved = [];

  for (const file of batchFiles(state.stages[from])) {
    try {
      fs.renameSync(path.join(state.stages[from], file), path.join(state.stages[to], file));
      moved.push(file);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return moved;
}

// Batch ids start with an ISO timestamp, so name order is send order.
function batchFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json') && !name.startsWith('.'))
    .sort();
}

function writeServerInfo(state, info) {
  writeJsonAtomic(state.serverFile, info);
}

function readServerInfo(state) {
  return readJsonIfExists(state.serverFile);
}

function clearServerInfo(state, pid) {
  const info = readServerInfo(state);

  if (info && info.pid === pid) {
    fs.rmSync(state.serverFile, { force: true });
  }
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

// A missing file is expected: a batch can advance a stage between listing a
// directory and reading it.
function readJsonIfExists(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

function writeJsonAtomic(file, value) {
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);

  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

module.exports = {
  openState,
  addBatch,
  listBatches,
  listBatchIds,
  claimPending,
  finishClaimed,
  writeServerInfo,
  readServerInfo,
  clearServerInfo,
  isProcessAlive,
};
