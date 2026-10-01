// live-html annotation server. Node core modules only, no deps.
// Serves a markdown file as an annotatable page, stores each Send as a batch
// for watch.js to hand to the agent, and pushes doc and annotation changes to
// the browser over SSE (the page re-renders in place, keeping drafts).
//
//   node server.js <file.md> [port]
//
// Comments become agent instructions, so the server binds 127.0.0.1 only,
// rejects non-local Host headers (DNS rebinding) and cross-origin or non-JSON
// POSTs (CSRF), and the page runs under a CSP that blocks scripts embedded in
// the doc's raw HTML.

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const {
  openState,
  addBatch,
  listBatches,
  listBatchIds,
  writeServerInfo,
  readServerInfo,
  clearServerInfo,
} = require('./state');

const DEFAULT_PORT = 8765;
const PORT_ATTEMPTS = 20;
const IDLE_SHUTDOWN_MS = 30 * 1000;
const NO_CLIENT_SHUTDOWN_MS = 5 * 60 * 1000;
const HEARTBEAT_MS = 30 * 1000;
const POLL_MS = 300;
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_COMMENTS = 200;

const ASSETS = {
  '/': { file: 'client.html', type: 'text/html; charset=utf-8' },
  '/client.js': { file: 'client.js', type: 'text/javascript; charset=utf-8' },
  '/markdown.js': { file: 'markdown.js', type: 'text/javascript; charset=utf-8' },
};

const IMAGE_TYPES = {
  '.apng': 'image/apng',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

const PAGE_POLICY = [
  "default-src 'none'",
  "script-src 'self' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https: http:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const FILE_POLICY = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

const ROUTES = {
  'GET /favicon.ico': sendNoContent,
  'GET /doc': sendDoc,
  'GET /annotations': sendAnnotations,
  'GET /events': openEventStream,
  'GET /files': sendImage,
  'GET /health': sendHealth,
  'POST /annotations': receiveAnnotations,
};

async function main() {
  const { mdPath, port: requestedPort } = parseArgs(process.argv.slice(2));
  const state = openState(mdPath);
  const running = await findRunningServer(state);

  if (running) {
    console.log(`live-html already serving ${path.basename(mdPath)} at ${running.url}`);
    openBrowser(running.url);
    return;
  }

  const app = { mdPath, state, clients: new Set(), server: null, lifecycle: null };
  app.server = http.createServer((req, res) => handleRequest(req, res, app));
  app.lifecycle = createLifecycle(app.clients);

  const port = await listenOnFreePort(app.server, requestedPort);
  const url = `http://127.0.0.1:${port}/`;

  writeServerInfo(state, { pid: process.pid, port, url, doc: mdPath });
  process.on('exit', () => clearServerInfo(state, process.pid));

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => process.exit(0));
  }

  watchForChanges(app);

  console.log(`live-html serving ${path.basename(mdPath)} at ${url}`);
  console.log(`state: ${state.dir}`);
  openBrowser(url);
}

function parseArgs(args) {
  const [mdArg, portArg] = args;

  if (!mdArg) {
    fail('usage: node server.js <file.md> [port]');
  }

  const mdPath = path.resolve(mdArg);

  if (!fs.existsSync(mdPath) || !fs.statSync(mdPath).isFile()) {
    fail(`no such file: ${mdPath}`);
  }

  const port = portArg === undefined ? DEFAULT_PORT : Number(portArg);

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    fail(`invalid port: ${portArg}`);
  }

  return { mdPath, port };
}

async function findRunningServer(state) {
  const info = readServerInfo(state);

  if (!info) {
    return null;
  }

  try {
    const response = await fetch(`${info.url}health`, { signal: AbortSignal.timeout(1000) });
    const health = await response.json();
    return health.doc === state.doc ? info : null;
  } catch {
    // Stale server.json from a crashed run: nothing answers, start fresh.
    return null;
  }
}

function listenOnFreePort(server, firstPort) {
  const lastPort = firstPort === 0 ? 0 : firstPort + PORT_ATTEMPTS - 1;

  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      const onError = (error) => {
        server.off('listening', onListening);

        if (error.code === 'EADDRINUSE' && port < lastPort) {
          tryPort(port + 1);
          return;
        }

        if (error.code === 'EADDRINUSE') {
          error.message = `ports ${firstPort}-${lastPort} are all in use`;
        }

        reject(error);
      };
      const onListening = () => {
        server.off('error', onError);
        resolve(server.address().port);
      };

      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(port, '127.0.0.1');
    };

    tryPort(firstPort);
  });
}

