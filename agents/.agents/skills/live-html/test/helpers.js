'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const SKILL_DIR = path.join(__dirname, '..');

function makeDoc(markdown = '# Doc\n\nHello world.\n') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-html-'));
  const mdPath = path.join(dir, 'doc.md');

  fs.writeFileSync(mdPath, markdown);
  return mdPath;
}

// Resolves once the server prints its URL ("serving … at" or "already serving … at").
function startServer(mdPath, port = '0') {
  const child = spawn(process.execPath, [path.join(SKILL_DIR, 'server.js'), mdPath, port], {
    env: { ...process.env, LIVE_HTML_NO_OPEN: '1' },
  });
  let output = '';

  return new Promise((resolve, reject) => {
    child.stdout.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/at (http:\/\/127\.0\.0\.1:(\d+)\/)/);

      if (match) {
        resolve({ child, url: match[1], port: Number(match[2]), output: () => output });
      }
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    child.on('exit', (code) => reject(new Error(`server exited with ${code}: ${output}`)));
  });
}

function stopProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    child.once('exit', resolve);
    child.kill();
  });
}

function runWatch(mdPath, args = []) {
  const child = spawn(process.execPath, [path.join(SKILL_DIR, 'watch.js'), mdPath, ...args]);
  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  const done = new Promise((resolve) => {
    child.on('exit', (code) => resolve({ code, stderr, report: stdout ? JSON.parse(stdout) : null }));
  });

  return { child, done };
}

function request(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });

    req.on('error', reject);
    req.end(body);
  });
}

function postComments(server, comments, headers = {}) {
  return request(`${server.url}annotations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: `http://127.0.0.1:${server.port}`, ...headers },
    body: JSON.stringify({ comments }),
  });
}

// Collects raw SSE text; `waitFor(text, times)` resolves once `text` has
// arrived `times` times.
function openEventStream(server) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${server.url}events`, (res) => {
      let received = '';
      const waiters = [];
      const arrived = (text, times) => received.split(text).length - 1 >= times;

      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        received += chunk;

        for (const waiter of waiters.filter((entry) => arrived(entry.text, entry.times))) {
          waiter.resolve();
        }
      });

      const waitFor = (text, times = 1) => {
        if (arrived(text, times)) {
          return Promise.resolve();
        }

        return new Promise((done) => waiters.push({ text, times, resolve: done }));
      };

      waitFor(': connected').then(() => resolve({ waitFor, close: () => req.destroy() }));
    });

    req.on('error', reject);
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  makeDoc,
  startServer,
  stopProcess,
  runWatch,
  request,
  postComments,
  openEventStream,
  delay,
};
