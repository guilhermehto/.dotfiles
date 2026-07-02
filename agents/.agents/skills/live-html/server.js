// live-html annotation server. Node core modules only, no deps.
// Serves a markdown file as an annotatable HTML page, accepts approved
// comments as a sidecar JSON file, and live-reloads the browser (SSE) when
// the markdown changes on disk.
//
//   node server.js <file.md> [port]
//
// State lives in <dir-of-md>/.annotator/annotations.json — the agent reads
// that file on "go", applies the comments, edits the md, and empties it.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const mdArg = process.argv[2];
const port = parseInt(process.argv[3] || '8765', 10);
if (!mdArg) {
  console.error('usage: node server.js <file.md> [port]');
  process.exit(1);
}
const mdPath = path.resolve(mdArg);
if (!fs.existsSync(mdPath)) {
  console.error('no such file: ' + mdPath);
  process.exit(1);
}
const mdDir = path.dirname(mdPath);
const mdName = path.basename(mdPath);
const stateDir = path.join(mdDir, '.annotator');
fs.mkdirSync(stateDir, { recursive: true });
const annFile = path.join(stateDir, 'annotations.json');
const clientHtml = fs.readFileSync(path.join(__dirname, 'client.html'), 'utf8');

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

// ponytail: watch the dir + filter by name, not the file itself — survives
// atomic-save (rename swaps the inode and would break a file watch).
let debounce = null;
const mdWatch = fs.watch(mdDir, (_evt, fn) => {
  if (fn && fn !== mdName) return;
  clearTimeout(debounce);
  debounce = setTimeout(() => broadcast('reload'), 120);
});
mdWatch.on('error', (e) => console.error('md watch error (live-reload disabled):', e.message));

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && u.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(clientHtml);
  }

  if (req.method === 'GET' && u.pathname === '/doc') {
    return fs.readFile(mdPath, 'utf8', (e, d) => {
      if (e) { res.writeHead(500); return res.end(String(e)); }
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      res.end(d);
    });
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

  if (req.method === 'POST' && u.pathname === '/annotations') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      let comments = [];
      try { comments = (JSON.parse(body || '{}').comments) || []; }
      catch (e) { res.writeHead(400); return res.end('bad json'); }
      const out = { doc: mdPath, sentAt: new Date().toISOString(), comments };
      fs.writeFileSync(annFile, JSON.stringify(out, null, 2));
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, count: comments.length, file: annFile }));
    });
    return;
  }

  res.writeHead(404);
  res.end('not found');
});

server.listen(port, () => {
  const url = 'http://localhost:' + port + '/';
  console.log('live-html serving ' + mdName + ' at ' + url);
  console.log('annotations -> ' + annFile);
  if (!process.env.LIVE_HTML_NO_OPEN) execFile('open', [url], () => {}); // macOS; ignore if it fails
  noConnectTimer = setTimeout(() => {
    if (!hadClient) { console.log('no tab connected in 5 min — shutting down'); process.exit(0); }
  }, 5 * 60 * 1000);
});
