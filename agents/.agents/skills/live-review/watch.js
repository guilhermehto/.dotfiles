// live-review sidecar watcher. Blocks until qa.json holds pending
// (unanswered) questions, then prints "pending:<n>" and exits 0. Run in the
// background so the harness wakes the agent when questions are sent — no
// manual "go". Answered entries never re-trigger.
//
//   node watch.js <session-dir>/qa.json
//
// ponytail: polls every 500ms rather than fs.watch — this is a plain OS
// process (not an LLM turn), so a tiny readFile twice a second is free, and
// polling sidesteps fs.watch's macOS quirks (EMFILE, missed atomic-saves).

const fs = require('fs');

const qaFile = process.argv[2];
if (!qaFile) { console.error('usage: node watch.js <qa.json>'); process.exit(1); }

function pending() {
  try {
    const j = JSON.parse(fs.readFileSync(qaFile, 'utf8'));
    return (j.entries || []).filter((e) => e.status === 'pending').length;
  } catch { return 0; } // missing/half-written file → nothing pending yet
}

(function poll() {
  const n = pending();
  if (n) { console.log('pending:' + n); process.exit(0); }
  setTimeout(poll, 500);
})();
