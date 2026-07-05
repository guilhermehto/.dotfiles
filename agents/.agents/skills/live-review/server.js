// live-review server. Node core modules only, no deps.
// Serves an agent-authored review document (review.json) as an annotatable
// overview page, collects the user's questions into qa.json, accepts the
// agent's answers over HTTP, and live-refreshes the browser (SSE) when
// either file changes on disk.
//
//   node server.js <session-dir> [port]
//
// <session-dir> holds review.json (written by the agent before starting)
// and qa.json. qa.json is server-owned: questions arrive via POST /qa,
// answers via POST /answers — a single writer, so user sends and agent
// answers can't clobber each other.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const dirArg = process.argv[2];
const port = parseInt(process.argv[3] || '8766', 10);
if (!dirArg) {
  console.error('usage: node server.js <session-dir> [port]');
  process.exit(1);
}
const sessionDir = path.resolve(dirArg);
const reviewFile = path.join(sessionDir, 'review.json');
const qaFile = path.join(sessionDir, 'qa.json');
if (!fs.existsSync(reviewFile)) {
  console.error('no review.json in ' + sessionDir);
  process.exit(1);
}
const clientHtml = fs.readFileSync(path.join(__dirname, 'client.html'), 'utf8');

function readQa() {
  try {
    const j = JSON.parse(fs.readFileSync(qaFile, 'utf8'));
    if (Array.isArray(j.entries)) return j;
  } catch { /* missing or half-written — start fresh */ }
  return { entries: [] };
}
function writeQa(qa) { fs.writeFileSync(qaFile, JSON.stringify(qa, null, 2)); }

const sseClients = new Set();
let hadClient = false;
let shutdownTimer = null;
let noConnectTimer = null;
// exit shortly after the last browser tab closes (its SSE stream drops); a
// refresh briefly disconnects then reconnects, so wait out a grace window.
function armShutdownIfIdle() {
  clearTimeout(shutdownTimer);
  if (sseClients.size === 0 && hadClient) {
    shutdownTimer = setTimeout(() => {
      if (sseClients.size === 0) { console.log('all tabs closed — shutting down'); process.exit(0); }
    }, 5000);
  }
}
function broadcast(msg) {
  for (const res of sseClients) res.write('data: ' + msg + '\n\n');
}

// ponytail: watch the dir + filter by name, not the files themselves —
// survives atomic-save (rename swaps the inode and would break a file watch).
let debounce = null;
const dirWatch = fs.watch(sessionDir, (_evt, fn) => {
  if (fn && fn !== 'review.json' && fn !== 'qa.json') return;
  clearTimeout(debounce);
  debounce = setTimeout(() => broadcast('reload'), 120);
});
dirWatch.on('error', (e) => console.error('watch error (live-refresh disabled):', e.message));

function readBody(req, cb) {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => cb(body));
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const json = (code, obj) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify(obj));
  };

  if (req.method === 'GET' && u.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(clientHtml);
  }

  if (req.method === 'GET' && u.pathname === '/review') {
    return fs.readFile(reviewFile, 'utf8', (e, d) => {
      if (e) return json(500, { error: String(e) });
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(d);
    });
  }

  if (req.method === 'GET' && u.pathname === '/qa') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(JSON.stringify(readQa()));
  }

  if (req.method === 'GET' && u.pathname === '/events') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.write(': connected\n\n');
    sseClients.add(res);
    hadClient = true;
    clearTimeout(shutdownTimer);
    clearTimeout(noConnectTimer);
    const hb = setInterval(() => res.write(': hb\n\n'), 30000);
    req.on('close', () => { clearInterval(hb); sseClients.delete(res); armShutdownIfIdle(); });
    return;
  }

  // browser -> new questions: {questions:[{quote, question, section, context}]}
  if (req.method === 'POST' && u.pathname === '/qa') {
    return readBody(req, (body) => {
      let questions;
      try { questions = JSON.parse(body || '{}').questions || []; }
      catch { return json(400, { error: 'bad json' }); }
      const qa = readQa();
      let id = qa.entries.reduce((m, e) => Math.max(m, e.id || 0), 0);
      const now = new Date().toISOString();
      for (const q of questions) {
        qa.entries.push({
          id: ++id,
          quote: String(q.quote || ''),
          section: String(q.section || ''),
          context: String(q.context || ''),
          question: String(q.question || ''),
          status: 'pending',
          askedAt: now,
        });
      }
      writeQa(qa);
      json(200, { ok: true, added: questions.length, file: qaFile });
    });
  }

  // agent -> answers: {answers:[{id, answer}]}
  if (req.method === 'POST' && u.pathname === '/answers') {
    return readBody(req, (body) => {
      let answers;
      try { answers = JSON.parse(body || '{}').answers || []; }
      catch { return json(400, { error: 'bad json' }); }
      const qa = readQa();
      const now = new Date().toISOString();
      let answered = 0;
      const missing = [];
      for (const a of answers) {
        const e = qa.entries.find((x) => x.id === a.id);
        if (!e) { missing.push(a.id); continue; }
        e.answer = String(a.answer || '');
        e.status = 'answered';
        e.answeredAt = now;
        answered++;
      }
      writeQa(qa);
      json(200, { ok: true, answered, missing });
    });
  }

  res.writeHead(404);
  res.end('not found');
});

server.listen(port, () => {
  const url = 'http://localhost:' + port + '/';
  console.log('live-review serving ' + sessionDir + ' at ' + url);
  console.log('qa -> ' + qaFile);
  if (!process.env.LIVE_REVIEW_NO_OPEN) execFile('open', [url], () => {}); // macOS; ignore if it fails
  noConnectTimer = setTimeout(() => {
    if (!hadClient) { console.log('no tab connected in 5 min — shutting down'); process.exit(0); }
  }, 5 * 60 * 1000);
});
