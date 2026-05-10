import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT ?? 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.map': 'application/json; charset=utf-8',
};

async function handle(req, res) {
  try {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/e2e/pages/single.html';

    const safePath = normalize(join(ROOT, pathname));
    if (!safePath.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const s = await stat(safePath).catch(() => null);
    if (!s || !s.isFile()) {
      res.writeHead(404).end('Not found');
      return;
    }
    const data = await readFile(safePath);
    const mime = MIME[extname(safePath).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, {
      'content-type': mime,
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    });
    res.end(data);
  } catch (err) {
    res.writeHead(500).end(String(err));
  }
}

const server = createServer(handle);
server.listen(PORT, () => {
  process.stdout.write(`panorama-player e2e server on http://localhost:${PORT}\n`);
});
