// live-html sidecar watcher. Blocks until annotations.json holds pending
// (non-empty) comments, then prints "pending:<n>" and exits 0. Run in the
// background so the harness wakes the agent when comments are sent — no
// manual "go". Ignores the agent's own clearing writes (empty comments).
//
//   node watch.js <path-to/.annotator/annotations.json>
//
// ponytail: polls every 500ms rather than fs.watch — this is a plain OS
// process (not an LLM turn), so a tiny readFile twice a second is free, and
// polling sidesteps fs.watch's macOS quirks (EMFILE, missed atomic-saves).

const fs = require('fs');

const annFile = process.argv[2];
if (!annFile) { console.error('usage: node watch.js <annotations.json>'); process.exit(1); }

function pending() {
  try {
    const j = JSON.parse(fs.readFileSync(annFile, 'utf8'));
    return Array.isArray(j.comments) ? j.comments.length : 0;
  } catch { return 0; } // missing/half-written file → nothing pending yet
}

(function poll() {
  const n = pending();
  if (n) { console.log('pending:' + n); process.exit(0); }
  setTimeout(poll, 500);
})();
