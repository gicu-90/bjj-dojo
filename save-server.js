// BJJ Dojo dev save-server.
//
// Serves the app as static files AND accepts editor saves so authored poses
// land in the repo automatically — no manual export.
//
//   Run:   node save-server.js          (from the repo root)
//   Open:  http://localhost:8090/index.html
//
// On every editor Save the app POSTs window.MOVES to /api/save-poses; this
// writes poses.js (`window.SAVED_POSES = <json>;`). poses.js is committed to
// git, so saved poses survive reloads and deploy to the live GitHub site.
// Nothing here runs in production — GitHub Pages just serves the static files.

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = 8090;
const MAX_BODY = 20 * 1024 * 1024; // 20 MB ceiling on a save payload

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.fbx': 'application/octet-stream',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  // --- Save endpoint -------------------------------------------------------
  if (req.method === 'POST' && req.url === '/api/save-poses') {
    let body = '';
    let aborted = false;
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY) { aborted = true; req.destroy(); }
    });
    req.on('end', () => {
      if (aborted) return;
      try {
        JSON.parse(body); // reject anything that isn't valid JSON
        const out = '// Auto-written by save-server.js on every editor Save.\n'
          + 'window.SAVED_POSES = ' + body + ';\n';
        fs.writeFileSync(path.join(ROOT, 'poses.js'), out);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
        console.log(new Date().toLocaleTimeString(), '→ saved poses.js (' + body.length + ' bytes)');
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"ok":false}');
        console.log('save rejected:', e.message);
      }
    });
    return;
  }

  // --- Static file serving -------------------------------------------------
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(ROOT, urlPath));
  // Path-traversal guard: never serve outside the repo root.
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('forbidden'); return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('BJJ save-server running  →  http://localhost:' + PORT + '/index.html');
  console.log('Editor saves auto-write poses.js in this folder.');
});