// ---- requests ----

function handleRequest(req, res, app) {
  const port = app.server.address().port;

  if (!isLocalHost(req.headers.host, port)) {
    sendText(res, 403, 'forbidden host');
    return;
  }

  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  const asset = req.method === 'GET' ? ASSETS[url.pathname] : undefined;

  if (asset) {
    sendAsset(res, asset);
    return;
  }

  const route = ROUTES[`${req.method} ${url.pathname}`];

  if (!route) {
    sendText(res, 404, 'not found');
    return;
  }

  try {
    route(req, res, app, url);
  } catch (error) {
    console.error(error);
    sendText(res, 500, error.message);
  }
}

function sendAsset(res, asset) {
  fs.readFile(path.join(__dirname, asset.file), (error, content) => {
    if (error) {
      sendText(res, 500, `cannot read ${asset.file}: ${error.message}`);
      return;
    }

    res.writeHead(200, {
      'content-type': asset.type,
      'content-security-policy': PAGE_POLICY,
      'cache-control': 'no-store',
    });
    res.end(content);
  });
}

function sendDoc(req, res, app) {
  fs.readFile(app.mdPath, 'utf8', (error, markdown) => {
    if (error) {
      sendText(res, 500, `cannot read ${app.mdPath}: ${error.message}`);
      return;
    }

    sendJson(res, 200, { path: app.mdPath, name: path.basename(app.mdPath), markdown });
  });
}

function sendAnnotations(req, res, app) {
  sendJson(res, 200, {
    sent: listBatches(app.state, 'inbox'),
    applying: listBatches(app.state, 'claimed'),
  });
}

function sendNoContent(req, res) {
  res.writeHead(204);
  res.end();
}

function sendHealth(req, res, app) {
  sendJson(res, 200, { doc: app.mdPath, pid: process.pid });
}

function sendImage(req, res, app, url) {
  const requested = url.searchParams.get('path') || '';
  const filePath = path.resolve(path.dirname(app.mdPath), requested);
  const type = IMAGE_TYPES[path.extname(filePath).toLowerCase()];

  if (!type) {
    sendText(res, 415, 'only images are served');
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendText(res, 404, `no such image: ${requested}`);
      return;
    }

    res.writeHead(200, { 'content-type': type, 'content-security-policy': FILE_POLICY, 'cache-control': 'no-store' });
    res.end(content);
  });
}

function openEventStream(req, res, app) {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-store',
    connection: 'keep-alive',
  });
  res.write(': connected\n\n');
  app.clients.add(res);
  app.lifecycle.clientConnected();

  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), HEARTBEAT_MS);

  req.on('close', () => {
    clearInterval(heartbeat);
    app.clients.delete(res);
    app.lifecycle.clientDisconnected();
  });
}

function receiveAnnotations(req, res, app) {
  const port = app.server.address().port;

  if (!isSameOrigin(req.headers.origin, port)) {
    sendText(res, 403, 'forbidden origin');
    return;
  }

  if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) {
    sendText(res, 415, 'expected application/json');
    return;
  }

  readBody(req, (error, body) => {
    if (error) {
      sendText(res, 413, error.message);
      return;
    }

    const parsed = parseComments(body);

    if (parsed.error) {
      sendText(res, 400, parsed.error);
      return;
    }

    const batch = addBatch(app.state, parsed.comments);
    console.log(`received ${parsed.comments.length} comment(s) -> ${batch.id}`);
    sendJson(res, 200, { ok: true, id: batch.id, count: parsed.comments.length });
  });
}

function readBody(req, done) {
  const chunks = [];
  let size = 0;
  let tooLarge = false;

  req.on('data', (chunk) => {
    size += chunk.length;

    if (size > MAX_BODY_BYTES && !tooLarge) {
      tooLarge = true;
      done(new Error(`body over ${MAX_BODY_BYTES} bytes`));
    }

    if (!tooLarge) {
      chunks.push(chunk);
    }
  });
  req.on('end', () => {
    if (!tooLarge) {
      done(null, Buffer.concat(chunks).toString('utf8'));
    }
  });
}

