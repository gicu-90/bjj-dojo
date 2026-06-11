// Tiny static server for the demo (GLTF textures fail on file://).
// Run: node serve.mjs  ->  http://localhost:8077/demo.html
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = 8077;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css', '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const rel = normalize(urlPath === '/' ? '/demo.html' : urlPath).replace(/^([/\\]|\.\.)+/, '');
    const file = join(ROOT, rel);
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream' });
    res.end(body);
    console.log('200', rel);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    console.log('404', req.url);
  }
}).listen(PORT, () => console.log(`serving on http://localhost:${PORT}/demo.html`));