function parseComments(body) {
  let payload;

  try {
    payload = JSON.parse(body);
  } catch {
    return { error: 'invalid JSON' };
  }

  const comments = payload && payload.comments;

  if (!Array.isArray(comments) || comments.length === 0 || comments.length > MAX_COMMENTS) {
    return { error: `"comments" must be an array of 1-${MAX_COMMENTS} items` };
  }

  const normalized = comments.map(normalizeComment);

  if (normalized.some((comment) => !comment.comment)) {
    return { error: 'every comment needs non-empty "comment" text' };
  }

  return { comments: normalized };
}

function normalizeComment(raw) {
  const value = raw && typeof raw === 'object' ? raw : {};

  return {
    quote: stringOrEmpty(value.quote),
    comment: stringOrEmpty(value.comment).trim(),
    heading: stringOrEmpty(value.heading),
    lines: isLineRange(value.lines) ? value.lines : null,
    source: stringOrEmpty(value.source),
  };
}

function stringOrEmpty(value) {
  return typeof value === 'string' ? value : '';
}

function isLineRange(lines) {
  return Array.isArray(lines) && lines.length === 2 && lines.every(Number.isInteger) && 1 <= lines[0] && lines[0] <= lines[1];
}

function isLocalHost(host, port) {
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`;
}

// Browsers always send Origin on cross-origin POSTs; curl and other local
// tools send none, which is fine — they can reach the file system anyway.
function isSameOrigin(origin, port) {
  return origin === undefined || origin === `http://127.0.0.1:${port}` || origin === `http://localhost:${port}`;
}

function sendJson(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
}

function sendText(res, status, message) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(message);
}

// ---- live updates ----

// ponytail: polls instead of fs.watch — macOS FSEvents can delay or drop a
// rename out of a directory (the page then sat on "applying"), while a stat
// and two readdirs every 300ms cost nothing and survive atomic saves too.
function watchForChanges(app) {
  let docVersion = docSignature(app.mdPath);
  let annotationsVersion = annotationsSignature(app.state);

  setInterval(() => {
    try {
      const nextDoc = docSignature(app.mdPath);
      const nextAnnotations = annotationsSignature(app.state);

      if (nextDoc !== docVersion) {
        docVersion = nextDoc;
        broadcast(app, 'doc');
      }

      if (nextAnnotations !== annotationsVersion) {
        annotationsVersion = nextAnnotations;
        broadcast(app, 'annotations');
      }
    } catch (error) {
      console.error(`checking for changes failed: ${error.message}`);
    }
  }, POLL_MS);
}

function docSignature(mdPath) {
  try {
    const stat = fs.statSync(mdPath);
    return `${stat.mtimeMs}:${stat.size}`;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return 'missing';
    }

    throw error;
  }
}

function annotationsSignature(state) {
  return `${listBatchIds(state, 'inbox').join(',')}|${listBatchIds(state, 'claimed').join(',')}`;
}

function broadcast(app, event) {
  for (const res of app.clients) {
    res.write(`event: ${event}\ndata: {}\n\n`);
  }
}

// Exit shortly after the last tab closes (its SSE stream drops). A refresh
// disconnects and reconnects within the grace window, so it survives.
function createLifecycle(clients) {
  let idleTimer = null;
  const noClientTimer = setTimeout(() => shutdown('no tab connected in 5 min'), NO_CLIENT_SHUTDOWN_MS);

  return {
    clientConnected() {
      clearTimeout(idleTimer);
      clearTimeout(noClientTimer);
    },
    clientDisconnected() {
      clearTimeout(idleTimer);

      if (clients.size === 0) {
        idleTimer = setTimeout(() => shutdown('all tabs closed'), IDLE_SHUTDOWN_MS);
      }
    },
  };
}

function shutdown(reason) {
  console.log(`${reason} — shutting down`);
  process.exit(0);
}

function openBrowser(url) {
  const opener = { darwin: 'open', linux: 'xdg-open' }[process.platform];

  if (process.env.LIVE_HTML_NO_OPEN || !opener) {
    return;
  }

  execFile(opener, [url], (error) => {
    if (error) {
      console.log(`could not open a browser (${error.message}) — open ${url} manually`);
    }
  });
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

main().catch((error) => {
  if (error.code === 'EPERM' || error.code === 'EACCES') {
    console.error(`cannot bind 127.0.0.1 (${error.code}): a command sandbox is likely blocking local ports — run without it`);
  } else {
    console.error(error.message);
  }

  process.exit(1);
});
